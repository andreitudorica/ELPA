import {
  POLICY_VERSION,
  decisionSchema,
  type Assessment,
  type Decision,
  type FollowUp,
  type Recommendation,
  type Strategy,
  type Subject,
  type Validation,
} from './contracts';
import { CATEGORIES, SOURCE_AUTHORITY } from './policy';

export interface Eligibility {
  id: string;
  /** Minimum evidence score selected on the calibration split. */
  threshold: number;
}

export interface DecisionInput {
  subject: Subject;
  validation: Validation;
  assessment: Assessment | null;
  followUp: FollowUp | null;
  strategy: Strategy;
  /** Approved, evaluated eligibility of the subject's category, if any. */
  eligibility: Eligibility | null;
}

/** Whether a strategy consults the semantic assessor for this category. */
export function usesAssessor(strategy: Strategy, subject: Subject): boolean {
  if (subject.category === null || strategy === 'A') return false;
  return strategy === 'B' || CATEGORIES[subject.category].assessor !== 'not_required';
}

export function evidenceScore(
  subject: Subject,
  validation: Validation,
  assessment: Assessment | null,
): number {
  const own = subject.evidence.find((e) => e.id === subject.claim.evidenceId);
  const ownSource = own?.sourceKey ?? '';
  return [
    validation.outcome === 'passed' && validation.checks.every((c) => c.status !== 'warn'),
    validation.conflicts.length === 0,
    (SOURCE_AUTHORITY[ownSource] ?? 0) >= 3,
    validation.corroboration.some((c) => c.sourceKey !== ownSource),
    assessment?.status === 'accepted' && assessment.verdict === 'supported',
  ].filter(Boolean).length;
}

/**
 * Deterministic policy over validation, optional assessment and follow-up.
 * An assessment can block or allow a recommendation; only an approved
 * eligibility turns a recommendation into a machine Verification Decision.
 */
export function decide(input: DecisionInput): Decision {
  const { subject, validation, strategy } = input;
  const definition = subject.category === null ? null : CATEGORIES[subject.category];
  const assessed = usesAssessor(strategy, subject);
  const assessment = assessed ? input.assessment : null;
  const reasons: string[] = [];
  let recommendation: Recommendation;

  if (definition === null) {
    recommendation = 'not_eligible';
    reasons.push('category_undefined');
  } else if (validation.outcome === 'rejected') {
    const superseded = validation.reasons.some((r) => r.includes('superseded_'));
    recommendation = superseded ? 'not_eligible' : 'insufficient_evidence';
    reasons.push(superseded ? 'claim_superseded' : 'validation_failed', ...validation.reasons);
  } else if (validation.outcome === 'contradicted') {
    recommendation = 'contradicted';
    reasons.push(...validation.reasons);
  } else if (definition.autonomy === 'never') {
    recommendation = 'not_eligible';
    reasons.push('category_never_autonomous');
  } else {
    // Only the selective strategy spends follow-up actions on deferred items.
    const termination =
      strategy === 'C' && validation.outcome === 'deferred'
        ? input.followUp?.termination
        : undefined;
    recommendation = 'auto_verify';
    if (termination === 'resolved') reasons.push('follow_up_resolved');
    if (termination === 'contradicted') {
      recommendation = 'contradicted';
      reasons.push('follow_up_contradicted');
    } else if (validation.outcome === 'deferred' && termination !== 'resolved') {
      recommendation = 'further_research_required';
      reasons.push(...validation.reasons);
    } else if (assessed) {
      if (assessment?.status !== 'accepted') {
        recommendation = 'further_research_required';
        reasons.push(...(assessment?.errors ?? ['not_assessed']).map((e) => `assessment:${e}`));
      } else if (
        assessment.verdict === 'contradicted' ||
        assessment.verdict === 'incorrect_entity_attribution'
      ) {
        recommendation = 'contradicted';
        reasons.push(`assessment:${assessment.verdict}`);
      } else if (assessment.verdict === 'insufficient_evidence') {
        recommendation = 'insufficient_evidence';
        reasons.push('assessment:insufficient_evidence');
      } else if (assessment.verdict === 'uncertain') {
        recommendation = 'further_research_required';
        reasons.push('assessment:uncertain');
      }
    } else if (definition.assessor === 'required') {
      recommendation = 'further_research_required';
      reasons.push('semantic_assessment_required');
    }
  }

  const score = evidenceScore(subject, validation, assessment);
  let outcome: Decision['outcome'];
  let eligibilityId: string | null = null;
  if (recommendation !== 'auto_verify') outcome = recommendation;
  else if (input.eligibility === null) {
    outcome = 'not_eligible';
    reasons.push('category_gate_not_passed');
  } else if (score < input.eligibility.threshold) {
    outcome = 'not_eligible';
    reasons.push('below_calibrated_threshold');
  } else {
    outcome = 'verified';
    eligibilityId = input.eligibility.id;
  }

  return decisionSchema.parse({
    itemId: subject.itemId,
    claimId: subject.claim.claimId,
    candidateId: subject.claim.candidateId,
    category: subject.category,
    policyVersion: POLICY_VERSION,
    strategy,
    recommendation,
    outcome,
    reasons: [...new Set(reasons)],
    evidenceScore: score,
    assessmentUsed: assessed,
    eligibilityId,
  });
}
