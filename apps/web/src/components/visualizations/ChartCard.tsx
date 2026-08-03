import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { type ReactNode } from 'react';

import { AppCard } from '../common/AppCard';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';

export interface ChartCardProps {
  title: string;
  /** Short explanation of what the chart shows, rendered under the title. */
  description?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Render the empty state instead of the chart. */
  empty?: boolean;
  height?: number;
  children: ReactNode;
}

/**
 * Standard wrapper for MUI X charts: consistent card chrome, fixed-height
 * responsive container and shared loading/empty/error states.
 */
export function ChartCard({
  title,
  description,
  loading = false,
  error,
  onRetry,
  empty = false,
  height = 300,
  children,
}: ChartCardProps) {
  let content: ReactNode;
  if (loading) {
    content = <Skeleton variant="rounded" height={height} />;
  } else if (error !== undefined && error !== null) {
    content = (
      <ErrorState
        error={error}
        minHeight={height}
        {...(onRetry !== undefined ? { onRetry } : {})}
      />
    );
  } else if (empty) {
    content = <EmptyState title={title} minHeight={height} />;
  } else {
    // No role="img" wrapper: MUI X charts bring their own accessibility layer
    // (labelled surface + keyboard navigation); the card title/description
    // provide the surrounding textual context.
    content = <Box sx={{ height, width: '100%' }}>{children}</Box>;
  }

  return (
    <AppCard title={title} {...(description !== undefined ? { subheader: description } : {})}>
      {content}
    </AppCard>
  );
}
