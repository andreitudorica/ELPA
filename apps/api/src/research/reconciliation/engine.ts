import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { ATTRIBUTE_SCHEMAS } from '../extraction/ontology';
import {
  caseSchema,
  RULE_VERSION,
  resultSchema,
  type PairAssessment,
  type Proposition,
  type ReconciliationCase,
  type ReconciliationResult,
} from './contracts';

export function normalize(proposition: Proposition): Proposition {
  const value =
    proposition.attribute === 'yard_area_m2' &&
    proposition.unit === 'ha' &&
    typeof proposition.value === 'number'
      ? proposition.value * 10000
      : proposition.value;
  return {
    ...proposition,
    value,
    unit: proposition.unit === 'ha' ? 'm2' : proposition.unit,
    qualifiers: {
      ...proposition.qualifiers,
      months:
        proposition.qualifiers.months === null
          ? null
          : [...new Set(proposition.qualifiers.months)].sort((a, b) => a - b),
    },
  };
}

function valid(p: Proposition): boolean {
  const expectedUnit =
    p.attribute === 'yard_area_m2'
      ? 'm2'
      : ['sleeps_persons', 'max_daytime_guests'].includes(p.attribute)
        ? 'persons'
        : p.attribute === 'beds_count'
          ? 'beds'
          : null;
  const basis = p.qualifiers.capacityBasis;
  const validBasis =
    p.attribute === 'sleeps_persons'
      ? ['unknown', 'official_classified', 'advertised_overnight'].includes(basis)
      : p.attribute === 'beds_count'
        ? ['unknown', 'beds'].includes(basis)
        : p.attribute === 'max_daytime_guests'
          ? ['unknown', 'event_attendance'].includes(basis)
          : true;
  return (
    validBasis &&
    p.evidence.grounding === 'valid' &&
    p.methodStatus === 'current' &&
    p.explicitness === 'explicit' &&
    !p.qualifiers.ambiguous &&
    !p.qualifiers.approximate &&
    p.entityLevel === 'offer' &&
    p.scope === 'advertised_accommodation' &&
    p.unit === expectedUnit &&
    ATTRIBUTE_SCHEMAS[p.attribute].safeParse(p.value).success
  );
}

export function lineage(
  left: Proposition,
  right: Proposition,
  relationships: ReconciliationCase['lineage'],
): PairAssessment['lineage'] {
  if (
    left.evidenceId === right.evidenceId ||
    left.evidence.originalId === right.evidence.originalId ||
    left.evidence.contentSha256 === right.evidence.contentSha256 ||
    (left.evidence.passageFingerprint !== null &&
      left.evidence.passageFingerprint === right.evidence.passageFingerprint)
  )
    return 'common_origin';
  const relevant = relationships.filter(
    (r) =>
      [r.leftEvidenceId, r.rightEvidenceId].includes(left.evidenceId) &&
      [r.leftEvidenceId, r.rightEvidenceId].includes(right.evidenceId),
  );
  if (relevant.some((r) => r.relation === 'common_origin')) return 'common_origin';
  if (relevant.some((r) => r.relation === 'possibly_common_origin'))
    return 'possibly_common_origin';
  if (relevant.some((r) => r.relation === 'independent')) return 'independent';
  return 'unknown';
}

function separated(left: Proposition, right: Proposition): boolean {
  return (
    (left.validity.until !== null &&
      right.validity.from !== null &&
      Date.parse(left.validity.until) <= Date.parse(right.validity.from)) ||
    (right.validity.until !== null &&
      left.validity.from !== null &&
      Date.parse(right.validity.until) <= Date.parse(left.validity.from))
  );
}
function knownOverlap(left: Proposition, right: Proposition): boolean {
  return (
    [left.validity.from, left.validity.until, right.validity.from, right.validity.until].every(
      (v) => v !== null,
    ) && !separated(left, right)
  );
}

