import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { defaultNS, resources } from './resources';

/** The shared i18next instance (also exported as `i18n` for convenience). */
export const i18n = i18next;

export const supportedLanguages = ['en', 'ro'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** All translation namespaces, for hooks that need cross-namespace keys. */
export const allNamespaces = ['common', 'validation'] as const;
export type AppNamespace = (typeof allNamespaces)[number];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

/** Best-effort browser language detection, used only for the very first visit. */
export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const candidates = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) {
      return base;
    }
  }
  return 'en';
}

export async function initI18n(language: SupportedLanguage): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    defaultNS,
    supportedLngs: supportedLanguages,
    interpolation: {
      // React already escapes rendered strings; double-escaping would show entities.
      escapeValue: false,
    },
    returnNull: false,
  });
  return i18n;
}
