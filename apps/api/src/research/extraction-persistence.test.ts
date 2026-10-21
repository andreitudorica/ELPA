import { describe, expect, it, vi } from 'vitest';

import type { NewClaim } from './acquisition.repository';
import { extractDeterministically } from './extraction/deterministic';
import { syntheticDocument } from './extraction/fixtures.test-support';
import { persistExtraction } from './extraction-persistence';

describe('Research extraction persistence boundary', () => {
  const document = syntheticDocument('Piscină. Nu avem piscină.');
  const output = extractDeterministically(document);
  const input = {
    runId: document.artifactId,
    administratorId: document.candidateId,
    entries: [
      {
        partition: 'holdout' as const,
        group: 'synthetic',
        stratum: 'synthetic',
        countyCode: null,
        document,
      },
    ],
    outputs: [output],
    manifestSha256: 'synthetic',
  };
  const harness = () => ({
    runInTransaction: async <T>(work: () => Promise<T>) => work(),
    storeClaims: vi.fn((_id: string, _at: Date, claims: NewClaim[]) =>
      Promise.resolve(claims.length),
    ),
    storeRunRecords: vi.fn(() => Promise.resolve()),
    finishRun: vi.fn(() => Promise.resolve()),
    audit: vi.fn(() => Promise.resolve()),
  });

  it('writes both contradictions with original Evidence time, then completion and acting Administrator audit', async () => {
    const ports = harness();
    await persistExtraction(input, ports);
    expect(ports.storeClaims).toHaveBeenCalledWith(
      input.runId,
      new Date(document.observedAt),
      expect.arrayContaining([
        expect.objectContaining({
          evidenceId: document.evidenceId,
          candidateId: document.candidateId,
          value: true,
        }),
        expect.objectContaining({ evidenceId: document.evidenceId, value: false }),
      ]),
    );
    expect(ports.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'extraction_run.completed',
        administratorId: input.administratorId,
      }),
    );
    expect(ports.storeClaims.mock.invocationCallOrder[0]).toBeLessThan(
      ports.finishRun.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('repeated processing has the same digest and records unchanged counts', async () => {
    const ports = harness();
    const first = await persistExtraction(input, ports);
    ports.storeClaims.mockResolvedValue(0);
    const second = await persistExtraction(input, ports);
    expect(second.outputDigest).toBe(first.outputDigest);
    expect(second.stats).toMatchObject({
      claimsCreated: 0,
      claimsUnchanged: 2,
      evidenceCreated: 0,
      candidatesCreated: 0,
    });
    const next = await persistExtraction(
      { ...input, outputs: [{ ...output, method: 'synthetic-revision@2' }] },
      harness(),
    );
    expect(next.outputDigest).not.toBe(first.outputDigest);
  });

  it('rejects invalid references before any write and does not complete a failed transaction', async () => {
    const ports = harness();
    await expect(
      persistExtraction(
        {
          ...input,
          outputs: [
            { ...output, facts: output.facts.map((fact) => ({ ...fact, sourceVersion: 'wrong' })) },
          ],
        },
        ports,
      ),
    ).rejects.toThrow('grounding');
    expect(ports.storeClaims).not.toHaveBeenCalled();
    ports.storeClaims.mockRejectedValue(new Error('database failure'));
    await expect(persistExtraction(input, ports)).rejects.toThrow('database failure');
    expect(ports.finishRun).not.toHaveBeenCalled();
    expect(ports.audit).not.toHaveBeenCalled();
  });
});
