// useRiskDashboardRows — single entry point that returns the unified
// risk row array, regardless of whether the org has the P2 view
// installed.
//
// Strategy:
//   1. Query `risk_register_summary_v` first (P2 path).
//   2. If the view doesn't exist (migration not applied yet), fall
//      back to the P1 source loader and fold client-side.
//
// Callers (RiskAnalysePage, HmsOverviewPage) treat the result
// uniformly — they don't branch on which path produced the rows.

import { useMemo } from 'react'
import { foldSourcesToRows, type UnifiedRiskRow } from './useRiskDatasets'
import { useRiskSourceData } from './useRiskSourceData'
import { useRiskUnifiedRows } from './useRiskUnifiedRows'

export type RiskDashboardRowsState = {
  loading: boolean
  error: string | null
  rows: UnifiedRiskRow[]
  /** 'view' when P2 view served the data, 'source' for the P1 fallback. */
  path: 'view' | 'source'
}

export function useRiskDashboardRows(): RiskDashboardRowsState {
  const view = useRiskUnifiedRows()
  // The P1 loader is enabled only when the view path failed
  // (`viewAvailable` derives from the view's error signature). This
  // avoids paying for the five fallback queries on every render when
  // the migration is applied. The hook is still always mounted; only
  // the inner fetch is skipped.
  const source = useRiskSourceData({ enabled: !view.viewAvailable })

  // `path` is derived synchronously each render — no effect, no
  // race condition. `viewAvailable` starts `true` and flips to false
  // only when the view query returns a "relation does not exist"
  // error; until then we serve the view's rows even when empty.
  const usingView = view.viewAvailable

  const sourceRows = useMemo<UnifiedRiskRow[]>(
    () =>
      foldSourcesToRows({
        findings: source.findings,
        tasks: source.tasks,
        deviations: source.deviations,
        inspectionFindings: source.inspectionFindings,
        alerts: source.alerts,
      }),
    [source.findings, source.tasks, source.deviations, source.inspectionFindings, source.alerts],
  )

  if (usingView) {
    return {
      loading: view.loading,
      // Suppress the error when the view is available — transient
      // permissions / network errors shouldn't make the dashboard look
      // catastrophically broken.
      error: view.error && view.viewAvailable ? view.error : null,
      rows: view.rows,
      path: 'view',
    }
  }
  return {
    loading: source.loading,
    error: source.error,
    rows: sourceRows,
    path: 'source',
  }
}
