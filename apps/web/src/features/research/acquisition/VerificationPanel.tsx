import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AppButton } from '@/components/common/AppButton';
import { AppCard } from '@/components/common/AppCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyServerErrors } from '@/components/forms/serverErrors';
import type {
  VerificationDecision,
  VerificationDecisionList,
  VerificationPolicy,
} from '@/lib/apiClient';
import { formatDateTime } from '@/utils/format';

import {
  useCandidateVerification,
  useOverrideVerification,
  useVerificationPolicy,
} from '../acquisitionApi';

import { formatClaimValue } from './labels';

const OUTCOME_COLOR: Record<
  VerificationDecision['outcome'],
  'success' | 'warning' | 'error' | 'default'
> = {
  verified: 'success',
  further_research_required: 'warning',
  insufficient_evidence: 'warning',
  contradicted: 'error',
  not_eligible: 'default',
  rejected: 'error',
};

export function VerificationPanel({
  campaignId,
  candidateId,
}: {
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const decisions = useCandidateVerification(
    campaignId,
    candidateId,
    t('verification.loadError'),
    open,
  );
  const policy = useVerificationPolicy(t('verification.policyLoadError'), open);
  return (
    <AppCard title={t('verification.title')}>
      {!open ? (
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('verification.open')}
        </Button>
      ) : decisions.isPending || policy.isPending ? (
        <LoadingState label={t('verification.loading')} />
      ) : decisions.isError ? (
        <ErrorState
          error={decisions.error}
          description={t('verification.loadError')}
          onRetry={() => void decisions.refetch()}
        />
      ) : policy.isError ? (
        <ErrorState
          error={policy.error}
          description={t('verification.policyLoadError')}
          onRetry={() => void policy.refetch()}
        />
      ) : (
        <VerificationDetails
          decisions={decisions.data}
          policy={policy.data}
          campaignId={campaignId}
          candidateId={candidateId}
        />
      )}
    </AppCard>
  );
}

export function VerificationDetails({
  decisions,
  policy,
  campaignId,
  candidateId,
}: {
  decisions: VerificationDecisionList;
  policy: VerificationPolicy;
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('verification.experimental')}</Alert>
      <PolicySummary policy={policy} />
      {decisions.length === 0 ? (
        <Typography>{t('verification.empty')}</Typography>
      ) : (
        decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            campaignId={campaignId}
            candidateId={candidateId}
          />
        ))
      )}
    </Stack>
  );
}

function PolicySummary({ policy }: { policy: VerificationPolicy }) {
  const { t } = useTranslation();
  const evaluation = policy.evaluation;
  return (
    <Box component="details">
      <Typography component="summary" sx={{ cursor: 'pointer' }}>
        {t('verification.policy.title', { version: policy.version })}
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="body2">
          {evaluation === null
            ? t('verification.policy.noEvaluation')
            : t('verification.policy.evaluation', {
                status: evaluation.status,
                reviewers: evaluation.reviewers,
                labeled: evaluation.labeledItems,
                date: formatDateTime(evaluation.evaluatedAt),
              })}
        </Typography>
        {policy.categories.map((category) => {
          const gate = evaluation?.gates[category.id];
          return (
            <Stack key={category.id} spacing={0.5}>
              <Typography variant="subtitle2">
                {t(`verification.category.${category.id}`)} ·{' '}
                {t(`verification.risk.${category.risk}`)} ·{' '}
                {t(`verification.autonomy.${category.autonomy}`)}
              </Typography>
              <Typography variant="caption">
                {category.eligibility !== null
                  ? t('verification.policy.eligible', { threshold: category.eligibility.threshold })
                  : gate?.passed === true
                    ? t('verification.policy.gateOpen')
                    : t('verification.policy.gateClosed', {
                        reasons: (gate?.reasons ?? ['not_evaluated']).join(', '),
                      })}
              </Typography>
            </Stack>
          );
        })}
        {evaluation !== null &&
          (['A', 'B', 'C'] as const).map((strategy) => {
            const cost = evaluation.strategies[strategy];
            return cost === undefined ? null : (
              <Typography key={strategy} variant="caption">
                {t('verification.policy.cost', {
                  strategy,
                  calls: cost.assessmentCalls,
                  cost: cost.assessmentCostUsd.toFixed(4),
                })}
              </Typography>
            );
          })}
      </Stack>
    </Box>
  );
}

