import type { ChipProps } from '@mui/material/Chip';

import { type AcquisitionRun, type CandidateSummary } from '@/lib/apiClient';

export function statusColor(status: AcquisitionRun['status']): ChipProps['color'] {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'completed_with_rejections':
      return 'warning';
    case 'failed':
      return 'error';
    case 'running':
      return 'info';
  }
}

export function screeningColor(screening: CandidateSummary['screeningClass']): ChipProps['color'] {
  switch (screening) {
    case 'plausible':
      return 'success';
    case 'ambiguous':
      return 'warning';
    case 'out_of_scope':
      return 'default';
    case 'insufficient_data':
      return 'info';
  }
}

/** Compact display of a Claim value for tables; full JSON stays available in details. */
export function formatClaimValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function formatShare(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}
