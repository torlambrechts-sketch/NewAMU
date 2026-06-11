// TasksAnalysePage — analytics dashboard for the Oppgaver module.
// Loads all task_items for the org, hands the snapshot to useTasksDatasets,
// and renders ModuleAnalyticsDashboard. Mirrors SurveyAnalysePage in shape.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../src/components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../src/components/reports/PublishReportButton'
import {
  TASKS_DASHBOARD_SCOPE_ID,
} from './dashboards/tasksDashboardScope'
import './dashboards/tasksDashboardScope'
import { useTasksDatasets, type TaskItemSnapshot } from './dashboards/useTasksDatasets'
import { useTaskTemplates } from './useTaskTemplates'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'
import type { TaskTemplateKind, TaskItemStatus, TaskItemPriority } from '../../src/types/task'

const STATUS_OPTIONS = [
  { id: 'open', label: 'Åpen' },
  { id: 'in_progress', label: 'Under behandling' },
  { id: 'root_cause_identified', label: 'Rotårsak identifisert' },
  { id: 'action_defined', label: 'Tiltak definert' },
  { id: 'action_implemented', label: 'Tiltak implementert' },
  { id: 'effectiveness_pending', label: 'Venter på verifikasjon' },
  { id: 'effectiveness_verified', label: 'Verifisert effektiv' },
  { id: 'closed', label: 'Lukket' },
  { id: 'cancelled', label: 'Kansellert' },
]

const KIND_OPTIONS = [
  { id: 'oppgave', label: 'Generell oppgave' },
  { id: 'avvik', label: 'Avvik / Hendelse' },
  { id: 'nestenulykke', label: 'Nestenulykke' },
  { id: 'tiltak', label: 'Tiltak' },
  { id: 'risiko', label: 'Risikovurdering' },
  { id: 'forslag', label: 'Forslag' },
  { id: 'sykefravær', label: 'Sykefravær-oppfølging' },
]

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
  { id: 'critical', label: 'Kritisk' },
]

export function TasksAnalysePage() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const tplData = useTaskTemplates()

  const [snapshots, setSnapshots] = useState<TaskItemSnapshot[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    if (!supabase || !orgId) return
    setDataLoading(true)
    const { data, error: e } = await supabase
      .from('task_items')
      .select(
        'id, status, priority, template_kind, template_slug, due_date, sla_due_at, closed_at, created_at, assignee_name',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
    setDataLoading(false)
    if (e) { setDataError(e.message); return }

    // Build template slug → name map from loaded templates
    const nameBySlug = new Map(tplData.templates.map((t) => [t.slug, t.name]))

    setSnapshots(
      (data ?? []).map((r) => ({
        id: String(r.id),
        status: (r.status ?? 'open') as TaskItemStatus,
        priority: (r.priority ?? 'medium') as TaskItemPriority,
        templateKind: r.template_kind ? (r.template_kind as TaskTemplateKind) : null,
        templateSlug: r.template_slug ? String(r.template_slug) : null,
        templateName: r.template_slug ? (nameBySlug.get(r.template_slug) ?? r.template_slug) : null,
        dueDate: r.due_date ? String(r.due_date) : null,
        slaDueAt: r.sla_due_at ? String(r.sla_due_at) : null,
        closedAt: r.closed_at ? String(r.closed_at) : null,
        createdAt: String(r.created_at),
        assigneeName: r.assignee_name ? String(r.assignee_name) : null,
      })),
    )
  }, [supabase, orgId, tplData.templates])

  useEffect(() => {
    void loadSnapshots()
  }, [loadSnapshots])

  const dashboard = useDashboardLayout({ supabase, scopeId: TASKS_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'kind',
        label: 'Maltype',
        description: 'Begrens til én eller flere maltyper.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => KIND_OPTIONS,
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Filtrer på CAPA-status.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS,
      },
      {
        id: 'priority',
        label: 'Prioritet',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => PRIORITY_OPTIONS,
      },
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på én spesifikk mal.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => tplData.templates.map((t) => ({ id: t.slug, label: t.name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Begrens opprettelsesdato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [tplData.templates],
  )

  const datasets = useTasksDatasets(snapshots, dashboard.filters)

  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey]
          const keys = Array.isArray(ds) ? ds.map((s: { id: string }) => s.id) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const empty =
    snapshots.length === 0 && !dataLoading ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen oppgaver å analysere ennå. Opprett oppgaver for å se tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const editChrome = useDashboardEditChrome({
    scopeId: TASKS_DASHBOARD_SCOPE_ID,
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
        accent={getDashboardScope(TASKS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Oppgaver', to: '/tasks/management' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="CAPA-trakt, SLA-etterlevelse, statusfordeling og trend på tvers av alle oppgavemaler."
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
              to="/tasks/management"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={TASKS_DASHBOARD_SCOPE_ID}
              scopeLabel="Oppgaver"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={dataLoading || dashboard.loading}
        error={dataError ?? dashboard.error}
        emptyState={empty}
        dimensions={dimensions}
        filters={dashboard.filters}
        onFiltersChange={(f) => { void dashboard.saveFilters(f) }}
        widgetControlSlot={widgetControlSlot}
        editMode={editChrome.editMode}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
      />

      <DashboardEditLayoutPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        layout={dashboard.layout}
        onSave={async (next) => {
          await dashboard.saveLayout(next)
          setEditOpen(false)
          return true
        }}
      />

      <DashboardAddWidgetPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scopeId={TASKS_DASHBOARD_SCOPE_ID}
        onAdd={async (tpl) => {
          await dashboard.saveLayout([...dashboard.layout, { ...tpl, id: freshId('w') }])
          setAddOpen(false)
          return true
        }}
      />

      {editWidget && (
        <DashboardEditWidgetPanel
          open
          onClose={() => setEditWidget(null)}
          widget={editWidget}
          datasets={datasets}
          onSave={async (updated) => {
            await dashboard.saveLayout(
              dashboard.layout.map((m) => (m.id === updated.id ? updated : m)),
            )
            setEditWidget(null)
            return true
          }}
        />
      )}
    </>
  )
}
