import { describe, expect, it } from 'vitest';

import {
  ASSESSOR_PROMPT_SHA256,
  ASSESSOR_PROMPT_VERSION,
  buildRequest,
  requestSha256,
  validateCaptured,
} from './assessor';
import type { CapturedAssessment } from './contracts';
import { AS_OF, COUNTIES, textFacility } from './fixtures.test-support';
import { validate } from './validator';

const subject = textFacility('sauna', 'saună');
const validation = validate(subject, { asOf: AS_OF, counties: COUNTIES });

function captured(
  output: unknown,
  overrides: Partial<CapturedAssessment> = {},
): CapturedAssessment {
  const request = buildRequest(subject, validation);
  if (request === null) throw new Error('fixture must be transferable');
  return {
    itemId: subject.itemId,
    requestSha256: requestSha256(request),
    provider: 'test',
    model: 'test-model',
    servedModel: 'test-model',
    promptVersion: ASSESSOR_PROMPT_VERSION,
    promptSha256: ASSESSOR_PROMPT_SHA256,
    parameters: {},
    stopReason: 'end_turn',
    output: output as CapturedAssessment['output'],
    latencyMs: 5,
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    costUsd: 0.0007,
    executedAt: AS_OF,
    error: null,
    ...overrides,
  };
}

const supported = {
  verdict: 'supported',
  rationale: 'The description states a sauna.',
  supporting_evidence_ids: ['E1'],
  contradicting_evidence_ids: [],
  supporting_quotes: [{ evidence_id: 'E1', quote: 'saună' }],
  concerns: ['none'],
};

describe('evidence assessor boundary', () => {
  it('sends only allowlisted passages under opaque references', () => {
    const request = buildRequest(subject, validation);
    expect(request?.references).toEqual({ E1: subject.claim.evidenceId });
    expect(request?.user).toContain('Proprietate cu saună');
    expect(request?.user).not.toContain(subject.claim.evidenceId);
  });

  it('accepts a cited, verbatim-grounded answer and maps references back', () => {
    const request = buildRequest(subject, validation);
    const result = validateCaptured(captured(supported), request);
    expect(result.status).toBe('accepted');
    expect(result.supportingEvidenceIds).toEqual([subject.claim.evidenceId]);
  });

  it('rejects invented evidence references and quotes absent from the passage', () => {
    const request = buildRequest(subject, validation);
    const invented = validateCaptured(
      captured({ ...supported, supporting_evidence_ids: ['E7'] }),
      request,
    );
    expect(invented.status).toBe('rejected');
    expect(invented.errors).toContain('invented_evidence_reference');
    const ungrounded = validateCaptured(
      captured({ ...supported, supporting_quotes: [{ evidence_id: 'E1', quote: 'piscină' }] }),
      request,
    );
    expect(ungrounded.errors).toContain('ungrounded_quote');
    expect(ungrounded.verdict).toBeNull();
  });

  it('rejects support without citation, schema violations and refusals', () => {
    const request = buildRequest(subject, validation);
    expect(
      validateCaptured(captured({ ...supported, supporting_quotes: [] }), request).errors,
    ).toContain('support_without_citation');
    expect(
      validateCaptured(captured({ ...supported, confidence: 0.99 }), request).errors,
    ).toContain('schema_violation');
    expect(validateCaptured(captured(null, { stopReason: 'refusal' }), request).errors).toEqual([
      'model_refused',
    ]);
  });

  it('refuses captured output produced for a different request', () => {
    const request = buildRequest(subject, validation);
    const result = validateCaptured(
      captured(supported, { requestSha256: 'a'.repeat(64) }),
      request,
    );
    expect(result.errors).toEqual(['request_mismatch']);
  });
});