function DecisionCard({
  decision,
  campaignId,
  candidateId,
}: {
  decision: VerificationDecision;
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const assessment = decision.assessment;
  return (
    <Stack
      spacing={1}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
      id={`verification-${decision.id}`}
    >
      <Typography variant="subtitle2">
        {decision.target ?? decision.claimId} · {formatClaimValue(decision.claimValue)}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip size="small" variant="outlined" label={t(`verification.method.${decision.method}`)} />
        <Chip
          size="small"
          color={OUTCOME_COLOR[decision.outcome]}
          label={t(`verification.outcome.${decision.outcome}`)}
        />
        {decision.category !== null && (
          <Chip size="small" label={t(`verification.category.${decision.category}`)} />
        )}
        {decision.risk !== null && (
          <Chip size="small" variant="outlined" label={t(`verification.risk.${decision.risk}`)} />
        )}
      </Stack>
      {decision.supersededBy !== null && (
        <Alert severity="warning">{t('verification.decision.superseded')}</Alert>
      )}
      {decision.claimSuperseded && (
        <Alert severity="warning">{t('verification.decision.claimSuperseded')}</Alert>
      )}
      {decision.recommendation !== null && (
        <Typography variant="body2">
          {t('verification.decision.recommendation', {
            value: t(`verification.recommendation.${decision.recommendation}`),
          })}
        </Typography>
      )}
      <Typography variant="caption">
        {t('verification.decision.meta', {
          policy: decision.policyVersion,
          strategy: decision.strategy ?? '—',
          score: decision.evidenceScore ?? '—',
          date: formatDateTime(decision.decidedAt),
        })}
      </Typography>
      <Alert severity="info">
        {t('verification.publication.blocked', {
          reasons: decision.publication.reasons.join(', '),
        })}
      </Alert>
      {decision.overrideReason !== null && (
        <Typography variant="body2">
          {t('verification.override.recorded', { reason: decision.overrideReason })}
        </Typography>
      )}
      {decision.reasons.length > 0 && (
        <Typography variant="body2">
          {t('verification.decision.reasons', { reasons: decision.reasons.join(', ') })}
        </Typography>
      )}
      {decision.validation !== null && (
        <Box component="details">
          <Typography component="summary" sx={{ cursor: 'pointer' }}>
            {t('verification.checks.title', { outcome: decision.validation.outcome })}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {decision.validation.checks.map((check) => (
              <Typography key={check.id} variant="caption">
                {check.id}: {t(`verification.checks.status.${check.status}`)}
                {check.reasons.length > 0 ? ` (${check.reasons.join(', ')})` : ''}
              </Typography>
            ))}
            <Typography variant="caption">
              {t('verification.checks.related', {
                conflicts: decision.validation.conflicts.length,
                corroboration: decision.validation.corroboration.length,
              })}
            </Typography>
          </Stack>
        </Box>
      )}
      {assessment !== null && (
        <Box component="details">
          <Typography component="summary" sx={{ cursor: 'pointer' }}>
            {t('verification.assessment.title')}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Typography variant="caption">
              {t('verification.assessment.summary', {
                status: assessment.status,
                verdict: assessment.verdict ?? '—',
                model: assessment.model ?? '—',
                prompt: assessment.promptVersion ?? '—',
              })}
            </Typography>
            {assessment.rationale !== null && (
              <Typography variant="body2">{assessment.rationale}</Typography>
            )}
            <Typography variant="caption">
              {t('verification.assessment.evidence', {
                supporting: assessment.supportingEvidenceIds.join(', ') || '—',
                contradicting: assessment.contradictingEvidenceIds.join(', ') || '—',
              })}
            </Typography>
            {assessment.errors.length > 0 && (
              <Typography variant="caption">
                {t('verification.assessment.errors', { errors: assessment.errors.join(', ') })}
              </Typography>
            )}
            <Typography variant="caption">
              {t('verification.assessment.cost', {
                cost: assessment.costUsd?.toFixed(6) ?? '—',
                latency: assessment.latencyMs === null ? '—' : Math.round(assessment.latencyMs),
              })}
            </Typography>
          </Stack>
        </Box>
      )}
      {decision.followUp !== null && decision.followUp.termination !== 'not_applicable' && (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">{t('verification.followUp.title')}</Typography>
          {decision.followUp.actions.map((action) => (
            <Typography key={action.fingerprint} variant="caption">
              {action.action}: {action.result} ({action.detail})
            </Typography>
          ))}
          <Typography variant="caption">
            {t('verification.followUp.termination', { value: decision.followUp.termination })}
          </Typography>
        </Stack>
      )}
      {decision.supersededBy === null && (
        <OverrideForm decisionId={decision.id} campaignId={campaignId} candidateId={candidateId} />
      )}
    </Stack>
  );
}

const OUTCOMES = ['verified', 'rejected', 'insufficient_evidence'] as const;

function OverrideForm({
  decisionId,
  campaignId,
  candidateId,
}: {
  decisionId: string;
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        outcome: z.enum(OUTCOMES),
        reason: z.string().trim().min(10, t('verification.override.tooShort')).max(2000),
      }),
    [t],
  );
  type FormValues = z.infer<typeof schema>;
  const { control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { outcome: 'rejected', reason: '' },
  });
  const override = useOverrideVerification(campaignId, candidateId, {
    errorMessage: t('verification.override.error'),
    successMessage: t('verification.override.success'),
  });
  const submit = handleSubmit((values) => {
    override.mutate(
      { decisionId, input: { outcome: values.outcome, reason: values.reason.trim() } },
      {
        onError: (error) => {
          if (!applyServerErrors(error, setError, ['outcome', 'reason']))
            setError('root.server', { type: 'server', message: t('verification.override.error') });
        },
      },
    );
  });
  return (
    <Box component="details">
      <Typography component="summary" sx={{ cursor: 'pointer' }}>
        {t('verification.override.title')}
      </Typography>
      <Stack component="form" spacing={2} sx={{ mt: 2 }} onSubmit={submit} noValidate>
        <FormTextField
          control={control}
          name="outcome"
          select
          label={t('verification.override.outcome')}
        >
          {OUTCOMES.map((outcome) => (
            <MenuItem key={outcome} value={outcome}>
              {t(`verification.override.outcomes.${outcome}`)}
            </MenuItem>
          ))}
        </FormTextField>
        <FormTextField
          control={control}
          name="reason"
          label={t('verification.override.reason')}
          multiline
          minRows={2}
          required
        />
        {formState.errors.root?.server?.message !== undefined && (
          <Alert severity="error">{formState.errors.root.server.message}</Alert>
        )}
        <AppButton type="submit" loading={override.isPending}>
          {t('verification.override.submit')}
        </AppButton>
      </Stack>
    </Box>
  );
}
