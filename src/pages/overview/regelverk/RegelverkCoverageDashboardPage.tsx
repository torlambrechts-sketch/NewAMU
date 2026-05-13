// Regelverk-dekning — drives nå av dashboard-engine.
//
// Bruker ModuleAnalyticsDashboard med scope 'regelverk_coverage'. Filter-
// chips erstatter den gamle cream-deep filterboksen (regelverk + kategori
// + rolle). Scorecard-kortene er nå en flyttbar widget; klikk på rad
// emitterer drill-down og åpner RegelverkCoverageSlideOver.

import { useMemo, useState } from 'react'
import { ModuleAnalyticsDashboard } from '../../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../../components/module/dashboard/DashboardChooser'
import { defaultCompatibleKinds } from '../../../components/module/dashboard/dashboardWidgetKinds'
import { downloadCsv, widgetToCsv } from '../../../lib/reports/widgetCsv'
import { useDashboardLayout } from '../../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../../lib/dashboards/freshId'
import { getDashboardScope } from '../../../lib/dashboards/dashboardRegistry'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID } from './regelverkCoverageDashboardScope'
import './regelverkCoverageDashboardScope'
import { buildRegelverkDimensions, useRegelverkDatasets } from './useRegelverkDatasets'
import { RegelverkCoverageSlideOver } from './RegelverkCoverageSlideOver'
import type { ReportModule } from '../../../types/reportBuilder'

export function RegelverkCoverageDashboardPage() {
  const { supabase } = useOrgSetupContext()
  const dashboard = useDashboardLayout({
    supabase,
    scopeId: REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID,
  })

  const { datasets, loading, enriched, categories } = useRegelverkDatasets(dashboard.filters)

  const dimensions = useMemo(() => buildRegelverkDimensions(categories), [categories])

  // Auto-fyll seriesKeys for søylediagrammer der seriesKeys er tomt
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
  const [openLawRef, setOpenLawRef] = useState<string | null>(null)

  const editChrome = useDashboardEditChrome({
    scopeId: REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID,
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

  const openReq =
    openLawRef !== null ? enriched.find((r) => r.lawRef === openLawRef) ?? null : null

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Arbeidsflate', to: '/' },
          { label: 'Oversikt', to: '/overview/hms' },
          { label: 'Regelverk-dekning' },
        ]}
        title="Regelverk-dekning"
        description="Velg regelverk, kategori og rolle for å se hvert krav og hvilke moduler som dekker det."
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
          <div className="flex flex-wrap items-center gap-2">{editChrome.toggleButton}</div>
        }
        layout={layout}
        datasets={datasets}
        loading={loading || dashboard.loading}
        error={dashboard.error}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onResize={(w, next) =>
          void dashboard.saveLayout(
            dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)),
          )
        }
        onDrillDown={(e) => {
          if (e.dimensionId === 'requirement') {
            setOpenLawRef(e.segmentLabel)
          }
        }}
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
        scopeId={REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID}
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

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </>
  )
}
