// useFreshArtefacts — load the org-wide "fresh signed artefacts" lookup
// for the AML walkthrough auto-mark feature.
//
// Server-side RPC `compliance_walkthrough_fresh_artefacts` returns at
// most one row per (kind, ref) — the most recent signed checklist
// execution, document acknowledgement, or course completion in the
// last N months. The hook materialises that into a Map keyed
// `${kind}:${ref}` so the wizard's findFreshArtefact() is a single
// O(1) lookup per item resolution.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type FreshArtefactRow = {
  kind: 'checklist_template' | 'document' | 'learning' | string
  ref: string
  signed_at: string
  source_id: string
  label: string
}

export type FreshArtefactMap = Map<string, FreshArtefactRow>

const makeKey = (kind: string, ref: string) => `${kind}:${ref}`

export function lookupFresh(
  map: FreshArtefactMap,
  kind: string,
  ref: string,
): FreshArtefactRow | null {
  return map.get(makeKey(kind, ref)) ?? null
}

export function useFreshArtefacts(maxAgeMonths = 12) {
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<FreshArtefactRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !organization?.id) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc(
      'compliance_walkthrough_fresh_artefacts',
      { p_org_id: organization.id, p_max_age_months: maxAgeMonths },
    )
    setLoading(false)
    if (rpcErr) {
      setError(rpcErr.message)
      setRows([])
      return
    }
    const ok: FreshArtefactRow[] = Array.isArray(data)
      ? data.flatMap((r) => {
          if (!r || typeof r !== 'object') return []
          const obj = r as Record<string, unknown>
          const kind = typeof obj.kind === 'string' ? obj.kind : null
          const ref = typeof obj.ref === 'string' ? obj.ref : null
          const signedAt = typeof obj.signed_at === 'string' ? obj.signed_at : null
          if (!kind || !ref || !signedAt) return []
          return [{
            kind,
            ref,
            signed_at: signedAt,
            source_id: typeof obj.source_id === 'string' ? obj.source_id : '',
            label: typeof obj.label === 'string' ? obj.label : ref,
          }]
        })
      : []
    setRows(ok)
  }, [supabase, organization?.id, maxAgeMonths])

  useEffect(() => {
    void load()
  }, [load])

  const map = useMemo<FreshArtefactMap>(() => {
    const m = new Map<string, FreshArtefactRow>()
    for (const r of rows) m.set(makeKey(r.kind, r.ref), r)
    return m
  }, [rows])

  return { map, rows, loading, error, reload: load }
}
