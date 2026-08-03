import CloseIcon from '@mui/icons-material/Close';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface AppDialogProps extends Omit<DialogProps, 'title' | 'onClose'> {
  title: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  /** Hide the corner close button (e.g. for blocking flows). */
  disableCloseButton?: boolean;
}

/**
 * Dialog with the application conventions baked in: labelled title, corner
 * close button, focus containment (from MUI) and a consistent actions bar.
 */
export function AppDialog({
  title,
  actions,
  onClose,
  disableCloseButton = false,
  children,
  ...dialogProps
}: AppDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Dialog aria-labelledby={titleId} onClose={onClose} {...dialogProps}>
      <DialogTitle id={titleId} sx={{ pr: 6 }}>
        {title}
      </DialogTitle>
      {!disableCloseButton && (
        <IconButton
          aria-label={t('actions.close')}
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      <DialogContent>{children}</DialogContent>
      {actions !== undefined && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
