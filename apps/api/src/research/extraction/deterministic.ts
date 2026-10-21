import { canonicalJson } from '../acquisition/source-record';
import { distinctFacts, factSchema, validateFact } from './contracts';
import type { ExtractedFact, ExtractionOutput } from './contracts';
import type { PrimaryDocument, TextField } from './documents';
import { ATTRIBUTE_IDS, ONTOLOGY_VERSION } from './ontology';
import type { AttributeId } from './ontology';

export const DETERMINISTIC_VERSION = 'grp-text-rules@2';

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Romanian grouping dots/spaces and decimal commas; ambiguous formats abstain. */
export function quantity(text: string): number | null {
  const compact = text.replace(/[\s\u00a0]/g, '');
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(compact)) return null;
  const parsed = Number(compact.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const facilities: Partial<Record<AttributeId, RegExp>> = {
  yard: /\bcurte\b|\byard\b/,
  lawn: /\bgazon\b|\blawn\b|\biarba\b|\bgrass surface\b/,
  enclosed_yard: /\bcurte(?:a)?\s+(?:este\s+)?(?:imprejmuita|ingradita|neimprejmuita)\b/,
  outdoor_grill: /\bgratar\b|\bbarbecue\b|\bbbq\b/,
  outdoor_kitchen: /\bbucatarie de vara\b|\boutdoor kitchen\b/,
  fire_pit: /\bvatra de foc\b|\bfire pit\b/,
  pool: /\bpiscin[ae]\b|\bswimming pool\b/,
  hot_tub: /\bciubar\b|\bhot tub\b|\bjacuzzi\b|\bjacuzi\b/,
  sauna: /\bsauna\b/,
};

export function extractDeterministically(document: PrimaryDocument): ExtractionOutput {
  const facts: ExtractedFact[] = [];
  const abstentions: ExtractionOutput['abstentions'] = [];
  const emit = (
    field: TextField,
    start: number,
    end: number,
    attribute: AttributeId,
    value: string | number | boolean,
    options: Partial<Pick<ExtractedFact, 'explicitness' | 'temporal' | 'ambiguity'>> = {},
  ) => {
    const fact = factSchema.parse({
      attribute,
      value,
      documentId: document.id,
      evidenceId: document.evidenceId,
      sourceVersion: document.sourceVersion,
      textSha256: document.textSha256,
      fieldPath: field.path,
      start,
      end,
      quote: field.text.slice(start, end),
      explicitness:
        value === false || (attribute === 'parties_allowed' && value === 'no')
          ? 'explicit_negative'
          : 'explicit_positive',
      entityLevel: 'offer',
      scope: 'advertised_accommodation',
      temporal: { kind: 'unspecified', text: null },
      ambiguity: 'none',
      ...options,
    });
    if (validateFact(fact, document).length === 0) facts.push(fact);
    else abstentions.push({ attribute, reason: 'technical_validation_failed' });
  };

  for (const field of document.fields) {
    const key = field.path.at(-1);
    if (field.section === 'structured') {
      const number = quantity(field.text);
      if (
        document.sourceKey === 'situr_accommodation_register' &&
        key === 'Număr locuri' &&
        number !== null
      )
        emit(field, 0, field.text.length, 'sleeps_persons', number);
      if (document.sourceKey === 'osm_geofabrik_romania') {
        const numeric: Record<string, AttributeId> = {
          beds: 'beds_count',
          'capacity:beds': 'beds_count',
          bedrooms: 'bedrooms_count',
          bathrooms: 'bathrooms_count',
        };
        const attribute = key === undefined ? undefined : numeric[key];
        if (attribute !== undefined && number !== null)
          emit(field, 0, field.text.length, attribute, number);
        const boolean: Record<string, AttributeId> = {
          swimming_pool: 'pool',
          sauna: 'sauna',
          hot_tub: 'hot_tub',
          barbecue: 'outdoor_grill',
        };
        const booleanAttribute = key === undefined ? undefined : boolean[key];
        if (booleanAttribute !== undefined && /^(yes|no)$/i.test(field.text))
          emit(field, 0, field.text.length, booleanAttribute, field.text.toLowerCase() === 'yes');
      }
      continue;
    }

    // Full clauses keep original UTF-16 offsets even for decomposed diacritics.
    const boundary = /[.!?](?=\s|$)|[;\n]|,?\s+(?:dar|însă|insa|but)\s+/giu;
    let start = 0;
    const clauses: { start: number; end: number }[] = [];
    for (const match of field.text.matchAll(boundary)) {
      clauses.push({ start, end: match.index });
      start = match.index + match[0].length;
    }
    clauses.push({ start, end: field.text.length });
    for (const clause of clauses) {
      const original = field.text.slice(clause.start, clause.end);
      const text = fold(original);
      if (text.trim() === '') continue;
      const add = (
        attribute: AttributeId,
        value: string | number | boolean,
        options?: Parameters<typeof emit>[5],
      ) => {
        emit(field, clause.start, clause.end, attribute, value, options);
      };
      if (
        /\b(?:aproape|apropiere|vecin|publica|nearby|near |public pool|la \d+\s*(?:m|km)\b)/.test(
          text,
        ) ||
        /\b(?:probabil|posibil|poate|planific|constructie|potential|might|planned|soon)\b/.test(
          text,
        )
      ) {
        for (const id of ATTRIBUTE_IDS)
          abstentions.push({ attribute: id, reason: 'uncertain_or_external_scope' });
        continue;
      }
      const negative = /\b(?:nu|fara|without|no|not)\b|neimprejmuita/.test(text);
      const seasonal = /\b(?:iarna|iernii|vara|verii|sezon|winter|summer|seasonal)\b/.test(text);
      const yearRound = /\b(?:tot anul|year.round)\b/.test(text);
      const temporal: ExtractedFact['temporal'] = seasonal
        ? { kind: 'seasonal', text: original }
        : yearRound
          ? { kind: 'year_round', text: original }
          : { kind: 'unspecified', text: null };
      const ambiguity = /\b(?:aproximativ|circa|cca|about|approximately)\b|[~≈]/.test(text)
        ? 'approximate'
        : 'none';

      const number = '(\\d{1,3}(?:[. \\u00a0]\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)';
      const numericRules: [AttributeId, RegExp][] = [
        ['bedrooms_count', new RegExp(`${number}\\s*(?:dormitoare|bedrooms?)\\b`)],
        ['bathrooms_count', new RegExp(`${number}\\s*(?:bai|bathrooms?)\\b`)],
        ['beds_count', new RegExp(`${number}\\s*(?:paturi|beds?)\\b`)],
        [
          'sleeps_persons',
          new RegExp(
            `(?:cazare|cazeaza|overnight|sleeps)\\s*(?:(?:pentru|de|maximum|maxim|pana la|up to)\\s*)*${number}\\s*(?:persoane|oaspeti|guests?|people)\\b`,
          ),
        ],
        ['sleeps_persons', new RegExp(`\\bsleeps\\s+(?:up to\\s+)?${number}(?=\\s*$)`)],
        [
          'max_daytime_guests',
          new RegExp(
            `(?:evenimente|petreceri|events?)\\s*(?:pentru|de)?\\s*(?:maximum|maxim|pana la|up to)?\\s*${number}\\s*(?:persoane|invitati|guests?)\\b`,
          ),
        ],
      ];
      if (!negative)
        for (const [attribute, regex] of numericRules) {
          const match = regex.exec(text);
          if (match?.[1] !== undefined) {
            const value = quantity(match[1]);
            if (value !== null) add(attribute, value, { ambiguity });
          }
        }
      const yardArea = new RegExp(
        `\\bcurte(?:a)?\\s*(?:de|are|cu suprafata de)?\\s*(?:aproximativ|circa|cca\\.?)?\\s*${number}\\s*(mp|m²|m2|metri patrati|ha)(?=\\s|[.,;]|$)`,
      ).exec(text);
      if (!negative && yardArea?.[1] !== undefined) {
        const value = quantity(yardArea[1]);
        if (value !== null)
          add('yard_area_m2', value * (yardArea[2] === 'ha' ? 10000 : 1), { ambiguity });
      }
      for (const [attribute, regex] of Object.entries(facilities)) {
        if (!regex.test(text)) continue;
        const poolClosedSeasonally = attribute === 'pool' && seasonal && /inchis|closed/.test(text);
        add(attribute as AttributeId, poolClosedSeasonally || !negative, { temporal, ambiguity });
      }
      if (!negative && /\bfoisor\b|\bgazebo\b/.test(text))
        add('outdoor_covered_area', 'gazebo', { temporal });
      if (!negative && /\bterasa acoperita\b|\bcovered outdoor seating\b/.test(text))
        add('outdoor_covered_area', 'covered_seating', { temporal });
      if (
        /\b(?:inchiriaza|inchiriere|rent|rental)\b/.test(text) &&
        /\b(?:integral|exclusiv|whole.property)\b/.test(text)
      )
        add('exclusive_rental', !negative);
      if (/\bcurte\b/.test(text) && !negative) {
        const terrain = /\bmixt[ae]?\b/.test(text)
          ? 'mixed'
          : /\bterasat[ae]\b/.test(text)
            ? 'terraced'
            : /\bin panta\b/.test(text)
              ? 'sloped'
              : /\bplan[ae]\b/.test(text)
                ? 'flat'
                : null;
        if (terrain !== null) add('terrain', terrain);
      }
      for (const [facility, regex] of Object.entries({
        table_tennis: /ping.pong|table tennis|tenis de masa/,
        tennis: /teren de tenis\b/,
        football: /teren de fotbal\b/,
        basketball: /teren de baschet\b/,
        billiards: /biliard|billiards/,
        playground: /loc de joaca|playground/,
      }))
        if (!negative && regex.test(text)) add('recreation', facility);
      const eventPolicy =
        /(?:acceptam|permitem|organizam|gazduim|allowed|permitted|interzise)\b/.test(text) &&
        /\b(?:petreceri|evenimente private|private (?:events|parties))\b/.test(text);
      if (eventPolicy)
        add(
          'parties_allowed',
          negative || text.includes('interzise')
            ? 'no'
            : /acord|aranjament|arrangement/.test(text)
              ? 'by_arrangement'
              : 'yes',
        );
      if (
        /team[ -]?building/.test(text) &&
        /organizam|acceptam|ideal|potrivit|suitable|advertis/.test(text)
      )
        add('team_building', !negative);
      if (
        /evenimente in aer liber|outdoor events/.test(text) &&
        /organizam|acceptam|gazduim|suitable/.test(text)
      )
        add('outdoor_events', !negative);
      if (/\bmuzica\b|\bmusic\b/.test(text)) {
        if ((negative && /permis|allowed/.test(text)) || /interzis|fara|prohibit/.test(text))
          add('music_policy', text.includes('amplificat') ? 'amplified_prohibited' : 'prohibited', {
            explicitness: 'explicit_negative',
            temporal,
          });
        else if (/permis|allowed/.test(text)) add('music_policy', 'permitted', { temporal });
        else if (/doar|pana la|dupa|only/.test(text))
          add('music_policy', 'restricted', { temporal: { kind: 'restricted', text: original } });
      }
      const hours =
        /(?:liniste|quiet hours)\s*(\d{1,2}):([0-5]\d)\s*[-–]\s*(\d{1,2}):([0-5]\d)/.exec(text);
      if (hours !== null)
        add(
          'quiet_hours',
          `${(hours[1] ?? '').padStart(2, '0')}:${hours[2] ?? ''}-${(hours[3] ?? '').padStart(2, '0')}:${hours[4] ?? ''}`,
          { temporal: { kind: 'restricted', text: original } },
        );
      if (/\bpiscin[ae]\b|swimming pool/.test(text)) {
        if (seasonal) add('pool_availability', 'seasonal', { temporal });
        else if (yearRound) add('pool_availability', 'year_round', { temporal });
      }
    }
  }
  const unique = distinctFacts(facts);
  for (const fact of unique) {
    if (
      fact.attribute !== 'recreation' &&
      unique.some(
        (other) =>
          other.attribute === fact.attribute &&
          other.value !== fact.value &&
          canonicalJson(other.temporal) === canonicalJson(fact.temporal),
      )
    )
      fact.ambiguity = 'conflict';
  }
  const present = new Set(unique.map((fact) => fact.attribute));
  for (const attribute of ATTRIBUTE_IDS)
    if (!present.has(attribute) && !abstentions.some((entry) => entry.attribute === attribute))
      abstentions.push({ attribute, reason: 'no_supported_rule' });
  return {
    ontologyVersion: ONTOLOGY_VERSION,
    method: DETERMINISTIC_VERSION,
    documentId: document.id,
    facts: unique,
    abstentions: [...new Map(abstentions.map((entry) => [canonicalJson(entry), entry])).values()],
  };
}
