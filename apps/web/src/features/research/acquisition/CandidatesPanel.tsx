import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AppLink } from '@/components/navigation/routerLinks';
import { AppTable, type AppTableColumn } from '@/components/tables/AppTable';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { type CandidateSummary } from '@/lib/apiClient';
import { formatNumber } from '@/utils/format';

import { useCandidates } from '../acquisitionApi';

import { screeningColor } from './labels';
import {
  type AcquisitionSearch,
  type AcquisitionSearchUpdate,
  definedEntries,
  screeningClasses,
  sourceKeys,
} from './searchParams';

const PAGE_SIZE = 25;
const COUNTY_CODES = [
  'RO-AB',
  'RO-AR',
  'RO-AG',
  'RO-BC',
  'RO-BH',
  'RO-BN',
  'RO-BT',
  'RO-BV',
  'RO-BR',
  'RO-B',
  'RO-BZ',
  'RO-CS',
  'RO-CL',
  'RO-CJ',
  'RO-CT',
  'RO-CV',
  'RO-DB',
  'RO-DJ',
  'RO-GL',
  'RO-GR',
  'RO-GJ',
  'RO-HR',
  'RO-HD',
  'RO-IL',
  'RO-IS',
  'RO-IF',
  'RO-MM',
  'RO-MH',
  'RO-MS',
  'RO-NT',
  'RO-OT',
  'RO-PH',
  'RO-SM',
  'RO-SJ',
  'RO-SB',
  'RO-SV',
  'RO-TR',
  'RO-TM',
  'RO-TL',
  'RO-VS',
  'RO-VL',
  'RO-VN',
] as const;

interface CandidatesPanelProps {
  campaignId: string;
  search: AcquisitionSearch;
  onSearchChange: (update: AcquisitionSearchUpdate) => void;
}

export function CandidatesPanel({ campaignId, search, onSearchChange }: CandidatesPanelProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState(search.search ?? '');
  const debouncedSearch = useDebouncedValue(searchText, 400);

  useEffect(() => {
    const next = debouncedSearch.trim() === '' ? undefined : debouncedSearch.trim();
    if (next !== search.search) onSearchChange({ search: next, page: 1 });
  }, [debouncedSearch, search.search, onSearchChange]);

  const page = search.page ?? 1;
  const candidates = useCandidates(
    campaignId,
    definedEntries({
      source: search.source,
      screening: search.screening,
      county: search.county,
      search: search.search,
      match: search.match,
      page,
      pageSize: PAGE_SIZE,
    }),
    t('acquisition.feedback.loadError'),
  );

  const columns: AppTableColumn<CandidateSummary>[] = [
    {
      id: 'name',
      header: t('acquisition.candidates.name'),
      render: (candidate) => (
        <Stack spacing={0.25}>
          <AppLink
            to="/studio/research-campaigns/$campaignId/candidates/$candidateId"
            params={{ campaignId, candidateId: candidate.id }}
          >
            {candidate.displayName}
          </AppLink>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {candidate.sourceRecordKey}
          </Typography>
        </Stack>
      ),
    },
    {
      id: 'source',
      header: t('acquisition.candidates.source'),
      render: (candidate) => t(`acquisition.sourcesShort.${candidate.sourceKey}`),
    },
    {
      id: 'place',
      header: t('acquisition.candidates.place'),
      render: (candidate) =>
        [candidate.settlementName, candidate.countyCode].filter(Boolean).join(' · '),
    },
    {
      id: 'screening',
      header: t('acquisition.candidates.screening'),
      render: (candidate) => (
        <Chip
          size="small"
          variant="outlined"
          color={screeningColor(candidate.screeningClass)}
          label={t(`acquisition.screening.${candidate.screeningClass}`)}
        />
      ),
    },
    {
      id: 'suggestions',
      header: t('acquisition.candidates.suggestions'),
      align: 'right',
      render: (candidate) => formatNumber(candidate.suggestionCount),
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          size="small"
          label={t('acquisition.candidates.search')}
          value={searchText}
          onChange={(event) => {
            setSearchText(event.target.value);
          }}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label={t('acquisition.candidates.source')}
          value={search.source ?? ''}
          onChange={(event) => {
            const value = sourceKeys.find((key) => key === event.target.value);
            onSearchChange({ source: value, page: 1 });
          }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          {sourceKeys.map((key) => (
            <MenuItem key={key} value={key}>
              {t(`acquisition.sourcesShort.${key}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('acquisition.candidates.screening')}
          value={search.screening ?? ''}
          onChange={(event) => {
            const value = screeningClasses.find((key) => key === event.target.value);
            onSearchChange({ screening: value, page: 1 });
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          {screeningClasses.map((key) => (
            <MenuItem key={key} value={key}>
              {t(`acquisition.screening.${key}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('acquisition.candidates.county')}
          value={search.county ?? ''}
          onChange={(event) => {
            const value = COUNTY_CODES.find((code) => code === event.target.value);
            onSearchChange({ county: value, page: 1 });
          }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          {COUNTY_CODES.map((code) => (
            <MenuItem key={code} value={code}>
              {code}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('acquisition.candidates.matchStatus')}
          value={search.match ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onSearchChange({
              match:
                value === 'with_suggestions' || value === 'without_suggestions' ? value : undefined,
              page: 1,
            });
          }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          <MenuItem value="with_suggestions">
            {t('acquisition.candidates.withSuggestions')}
          </MenuItem>
          <MenuItem value="without_suggestions">
            {t('acquisition.candidates.withoutSuggestions')}
          </MenuItem>
        </TextField>
      </Stack>
      <AppTable
        caption={t('acquisition.candidates.caption')}
        columns={columns}
        rows={candidates.data?.items}
        getRowId={(candidate) => candidate.id}
        loading={candidates.isFetching}
        error={candidates.error ?? undefined}
        onRetry={() => void candidates.refetch()}
        emptyState={<EmptyState title={t('acquisition.candidates.emptyTitle')} />}
        pagination={{
          page: page - 1,
          pageSize: PAGE_SIZE,
          total: candidates.data?.total ?? 0,
          onPageChange: (page) => {
            onSearchChange({ page: page + 1 });
          },
          onPageSizeChange: () => undefined,
          pageSizeOptions: [PAGE_SIZE],
        }}
      />
    </Stack>
  );
}
