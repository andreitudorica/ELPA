import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppCard } from '@/components/common/AppCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { AppLink } from '@/components/navigation/routerLinks';
import type { ReconciliationList } from '@/lib/apiClient';
import { formatDateTime } from '@/utils/format';

import { useReconciliation } from '../acquisitionApi';

import { formatClaimValue } from './labels';

export function ReconciliationPanel({
  campaignId,
  candidateId,
}: {
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const history = useReconciliation(campaignId, candidateId, t('reconciliation.loadError'), open);
  return (
    <AppCard title={t('reconciliation.title')}>
      {!open ? (
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('reconciliation.open')}
        </Button>
      ) : history.isPending ? (
        <LoadingState label={t('reconciliation.loading')} />
      ) : history.isError ? (
        <ErrorState
          error={history.error}
          description={t('reconciliation.loadError')}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <ReconciliationHistory history={history.data} campaignId={campaignId} />
      )}
    </AppCard>
  );
}

export function ReconciliationHistory({
  history,
  campaignId,
}: {
  history: ReconciliationList;
  campaignId: string;
}) {
  const { t } = useTranslation();
  const [attribute, setAttribute] = useState('');
  const attributes = [
    ...new Set(history.flatMap((a) => a.input.propositions.map((p) => p.attribute))),
  ].sort();
  const ruleLabels: Record<string, string> = {
    R1_attribute_or_scope: t('reconciliation.rules.scope'),
    R2_invalid_ambiguous_or_inactive: t('reconciliation.rules.invalid'),
    R3_different_qualifiers: t('reconciliation.rules.qualifiers'),
    R4_unknown_capacity_definition: t('reconciliation.rules.capacity'),
    R5_disjoint_validity: t('reconciliation.rules.periods'),
    R6_disjoint_seasons: t('reconciliation.rules.seasons'),
    R7_season_context_differs: t('reconciliation.rules.seasonUnknown'),
    R8_same_normalized_assertion: t('reconciliation.rules.equivalent'),
    R9_nonexclusive_facilities: t('reconciliation.rules.nonexclusive'),
    R10_facility_access_unknown: t('reconciliation.rules.access'),
    R11_incompatible_overlapping_assertions: t('reconciliation.rules.conflict'),
    R12_validity_overlap_unknown: t('reconciliation.rules.validity'),
  };
  return (
    <Stack spacing={2}>
      <Alert severity="warning">{t('reconciliation.pending')}</Alert>
      {history.length === 0 ? (
        <Typography>{t('reconciliation.empty')}</Typography>
      ) : (
        <>
          <Typography variant="caption">{t('reconciliation.historyLimit')}</Typography>
          <TextField
            select
            label={t('reconciliation.attribute')}
            value={attribute}
            onChange={(event) => {
              setAttribute(event.target.value);
            }}
          >
            <MenuItem value="">{t('reconciliation.allAttributes')}</MenuItem>
            {attributes.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          {history.map((assessment) => (
            <Box key={assessment.id} component="details">
              <Typography component="summary" sx={{ cursor: 'pointer' }}>
                {assessment.result.ruleVersion} · {formatDateTime(assessment.assessedAt)}
              </Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Typography variant="caption">
                  {t('reconciliation.asOf', {
                    date: formatDateTime(assessment.result.asOf),
                    digest: assessment.result.inputDigest,
                  })}
                </Typography>
                {assessment.result.profiles
                  .filter((p) => attribute === '' || p.attribute === attribute)
                  .map((profile) => (
                    <Stack key={`${profile.candidateId}:${profile.attribute}`} spacing={0.5}>
                      <AppLink
                        to="/studio/research-campaigns/$campaignId/candidates/$candidateId"
                        params={{ campaignId, candidateId: profile.candidateId }}
                      >
                        {profile.candidateId}
                      </AppLink>
                      <Typography variant="subtitle2">
                        {profile.attribute} · {t(`reconciliation.support.${profile.support}`)}
                      </Typography>
                      <Typography variant="body2">
                        {t(`reconciliation.corroboration.${profile.corroboration}`)} ·{' '}
                        {t(`reconciliation.temporal.${profile.temporal}`)} ·{' '}
                        {t(`reconciliation.freshness.${profile.freshness}`)}
                      </Typography>
                      <Typography variant="caption">
                        {t('reconciliation.uncertainty', {
                          values: profile.uncertainties.join(', '),
                        })}
                      </Typography>
                    </Stack>
                  ))}
                {assessment.input.propositions
                  .filter((p) => attribute === '' || p.attribute === attribute)
                  .map((p) => (
                    <Stack
                      key={p.claimId}
                      spacing={0.5}
                      id={`reconciliation-${assessment.id}-${p.claimId}`}
                    >
                      <Typography variant="subtitle2">
                        {p.attribute} · {formatClaimValue(p.value)} {p.unit ?? ''}
                      </Typography>
                      <Typography variant="caption">
                        {p.entityLevel} · {p.scope} · {p.method} · {p.methodStatus}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="blockquote"
                        sx={{
                          m: 0,
                          pl: 2,
                          borderLeft: 2,
                          borderColor: 'divider',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {p.evidence.quote ?? t('reconciliation.noPassage')}
                      </Typography>
                      <AppLink
                        to="/studio/research-campaigns/$campaignId/candidates/$candidateId"
                        params={{ campaignId, candidateId: p.candidateId }}
                        hash={`evidence-${p.evidenceId}`}
                      >
                        {t('reconciliation.evidence', {
                          id: p.evidenceId,
                          source: p.evidence.sourceKey,
                          version: p.evidence.sourceVersion,
                        })}
                      </AppLink>
                      <Typography variant="caption">
                        {t('reconciliation.timestamps', {
                          observed: p.observedAt,
                          acquired: p.acquiredAt,
                          published: p.sourcePublishedAt ?? '?',
                          extracted: p.extractedAt,
                        })}
                      </Typography>
                      <Typography variant="caption">
                        {t('reconciliation.validity', {
                          from: p.validity.from ?? '?',
                          until: p.validity.until ?? '?',
                        })}
                      </Typography>
                      <Box component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto', m: 0 }}>
                        {JSON.stringify(
                          {
                            qualifiers: p.qualifiers,
                            explicitness: p.explicitness,
                            grounding: p.evidence.grounding,
                            locator: p.evidence.locator,
                          },
                          null,
                          2,
                        )}
                      </Box>
                    </Stack>
                  ))}
                {assessment.result.pairs
                  .filter((p) => attribute === '' || p.attribute === attribute)
                  .map((pair) => (
                    <Stack key={`${pair.leftClaimId}:${pair.rightClaimId}`} spacing={0.5}>
                      <Typography variant="body2">
                        {pair.attribute} · {t(`reconciliation.relation.${pair.relation}`)} ·{' '}
                        {t(`reconciliation.lineage.${pair.lineage}`)}
                      </Typography>
                      <Typography variant="caption">
                        {pair.leftClaimId} ↔ {pair.rightClaimId}
                      </Typography>
                      <Typography variant="body2">{ruleLabels[pair.rule] ?? pair.rule}</Typography>
                      {pair.identityConditional && (
                        <Alert severity="warning">{t('reconciliation.identityConditional')}</Alert>
                      )}
                    </Stack>
                  ))}
              </Stack>
            </Box>
          ))}
        </>
      )}
    </Stack>
  );
}
