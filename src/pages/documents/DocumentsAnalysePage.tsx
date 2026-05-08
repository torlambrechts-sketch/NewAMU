// Documents analytics page (documents-parity §T2). Fifth concrete consumer
// of ModuleAnalyticsDashboard, after compliance / survey / tasks /
// learning. Owns dataset compute (via useDocumentsDatasets) and hands the
// result to the runtime + the registered documents scope.
//
// Filter dimensions for T3: Space / Template / Status / Retention / Eier /
// Periode. Drill-down (T4) lights up donut + bar segments.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useDocuments } from '../../hooks/useDocuments'
import {
  DOCUMENTS_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/documentsDashboardScope'
import './dashboards/documentsDashboardScope'
import {
  RETENTION_OPTIONS,
  STATUS_OPTIONS,
  useDocumentsDatasets,
} from './dashboards/useDocumentsDatasets'
import { makeFilter } from '../../lib/dashboards/dashboardFilters'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../components/reports/ReportModuleWidget'
import type { ReportModule } from '../../types/reportBuilder'

export function DocumentsAnalysePage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const docs = useDocuments()

  const dashboard = useDashboardLayout({ supabase, scopeId: DOCUMENTS_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'space',
        label: 'Plass',
        description: 'Filtrer på en eller flere plasser (wiki-spaces).',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => docs.spaces.map((s) => ({ id: s.id, label: s.title })),
      },
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på maler — krever at sider lagrer mal-id (T8 follow-up).',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          docs.orgCustomTemplates.map((t) => ({ id: t.id, label: t.label })),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Kladd, publisert eller arkivert.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'retention',
        label: 'Retention',
        description: 'Sider med revisjon som er forfalt eller forfaller snart.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () => RETENTION_OPTIONS.map((r) => ({ id: r.id, label: r.label })),
      },
      {
        id: 'owner',
        label: 'Eier',
        description: 'Filtrer på sideforfatter (matcher wiki_pages.author_id).',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på sist oppdatert — gjelder publiseringsstrømmen.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [docs.spaces, docs.orgCustomTemplates, orgSetup.members],
  )

  const accessRequestsOpen = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending').length,
    [docs.wikiAccessRequests],
  )

  // Cross-module regulation filter (category-architecture §T8).
  // Resolve via wiki_spaces.regulation_id (filled by the T2 backfill).
  const { isActive: isRegulationActive } = useRegulationFilter()
  const filteredPages = useMemo(() => {
    const spaceRegById = new Map(docs.spaces.map((s) => [s.id, s.regulationId ?? null] as const))
    return docs.pages.filter((p) => isRegulationActive(spaceRegById.get(p.spaceId) ?? null))
  }, [docs.pages, docs.spaces, isRegulationActive])

  const datasets = useDocumentsDatasets({
    filters: dashboard.filters,
    pages: filteredPages,
    spaces: docs.spaces,
    orgCustomTemplates: docs.orgCustomTemplates,
    accessRequestsOpen,
  })

  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey] as Record<string, unknown> | undefined
          const keys = ds && typeof ds === 'object' ? Object.keys(ds) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const empty =
    docs.pages.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen sider å analysere ennå. Opprett en plass og publiser noen sider for å se tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const widgetControlSlot = (m: ReportModule) => (
    <DashboardWidgetMenu
      ariaLabel={`Meny for widget ${m.title}`}
      onEdit={() => setEditWidget(m)}
      onDuplicate={() => {
        const dup = { ...m, id: freshId('w'), title: `${m.title} (kopi)` }
        void dashboard.saveLayout([...dashboard.layout, dup])
      }}
      onExportCsv={() => downloadCsv(widgetToCsv(m, datasets))}
      onRemove={() => {
        if (!window.confirm(`Fjerne widgeten «${m.title}»?`)) return
        void dashboard.saveLayout(dashboard.layout.filter((x) => x.id !== m.id))
      }}
    />
  )

  // Drill-down (T4): translate a clicked segment label → option id for
  // the matching dimension, then toggle a chip on the active filter set.
  const handleDrillDown = (e: DrillDownEvent) => {
    let resolvedId: string | null = null
    if (e.dimensionId === 'status') {
      const opt = STATUS_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'space') {
      const sp = docs.spaces.find((s) => s.title === e.segmentLabel)
      resolvedId = sp?.id ?? null
    } else if (e.dimensionId === 'template') {
      const t = docs.orgCustomTemplates.find((x) => x.label === e.segmentLabel)
      resolvedId = t?.id ?? null
    } else if (e.dimensionId === 'retention') {
      const opt = RETENTION_OPTIONS.find((r) => r.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    }
    if (!resolvedId) return
    const existing = dashboard.filters.find(
      (f) => f.dimensionId === e.dimensionId && f.value === resolvedId,
    )
    const next = existing
      ? dashboard.filters.filter((f) => f.id !== existing.id)
      : [...dashboard.filters, makeFilter(e.dimensionId, 'is', resolvedId)]
    void dashboard.saveFilters(next)
  }

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(DOCUMENTS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Dokumenter', to: '/documents' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, retention, tilgangsforespørsler og malbruk på tvers av wiki-modulen."
        titleChooser={
          <DashboardChooser
            available={dashboard.available}
            activeRow={dashboard.row}
            isDefault={dashboard.isDefault}
            currentUserId={dashboard.currentUserId}
            onSelect={dashboard.selectLayout}
            onSaveAs={dashboard.saveAs}
            onRename={dashboard.renameActive}
            onDelete={dashboard.deleteActive}
            onMarkDefault={dashboard.markActiveDefault}
          />
        }
        headerActions={
          <Link
            to="/documents"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                navigate('/documents')
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
        layout={layout}
        datasets={datasets}
        loading={docs.loading || dashboard.loading}
        error={docs.error ?? dashboard.error}
        emptyState={empty}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onDrillDown={handleDrillDown}
        filters={dashboard.filters}
        dimensions={dimensions}
        onFiltersChange={(next) => void dashboard.saveFilters(next)}
      />

      <DashboardEditLayoutPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        layout={dashboard.layout}
        onSave={(next) => dashboard.saveLayout(next)}
        onResetToDefault={dashboard.isDefault ? undefined : () => dashboard.resetToDefault()}
      />

      <DashboardAddWidgetPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scopeId={DOCUMENTS_DASHBOARD_SCOPE_ID}
        onAdd={(widget: ReportModule) => dashboard.saveLayout([...dashboard.layout, widget])}
      />

      <DashboardEditWidgetPanel
        open={editWidget !== null}
        widget={editWidget}
        datasets={datasets}
        onClose={() => setEditWidget(null)}
        onDuplicate={(w) => {
          const dup = { ...w, id: freshId('w'), title: `${w.title} (kopi)` }
          void dashboard.saveLayout([...dashboard.layout, dup])
        }}
        onRemove={(w) => {
          void dashboard.saveLayout(dashboard.layout.filter((m) => m.id !== w.id))
        }}
        onSave={async (next) => {
          const ok = await dashboard.saveLayout(
            dashboard.layout.map((m) => (m.id === next.id ? next : m)),
          )
          return ok
        }}
        compatibleKinds={editWidget ? defaultCompatibleKinds(editWidget.kind) : undefined}
      />
    </>
  )
}
