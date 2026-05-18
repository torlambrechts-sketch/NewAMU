// ISO IMS analyse dashboard — composite view across all active ISO standards.
//
// Follows the same pattern as HmsOverviewPage: side-effect imports register
// the scope, useIsoImsDatasets computes the dataset map, ModuleAnalyticsDashboard
// renders the widget grid. useDashboardLayout persists layout + views.
//
// IMPORTANT: The side-effect import below is required — without it the
// iso_ims scope is silently unregistered at runtime.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useIsoImsDatasets } from './dashboards/useIsoImsDatasets'
import { ISO_IMS_SCOPE_ID } from './dashboards/isoImsDashboardScope'
// Side-effect: registers the iso_ims scope. Must not be removed.
import './dashboards/isoImsDashboardScope'
import type { ReportModule } from '../../types/reportBuilder'

export function IsoImsAnalysePage() {
  const navigate = useNavigate()
  const { supabase } = useOrgSetupContext()

  const isoDs = useIsoImsDatasets()
  const dashboard = useDashboardLayout({ supabase, scopeId: ISO_IMS_SCOPE_ID })

  const datasets = useMemo<Record<string, unknown>>(() => {
    const { loading: _loading, ...rest } = isoDs
    return rest as Record<string, unknown>
  }, [isoDs])

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

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const editChrome = useDashboardEditChrome({
    scopeId: ISO_IMS_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

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
        accent={getDashboardScope(ISO_IMS_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Arbeidsflate', to: '/' },
          { label: 'ISO IMS', to: '/iso/analyse' },
          { label: 'Analyse' },
        ]}
        title="ISO IMS — Analyse"
        description="Gap-score, SoA-implementering og åpne tiltak på tvers av alle aktive ISO-standarder."
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
            <Link
              to="/iso/innstillinger"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Innstillinger
            </Link>
            <Link
              to="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey) {
                  e.preventDefault()
                  navigate('/')
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={ISO_IMS_SCOPE_ID}
              scopeLabel="ISO IMS"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={isoDs.loading || dashboard.loading}
        error={dashboard.error}
        emptyState={
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-3 text-sm text-neutral-600">
              Ingen widgets i dette oppsettet ennå. Bruk «Legg til widget» for å bygge en oversikt.
            </p>
          </div>
        }
        onEdit={undefined}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onResize={(w, next) =>
          void dashboard.saveLayout(
            dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)),
          )
        }
        {...editChrome.moduleProps}
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
        scopeId={ISO_IMS_SCOPE_ID}
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
