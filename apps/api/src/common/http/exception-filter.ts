import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import type { AppClsStore } from '../context/cls';
import { AnyAppError, AppError, ValidationError, assertNever } from '../errors/app-error';
import { PROBLEM_CONTENT_TYPE, type FieldError, type ProblemDetails } from '../errors/problem';

/**
 * Single Nest exception filter (ADR 0022 + Q6 Bundle B). Every response
 * error path — thrown `AppError`, Zod parse failure, Nest `HttpException`,
 * or unhandled exception — flows through here and emits RFC 7807
 * problem+json with a correlation ID for cross-log tracing.
 *
 * Controllers therefore never wrap logic in `try/catch` for HTTP
 * mapping: services throw typed errors, the filter converts them, one
 * consistent shape reaches the client, and stack traces never leave the
 * server.
 */
@Catch()
@Injectable()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly cls: ClsService<AppClsStore>,
    @InjectPinoLogger(AppExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const reply = httpContext.getResponse<FastifyReply>();
    const request = httpContext.getRequest<FastifyRequest>();

    // ClsMiddleware populates correlationId on every HTTP request, so
    // it is always defined by the time an exception surfaces here. The
    // fallback covers the theoretical non-request code path (a system
    // filter firing outside a CLS scope), never the real hot path.
    const correlationId = this.cls.get('correlationId') ?? 'unknown';
    const instance = typeof request.url === 'string' ? request.url : undefined;

    const problem = this.mapToProblem(exception, correlationId, instance);

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, correlation_id: correlationId, path: instance },
        problem.title,
      );
    } else {
      this.logger.info(
        {
          correlation_id: correlationId,
          status: problem.status,
          path: instance,
        },
        problem.title,
      );
    }

    void reply
      .code(problem.status)
      .header('X-Correlation-Id', correlationId)
      .header('Content-Type', PROBLEM_CONTENT_TYPE)
      .send(problem);
  }

  private mapToProblem(
    exception: unknown,
    correlationId: string,
    instance: string | undefined,
  ): ProblemDetails {
    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError();
      if (error instanceof ZodError) {
        return this.mapZodError(error, correlationId, instance);
      }
    }
    if (exception instanceof AppError) {
      return this.mapAppError(exception as AnyAppError, correlationId, instance);
    }
    if (exception instanceof ZodError) {
      return this.mapZodError(exception, correlationId, instance);
    }
    if (exception instanceof HttpException) {
      return this.mapHttpException(exception, correlationId, instance);
    }
    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      correlation_id: correlationId,
      code: 'internal.unhandled',
      ...(instance !== undefined ? { instance } : {}),
    };
  }

  private mapZodError(
    error: ZodError,
    correlationId: string,
    instance: string | undefined,
  ): ProblemDetails {
    const fieldErrors: FieldError[] = error.issues.map((issue) => ({
      path: [...issue.path] as (string | number)[],
      code: issue.code,
      message: issue.message,
    }));
    return this.mapAppError(
      new ValidationError('Request validation failed', fieldErrors),
      correlationId,
      instance,
    );
  }

  private mapAppError(
    err: AnyAppError,
    correlationId: string,
    instance: string | undefined,
  ): ProblemDetails {
    const base: ProblemDetails = {
      type: `elpa:error/${err.kind}`,
      title: err.title,
      status: err.status,
      detail: err.message,
      correlation_id: correlationId,
      code: err.code,
      ...(instance !== undefined ? { instance } : {}),
    };
    // Exhaustive switch — new AppError subtypes must be added to
    // `AnyAppError` AND handled here, or TypeScript refuses to compile.
    switch (err.kind) {
      case 'not_found':
      case 'conflict':
      case 'precondition':
      case 'authentication':
      case 'authorization':
      case 'external':
        return base;
      case 'validation':
        return { ...base, field_errors: [...err.fieldErrors] };
      default:
        return assertNever(err);
    }
  }

  private mapHttpException(
    err: HttpException,
    correlationId: string,
    instance: string | undefined,
  ): ProblemDetails {
    const status = err.getStatus();
    const title = HttpStatus[status] ?? 'HTTP Error';
    return {
      type: 'about:blank',
      title: typeof title === 'string' ? title : 'HTTP Error',
      status,
      detail: err.message,
      correlation_id: correlationId,
      code: `http.${String(status)}`,
      ...(instance !== undefined ? { instance } : {}),
    };
  }
}