export function compare(
  leftInput: Proposition,
  rightInput: Proposition,
  relationships: ReconciliationCase['lineage'],
): PairAssessment {
  const left = normalize(leftInput),
    right = normalize(rightInput);
  const origin = lineage(left, right, relationships);
  const base = {
    leftClaimId: left.claimId,
    rightClaimId: right.claimId,
    attribute: left.attribute,
    lineage: origin,
    identityConditional: left.candidateId !== right.candidateId,
    warnings:
      origin === 'unknown'
        ? ['independence_unknown']
        : origin === 'independent'
          ? []
          : ['repeated_or_correlated_evidence'],
  };
  const decision = (relation: PairAssessment['relation'], rule: string): PairAssessment => ({
    ...base,
    relation,
    rule,
  });
  if (
    left.attribute !== right.attribute ||
    left.entityLevel !== right.entityLevel ||
    left.scope !== right.scope
  )
    return decision('not_comparable', 'R1_attribute_or_scope');
  if (!valid(left) || !valid(right))
    return decision('unresolved', 'R2_invalid_ambiguous_or_inactive');
  if (
    left.qualifiers.capacityBasis !== right.qualifiers.capacityBasis ||
    left.qualifiers.access !== right.qualifiers.access
  )
    return decision('not_comparable', 'R3_different_qualifiers');
  if (
    ['sleeps_persons', 'max_daytime_guests', 'beds_count'].includes(left.attribute) &&
    left.qualifiers.capacityBasis === 'unknown'
  )
    return decision('unresolved', 'R4_unknown_capacity_definition');
  if (separated(left, right)) return decision('compatible', 'R5_disjoint_validity');
  const a = left.qualifiers.months,
    b = right.qualifiers.months;
  if (a !== null && b !== null && !a.some((month) => b.includes(month)))
    return decision('compatible', 'R6_disjoint_seasons');
  if (canonicalJson(left.qualifiers.months) !== canonicalJson(right.qualifiers.months))
    return decision('unresolved', 'R7_season_context_differs');
  if (left.value === right.value) return decision('equivalent', 'R8_same_normalized_assertion');
  if (left.attribute === 'recreation') return decision('compatible', 'R9_nonexclusive_facilities');
  if (left.qualifiers.access === 'unknown' && ['pool', 'hot_tub', 'sauna'].includes(left.attribute))
    return decision('unresolved', 'R10_facility_access_unknown');
  return knownOverlap(left, right)
    ? decision('conflicting', 'R11_incompatible_overlapping_assertions')
    : decision('unresolved', 'R12_validity_overlap_unknown');
}

