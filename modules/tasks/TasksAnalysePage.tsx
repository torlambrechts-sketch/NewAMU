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
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import type { Task, TaskModule, TaskSourceType, TaskStatus } from '../../src/types/task'
import type { TaskPriority } from './types'
import type { ReportModule } from '../../src/types/reportBuilder'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../src/lib/dashboards/dashboardFilters'

// ── Static option lists for filter dimensions ─────────────────────────────

const STATUS_OPTIONS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'Pågående' },
  { id: 'done', label: 'Fullført' },
]

const MODULE_OPTIONS: { id: TaskModule; label: string }[] = [
  { id: 'general', label: 'Generelt' },
  { id: 'council', label: 'AMU' },
  { id: 'members', label: 'Medlemmer' },
  { id: 'org_health', label: 'Org-helse' },
  { id: 'hse', label: 'HMS' },
  { id: 'hrm', label: 'HRM' },
  { id: 'learning', label: 'Læring' },
]

const SOURCE_OPTIONS: { id: TaskSourceType; label: string }[] = [
  { id: 'manual', label: 'Manuell' },
  { id: 'task_cosign_request', label: 'Co-sign' },
  { id: 'council_meeting', label: 'AMU-møte' },
  { id: 'council_compliance', label: 'AMU-compliance' },
  { id: 'representatives', label: 'Verneombud' },
  { id: 'survey', label: 'Undersøkelse' },
  { id: 'hse_safety_round', label: 'Vernerunde' },
  { id: 'hse_inspection', label: 'HMS-inspeksjon' },
  { id: 'hse_inspection_finding', label: 'HMS-funn' },
  { id: 'hse_incident', label: 'Hendelse' },
  { id: 'hse_sja', label: 'SJA' },
  { id: 'hse_sick_leave_milestone', label: 'Sykefravær-milepæl' },
  { id: 'nav_report', label: 'NAV-rapport' },
  { id: 'labor_metric', label: 'Arbeidstid-måling' },
  { id: 'learning_course', label: 'Læringskurs' },
  { id: 'ros_measure', label: 'ROS-tiltak' },
  { id: 'annual_review_action', label: 'Årsgjennomgang' },
]

const PRIORITY_OPTIONS: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
  { id: 'critical', label: 'Kritisk' },
]

// ── Filter selectors ──────────────────────────────────────────────────────

