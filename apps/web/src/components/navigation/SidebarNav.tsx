import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ListItemButtonLink } from './routerLinks';

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
}

export interface SidebarNavProps {
  items: readonly SidebarNavItem[];
  /** Icon-rail mode: labels collapse into tooltips. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation();

  return (
    <Box component="nav" aria-label={t('navigation.primary')}>
      <List sx={{ px: 1 }}>
        {items.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={collapsed ? item.label : ''} placement="right">
              <ListItemButtonLink
                to={item.to}
                onClick={onNavigate}
                activeProps={{ selected: true }}
                sx={{
                  borderRadius: 1,
                  minHeight: 44,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1.5 : 2,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 600 },
                  },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 0, mr: collapsed ? 0 : 1.5, justifyContent: 'center' }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { variant: 'body2' } }}
                  />
                )}
              </ListItemButtonLink>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
