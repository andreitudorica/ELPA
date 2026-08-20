import { Injectable } from '@nestjs/common';

import { DatabaseService, uuidV7 } from '../database';
import { auditEvents } from './audit.schema';

export interface RecordAuditEvent {
  action: string;
  targetType: string;
  targetId: string;
  administratorId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly database: DatabaseService) {}

  async record(event: RecordAuditEvent): Promise<void> {
    const now = new Date();
    await this.database.executor.insert(auditEvents).values({
      id: uuidV7(),
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      administratorId: event.administratorId,
      metadata: event.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }
}
