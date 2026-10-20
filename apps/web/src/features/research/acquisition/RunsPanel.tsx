import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { AppCard } from '@/components/common/AppCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppTable, type AppTableColumn } from '@/components/tables/AppTable';
import { type AcquisitionRun } from '@/lib/apiClient';
import { formatDateTime, formatNumber } from '@/utils/format';

import { useAcquisitionRuns } from '../acquisitionApi';

import { statusColor } from './labels';

function stat(run: AcquisitionRun, key: string): string {
  const value = run.stats[key];
  return typeof value === 'number' ? formatNumber(value) : '—';
}

export function RunsPanel({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const runs = useAcquisitionRuns(campaignId, t('acquisition.feedback.loadError'));

  const columns: AppTableColumn<AcquisitionRun>[] = [
    {
      id: 'source',
      header: t('acquisition.runs.source'),
      render: (run) => (
        <Stack spacing={0.5}>
          <Typography variant="body2">{t(`acquisition.sources.${run.sourceKey}`)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('acquisition.runs.datasetVersion', { version: run.artifact.datasetVersion ?? '—' })}
          </Typography>
        </Stack>
      ),
    },
    {
      id: 'status',
      header: t('acquisition.runs.status'),
      render: (run) => (
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          <Chip
            size="small"
            color={statusColor(run.status)}
            label={t(`acquisition.runStatus.${run.status}`)}
          />
          {run.failure !== null && (
            <Typography variant="caption" color="error">
              {run.failure.code}: {run.failure.message}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      id: 'startedAt',
      header: t('acquisition.runs.startedAt'),
      render: (run) => formatDateTime(run.startedAt),
    },
    {
      id: 'records',
      header: t('acquisition.runs.records'),
      align: 'right',
      render: (run) =>
        t('acquisition.runs.recordsValue', {
          read: stat(run, 'recordsRead'),
          rejected: stat(run, 'recordsRejected'),
        }),
    },
    {
      id: 'evidence',
      header: t('acquisition.runs.evidence'),
      align: 'right',
      render: (run) =>
        t('acquisition.runs.createdUnchanged', {
          created: stat(run, 'evidenceCreated'),
          unchanged: stat(run, 'evidenceUnchanged'),
        }),
    },
    {
      id: 'claims',
      header: t('acquisition.runs.claims'),
      align: 'right',
      render: (run) =>
        t('acquisition.runs.createdUnchanged', {
          created: stat(run, 'claimsCreated'),
          unchanged: stat(run, 'claimsUnchanged'),
        }),
    },
    {
      id: 'artifact',
      header: t('acquisition.runs.artifact'),
      render: (run) => (
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            sha256 {run.artifact.sha256.slice(0, 12)}…
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {t('acquisition.runs.digest')} {run.outputDigest?.slice(0, 12) ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {run.parserVersion} · {run.normalizerVersion}
          </Typography>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <AppCard title={t('acquisition.runs.howToRunTitle')}>
        <Typography variant="body2">{t('acquisition.runs.howToRun')}</Typography>
        <Typography
          component="pre"
          variant="caption"
          sx={{ mt: 1, mb: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
        >
          {`pnpm --filter @elpa/api research import --campaign ${campaignId} --artifact <fișier>`}
        </Typography>
      </AppCard>
      <AppTable
        caption={t('acquisition.runs.caption')}
        columns={columns}
        rows={runs.data}
        getRowId={(run) => run.id}
        loading={runs.isFetching}
        error={runs.error ?? undefined}
        onRetry={() => void runs.refetch()}
        emptyState={
          <EmptyState
            title={t('acquisition.runs.emptyTitle')}
            description={t('acquisition.runs.emptyDescription')}
          />
        }
      />
    </Stack>
  );
}
