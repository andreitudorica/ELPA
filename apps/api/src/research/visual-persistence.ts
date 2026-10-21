import type { AuditRepository } from '../audit';
import type { AcquisitionRepository, NewClaim } from './acquisition.repository';
import { canonicalJson, sha256Hex } from './acquisition/source-record';
import { validateVisualOutput } from './visual/contracts';
import type { VisualEntry, VisionOutput } from './visual/contracts';
import type { ImportedVisionRun } from './visual/vision';

/** Caller owns the transaction. No port can write Candidates, Catalog or Curation. */
export async function persistVisualObservations(
  input: {
    entry: VisualEntry;
    output: VisionOutput;
    metadata: ImportedVisionRun['metadata'];
    method: string;
    runId: string;
    administratorId: string;
  },
  acquisitions: Pick<AcquisitionRepository, 'storeClaims' | 'storeRunRecords' | 'finishRun'>,
  audit: Pick<AuditRepository, 'record'>,
) {
  const { entry, output, metadata } = input;
  if (validateVisualOutput(output, entry).accepted === null)
    throw new Error('Invalid visual grounding; no Claims written');
  const proposed: NewClaim[] = output.observations
    .filter((observation) => observation.visibility !== 'not_visible')
    .map((observation) => ({
      candidateId: entry.candidateId,
      evidenceId: entry.evidenceId,
      target: `image.visible.${observation.feature}`,
      value: {
        visibility: observation.visibility,
        uncertainty: observation.uncertainty,
        propertyAttribution: observation.propertyAttribution,
        propertyAssertion: false,
      },
      extractionMethod: input.method,
      confidence: 0,
      evidenceLocator: {
        type: 'image_annotation',
        imageSha256: entry.image.sha256,
        specificationVersion: output.specificationVersion,
        model: metadata.model,
        modelVersion: metadata.modelVersion,
        promptVersion: metadata.promptVersion,
        processingVersion: output.processingVersion,
        processingTimestamp: metadata.executedAt,
        region: observation.region,
        visibility: observation.visibility,
        uncertainty: observation.uncertainty,
        propertyAttribution: observation.propertyAttribution,
        propertyAssertion: false,
        evaluationStatus: 'independent_review_pending',
        scene: output.scene,
        sourceEvidenceId: entry.sourceEvidenceId,
      },
    }));
  const created = await acquisitions.storeClaims(
    input.runId,
    new Date(entry.image.retrievedAt),
    proposed,
  );
  await acquisitions.storeRunRecords(input.runId, [
    {
      evidenceId: entry.evidenceId,
      candidateId: entry.candidateId,
      position: 1,
      evidenceOutcome: 'unchanged',
      extractionStatus: 'parsed',
      errors: [],
      inCampaignScope: false,
    },
  ]);
  const stats = {
    recordsRead: 1,
    recordsParsed: 1,
    recordsRejected: 0,
    claimsCreated: created,
    claimsUnchanged: proposed.length - created,
    candidatesCreated: 0,
    evidenceCreated: 0,
    propertyClaimsCreated: 0,
    evaluationStatus: 'independent_review_pending',
    model: metadata.model,
    modelVersion: metadata.modelVersion,
    promptVersion: metadata.promptVersion,
    method: input.method,
  };
  const digest = sha256Hex(canonicalJson(output));
  await acquisitions.finishRun(input.runId, {
    status: 'succeeded',
    stats,
    outputDigest: digest,
    failure: null,
  });
  await audit.record({
    action: 'visual_extraction.completed',
    targetType: 'AcquisitionRun',
    targetId: input.runId,
    administratorId: input.administratorId,
    metadata: { outputDigest: digest, claimsCreated: created, propertyClaimsCreated: 0 },
  });
  return { runId: input.runId, ...stats };
}
