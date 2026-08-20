import { z } from 'zod';

/**
 * RFC 7807 `application/problem+json` shape (ADR 0022 + Q6). Every
 * error response from `AppExceptionFilter` conforms to this schema,
 * including `correlation_id` for cross-log tracing.
 */
export const FieldErrorSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
});

export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  correlation_id: z.string(),
  code: z.string(),
  field_errors: z.array(FieldErrorSchema).optional(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
