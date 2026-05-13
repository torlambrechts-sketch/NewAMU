// useWellbeingStrategy — leser/skriver org_wellbeing_strategy +
// wellbeing_focus_areas. Returnerer en flat API som siden bruker for
// både hero-editor (visjon/misjon) og fokusområde-CRUD.
//
// All gating skjer RLS-side; vi eksponerer `canManage` til UI så
// redigerings-CTA-er kan deaktiveres på riktig tidspunkt.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'
import type {
  WellbeingAxisKey,
  WellbeingIndexWeights,
} from '../dashboards/useWorkerWellbeingDatasets'
import { DEFAULT_WELLBEING_WEIGHTS } from '../dashboards/useWorkerWellbeingDatasets'

export type OrgWellbeingStrategyRow = {
  organization_id: string
  vision_md: string | null
  mission_md: string | null
  index_weights: WellbeingIndexWeights | null
  updated_at: string
  updated_by: string | null
}

export type WellbeingFocusAreaRow = {
  id: string
  organization_id: string
  axis_key: WellbeingAxisKey
  title: string
  body_md: string | null
  target_metric: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
  created_by: string | null
}

function normalizeWeights(raw: unknown): WellbeingIndexWeights {
  if (!raw || typeof raw !== 'object') return DEFAULT_WELLBEING_WEIGHTS
  const r = raw as Record<string, unknown>
  const keys: WellbeingAxisKey[] = ['trygghet', 'trivsel', 'medvirkning', 'mestring']
  const out: WellbeingIndexWeights = { ...DEFAULT_WELLBEING_WEIGHTS }
  for (const k of keys) {
    const v = r[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
  }
  return out
}

export function useWellbeingStrategy() {
  const { supabase, organization, user, isAdmin, can } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('wellbeing.strategy.manage')

  const [strategy, setStrategy] = useState<OrgWellbeingStrategyRow | null>(null)
  const [focusAreas, setFocusAreas] = useState<WellbeingFocusAreaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [s, f] = await Promise.all([
        supabase
          .from('org_wellbeing_strategy')
          .select('*')
          .eq('organization_id', orgId)
          .maybeSingle(),
        supabase
          .from('wellbeing_focus_areas')
          .select('*')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ])
      if (s.error) throw s.error
      if (f.error) throw f.error
      setStrategy(((s.data as OrgWellbeingStrategyRow | null) ?? null))
      setFocusAreas(((f.data as WellbeingFocusAreaRow[] | null) ?? []))
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const saveStrategy = useCallback(
    async (patch: { vision_md?: string | null; mission_md?: string | null; index_weights?: WellbeingIndexWeights }) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      const row = {
        organization_id: orgId,
        ...patch,
        updated_by: user?.id ?? null,
      }
      const { data, error: e } = await supabase
        .from('org_wellbeing_strategy')
        .upsert(row, { onConflict: 'organization_id' })
        .select('*')
        .single()
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return
      }
      setStrategy((data as OrgWellbeingStrategyRow | null) ?? null)
    },
    [supabase, orgId, canManage, user?.id],
  )

  const createFocusArea = useCallback(
    async (input: {
      axis_key: WellbeingAxisKey
      title: string
      body_md?: string | null
      target_metric?: string | null
      sort_order?: number
    }) => {
      if (!supabase || !orgId || !canManage) return null
      setError(null)
      const { data, error: e } = await supabase
        .from('wellbeing_focus_areas')
        .insert({
          organization_id: orgId,
          axis_key: input.axis_key,
          title: input.title.trim(),
          body_md: input.body_md ?? null,
          target_metric: input.target_metric ?? null,
          sort_order: input.sort_order ?? 0,
          created_by: user?.id ?? null,
        })
        .select('*')
        .single()
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
      const row = data as WellbeingFocusAreaRow
      setFocusAreas((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order))
      return row
    },
    [supabase, orgId, canManage, user?.id],
  )

  const updateFocusArea = useCallback(
    async (id: string, patch: Partial<Pick<WellbeingFocusAreaRow, 'title' | 'body_md' | 'target_metric' | 'sort_order' | 'axis_key'>>) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      const { data, error: e } = await supabase
        .from('wellbeing_focus_areas')
        .update(patch)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return
      }
      const row = data as WellbeingFocusAreaRow
      setFocusAreas((prev) => prev.map((f) => (f.id === row.id ? row : f)).sort((a, b) => a.sort_order - b.sort_order))
    },
    [supabase, orgId, canManage],
  )

  const archiveFocusArea = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      const { error: e } = await supabase
        .from('wellbeing_focus_areas')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return
      }
      setFocusAreas((prev) => prev.filter((f) => f.id !== id))
    },
    [supabase, orgId, canManage],
  )

  const weights = normalizeWeights(strategy?.index_weights ?? null)

  return {
    canManage,
    loading,
    error,
    strategy,
    focusAreas,
    weights,
    saveStrategy,
    createFocusArea,
    updateFocusArea,
    archiveFocusArea,
    reload: load,
  }
}
