// Arbeidsmiljøstrategi — utfalls-orientert visning av AML.
//
// Snur kompass-en fra «hvor mange paragrafer dekker vi» til «klarer vi
// det loven faktisk vil»: trygghet, trivsel, medvirkning og mestring.
// Strategien (visjon + fokusområder) lever på toppen; akse-skårene og
// neste-steg-køen bygges fra de samme modulene compliance-dashbordet
// teller — men sett gjennom et arbeidstaker-perspektiv.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  Camera,
  ExternalLink,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react'
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
import { useVernerunderDatasets } from '../../../modules/vernerunder/dashboards/useVernerunderDatasets'
import {
  useWorkerWellbeingDatasets,
  WELLBEING_AXIS_LABELS,
  WELLBEING_AXIS_LAW,
  type WellbeingAxisKey,
} from './dashboards/useWorkerWellbeingDatasets'
import { StrategyVisionEditor } from './components/StrategyVisionEditor'
import { FocusAreasGrid } from './components/FocusAreasGrid'
import { useWellbeingStrategy } from './hooks/useWellbeingStrategy'
import { useWellbeingSnapshots } from './hooks/useWellbeingSnapshots'
import {
  WORKER_WELLBEING_SCOPE_ID,
} from './dashboards/workerWellbeingDashboardScope'
// Side-effect imports — registrer alle relevante scopes ved første
// page-load, slik at oppslag mot registry-en alltid lykkes.
import './dashboards/workerWellbeingDashboardScope'
import '../../../modules/vernerunder/dashboards/vernerunderDashboardScope'
import '../../../modules/compliance/dashboards/checklistDashboardScope'
import '../../../modules/survey/dashboards/surveyDashboardScope'
import '../../../modules/tasks/dashboards/tasksDashboardScope'
import '../learning/dashboards/learningDashboardScope'
import '../documents/dashboards/documentsDashboardScope'
import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'

type Tab = 'strategi' | 'analyse' | 'verktoy'

const AXIS_ORDER: WellbeingAxisKey[] = ['trygghet', 'trivsel', 'medvirkning', 'mestring']

const AXIS_GRADIENT: Record<WellbeingAxisKey, string> = {
  trygghet: 'from-emerald-50 to-white border-emerald-200',
  trivsel: 'from-purple-50 to-white border-purple-200',
  medvirkning: 'from-blue-50 to-white border-blue-200',
  mestring: 'from-teal-50 to-white border-teal-200',
}

const AXIS_TEXT: Record<WellbeingAxisKey, string> = {
  trygghet: 'text-emerald-900',
  trivsel: 'text-purple-900',
  medvirkning: 'text-blue-900',
  mestring: 'text-teal-900',
}

// Statisk verktøy-katalog som speiler kuratert oppsett i datasets-hooken,
// men beriket med beskrivelser slik at Verktøy-fanen blir en
// oppdagelse-flate (ikke bare en speilet liste).
const TOOLS: Array<{
  axis: WellbeingAxisKey
  title: string
  description: string
  path: string
}> = [
  { axis: 'trygghet', title: 'Vernerunder', description: 'Strukturerte runder med funn, alvorlighet og signatur. Driver Trygghet-skåren.', path: '/vernerunder' },
  { axis: 'trygghet', title: 'Avvik & nestenulykke', description: 'CAPA-livssyklus for hendelser etter ISO 45001 § 10.2.', path: '/tasks/management?template=avvik' },
  { axis: 'trygghet', title: 'Risikoanalyser (ROS)', description: 'Identifiserer fare før den materialiserer seg.', path: '/ros' },
  { axis: 'trivsel', title: 'Psykososial undersøkelse', description: 'QPS Nordic, ARK eller NAQ-R+ — målet etter AML § 4-3.', path: '/survey' },
  { axis: 'trivsel', title: 'Sjekkliste § 4-3-oppfølging', description: 'Strukturert oppfølging av lave skår i hver delskala.', path: '/compliance/checklists' },
  { axis: 'medvirkning', title: 'AMU-møter (Q1–Q4)', description: 'Maler med agendapunkter knyttet til survey- og avviksdata.', path: '/meetings' },
  { axis: 'medvirkning', title: 'Verneombud-møter', description: 'Kvartalsvise operativ-møter etter AML § 6-2.', path: '/meetings' },
  { axis: 'medvirkning', title: 'Varslingskanal', description: 'Anonym kanal etter AML kap. 2A.', path: '/workplace-reporting/anonymous-aml' },
  { axis: 'mestring', title: 'HMS-grunnopplæring (40t)', description: 'Lederopplæring etter AML § 3-5.', path: '/learning' },
  { axis: 'mestring', title: 'Verneombud-opplæring (40t)', description: 'Pliktig kompetanse etter AML § 6-5.', path: '/learning' },
  { axis: 'mestring', title: 'AMU-grunnopplæring', description: 'Innføring i AMU-mandat og § 7-2-oppgaver.', path: '/learning' },
]

