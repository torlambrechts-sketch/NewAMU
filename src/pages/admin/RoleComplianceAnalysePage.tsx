// RoleComplianceAnalysePage — gjenbruker dashboard-engine for å vise
// fullstendig rolle-compliance-status. Niende konsumenten av
// ModuleAnalyticsDashboard.
//
// Layout, filtre, dashboard-bytte og widget-redigering kommer fra
// useDashboardLayout — samme runtime som læring/dokumenter/møter osv.

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID,
} from './dashboards/roleComplianceDashboardScope'
import './dashboards/roleComplianceDashboardScope'
import {
  buildRoleComplianceDimensions,
  useRoleComplianceDatasets,
} from './dashboards/useRoleComplianceDatasets'
import type { ReportModule } from '../../types/reportBuilder'

export function RoleComplianceAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const { supabase, organization } = orgSetup
  const dashboard = useDashboardLayout({ supabase, scopeId: ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID })

  // Last hjelpedata for filter-dimensjoner
  const [catalog, setCatalog] = useState<{ slug: string; label: string }[]>([])
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!supabase || !organization?.id) return
    void supabase
      .from('functional_roles')
      .select('slug, label')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setCatalog((data ?? []) as { slug: string; label: string }[]))
    void supabase
      .from('learning_courses')
      .select('id, title')
      .eq('organization_id', organization.id)
      .eq('status', 'published')
      .order('title')
      .then(({ data }) => setCourses((data ?? []) as { id: string; title: string }[]))
  }, [supabase, organization?.id])

  const dimensions = useMemo(
    () => buildRoleComplianceDimensions(catalog, courses),
    [catalog, courses],
  )

  const datasets = useRoleComplianceDatasets(dashboard.filters)

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
  const editChrome = useDashboardEditChrome({
    scopeId: ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID,
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

  const empty = catalog.length === 0 ? (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
      <ShieldCheck className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
      <p className="mt-3 text-sm text-neutral-600">
        Ingen rolle-tildelinger eller publiserte kurs ennå. Tildel funksjonelle roller under{' '}
        <strong>Funksjonelle roller</strong> og publiser opplæring under{' '}
        <strong>Læring</strong> for å se data her.
      </p>
    </div>
  ) : null

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[{ label: 'Admin', to: '/admin' }, { label: 'Rolle-compliance' }]}
        title="Rolle-compliance"
        description="Status på opplæring, krav og terskel-brudd per funksjonell rolle. Fase 1 dekker opplærings-aksen — ack/sign/møter kommer i fase 2."
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
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID}
              scopeLabel="Rolle-compliance"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={dashboard.loading}
        error={dashboard.error}
        emptyState={empty}
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
        scopeId={ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID}
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
