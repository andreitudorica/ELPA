import type { RecordAuditEvent } from '../audit';
import type { NewClaim, NewRunRecord, AcquisitionRepository } from './acquisition.repository';
import { canonicalJson, sha256Hex } from './acquisition/source-record';
import { outputSchema, validateFact } from './extraction/contracts';
import type { ExtractionOutput } from './extraction/contracts';
import type { Corpus } from './extraction/corpus';
import { ONTOLOGY_VERSION } from './extraction/ontology';

interface PersistencePorts {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
  storeClaims: AcquisitionRepository['storeClaims'];
  storeRunRecords: AcquisitionRepository['storeRunRecords'];
  finishRun: AcquisitionRepository['finishRun'];
  audit(event: RecordAuditEvent): Promise<void>;
}

/** Reprocess existing Evidence; never upsert Candidates or write Catalog/Curation. */
export async function persistExtraction(
  input: {
    runId: string;
    administratorId: string;
    entries: Corpus['entries'];
    outputs: ExtractionOutput[];
    manifestSha256: string;
  },
  ports: PersistencePorts,
) {
  const documents = new Map(input.entries.map((entry) => [entry.document.id, entry.document]));
  if (
    new Set(input.outputs.map((output) => output.documentId)).size !== input.entries.length ||
    input.outputs.length !== input.entries.length
  )
    throw new Error('Extraction must return exactly one output per document');
  for (const output of input.outputs) {
    outputSchema.parse(output);
    const document = documents.get(output.documentId);
    if (
      document === undefined ||
      output.facts.some((fact) => validateFact(fact, document).length > 0)
    )
      throw new Error('Invalid Evidence grounding; no Claims written');
  }
  return ports.runInTransaction(async () => {
    let created = 0;
    let proposed = 0;
    for (const output of input.outputs) {
      const document = documents.get(output.documentId);
      if (document === undefined) throw new Error('Missing document');
      const claims: NewClaim[] = output.facts.map((fact) => ({
        candidateId: document.candidateId,
        evidenceId: document.evidenceId,
        target: `offer.${fact.attribute}`,
        value: fact.value,
        extractionMethod: output.method,
        // Uncalibrated method: confidence=0 is a storage convention, not a probability.
        confidence: 0,
        evidenceLocator: {
          type: 'text_span',
          ontologyVersion: ONTOLOGY_VERSION,
          documentId: document.id,
          sourceVersion: fact.sourceVersion,
          textSha256: fact.textSha256,
          fieldPath: fact.fieldPath,
          start: fact.start,
          end: fact.end,
          quote: fact.quote,
          explicitness: fact.explicitness,
          entityLevel: fact.entityLevel,
          scope: fact.scope,
          temporal: fact.temporal,
          ambiguity: fact.ambiguity,
          evaluationStatus: 'independent_review_pending',
          grounding: 'technically_validated',
        },
      }));
      proposed += claims.length;
      created += await ports.storeClaims(input.runId, new Date(document.observedAt), claims);
    }
    const records: NewRunRecord[] = input.entries.map((entry, index) => ({
      evidenceId: entry.document.evidenceId,
      candidateId: entry.document.candidateId,
      evidenceOutcome: 'unchanged',
      extractionStatus: 'parsed',
      errors: [],
      inCampaignScope: true,
      position: index + 1,
    }));
    await ports.storeRunRecords(input.runId, records);
    const digest = sha256Hex(canonicalJson(input.outputs));
    const stats = {
      corpusManifestSha256: input.manifestSha256,
      recordsRead: input.entries.length,
      recordsParsed: input.entries.length,
      recordsRejected: 0,
      claimsCreated: created,
      claimsUnchanged: proposed - created,
      proposedFacts: proposed,
      evidenceCreated: 0,
      candidatesCreated: 0,
      evaluationStatus: 'independent_review_pending',
      externalCalls: 0,
    };
    await ports.finishRun(input.runId, {
      status: 'succeeded',
      stats,
      outputDigest: digest,
      failure: null,
    });
    await ports.audit({
      action: 'extraction_run.completed',
      targetType: 'AcquisitionRun',
      targetId: input.runId,
      administratorId: input.administratorId,
      metadata: {
        outputDigest: digest,
        claimsCreated: created,
        corpusManifestSha256: input.manifestSha256,
      },
    });
    return { runId: input.runId, stats, outputDigest: digest };
  });
}
