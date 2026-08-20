import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ClsService } from 'nestjs-cls';
import type { Observable } from 'rxjs';

import { CORRELATION_ID_HEADER, type AppClsStore } from '../context/cls';

/**
 * Echo the correlation ID on every response as `X-Correlation-Id`. The
 * exception filter already does this for error responses; the
 * interceptor covers the success path so devs get consistent
 * cross-log tracing regardless of status code.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const id = this.cls.get('correlationId');
    if (id !== undefined) {
      reply.header(CORRELATION_ID_HEADER, id);
    }
    return next.handle();
  }
}
