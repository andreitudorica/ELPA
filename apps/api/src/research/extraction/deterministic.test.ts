import { describe, expect, it } from 'vitest';

import { validateCapturedOutput, validateFact } from './contracts';
import { extractDeterministically, quantity } from './deterministic';
import { projectFields } from './documents';
import { syntheticDocument } from './fixtures.test-support';
import { ontologyDocument } from './ontology';

const values = (text: string, attribute: string) =>
  extractDeterministically(syntheticDocument(text))
    .facts.filter((fact) => fact.attribute === attribute)
    .map((fact) => fact.value);

describe('grounded Romanian extraction rules', () => {
  it.each([
    'Foișor și grătar',
    'Foişor si grătar',
    'Foisor si gratar',
    'FOIȘOR ȘI GRĂTAR',
    'Foișor și grătar'.normalize('NFD'),
  ])('keeps exact offsets with Romanian spelling: %s', (text) => {
    const document = syntheticDocument(`🌲 ${text}.`);
    const output = extractDeterministically(document);
    expect(output.facts.map((fact) => [fact.attribute, fact.value])).toContainEqual([
      'outdoor_grill',
      true,
    ]);
    expect(output.facts.map((fact) => [fact.attribute, fact.value])).toContainEqual([
      'outdoor_covered_area',
      'gazebo',
    ]);
    expect(output.facts.every((fact) => validateFact(fact, document).length === 0)).toBe(true);
  });

  it('separates overnight, event, bed, bedroom and bathroom counts', () => {
    const facts = extractDeterministically(
      syntheticDocument(
        'Cazare pentru maximum 12 persoane. Evenimente pentru maximum 50 persoane. 6 dormitoare; 3 băi; 8 paturi.',
      ),
    ).facts;
    expect(facts.map((fact) => [fact.attribute, fact.value])).toEqual(
      expect.arrayContaining([
        ['sleeps_persons', 12],
        ['max_daytime_guests', 50],
        ['bedrooms_count', 6],
        ['bathrooms_count', 3],
        ['beds_count', 8],
      ]),
    );
    expect(values('6 camere și capacitate 50.', 'bedrooms_count')).toEqual([]);
    expect(values('Evenimente pentru maximum 50 persoane.', 'sleeps_persons')).toEqual([]);
  });

  it('does not mistake lodging durations, dates or prices for overnight guests', () => {
    for (const text of [
      'Cazare pentru 2 nopți.',
      'Cazare de 3 zile.',
      'Cazare 200 lei.',
      'Cazare 2026.',
      'Overnight 2 nights.',
      'Sleeps 2 nights.',
    ])
      expect(values(text, 'sleeps_persons')).toEqual([]);
    expect(values('Sleeps 12.', 'sleeps_persons')).toEqual([12]);
    expect(values('Sleeps up to 12 guests.', 'sleeps_persons')).toEqual([12]);
  });

  it('normalizes area, grouped numbers, hectares and approximations', () => {
    expect(values('Curte de 2.000 mp.', 'yard_area_m2')).toEqual([2000]);
    expect(values('Curte de 0,5 ha.', 'yard_area_m2')).toEqual([5000]);
    expect(values('Curte de 200 m².', 'yard_area_m2')).toEqual([200]);
    const fact = extractDeterministically(
      syntheticDocument('Curte de aproximativ 2 000 mp.'),
    ).facts.find((entry) => entry.attribute === 'yard_area_m2');
    expect(fact).toMatchObject({ value: 2000, ambiguity: 'approximate' });
    expect(quantity('2.50')).toBeNull();
    expect(values('Teren de 2.000 mp.', 'yard_area_m2')).toEqual([]);
  });

  it('retains explicit negation, policy and seasonal qualifications', () => {
    expect(values('Nu organizăm petreceri.', 'parties_allowed')).toEqual(['no']);
    expect(values('Nu avem piscină.', 'pool')).toEqual([false]);
    const facts = extractDeterministically(
      syntheticDocument('Piscina este închisă pe timpul iernii.'),
    ).facts;
    expect(facts.find((fact) => fact.attribute === 'pool')?.value).toBe(true);
    expect(facts.find((fact) => fact.attribute === 'pool')?.temporal.kind).toBe('seasonal');
    expect(facts.find((fact) => fact.attribute === 'pool_availability')?.value).toBe('seasonal');
    expect(values('Nu este permisă muzica.', 'music_policy')).toEqual(['prohibited']);
    expect(values('Ore de liniște 22:00-08:00.', 'quiet_hours')).toEqual(['22:00-08:00']);
  });

  it('abstains on nearby facilities, uncertainty, silent permission and generic rooms', () => {
    for (const text of [
      'Piscină publică la 500 m.',
      'Saună în apropiere.',
      'Poate avem piscină.',
      'Ideal pentru grupuri, curte mare, terasă.',
      'Private villa. Cazare la particular.',
    ]) {
      expect(values(text, 'parties_allowed')).toEqual([]);
      expect(values(text, 'exclusive_rental')).toEqual([]);
    }
    expect(values('Piscină publică la 500 m.', 'pool')).toEqual([]);
    expect(values('Curte mare.', 'terrain')).toEqual([]);
    expect(values('Terasă.', 'outdoor_covered_area')).toEqual([]);
    expect(extractDeterministically(syntheticDocument('')).facts).toEqual([]);
  });

  it('preserves contradictory observations and deduplicates repeated facts', () => {
    const facts = extractDeterministically(
      syntheticDocument('Piscină. Nu avem piscină. Piscină.'),
    ).facts.filter((fact) => fact.attribute === 'pool');
    expect(facts.map((fact) => fact.value).sort()).toEqual([false, true]);
    expect(facts.every((fact) => fact.ambiguity === 'conflict')).toBe(true);
    expect(
      extractDeterministically(syntheticDocument('Masă de ping-pong și teren de tenis.'))
        .facts.filter((fact) => fact.attribute === 'recreation')
        .every((fact) => fact.ambiguity === 'none'),
    ).toBe(true);
  });

  it('uses original structured fields without turning rooms into bedrooms', () => {
    const document = syntheticDocument('', { tags: { rooms: '6', beds: '12', sauna: 'no' } });
    const output = extractDeterministically(document);
    expect(output.facts.map((fact) => [fact.attribute, fact.value])).toEqual([
      ['beds_count', 12],
      ['sauna', false],
    ]);
    expect(
      projectFields('osm_geofabrik_romania', {
        tags: {
          description: 'Contact: synthetic@example.invalid',
          phone: 'private',
          website: 'https://example.invalid',
        },
      }).fields,
    ).toEqual([]);
  });
});

