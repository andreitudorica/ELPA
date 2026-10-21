import type { RecordAuditEvent } from '../audit';
import { canonicalJson, sha256Hex } from './acquisition/source-record';
import type { ReconciliationCase, ReconciliationResult } from './reconciliation/contracts';

interface Ports {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  store(input: ReconciliationCase, result: ReconciliationResult): Promise<string | null>;
  audit(event: RecordAuditEvent): Promise<void>;
}

/** This write boundary exposes only append-assessment and Audit operations. */
export function persistReconciliation(
  input: {
    campaignId: string;
    administratorId: string;
    corpusDigest: string;
    cases: ReconciliationCase[];
    results: ReconciliationResult[];
  },
  ports: Ports,
) {
  if (
    input.cases.length !== input.results.length ||
    input.cases.some((c, i) => input.results[i]?.caseId !== c.id)
  )
    throw new Error('Assessment inputs do not match results');
  return ports.transaction(async () => {
    let created = 0;
    for (const [index, result] of input.results.entries()) {
      const item = input.cases[index];
      if (item === undefined) throw new Error('Missing assessment input');
      if ((await ports.store(item, result)) !== null) created++;
    }
    await ports.audit({
      action: 'reconciliation.completed',
      targetType: 'ResearchCampaign',
      targetId: input.campaignId,
      administratorId: input.administratorId,
      metadata: {
        corpusDigest: input.corpusDigest,
        created,
        assessments: input.results.length,
        outputDigest: sha256Hex(canonicalJson(input.results)),
      },
    });
    return created;
  });
}
