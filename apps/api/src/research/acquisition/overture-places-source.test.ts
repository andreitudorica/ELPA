import { describe, expect, it } from 'vitest';

import { readOverturePlacesArtifact } from './overture-places-source';
import { canonicalJson, storedPayload } from './source-record';
import { matchFeaturesFromClaims } from '../matching/match-features';

function syntheticOvertureRow(id = '0198c5d2-8b7a-7000-8000-000000000101') {
  return {
    id,
    version: 1,
    names: { primary: 'Cabana Synthetic' },
    bbox: { xmin: 23.1, xmax: 23.1, ymin: 46.7, ymax: 46.7 },
    addresses: [
      { country: 'RO', region: 'Cluj', locality: 'Synthetic Village', freeform: 'Synthetic 1' },
    ],
    taxonomy: { primary: 'cabin', hierarchy: ['lodging', 'cabin'] },
    sources: [{ dataset: 'meta', license: 'CDLA-Permissive-2.0' }],
    websites: ['https://synthetic.example'],
    socials: null,
    confidence: 0.9,
    operating_status: 'open',
    emails: ['withheld@example.test'],
    phones: ['synthetic'],
  };
}

function snapshot(records: unknown[]) {
  return {
    snapshotVersion: 'elpa-overture-sample@1',
    release: '2026-09-23.1',
    retrievedAt: '2026-10-21T08:00:00Z',
    sampling: { seed: 'synthetic' },
    records,
  };
}

describe('Overture bounded adapter', () => {
  it('preserves provenance, withholds contacts, and never invents event or rental claims', () => {
    const result = readOverturePlacesArtifact(snapshot([syntheticOvertureRow()]));
    const record = result.records[0];
    expect(result.datasetVersion).toBe('2026-09-23.1');
    expect(record?.status).toBe('parsed');
    expect(record?.summary?.countyCode).toBe('RO-CJ');
    expect(record?.claims.map((claim) => claim.target)).toEqual([
      'offer.name',
      'offer.overture_categories',
      'offer.primary_locality',
      'offer.coordinates',
      'offer.address',
      'offer.website',
      'offer.population_screening',
    ]);
    expect(
      record?.claims.every(
        (claim) => claim.locator.type === 'structured_field' || 'policyId' in claim.locator,
      ),
    ).toBe(true);
    if (record === undefined) throw new Error('Expected synthetic record');
    expect(storedPayload(record)).not.toHaveProperty('emails');
    expect(storedPayload(record)).not.toHaveProperty('phones');
    expect(result.metadata.release).toBe('2026-09-23.1');
    const features = matchFeaturesFromClaims(
      {
        id: 'test',
        sourceKey: 'overture_places',
        sourceRecordKey: record.sourceRecordKey,
        countyCode: 'RO-CJ',
      },
      Object.fromEntries(record.claims.map((claim) => [claim.target, claim.value])),
    );
    expect(features.primarySettlementKey).toBe('synthetic village');
    expect(features.structureType).toBe('overture:cabin');
  });

  it('produces identical interpretation from pinned inputs', () => {
    const input = snapshot([syntheticOvertureRow()]);
    expect(canonicalJson(readOverturePlacesArtifact(input))).toBe(
      canonicalJson(readOverturePlacesArtifact(input)),
    );
  });

  it('keeps artifact paths and release context out of native Evidence content', () => {
    const row = syntheticOvertureRow();
    const first = readOverturePlacesArtifact(snapshot([{ ...row, filename: 'release/a.parquet' }]));
    const second = readOverturePlacesArtifact({
      ...snapshot([{ ...row, filename: 'release/b.parquet' }]),
      release: '2026-10-21.0',
    });
    expect(first.records[0]?.rawPayload).toEqual(second.records[0]?.rawPayload);
    expect(first.metadata.sourceFiles).not.toEqual(second.metadata.sourceFiles);
  });

  it('fails closed on unknown providers and conflicting explicit licences', () => {
    for (const sources of [
      [{ dataset: 'unknown', license: null }],
      [{ dataset: 'meta', license: 'restricted' }],
    ]) {
      expect(() =>
        readOverturePlacesArtifact(snapshot([{ ...syntheticOvertureRow(), sources }])),
      ).toThrow('no records may be retained');
    }
  });

  it('rejects missing county, reversed geometry, and non-lodging records', () => {
    const row = syntheticOvertureRow();
    const variants = [
      { ...row, addresses: [{ country: 'RO', region: 'Unknown' }] },
      { ...row, bbox: { ...row.bbox, xmax: 22 } },
      { ...row, taxonomy: { primary: 'restaurant', hierarchy: ['food'] } },
    ];
    expect(
      variants.map((variant) => readOverturePlacesArtifact(snapshot([variant])).records[0]?.status),
    ).toEqual(['rejected', 'rejected', 'rejected']);
  });

  it('refuses duplicate native identities and malformed envelopes', () => {
    const row = syntheticOvertureRow();
    expect(() => readOverturePlacesArtifact(snapshot([row, row]))).toThrow(
      'Repeated source identity',
    );
    expect(() => readOverturePlacesArtifact({ records: [] })).toThrow();
  });
});
