// Pack context value + hooks. Split from PackContext.tsx so Fast Refresh
// can hot-reload the provider component without invalidating consumers.

import { createContext, useContext } from 'react'
import type { CompliancePackSlug } from '../../modules/compliance/types'
import type { UpdatePackInput } from '../../modules/compliance/usePacks'
import type { CompliancePack } from '../lib/compliance/packs'

export type PackContextValue = {
  pack: CompliancePack
  /** Org's licensed packs (is_active rows in compliance_packs), sorted by position. */
  licensedPacks: CompliancePack[]
  setPackSlug: (slug: CompliancePackSlug) => void
  /** Update display fields on a licensed pack and refresh the provider's cache. */
  updatePack: (input: UpdatePackInput) => Promise<void>
  /** Force a re-fetch of the licensed pack list (e.g. after admin edits). */
  refreshPacks: () => Promise<void>
}

export const PackContext = createContext<PackContextValue | null>(null)

export function useActivePack(): CompliancePack {
  const ctx = useContext(PackContext)
  if (!ctx) {
    throw new Error('useActivePack must be used inside <PackProvider>')
  }
  return ctx.pack
}

export function useSetActivePack(): (slug: CompliancePackSlug) => void {
  const ctx = useContext(PackContext)
  if (!ctx) {
    throw new Error('useSetActivePack must be used inside <PackProvider>')
  }
  return ctx.setPackSlug
}

export function useLicensedPacks(): CompliancePack[] {
  const ctx = useContext(PackContext)
  if (!ctx) {
    throw new Error('useLicensedPacks must be used inside <PackProvider>')
  }
  return ctx.licensedPacks
}

export function usePackAdmin(): {
  updatePack: PackContextValue['updatePack']
  refreshPacks: PackContextValue['refreshPacks']
} {
  const ctx = useContext(PackContext)
  if (!ctx) {
    throw new Error('usePackAdmin must be used inside <PackProvider>')
  }
  return { updatePack: ctx.updatePack, refreshPacks: ctx.refreshPacks }
}
