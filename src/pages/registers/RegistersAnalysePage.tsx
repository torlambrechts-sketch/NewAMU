// /registers/analyse — cross-cutting analyse page for the registers
// engine. Aggregates record-level KPIs across every enabled type.
//
// Per CLAUDE.md: side-effect imports the scope file so the dashboard
// registry knows about `registers` at module load.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useRegisters } from '../../hooks/useRegisters'
import {
  REGISTERS_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/registersDashboardScope'
import './dashboards/registersDashboardScope'
import { STATUS_OPTIONS, useRegistersDatasets } from './dashboards/useRegistersDatasets'
import { useAllRegisterRecords } from './dashboards/useAllRegisterRecords'
import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'

export function RegistersAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const dashboard = useDashboardLayout({
    supabase: orgSetup.supabase,
    scopeId: REGISTERS_DASHBOARD_SCOPE_ID,
  })

  // Fetch records across every enabled type. We don't use
  // useRegisterRecords here because it's per-type; the analyse page
  // wants the cross-type aggregate. Lightweight sql query.
  const allRecords = useAllRegisterRecords(orgSetup.supabase, orgSetup.organization?.id ?? null)

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'register_type',
        label: 'Registertype',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          registers.types
            .filter((t) => t.isEnabledForOrg)
            .map((t) => ({ id: t.id, label: t.resolvedName })),
      },
      {
        id: 'status',
        label: 'Status',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'regulation',
        label: 'Regelverk',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => {
          const seen = new Set<string>()
          for (const t of registers.types) for (const r of t.regulationIds) seen.add(r)
          return [...seen].sort().map((rid) => ({ id: rid, label: rid.toUpperCase() }))
        },
      },
      {
        id: 'category',
        label: 'Kategori',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          registers.categories.map((c) => ({ id: c.id, label: c.name })),
      },
    ],
    [registers.types, registers.categories],
  )

  const datasets = useRegistersDatasets({
    records: allRecords.records,
    types: registers.types,
    categories: registers.categories,
    filters: dashboard.filters,
  })

  // Hydrate bar widgets with empty seriesKeys from the live dataset.
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
    scopeId: REGISTERS_DASHBOARD_SCOPE_ID,
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
        accent={getDashboardScope(REGISTERS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[{ label: 'Register', to: '/registers' }, { label: 'Analyse' }]}
        title="Analyse"
        description="KPIer på tvers av alle aktive registertyper — gjennomgang-status, regelverk-dekning, og fordeling per kategori."
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
              to="/registers"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={REGISTERS_DASHBOARD_SCOPE_ID}
              scopeLabel="Register"
              datasets={datasets}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={registers.loading || allRecords.loading || dashboard.loading}
        error={registers.error ?? allRecords.error ?? dashboard.error}
        emptyState={
          allRecords.records.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
              <p className="mt-3 text-sm text-neutral-600">
                Ingen rader ennå. Opprett innholdet i en registertype for å se data her.
              </p>
            </div>
          ) : null
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
        scopeId={REGISTERS_DASHBOARD_SCOPE_ID}
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

