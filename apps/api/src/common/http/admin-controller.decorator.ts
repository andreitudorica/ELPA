import { Controller, SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';

import { AdministratorGuard } from './administrator-guard';

/**
 * Metadata key used by the boot-time route verifier to identify routes
 * that MUST live under `/api/admin/*` AND be guarded by
 * `AdministratorGuard`. The `@AdminController` decorator sets both.
 */
export const ADMIN_ROUTE_METADATA_KEY = 'elpa:admin-route';

/**
 * Single decorator that composes:
 *   - `@Controller('admin/' + path)` — enforces the `/api/admin/*`
 *     prefix (with the global `/api` applied in `main.ts`),
 *   - `@UseGuards(AdministratorGuard)` — enforces authentication,
 *   - `@SetMetadata(ADMIN_ROUTE_METADATA_KEY, true)` — declares intent
 *     so the boot-time verifier can cross-check.
 *
 * Forgetting the decorator on an admin controller is caught by the
 * boot-time verifier and refuses to start the app (ADR 0020, Q5
 * Bundle C — "fix from core, not patch").
 */
export function AdminController(path: string): ClassDecorator {
  return applyDecorators(
    Controller(`admin/${path}`),
    UseGuards(AdministratorGuard),
    SetMetadata(ADMIN_ROUTE_METADATA_KEY, true),
  );
}
