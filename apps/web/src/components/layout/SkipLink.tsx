import Link from '@mui/material/Link';
import { useTranslation } from 'react-i18next';

/**
 * Keyboard users can jump straight to the main content. Visually hidden until
 * focused, then shown as the very first focusable element on the page.
 */
export function SkipLink() {
  const { t } = useTranslation();

  return (
    <Link
      href="#main-content"
      sx={{
        position: 'absolute',
        left: -9999,
        top: 8,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        px: 2,
        py: 1,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 3,
        '&:focus-visible': { left: 8 },
      }}
    >
      {t('skipToContent')}
    </Link>
  );
}
