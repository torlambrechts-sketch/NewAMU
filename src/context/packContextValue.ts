// Pack context value + hooks. Split from PackContext.tsx so Fast Refresh
// can hot-reload the provider component without invalidating consumers.

import { createContext, useContext } from 'react'
import type { CompliancePackSlug } from '../../modules/compliance/types'
import type { CompliancePack } from '../lib/compliance/packs'

export type PackContextValue = {
  pack: CompliancePack
  /** Org's licensed packs (is_active rows in compliance_packs), sorted by position. */
  licensedPacks: CompliancePack[]
  setPackSlug: (slug: CompliancePackSlug) => void
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
