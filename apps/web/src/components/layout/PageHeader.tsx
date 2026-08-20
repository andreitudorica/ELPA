import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary page actions, right-aligned (wraps below the title on small screens). */
  actions?: ReactNode;
  /** Breadcrumb trail rendered above the title. */
  breadcrumbs?: ReactNode;
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 3 }}>
      {breadcrumbs !== undefined && <Box sx={{ mb: 1 }}>{breadcrumbs}</Box>}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
            {title}
          </Typography>
          {description !== undefined && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions !== undefined && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
