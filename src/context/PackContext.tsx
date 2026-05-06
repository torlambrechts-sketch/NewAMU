// Active compliance pack — URL is the source of truth (?pack=aml-amu|iso-45001).
// Falls back to DEFAULT_PACK_SLUG when the param is absent or unknown.
//
// Refresh + deep-link reproducibility is the reason we don't use localStorage.
// Hooks live in packContextValue.ts so Fast Refresh can hot-reload this file.

import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CompliancePackSlug } from '../../modules/compliance/types'
import { DEFAULT_PACK_SLUG, getPack } from '../lib/compliance/packs'
import { PackContext, type PackContextValue } from './packContextValue'

export function PackProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const slugParam = searchParams.get('pack')
  const pack = getPack(slugParam)

  const setPackSlug = useCallback(
    (slug: CompliancePackSlug) => {
      const next = new URLSearchParams(searchParams)
      if (slug === DEFAULT_PACK_SLUG) {
        next.delete('pack')
      } else {
        next.set('pack', slug)
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const value = useMemo<PackContextValue>(() => ({ pack, setPackSlug }), [pack, setPackSlug])
  return <PackContext.Provider value={value}>{children}</PackContext.Provider>
}
