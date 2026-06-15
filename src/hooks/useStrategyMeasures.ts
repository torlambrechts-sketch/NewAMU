/* Data hook for Strategy v2 — measures + data sources (Dashboard, Data sources,
   MeasureDrawer). Loads strategy_measures (+ readings) and strategy_data_sources,
   with the key mutators (post a reading, reconnect a source). */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type DataSource = {
  id: string
  name: string
  kind: string
  sourceCode: string
  status: 'connected' | 'error' | 'available'
  lastSyncAt: string | null
  missedRuns: number
  detail: string
  error: string | null
}
export type MeasureReading = { date: string; value: number }
export type StrategyMeasure = {
  id: string
  name: string
  owner: string
  measureType: 'KR' | 'KPI' | 'LEAD' | 'LAG'
  direction: 'INCREASE' | 'DECREASE' | 'MAINTAIN'
  unit: string
  start: number
  target: number
  current: number
  sourceId: string | null
  cadenceDays: number
  confidence: number
  guardrailThreshold: number | null
  guardrailBreached: boolean
  readings: MeasureReading[]
}

export type UseStrategyMeasuresReturn = {
  loading: boolean
  error: string | null
  sources: DataSource[]
  measures: StrategyMeasure[]
  reload: () => void
  postReading: (measureId: string, value: number, note: string, byName: string) => Promise<void>
  reconnectSource: (id: string) => Promise<void>
}

export function useStrategyMeasures(): UseStrategyMeasuresReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [sources, setSources] = useState<DataSource[]>([])
  const [measures, setMeasures] = useState<StrategyMeasure[]>([])
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
        await supabase.rpc('provision_strategy_signal_for_org', { p_org_id: orgId })
        const [srcRes, mRes, rRes] = await Promise.all([
          supabase.from('strategy_data_sources').select('*').order('name', { ascending: true }),
          supabase.from('strategy_measures').select('*').order('name', { ascending: true }),
          supabase.from('strategy_measure_readings').select('measure_id, reading_date, value').order('reading_date', { ascending: true }),
        ])
        if (cancelled) return
        for (const res of [srcRes, mRes, rRes]) if (res.error) throw res.error
        setSources(((srcRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), name: (r.name as string) ?? '', kind: (r.kind as string) ?? '', sourceCode: (r.source_code as string) ?? 'MANUAL',
          status: (r.status as DataSource['status']) || 'available', lastSyncAt: (r.last_sync_at as string) ?? null,
          missedRuns: (r.missed_runs as number) ?? 0, detail: (r.detail as string) ?? '', error: (r.error as string) ?? null,
        })))
        const readingsBy: Record<string, MeasureReading[]> = {}
        for (const r of (rRes.data as Record<string, unknown>[] | null) || []) {
          ;(readingsBy[r.measure_id as string] ||= []).push({ date: r.reading_date as string, value: Number(r.value) })
        }
        setMeasures(((mRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), name: (r.name as string) ?? '', owner: (r.owner_name as string) ?? '',
          measureType: (r.measure_type as StrategyMeasure['measureType']) || 'KPI', direction: (r.direction as StrategyMeasure['direction']) || 'INCREASE',
          unit: (r.unit as string) ?? '', start: Number(r.start_value ?? 0), target: Number(r.target_value ?? 0), current: Number(r.current_value ?? 0),
          sourceId: (r.source_id as string) ?? null, cadenceDays: (r.cadence_days as number) ?? 30, confidence: (r.confidence as number) ?? 3,
          guardrailThreshold: r.guardrail_threshold != null ? Number(r.guardrail_threshold) : null, guardrailBreached: Boolean(r.guardrail_breached),
          readings: readingsBy[String(r.id)] || [],
        })))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste målinger.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const postReading = useCallback<UseStrategyMeasuresReturn['postReading']>(
    async (measureId, value, note, byName) => {
      setMeasures((arr) => arr.map((m) => (m.id === measureId ? { ...m, current: value, readings: [...m.readings, { date: new Date().toISOString().slice(0, 10), value }] } : m)))
      if (!supabase || !orgId) return
      const [{ error: insErr }, { error: upErr }] = await Promise.all([
        supabase.from('strategy_measure_readings').insert({ organization_id: orgId, measure_id: measureId, value, note, posted_by_name: byName }),
        supabase.from('strategy_measures').update({ current_value: value }).eq('id', measureId),
      ])
      if (insErr || upErr) { setError((insErr || upErr)?.message ?? 'Kunne ikke lagre måling.'); reload() }
    },
    [supabase, orgId, reload],
  )

  const reconnectSource = useCallback<UseStrategyMeasuresReturn['reconnectSource']>(
    async (id) => {
      const now = new Date().toISOString()
      setSources((arr) => arr.map((s) => (s.id === id ? { ...s, status: 'connected', error: null, missedRuns: 0, lastSyncAt: now } : s)))
      if (!supabase) return
      const { error: e } = await supabase.from('strategy_data_sources').update({ status: 'connected', error: null, missed_runs: 0, last_sync_at: now }).eq('id', id)
      if (e) { setError(e.message); reload() }
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({ loading, error, sources, measures, reload, postReading, reconnectSource }),
    [loading, error, sources, measures, reload, postReading, reconnectSource],
  )
}