export function ArbeidsmiljostrategiPage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const [tab, setTab] = useState<Tab>('strategi')

  // ── Source data (samme moduler som HMS-oversikt) ─────────────────────────
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()

  const survey = useSurvey({ supabase })
  const { packs: surveyPacks } = useSurveyPacks({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })

  const tasksApi = useTaskItemsData()
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })
  const docs = useDocuments()

  const dashboard = useDashboardLayout({ supabase, scopeId: WORKER_WELLBEING_SCOPE_ID })

  // Wellbeing strategy (visjon + fokusområder + vekter)
  const wellbeingStrategy = useWellbeingStrategy()
  const snapshots = useWellbeingSnapshots()

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrerer akse-data per avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på opprettet/lukket dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [orgSetup.departments],
  )

  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) {
      m.set(t.catalogId, t.categoryId)
    }
    return m
  }, [surveyOrgTemplates.templates])

  // ── Medlems-datasets ─────────────────────────────────────────────────────
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
  const vernerunderDs = useVernerunderDatasets({ filters: dashboard.filters })

  const memberDatasets = useMemo<Record<string, unknown>>(
    () => ({
      ...checklistDs,
      ...surveyDs,
      ...tasksDs,
      ...learningDs,
      ...documentsDs,
      ...vernerunderDs,
    }),
    [checklistDs, surveyDs, tasksDs, learningDs, documentsDs, vernerunderDs],
  )

  const wellbeingDs = useWorkerWellbeingDatasets({
    memberDatasets,
    weights: wellbeingStrategy.weights,
    indexHistory: snapshots.series,
    snapshotHistory: snapshots.snapshots,
  })

  const datasets = useMemo<Record<string, unknown>>(
    () => ({ ...memberDatasets, ...wellbeingDs }),
    [memberDatasets, wellbeingDs],
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
    scopeId: WORKER_WELLBEING_SCOPE_ID,
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

  const accent = getDashboardScope(WORKER_WELLBEING_SCOPE_ID)?.accent ?? '#d97706'
  const indexSummary = (datasets['wellbeing_index_summary'] as Record<string, unknown> | undefined) ?? {}
  const indexLabel = typeof indexSummary.indexLabel === 'string' ? indexSummary.indexLabel : '—'
  const indexDelta = typeof indexSummary.indexDelta === 'string' ? indexSummary.indexDelta : ''

  // Pluk rå akse-skår direkte fra wellbeing_index_summary. Lokal kost
  // er gratis, og vi unngår at en ny indexSummary-objekt-identitet
  // hver render forplanter seg som tilbake-fyring av useMemo.
  const indexRaw = datasets['wellbeing_index_summary'] as
    | { indexRaw?: number | null; trygghetRaw?: number | null; trivselRaw?: number | null; medvirkningRaw?: number | null; mestringRaw?: number | null }
    | undefined
  const rawScores = useMemo(
    () => ({
      index: typeof indexRaw?.indexRaw === 'number' ? indexRaw.indexRaw : null,
      trygghet: typeof indexRaw?.trygghetRaw === 'number' ? indexRaw.trygghetRaw : null,
      trivsel: typeof indexRaw?.trivselRaw === 'number' ? indexRaw.trivselRaw : null,
      medvirkning: typeof indexRaw?.medvirkningRaw === 'number' ? indexRaw.medvirkningRaw : null,
      mestring: typeof indexRaw?.mestringRaw === 'number' ? indexRaw.mestringRaw : null,
    }),
    [indexRaw?.indexRaw, indexRaw?.trygghetRaw, indexRaw?.trivselRaw, indexRaw?.medvirkningRaw, indexRaw?.mestringRaw],
  )

  // Auto-capture: én gang per page-mount, etter at indeksen er beregnet.
  // RPC-en er idempotent (UPSERT på (org, period_key)) så å havne her
  // flere ganger samme måned er ufarlig — hooken debouncer i tillegg
  // basert på captured_at-alder.
  const autoCaptureFired = useRef(false)
  useEffect(() => {
    if (autoCaptureFired.current) return
    if (snapshots.loading || wellbeingStrategy.loading) return
    if (rawScores.index == null) return
    autoCaptureFired.current = true
    const signals = {
      vernerunder: memberDatasets['vernerunde_kpi_summary'] ?? null,
      tasks: memberDatasets['tasks_kpi_summary'] ?? null,
      survey: memberDatasets['survey_kpi_summary'] ?? null,
      learning: memberDatasets['learning_kpi_summary'] ?? null,
    }
    void snapshots.maybeAutoCapture(rawScores, wellbeingStrategy.weights, signals)
  }, [
    snapshots,
    snapshots.loading,
    wellbeingStrategy.loading,
    wellbeingStrategy.weights,
    rawScores,
    memberDatasets,
  ])

  const handleManualSnapshot = async () => {
    if (rawScores.index == null) {
      window.alert('Indeksen er ikke målt ennå — det må finnes minst én akse med data.')
      return
    }
    const signals = {
      vernerunder: memberDatasets['vernerunde_kpi_summary'] ?? null,
      tasks: memberDatasets['tasks_kpi_summary'] ?? null,
      survey: memberDatasets['survey_kpi_summary'] ?? null,
      learning: memberDatasets['learning_kpi_summary'] ?? null,
    }
    await snapshots.captureNow(rawScores, wellbeingStrategy.weights, signals)
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Hero — fortellingen først */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Utfalls-orientert HMS
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Arbeidsmiljøstrategi</h1>
            <p className="max-w-2xl text-sm text-neutral-600">
              Ikke «klarer vi paragrafene», men «klarer vi det loven vil»: at folk er trygge,
              trives, blir hørt og vokser. Strategien viser sammenhengen mellom det dere ønsker
              å skape og verktøyene dere allerede har.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/overview/hms"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> HMS-oversikt
            </Link>
            <Link
              to="/overview/arbeidsmiljostrategi/rapport?autoprint=1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Printer className="h-4 w-4" aria-hidden /> Styreromsrapport
            </Link>
            <Link
              to="/overview/compliance-selskap"
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-900 hover:bg-rose-100"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden /> Compliance — selskap
            </Link>
          </div>
        </div>

        {/* Indeks-stripe */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 px-5 py-4 shadow-sm"
          style={{ borderColor: accent, background: `linear-gradient(to right, ${accent}11, ${accent}05)` }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Arbeidsmiljø-indeks</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight" style={{ color: accent }}>
                {indexLabel}
              </span>
              <span className="text-sm text-neutral-500">av 100</span>
              {indexDelta && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    indexDelta.startsWith('+')
                      ? 'bg-emerald-100 text-emerald-900'
                      : indexDelta.startsWith('-')
                      ? 'bg-rose-100 text-rose-900'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                  title="Endring siden forrige snapshot-måned"
                >
                  {indexDelta}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-md text-xs text-neutral-600">
              Vektet snitt av trygghet, trivsel, medvirkning og mestring — beregnet fra
              vernerunder, surveys, AMU-aktivitet og læring. Snapshot lagres månedlig
              for historikk.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AXIS_ORDER.map((k) => {
              const score = typeof indexSummary[k] === 'string' ? (indexSummary[k] as string) : '—'
              return (
                <div
                  key={k}
                  className={`rounded-md border bg-gradient-to-br ${AXIS_GRADIENT[k]} px-3 py-2`}
                >
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${AXIS_TEXT[k]}`}>
                    {WELLBEING_AXIS_LABELS[k]}
                  </div>
                  <div className="mt-0.5 text-2xl font-bold text-neutral-900">{score}</div>
                  <div className="text-[10px] text-neutral-500">{WELLBEING_AXIS_LAW[k]}</div>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-neutral-200">
        <TabButton active={tab === 'strategi'} onClick={() => setTab('strategi')} icon={Target}>
          Strategi
        </TabButton>
        <TabButton active={tab === 'analyse'} onClick={() => setTab('analyse')} icon={BarChart3}>
          Analyse
        </TabButton>
        <TabButton active={tab === 'verktoy'} onClick={() => setTab('verktoy')} icon={Wrench}>
          Verktøy
        </TabButton>
      </nav>

      {tab === 'strategi' && (
        <section className="space-y-6">
          <StrategyVisionEditor
            visionMd={wellbeingStrategy.strategy?.vision_md}
            missionMd={wellbeingStrategy.strategy?.mission_md}
            canManage={wellbeingStrategy.canManage}
            onSave={wellbeingStrategy.saveStrategy}
          />
          <FocusAreasGrid
            areas={wellbeingStrategy.focusAreas}
            canManage={wellbeingStrategy.canManage}
            onCreate={wellbeingStrategy.createFocusArea}
            onUpdate={wellbeingStrategy.updateFocusArea}
            onArchive={wellbeingStrategy.archiveFocusArea}
          />
          <SnapshotPanel
            accent={accent}
            currentPeriodKey={snapshots.currentPeriodKey}
            hasCurrentMonth={snapshots.hasCurrentMonth}
            latestCapturedAt={snapshots.latest?.captured_at ?? null}
            indexLabel={indexLabel}
            indexDelta={indexDelta}
            historyCount={snapshots.snapshots.length}
            error={snapshots.error}
            disabled={rawScores.index == null}
            onCapture={handleManualSnapshot}
          />
          {wellbeingStrategy.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {wellbeingStrategy.error}
            </div>
          )}
        </section>
      )}

      {tab === 'analyse' && (
        <>
          <ModuleAnalyticsDashboard
            accent={accent}
            breadcrumb={[
              { label: 'Arbeidsflate', to: '/' },
              { label: 'Arbeidsmiljøstrategi', to: '/overview/arbeidsmiljostrategi' },
              { label: 'Analyse' },
            ]}
            title="Akser, signaler og neste steg"
            description="Bygget fra de samme modulene dere allerede bruker — bare sett gjennom en arbeidstaker-linse."
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
            headerActions={<div className="flex flex-wrap items-center gap-2">{editChrome.toggleButton}</div>}
            layout={layout}
            datasets={datasets}
            loading={
              cl.loading ||
              survey.loading ||
              learning.learningLoading ||
              docs.loading ||
              dashboard.loading ||
              wellbeingStrategy.loading
            }
            error={cl.error ?? survey.error ?? learning.learningError ?? docs.error ?? dashboard.error}
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
            scopeId={WORKER_WELLBEING_SCOPE_ID}
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
      )}

      {tab === 'verktoy' && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Verktøyene som driver strategien</h2>
            <p className="text-xs text-neutral-600">
              Alt eksisterer allerede i NewAMU. Klikk inn på et verktøy for å sette det opp eller
              gjennomgå dagens bruk.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <li
                key={`${tool.axis}:${tool.title}`}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <span
                  className={`inline-flex shrink-0 self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    tool.axis === 'trygghet'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : tool.axis === 'trivsel'
                      ? 'border-purple-300 bg-purple-50 text-purple-900'
                      : tool.axis === 'medvirkning'
                      ? 'border-blue-300 bg-blue-50 text-blue-900'
                      : 'border-teal-300 bg-teal-50 text-teal-900'
                  }`}
                >
                  {WELLBEING_AXIS_LABELS[tool.axis]}
                </span>
                <h3 className="text-sm font-semibold text-neutral-900">{tool.title}</h3>
                <p className="text-xs leading-relaxed text-neutral-600">{tool.description}</p>
                <Link
                  to={tool.path}
                  className="mt-auto inline-flex items-center gap-1.5 self-start text-xs font-semibold text-amber-800 hover:text-amber-900"
                >
                  Åpne <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-amber-600 text-amber-900'
          : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:text-neutral-700'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  )
}

function SnapshotPanel({
  accent,
  currentPeriodKey,
  hasCurrentMonth,
  latestCapturedAt,
  indexLabel,
  indexDelta,
  historyCount,
  error,
  disabled,
  onCapture,
}: {
  accent: string
  currentPeriodKey: string
  hasCurrentMonth: boolean
  latestCapturedAt: string | null
  indexLabel: string
  indexDelta: string
  historyCount: number
  error: string | null
  disabled: boolean
  onCapture: () => void | Promise<void>
}) {
  const latestLabel = latestCapturedAt
    ? new Date(latestCapturedAt).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Aldri'
  return (
    <section
      className="rounded-lg border p-5"
      style={{ borderColor: `${accent}40`, background: `linear-gradient(to right, ${accent}0d, ${accent}03)` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
            <Camera className="h-3.5 w-3.5" aria-hidden /> Snapshot
          </div>
          <h2 className="text-base font-semibold text-neutral-900">
            {currentPeriodKey} — {hasCurrentMonth ? 'lagret denne måneden' : 'ikke lagret ennå'}
          </h2>
          <p className="max-w-xl text-xs text-neutral-600">
            Et månedlig snapshot låser dagens indeks- og akse-skår sammen med vektene
            som ble brukt. Snapshotene fyller indeks-linja og lar styrer og AMU spore
            framgang over tid. Vi tar automatisk ett ved hvert besøk; knappen tvinger
            en oppdatering om noe har endret seg.
          </p>
          <p className="text-[11px] text-neutral-500">
            Siste capture: <span className="font-medium text-neutral-700">{latestLabel}</span>
            {historyCount > 0 && <span> · {historyCount} totalt</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Nåværende indeks</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: accent }}>
                {indexLabel}
              </span>
              {indexDelta && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    indexDelta.startsWith('+')
                      ? 'bg-emerald-100 text-emerald-900'
                      : indexDelta.startsWith('-')
                      ? 'bg-rose-100 text-rose-900'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {indexDelta}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onCapture()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" aria-hidden /> Lagre snapshot nå
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      )}
    </section>
  )
}
