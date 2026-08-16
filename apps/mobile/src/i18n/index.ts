/**
 * Two-language dictionary, resolved once at startup from the device locale.
 *
 * No i18n library: the app has one screen family and a few dozen strings, and a runtime
 * message compiler would cost more startup than it saves. What matters is that no German
 * string is ever hard-coded into a component, so adding a third language stays a matter of
 * adding one file.
 */
import { getLocales } from 'expo-localization';

import { de } from './de';
import { en } from './en';

export type Dict = typeof de;
export type MessageKey = keyof Dict;

const DICTS = { de, en } as const;
export type Language = keyof typeof DICTS;

function detectLanguage(): Language {
  const locales = getLocales();
  const code = locales[0]?.languageCode?.toLowerCase();
  return code === 'de' ? 'de' : 'en';
}

export const language: Language = detectLanguage();

// Widened deliberately: `de` is `as const`, so its values are literal types, and the
// English mirror only promises `string`.
const dict: Record<MessageKey, string> = DICTS[language];

/**
 * Look up a message, substituting `{name}` placeholders.
 * German is the reference dictionary, so a missing English key falls back to it rather
 * than rendering a raw key at the user.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dict[key] ?? de[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Locale-aware number formatting for the statistics screen. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US').format(Math.round(value));
}

/** "2 h 14 min" / "14 min" / "38 s" — reading time is never shown in raw seconds. */
export function formatHuman(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (totalMinutes > 0) return `${totalMinutes} min`;
  return `${Math.max(0, Math.round(ms / 1000))} s`;
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}
