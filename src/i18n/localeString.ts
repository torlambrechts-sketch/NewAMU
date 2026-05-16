// pickLocaleString — pack-agnostic helper for selecting the right
// translation from an i18n-shaped jsonb field on template data.
//
// Convention used across the compliance / learning / documents modules
// when seed migrations want to ship multi-locale content:
//
//   {
//     "prompt": "Hvordan står dere på dette i dag?",  // canonical, Norwegian
//     "prompt_i18n": {
//        "en": "Where are you on this today?",
//        "sv": "Hur står ni med detta idag?"
//     }
//   }
//
// The function returns the matching locale string, falling back to
// the canonical string (typically `nb`) when no translation exists.

import type { AppLocale } from './strings'

export type I18nBag = Record<string, string> | string | null | undefined

/** Resolve the right string for the active locale. Order:
 *   1. exact match (e.g. 'en')
 *   2. language prefix (e.g. 'en' for 'en-US')
 *   3. fallback string (canonical)
 *   4. empty string
 *
 *  Plain strings pass through unchanged so callers don't have to
 *  branch on the shape — `pickLocaleString(item.prompt_i18n, locale)
 *  ?? item.prompt`. */
export function pickLocaleString(
  bag: I18nBag,
  locale: AppLocale,
  fallback?: string | null,
): string {
  if (bag == null) return fallback ?? ''
  if (typeof bag === 'string') return bag
  const exact = bag[locale]
  if (typeof exact === 'string' && exact.length > 0) return exact
  // Language-prefix match — caller passes 'en' but bag has 'en-US'.
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v === 'string' && v.length > 0 && k.split('-')[0] === locale.split('-')[0]) {
      return v
    }
  }
  return fallback ?? ''
}
