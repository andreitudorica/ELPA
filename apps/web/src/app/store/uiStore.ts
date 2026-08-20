import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { storageKeys } from '@/app/config/storageKeys';
import { env } from '@/lib/env';
import { createSafePersistStorage } from '@/lib/storage';

interface UiState {
  /** Desktop sidebar collapsed to icon rail. Persisted. */
  sidebarCollapsed: boolean;
  /** Mobile navigation drawer. Never persisted. */
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  reset: () => void;
}

const initialState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
};

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        toggleSidebar: () => {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }), false, 'toggleSidebar');
        },
        setMobileNavOpen: (open) => {
          set({ mobileNavOpen: open }, false, 'setMobileNavOpen');
        },
        reset: () => {
          set(initialState, false, 'reset');
        },
      }),
      {
        name: storageKeys.ui,
        version: 1,
        storage: createSafePersistStorage(),
        partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      },
    ),
    { name: 'uiStore', enabled: env.DEV },
  ),
);

// Selector hooks: subscribe to a single slice so unrelated updates don't re-render consumers.
export const useSidebarCollapsed = () => useUiStore((state) => state.sidebarCollapsed);
export const useMobileNavOpen = () => useUiStore((state) => state.mobileNavOpen);
