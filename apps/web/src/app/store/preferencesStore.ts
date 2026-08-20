import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { storageKeys } from '@/app/config/storageKeys';
import { detectBrowserLanguage, type SupportedLanguage } from '@/i18n';
import { env } from '@/lib/env';
import { createSafePersistStorage } from '@/lib/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface PreferencesState {
  themeMode: ThemeMode;
  language: SupportedLanguage;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (language: SupportedLanguage) => void;
  reset: () => void;
}

function initialState() {
  return {
    themeMode: 'system' as ThemeMode,
    language: detectBrowserLanguage(),
  };
}

/**
 * App-level client preferences (theme + language). Persisted so both stay
 * stable across reloads. Note: index.html reads the persisted `themeMode`
 * before React boots to avoid a theme flash — keep the storage key and
 * shape stable, or update index.html at the same time.
 */
export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState(),
        setThemeMode: (themeMode) => {
          set({ themeMode }, false, 'setThemeMode');
        },
        setLanguage: (language) => {
          set({ language }, false, 'setLanguage');
        },
        reset: () => {
          set(initialState(), false, 'reset');
        },
      }),
      {
        name: storageKeys.preferences,
        storage: createSafePersistStorage(),
        version: 1,
        partialize: (state) => ({
          themeMode: state.themeMode,
          language: state.language,
        }),
      },
    ),
    { name: 'preferencesStore', enabled: env.DEV },
  ),
);

export const useThemeMode = () => usePreferencesStore((state) => state.themeMode);
export const useLanguage = () => usePreferencesStore((state) => state.language);
