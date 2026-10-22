import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { AppCard } from '@/components/common/AppCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppLink } from '@/components/navigation/routerLinks';
import { AppTable } from '@/components/tables/AppTable';
import { type CandidateDetail } from '@/lib/apiClient';
import { formatDateTime } from '@/utils/format';

import { useCandidate } from '../acquisitionApi';

import { ImageEvidence } from './ImageEvidence';
import { formatClaimValue, screeningColor } from './labels';
import { ReconciliationPanel } from './ReconciliationPanel';
import { SuggestionSignals } from './SuggestionSignals';
import { VerificationPanel } from './VerificationPanel';

type Claim = CandidateDetail['claims'][number];

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        fontSize: '0.75rem',
        overflowX: 'auto',
        maxHeight: 360,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

export function CandidateDetailPage({
  campaignId,
  candidateId,
}: {
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const detail = useCandidate(campaignId, candidateId, t('acquisition.feedback.loadError'));

  if (detail.isPending) return <LoadingState label={t('acquisition.candidate.loading')} />;
  if (detail.isError) {
    return (
      <ErrorState
        error={detail.error}
        description={t('acquisition.feedback.loadError')}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const { candidate, claims, evidence, runRecords, suggestions } = detail.data;
  const currentClaims = claims.filter((claim) => claim.current);
  const supersededClaims = claims.length - currentClaims.length;
  const extractedClaims = claims.filter((claim) => claim.extraction !== null);

  return (
    <>
      <PageHeader
        title={candidate.displayName}
        description={t('acquisition.candidate.description', {
          source: t(`acquisition.sources.${candidate.sourceKey}`),
          key: candidate.sourceRecordKey,
        })}
        breadcrumbs={
          <AppLink
            to="/studio/research-campaigns/$campaignId"
            params={{ campaignId }}
            search={{ tab: 'candidates' }}
            variant="body2"
          >
            {t('acquisition.title')}
          </AppLink>
        }
      />
      <Stack spacing={3}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Chip size="small" color="warning" label={t('acquisition.candidate.unverified')} />
          <Chip
            size="small"
            variant="outlined"
            color={screeningColor(candidate.screeningClass)}
            label={t(`acquisition.screening.${candidate.screeningClass}`)}
          />
          {candidate.sourceRecordUrl !== null && (
            <Link href={candidate.sourceRecordUrl} target="_blank" rel="noreferrer" variant="body2">
              {t('acquisition.candidate.openSource')}
            </Link>
          )}
        </Stack>

        <ReconciliationPanel campaignId={campaignId} candidateId={candidateId} />
        <VerificationPanel campaignId={campaignId} candidateId={candidateId} />

        {extractedClaims.length > 0 && (
          <AppCard title={t('acquisition.extraction.title')}>
            <Stack spacing={2}>
              <Alert severity="warning">{t('acquisition.extraction.pending')}</Alert>
              {extractedClaims.map((claim) => {
                const extraction = claim.extraction;
                if (extraction === null) return null;
                return (
                  <Stack key={claim.id} id={`claim-${claim.id}`} spacing={1}>
                    <Typography variant="subtitle2">
                      {claim.target} · {formatClaimValue(claim.value)}
                      {!claim.current ? ` · ${t('acquisition.extraction.historical')}` : ''}
                    </Typography>
                    <Typography
                      component="blockquote"
                      variant="body2"
                      sx={{
                        m: 0,
                        pl: 2,
                        borderLeft: 3,
                        borderColor: 'divider',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {extraction.quote}
                    </Typography>
                    <Link href={`#evidence-${claim.evidenceId}`} variant="caption">
                      {t('acquisition.extraction.source', {
                        version: extraction.sourceVersion,
                        field: extraction.fieldPath.join(' → '),
                        start: extraction.start,
                        end: extraction.end,
                      })}
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {t('acquisition.extraction.method', {
                        method: claim.extractionMethod,
                        ontology: extraction.ontologyVersion,
                      })}
                    </Typography>
                    <Typography variant="caption">
                      {t('acquisition.extraction.qualifiers', {
                        explicitness: extraction.explicitness,
                        ambiguity: extraction.ambiguity,
                        temporal: extraction.temporal.kind,
                      })}
                    </Typography>
                    {extraction.temporal.text !== null && (
                      <Typography variant="body2">{extraction.temporal.text}</Typography>
                    )}
                    {extraction.conflictingClaimIds.length > 0 && (
                      <Alert severity="info">
                        {t('acquisition.extraction.conflicts', {
                          count: extraction.conflictingClaimIds.length,
                        })}
                      </Alert>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </AppCard>
        )}

        <AppCard
          title={t('acquisition.candidate.claimsTitle')}
          subheader={t('acquisition.candidate.claimsSubheader', { superseded: supersededClaims })}
        >
          <AppTable<Claim>
            caption={t('acquisition.candidate.claimsTitle')}
            columns={[
              {
                id: 'target',
                header: t('acquisition.candidate.target'),
                render: (claim) => claim.target,
              },
              {
                id: 'value',
                header: t('acquisition.candidate.value'),
                render: (claim) => (
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere', maxWidth: 420 }}>
                    {formatClaimValue(claim.value)}
                  </Typography>
                ),
              },
              {
                id: 'locator',
                header: t('acquisition.candidate.locator'),
                render: (claim) => (
                  <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                    {formatClaimValue(claim.evidenceLocator)}
                  </Typography>
                ),
              },
              {
                id: 'method',
                header: t('acquisition.candidate.method'),
                render: (claim) => (
                  <Typography variant="caption">
                    {claim.extractionMethod} · {claim.confidence.toFixed(2)}
                  </Typography>
                ),
              },
            ]}
            rows={currentClaims}
            getRowId={(claim) => claim.id}
          />
        </AppCard>

        <AppCard title={t('acquisition.candidate.suggestionsTitle')}>
          {suggestions.length === 0 ? (
            <Typography variant="body2">{t('acquisition.candidate.noSuggestions')}</Typography>
          ) : (
            <Stack spacing={2}>
              {suggestions.map((suggestion) => {
                const other =
                  suggestion.left.id === candidate.id ? suggestion.right : suggestion.left;
                return (
                  <Stack key={suggestion.id} spacing={0.5}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Chip
                        size="small"
                        color={suggestion.strength === 'likely' ? 'primary' : 'default'}
                        label={`${t(`acquisition.relation.${suggestion.relation}`)} · ${t(`acquisition.strength.${suggestion.strength}`)}`}
                      />
                      <AppLink
                        to="/studio/research-campaigns/$campaignId/candidates/$candidateId"
                        params={{ campaignId, candidateId: other.id }}
                      >
                        {other.displayName}
                      </AppLink>
                      <Typography variant="caption" color="text.secondary">
                        {t(`acquisition.sourcesShort.${other.sourceKey}`)} ·{' '}
                        {[other.settlementName, other.countyCode].filter(Boolean).join(' · ')}
                      </Typography>
                    </Stack>
                    <SuggestionSignals signals={suggestion.signals} />
                  </Stack>
                );
              })}
            </Stack>
          )}
        </AppCard>

        <AppCard title={t('acquisition.candidate.evidenceTitle')}>
          <Stack spacing={2}>
            {evidence.map((item) => (
              <Stack key={item.id} id={`evidence-${item.id}`} spacing={1}>
                <Typography variant="body2">
                  {t('acquisition.candidate.evidenceSummary', {
                    version: item.datasetVersion ?? '—',
                    checksum: item.contentSha256.slice(0, 16),
                    artifact: item.artifactSha256.slice(0, 12),
                  })}
                  {item.latest ? ` · ${t('acquisition.candidate.latest')}` : ''}
                </Typography>
                {item.redactedFields.length > 0 && (
                  <Alert severity="info">
                    {t('acquisition.candidate.redacted', {
                      fields: item.redactedFields.join(', '),
                    })}
                  </Alert>
                )}
                {item.image !== null && (
                  <ImageEvidence
                    item={item}
                    claims={claims}
                    campaignId={campaignId}
                    candidateId={candidateId}
                  />
                )}
                <JsonBlock value={item.payload} />
              </Stack>
            ))}
          </Stack>
        </AppCard>

        <AppCard title={t('acquisition.candidate.runHistoryTitle')}>
          <AppTable
            caption={t('acquisition.candidate.runHistoryTitle')}
            columns={[
              {
                id: 'startedAt',
                header: t('acquisition.runs.startedAt'),
                render: (row) => formatDateTime(row.startedAt),
              },
              {
                id: 'outcome',
                header: t('acquisition.candidate.outcome'),
                render: (row) => `${row.extractionStatus} · ${row.evidenceOutcome}`,
              },
              {
                id: 'errors',
                header: t('acquisition.candidate.errors'),
                render: (row) => row.errors.map((error) => error.code).join(', ') || '—',
              },
            ]}
            rows={runRecords}
            getRowId={(row) => `${row.acquisitionRunId}:${row.evidenceId}`}
          />
        </AppCard>
      </Stack>
    </>
  );
}
