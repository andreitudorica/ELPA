import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreferencesStore, useThemeMode, type ThemeMode } from '@/app/store/preferencesStore';

const modeIcons: Record<ThemeMode, typeof LightModeOutlinedIcon> = {
  light: LightModeOutlinedIcon,
  dark: DarkModeOutlinedIcon,
  system: SettingsBrightnessOutlinedIcon,
};

export function ThemeModeSwitcher() {
  const { t } = useTranslation();
  const themeMode = useThemeMode();
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const CurrentIcon = modeIcons[themeMode];
  const modes: ThemeMode[] = ['light', 'dark', 'system'];

  return (
    <>
      <Tooltip title={t('theme.label')}>
        <IconButton
          aria-label={t('theme.label')}
          aria-haspopup="menu"
          data-testid="theme-switcher"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
          color="inherit"
        >
          <CurrentIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => {
          setAnchorEl(null);
        }}
      >
        {modes.map((mode) => {
          const Icon = modeIcons[mode];
          return (
            <MenuItem
              key={mode}
              selected={mode === themeMode}
              onClick={() => {
                setThemeMode(mode);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t(`theme.${mode}`)}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
