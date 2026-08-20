import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';

/**
 * Root module. In Phase A this only wires the liveness probe; module
 * boundaries (Access, Research, Catalog, Curation, Recommendation,
 * Audit — per ADR 0020) are added in later commits, each behind its
 * own public barrel.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
