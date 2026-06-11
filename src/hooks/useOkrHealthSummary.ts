// useOkrHealthSummary — lightweight OKR confidence rollup for the home page
// attention strip. Counts key results by confidence tier for the current org
// in a single select (no plan hydration, no N+1). Tiers mirror
// numToConfidence in PlanningStrategiSection but on the 0..1 scale.

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type OkrHealthSummary = {
  total: number
  onTrack: number
  atRisk: number
  offTrack: number
}

const EMPTY: OkrHealthSummary = { total: 0, onTrack: 0, atRisk: 0, offTrack: 0 }

export function useOkrHealthSummary(): OkrHealthSummary {
  const { supabase, organization } = useOrgSetupContext()
  const [summary, setSummary] = useState<OkrHealthSummary>(EMPTY)

  useEffect(() => {
    if (!supabase || !organization) return
    let cancelled = false
    void supabase
      .from('okr_key_results')
      .select('confidence')
      .eq('organization_id', organization.id)
      .then(({ data }) => {
        if (cancelled) return
        let onTrack = 0
        let atRisk = 0
        let offTrack = 0
        for (const r of data ?? []) {
          const c = Number((r as { confidence: number | string }).confidence ?? 0)
          if (c >= 0.7) onTrack += 1
          else if (c >= 0.4) atRisk += 1
          else offTrack += 1
        }
        setSummary({ total: (data ?? []).length, onTrack, atRisk, offTrack })
      })
    return () => {
      cancelled = true
    }
  }, [supabase, organization])

  return summary
}
