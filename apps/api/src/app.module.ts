import { Module } from '@nestjs/common';

import { AccessModule } from './access';
import { AuditModule } from './audit';
import { CatalogModule } from './catalog';
import { CommonModule } from './common';
import { CurationModule } from './curation';
import { DatabaseModule } from './database';
import { HealthModule } from './health/health.module';
import { RecommendationModule } from './recommendation';
import { ResearchModule } from './research';

/**
 * Composition root for the modular monolith. Domain modules expose only their
 * public barrels; Database and Common own shared infrastructure concerns.
 */
@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    AccessModule,
    CatalogModule,
    AuditModule,
    ResearchModule,
    CurationModule,
    RecommendationModule,
    HealthModule,
  ],
})
export class AppModule {}
