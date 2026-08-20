import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  minHeight?: number | string;
}

export function EmptyState({ title, description, icon, action, minHeight = 240 }: EmptyStateProps) {
  return (
    <Stack
      spacing={1.5}
      sx={{ alignItems: 'center', justifyContent: 'center', minHeight, px: 3, py: 4 }}
    >
      <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 44 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography variant="h6" component="p">
        {title}
      </Typography>
      {description !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }} align="center">
          {description}
        </Typography>
      )}
      {action !== undefined && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
