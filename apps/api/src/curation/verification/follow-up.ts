import {
  FOLLOW_UP_VERSION,
  followUpSchema,
  type FollowUp,
  type Subject,
  type Validation,
} from './contracts';

export const FOLLOW_UP_LIMITS = {
  maxActions: 3,
  maxNetworkCalls: 0,
  maxCostUsd: 0,
  /** Only retained Evidence and existing Research records; no live source is authorized. */
  permittedSources: ['retained_evidence', 'existing_register_candidates'],
} as const;

const COUNTY_FIELDS = ['tags.addr:county', 'tags.is_in:county', 'tags.is_in'];

/** Lower-case, diacritics removed, administrative prefixes dropped. */
export function foldCounty(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\b(judetul|judet|county|municipiul)\b/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** Deferrals the bounded actions can address: only conditional cross-record conflicts. */
export function followUpApplicable(subject: Subject, validation: Validation): boolean {
  return (
    subject.category === 'osm_county' &&
    validation.outcome === 'deferred' &&
    validation.checks.every(
      (c) =>
        c.id === 'contradictions_checked' || c.status === 'pass' || c.status === 'not_applicable',
    )
  );
}

export function followUp(
  subject: Subject,
  validation: Validation,
  counties: Readonly<Record<string, string>>,
): FollowUp {
  const actions: FollowUp['actions'] = [];
  const seen = new Set<string>();
  const act = (action: FollowUp['actions'][number]) => {
    // Duplicate queries are skipped rather than repeated.
    if (seen.has(action.fingerprint) || actions.length >= FOLLOW_UP_LIMITS.maxActions) return false;
    seen.add(action.fingerprint);
    actions.push(action);
    return true;
  };
  const finish = (termination: FollowUp['termination']) =>
    followUpSchema.parse({
      version: FOLLOW_UP_VERSION,
      actions,
      networkCalls: 0,
      costUsd: 0,
      termination,
    });
  if (!followUpApplicable(subject, validation)) return finish('not_applicable');

  const proposition = validation.proposition?.value;
  const code = typeof proposition === 'object' ? proposition.countyCode : undefined;
  const expected = typeof code === 'string' ? counties[code] : undefined;
  const own = subject.evidence.find((e) => e.id === subject.claim.evidenceId);
  const stated = (own?.fields ?? [])
    .filter((f) => COUNTY_FIELDS.includes(f.path.join('.')) && f.text !== null)
    .map((f) => f.text ?? '');
  const reread =
    expected === undefined || stated.length === 0
      ? 'absent'
      : stated.some((s) => foldCounty(s) === foldCounty(expected))
        ? 'agrees'
        : stated.some((s) => foldCounty(s) !== '')
          ? 'disagrees'
          : 'absent';
  act({
    action: 'reread_retained_evidence',
    fingerprint: `reread:${subject.claim.evidenceId}`,
    result: reread,
    detail: `address tags: ${String(stated.length)}`,
  });
  // An explicit address statement in the same retained record outweighs an unreviewed match.
  if (reread === 'agrees') return finish('resolved');
  if (reread === 'disagrees') return finish('contradicted');

  const registerConflicts = validation.conflicts.filter(
    (c) => c.conditional && c.sourceKey === 'situr_accommodation_register',
  );
  const registerAgreements = validation.corroboration.filter(
    (c) => c.conditional && c.sourceKey === 'situr_accommodation_register',
  );
  act({
    action: 'consult_register_counterpart',
    fingerprint: `register:${[...registerConflicts, ...registerAgreements]
      .map((c) => c.candidateId)
      .sort()
      .join(',')}`,
    result:
      registerConflicts.length > 0
        ? 'disagrees'
        : registerAgreements.length > 0
          ? 'agrees'
          : 'absent',
    detail: `register counterparts: ${String(registerConflicts.length)} conflicting, ${String(registerAgreements.length)} agreeing`,
  });
  act({
    action: 'request_new_observation',
    fingerprint: `observe:${subject.candidate.id}`,
    result: 'not_permitted',
    detail: 'No authorized source adapter for a new observation',
  });
  // A disagreeing official record leaves the identity question open: the fact stays unknown.
  return finish('exhausted');
}
