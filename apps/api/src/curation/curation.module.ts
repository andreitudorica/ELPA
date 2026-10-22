import { Module } from '@nestjs/common';

import { AuditModule } from '../audit';
import { ResearchModule } from '../research';
import { VerificationController } from './verification.controller';
import { VerificationRepository } from './verification.repository';
import { VerificationService } from './verification.service';

@Module({
  imports: [ResearchModule, AuditModule],
  controllers: [VerificationController],
  providers: [VerificationRepository, VerificationService],
  exports: [VerificationService],
})
export class CurationModule {}
