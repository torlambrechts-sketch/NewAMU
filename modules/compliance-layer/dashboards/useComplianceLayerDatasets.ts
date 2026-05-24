// useComplianceLayerDatasets — compute the seven datasets registered by
// complianceLayerScope.ts. Reads from internal_controls +
// internal_control_status_v + internal_control_executions +
// internal_control_clauses → aggregates client-side.
//
// Matches the signature the dashboard registry expects when used via
// `ModuleAnalyticsDashboard` (or composed into a cross-scope host like
// hms_overview).

import { useMemo } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useControlClauses } from '../useControlClauses'
import { useControlEvidence } from '../useControlEvidence'
import { useInternalControls } from '../useInternalControls'
import type {
  ControlFamily,
  ControlStatusLabel,
  ControlStatusViewRow,
  InternalControlRow,
} from '../types'

type DatasetMap = Record<string, unknown>

const STATUS_LABELS: Record<ControlStatusLabel, string> = {
  on_track: 'På sporet',
  due_soon: 'Forfaller snart',
  overdue: 'Forfalt',
  never_executed: 'Aldri utført',
  retired: 'Pensjonert',
}

const FAMILY_LABELS: Record<ControlFamily, string> = {
  preventive: 'Forebyggende',
  detective: 'Avdekkende',
  corrective: 'Korrigerende',
  directive: 'Styrende',
}

function bucketByMonth(rows: { occurred_at: string }[]): {
  x: string
  y: number
}[] {
  const buckets = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.occurred_at)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([x, y]) => ({ x, y }))
}

export function useComplianceLayerDatasets(): {
  loading: boolean
  error: string | null
  datasets: DatasetMap
} {
  const { supabase } = useOrgSetupContext()

  const {
    controls,
    status,
    loading: cLoading,
    error: cError,
  } = useInternalControls({ supabase })
  const {
    junctions,
    clausesById,
    loading: jLoading,
    error: jError,
  } = useControlClauses({ supabase })
  const {
    executions,
    loading: eLoading,
    error: eError,
  } = useControlEvidence({ supabase, limit: 5000 })

  const datasets = useMemo<DatasetMap>(() => {
    // 1. KPI summary
    const kpi = {
      total: controls.length,
      active: controls.filter((c) => c.is_active && c.status !== 'retired').length,
      overdue: status.filter((s) => s.status_label === 'overdue').length,
      due_soon: status.filter((s) => s.status_label === 'due_soon').length,
      on_track: status.filter((s) => s.status_label === 'on_track').length,
      never_executed: status.filter((s) => s.status_label === 'never_executed')
        .length,
    }

    // 2. Status distribution (segments)
    const statusDistribution: Record<string, number> = {}
    for (const sv of status) {
      const label = STATUS_LABELS[sv.status_label]
      statusDistribution[label] = (statusDistribution[label] ?? 0) + 1
    }

    // 3. By regulation (primary coverage_level only)
    const regulationCounts: Record<string, Set<string>> = {}
    for (const j of junctions) {
      if (j.coverage_level !== 'primary') continue
      const cl = clausesById[j.clause_id]
      if (!cl) continue
      const reg = cl.regulation_id
      if (!regulationCounts[reg]) regulationCounts[reg] = new Set()
      regulationCounts[reg].add(j.control_id)
    }
    const byRegulation: Record<string, number> = {}
    for (const [reg, set] of Object.entries(regulationCounts)) {
      byRegulation[reg.toUpperCase()] = set.size
    }

    // 4. By control family
    const byFamily: Record<string, number> = {}
    for (const c of controls) {
      const label = FAMILY_LABELS[c.control_family]
      byFamily[label] = (byFamily[label] ?? 0) + 1
    }

    // 5. Executions over time (series)
    const executionsOverTime = bucketByMonth(executions)

    // 6. Overdue table (rows)
    const overdueRows = status
      .filter((s) => s.status_label === 'overdue')
      .map<Record<string, unknown>>((s) => {
        const c = controls.find((x) => x.id === s.control_id) as
          | InternalControlRow
          | undefined
        return {
          navn: c?.name ?? '(uten navn)',
          ansvarlig: c?.owner_role ?? '—',
          frekvens: c?.frequency_hint ?? 'ad_hoc',
          sist_utfort: s.last_occurred_at
            ? new Date(s.last_occurred_at).toLocaleDateString('nb-NO')
            : 'aldri',
          frist: s.next_due_at
            ? new Date(s.next_due_at).toLocaleDateString('nb-NO')
            : '—',
        }
      })

    // 7. KPI summary previous period (for comparison) — compute against
    // executions older than 12 months for a YoY signal.
    const prevCutoff = new Date()
    prevCutoff.setMonth(prevCutoff.getMonth() - 12)
    const prevKpi = {
      total: kpi.total,
      active: kpi.active,
      overdue: status.filter(
        (s) =>
          s.last_occurred_at !== null &&
          new Date(s.last_occurred_at) < prevCutoff,
      ).length,
      due_soon: 0,
      on_track: 0,
      never_executed: 0,
    }

    return {
      controls_kpi_summary: kpi,
      controls_status_distribution: statusDistribution,
      controls_by_regulation: byRegulation,
      controls_by_family: byFamily,
      executions_over_time: executionsOverTime,
      controls_overdue_table: overdueRows,
      controls_kpi_summary_prev: prevKpi,
    }
  }, [controls, status, junctions, clausesById, executions])

  const loading = cLoading || jLoading || eLoading
  const error = cError ?? jError ?? eError

  return { loading, error, datasets }
}

// Helper used by tooling — strongly typed status view aggregation.
export function summariseStatus(status: ControlStatusViewRow[]): {
  total: number
  byLabel: Record<ControlStatusLabel, number>
} {
  const byLabel: Record<ControlStatusLabel, number> = {
    on_track: 0,
    due_soon: 0,
    overdue: 0,
    never_executed: 0,
    retired: 0,
  }
  for (const s of status) byLabel[s.status_label] += 1
  return { total: status.length, byLabel }
}
