import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe (Phase A Q6, Bundle C). Returns 200 iff the process is
 * up and Nest has bootstrapped. Deliberately does NOT touch the database;
 * readiness (`/readyz`) is added in the persistence baseline commit.
 */
@Controller('healthz')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
