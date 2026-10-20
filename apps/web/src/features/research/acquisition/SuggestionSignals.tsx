import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Human-readable summary of the matcher's explainable signals for one suggestion. */
export function SuggestionSignals({ signals }: { signals: Record<string, unknown> }) {
  const { t } = useTranslation();
  const geo = asRecord(signals.geo);
  const rules = asStrings(signals.decisionRules);
  const contradictions = asStrings(signals.contradictions);
  const similarity = typeof signals.nameSimilarity === 'number' ? signals.nameSimilarity : null;
  const geoBasis = typeof geo.basis === 'string' ? geo.basis : null;
  const settlement = typeof geo.settlement === 'string' ? geo.settlement : null;
  const distance = typeof geo.distanceKm === 'number' ? geo.distanceKm : null;

  return (
    <Stack spacing={0.25}>
      <Typography variant="caption">
        {t('acquisition.signals.rules', { rules: rules.join(', ') || '—' })}
      </Typography>
      {similarity !== null && (
        <Typography variant="caption">
          {t('acquisition.signals.nameSimilarity', { value: similarity.toFixed(2) })}
        </Typography>
      )}
      {geoBasis !== null && (
        <Typography variant="caption">
          {t('acquisition.signals.geo', {
            basis: geoBasis,
            detail: [settlement, distance === null ? null : `${String(distance)} km`]
              .filter(Boolean)
              .join(' · '),
          })}
        </Typography>
      )}
      {contradictions.length > 0 && (
        <Typography variant="caption" color="warning.main">
          {t('acquisition.signals.contradictions', { values: contradictions.join(', ') })}
        </Typography>
      )}
    </Stack>
  );
}
