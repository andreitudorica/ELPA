import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import { useNotificationsStore } from '@/app/store/notificationsStore';

/**
 * Renders the global notification queue one snackbar at a time.
 * Enqueue from anywhere via `notify.success(...)` / `notify.error(...)`.
 */
export function AppSnackbar() {
  const current = useNotificationsStore((state) => state.queue[0]);
  const dismiss = useNotificationsStore((state) => state.dismiss);

  if (current === undefined) {
    return null;
  }

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    dismiss(current.id);
  };

  return (
    <Snackbar
      key={current.id}
      open
      autoHideDuration={current.autoHideMs}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={current.severity}
        variant="filled"
        onClose={() => {
          dismiss(current.id);
        }}
        sx={{ minWidth: 280 }}
      >
        {current.message}
      </Alert>
    </Snackbar>
  );
}
