import { describe, expect, it } from 'vitest';

import { sampleCorpus } from './corpus';
import { syntheticDocument } from './fixtures.test-support';
import { canonicalJson, sha256Hex } from '../acquisition/source-record';

describe('sealed primary-Evidence sampling', () => {
  it('preserves the pre-refactor selection and manifest fingerprint', () => {
    const frame = Array.from({ length: 24 }, (_, i) => ({
      countyCode: 'RO-CS',
      urbanity: i % 2 ? 'rural' : 'urban',
      document: {
        ...syntheticDocument(
          `Synthetic description ${String(i)} of a bounded property with a different descriptive passage ${String(i).repeat(i + 1)}`,
          undefined,
          'osm_geofabrik_romania',
          `node/${String(i)}`,
        ),
        candidateId: `01900000-0000-7000-8000-${String(i).padStart(12, '0')}`,
      },
    }));
    const edges = frame.slice(0, 8).flatMap((entry, i) => {
      const other = frame[23 - i];
      return other === undefined
        ? []
        : [
            {
              left: entry.document.candidateId,
              right: other.document.candidateId,
              relation: 'same_property',
            },
          ];
    });
    const result = sampleCorpus('01900000-0000-7000-8000-000000000900', frame, edges);
    expect(sha256Hex(canonicalJson(result))).toBe(
      '4be32f5225b08b87691e0ffdaae0aa9b653db5f6cde1c0fa06c5081915b42d6c',
    );
  });
  it('reproduces selections regardless of frame order and keeps possible matches together', () => {
    const first = syntheticDocument(
      'O proprietate sintetică are grătar și foișor în curte pentru relaxare.',
      undefined,
      'osm_geofabrik_romania',
      'node/one',
    );
    const second = {
      ...syntheticDocument(
        'O proprietate sintetică are grătar și foișor în curte pentru relaxare.',
        undefined,
        'osm_geofabrik_romania',
        'node/two',
      ),
      candidateId: '01900000-0000-7000-8000-000000000004',
    };
    const third = {
      ...syntheticDocument(
        'Altă descriere complet diferită.',
        undefined,
        'osm_geofabrik_romania',
        'node/three',
      ),
      candidateId: '01900000-0000-7000-8000-000000000005',
    };
    const frame = [first, second, third].map((document) => ({
      document,
      countyCode: 'RO-CJ',
      urbanity: 'rural',
    }));
    const edges = [
      { left: first.candidateId, right: third.candidateId, relation: 'same_property' },
    ];
    const a = sampleCorpus(first.candidateId, frame, edges);
    const b = sampleCorpus(first.candidateId, [...frame].reverse(), edges);
    expect(a.corpus).toEqual(b.corpus);
    expect(a.corpus.entries).toHaveLength(1);
    expect(a.manifest.groupCount).toBe(1);
    expect(a.manifest.frameSize).toBe(3);
  });
});
