import { format as formatDateFns, formatDistanceToNow, parseISO } from 'date-fns';

import { i18n, isSupportedLanguage, type SupportedLanguage } from '@/i18n';
import { dateLocales } from '@/i18n/dateLocales';

function currentLanguage(): SupportedLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : 'en';
}

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

/** Locale-aware date, e.g. "Apr 29, 2026" / "29 apr. 2026". */
export function formatDate(value: Date | string, pattern = 'PP'): string {
  return formatDateFns(toDate(value), pattern, { locale: dateLocales[currentLanguage()] });
}

/** Locale-aware date with time, e.g. "Apr 29, 2026, 09:30". */
export function formatDateTime(value: Date | string): string {
  return formatDate(value, 'PPp');
}

/** Relative time, e.g. "3 days ago". */
export function formatRelativeTime(value: Date | string): string {
  return formatDistanceToNow(toDate(value), {
    addSuffix: true,
    locale: dateLocales[currentLanguage()],
  });
}

/** Locale-aware number, e.g. 12345.6 -> "12,345.6" (en) / "12.345,6" (ro). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLanguage(), options).format(value);
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return formatNumber(value, { style: 'currency', currency, maximumFractionDigits: 0 });
}

/** Percentage from a ratio: 0.123 -> "12.3%". */
export function formatPercent(ratio: number, fractionDigits = 1): string {
  return formatNumber(ratio, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Compact number for KPI cards: 12500 -> "12.5K". */
export function formatCompactNumber(value: number): string {
  return formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 });
}
