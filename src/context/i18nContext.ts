import { createContext } from 'react'
import type { AppLocale } from '../i18n/strings'

export type I18nContextValue = {
  locale: AppLocale
  t: (key: string) => string
  setLocale: (locale: AppLocale) => Promise<void>
}

export const I18nContext = createContext<I18nContextValue | null>(null)
