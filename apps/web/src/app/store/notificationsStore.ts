import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { env } from '@/lib/env';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  /** Auto-hide duration in ms; `null` keeps the notification until dismissed. */
  autoHideMs: number | null;
}

interface NotificationsState {
  queue: AppNotification[];
  enqueue: (
    message: string,
    severity?: NotificationSeverity,
    options?: { autoHideMs?: number | null },
  ) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  devtools(
    (set) => ({
      queue: [],
      enqueue: (message, severity = 'info', options) => {
        const notification: AppNotification = {
          id: crypto.randomUUID(),
          message,
          severity,
          autoHideMs: options?.autoHideMs === undefined ? 5000 : options.autoHideMs,
        };
        set((state) => ({ queue: [...state.queue, notification] }), false, 'enqueue');
      },
      dismiss: (id) => {
        set(
          (state) => ({ queue: state.queue.filter((notification) => notification.id !== id) }),
          false,
          'dismiss',
        );
      },
      clear: () => {
        set({ queue: [] }, false, 'clear');
      },
    }),
    { name: 'notificationsStore', enabled: env.DEV },
  ),
);

/** Imperative facade usable outside React (query client callbacks, error handlers). */
export const notify = {
  success: (message: string) => {
    useNotificationsStore.getState().enqueue(message, 'success');
  },
  info: (message: string) => {
    useNotificationsStore.getState().enqueue(message, 'info');
  },
  warning: (message: string) => {
    useNotificationsStore.getState().enqueue(message, 'warning');
  },
  error: (message: string) => {
    useNotificationsStore.getState().enqueue(message, 'error', { autoHideMs: 8000 });
  },
};
