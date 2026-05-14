// System-report-renderer for the 'regelverk_coverage' scope.
//
// Plugged into the generic <SystemReport /> dispatcher. The dispatcher
// resolves a system row (kind=report_template, is_system=true) and calls
// this component for any row whose scope_id is 'regelverk_coverage'.
//
// Layout is locked — system rows are immutable from the application's
// perspective. Filters, however, are session-local: the row's baked-in
// `filters` array seeds the initial state, but the user can refine via
// the filter bar (regelverk / kategori / rolle …). Refinements never
// persist back to the system row.

import { useMemo, useState } from 'react'
import { ModuleAnalyticsDashboard } from '../../../components/module/ModuleAnalyticsDashboard'
import { getDashboardScope } from '../../../lib/dashboards/dashboardRegistry'
import type { SystemReportRow } from '../../../lib/dashboards/useSystemReport'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import { buildRegelverkDimensions, useRegelverkDatasets } from './useRegelverkDatasets'
import { RegelverkCoverageSlideOver } from './RegelverkCoverageSlideOver'
import './regelverkCoverageDashboardScope'

export function RegelverkCoverageSystemReport({
  row,
  breadcrumb,
}: {
  row: SystemReportRow
  /** Optional breadcrumb passed through to the page shell. */
  breadcrumb?: { label: string; to?: string }[]
}) {
  // Session-local filter state seeded from the row's baked-in filters.
  // Edits stay in component state — they don't write back to the
  // immutable system row.
  const [sessionFilters, setSessionFilters] = useState<DashboardFilter[]>(row.filters)
  const { datasets, loading, enriched, categories } = useRegelverkDatasets(sessionFilters)
  const dimensions = useMemo(() => buildRegelverkDimensions(categories), [categories])
  const [openLawRef, setOpenLawRef] = useState<string | null>(null)

  // Fyll inn seriesKeys for søyle-widgets der det er tomt — speiler
  // det vanlige dashbordet slik at den lokkede rapporten ser identisk
  // ut når orgen ikke har endret default-layouten.
  const layout = useMemo(
    () =>
      row.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey] as Record<string, unknown> | undefined
          const keys = ds && typeof ds === 'object' ? Object.keys(ds) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [row.layout, datasets],
  )

  const accent = getDashboardScope(row.scopeId)?.accent
  const openReq =
    openLawRef !== null ? enriched.find((r) => r.lawRef === openLawRef) ?? null : null

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={accent}
        breadcrumb={breadcrumb}
        title={row.name}
        description={row.description ?? undefined}
        layout={layout}
        datasets={datasets}
        loading={loading}
        // Layouten er lokket: ingen edit/add/resize/widget-meny. Filtre
        // er åpne for justering per økt; drill-down fungerer som vanlig.
        onDrillDown={(e) => {
          if (e.dimensionId === 'requirement') {
            setOpenLawRef(e.segmentLabel)
          }
        }}
        filters={sessionFilters}
        dimensions={dimensions}
        onFiltersChange={setSessionFilters}
      />

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </>
  )
}
