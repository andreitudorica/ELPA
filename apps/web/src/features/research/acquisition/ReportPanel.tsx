import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { AppCard } from '@/components/common/AppCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { AppTable } from '@/components/tables/AppTable';
import { KpiCard } from '@/components/visualizations/KpiCard';
import { type AcquisitionReport } from '@/lib/apiClient';
import { formatDateTime, formatNumber } from '@/utils/format';

import { useAcquisitionReport } from '../acquisitionApi';

import { formatShare } from './labels';

type SourceQuality = AcquisitionReport['sources'][number];
type CountyCoverage = AcquisitionReport['coverage']['byCounty'][number];

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {children}
    </Box>
  );
}

function SourceCard({ source }: { source: SourceQuality }) {
  const { t } = useTranslation();
  return (
    <AppCard
      title={t(`acquisition.sources.${source.sourceKey}`)}
      subheader={t('acquisition.report.sourceSubheader', {
        version: source.artifacts[0]?.datasetVersion ?? '—',
        terms: source.reuseTerms,
        retention: source.retentionPolicy,
      })}
    >
      <Stack spacing={1.5}>
        <Typography variant="body2">
          {t('acquisition.report.records', {
            read: formatNumber(source.records.read),
            parsed: formatNumber(source.records.parsed),
            rejected: formatNumber(source.records.rejected),
          })}
        </Typography>
        <Typography variant="body2">
          {t('acquisition.report.reproducibility', {
            runs: formatNumber(
              Object.values(source.runsByStatus).reduce((sum, value) => sum + value, 0),
            ),
            digests: source.distinctOutputDigests,
          })}
        </Typography>
        <Typography variant="body2">
          {t('acquisition.report.screening', {
            plausible: formatNumber(source.screening.plausible ?? 0),
            ambiguous: formatNumber(source.screening.ambiguous ?? 0),
            outOfScope: formatNumber(source.screening.out_of_scope ?? 0),
          })}
        </Typography>
        <Typography variant="body2">
          {t('acquisition.report.missing', {
            identifiers: formatNumber(source.missingIdentifiers.count),
            settlement: formatNumber(source.missingLocation.withoutSettlement),
            coordinates: formatNumber(source.missingLocation.withoutCoordinates),
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {source.attribution}
        </Typography>
        <AppTable
          caption={t('acquisition.report.completenessCaption')}
          columns={[
            { id: 'target', header: t('acquisition.report.field'), render: (row) => row.target },
            {
              id: 'share',
              header: t('acquisition.report.share'),
              align: 'right',
              render: (row) => formatShare(row.share),
            },
          ]}
          rows={source.fieldCompleteness.filter((row) => row.candidates > 0)}
          getRowId={(row) => row.target}
        />
      </Stack>
    </AppCard>
  );
}

export function ReportPanel({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const report = useAcquisitionReport(campaignId, t('acquisition.feedback.loadError'));

  if (report.isPending) return <LoadingState label={t('acquisition.report.loading')} />;
  if (report.isError) {
    return (
      <ErrorState
        error={report.error}
        description={t('acquisition.feedback.loadError')}
        onRetry={() => void report.refetch()}
      />
    );
  }

  const { crossSource, coverage, entityResolution } = report.data;
  const estimate = crossSource.distinctPropertyEstimate;

  return (
    <Stack spacing={3}>
      <Alert severity="warning">
        {report.data.labelling.notVerified} {report.data.labelling.estimate}
      </Alert>
      <Grid>
        <KpiCard
          label={t('acquisition.report.kpi.registerReconciled')}
          value={`${formatShare(coverage.shareLikely)} – ${formatShare(coverage.shareLikelyOrPossible)}`}
        />
        <KpiCard
          label={t('acquisition.report.kpi.osmOnly')}
          value={formatNumber(crossSource.incrementalInScopeCandidates.osmOnly)}
        />
        <KpiCard
          label={t('acquisition.report.kpi.distinctEstimate')}
          value={`${formatNumber(estimate.likelyAndPossibleClusters)} – ${formatNumber(estimate.likelyClustersOnly)}`}
        />
        <KpiCard
          label={t('acquisition.report.kpi.entityResolution')}
          value={t('acquisition.report.notMeasured')}
        />
      </Grid>
      <Alert severity="info">{entityResolution.reason}</Alert>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {report.data.sources.map((source) => (
          <SourceCard key={source.sourceKey} source={source} />
        ))}
      </Box>
      <AppCard
        title={t('acquisition.report.crossSourceTitle')}
        subheader={crossSource.matcherVersion}
      >
        <Stack spacing={1}>
          <Typography variant="body2">
            {t('acquisition.report.registerWithOsm', {
              likely: formatNumber(crossSource.registerWithOsmCounterpart.likely),
              any: formatNumber(crossSource.registerWithOsmCounterpart.likelyOrPossible),
              total: formatNumber(crossSource.registerWithOsmCounterpart.total),
            })}
          </Typography>
          <Typography variant="body2">
            {t('acquisition.report.osmWithRegister', {
              likely: formatNumber(crossSource.osmWithRegisterCounterpart.likely),
              any: formatNumber(crossSource.osmWithRegisterCounterpart.likelyOrPossible),
              total: formatNumber(crossSource.osmWithRegisterCounterpart.total),
            })}
          </Typography>
          <Typography variant="body2">
            {t('acquisition.report.incremental', {
              registerOnly: formatNumber(crossSource.incrementalInScopeCandidates.registerOnly),
              osmOnly: formatNumber(crossSource.incrementalInScopeCandidates.osmOnly),
              both: formatNumber(crossSource.incrementalInScopeCandidates.inBoth),
            })}
          </Typography>
          <Typography variant="body2">
            {t('acquisition.report.operatorGroups', {
              groups: formatNumber(crossSource.registerOperatorGroups.groups),
              candidates: formatNumber(crossSource.registerOperatorGroups.candidates),
              largest: formatNumber(crossSource.registerOperatorGroups.largest),
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {estimate.definition}
          </Typography>
        </Stack>
      </AppCard>
      <AppCard
        title={t('acquisition.report.coverageTitle')}
        subheader={coverage.referencePopulation}
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {coverage.caveat}
          </Typography>
          <AppTable<CountyCoverage>
            caption={t('acquisition.report.coverageCaption')}
            columns={[
              {
                id: 'county',
                header: t('acquisition.report.county'),
                render: (row) => row.countyName,
              },
              {
                id: 'size',
                header: t('acquisition.report.population'),
                align: 'right',
                render: (row) => formatNumber(row.size),
              },
              {
                id: 'likely',
                header: t('acquisition.report.reconciledLikely'),
                align: 'right',
                render: (row) => formatShare(row.size === 0 ? 0 : row.reconciledLikely / row.size),
              },
              {
                id: 'any',
                header: t('acquisition.report.reconciledAny'),
                align: 'right',
                render: (row) =>
                  formatShare(row.size === 0 ? 0 : row.reconciledLikelyOrPossible / row.size),
              },
            ]}
            rows={[...coverage.byCounty].sort((left, right) => right.size - left.size)}
            getRowId={(row) => row.countyCode}
            maxHeight={420}
            stickyHeader
          />
        </Stack>
      </AppCard>
      <AppCard title={t('acquisition.report.unknownsTitle')}>
        <List dense disablePadding>
          {report.data.unknowns.map((unknown) => (
            <ListItem key={unknown} disableGutters>
              <ListItemText primary={unknown} />
            </ListItem>
          ))}
        </List>
        <Typography variant="caption" color="text.secondary">
          {t('acquisition.report.generatedAt', {
            date: formatDateTime(report.data.generatedAt),
            version: report.data.reportVersion,
          })}
        </Typography>
      </AppCard>
    </Stack>
  );
}
