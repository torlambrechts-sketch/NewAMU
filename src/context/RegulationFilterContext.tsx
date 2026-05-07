// RegulationFilterContext — multi-select toggles for the cross-module
// regulation filter (category-architecture §T4).
//
// Rules per OQs:
//   - OQ-A4: zero active regulations = "show all" (don't lock the user out).
//   - OQ-A3: support `setAll()` / `clear()` shortcuts in the menu.
//
// Persistence:
//   - localStorage (so the choice survives reloads).
//   - URL `?regulations=id1,id2,…` — wins over localStorage when present
//     so deep links narrow the same way they did when shared.
//
// Consumers (analyse pages, sidebar builders, "Alle X" pages) read the
// same active set + a typed `isActive(id)` helper so callers don't need
// to do the empty-set translation themselves.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'newamu.regulations.active'
const URL_PARAM = 'regulations'

type RegulationFilterValue = {
  /** The raw active set, persisted across reloads + URL. May be empty. */
  activeRegulationIds: ReadonlySet<string>
  /** Convenience: empty active set = "all" (per OQ-A4); otherwise membership. */
  isActive: (id: string | null | undefined) => boolean
  /** Toggle a single regulation on/off. */
  toggle: (id: string) => void
  /** Replace the entire set. */
  setAll: (ids: Iterable<string>) => void
  /** Drop everything (= "show all" per OQ-A4). */
  clear: () => void
}

const Ctx = createContext<RegulationFilterValue | null>(null)

function readInitialFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM)
    if (fromUrl !== null) {
      // URL wins — even if blank (= explicit "show all").
      return new Set(
        fromUrl
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    }
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    return new Set()
  } catch {
    return new Set()
  }
}

function writeToStorage(ids: ReadonlySet<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore quota errors */
  }
}

function syncToUrl(ids: ReadonlySet<string>) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (ids.size === 0) {
    url.searchParams.delete(URL_PARAM)
  } else {
    url.searchParams.set(URL_PARAM, [...ids].join(','))
  }
  window.history.replaceState(null, '', url.toString())
}

export function RegulationFilterProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Set<string>>(() => readInitialFromStorage())

  useEffect(() => {
    writeToStorage(active)
    syncToUrl(active)
  }, [active])

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setAll = useCallback((ids: Iterable<string>) => {
    setActive(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setActive(new Set())
  }, [])

  const isActive = useCallback(
    (id: string | null | undefined) => {
      // Empty set = "show all" (OQ-A4). Null id = no membership; only
      // appears when the active set is empty (otherwise it's filtered out).
      if (active.size === 0) return true
      if (!id) return false
      return active.has(id)
    },
    [active],
  )

  const value = useMemo<RegulationFilterValue>(
    () => ({
      activeRegulationIds: active,
      isActive,
      toggle,
      setAll,
      clear,
    }),
    [active, isActive, toggle, setAll, clear],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRegulationFilter(): RegulationFilterValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRegulationFilter must be used inside <RegulationFilterProvider>')
  return v
}
