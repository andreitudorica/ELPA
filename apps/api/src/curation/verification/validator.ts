import {
  VALIDATOR_VERSION,
  validationSchema,
  type CategoryId,
  type ClaimSnapshot,
  type EvidenceSnapshot,
  type Subject,
  type Validation,
} from './contracts';
import { CATEGORIES, SOURCE_AUTHORITY, categorize, isOfficialCapacity } from './policy';

type Check = Validation['checks'][number];
type Proposition = NonNullable<Validation['proposition']>;
type JsonRecord = Record<string, unknown>;

const KNOWN_REUSE_TERMS: Record<string, string> = {
  ro_public_register_no_explicit_licence: 'register_reuse_terms_pending_legal_review',
  odbl_1_0: 'odbl_attribution_and_share_alike_review',
  cdla_permissive_2_0: 'cdla_attribution_required',
  per_file_licence: 'image_redistribution_not_authorized',
};
const TEXT_SOURCES = new Set([
  'situr_accommodation_register',
  'osm_geofabrik_romania',
  'overture_places',
]);
const MAX_COUNT = 2000;
/** Structured fields that carry the proposition; other locator fields may be empty. */
const CARRYING_FIELDS: Partial<Record<CategoryId, string[]>> = {
  register_locality: ['Județ', 'Localitate'],
  register_classified_capacity: ['Număr locuri'],
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Field names the Claim's locator relies on, as dotted names. */
export function locatorFields(claim: ClaimSnapshot): string[] {
  const type = claim.locator.type;
  if (type === 'structured_field') return strings(claim.locator.fields);
  if (type === 'text_span') return [strings(claim.locator.fieldPath).join('.')];
  return [];
}

export function categoryOf(claim: ClaimSnapshot, sourceKey: string): CategoryId | null {
  return categorize({
    target: claim.target,
    sourceKey,
    method: claim.method,
    locatorType: text(claim.locator.type) ?? '',
    fields: locatorFields(claim),
  });
}

/** The exact statement a decision would verify; a narrower reading of the Claim value. */
export function propositionOf(claim: ClaimSnapshot, category: CategoryId): Proposition | null {
  const attribute = claim.target.replace(/^offer\./, '');
  const value = claim.value;
  const object = record(value);
  switch (category) {
    case 'register_locality':
      return object === null
        ? null
        : {
            attribute: 'county_and_locality',
            value: {
              countyCode: text(object.countyCode),
              settlementName: text(object.settlementName),
            },
          };
    case 'osm_county':
      return object === null
        ? null
        : { attribute: 'county', value: { countyCode: text(object.countyCode) } };
    case 'register_classified_capacity':
      return typeof value === 'number' ? { attribute: 'official_classified_places', value } : null;
    default:
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? { attribute, value }
        : null;
  }
}

function comparable(proposition: Proposition): string {
  const object = record(proposition.value);
  // Locality propositions compare on county: settlement spelling differs across sources.
  if (object !== null && 'countyCode' in object) return `county:${String(object.countyCode)}`;
  return JSON.stringify(proposition.value);
}

function lineage(
  left: ClaimSnapshot,
  right: ClaimSnapshot,
  evidence: Map<string, EvidenceSnapshot>,
): Validation['conflicts'][number]['lineage'] {
  const a = evidence.get(left.evidenceId),
    b = evidence.get(right.evidenceId);
  if (left.evidenceId === right.evidenceId) return 'common_origin';
  if (a !== undefined && b !== undefined) {
    if (a.contentSha256 === b.contentSha256) return 'common_origin';
    if (a.sourceKey === b.sourceKey) return 'possibly_common_origin';
  }
  // Different source families may still copy each other (e.g. mappers using the register).
  return 'unknown';
}

export function validate(
  subject: Subject,
  options: { asOf: string; counties: Readonly<Record<string, string>> },
): Validation {
  const { claim, category } = subject;
  const evidence = new Map(subject.evidence.map((e) => [e.id, e]));
  const own = evidence.get(claim.evidenceId);
  const definition = category === null ? null : CATEGORIES[category];
  const checks: Check[] = [];
  const add = (id: Check['id'], status: Check['status'], ...reasons: string[]) =>
    checks.push({ id, status, reasons });

  add(
    'evidence_exists',
    own?.id === claim.evidenceId ? 'pass' : 'fail',
    ...(own === undefined ? ['evidence_missing'] : []),
  );

  const constraint = own === undefined ? undefined : KNOWN_REUSE_TERMS[own.artifact.reuseTerms];
  add(
    'processing_permitted',
    constraint === undefined ||
      own === undefined ||
      !['full_record', 'personal_data_redacted'].includes(own.artifact.retentionPolicy)
      ? 'fail'
      : 'pass',
    ...(constraint === undefined ? ['unknown_reuse_terms'] : []),
  );

  const fields = locatorFields(claim);
  const locatorType = text(claim.locator.type) ?? '';
  let referenceReasons: string[] = [];
  if (locatorType === 'structured_field') {
    const byName = new Map((own?.fields ?? []).map((f) => [f.path.join('.'), f]));
    const required = category === null ? fields : (CARRYING_FIELDS[category] ?? fields);
    referenceReasons = fields.flatMap((name) => {
      const field = byName.get(name);
      if (field === undefined) return [`field_not_exported:${name}`];
      if (field.withheld === 'none') return [];
      // An empty optional field (e.g. no component locality) is not a broken reference.
      if (field.withheld === 'missing' && !required.includes(name)) return [];
      return [`field_${field.withheld}:${name}`];
    });
    if (fields.length === 0) referenceReasons.push('no_locator_fields');
  } else if (locatorType === 'text_span') {
    if (claim.grounding !== 'valid') referenceReasons.push('text_span_not_grounded');
  } else if (locatorType === 'inferred') {
    const inputs = record(claim.locator.inputs);
    if (text(claim.locator.policyId) === null) referenceReasons.push('inference_policy_missing');
    if (category === 'osm_county' && inputs?.countyBoundaryRelationId == null)
      referenceReasons.push('county_boundary_missing');
  } else referenceReasons.push(`unsupported_locator:${locatorType}`);
  add(
    'source_reference_valid',
    referenceReasons.length === 0 ? 'pass' : 'fail',
    ...referenceReasons,
  );

  const quote = locatorType === 'text_span' ? text(claim.locator.quote) : null;
  const supportReasons =
    locatorType === 'text_span' && quote === null
      ? ['quote_missing']
      : locatorType === 'structured_field' && referenceReasons.length > 0
        ? ['structured_value_unavailable']
        : [];
  add('support_present', supportReasons.length === 0 ? 'pass' : 'fail', ...supportReasons);

  add(
    'identity_established',
    subject.candidate.sourceKey === own?.sourceKey &&
      subject.candidate.sourceRecordKey === own.sourceRecordKey &&
      claim.candidateId === subject.candidate.id
      ? 'pass'
      : 'fail',
    'source_keyed_identity',
  );

  const scopeReasons: string[] = [];
  let scopeStatus: Check['status'] = 'pass';
  if (locatorType === 'text_span') {
    if (
      claim.locator.entityLevel !== 'offer' ||
      claim.locator.scope !== 'advertised_accommodation'
    ) {
      scopeStatus = 'fail';
      scopeReasons.push('scope_not_advertised_accommodation');
    } else if (claim.locator.ambiguity !== 'none') {
      scopeStatus = 'warn';
      scopeReasons.push('ambiguous_or_approximate_wording');
    }
  }
  if (
    category === 'high_consequence' &&
    claim.target === 'offer.sleeps_persons' &&
    own !== undefined &&
    !isOfficialCapacity({
      target: claim.target,
      sourceKey: own.sourceKey,
      method: claim.method,
      locatorType,
      fields,
    })
  ) {
    scopeStatus = 'warn';
    scopeReasons.push('capacity_basis_unknown');
  }
  add('scope_correct', category === null ? 'not_applicable' : scopeStatus, ...scopeReasons);

  const proposition = category === null ? null : propositionOf(claim, category);
  const valueReasons: string[] = [];
  if (category !== null) {
    if (proposition === null) valueReasons.push('value_shape');
    else {
      const object = record(proposition.value);
      const value = proposition.value;
      if (category === 'register_locality' || category === 'osm_county') {
        const code = object?.countyCode;
        if (typeof code !== 'string' || !(code in options.counties))
          valueReasons.push('county_code_invalid');
        if (category === 'register_locality' && text(object?.settlementName) === null)
          valueReasons.push('settlement_missing');
      } else if (
        category === 'register_classified_capacity' ||
        category === 'property_shape_count' ||
        (category === 'high_consequence' && typeof value === 'number')
      ) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_COUNT)
          valueReasons.push('count_out_of_range');
      } else if (value === '' || value === false) valueReasons.push('not_an_assertion');
    }
  }
  add(
    'value_normalized',
    category === null ? 'not_applicable' : valueReasons.length === 0 ? 'pass' : 'fail',
    ...valueReasons,
  );

  const temporal: string[] = [];
  if (!claim.methodCurrent) temporal.push('superseded_method');
  if (!claim.evidenceLatest) temporal.push('superseded_evidence');
  const datasetVersion = own?.artifact.datasetVersion ?? null;
  const latestVersion = own?.artifact.latestDatasetVersion ?? null;
  if (datasetVersion !== null && latestVersion !== null && datasetVersion !== latestVersion)
    temporal.push('outdated_dataset_version');
  let temporalStatus: Check['status'] = temporal.length > 0 ? 'fail' : 'pass';
  const temporalQualifier = record(claim.locator.temporal);
  if (
    locatorType === 'text_span' &&
    temporalQualifier !== null &&
    temporalQualifier.kind !== 'unspecified'
  ) {
    if (temporalStatus === 'pass') temporalStatus = 'warn';
    temporal.push('temporal_qualifier_present');
  }
  if (
    definition !== null &&
    Date.parse(options.asOf) - Date.parse(claim.observedAt) > definition.freshnessDays * 86400000
  ) {
    if (temporalStatus === 'pass') temporalStatus = 'warn';
    temporal.push('outside_freshness_window');
  }
  add('temporal_context', temporalStatus, ...temporal);

  // Contradictions and corroboration compare only same-category propositions.
  const conflicts: Validation['conflicts'] = [];
  const corroboration: Validation['corroboration'] = [];
  const key = proposition === null ? null : comparable(proposition);
  const consider = (other: ClaimSnapshot, sourceKey: string, conditional: boolean) => {
    if (key === null || category === null || other.claimId === claim.claimId) return;
    if (!other.methodCurrent || !other.evidenceLatest) return;
    const otherCategory = categoryOf(other, sourceKey);
    const locality = (c: CategoryId | null) => c === 'register_locality' || c === 'osm_county';
    if (!(otherCategory === category || (locality(otherCategory) && locality(category)))) return;
    const otherProposition = propositionOf(other, otherCategory);
    if (otherProposition === null) return;
    const related = {
      claimId: other.claimId,
      candidateId: other.candidateId,
      evidenceId: other.evidenceId,
      sourceKey,
      conditional,
      lineage: lineage(claim, other, evidence),
    };
    (comparable(otherProposition) === key ? corroboration : conflicts).push(related);
  };
  for (const sibling of subject.siblings) consider(sibling, own?.sourceKey ?? '', false);
  for (const counterpart of subject.counterparts)
    for (const other of counterpart.claims) consider(other, counterpart.candidate.sourceKey, true);
  const ownAuthority = SOURCE_AUTHORITY[own?.sourceKey ?? ''] ?? 0;
  const blockingConditional = conflicts.filter(
    (c) => c.conditional && (SOURCE_AUTHORITY[c.sourceKey] ?? 0) >= ownAuthority,
  );
  add(
    'contradictions_checked',
    conflicts.some((c) => !c.conditional)
      ? 'fail'
      : blockingConditional.length > 0
        ? 'warn'
        : 'pass',
    ...conflicts.map((c) => `${c.conditional ? 'conditional_' : ''}conflict:${c.claimId}`),
  );

  const independent = corroboration.filter((c) => c.lineage === 'independent');
  const needsIndependence = definition?.corroboration === 'independent_required';
  add(
    'independence_assessed',
    needsIndependence && independent.length === 0 ? 'warn' : 'pass',
    ...(needsIndependence && independent.length === 0
      ? ['independent_corroboration_unavailable']
      : []),
    ...corroboration.map((c) => `corroboration:${c.lineage}`),
  );

  const failed = (id: Check['id']) => checks.some((c) => c.id === id && c.status === 'fail');
  const warned = (id: Check['id']) => checks.some((c) => c.id === id && c.status === 'warn');
  const hard = [
    'evidence_exists',
    'processing_permitted',
    'source_reference_valid',
    'support_present',
    'identity_established',
    'scope_correct',
    'value_normalized',
  ] as const;
  const superseded =
    temporal.includes('superseded_method') || temporal.includes('superseded_evidence');
  const outcome: Validation['outcome'] =
    hard.some(failed) || superseded
      ? 'rejected'
      : failed('contradictions_checked')
        ? 'contradicted'
        : failed('temporal_context') ||
            warned('temporal_context') ||
            warned('scope_correct') ||
            warned('contradictions_checked') ||
            warned('independence_assessed')
          ? 'deferred'
          : 'passed';

  return validationSchema.parse({
    validatorVersion: VALIDATOR_VERSION,
    itemId: subject.itemId,
    category,
    outcome,
    proposition,
    checks,
    conflicts,
    corroboration,
    publicationConstraints: [
      'publication_workflow_not_implemented',
      ...(constraint === undefined ? [] : [constraint]),
    ],
    aiTransfer:
      own !== undefined && TEXT_SOURCES.has(own.sourceKey)
        ? { permitted: true, reasons: ['allowlisted_contact_filtered_fields_only'] }
        : { permitted: false, reasons: ['source_not_cleared_for_model_transfer'] },
    reasons: checks
      .filter((c) => c.status === 'fail' || c.status === 'warn')
      .flatMap((c) => c.reasons.map((r) => `${c.id}:${r}`)),
  });
}
