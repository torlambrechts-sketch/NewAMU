// Tasks analytics page — third consumer of ModuleAnalyticsDashboard.
// Owns dataset compute (from useTasks + useTaskExtensions) and hands
// the result to the runtime + the registered tasks scope.
//
// Per /specs/tasks-parity.md: tasks live in jsonb (org_module_payload),
// not a normalised table. So the analyse page does no FK joining at
// the SQL level — all bucketing is client-side over the in-memory list.
// The "department" dimension resolves Task.assigneeEmployeeId →
// organization_members.department_id at compute time.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useTasks } from '../../src/hooks/useTasks'
import { useTaskExtensions } from './useTaskExtensions'
import {
  TASKS_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/tasksDashboardScope'
import './dashboards/tasksDashboardScope'
import {
  STATUS_OPTIONS,
  MODULE_OPTIONS,
  SOURCE_OPTIONS,
  PRIORITY_OPTIONS,
  useTasksDatasets,
} from './dashboards/useTasksDatasets'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'

// ── Static option lists for filter dimensions ─────────────────────────────


// ── Page ──────────────────────────────────────────────────────────────────

export function TasksAnalysePage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const tasksApi = useTasks()
  const ext = useTaskExtensions(tasksApi.tasks)
  const dashboard = useDashboardLayout({
    supabase: orgSetup.supabase,
    scopeId: TASKS_DASHBOARD_SCOPE_ID,
  })

  // Filter dimensions. The department dimension is the one place this page
  // does any "joining" — it walks the resolved map at filter-eval time.
  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Status',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'module',
        label: 'Modul',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => MODULE_OPTIONS.map((m) => ({ id: m.id, label: m.label })),
      },
      {
        id: 'source',
        label: 'Kilde',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => SOURCE_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'priority',
        label: 'Prioritet',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => PRIORITY_OPTIONS.map((p) => ({ id: p.id, label: p.label })),
      },
      {
        id: 'assignee',
        label: 'Ansvarlig',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Resolved fra ansvarlig-ansattens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'due',
        label: 'Forfall',
        description: 'Filter på frist (dueDate).',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [orgSetup.members, orgSetup.departments],
  )

  const datasets = useTasksDatasets({
    filters: dashboard.filters,
    tasks: tasksApi.tasks,
    ext,
    members: orgSetup.members,
    departments: orgSetup.departments,
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
    tasksApi.tasks.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen oppgaver å analysere ennå. Opprett en oppgave eller koble til en
          kilde for å se tallene her.
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

  // useTasks loads from local/Supabase on mount; nothing to call here.
  useEffect(() => {
    /* parity with other analyse pages */
  }, [])

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(TASKS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Arbeidsflate' },
          { label: 'Oppgavestyring', to: '/tasks/management' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, status, kilde og forfallsbilde på tvers av oppgaveinnboksen."
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
            to="/tasks/management"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                navigate('/tasks/management')
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
        loading={tasksApi.loading || dashboard.loading}
        error={tasksApi.error ?? dashboard.error}
        emptyState={empty}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
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
        scopeId={TASKS_DASHBOARD_SCOPE_ID}
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

