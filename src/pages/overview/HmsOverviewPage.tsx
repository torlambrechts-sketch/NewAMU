// HMS Overview — composite dashboard host page (3.3.1).
//
// Pulls KPIs and trends from four registered scopes (compliance,
// survey, tasks, learning) into a single dashboard. Built on top of the
// existing engine — no special-casing in `ModuleAnalyticsDashboard`;
// the host page just merges four dataset maps and hands them in.
//
// Each per-scope `useXxxDatasets` hook receives the *same* filter array,
// applies the chips it understands, and ignores the rest. So a single
// "department" chip narrows compliance executions, survey responses,
// tasks, and learning completions consistently. Module-specific chips
// (severity, expiry_window, etc.) only surface on the per-module
// analyse pages.

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
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import { useLearningDatasets } from '../learning/dashboards/useLearningDatasets'
import { useChecklistModule } from '../../../modules/compliance/useChecklistModule'
import { useChecklistDatasets } from '../../../modules/compliance/dashboards/useChecklistDatasets'
import { useLicensedPacks } from '../../context/packContextValue'
import { useSurvey } from '../../../modules/survey/useSurvey'
import { useSurveyPacks } from '../../../modules/survey/useSurveyPacks'
import { useSurveyOrgTemplates } from '../../../modules/survey/useSurveyOrgTemplates'
import { useSurveyDatasets } from '../../../modules/survey/dashboards/useSurveyDatasets'
import { useTaskItemsData } from '../../../modules/tasks/useTaskItemsData'
import { useTasksDatasets } from '../../../modules/tasks/dashboards/useTasksDatasets'
import { useDocuments } from '../../hooks/useDocuments'
import { useDocumentsDatasets } from '../documents/dashboards/useDocumentsDatasets'
import { buildRiskDatasets } from '../../../modules/risk/dashboards/useRiskDatasets'
import { useRiskDashboardRows } from '../../../modules/risk/dashboards/useRiskDashboardRows'
import '../../../modules/risk/dashboards/riskDashboardScope'
import { useAlerts } from '../../../modules/alerts'
import { useAlertsDatasets } from '../../../modules/alerts/dashboards/useAlertsDatasets'
import { useComplianceLayerDatasets } from '../../../modules/compliance-layer/dashboards/useComplianceLayerDatasets'
import { useLedelsesKpis } from '../../../modules/compliance-layer/dashboards/useLedelsesKpis'
import {
  HMS_OVERVIEW_SCOPE_ID,
  // Side-effect import: registers the composite scope on module load.
} from './dashboards/hmsOverviewScope'
import './dashboards/hmsOverviewScope'
// Member scope side-effect imports — guarantee their dataset metadata is
// available even when the user navigates here cold (no per-module page
// has run yet).
import '../../../modules/compliance/dashboards/checklistDashboardScope'
import '../../../modules/survey/dashboards/surveyDashboardScope'
import '../../../modules/tasks/dashboards/tasksDashboardScope'
import '../learning/dashboards/learningDashboardScope'
import '../documents/dashboards/documentsDashboardScope'
import '../../../modules/compliance-layer/dashboards/complianceLayerScope'
import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'

