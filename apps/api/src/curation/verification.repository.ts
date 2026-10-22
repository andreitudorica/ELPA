import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { DatabaseService, uuidV7 } from '../database';
import {
  verificationDecisions,
  verificationEligibility,
  verificationEvaluations,
} from './verification.schema';

export type DecisionInsert = Omit<
  typeof verificationDecisions.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'publication'
>;
export type DecisionRow = typeof verificationDecisions.$inferSelect;

/** Append-only: there is no update or delete path for decisions. */
@Injectable()
export class VerificationRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertDecision(values: DecisionInsert): Promise<string | null> {
    const now = new Date();
    const inserted = await this.database.executor
      .insert(verificationDecisions)
      .values({ ...values, id: uuidV7(), createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ id: verificationDecisions.id });
    return inserted[0]?.id ?? null;
  }

  async findDecision(id: string): Promise<DecisionRow | undefined> {
    const rows = await this.database.executor
      .select()
      .from(verificationDecisions)
      .where(eq(verificationDecisions.id, id))
      .limit(1);
    return rows[0];
  }

  async isSuperseded(id: string): Promise<boolean> {
    const rows = await this.database.executor
      .select({ id: verificationDecisions.id })
      .from(verificationDecisions)
      .where(eq(verificationDecisions.supersedesDecisionId, id))
      .limit(1);
    return rows.length > 0;
  }

  async listForCandidate(campaignId: string, candidateId: string): Promise<DecisionRow[]> {
    return this.database.executor
      .select()
      .from(verificationDecisions)
      .where(
        and(
          eq(verificationDecisions.researchCampaignId, campaignId),
          eq(verificationDecisions.candidateId, candidateId),
        ),
      )
      .orderBy(desc(verificationDecisions.decidedAt), desc(verificationDecisions.id))
      .limit(200);
  }

  async activeEligibility(policyVersion: string) {
    return this.database.executor
      .select()
      .from(verificationEligibility)
      .where(
        and(
          eq(verificationEligibility.policyVersion, policyVersion),
          isNull(verificationEligibility.revokedAt),
        ),
      );
  }

  async eligibilityByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.database.executor
      .select()
      .from(verificationEligibility)
      .where(inArray(verificationEligibility.id, ids));
  }

  async insertEvaluation(
    values: Omit<typeof verificationEvaluations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const now = new Date();
    const inserted = await this.database.executor
      .insert(verificationEvaluations)
      .values({ ...values, id: uuidV7(), createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ id: verificationEvaluations.id });
    const id = inserted[0]?.id;
    if (id !== undefined) return id;
    const existing = await this.database.executor
      .select({ id: verificationEvaluations.id })
      .from(verificationEvaluations)
      .where(
        and(
          eq(verificationEvaluations.policyVersion, values.policyVersion),
          eq(verificationEvaluations.corpusDigest, values.corpusDigest),
          eq(verificationEvaluations.reportDigest, values.reportDigest),
        ),
      )
      .limit(1);
    const found = existing[0]?.id;
    if (found === undefined) throw new Error('Evaluation insert conflict without an existing row');
    return found;
  }

  async findEvaluation(id: string) {
    const rows = await this.database.executor
      .select()
      .from(verificationEvaluations)
      .where(eq(verificationEvaluations.id, id))
      .limit(1);
    return rows[0];
  }

  async latestEvaluation(policyVersion: string) {
    const rows = await this.database.executor
      .select()
      .from(verificationEvaluations)
      .where(eq(verificationEvaluations.policyVersion, policyVersion))
      .orderBy(desc(verificationEvaluations.evaluatedAt))
      .limit(1);
    return rows[0];
  }

  async insertEligibility(
    values: Omit<typeof verificationEligibility.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const now = new Date();
    const id = uuidV7();
    await this.database.executor
      .insert(verificationEligibility)
      .values({ ...values, id, createdAt: now, updatedAt: now });
    return id;
  }
}
