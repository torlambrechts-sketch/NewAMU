// System-report-renderer for the Internkontroll Compliance Dashboard.
//
// Dispatched from <SystemReport /> when the row's scopeId is
// 'internkontroll' and its slug is 'internkontroll-compliance-dashboard'.
// Renders the locked KPI strip + framework coverage bar + evidence
// table layout seeded via migration. Layout is immutable; filters are
// session-local (framework chip drives the framework-coverage roll-up
// and the dashboard's "scope" reads).

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
import { FRAMEWORKS, FRAMEWORK_IDS, type FrameworkId } from './frameworkParagraphs'
import { ShareWithAuditorButton } from './ShareWithAuditorButton'
import './internkontrollDashboardScope'

// Reverse-lookup: bar-widget segment label ("AML", "IK-f", …) → framework id.
const FRAMEWORK_BY_LABEL: Record<string, FrameworkId> = Object.fromEntries(
  FRAMEWORK_IDS.map((id) => [FRAMEWORKS[id].shortLabel, id]),
) as Record<string, FrameworkId>

export function InternkontrollDashboardSystemReport({
  row,
  breadcrumb,
}: {
  row: SystemReportRow
  breadcrumb?: { label: string; to?: string }[]
}) {
  const navigate = useNavigate()
  const [sessionFilters, setSessionFilters] = useState<DashboardFilter[]>(row.filters)
  const { datasets, loading, framework } = useInternkontrollDatasets(sessionFilters)
  const accent = getDashboardScope(row.scopeId)?.accent

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'framework',
        label: 'Regelverk',
        description: 'Begrenser KPI-er og dekningsprosent til valgt regelverk.',
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

  // Fill in seriesKeys for bar widgets that ship empty — mirrors the
  // pattern used by HMS-oversikt and Regelverk-dekning.
  const layout = useMemo(
    () =>
      row.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey as keyof typeof datasets] as
            | Record<string, unknown>
            | undefined
          const keys = ds && typeof ds === 'object' ? Object.keys(ds) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [row.layout, datasets],
  )

  return (
    <ModuleAnalyticsDashboard
      accent={accent}
      breadcrumb={breadcrumb}
      title={row.name}
      description={row.description ?? undefined}
      layout={layout}
      datasets={datasets as unknown as Record<string, unknown>}
      loading={loading}
      filters={sessionFilters}
      dimensions={dimensions}
      onFiltersChange={setSessionFilters}
      headerActions={
        <div className="flex items-center gap-2">
          <a
            href={`/overview/internkontroll/plan?framework=${framework}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Plan & tidslinje
          </a>
          <ShareWithAuditorButton
            framework={framework}
            scopeLabel={row.name}
            snapshot={datasets as unknown as Record<string, unknown>}
            layout={layout}
          />
        </div>
      }
      onDrillDown={(e) => {
        if (e.dimensionId !== 'framework') return
        const id = FRAMEWORK_BY_LABEL[e.segmentLabel]
        if (id) navigate(`/overview/internkontroll/gaps?framework=${id}`)
      }}
    />
  )
}
