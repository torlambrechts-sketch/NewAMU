/* Data hook for Strategy v2 — Foundation + pillars. Loads the single
   strategy_foundation row and the org's strategy_pillars, provisions the
   baseline on first view, and persists edits (text edits debounced). Mirrors
   the useStrategyToolAnalyses pattern: optimistic local state, snake_case
   mapping. Replaces the design's localStorage klarert_foundation_v1. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  AmbitionStat,
  FoundationValue,
  StrategyFoundation,
  StrategyPillar,
} from '../types/strategyTools'

type DbFoundation = {
  organization_id: string
  vision_text: string | null
  vision_tag: string | null
  mission_title: string | null
  mission_body: string | null
  ambition_title: string | null
  ambition_stats: AmbitionStat[] | null
  values: FoundationValue[] | null
  intent_lead: string | null
}
type DbPillar = {
  id: string
  code: string
  name: string
  mission_question: string | null
  color: string | null
  soft_color: string | null
  position: number
}

const EMPTY_FOUNDATION: StrategyFoundation = {
  visionText: '', visionTag: '', missionTitle: '', missionBody: '',
  ambitionTitle: '', ambitionStats: [], values: [], intentLead: '',
}

function mapFoundation(r: DbFoundation | null): StrategyFoundation {
  if (!r) return { ...EMPTY_FOUNDATION }
  return {
    visionText: r.vision_text ?? '',
    visionTag: r.vision_tag ?? '',
    missionTitle: r.mission_title ?? '',
    missionBody: r.mission_body ?? '',
    ambitionTitle: r.ambition_title ?? '',
    ambitionStats: r.ambition_stats ?? [],
    values: r.values ?? [],
    intentLead: r.intent_lead ?? '',
  }
}
function mapPillar(r: DbPillar): StrategyPillar {
  return {
    id: String(r.id),
    code: r.code,
    name: r.name,
    missionQuestion: r.mission_question ?? '',
    color: r.color ?? '#1a3d32',
    softColor: r.soft_color ?? '#e7efe9',
    position: r.position,
  }
}
function toDbFoundation(p: Partial<StrategyFoundation>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (p.visionText !== undefined) out.vision_text = p.visionText
  if (p.visionTag !== undefined) out.vision_tag = p.visionTag
  if (p.missionTitle !== undefined) out.mission_title = p.missionTitle
  if (p.missionBody !== undefined) out.mission_body = p.missionBody
  if (p.ambitionTitle !== undefined) out.ambition_title = p.ambitionTitle
  if (p.ambitionStats !== undefined) out.ambition_stats = p.ambitionStats
  if (p.values !== undefined) out.values = p.values
  if (p.intentLead !== undefined) out.intent_lead = p.intentLead
  return out
}

export type UseStrategyFoundationReturn = {
  loading: boolean
  error: string | null
  foundation: StrategyFoundation
  pillars: StrategyPillar[]
  reload: () => void
  updateFoundation: (patch: Partial<StrategyFoundation>) => void
  updatePillar: (id: string, patch: Partial<Pick<StrategyPillar, 'name' | 'missionQuestion' | 'color'>>) => void
}

export function useStrategyFoundation(): UseStrategyFoundationReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [foundation, setFoundation] = useState<StrategyFoundation>({ ...EMPTY_FOUNDATION })
  const [pillars, setPillars] = useState<StrategyPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        await supabase.rpc('provision_strategy_baseline_for_org', { p_org_id: orgId })
        const [fRes, pRes] = await Promise.all([
          supabase.from('strategy_foundation').select('*').eq('organization_id', orgId).maybeSingle(),
          supabase.from('strategy_pillars').select('*').order('position', { ascending: true }),
        ])
        if (cancelled) return
        if (fRes.error) throw fRes.error
        if (pRes.error) throw pRes.error
        setFoundation(mapFoundation(fRes.data as DbFoundation | null))
        setPillars(((pRes.data as DbPillar[] | null) || []).map(mapPillar))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste foundation.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const updateFoundation = useCallback<UseStrategyFoundationReturn['updateFoundation']>(
    (patch) => {
      setFoundation((prev) => ({ ...prev, ...patch }))
      if (!supabase || !orgId) return
      if (debounce.current) clearTimeout(debounce.current)
      const dbPatch = toDbFoundation(patch)
      debounce.current = setTimeout(() => {
        void supabase
          .from('strategy_foundation')
          .update(dbPatch)
          .eq('organization_id', orgId)
          .then(({ error: upErr }) => { if (upErr) setError(upErr.message) })
      }, 600)
    },
    [supabase, orgId],
  )

  const updatePillar = useCallback<UseStrategyFoundationReturn['updatePillar']>(
    (id, patch) => {
      setPillars((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      if (!supabase) return
      const dbPatch: Record<string, unknown> = {}
      if (patch.name !== undefined) dbPatch.name = patch.name
      if (patch.missionQuestion !== undefined) dbPatch.mission_question = patch.missionQuestion
      if (patch.color !== undefined) dbPatch.color = patch.color
      void supabase.from('strategy_pillars').update(dbPatch).eq('id', id)
        .then(({ error: upErr }) => { if (upErr) setError(upErr.message) })
    },
    [supabase],
  )

  return useMemo(
    () => ({ loading, error, foundation, pillars, reload, updateFoundation, updatePillar }),
    [loading, error, foundation, pillars, reload, updateFoundation, updatePillar],
  )
}
