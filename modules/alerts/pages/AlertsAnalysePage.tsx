// Varslinger — analyse page. Mounts ModuleAnalyticsDashboard with the
// `alerts` scope. Datasets are computed page-side via useAlertsDatasets.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../../src/components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../../src/components/module/dashboard/DashboardChooser'
import { defaultCompatibleKinds } from '../../../src/components/module/dashboard/dashboardWidgetKinds'
import { downloadCsv, widgetToCsv } from '../../../src/lib/reports/widgetCsv'
import { useDashboardLayout } from '../../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../../src/lib/dashboards/dashboardRegistry'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useAlerts } from '../useAlerts'
import { ALERTS_DASHBOARD_SCOPE_ID } from '../dashboards/alertsDashboardScope'
import '../dashboards/alertsDashboardScope'
import { useAlertsDatasets } from '../dashboards/useAlertsDatasets'
import {
  ALERT_KIND_LABEL,
  ALERT_STATUS_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_ANONYMITY_LABEL,
} from '../alertsLabels'
import type { DashboardDimension } from '../../../src/lib/dashboards/dashboardFilters'
import type { ReportModule } from '../../../src/types/reportBuilder'

export function AlertsAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const alerts = useAlerts()
  const dashboard = useDashboardLayout({ supabase, scopeId: ALERTS_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'kind', label: 'Type', description: 'Filtrer på sakstype.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => Object.entries(ALERT_KIND_LABEL).map(([id, label]) => ({ id, label })),
      },
      {
        id: 'template', label: 'Mal', description: 'Filtrer på mal.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => alerts.resolvedTemplates.map((t) => ({ id: t.id, label: t.name })),
      },
      {
        id: 'category', label: 'Kategori', description: 'Filtrer på kategori.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => alerts.categories.map((c) => ({ id: c.id, label: c.name })),
      },
      {
        id: 'status', label: 'Status', description: 'Filtrer på status.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => Object.entries(ALERT_STATUS_LABEL).map(([id, label]) => ({ id, label })),
      },
      {
        id: 'severity', label: 'Alvorlighet', description: 'Filtrer på alvorlighetsgrad.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => Object.entries(ALERT_SEVERITY_LABEL).map(([id, label]) => ({ id, label })),
      },
      {
        id: 'anonymity', label: 'Anonymitet', description: 'Filtrer på anonymitetsnivå.',
        kind: 'enum', defaultOperator: 'in',
        loadOptions: () => Object.entries(ALERT_ANONYMITY_LABEL).map(([id, label]) => ({ id, label })),
      },
      {
        id: 'location', label: 'Lokasjon', kind: 'enum', defaultOperator: 'in',
        loadOptions: () => orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department', label: 'Avdeling', kind: 'enum', defaultOperator: 'in',
        loadOptions: () => orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'date', label: 'Periode', description: 'Filter på mottakstidspunkt.',
        kind: 'date_range', defaultOperator: 'between',
      },
    ],
    [alerts.resolvedTemplates, alerts.categories, orgSetup.locations, orgSetup.departments]
  )

  const datasets = useAlertsDatasets({
    filters: dashboard.filters,
    cases: alerts.cases,
    templates: alerts.systemTemplates,
    categories: alerts.categories,
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
    [dashboard.layout, datasets]
  )

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: ALERTS_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const empty = alerts.cases.length === 0 ? (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
      <p className="mt-3 text-sm text-neutral-600">Ingen saker å analysere ennå.</p>
    </div>
  ) : null

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

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(ALERTS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[{ label: 'HMS' }, { label: 'Varslinger', to: '/alerts' }, { label: 'Analyse' }]}
        title="Analyse"
        description="Volum, etterlevelse, anonymitet og alvorlighet på tvers av alle varslinger."
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
          <div className="flex flex-wrap items-center gap-2">
            {editChrome.toggleButton}
            <Link to="/alerts"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50">
              <ArrowLeft className="h-4 w-4" /> Tilbake
            </Link>
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={alerts.loading || dashboard.loading}
        error={alerts.error ?? dashboard.error}
        emptyState={empty}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onResize={(w, next) =>
          void dashboard.saveLayout(dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)))
        }
        {...editChrome.moduleProps}
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
        scopeId={ALERTS_DASHBOARD_SCOPE_ID}
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
          const ok = await dashboard.saveLayout(dashboard.layout.map((m) => (m.id === next.id ? next : m)))
          return ok
        }}
        compatibleKinds={editWidget ? defaultCompatibleKinds(editWidget.kind) : undefined}
      />
    </>
  )
}
