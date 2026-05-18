// System-report-renderer for the Internkontroll Gap Analysis page.
//
// Dispatched from <SystemReport /> when the row's scopeId is
// 'internkontroll' and its slug is 'internkontroll-gap-analysis'.
// Shows the full paragraphs × 5 modules heatmap plus a compact KPI
// strip. Cell drill-down navigates to the corresponding module's
// analyse page filtered by ?law_ref=… (Phase 1) — Phase 2 will swap
// the navigation for an in-page paragraph inspector slide-over.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModuleAnalyticsDashboard } from '../../../components/module/ModuleAnalyticsDashboard'
import { getDashboardScope } from '../../../lib/dashboards/dashboardRegistry'
import type { SystemReportRow } from '../../../lib/dashboards/useSystemReport'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../../lib/dashboards/dashboardFilters'
import { useInternkontrollDatasets } from './useInternkontrollDatasets'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  GAP_MODULE_COLUMNS,
  GAP_MODULE_ROUTES,
} from './frameworkParagraphs'
import './internkontrollDashboardScope'

export function InternkontrollGapSystemReport({
  row,
  breadcrumb,
}: {
  row: SystemReportRow
  breadcrumb?: { label: string; to?: string }[]
}) {
  const navigate = useNavigate()
  const [sessionFilters, setSessionFilters] = useState<DashboardFilter[]>(row.filters)
  const { datasets, loading } = useInternkontrollDatasets(sessionFilters)
  const accent = getDashboardScope(row.scopeId)?.accent

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'framework',
        label: 'Regelverk',
        description: 'Velger hvilket regelverk gap-matrisen viser.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () =>
          FRAMEWORK_IDS.map((id) => ({
            id,
            label: `${FRAMEWORKS[id].shortLabel} — ${FRAMEWORKS[id].fullLabel}`,
          })),
      },
    ],
    [],
  )

  return (
    <ModuleAnalyticsDashboard
      accent={accent}
      breadcrumb={breadcrumb}
      title={row.name}
      description={row.description ?? undefined}
      layout={row.layout}
      datasets={datasets as unknown as Record<string, unknown>}
      loading={loading}
      filters={sessionFilters}
      dimensions={dimensions}
      onFiltersChange={setSessionFilters}
      onDrillDown={(e) => {
        if (e.dimensionId !== 'gap_cell') return
        // segmentLabel is encoded `${paragraph}::${moduleLabel}` by the
        // heatmap renderer.
        const [paragraph, moduleLabel] = e.segmentLabel.split('::')
        if (!paragraph || !moduleLabel) return
        const col = GAP_MODULE_COLUMNS.find((c) => c.label === moduleLabel)
        if (!col) return
        const route = GAP_MODULE_ROUTES[col.id]
        navigate(`${route}?law_ref=${encodeURIComponent(paragraph)}`)
      }}
    />
  )
}
