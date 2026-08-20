import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ZodResponse, createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DatabaseService } from '../database';

const HealthStatusSchema = z.object({ status: z.literal('ok') }).meta({ id: 'HealthStatus' });

class HealthStatusDto extends createZodDto(HealthStatusSchema) {}

/**
 * Liveness probe (Phase A Q6, Bundle C). Returns 200 iff the process is
 * up and Nest has bootstrapped. Deliberately does NOT touch the database;
 * readiness (`/readyz`) is added in the persistence baseline commit.
 */
@Controller('healthz')
export class HealthController {
  @Get()
  @ZodResponse({ status: 200, type: HealthStatusDto })
  check(): HealthStatusDto {
    return { status: 'ok' };
  }
}

/** Readiness probe: confirms that the API can reach its system of record. */
@Controller('readyz')
export class ReadinessController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ZodResponse({ status: 200, type: HealthStatusDto })
  async check(): Promise<HealthStatusDto> {
    try {
      await this.database.ping();
      return { status: 'ok' };
    } catch (error) {
      throw new ServiceUnavailableException('PostgreSQL is unavailable', {
        cause: error,
      });
    }
  }
}
