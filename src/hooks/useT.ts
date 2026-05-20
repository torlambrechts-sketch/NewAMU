// useT — the single i18n hook for the app. Thin wrapper over react-i18next's
// `useTranslation` so feature components never import the library directly.
//
// This replaced the legacy custom string bundle (`src/i18n/strings.ts` +
// `I18nProvider` + `useI18n`), which has been removed. `setLocale` switches
// the active language; i18next persists the choice through the localStorage
// detector configured in `src/lib/i18n/index.ts`, and `LocaleSync` keeps it
// aligned with the logged-in user's `profiles.locale`.

import { useTranslation } from 'react-i18next'
import { normalizeLocale, type AppLocale } from '../lib/i18n/locales'

export type { AppLocale }

export function useT() {
  const { t, i18n } = useTranslation()
  return {
    t,
    locale: normalizeLocale(i18n.language),
    setLocale: (lng: AppLocale) => i18n.changeLanguage(lng),
  }
}
