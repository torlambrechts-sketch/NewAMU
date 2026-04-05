import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { AppLocale } from '../i18n/strings'
import { translate } from '../i18n/strings'
import { I18nContext } from './i18nContext'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

const LS_KEY = 'atics-locale'

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw === 'en' || raw === 'nb') return raw
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const short = navigator.language?.slice(0, 2)
    if (short === 'en') return 'en'
  }
  return 'nb'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile, user, supabase, updateLocale: persistLocale } = useOrgSetupContext()
  const [guestLocale, setGuestLocale] = useState<AppLocale>(() =>
    typeof localStorage !== 'undefined' ? readStoredLocale() : 'nb',
  )

  const locale: AppLocale = useMemo(() => {
    const p = profile?.locale
    if (p === 'en' || p === 'nb') return p
    return guestLocale
  }, [profile?.locale, guestLocale])

  const t = useCallback((key: string) => translate(locale, key), [locale])

  const setLocale = useCallback(
    async (next: AppLocale) => {
      try {
        localStorage.setItem(LS_KEY, next)
      } catch {
        /* ignore */
      }
      setGuestLocale(next)
      if (user && supabase && persistLocale) {
        await persistLocale(next)
      }
    },
    [user, supabase, persistLocale],
  )

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
    }),
    [locale, t, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
