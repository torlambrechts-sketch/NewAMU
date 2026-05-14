// System-report-renderer for the 'regelverk_coverage' scope.
//
// Plugged into the generic <SystemReport /> dispatcher. The dispatcher
// resolves a system row (kind=report_template, is_system=true) and calls
// this component for any row whose scope_id is 'regelverk_coverage'.
//
// Filters baked into the row are passed straight to useRegelverkDatasets
// and are NOT exposed for editing — system reports are locked by contract.
// Drill-down still works: clicking a § in scorecard or bowtie opens the
// existing slide-over so the embedded report stays drop-in usable.

import { useMemo, useState } from 'react'
import { ModuleAnalyticsDashboard } from '../../../components/module/ModuleAnalyticsDashboard'
import { getDashboardScope } from '../../../lib/dashboards/dashboardRegistry'
import type { SystemReportRow } from '../../../lib/dashboards/useSystemReport'
import { useRegelverkDatasets } from './useRegelverkDatasets'
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
  const { datasets, loading, enriched } = useRegelverkDatasets(row.filters)
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
        // Lokket: ingen edit, ingen add, ingen filter-endring,
        // ingen resize, ingen widget-meny. Drill-down beholdes.
        readOnly
        onDrillDown={(e) => {
          if (e.dimensionId === 'requirement') {
            setOpenLawRef(e.segmentLabel)
          }
        }}
        filters={row.filters}
      />

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </>
  )
}
