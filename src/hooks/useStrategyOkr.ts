/* Read hook for Strategy v2 — Objectives tree + Strategy map. Reads the org's
   OKR objectives (with the new pillar_code) and their key results from the
   existing okr_* tables (RLS-scoped), shaped for the design's OkrTreeView /
   StrategyMapView. Read-only; editing OKRs stays in the planning module. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type StrategyKr = {
  id: string
  kr: string
  unit: string
  start: number
  target: number
  now: number
}
export type StrategyOkrObjective = {
  id: string
  pillar: string // pillar_code ('' if unassigned)
  title: string
  why: string
  owner: string // owner_name
  health: 'on_track' | 'at_risk' | 'off_track'
  progress: number // 0..1
  krs: StrategyKr[]
}

type DbObjective = {
  id: string
  pillar_code: string | null
  objective: string
  why: string | null
  owner_name: string | null
  health: string
  progress: number | null
}
type DbKr = {
  id: string
  objective_id: string
  kr: string
  unit: string | null
  start_value: number | null
  target: number | null
  current_value: number | null
}

export type UseStrategyOkrReturn = {
  loading: boolean
  error: string | null
  objectives: StrategyOkrObjective[]
  reload: () => void
}

export function useStrategyOkr(): UseStrategyOkrReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [objectives, setObjectives] = useState<StrategyOkrObjective[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true); setError(null)
      try {
        const objRes = await supabase
          .from('okr_objectives')
          .select('id, pillar_code, objective, why, owner_name, health, progress')
          .eq('organization_id', orgId)
          .order('position', { ascending: true })
        if (cancelled) return
        if (objRes.error) throw objRes.error
        const objs = (objRes.data as DbObjective[] | null) || []
        const ids = objs.map((o) => o.id)
        let krs: DbKr[] = []
        if (ids.length) {
          const krRes = await supabase
            .from('okr_key_results')
            .select('id, objective_id, kr, unit, start_value, target, current_value')
            .in('objective_id', ids)
            .order('position', { ascending: true })
          if (cancelled) return
          if (krRes.error) throw krRes.error
          krs = (krRes.data as DbKr[] | null) || []
        }
        const krsByObj: Record<string, StrategyKr[]> = {}
        for (const k of krs) {
          ;(krsByObj[k.objective_id] ||= []).push({
            id: String(k.id),
            kr: k.kr,
            unit: k.unit ?? '',
            start: Number(k.start_value ?? 0),
            target: Number(k.target ?? 0),
            now: Number(k.current_value ?? 0),
          })
        }
        setObjectives(
          objs.map((o) => ({
            id: String(o.id),
            pillar: o.pillar_code ?? '',
            title: o.objective,
            why: o.why ?? '',
            owner: o.owner_name ?? '',
            health: (o.health as StrategyOkrObjective['health']) || 'on_track',
            progress: Number(o.progress ?? 0),
            krs: krsByObj[o.id] || [],
          })),
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste mål.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  return useMemo(() => ({ loading, error, objectives, reload }), [loading, error, objectives, reload])
}
