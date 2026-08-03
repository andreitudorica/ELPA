import CheckIcon from '@mui/icons-material/Check';
import TranslateIcon from '@mui/icons-material/Translate';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreferencesStore, useLanguage } from '@/app/store/preferencesStore';
import { supportedLanguages } from '@/i18n';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useLanguage();
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={t('language.label')}>
        <IconButton
          aria-label={t('language.label')}
          aria-haspopup="menu"
          data-testid="language-switcher"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
          color="inherit"
        >
          <TranslateIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => {
          setAnchorEl(null);
        }}
      >
        {supportedLanguages.map((code) => (
          <MenuItem
            key={code}
            selected={code === language}
            onClick={() => {
              setLanguage(code);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{code === language ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText>{t(`language.${code}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
