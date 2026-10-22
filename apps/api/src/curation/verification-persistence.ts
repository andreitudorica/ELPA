import type { RecordAuditEvent } from '../audit';
import { ConflictError, PreconditionError } from '../common';
import type { DecisionInsert } from './verification.repository';
import { categorySchema } from './verification/contracts';
import { CATEGORIES } from './verification/policy';

export interface EligibilityRecord {
  id: string;
  policyVersion: string;
  category: string;
  revokedAt: Date | null;
}

interface Ports {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  insert(decision: DecisionInsert): Promise<string | null>;
  eligibility(ids: string[]): Promise<EligibilityRecord[]>;
  audit(event: RecordAuditEvent): Promise<void>;
}

/** Re-checks, before any write, what the database constraints also enforce. */
function assertMachineDecision(
  decision: DecisionInsert,
  eligibility: Map<string, EligibilityRecord>,
) {
  if (decision.method !== 'machine_policy')
    throw new PreconditionError('Batch decisions must use the machine policy method');
  if (decision.outcome === 'rejected')
    throw new PreconditionError('Only an Administrator can reject');
  if (decision.outcome !== 'verified') return;
  const category = categorySchema.safeParse(decision.category);
  if (!category.success || CATEGORIES[category.data].autonomy !== 'gated')
    throw new PreconditionError('Category cannot be verified autonomously');
  const approved =
    decision.eligibilityId == null ? undefined : eligibility.get(decision.eligibilityId);
  if (
    approved?.revokedAt !== null ||
    approved.category !== category.data ||
    approved.policyVersion !== decision.policyVersion
  )
    throw new PreconditionError('Machine verification requires an approved eligibility');
}

export function persistMachineDecisions(
  input: {
    campaignId: string;
    administratorId: string;
    corpusDigest: string;
    decisions: DecisionInsert[];
  },
  ports: Ports,
) {
  return ports.transaction(async () => {
    const ids = [
      ...new Set(
        input.decisions.flatMap((d) => (d.eligibilityId == null ? [] : [d.eligibilityId])),
      ),
    ];
    const eligibility = new Map((await ports.eligibility(ids)).map((e) => [e.id, e]));
    for (const decision of input.decisions) assertMachineDecision(decision, eligibility);
    let created = 0;
    for (const decision of input.decisions) if ((await ports.insert(decision)) !== null) created++;
    const outcomes: Record<string, number> = {};
    for (const d of input.decisions) outcomes[d.outcome] = (outcomes[d.outcome] ?? 0) + 1;
    await ports.audit({
      action: 'verification.decisions_recorded',
      targetType: 'ResearchCampaign',
      targetId: input.campaignId,
      administratorId: input.administratorId,
      metadata: {
        corpusDigest: input.corpusDigest,
        created,
        decisions: input.decisions.length,
        outcomes,
      },
    });
    return created;
  });
}

export const OVERRIDE_OUTCOMES = ['verified', 'rejected', 'insufficient_evidence'] as const;

export function persistOverride(
  input: { decision: DecisionInsert; supersededId: string; administratorId: string },
  ports: Pick<Ports, 'transaction' | 'insert' | 'audit'> & {
    superseded(id: string): Promise<boolean>;
  },
) {
  return ports.transaction(async () => {
    const { decision } = input;
    if (decision.method !== 'administrator' || decision.supersedesDecisionId !== input.supersededId)
      throw new PreconditionError(
        'An override is an Administrator decision superseding one decision',
      );
    if ((decision.overrideReason ?? '').trim().length < 10)
      throw new PreconditionError('An override needs an auditable reason');
    if (!(OVERRIDE_OUTCOMES as readonly string[]).includes(decision.outcome))
      throw new PreconditionError('Unsupported override outcome');
    if (await ports.superseded(input.supersededId))
      throw new ConflictError('Decision was already superseded');
    const id = await ports.insert(decision);
    if (id === null) throw new ConflictError('Identical override already recorded');
    await ports.audit({
      action: 'verification.overridden',
      targetType: 'VerificationDecision',
      targetId: input.supersededId,
      administratorId: input.administratorId,
      metadata: { decisionId: id, outcome: decision.outcome, claimId: decision.claimId },
    });
    return id;
  });
}
