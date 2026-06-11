// useOkrSnapshots — list + take + read OKR plan snapshots (H3.1).
//
// Listing fetches metadata only (no jsonb payload) so the history panel
// opens instantly; the full snapshot tree is fetched lazily per selection.
// takeSnapshot goes through the okr_snapshot_plan RPC (the table has no
// insert policy — history is append-only by construction).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type OkrSnapshotMeta = {
  id: string
  reason: string
  createdAt: string
}

/** Mirrors the jsonb shape documented on okr_plan_snapshots.snapshot. */
export type OkrSnapshotTree = {
  plan: {
    title?: string
    description?: string
    status?: string
    horizon?: string
  }
  objectives: Array<{
    ord_label?: string
    objective?: string
    why?: string
    owner_name?: string
    keyResults: Array<{
      kr?: string
      unit?: string
      target?: number
      current_value?: number
      confidence?: number
      invert?: boolean
    }>
  }>
}

export function useOkrSnapshots(planId: string | null) {
  const { supabase } = useOrgSetupContext()
  const [list, setList] = useState<OkrSnapshotMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !planId) return
    let cancelled = false
    void supabase
      .from('okr_plan_snapshots')
      .select('id, reason, created_at')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: qErr }) => {
        if (cancelled) return
        if (qErr) {
          setError(qErr.message)
          return
        }
        setError(null)
        setList(
          (data ?? []).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id),
              reason: String(row.reason ?? 'manual'),
              createdAt: String(row.created_at),
            }
          }),
        )
      })
    return () => {
      cancelled = true
    }
  }, [supabase, planId, version])

  const fetchSnapshot = useCallback(
    async (snapshotId: string): Promise<OkrSnapshotTree | null> => {
      if (!supabase) return null
      const { data, error: qErr } = await supabase
        .from('okr_plan_snapshots')
        .select('snapshot')
        .eq('id', snapshotId)
        .single()
      if (qErr || !data) {
        setError(qErr?.message ?? 'Kunne ikke hente øyeblikksbilde.')
        return null
      }
      const raw = (data as { snapshot: unknown }).snapshot as Partial<OkrSnapshotTree> | null
      return {
        plan: raw?.plan ?? {},
        objectives: Array.isArray(raw?.objectives)
          ? raw.objectives.map((o) => ({ ...o, keyResults: Array.isArray(o.keyResults) ? o.keyResults : [] }))
          : [],
      }
    },
    [supabase],
  )

  const takeSnapshot = useCallback(
    async (reason = 'manual'): Promise<boolean> => {
      if (!supabase || !planId) return false
      const { error: rpcErr } = await supabase.rpc('okr_snapshot_plan', {
        p_plan_id: planId,
        p_reason: reason,
      })
      if (rpcErr) {
        setError(rpcErr.message)
        return false
      }
      reload()
      return true
    },
    [supabase, planId, reload],
  )

  return { list, error, reload, fetchSnapshot, takeSnapshot }
}