export function HmsOverviewPage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup

  // ── Source data (load all four modules) ────────────────────────────────
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()

  const survey = useSurvey({ supabase })
  const { packs: surveyPacks } = useSurveyPacks({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })

  const tasksApi = useTaskItemsData()

  const learning = useLearning()
  const cats = useLearningCategories({ supabase })

  const docs = useDocuments()

  const dashboard = useDashboardLayout({ supabase, scopeId: HMS_OVERVIEW_SCOPE_ID })

  // ── Composite dimensions: only the chips that have meaning across
  // multiple member scopes. Module-specific chips (severity, expiry,
  // anonymity, etc.) are reachable from each per-module analyse page.
  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrerer alle moduler på samme avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på opprettet/signert dato (gjelder compliance + survey).',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [orgSetup.departments],
  )

  // Survey-specific lookup that the survey hook expects but we already
  // own here from useSurveyOrgTemplates — keep the per-scope hook signature
  // unchanged and resolve it in the host.
  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) {
      m.set(t.catalogId, t.categoryId)
    }
    return m
  }, [surveyOrgTemplates.templates])

  // ── Compute each member's dataset map ──────────────────────────────────
  const checklistDs = useChecklistDatasets({
    filters: dashboard.filters,
    executions: cl.executions,
    responsesByExecutionId: cl.responsesByExecutionId,
    templates: cl.templates,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
  })
  const surveyDs = useSurveyDatasets({
    filters: dashboard.filters,
    surveys: survey.surveys,
    templateCatalog: survey.templateCatalog,
    packs: surveyPacks,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByCatalogId,
  })
  const tasksDs = useTasksDatasets(
    tasksApi.items.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      templateKind: t.templateKind,
      templateSlug: t.templateSlug,
      templateName: null,
      dueDate: t.dueDate,
      slaDueAt: t.slaDueAt,
      closedAt: t.closedAt,
      createdAt: t.createdAt,
      assigneeName: t.assigneeName,
    })),
    dashboard.filters,
  )
  const learningDs = useLearningDatasets({
    filters: dashboard.filters,
    courses: learning.courses,
    progress: learning.progress,
    certificates: learning.certificates,
    categories: cats.categories,
    members: orgSetup.members,
    departments: orgSetup.departments,
  })
  const accessRequestsOpen = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending').length,
    [docs.wikiAccessRequests],
  )
  const documentsDs = useDocumentsDatasets({
    filters: dashboard.filters,
    pages: docs.pages,
    spaces: docs.spaces,
    orgCustomTemplates: docs.orgCustomTemplates,
    accessRequestsOpen,
  })
  const alerts = useAlerts()
  const alertsDs = useAlertsDatasets({
    filters: dashboard.filters,
    cases: alerts.cases,
    templates: alerts.systemTemplates,
    categories: alerts.categories,
  })

  // Compliance Layer (Tier 2) — self-fetching hook (reads its own
  // controls + clauses + status_v rows). Returns scope-prefixed dataset
  // keys (`controls_*`) so the composite merge below stays collision-
  // free. Cross-scope filter chips don't currently apply to controls;
  // adding department/date filtering is a v2 enhancement once
  // internal_control_executions carries org-context columns.
  const complianceLayer = useComplianceLayerDatasets()
  const complianceLayerDs = complianceLayer.datasets

  // Ledelses-KPI strip (ROADMAP §5.5) — four top-line numbers for the
  // daglig leder: AML-dekning, åpne pålegg, ARP-status, §-er uten plan.
  // Self-fetching org-scoped hook; returns dataset keys prefixed
  // `ledelses_*` so they merge cleanly into the composite map.
  const ledelses = useLedelsesKpis()
  const ledelsesDs = ledelses.datasets

  // Risk member — reads from `risk_register_summary_v` when available
  // (P2 migration applied), falls back to the P1 client-side source
  // fold otherwise. Filter chips cascade because `buildRiskDatasets`
  // ignores chips it doesn't understand.
  const riskRows = useRiskDashboardRows()
  const riskDs = useMemo(
    () => buildRiskDatasets(riskRows.rows, dashboard.filters, dashboard.comparison),
    [riskRows.rows, dashboard.filters, dashboard.comparison],
  )

  // Merge — keys are scope-namespaced so collisions are impossible.
  const datasets = useMemo<Record<string, unknown>>(
    () => ({
      ...checklistDs,
      ...surveyDs,
      ...tasksDs,
      ...learningDs,
      ...documentsDs,
      ...riskDs,
      ...alertsDs,
      ...complianceLayerDs,
      ...ledelsesDs,
    }),
    [
      checklistDs,
      surveyDs,
      tasksDs,
      learningDs,
      documentsDs,
      riskDs,
      alertsDs,
      complianceLayerDs,
      ledelsesDs,
    ],
  )

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
    scopeId: HMS_OVERVIEW_SCOPE_ID,
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
        accent={getDashboardScope(HMS_OVERVIEW_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Arbeidsflate', to: '/' },
          { label: 'Oversikt', to: '/overview/hms' },
          { label: 'HMS-oversikt' },
        ]}
        title="HMS-oversikt"
        description="Tverrgående KPI-er og trender på tvers av compliance, undersøkelser, oppgaver og læring."
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
              scopeId={HMS_OVERVIEW_SCOPE_ID}
              scopeLabel="HMS-oversikt"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        // Per-section loading: only block the page on dashboard
        // layout load (fast — one row). Member-hook progress is
        // surfaced via `dataLoading`, which pulses the grid until
        // every member hook resolves so empty widgets don't read as
        // confirmed-empty during the initial fetch.
        loading={dashboard.loading}
        dataLoading={
          cl.loading ||
          survey.loading ||
          learning.learningLoading ||
          docs.loading ||
          riskRows.loading ||
          complianceLayer.loading ||
          ledelses.loading
        }
        error={
          cl.error ??
          survey.error ??
          learning.learningError ??
          docs.error ??
          riskRows.error ??
          complianceLayer.error ??
          ledelses.error ??
          dashboard.error
        }
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
        scopeId={HMS_OVERVIEW_SCOPE_ID}
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
