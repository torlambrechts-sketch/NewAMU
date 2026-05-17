// i18n scaffold (P3-#20) — react-i18next bootstrap. The app is hardcoded
// Norwegian Bokmål today; this scaffold lets us drop in additional locale
// files (English first, Swedish for cross-border konserner later) without
// rewriting components. A small subset of strings (WorkflowBuilderPage
// chrome) is migrated as a proof-of-concept — see `src/lib/i18n/locales/`.
//
// Loaded as a side-effect from `src/main.tsx` so the i18n instance is
// initialised before React renders. `useT()` (src/hooks/useT.ts) is the
// thin alias components should reach for; the locale switcher lives in
// `src/components/layout/AticsShell.tsx` (user-pill area).

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import nb from './locales/nb.json'
import en from './locales/en.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'nb',
    supportedLngs: ['nb', 'en'],
    resources: {
      nb: { translation: nb },
      en: { translation: en },
    },
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'newamu_locale',
    },
  })

export default i18n
