import type { ReactNode } from 'react'
import { ReportModulesGrid, type ReportModuleLayoutMode } from '../reports/ReportModuleWidget'
import type { ReportModule } from '../../types/reportBuilder'

/**
 * Dashboard chart grid for module / group frontpages.
 *
 * Wraps the shared `ReportModulesGrid` — the same grid used on the platform
 * admin **layout → rapportering** designer — so every group frontpage shares
 * one renderer for KPI / bar / donut / table widgets.
 *
 * The `datasets` parameter is a map from `datasetKey → resolved data`. Use
 * `buildReportDatasets()` from `src/lib/reportDatasets` to build it from your
 * module hooks, or pass a custom `datasets` object keyed on
 * `ReportDatasetKey`.
 *
 * When you only need ad-hoc donut / list cards (not the report-builder
 * datasets), use `ModuleDonutCard` / `ModuleFilledListCard` directly.
 *
 * @example
 * ```tsx
 * <ModuleDashboardGrid
 *   modules={[
 *     { id: 'open', kind: 'kpi', datasetKey: 'ik_summary', title: 'Åpne tiltak', valuePath: 'open' },
 *     { id: 'status', kind: 'donut', datasetKey: 'tasks_by_status', title: 'Tiltak per status', segmentsPath: '' },
 *   ]}
 *   datasets={datasets}
 *   accent="#1a3d32"
 * />
 * ```
 */
export interface ModuleDashboardGridProps {
  modules: ReportModule[]
  datasets: Record<string, unknown>
  /** Accent colour used on KPI cards — defaults to forest green. */
  accent?: string
  layoutMode?: ReportModuleLayoutMode
  /** Text shown inside widgets when the dataset is empty. */
  emptyLabel?: string
  /** Raw extra content to render after the grid (e.g. link to full report). */
  footer?: ReactNode
}

export function ModuleDashboardGrid({
  modules,
  datasets,
  accent = '#1a3d32',
  layoutMode = 'grid2',
  emptyLabel,
  footer,
}: ModuleDashboardGridProps) {
  return (
    <div className="space-y-3">
      <ReportModulesGrid
        modules={modules}
        datasets={datasets}
        accent={accent}
        layoutMode={layoutMode}
        emptyLabel={emptyLabel}
      />
      {footer ? <div>{footer}</div> : null}
    </div>
  )
}
