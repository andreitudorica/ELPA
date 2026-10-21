import { expect, it } from 'vitest';

import type { CandidateClaimSet } from '../candidate-claims.repository';
import { compareIncrementalSource } from './comparison';

it('does not turn unmatched records or likely links into confirmed properties or facts', () => {
  const rows: CandidateClaimSet[] = [
    {
      id: 'old',
      sourceKey: 'osm_geofabrik_romania',
      sourceRecordKey: 'node/1',
      countyCode: 'RO-CJ',
      claims: { 'offer.name': 'Synthetic' },
    },
    {
      id: 'new',
      sourceKey: 'overture_places',
      sourceRecordKey: 'synthetic-1',
      countyCode: 'RO-CJ',
      claims: { 'offer.name': 'Synthetic', 'offer.sleeps_persons': 12 },
    },
    {
      id: 'other',
      sourceKey: 'overture_places',
      sourceRecordKey: 'synthetic-2',
      countyCode: 'RO-CJ',
      claims: { 'offer.name': 'Other' },
    },
  ];
  const result = compareIncrementalSource(
    rows,
    rows.map((row) => ({ ...row, screeningClass: 'plausible' })),
    [{ left: 'old', right: 'new', relation: 'same_property', strength: 'likely' }],
  );
  expect(result.report.after.classifications).toMatchObject({
    likely_existing_unreviewed: 1,
    apparent_discovery_unreviewed: 1,
  });
  expect(result.report.independentEvaluation).toMatchObject({
    reviewed: 0,
    confirmedNew: null,
    precision: null,
  });
  expect(result.report.priorityAttributes[0]).toMatchObject({
    conditionalNewObservations: 1,
    independentlySupportedNewFacts: null,
  });
});

it('does not mistake a same-provider suggestion for an existing property', () => {
  const rows: CandidateClaimSet[] = [
    {
      id: 'a',
      sourceKey: 'situr_accommodation_register',
      sourceRecordKey: 'cert/1',
      countyCode: 'RO-CJ',
      claims: { 'offer.name': 'A' },
    },
    {
      id: 'b',
      sourceKey: 'overture_places',
      sourceRecordKey: 'gers/1',
      countyCode: 'RO-CJ',
      claims: { 'offer.name': 'B' },
    },
  ];
  const result = compareIncrementalSource(
    rows,
    rows.map((row) => ({ ...row, screeningClass: 'ambiguous' })),
    [{ left: 'a', right: 'b', relation: 'same_provider', strength: 'likely' }],
  );
  expect(result.report.after.classifications.apparent_discovery_unreviewed).toBe(1);
});