describe('grounding and strict output validation', () => {
  it('detects document, source version, hash, path, offset, quote and value errors', () => {
    const document = syntheticDocument('6 dormitoare.');
    const output = extractDeterministically(document);
    const fact = output.facts[0];
    expect(fact).toBeDefined();
    for (const [patch, code] of [
      [{ evidenceId: '01900000-0000-7000-8000-000000000099' }, 'document_identity'],
      [{ sourceVersion: 'other' }, 'source_version'],
      [{ textSha256: 'bad' }, 'text_version'],
      [{ fieldPath: ['missing'] }, 'field_reference'],
      [{ start: 1 }, 'evidence_span'],
      [{ quote: 'invented' }, 'evidence_span'],
      [{ value: -1 }, 'value_normalization'],
      [{ scope: 'nearby_public' }, 'claim_schema'],
    ] as const)
      expect(validateFact({ ...fact, ...patch }, document)).toContain(code);
    expect(validateCapturedOutput({ ...output, invented: true }, document).accepted).toBeNull();
    expect(
      validateCapturedOutput({ ...output, facts: [{ ...fact, quote: 'invented' }] }, document)
        .accepted,
    ).toBeNull();
  });

  it('defines exactly 25 machine-readable attribute schemas', () => {
    const ontology = ontologyDocument();
    expect(ontology.attributes).toHaveLength(25);
    expect(new Set(ontology.attributes.map((attribute) => attribute.id)).size).toBe(25);
  });
});
