import { type Locale } from 'date-fns';
import { enUS, ro } from 'date-fns/locale';

import { type SupportedLanguage } from './index';

export const dateLocales: Record<SupportedLanguage, Locale> = {
  en: enUS,
  ro,
};
