// Active compliance pack — DB-driven.
//
// On mount the provider fetches the org's licensed packs from
// public.compliance_packs (is_active = true). While loading, render a
// spinner so child components never see a null pack. If the org has no
// licensed packs, render a WarningBox instead of the children.
//
// URL is the source of truth for *which* pack is active (?pack=...).
// Falls back to the first licensed pack if the URL slug isn't licensed
// or absent. Hooks live in packContextValue.ts so Fast Refresh can
// hot-reload this file.

import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { CompliancePackSlug } from '../../modules/compliance/types'
import { usePacks } from '../../modules/compliance/usePacks'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WarningBox } from '../components/ui/AlertBox'
import { PackContext, type PackContextValue } from './packContextValue'

export function PackProvider({ children }: { children: ReactNode }) {
  const { supabase } = useOrgSetupContext()
  const { loading, error, packs, updatePack, refresh } = usePacks({ supabase })
  const [searchParams, setSearchParams] = useSearchParams()
  const slugParam = searchParams.get('pack')

  // Resolve active pack: URL slug if licensed, else first licensed.
  const pack = useMemo(() => {
    if (packs.length === 0) return null
    return packs.find((p) => p.slug === slugParam) ?? packs[0]
  }, [packs, slugParam])

  const setPackSlug = useCallback(
    (slug: CompliancePackSlug) => {
      const next = new URLSearchParams(searchParams)
      if (packs.length > 0 && slug === packs[0].slug) {
        next.delete('pack')
      } else {
        next.set('pack', slug)
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams, packs],
  )

  const value = useMemo<PackContextValue | null>(
    () =>
      pack
        ? {
            pack,
            licensedPacks: packs,
            setPackSlug,
            updatePack,
            refreshPacks: refresh,
          }
        : null,
    [pack, packs, setPackSlug, updatePack, refresh],
  )

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <WarningBox>{error}</WarningBox>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <WarningBox>
          Ingen compliance-pakker er lisensiert for denne organisasjonen.
          Kontakt en administrator for å aktivere AML eller ISO 45001.
        </WarningBox>
      </div>
    )
  }

  return <PackContext.Provider value={value}>{children}</PackContext.Provider>
}