type FilterSelectors = {
  statuses: { ids: Set<TaskStatus>; mode: 'include' | 'exclude' } | null
  modules: { ids: Set<TaskModule>; mode: 'include' | 'exclude' } | null
  sources: { ids: Set<TaskSourceType>; mode: 'include' | 'exclude' } | null
  priorities: { ids: Set<TaskPriority>; mode: 'include' | 'exclude' } | null
  assignees: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  dueFrom: Date | null
  dueTo: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    statuses: null,
    modules: null,
    sources: null,
    priorities: null,
    assignees: null,
    departments: null,
    dueFrom: null,
    dueTo: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'status') {
      const ids = setOf<TaskStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'module') {
      const ids = setOf<TaskModule>(f.value)
      if (ids.size) out.modules = { ids, mode }
    } else if (f.dimensionId === 'source') {
      const ids = setOf<TaskSourceType>(f.value)
      if (ids.size) out.sources = { ids, mode }
    } else if (f.dimensionId === 'priority') {
      const ids = setOf<TaskPriority>(f.value)
      if (ids.size) out.priorities = { ids, mode }
    } else if (f.dimensionId === 'assignee') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.assignees = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'due') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.dueFrom = new Date(r.from)
        if (r.to) out.dueTo = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
        out.dueFrom = new Date(f.value)
      } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
        out.dueTo = new Date(f.value + 'T23:59:59')
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

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

  // Resolve assigneeEmployeeId → department_id via the org members list.
  // Simple Map; rebuilds when members change. The "department" filter
  // dimension uses this; no joins needed beyond the in-memory map.
  const departmentByEmployeeId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const member of orgSetup.members) {
      m.set(member.id, member.department_id)
    }
    return m
  }, [orgSetup.members])

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

  const datasets = useMemo(() => {
    const sel = buildSelectors(dashboard.filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Filter tasks by chips first.
    const tasks = tasksApi.tasks.filter((t: Task) => {
      if (!matchesSet(sel.statuses, t.status)) return false
      if (!matchesSet(sel.modules, t.module)) return false
      if (!matchesSet(sel.sources, t.sourceType)) return false
      if (sel.priorities) {
        const p = ext.getExtension(t).priority
        if (!matchesSet(sel.priorities, p)) return false
      }
      if (sel.assignees) {
        if (!t.assigneeEmployeeId) {
          if (sel.assignees.mode === 'include') return false
        } else if (!matchesSet(sel.assignees, t.assigneeEmployeeId)) {
          return false
        }
      }
      if (sel.departments) {
        const dep = t.assigneeEmployeeId
          ? departmentByEmployeeId.get(t.assigneeEmployeeId) ?? null
          : null
        if (!dep) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, dep)) {
          return false
        }
      }
      if (sel.dueFrom || sel.dueTo) {
        const dd = t.dueDate ? new Date(t.dueDate) : null
        if (!dateInRange(dd, sel.dueFrom, sel.dueTo)) return false
      }
      return true
    })

    let total = 0
    let open = 0
    let overdue = 0
    let completedYtd = 0
    let requiringSignOff = 0
    const statusCounts: Record<string, number> = { Todo: 0, Pågående: 0, Fullført: 0 }
    const moduleCounts = new Map<string, number>()
    const sourceCounts = new Map<string, number>()
    const priorityCounts: Record<string, number> = {
      Lav: 0,
      Middels: 0,
      Høy: 0,
      Kritisk: 0,
    }
    const assigneeCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const completedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    const overdueByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))

    const moduleLabelById = new Map(MODULE_OPTIONS.map((o) => [o.id, o.label]))
    const sourceLabelById = new Map(SOURCE_OPTIONS.map((o) => [o.id, o.label]))
    const memberLabelById = new Map(orgSetup.members.map((m) => [m.id, m.display_name]))
    const departmentLabelById = new Map(
      orgSetup.departments.map((d) => [d.id, d.name]),
    )

    for (const t of tasks) {
      total += 1
      const dueAt = t.dueDate ? new Date(t.dueDate) : null
      const completedAt = t.assigneeSignature?.signedAt
        ? new Date(t.assigneeSignature.signedAt)
        : null

      if (t.status === 'done') {
        statusCounts.Fullført = (statusCounts.Fullført ?? 0) + 1
        if (completedAt && completedAt >= yearStart) completedYtd += 1
        if (completedAt) {
          const k = monthKey(completedAt)
          if (completedByMonth.has(k))
            completedByMonth.set(k, (completedByMonth.get(k) ?? 0) + 1)
        }
      } else if (t.status === 'in_progress') {
        open += 1
        statusCounts.Pågående = (statusCounts.Pågående ?? 0) + 1
      } else {
        open += 1
        statusCounts.Todo = (statusCounts.Todo ?? 0) + 1
      }

      if (t.status !== 'done' && dueAt && dueAt < now) {
        overdue += 1
        const k = monthKey(dueAt)
        if (overdueByMonth.has(k))
          overdueByMonth.set(k, (overdueByMonth.get(k) ?? 0) + 1)
      }

      if (t.requiresManagementSignOff && !t.managementSignature) {
        requiringSignOff += 1
      }

      const modLabel = moduleLabelById.get(t.module) ?? t.module
      moduleCounts.set(modLabel, (moduleCounts.get(modLabel) ?? 0) + 1)

      const srcLabel = sourceLabelById.get(t.sourceType) ?? t.sourceType
      sourceCounts.set(srcLabel, (sourceCounts.get(srcLabel) ?? 0) + 1)

      const p = ext.getExtension(t).priority
      const priLabel =
        p === 'low' ? 'Lav' : p === 'medium' ? 'Middels' : p === 'high' ? 'Høy' : 'Kritisk'
      priorityCounts[priLabel] = (priorityCounts[priLabel] ?? 0) + 1

      if (t.assigneeEmployeeId) {
        const aLabel =
          memberLabelById.get(t.assigneeEmployeeId) ?? t.assignee
        assigneeCounts.set(aLabel, (assigneeCounts.get(aLabel) ?? 0) + 1)
      }

      const depId = t.assigneeEmployeeId
        ? departmentByEmployeeId.get(t.assigneeEmployeeId) ?? null
        : null
      const depLabel = depId
        ? departmentLabelById.get(depId) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depLabel, (departmentCounts.get(depLabel) ?? 0) + 1)
    }

    const topAssignees = [...assigneeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const assigneeBar: Record<string, number> = {}
    for (const [name, count] of topAssignees) assigneeBar[name] = count

    const topSources = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const sourceBar: Record<string, number> = {}
    for (const [name, count] of topSources) sourceBar[name] = count

    return {
      tasks_kpi_summary: { total, open, overdue, completedYtd, requiringSignOff },
      tasks_status_distribution: statusCounts,
      tasks_module_distribution: Object.fromEntries(moduleCounts),
      tasks_source_distribution: sourceBar,
      tasks_priority_distribution: priorityCounts,
      tasks_distribution_by_assignee: assigneeBar,
      tasks_distribution_by_department: Object.fromEntries(departmentCounts),
      tasks_completed_over_time: months.map((m) => ({
        x: m.label,
        y: completedByMonth.get(m.key) ?? 0,
      })),
      tasks_overdue_over_time: months.map((m) => ({
        x: m.label,
        y: overdueByMonth.get(m.key) ?? 0,
      })),
    } as Record<string, unknown>
  }, [
    tasksApi.tasks,
    ext,
    orgSetup.members,
    orgSetup.departments,
    departmentByEmployeeId,
    dashboard.filters,
  ])

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
        const dup = { ...m, id: cryptoUuid(), title: `${m.title} (kopi)` }
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
          const dup = { ...w, id: cryptoUuid(), title: `${w.title} (kopi)` }
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

const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
function cryptoUuid(): string {
  if (typeof cryptoLike?.randomUUID === 'function') return cryptoLike.randomUUID()
  return `w_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}
