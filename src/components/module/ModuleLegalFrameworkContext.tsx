/* eslint-disable react-refresh/only-export-components -- provider + hooks */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** v2 — mint banner + header switch (replaces old collapsible dark banner). */
const STORAGE_KEY = 'atics-module-legal-framework-dismissed-v2'

type Ctx = {
  /** At least one page mounted a legal-framework banner this session. */
  bannerMounted: boolean
  registerBanner: () => void
  unregisterBanner: () => void
  dismissed: boolean
  setDismissed: (value: boolean) => void
}

const ModuleLegalFrameworkContext = createContext<Ctx | null>(null)

export function ModuleLegalFrameworkProvider({ children }: { children: ReactNode }) {
  const [mountCount, setMountCount] = useState(0)
  const [dismissed, setDismissedState] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const setDismissed = useCallback((value: boolean) => {
    setDismissedState(value)
    try {
      if (value) window.sessionStorage.setItem(STORAGE_KEY, '1')
      else window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const registerBanner = useCallback(() => {
    setMountCount((n) => n + 1)
  }, [])
  const unregisterBanner = useCallback(() => {
    setMountCount((n) => Math.max(0, n - 1))
  }, [])

  const value = useMemo(
    () => ({
      bannerMounted: mountCount > 0,
      registerBanner,
      unregisterBanner,
      dismissed,
      setDismissed,
    }),
    [mountCount, dismissed, registerBanner, unregisterBanner, setDismissed],
  )

  return <ModuleLegalFrameworkContext.Provider value={value}>{children}</ModuleLegalFrameworkContext.Provider>
}

export function useModuleLegalFramework(): Ctx {
  const ctx = useContext(ModuleLegalFrameworkContext)
  if (!ctx) {
    return {
      bannerMounted: false,
      registerBanner: () => {},
      unregisterBanner: () => {},
      dismissed: false,
      setDismissed: () => {},
    }
  }
  return ctx
}
