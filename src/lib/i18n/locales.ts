// Locale registry (frontend mirror of the DB `app_locales` table).
//
// Single source of truth for which UI languages the app exposes, their
// switcher labels, and the BCP-47 tag each maps to for Intl formatting.
// Extending to Swedish/Danish is one entry here plus an `app_locales` row
// and a locale JSON file — no other code changes.

export type AppLocale = 'nb' | 'en'

export const APP_LOCALES: AppLocale[] = ['nb', 'en']

export const DEFAULT_LOCALE: AppLocale = 'nb'

// Native-language display names for locale switchers.
export const LOCALE_LABELS: Record<AppLocale, string> = {
  nb: 'Norsk',
  en: 'English',
}

// BCP-47 tags for Intl.DateTimeFormat / Intl.NumberFormat / localeCompare.
export const LOCALE_BCP47: Record<AppLocale, string> = {
  nb: 'nb-NO',
  en: 'en-GB',
}

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'nb' || value === 'en'
}

// Narrow any i18next language string (`en-GB`, `nb`, …) to a supported locale.
export function normalizeLocale(value: string | null | undefined): AppLocale {
  const short = value?.slice(0, 2)
  return isAppLocale(short) ? short : DEFAULT_LOCALE
}
