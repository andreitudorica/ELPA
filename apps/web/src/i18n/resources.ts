import enCommon from './locales/en/common.json';
import enValidation from './locales/en/validation.json';
import roCommon from './locales/ro/common.json';
import roValidation from './locales/ro/validation.json';

/**
 * Translations are bundled statically: with two languages and small namespaces
 * this costs a few KB and removes a whole class of loading states. If the
 * catalog grows large, switch to lazy loading with `i18next-resources-to-backend`
 * and dynamic `import()` per namespace — the keys and components stay the same.
 */
export const resources = {
  en: {
    common: enCommon,
    validation: enValidation,
  },
  ro: {
    common: roCommon,
    validation: roValidation,
  },
} as const;

export const defaultNS = 'common';
