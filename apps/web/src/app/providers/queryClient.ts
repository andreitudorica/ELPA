import { notify } from '@/app/store/notificationsStore';
import { createQueryClient } from '@/lib/query/queryClient';

/** Application-wide QueryClient, shared by the provider tree and the router context. */
export const queryClient = createQueryClient({
  notifyError: notify.error,
  notifySuccess: notify.success,
});
