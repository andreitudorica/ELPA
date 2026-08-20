/**
 * Public surface of the shared `common/` module (ADR 0020 barrel-per-
 * module convention). Every other module imports these types and
 * classes only from this path.
 */
export type { AppClsStore } from './context/cls';
export { CORRELATION_ID_HEADER, resolveCorrelationId } from './context/cls';

export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ExternalError,
  NotFoundError,
  PreconditionError,
  ValidationError,
  assertNever,
} from './errors/app-error';
export type { AnyAppError, AppErrorOptions, FieldIssue } from './errors/app-error';

export { ADMIN_ROUTE_METADATA_KEY, AdminController } from './http/admin-controller.decorator';
export { AdministratorGuard } from './http/administrator-guard';
export { ADMINISTRATOR_RESOLVER } from './http/administrator-resolver';
export type { AdministratorIdentity, AdministratorResolver } from './http/administrator-resolver';
export { verifyAdminRouteBoundary } from './http/route-verifier';

export { CommonModule } from './common.module';
