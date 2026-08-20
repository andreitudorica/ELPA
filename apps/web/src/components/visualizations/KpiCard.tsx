import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';

import { formatPercent } from '@/utils/format';

import { AppCard } from '../common/AppCard';

export interface KpiCardProps {
  label: string;
  /** Pre-formatted value, e.g. formatCompactNumber(12500). */
  value: string;
  /** Change vs. the previous period as a ratio, e.g. 0.062 for +6.2%. */
  delta?: number;
  /** Context for the delta chip, e.g. "vs. previous period". */
  deltaLabel?: string;
  sparklineData?: number[];
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  sparklineData,
  loading = false,
}: KpiCardProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <AppCard>
        <Skeleton width="60%" />
        <Skeleton height={40} width="40%" />
        <Skeleton width="50%" />
      </AppCard>
    );
  }

  const trendPositive = delta !== undefined && delta >= 0;

  return (
    <AppCard>
      <Typography variant="body2" color="text.secondary" component="h3">
        {label}
      </Typography>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}
      >
        <Box>
          <Typography
            variant="h4"
            component="p"
            sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
          {delta !== undefined && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
              <Chip
                icon={trendPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
                label={`${trendPositive ? '+' : ''}${formatPercent(delta)}`}
                color={trendPositive ? 'success' : 'error'}
                variant="outlined"
                aria-label={`${trendPositive ? '+' : ''}${formatPercent(delta)} ${deltaLabel ?? ''}`.trim()}
              />
              {deltaLabel !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {deltaLabel}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
        {sparklineData !== undefined && sparklineData.length > 1 && (
          // `inert`: the sparkline is decorative — removed from the a11y tree
          // AND from the tab order (aria-hidden alone leaves it focusable).
          <Box sx={{ width: 96, height: 48 }} inert>
            <SparkLineChart
              data={sparklineData}
              height={48}
              color={theme.palette.primary.main}
              curve="natural"
              area
            />
          </Box>
        )}
      </Stack>
    </AppCard>
  );
}
