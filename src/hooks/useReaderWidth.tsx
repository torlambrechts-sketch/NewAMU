import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Reader-width state for the document viewer (Rec02).
 *
 * The viewer has a "size button" that lets the reader expand the prose column
 * to consume the right-hand side panel. The choice is persisted per browser so
 * it survives navigation between pages.
 */
type ReaderWidth = 'comfortable' | 'wide'

const STORAGE_KEY = 'klarert.documents.readerWidth'

interface ReaderWidthValue {
  width: ReaderWidth
  /** True when the side panel should be hidden and the reader expanded. */
  isWide: boolean
  toggle: () => void
  setWidth: (width: ReaderWidth) => void
}

const ReaderWidthContext = createContext<ReaderWidthValue | null>(null)

function readInitial(): ReaderWidth {
  if (typeof window === 'undefined') return 'comfortable'
  return window.localStorage.getItem(STORAGE_KEY) === 'wide' ? 'wide' : 'comfortable'
}

export function ReaderWidthProvider({ children }: { children: ReactNode }) {
  const [width, setWidthState] = useState<ReaderWidth>(readInitial)

  const setWidth = useCallback((next: ReaderWidth) => {
    setWidthState(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => {
    setWidthState((prev) => {
      const next: ReaderWidth = prev === 'wide' ? 'comfortable' : 'wide'
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo<ReaderWidthValue>(
    () => ({ width, isWide: width === 'wide', toggle, setWidth }),
    [width, toggle, setWidth],
  )

  return <ReaderWidthContext.Provider value={value}>{children}</ReaderWidthContext.Provider>
}

/**
 * Returns the reader-width state. Falls back to a no-op `comfortable` value
 * when used outside the provider so isolated previews don't crash.
 */
export function useReaderWidth(): ReaderWidthValue {
  const ctx = useContext(ReaderWidthContext)
  if (ctx) return ctx
  return { width: 'comfortable', isWide: false, toggle: () => {}, setWidth: () => {} }
}
