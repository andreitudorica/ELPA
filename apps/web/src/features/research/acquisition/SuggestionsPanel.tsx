import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AppLink } from '@/components/navigation/routerLinks';
import { AppTable, type AppTableColumn } from '@/components/tables/AppTable';
import { type DuplicateSuggestion } from '@/lib/apiClient';

import { useDuplicateSuggestions } from '../acquisitionApi';

import {
  type AcquisitionSearch,
  type AcquisitionSearchUpdate,
  definedEntries,
} from './searchParams';
import { SuggestionSignals } from './SuggestionSignals';

const PAGE_SIZE = 25;

interface SuggestionsPanelProps {
  campaignId: string;
  search: AcquisitionSearch;
  onSearchChange: (update: AcquisitionSearchUpdate) => void;
}

export function SuggestionsPanel({ campaignId, search, onSearchChange }: SuggestionsPanelProps) {
  const { t } = useTranslation();
  const page = search.suggestionsPage ?? 1;
  const suggestions = useDuplicateSuggestions(
    campaignId,
    definedEntries({
      relation: search.relation,
      strength: search.strength,
      page,
      pageSize: PAGE_SIZE,
    }),
    t('acquisition.feedback.loadError'),
  );

  const side = (candidate: DuplicateSuggestion['left']) => (
    <Stack spacing={0.25}>
      <AppLink
        to="/studio/research-campaigns/$campaignId/candidates/$candidateId"
        params={{ campaignId, candidateId: candidate.id }}
      >
        {candidate.displayName}
      </AppLink>
      <Typography variant="caption" color="text.secondary">
        {t(`acquisition.sourcesShort.${candidate.sourceKey}`)} ·{' '}
        {[candidate.settlementName, candidate.countyCode].filter(Boolean).join(' · ')}
      </Typography>
    </Stack>
  );

  const columns: AppTableColumn<DuplicateSuggestion>[] = [
    { id: 'left', header: t('acquisition.suggestions.left'), render: (row) => side(row.left) },
    { id: 'right', header: t('acquisition.suggestions.right'), render: (row) => side(row.right) },
    {
      id: 'decision',
      header: t('acquisition.suggestions.decision'),
      render: (row) => (
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          <Chip
            size="small"
            color={row.strength === 'likely' ? 'primary' : 'default'}
            label={`${t(`acquisition.relation.${row.relation}`)} · ${t(`acquisition.strength.${row.strength}`)}`}
          />
        </Stack>
      ),
    },
    {
      id: 'signals',
      header: t('acquisition.suggestions.signals'),
      render: (row) => <SuggestionSignals signals={row.signals} />,
    },
  ];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('acquisition.suggestions.explanation')}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          size="small"
          label={t('acquisition.suggestions.relationFilter')}
          value={search.relation ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onSearchChange({
              relation: value === 'same_property' || value === 'same_provider' ? value : undefined,
              suggestionsPage: 1,
            });
          }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          <MenuItem value="same_property">{t('acquisition.relation.same_property')}</MenuItem>
          <MenuItem value="same_provider">{t('acquisition.relation.same_provider')}</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label={t('acquisition.suggestions.strengthFilter')}
          value={search.strength ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onSearchChange({
              strength: value === 'likely' || value === 'possible' ? value : undefined,
              suggestionsPage: 1,
            });
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t('acquisition.filters.all')}</MenuItem>
          <MenuItem value="likely">{t('acquisition.strength.likely')}</MenuItem>
          <MenuItem value="possible">{t('acquisition.strength.possible')}</MenuItem>
        </TextField>
      </Stack>
      <AppTable
        caption={t('acquisition.suggestions.caption', {
          version: suggestions.data?.matcherVersion ?? '',
        })}
        columns={columns}
        rows={suggestions.data?.items}
        getRowId={(row) => row.id}
        loading={suggestions.isFetching}
        error={suggestions.error ?? undefined}
        onRetry={() => void suggestions.refetch()}
        emptyState={<EmptyState title={t('acquisition.suggestions.emptyTitle')} />}
        pagination={{
          page: page - 1,
          pageSize: PAGE_SIZE,
          total: suggestions.data?.total ?? 0,
          onPageChange: (page) => {
            onSearchChange({ suggestionsPage: page + 1 });
          },
          onPageSizeChange: () => undefined,
          pageSizeOptions: [PAGE_SIZE],
        }}
      />
    </Stack>
  );
}
