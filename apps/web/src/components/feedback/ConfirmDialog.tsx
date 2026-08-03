import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders the confirm button in the error color. */
  severity?: 'default' | 'danger';
  /** Disables both buttons and shows a loading confirm button while pending. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  severity = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <DialogTitle id={titleId}>{title ?? t('confirmDialog.defaultTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText id={descriptionId}>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        {/* Initial focus on Cancel is deliberate dialog focus management: a stray
            Enter must not confirm a destructive action. */}
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <Button onClick={onCancel} disabled={loading} autoFocus>
          {cancelLabel ?? t('actions.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          loading={loading}
          variant="contained"
          color={severity === 'danger' ? 'error' : 'primary'}
        >
          {confirmLabel ?? t('actions.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
