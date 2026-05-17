// useT — thin alias over `useTranslation` from react-i18next so feature
// components don't import the library directly. Locale is constrained to
// the supported set (`'nb' | 'en'`) and `setLocale` is the canonical way
// to switch — i18next persists the choice through the localStorage
// detector configured in `src/lib/i18n/index.ts`.
//
// Note: the existing `useI18n` hook (legacy custom bundle in
// `src/i18n/strings.ts`) stays in place for now. New code should reach
// for `useT()`; old call sites keep working until they're migrated.

import { useTranslation } from 'react-i18next'

export type AppLocale = 'nb' | 'en'

export function useT() {
  const { t, i18n } = useTranslation()
  return {
    t,
    locale: (i18n.language?.slice(0, 2) === 'en' ? 'en' : 'nb') as AppLocale,
    setLocale: (lng: AppLocale) => i18n.changeLanguage(lng),
  }
}
