import { describe, expect, it } from 'vitest';

import { sampleCorpus } from './corpus';
import { syntheticDocument } from './fixtures.test-support';

describe('sealed primary-Evidence sampling', () => {
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
