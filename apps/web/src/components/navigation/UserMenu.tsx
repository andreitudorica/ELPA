import LogoutIcon from '@mui/icons-material/Logout';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getInitials } from '@/utils/string';

export interface UserMenuProps {
  name: string;
  email: string;
  /** Translated role name shown under the email. */
  roleLabel?: string;
  onLogout: () => void;
}

export function UserMenu({ name, email, roleLabel, onLogout }: UserMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const close = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t('userMenu.label')}>
        <IconButton
          aria-label={t('userMenu.label')}
          aria-haspopup="menu"
          data-testid="user-menu"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
          size="small"
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
            {getInitials(name)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={anchorEl !== null} onClose={close}>
        <li aria-hidden="true">
          <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
            {email}
          </Typography>
          {roleLabel !== undefined && (
            <Typography variant="caption" color="primary" sx={{ px: 2, pb: 1, display: 'block' }}>
              {roleLabel}
            </Typography>
          )}
        </li>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          data-testid="logout-menu-item"
          onClick={() => {
            close();
            onLogout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('userMenu.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
