// LocaleSync — keeps the i18next active language aligned with the logged-in
// user's `profiles.locale`. Renders nothing.
//
// For guests, the i18next localStorage/navigator detector decides the
// language. Once a user logs in, their stored preference is authoritative,
// so this bridges the DB value into i18next whenever the profile loads or
// changes. Replaces the effect that lived in the removed `I18nProvider`.

import { useEffect } from 'react'
import i18next from 'i18next'
import { isAppLocale } from '../lib/i18n/locales'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

export function LocaleSync() {
  const { profile } = useOrgSetupContext()
  const profileLocale = profile?.locale

  useEffect(() => {
    if (isAppLocale(profileLocale) && i18next.language?.slice(0, 2) !== profileLocale) {
      void i18next.changeLanguage(profileLocale)
    }
  }, [profileLocale])

  return null
}