export function reconcile(input: ReconciliationCase, asOf: string): ReconciliationResult {
  const parsed = caseSchema.parse(input);
  const propositions = [...parsed.propositions]
    .sort((a, b) => a.claimId.localeCompare(b.claimId))
    .map(normalize);
  if (
    new Set(propositions.map((p) => p.claimId)).size !== propositions.length ||
    propositions.some((p) => !parsed.candidateIds.includes(p.candidateId))
  )
    throw new Error('Invalid Claim membership');
  const evidenceIds = new Set(propositions.map((p) => p.evidenceId));
  if (
    parsed.lineage.some(
      (r) => !evidenceIds.has(r.leftEvidenceId) || !evidenceIds.has(r.rightEvidenceId),
    )
  )
    throw new Error('Invalid lineage Evidence reference');
  const pairs: PairAssessment[] = [];
  for (let i = 0; i < propositions.length; i++) {
    const left = propositions[i];
    if (left === undefined) continue;
    for (const right of propositions.slice(i + 1)) {
      if (left.attribute === right.attribute) pairs.push(compare(left, right, parsed.lineage));
    }
  }
  const keys = [...new Set(propositions.map((p) => `${p.candidateId}:${p.attribute}`))].sort();
  const profiles = keys.map((key): ReconciliationResult['profiles'][number] => {
    const inputs = propositions.filter((p) => `${p.candidateId}:${p.attribute}` === key);
    const first = inputs[0];
    if (first === undefined) throw new Error('Empty profile');
    const active = inputs.filter(valid);
    const ids = new Set(active.map((p) => p.claimId));
    const relevant = pairs.filter(
      (p) => !p.identityConditional && ids.has(p.leftClaimId) && ids.has(p.rightClaimId),
    );
    const temporalStates = new Set(
      active.map((p) =>
        p.validity.until !== null && Date.parse(p.validity.until) <= Date.parse(asOf)
          ? ('historical' as const)
          : p.validity.from !== null && Date.parse(p.validity.from) > Date.parse(asOf)
            ? ('future' as const)
            : p.validity.from !== null && p.validity.until !== null
              ? ('bounded_current' as const)
              : ('unknown' as const),
      ),
    );
    const conflict = relevant.some((p) => p.relation === 'conflicting');
    const unknown = relevant.some(
      (p) => p.relation === 'unresolved' || p.relation === 'not_comparable',
    );
    const usable = active.filter(
      (p) =>
        !(
          ['sleeps_persons', 'max_daytime_guests', 'beds_count'].includes(p.attribute) &&
          p.qualifiers.capacityBasis === 'unknown'
        ),
    );
    const support = conflict
      ? 'conflicted'
      : usable.length === 0 || unknown
        ? 'insufficient_evidence'
        : 'supported';
    const uncertainties = new Set<string>([
      'source_assertions_not_verified',
      'independent_semantic_review_pending',
    ]);
    if (inputs.some((p) => p.methodStatus !== 'current'))
      uncertainties.add('inactive_method_retained');
    if (inputs.some((p) => !valid(p) && p.methodStatus === 'current'))
      uncertainties.add('ambiguous_or_ungrounded_input');
    if (temporalStates.has('unknown') || temporalStates.size === 0)
      uncertainties.add('validity_unknown');
    if (
      pairs.some(
        (p) =>
          p.identityConditional &&
          inputs.some((v) => v.claimId === p.leftClaimId || v.claimId === p.rightClaimId),
      )
    )
      uncertainties.add('cross_candidate_identity_unreviewed');
    if (unknown) uncertainties.add('comparison_unresolved');
    const stale = active.some((p) => Date.parse(asOf) - Date.parse(p.observedAt) > 365 * 86400000);
    return {
      candidateId: first.candidateId,
      attribute: first.attribute,
      claimIds: inputs.map((p) => p.claimId),
      support,
      corroboration:
        support === 'supported' &&
        relevant.some((p) => p.relation === 'equivalent' && p.lineage === 'independent')
          ? 'independent'
          : relevant.some(
                (p) => p.lineage === 'common_origin' || p.lineage === 'possibly_common_origin',
              )
            ? 'possible_correlation'
            : 'none',
      temporal: temporalStates.size > 1 ? 'mixed' : ([...temporalStates][0] ?? 'unknown'),
      freshness: stale
        ? 'stale'
        : temporalStates.has('unknown') || active.length === 0
          ? 'uncertain'
          : 'within_review_window',
      supportedValues: support === 'supported' ? [...new Set(usable.map((p) => p.value))] : [],
      uncertainties: [...uncertainties].sort(),
    };
  });
  return resultSchema.parse({
    ruleVersion: RULE_VERSION,
    asOf,
    inputDigest: sha256Hex(
      canonicalJson({
        ...parsed,
        propositions: [...parsed.propositions].sort((a, b) => a.claimId.localeCompare(b.claimId)),
        lineage: [...parsed.lineage].sort((a, b) =>
          canonicalJson(a).localeCompare(canonicalJson(b)),
        ),
        asOf,
        ruleVersion: RULE_VERSION,
      }),
    ),
    caseId: parsed.id,
    status: 'research_only',
    evaluationStatus: 'independent_review_pending',
    pairs,
    profiles,
  });
}
