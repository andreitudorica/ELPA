import { performance } from 'node:perf_hooks';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import {
  ASSESSOR_PROMPT_SHA256,
  ASSESSOR_PROMPT_VERSION,
  ASSESSOR_SYSTEM_PROMPT,
  requestSha256,
  type AssessmentRequest,
} from './verification/assessor';
import { modelOutputSchema, type CapturedAssessment } from './verification/contracts';

/** Provider-neutral port: an adapter returns a capture and never decides anything. */
export interface EvidenceAssessorModel {
  readonly provider: string;
  readonly model: string;
  /** Worst-case cost of one call, used to reserve budget before calling. */
  maxCostUsd(request: AssessmentRequest): number;
  assess(request: AssessmentRequest): Promise<CapturedAssessment>;
}

export const ASSESSOR_MODEL = 'claude-sonnet-5-5';
const EFFORT = 'low';
const MAX_OUTPUT_TOKENS = 8000;
/**
 * USD per million tokens for the pinned model: Claude API first-party rates as
 * published in the Anthropic model table cached on 2026-10-06. Re-check before reuse.
 */
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

export class AnthropicEvidenceAssessor implements EvidenceAssessorModel {
  readonly provider = 'anthropic';
  readonly model = ASSESSOR_MODEL;

  constructor(private readonly client: Anthropic) {}

  maxCostUsd(request: AssessmentRequest): number {
    // UTF-8 bytes bound the token count from above for this tokenizer's inputs.
    const inputBound = Buffer.byteLength(`${ASSESSOR_SYSTEM_PROMPT}${request.user}`);
    return (inputBound * PRICE.input + MAX_OUTPUT_TOKENS * PRICE.output) / 1e6;
  }

  async assess(request: AssessmentRequest): Promise<CapturedAssessment> {
    const started = performance.now();
    const base = {
      itemId: request.itemId,
      requestSha256: requestSha256(request),
      provider: this.provider,
      model: this.model,
      promptVersion: ASSESSOR_PROMPT_VERSION,
      promptSha256: ASSESSOR_PROMPT_SHA256,
      parameters: { effort: EFFORT, max_tokens: MAX_OUTPUT_TOKENS, thinking: 'adaptive' },
      executedAt: new Date().toISOString(),
    };
    try {
      // No refusal fallback: every evaluated item must be judged by the same pinned model.
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: ASSESSOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: request.user }],
        output_config: { effort: EFFORT, format: zodOutputFormat(modelOutputSchema) },
      });
      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      let output: CapturedAssessment['output'] = null;
      try {
        output = text === '' ? null : (z.json().safeParse(JSON.parse(text)).data ?? null);
      } catch {
        output = null;
      }
      const usage = response.usage;
      const cacheRead = usage.cache_read_input_tokens ?? 0;
      const cacheWrite = usage.cache_creation_input_tokens ?? 0;
      return {
        ...base,
        servedModel: response.model,
        stopReason: response.stop_reason,
        output,
        latencyMs: performance.now() - started,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: cacheRead,
        costUsd:
          (usage.input_tokens * PRICE.input +
            usage.output_tokens * PRICE.output +
            cacheRead * PRICE.cacheRead +
            cacheWrite * PRICE.cacheWrite) /
          1e6,
        error: null,
      };
    } catch (error) {
      return {
        ...base,
        servedModel: null,
        stopReason: null,
        output: null,
        latencyMs: performance.now() - started,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        costUsd: null,
        // Only the error class and status are kept; messages may echo request content.
        error:
          error instanceof Anthropic.APIError
            ? {
                type: error.constructor.name,
                status: typeof error.status === 'number' ? error.status : null,
              }
            : { type: error instanceof Error ? error.name : 'unknown', status: null },
      };
    }
  }
}
