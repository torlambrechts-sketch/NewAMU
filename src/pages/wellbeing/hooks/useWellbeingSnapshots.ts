// useWellbeingSnapshots — laster historikk + tar nye snapshot via RPC.
//
// Snapshot-kadens: én rad per kalendermåned (YYYY-MM). RPC-en gjør
// UPSERT, så å kalle den flere ganger samme måned er ufarlig — siste
// kall vinner.
//
// Hooken:
//   1. laster opp til 24 måneders historikk
//   2. tilbyr `captureNow(scores, weights, signals)` som mutator
//   3. ekspponerer en pre-formatert tidsserie `series` for line-widget
//   4. tilbyr `maybeAutoCapture` som idempotent kall — bruk fra en
//      effekt etter at akse-skårene er beregnet for å auto-fylle
//      inneværende måned første gang siden åpnes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'
import type {
  WellbeingAxisKey,
  WellbeingIndexWeights,
} from '../dashboards/useWorkerWellbeingDatasets'

export type WellbeingSnapshotRow = {
  id: string
  organization_id: string
  period_key: string
  captured_at: string
  index_value: number | null
  trygghet_score: number | null
  trivsel_score: number | null
  medvirkning_score: number | null
  mestring_score: number | null
  weights: WellbeingIndexWeights
  source_signals: Record<string, unknown>
  computed_by: 'client' | 'server'
}

export type WellbeingScoreSnapshot = {
  index: number | null
  trygghet: number | null
  trivsel: number | null
  medvirkning: number | null
  mestring: number | null
}

export type WellbeingSnapshotPoint = {
  /** Locale-formatted month label, e.g. "mai 26" */
  x: string
  /** Index value 0..100, or 0 when missing (line widgets don't handle null). */
  y: number
  /** YYYY-MM key — preserves original data for debugging */
  periodKey: string
  /** True when the y is a real captured value, false when implied/missing */
  hasData: boolean
}

const HISTORY_MONTHS = 12

function periodKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
}

export function useWellbeingSnapshots() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [snapshots, setSnapshots] = useState<WellbeingSnapshotRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stabil «nå» — settes ved første mount, brukes til auto-capture
  // beslutning og månedsfremstilling. Forhindrer Date.now() i useMemo.
  const [nowMs] = useState(() => Date.now())
  const currentPeriodKey = useMemo(() => periodKeyFor(new Date(nowMs)), [nowMs])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('wellbeing_index_snapshots')
        .select('*')
        .eq('organization_id', orgId)
        .order('period_key', { ascending: false })
        .limit(36)
      if (e) throw e
      setSnapshots(((data as WellbeingSnapshotRow[] | null) ?? []))
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const captureNow = useCallback(
    async (
      scores: WellbeingScoreSnapshot,
      weights: WellbeingIndexWeights,
      sourceSignals: Record<string, unknown>,
    ): Promise<WellbeingSnapshotRow | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      const { data, error: e } = await supabase.rpc('wellbeing_capture_index_snapshot', {
        p_org_id: orgId,
        p_period_key: currentPeriodKey,
        p_index_value: scores.index,
        p_trygghet: scores.trygghet,
        p_trivsel: scores.trivsel,
        p_medvirkning: scores.medvirkning,
        p_mestring: scores.mestring,
        p_weights: weights as unknown as Record<string, number>,
        p_source_signals: sourceSignals,
      })
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
      const row = data as WellbeingSnapshotRow | null
      if (row) {
        setSnapshots((prev) => {
          const without = prev.filter((s) => s.period_key !== row.period_key)
          return [row, ...without].sort((a, b) => b.period_key.localeCompare(a.period_key))
        })
      }
      return row
    },
    [supabase, orgId, currentPeriodKey],
  )

  /**
   * Idempotent capture: kalles trygt ved hver page-mount. Tar bare
   * snapshot hvis (a) det ikke finnes en for inneværende måned, eller
   * (b) det eksisterende snapshotet er eldre enn 24 timer (rolling
   * refresh innen samme måned). Returnerer raden hvis vi fanget en,
   * null hvis vi hoppet over.
   */
  const maybeAutoCapture = useCallback(
    async (
      scores: WellbeingScoreSnapshot,
      weights: WellbeingIndexWeights,
      sourceSignals: Record<string, unknown>,
    ): Promise<WellbeingSnapshotRow | null> => {
      if (scores.index == null) return null // ikke nok data til en meningsfylt snapshot
      const existing = snapshots.find((s) => s.period_key === currentPeriodKey)
      if (existing) {
        const ageMs = nowMs - new Date(existing.captured_at).getTime()
        if (ageMs < 1000 * 60 * 60 * 24) return null
      }
      return captureNow(scores, weights, sourceSignals)
    },
    [snapshots, currentPeriodKey, captureNow, nowMs],
  )

  // Tidsserie for line-widget: 12 måneder bakover, månedlig kadens.
  // Tom måneder fylles med 0 + hasData=false så widgets kan styre
  // visning. Snapshots sorteres voksende (eldste først) for chart-rendring.
  const series: WellbeingSnapshotPoint[] = useMemo(() => {
    const byKey = new Map(snapshots.map((s) => [s.period_key, s]))
    const out: WellbeingSnapshotPoint[] = []
    const anchor = new Date(nowMs)
    for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
      const key = periodKeyFor(d)
      const snap = byKey.get(key)
      out.push({
        x: monthLabel(d),
        y: snap?.index_value ?? 0,
        periodKey: key,
        hasData: snap?.index_value != null,
      })
    }
    return out
  }, [snapshots, nowMs])

  const latest = snapshots[0] ?? null
  const hasCurrentMonth = snapshots.some((s) => s.period_key === currentPeriodKey)

  const axisSeries: Record<WellbeingAxisKey, WellbeingSnapshotPoint[]> = useMemo(() => {
    const byKey = new Map(snapshots.map((s) => [s.period_key, s]))
    const buildOne = (pick: (r: WellbeingSnapshotRow) => number | null): WellbeingSnapshotPoint[] => {
      const anchor = new Date(nowMs)
      const out: WellbeingSnapshotPoint[] = []
      for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
        const key = periodKeyFor(d)
        const snap = byKey.get(key)
        const v = snap ? pick(snap) : null
        out.push({ x: monthLabel(d), y: v ?? 0, periodKey: key, hasData: v != null })
      }
      return out
    }
    return {
      trygghet: buildOne((r) => r.trygghet_score),
      trivsel: buildOne((r) => r.trivsel_score),
      medvirkning: buildOne((r) => r.medvirkning_score),
      mestring: buildOne((r) => r.mestring_score),
    }
  }, [snapshots, nowMs])

  return {
    loading,
    error,
    snapshots,
    series,
    axisSeries,
    latest,
    hasCurrentMonth,
    currentPeriodKey,
    captureNow,
    maybeAutoCapture,
    reload: load,
  }
}
