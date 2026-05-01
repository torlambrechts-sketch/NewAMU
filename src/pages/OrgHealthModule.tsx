import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookMarked,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  HeartPulse,
  Lock,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import { AML_REPORT_KINDS, labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { definitionForKey } from '../data/orgHealthMetrics'
import {
  TEMPLATE_CATEGORIES,
  type SurveyTemplateCatalogRow,
} from '../../modules/survey/surveyTemplateCatalogTypes'
import { useDocuments } from '../hooks/useDocuments'
import { useOrgHealth, type SurveyCloseSideEffect } from '../hooks/useOrgHealth'
import { useWorkplaceReportingCases } from '../hooks/useWorkplaceReportingCases'
import { useOrganisation } from '../hooks/useOrganisation'
import { useWorkplaceKpiStripStyle } from '../hooks/useWorkplaceKpiStripStyle'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import {
  SURVEY_K_ANONYMITY_MIN,
  countActiveEmployeesInUserGroup,
  evaluateSurveyAnonymityGate,
} from '../lib/orgSurveyKAnonymity'
import {
  INSIGHT_CARD,
  INSIGHT_CARD_TOP_RULE,
  ModuleDonutCard,
  ModuleFilledListCard,
  type InsightSeg,
} from '../components/insights/ModuleInsightCharts'
import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import type { HubMenu1Item } from '../components/layout/HubMenu1Bar'
import type { ContentBlock } from '../types/documents'
import type { LaborMetricKey, Survey, SurveyQuestion, SurveySchedule, SurveyScheduleKind } from '../types/orgHealth'

const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'

/** Same strip boxes as HSE oversikt */
const OH_THRESHOLD_STRIP = SETTINGS_THRESHOLD_BOX

const SURVEY_STATUS_LABELS = { draft: 'Utkast', open: 'Åpen', closed: 'Lukket' } as const

function escapeWikiHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: HeartPulse, iconOnly: false as const },
  { id: 'surveys' as const, label: 'Undersøkelser', icon: ClipboardCheck, iconOnly: false as const },
  { id: 'nav' as const, label: 'Sykefravær (NAV)', icon: FileSpreadsheet, iconOnly: false as const },
  { id: 'metrics' as const, label: 'AML-indikatorer', icon: BarChart3, iconOnly: false as const },
] as const

export function OrgHealthModule() {
  const oh = useOrgHealth()
  const wr = useWorkplaceReportingCases()
  const org = useOrganisation()
  const { addTask } = useTasks()
  const docs = useDocuments()
  const { barStyle: kpiStripStyle } = useWorkplaceKpiStripStyle()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const { supabaseConfigured } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check scheduled surveys on every mount
  useMemo(() => {
    oh.checkAndTriggerSchedules()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const navigate = useNavigate()

  useEffect(() => {
    if (tabParam === 'audit') {
      queueMicrotask(() => navigate('/workspace/revisjonslogg?source=org_health', { replace: true }))
    }
  }, [tabParam, navigate])

  useEffect(() => {
    if (tabParam === 'reporting') {
      queueMicrotask(() => navigate('/workplace-reporting/anonymous-aml', { replace: true }))
    }
  }, [tabParam, navigate])

  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })
  const [surveySearch, setSurveySearch] = useState('')
  const [surveyPanelId, setSurveyPanelId] = useState<string | null>(null)
  const [respondSurveyId, setRespondSurveyId] = useState('')
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [navForm, setNavForm] = useState({
    periodLabel: '',
    periodStart: '',
    periodEnd: '',
    sickLeavePercent: '',
    selfCertifiedDays: '',
    documentedSickDays: '',
    employeeCount: '',
    notes: '',
    sourceNote: 'Manuell registrering fra NAV A-melding / sykefraværsstatistikk.',
  })
  const [metricForm, setMetricForm] = useState({
    metricKey: 'work_environment_assessment' as LaborMetricKey,
    periodStart: '',
    periodEnd: '',
    value: '',
    textValue: '',
    notes: '',
  })
  const openSurveys = useMemo(
    () => oh.surveys.filter((s) => s.status === 'open'),
    [oh.surveys],
  )

  const activeRespondSurvey = respondSurveyId
    ? oh.surveys.find((s) => s.id === respondSurveyId)
    : openSurveys[0]

  const surveysFiltered = useMemo(() => {
    const q = surveySearch.trim().toLowerCase()
    let list = [...oh.surveys]
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          (s.targetGroupLabel ?? '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return list
  }, [oh.surveys, surveySearch])

  const surveyStats = useMemo(() => {
    const list = oh.surveys
    return {
      total: list.length,
      open: list.filter((s) => s.status === 'open').length,
      draft: list.filter((s) => s.status === 'draft').length,
      closed: list.filter((s) => s.status === 'closed').length,
    }
  }, [oh.surveys])

  const ohOverviewKpis = useMemo(
    () => [
      {
        title: 'Undersøkelser',
        sub: 'Åpne / totalt',
        value: `${surveyStats.open} / ${surveyStats.total}`,
      },
      {
        title: 'Svar',
        sub: 'Innsendte svar (totalt)',
        value: String(oh.responses.length),
      },
      {
        title: 'Sykefravær (NAV)',
        sub: 'Siste registrerte %',
        value: oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—',
      },
      {
        title: 'Anonym AML',
        sub: 'Henvendelser (totalt)',
        value: String(wr.amlReportStats.total),
      },
    ],
    [wr.amlReportStats.total, oh.navSummary.latestPercent, oh.responses.length, surveyStats],
  )

  const ohSurveyStatusSegments = useMemo(() => {
    const palette = ['#94a3b8', '#059669', '#64748b']
    const entries: InsightSeg[] = [
      { label: SURVEY_STATUS_LABELS.draft, value: surveyStats.draft, color: palette[0] },
      { label: SURVEY_STATUS_LABELS.open, value: surveyStats.open, color: palette[1] },
      { label: SURVEY_STATUS_LABELS.closed, value: surveyStats.closed, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [surveyStats])

  const ohSurveyAnonSegments = useMemo(() => {
    const palette = ['#1a3d32', '#0284c7']
    let anon = 0
    let named = 0
    for (const s of oh.surveys) {
      if (s.anonymous) anon += 1
      else named += 1
    }
    const entries: InsightSeg[] = [
      { label: 'Anonyme', value: anon, color: palette[0] },
      { label: 'Navngitte', value: named, color: palette[1] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [oh.surveys])

  const ohAmlKindSegments = useMemo(() => {
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#64748b']
    const kinds = AML_REPORT_KINDS.map((k) => k.id)
    const entries: InsightSeg[] = kinds
      .map((kind, idx) => ({
        label: labelForAmlReportKind(kind),
        value: wr.amlReportStats.byKind[kind] ?? 0,
        color: palette[idx % palette.length],
      }))
      .filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [wr.amlReportStats.byKind])

  const ohNavPeriodRows = useMemo(() => {
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#0d9488', '#7c3aed', '#dc2626']
    const rows: InsightSeg[] = oh.navReports
      .filter((r) => r.sickLeavePercent != null)
      .slice(0, 8)
      .map((r, idx) => ({
        label: r.periodLabel || `${r.periodStart}–${r.periodEnd}`,
        value: r.sickLeavePercent ?? 0,
        color: palette[idx % palette.length],
      }))
    return rows
  }, [oh.navReports])

  const ohMetricKeyRows = useMemo(() => {
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#0d9488', '#7c3aed', '#dc2626', '#64748b']
    const byKey = new Map<LaborMetricKey, number>()
    for (const e of oh.laborMetrics) {
      byKey.set(e.metricKey, (byKey.get(e.metricKey) ?? 0) + 1)
    }
    const rows: InsightSeg[] = Array.from(byKey.entries())
      .map(([key, count], idx) => ({
        label: definitionForKey(key)?.label ?? key,
        value: count,
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.value - a.value)
    return rows
  }, [oh.laborMetrics])

  const closeSurveyPanel = useCallback(() => setSurveyPanelId(null), [setSurveyPanelId])

  const onLowPsychSafetyClose = useCallback(
    (ev: SurveyCloseSideEffect) => {
      addTask({
        title: `Arbeidsmiljøoppfølging: ${ev.targetLabel ?? 'målgruppe'} (psykologisk trygghet)`,
        description: `Undersøkelse «${ev.surveyTitle}» er lukket med lav gjennomsnittsscore på psykologisk trygghet (snitt ${ev.psychSafetyMean} på skala der høyere er bedre, n=${ev.responseCount}).\n\nI henhold til AML § 3-1 skal arbeidsmiljøet kartlegges og følges opp systematisk. Initier oppfølging i målgruppen og dokumenter tiltak.`,
        status: 'todo',
        assignee: 'HR / HMS',
        dueDate: new Date().toISOString().slice(0, 10),
        module: 'org_health',
        sourceType: 'survey',
        sourceId: ev.surveyId,
        sourceLabel: ev.surveyTitle,
        ownerRole: 'HR Manager',
        requiresManagementSignOff: true,
      })
    },
    [addTask],
  )

  const handleCloseSurveyFromPanel = useCallback(
    (id: string) => {
      oh.closeSurvey(id, { onLowPsychSafety: onLowPsychSafetyClose })
    },
    [oh, onLowPsychSafetyClose],
  )

  const handleAmuShare = useCallback(
    async (survey: Survey) => {
      const agg = oh.aggregates[survey.id]
      const group = survey.targetGroupId ? org.groups.find((g) => g.id === survey.targetGroupId) : undefined
      const gate = evaluateSurveyAnonymityGate({
        anonymous: survey.anonymous,
        targetGroup: group,
        responseCount: agg?.count ?? 0,
        employees: org.displayEmployees,
        units: org.units,
        orgHeadcountFallback: Math.max(org.totalEmployeeCount, 1),
      })
      const lines: string[] = []
      lines.push(`Generert: ${new Date().toLocaleString('no-NO')}`)
      lines.push(`Målgruppe: ${survey.targetGroupLabel ?? '—'}`)
      lines.push(`Svar (n): ${agg?.count ?? 0}`)
      if (survey.anonymous) {
        lines.push(
          gate.canShowDetailedResults
            ? `k-anonymitet: målgruppe n≥${SURVEY_K_ANONYMITY_MIN} og svar n≥${SURVEY_K_ANONYMITY_MIN} (OK).`
            : `ADVARSEL: Resultater under k=${SURVEY_K_ANONYMITY_MIN} — vis kun aggregerte tall på høyere nivå. Dette dokumentet inneholder ikke rå fritekst.`,
        )
      }
      if (agg && agg.count > 0) {
        lines.push('Likert-snitt per spørsmål:')
        for (const q of survey.questions) {
          const isL = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
          if (!isL) continue
          const m = agg.likertMeans[q.id]
          if (m != null) lines.push(`  • ${q.text.slice(0, 120)}${q.text.length > 120 ? '…' : ''}: ${m}`)
        }
        const subs = Object.keys(agg.subscaleMeans ?? {})
        if (subs.length) {
          lines.push('Del-skala (gjennomsnitt av spørsmålssnitt):')
          for (const sub of subs.sort()) {
            lines.push(`  • ${sub}: ${agg.subscaleMeans[sub]}`)
          }
        }
        if (survey.anonymous) {
          lines.push('Fritekst: ikke vedlagt (anonym modus — kun antall som har levert fritekst i undersøkelsesverktøyet).')
        }
      } else {
        lines.push('Ingen svar å rapportere ennå.')
      }
      lines.push('')
      lines.push('Forslag til AMU-sak: Gjennomgå tallene og beslutte eventuelle tiltak jf. AML § 7-2 og § 4-3.')

      const htmlBody = lines.map((l) => escapeWikiHtml(l)).join('<br/>')
      const blocks: ContentBlock[] = [
        {
          kind: 'alert',
          variant: 'info',
          text: 'Dette dokumentet inneholder kun statistikk til bruk i AMU. Rå fritekst fra undersøkelsen er ikke inkludert.',
        },
        { kind: 'heading', level: 2, text: 'Sammendrag' },
        { kind: 'text', body: `<p>${htmlBody}</p>` },
        {
          kind: 'law_ref',
          ref: 'AML § 7-2',
          description: 'AMU skal delta i arbeidet med å fullføre og holde ajour bedriftens oversikt over risofaktorer i arbeidsmiljøet.',
        },
      ]

      const spaceId = docs.spaces[0]?.id
      if (!spaceId) {
        window.alert('Opprett minst ett dokumentområde under Dokumenter før du deler til AMU.')
        return
      }
      try {
        const page = await docs.createPage(
          spaceId,
          `AMU — ${survey.title.slice(0, 72)}`,
          'standard',
          blocks,
          {
            summary: 'Statistisk sammendrag for AMU (uten fritekst).',
            legalRefs: ['AML § 7-2', 'AML § 4-3'],
          },
        )
        await docs.publishPage(page.id)
        oh.markSurveyAmuShared(survey.id)
        navigate(`/documents/page/${page.id}`)
      } catch (e) {
        console.warn(e)
        window.alert('Kunne ikke opprette wiki-side. Prøv igjen eller sjekk tilkobling.')
      }
    },
    [docs, navigate, oh, org.displayEmployees, org.groups, org.totalEmployeeCount, org.units],
  )

  useEffect(() => {
    if (!surveyPanelId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [surveyPanelId])

  useEffect(() => {
    if (!surveyPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSurveyPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [surveyPanelId, closeSurveyPanel])

  const surveyOpenCount = useMemo(() => oh.surveys.filter((s) => s.status === 'open').length, [oh.surveys])

  const ohHubItems: HubMenu1Item[] = useMemo(
    () => [
      ...tabs.map(({ id, label, icon: Icon }) => ({
        key: id,
        label,
        icon: Icon,
        active: tab === id,
        to: `/org-health?tab=${id}`,
        badgeCount: id === 'surveys' && surveyOpenCount > 0 ? surveyOpenCount : undefined,
      })),
      {
        key: 'settings',
        label: 'Veikart',
        icon: BookMarked,
        active: false,
        to: '/org-health/settings',
      },
    ],
    [tab, surveyOpenCount],
  )

  return (
    <>
      <ComplianceModuleChrome
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Samsvar', to: '/compliance' },
          { label: 'Organisasjonshelse' },
        ]}
        title="Organisasjonshelse"
        description={
          <p className="max-w-2xl">
            Medarbeiderundersøkelser (valgfritt anonyme), aggregerte resultater, sykefravær fra NAV-rapportering
            (manuell import), og AML-relaterte indikatorer. Ikke juridisk eller medisinsk rådgivning — verifiser mot{' '}
            <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>{' '}
            og interne kilder.
          </p>
        }
        hubAriaLabel="Organisasjonshelse — faner"
        hubItems={ohHubItems}
      >
        {oh.error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{oh.error}</p>
        )}
        {oh.loading && supabaseConfigured && (
          <p className="mb-4 text-sm text-neutral-500">Laster organisasjonshelse-data…</p>
        )}

      {tab === 'overview' && (
        <div className="mt-6 space-y-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ohOverviewKpis.map((item) => (
              <div key={item.title} className={OH_THRESHOLD_STRIP} style={kpiStripStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Organisasjonshelse-innsikt</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ModuleDonutCard
                title="Undersøkelser etter status"
                subtitle="Utkast, åpne og lukkede"
                segments={ohSurveyStatusSegments.entries}
                total={ohSurveyStatusSegments.total}
                emptyHint="Ingen undersøkelser ennå."
              />
              <ModuleDonutCard
                title="Undersøkelser"
                subtitle="Anonyme vs. navngitte"
                segments={ohSurveyAnonSegments.entries}
                total={ohSurveyAnonSegments.total}
                emptyHint="Ingen undersøkelser å vise."
              />
              <ModuleDonutCard
                title="Anonyme AML-henvendelser"
                subtitle="Fordeling etter kategori (uten fritekst)"
                segments={ohAmlKindSegments.entries}
                total={ohAmlKindSegments.total}
                emptyHint="Ingen anonyme henvendelser registrert."
              />
              <ModuleFilledListCard
                title="Sykefravær per periode"
                subtitle="Siste NAV-rader med prosent (nyeste først)"
                rows={ohNavPeriodRows}
                emptyHint="Ingen sykefraværsrader med prosent."
                valueSuffix="%"
              />
              <ModuleFilledListCard
                title="AML-indikatorer"
                subtitle="Antall registreringer per indikator"
                rows={ohMetricKeyRows}
                emptyHint="Ingen indikatorer registrert ennå."
              />
              <div className={INSIGHT_CARD}>
                <div className={INSIGHT_CARD_TOP_RULE} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Drift og snarveier</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-[#1a3d32]">
                  {oh.navSummary.avgPercent != null ? `${oh.navSummary.avgPercent}%` : '—'}
                </p>
                <p className="mt-1 text-sm text-neutral-600">Gjennomsnitt sykefravær (NAV-felt)</p>
                <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm text-neutral-700">
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Åpne undersøkelser</span>
                    <span className="font-semibold tabular-nums">{surveyStats.open}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Lukket med lav psyk. trygghet (oppgaver)</span>
                    <span className="font-semibold tabular-nums text-amber-800">
                      {oh.surveys.filter((s) => s.lowPsychSafetyTaskCreatedAt).length}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setTab('surveys')}
                    className="text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                  >
                    Undersøkelser →
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('nav')}
                    className="text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                  >
                    Sykefravær (NAV) →
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('metrics')}
                    className="text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                  >
                    AML-indikatorer →
                  </button>
                  <Link
                    to="/workplace-reporting/anonymous-aml"
                    className="block text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                  >
                    Anonym rapportering →
                  </Link>
                  <Link
                    to="/org-health/settings"
                    className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                  >
                    Veikart & planer →
                  </Link>
                  <Link to="/internal-control" className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline">
                    Internkontroll →
                  </Link>
                </div>
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <AddTaskLink
                    title="Oppfølging organisasjonshelse"
                    module="org_health"
                    sourceType="manual"
                    ownerRole="HR / HMS"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className={`${R_FLAT} border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950`}>
            <strong>k-anonymitet:</strong> Ved anonyme undersøkelser vises detaljerte resultater først når terskelen n≥
            {SURVEY_K_ANONYMITY_MIN} er oppfylt — se fanen Undersøkelser.
          </div>
        </div>
      )}

      {tab === 'surveys' && (
        <div className="mt-8 space-y-6">
          <div className={`${R_FLAT} flex items-start gap-3 border border-sky-200 bg-sky-50 px-4 py-3`}>
            <Lock className="mt-0.5 size-4 shrink-0 text-sky-800" />
            <p className="text-sm text-sky-950">
              <strong>k-anonymitet (n≥{SURVEY_K_ANONYMITY_MIN}):</strong> For anonyme undersøkelser vises detaljerte
              resultater kun når både målgruppen og antall svar er minst {SURVEY_K_ANONYMITY_MIN}. Ellers må resultater
              rapporteres på høyere nivå (større enhet eller hele virksomheten) for å redusere risiko for
              gjenkjenning — jf. Datatilsynets veiledning og GDPR.
            </p>
          </div>

          <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Undersøkelser
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Vitenskapelig forankrede maler (UWES, psykologisk trygghet, re:Work). Resultater og simulering i samme
                opplegg som rapporter — med sidepanel for administrasjon og k-anonyme visningsregler.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Totalt <strong className="ml-1 font-semibold">{surveyStats.total}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-900`}>
                  Åpne <strong className="ml-1 font-semibold">{surveyStats.open}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                  Utkast <strong className="ml-1 font-semibold">{surveyStats.draft}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-700`}>
                  Lukket <strong className="ml-1 font-semibold">{surveyStats.closed}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSurveyPanelId('__new__')}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny undersøkelse
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${R_FLAT} ${SETTINGS_THRESHOLD_BOX}`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{surveyStats.total}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Registrert</div>
            </div>
            <div className={`${R_FLAT} ${SETTINGS_THRESHOLD_BOX}`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{surveyStats.open}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Aktive</div>
            </div>
            <div className={`${R_FLAT} ${SETTINGS_THRESHOLD_BOX}`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{oh.responses.length}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Svar totalt</div>
            </div>
            <div className={`${R_FLAT} ${SETTINGS_THRESHOLD_BOX}`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{SURVEY_K_ANONYMITY_MIN}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Min. n (k-anonymitet)</div>
            </div>
          </div>

          <Mainbox1
            title="Alle undersøkelser"
            subtitle="Sortert etter opprettet. Åpne en rad i sidevinduet for plan, spørsmål, resultater og deling til AMU."
          >
            <Table1Shell
              variant="pinpoint"
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor="oh-survey-search">
                        Søk
                      </label>
                      <input
                        id="oh-survey-search"
                        value={surveySearch}
                        onChange={(e) => setSurveySearch(e.target.value)}
                        placeholder="Søk i tittel, målgruppe …"
                        className={`${SETTINGS_INPUT} bg-white`}
                      />
                    </div>
                  }
                />
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className={theadRow}>
                      <th className={tableCell}>Tittel</th>
                      <th className={tableCell}>Status</th>
                      <th className={tableCell}>Målgruppe</th>
                      <th className={tableCell}>Svar</th>
                      <th className={tableCell}>Personvern</th>
                      <th className={`${tableCell} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveysFiltered.map((s, ri) => {
                      const agg = oh.aggregates[s.id]
                      const n = agg?.count ?? 0
                      const group = s.targetGroupId ? org.groups.find((g) => g.id === s.targetGroupId) : undefined
                      const gate = evaluateSurveyAnonymityGate({
                        anonymous: s.anonymous,
                        targetGroup: group,
                        responseCount: n,
                        employees: org.displayEmployees,
                        units: org.units,
                        orgHeadcountFallback: Math.max(org.totalEmployeeCount, 1),
                      })
                      return (
                        <tr key={s.id} className={table1BodyRowClass(layout, ri)}>
                          <td className={tableCell}>
                            <div className="max-w-[240px] font-medium text-neutral-900">{s.title}</div>
                            <div className="text-xs text-neutral-500">{s.questions.length} spørsmål</div>
                          </td>
                          <td className={tableCell}>
                            <span
                              className={`${R_FLAT} border px-2 py-0.5 text-xs font-medium ${
                                s.status === 'open'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                  : s.status === 'draft'
                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                    : 'border-neutral-200 bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {s.status === 'open' ? 'Åpen' : s.status === 'draft' ? 'Utkast' : 'Lukket'}
                            </span>
                          </td>
                          <td className={`${tableCell} text-neutral-600`}>
                            {s.targetGroupLabel ?? '—'}
                            {s.anonymous && !gate.targetMeetsK ? (
                              <div className="mt-1 text-xs text-amber-700">Liten målgruppe (n={gate.targetCount})</div>
                            ) : null}
                          </td>
                          <td className={tableCell}>
                            <span className="tabular-nums">{n}</span>
                            {s.anonymous && n > 0 && !gate.responsesMeetK ? (
                              <div className="text-xs text-amber-700">&lt; {SURVEY_K_ANONYMITY_MIN}</div>
                            ) : null}
                          </td>
                          <td className={tableCell}>
                            {s.anonymous ? (
                              <span className={`${R_FLAT} border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs`}>
                                Anonym
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-500">Identifiserbar</span>
                            )}
                          </td>
                          <td className={`${tableCell} text-right`}>
                            <button
                              type="button"
                              onClick={() => setSurveyPanelId(s.id)}
                              className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                            >
                              Åpne
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {surveysFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">Ingen undersøkelser matcher søket.</p>
              ) : null}
            </Table1Shell>
          </Mainbox1>

          <Mainbox1 title="Simuler svar (demo)" subtitle="Én innsending per nettleserøkt. Anonyme undersøkelser lagrer ikke fritekstinnhold.">
            <div className="border-t border-neutral-100 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap gap-3">
                <select
                  value={activeRespondSurvey?.id ?? ''}
                  onChange={(e) => {
                    setRespondSurveyId(e.target.value)
                    setAnswers({})
                  }}
                  className={`${SETTINGS_INPUT} w-auto max-w-md bg-white`}
                >
                  {openSurveys.length === 0 ? (
                    <option value="">Ingen åpne undersøkelser</option>
                  ) : (
                    openSurveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {activeRespondSurvey && activeRespondSurvey.status === 'open' ? (
                <ResponseForm
                  survey={activeRespondSurvey}
                  answers={answers}
                  setAnswers={setAnswers}
                  onSubmit={() => {
                    for (const q of activeRespondSurvey.questions) {
                      if (!q.required) continue
                      const isLikert = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
                      if (isLikert && answers[q.id] == null) {
                        alert(`Besvar: ${q.text.slice(0, 80)}…`)
                        return
                      }
                      if (q.type === 'yes_no' && answers[q.id] == null) {
                        alert(`Besvar: ${q.text.slice(0, 80)}…`)
                        return
                      }
                      if (
                        q.type === 'text' &&
                        !(typeof answers[q.id] === 'string' && String(answers[q.id]).trim())
                      ) {
                        alert(`Besvar: ${q.text.slice(0, 80)}…`)
                        return
                      }
                    }
                    const ok = oh.submitResponse(activeRespondSurvey.id, answers)
                    if (ok) setAnswers({})
                    else alert('Kunne ikke sende (allerede svart eller lukket).')
                  }}
                />
              ) : (
                <p className="mt-4 text-sm text-neutral-500">Velg en åpen undersøkelse.</p>
              )}
            </div>
          </Mainbox1>
        </div>
      )}

      {tab === 'nav' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <strong>NAV / A-melding:</strong> Ekte sykefraværsdata hentes fra lønns- og personalsystem via NAVs
            rapportering. Her registrerer du <strong>aggregerte tall manuelt</strong> (f.eks. fra sykefraværsrapport
            eller lederverktøy). Kobling til API kan legges til senere.
          </div>
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer periode</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!navForm.periodLabel.trim() || !navForm.periodStart || !navForm.periodEnd) return
                oh.addNavReport({
                  periodLabel: navForm.periodLabel.trim(),
                  periodStart: navForm.periodStart,
                  periodEnd: navForm.periodEnd,
                  sickLeavePercent: navForm.sickLeavePercent
                    ? Number(navForm.sickLeavePercent)
                    : null,
                  selfCertifiedDays: navForm.selfCertifiedDays
                    ? Number(navForm.selfCertifiedDays)
                    : null,
                  documentedSickDays: navForm.documentedSickDays
                    ? Number(navForm.documentedSickDays)
                    : null,
                  employeeCount: navForm.employeeCount ? Number(navForm.employeeCount) : null,
                  notes: navForm.notes,
                  sourceNote: navForm.sourceNote,
                })
                setNavForm((n) => ({
                  ...n,
                  periodLabel: '',
                  sickLeavePercent: '',
                  selfCertifiedDays: '',
                  documentedSickDays: '',
                }))
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Periodenavn</label>
                <input
                  value={navForm.periodLabel}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodLabel: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="F.eks. Februar 2026"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Fra</label>
                <input
                  type="date"
                  value={navForm.periodStart}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodStart: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Til</label>
                <input
                  type="date"
                  value={navForm.periodEnd}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodEnd: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Sykefravær (% av avtalt tid)</label>
                <input
                  type="number"
                  step="0.1"
                  value={navForm.sickLeavePercent}
                  onChange={(e) => setNavForm((n) => ({ ...n, sickLeavePercent: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Antall ansatte (nevner)</label>
                <input
                  type="number"
                  value={navForm.employeeCount}
                  onChange={(e) => setNavForm((n) => ({ ...n, employeeCount: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Egenmelding — dager (totalt)</label>
                <input
                  type="number"
                  value={navForm.selfCertifiedDays}
                  onChange={(e) => setNavForm((n) => ({ ...n, selfCertifiedDays: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Sykmelding — dager (totalt)</label>
                <input
                  type="number"
                  value={navForm.documentedSickDays}
                  onChange={(e) => setNavForm((n) => ({ ...n, documentedSickDays: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Kilde / merknad</label>
                <input
                  value={navForm.sourceNote}
                  onChange={(e) => setNavForm((n) => ({ ...n, sourceNote: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea
                  value={navForm.notes}
                  onChange={(e) => setNavForm((n) => ({ ...n, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <Activity className="size-4" />
                Lagre periode
              </button>
            </form>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Historikk</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-600">
                    <th className="px-4 py-3 font-medium">Periode</th>
                    <th className="px-4 py-3 font-medium">Sykefravær %</th>
                    <th className="px-4 py-3 font-medium">Egenmelding (d)</th>
                    <th className="px-4 py-3 font-medium">Sykmelding (d)</th>
                    <th className="px-4 py-3 font-medium">Ansatte</th>
                    <th className="px-4 py-3 font-medium">Oppgave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {oh.navReports.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{r.periodLabel}</div>
                        <div className="text-xs text-neutral-500">
                          {r.periodStart} — {r.periodEnd}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.sickLeavePercent != null ? `${r.sickLeavePercent}%` : '—'}
                      </td>
                      <td className="px-4 py-3">{r.selfCertifiedDays ?? '—'}</td>
                      <td className="px-4 py-3">{r.documentedSickDays ?? '—'}</td>
                      <td className="px-4 py-3">{r.employeeCount ?? '—'}</td>
                      <td className="px-4 py-3 align-top">
                        <AddTaskLink
                          title={`IA-oppfølging sykefravær ${r.periodLabel}`}
                          description={r.notes?.slice(0, 200)}
                          module="org_health"
                          sourceType="nav_report"
                          sourceId={r.id}
                          sourceLabel={r.periodLabel}
                          ownerRole="Leder / IA"
                          requiresManagementSignOff
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'metrics' && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer indikator</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!metricForm.periodStart || !metricForm.periodEnd) return
                const def = definitionForKey(metricForm.metricKey)
                oh.addLaborMetric({
                  metricKey: metricForm.metricKey,
                  periodStart: metricForm.periodStart,
                  periodEnd: metricForm.periodEnd,
                  value: metricForm.value ? Number(metricForm.value) : null,
                  textValue: metricForm.textValue || undefined,
                  unit: def?.unit ?? '',
                  notes: metricForm.notes,
                })
                setMetricForm((m) => ({ ...m, value: '', textValue: '', notes: '' }))
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Indikator</label>
                <select
                  value={metricForm.metricKey}
                  onChange={(e) =>
                    setMetricForm((m) => ({ ...m, metricKey: e.target.value as LaborMetricKey }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  {oh.metricDefinitions.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Fra</label>
                <input
                  type="date"
                  value={metricForm.periodStart}
                  onChange={(e) => setMetricForm((m) => ({ ...m, periodStart: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Til</label>
                <input
                  type="date"
                  value={metricForm.periodEnd}
                  onChange={(e) => setMetricForm((m) => ({ ...m, periodEnd: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Tallverdi (valgfritt)</label>
                <input
                  type="number"
                  value={metricForm.value}
                  onChange={(e) => setMetricForm((m) => ({ ...m, value: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Tekst / status (valgfritt)</label>
                <input
                  value={metricForm.textValue}
                  onChange={(e) => setMetricForm((m) => ({ ...m, textValue: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea
                  value={metricForm.notes}
                  onChange={(e) => setMetricForm((m) => ({ ...m, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <Send className="size-4" />
                Lagre
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Definisjoner (AML-orientert)</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {oh.metricDefinitions.map((d) => (
                <li key={d.key} className="px-4 py-4 text-sm">
                  <div className="font-medium text-neutral-900">{d.label}</div>
                  <p className="mt-1 text-neutral-600">{d.description}</p>
                  <p className="mt-1 text-xs text-[#1a3d32]/90">{d.lawRef}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Registrerte målinger</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {oh.laborMetrics.map((m) => {
                const def = definitionForKey(m.metricKey)
                return (
                  <li key={m.id} className="px-4 py-3 text-sm">
                    <span className="font-medium text-neutral-900">{def?.label ?? m.metricKey}</span>
                    <span className="text-neutral-600">
                      {' '}
                      — {m.periodStart} til {m.periodEnd}:{' '}
                      {m.value != null ? `${m.value} ${m.unit}` : m.textValue ?? '—'}
                    </span>
                    {m.notes ? <p className="mt-1 text-xs text-neutral-500">{m.notes}</p> : null}
                    <div className="mt-2">
                      <AddTaskLink
                        title={`Tiltak: ${def?.label ?? m.metricKey}`}
                        module="org_health"
                        sourceType="labor_metric"
                        sourceId={m.id}
                        sourceLabel={def?.label}
                        ownerRole="HMS"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {oh.laborMetrics.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">Ingen målinger ennå.</p>
            ) : null}
          </div>
        </div>
      )}
      </ComplianceModuleChrome>

      {surveyPanelId ? (
        <SurveyAdminPanel
          mode={surveyPanelId === '__new__' ? 'create' : 'edit'}
          surveyId={surveyPanelId === '__new__' ? null : surveyPanelId}
          oh={oh}
          org={org}
          onClose={closeSurveyPanel}
          onCreated={(id) => setSurveyPanelId(id)}
          onCloseSurvey={handleCloseSurveyFromPanel}
          onAmuShare={handleAmuShare}
        />
      ) : null}

    </>
  )
}

function SurveyAdminPanel({
  mode,
  surveyId,
  oh,
  org,
  onClose,
  onCreated,
  onCloseSurvey,
  onAmuShare,
}: {
  mode: 'create' | 'edit'
  surveyId: string | null
  oh: ReturnType<typeof useOrgHealth>
  org: ReturnType<typeof useOrganisation>
  onClose: () => void
  onCreated: (id: string) => void
  onCloseSurvey: (id: string) => void
  onAmuShare: (s: Survey) => void | Promise<void>
}) {
  const survey = surveyId ? oh.surveys.find((s) => s.id === surveyId) : undefined
  const aggregate = surveyId ? oh.aggregates[surveyId] : undefined
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<SurveyQuestion['type']>('likert_5')
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)
  const [amuBusy, setAmuBusy] = useState(false)

  if (mode === 'edit' && surveyId && !survey) {
    return null
  }

  const targetGroup = survey?.targetGroupId ? org.groups.find((g) => g.id === survey.targetGroupId) : undefined
  const targetN = survey
    ? countActiveEmployeesInUserGroup(
        targetGroup,
        org.displayEmployees,
        org.units,
        Math.max(org.totalEmployeeCount, 1),
      )
    : 0
  const gate = survey
    ? evaluateSurveyAnonymityGate({
        anonymous: survey.anonymous,
        targetGroup,
        responseCount: aggregate?.count ?? 0,
        employees: org.displayEmployees,
        units: org.units,
        orgHeadcountFallback: Math.max(org.totalEmployeeCount, 1),
      })
    : null

  const sched = survey?.schedule
  const now = new Date()
  const nextRun = sched?.nextRunAt ? new Date(sched.nextRunAt) : null
  const daysUntilNext = nextRun ? Math.ceil((nextRun.getTime() - now.getTime()) / 86400000) : null
  const scheduleLabel = sched ? SCHEDULE_KIND_LABELS[sched.kind] : null

  function likertLabel(t: SurveyQuestion['type']) {
    if (t === 'likert_5') return 'Likert 1–5'
    if (t === 'likert_7') return 'Likert 0–6'
    if (t === 'scale_10') return 'Skala 0–10'
    if (t === 'yes_no') return 'Ja/Nei'
    return 'Fritekst'
  }

  return (
    <>
      <button type="button" aria-label="Lukk" className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {mode === 'create' ? 'Ny undersøkelse' : survey?.title ?? 'Undersøkelse'}
            </h2>
            <p className="text-xs text-neutral-500">
              {mode === 'create' ? 'Opprett fra mal eller egendefinert — deretter rediger og åpne.' : survey?.description}
            </p>
          </div>
          <button type="button" onClick={onClose} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === 'create' ? (
            <div className="p-5">
              <SurveyCreator oh={oh} onCreated={onCreated} />
            </div>
          ) : survey ? (
            <>
              <div className={`${TASK_PANEL_ROW_GRID} border-b border-neutral-200`}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Administrer tidsplan, åpning og resultater. Ved lukking vurderes psykologisk trygghet — ved lav score
                    (n≥{SURVEY_K_ANONYMITY_MIN}) opprettes oppfølgingsoppgave for HR.
                  </p>
                </div>
                <div className={PANEL_INSET}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowScheduleEditor((v) => !v)}
                      className={`${HERO_ACTION_CLASS} border border-sky-300 bg-white text-sky-900`}
                    >
                      <CalendarClock className="size-4" />
                      Planlegg
                    </button>
                    {survey.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => oh.openSurvey(survey.id)}
                        disabled={survey.questions.length === 0}
                        className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white disabled:opacity-40`}
                      >
                        Åpne for svar
                      </button>
                    ) : null}
                    {survey.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => onCloseSurvey(survey.id)}
                        className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                      >
                        Lukk undersøkelse
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={amuBusy || (aggregate?.count ?? 0) === 0}
                      onClick={() => {
                        void (async () => {
                          setAmuBusy(true)
                          try {
                            await onAmuShare(survey)
                          } finally {
                            setAmuBusy(false)
                          }
                        })()
                      }}
                      className={`${HERO_ACTION_CLASS} border border-[#1a3d32] bg-white text-[#1a3d32] disabled:opacity-40`}
                    >
                      Del resultat med AMU
                    </button>
                  </div>
                  {survey.amuSharedSummaryAt ? (
                    <p className="mt-2 text-xs text-emerald-800">
                      Delt {new Date(survey.amuSharedSummaryAt).toLocaleString('no-NO')} — sjekk dokumentbiblioteket.
                    </p>
                  ) : null}
                  {survey.lowPsychSafetyTaskCreatedAt ? (
                    <p className="mt-2 text-xs text-amber-800">
                      Automatisk HR-oppfølgingsoppgave trigget ved lukking (
                      {new Date(survey.lowPsychSafetyTaskCreatedAt).toLocaleString('no-NO')}).
                    </p>
                  ) : null}
                  {sched && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1 border px-2 py-1 font-medium ${sched.enabled ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-neutral-200 bg-neutral-50 text-neutral-500'}`}
                      >
                        <CalendarClock className="size-3.5" />
                        {scheduleLabel}
                        {sched.enabled && daysUntilNext != null ? (
                          <span>{daysUntilNext <= 0 ? ' — nå' : ` — om ${daysUntilNext}d`}</span>
                        ) : null}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {showScheduleEditor && (
                <div className="border-b border-neutral-200 px-5 py-4">
                  <ScheduleEditor
                    current={survey.schedule}
                    onSave={(s) => {
                      oh.setSchedule(survey.id, s)
                      setShowScheduleEditor(false)
                    }}
                    onRemove={() => {
                      oh.setSchedule(survey.id, undefined)
                      setShowScheduleEditor(false)
                    }}
                  />
                </div>
              )}

              {gate && survey.anonymous ? (
                <div
                  className={`mx-5 mt-4 ${R_FLAT} border px-4 py-3 text-sm ${
                    gate.canShowDetailedResults ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <strong>k-anonymitet:</strong> Målgruppe n={gate.targetCount}, svar n={gate.responseCount}.{' '}
                      {gate.canShowDetailedResults
                        ? `Begge er ≥ ${SURVEY_K_ANONYMITY_MIN} — detaljerte tall kan vises.`
                        : 'Resultater skal ikke vises på dette detaljnivået uten oppjustering til større enhet.'}
                      {!gate.canShowDetailedResults && gate.rollupHint ? (
                        <p className="mt-2 text-xs">{gate.rollupHint}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="px-5 py-4">
                <p className={SETTINGS_FIELD_LABEL}>Spørsmål</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {survey.questions.map((q) => {
                    const isLikert = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
                    const showMean =
                      aggregate &&
                      aggregate.count > 0 &&
                      (!survey.anonymous || gate?.canShowDetailedResults) &&
                      isLikert &&
                      aggregate.likertMeans[q.id] != null
                    return (
                      <li key={q.id} className={`${R_FLAT} flex flex-wrap justify-between gap-2 border border-neutral-200 bg-neutral-50/80 px-3 py-2`}>
                        <span className="max-w-[min(100%,420px)]">{q.text}</span>
                        <span className="text-xs text-neutral-500">
                          {likertLabel(q.type)}
                          {q.subscale ? ` · ${q.subscale}` : ''}
                          {showMean ? (
                            <span className="ml-2 font-medium text-[#1a3d32]">
                              snitt {aggregate!.likertMeans[q.id]} (n={aggregate!.count})
                            </span>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {survey.status === 'draft' && (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <p className={SETTINGS_FIELD_LABEL}>Legg til spørsmål</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      placeholder="Nytt spørsmål"
                      className={`${SETTINGS_INPUT} min-w-[200px] flex-1 bg-white`}
                    />
                    <select
                      value={qType}
                      onChange={(e) => setQType(e.target.value as SurveyQuestion['type'])}
                      className={`${SETTINGS_INPUT} w-auto bg-white`}
                    >
                      <option value="likert_5">Likert 1–5</option>
                      <option value="likert_7">Likert 0–6</option>
                      <option value="scale_10">Skala 0–10</option>
                      <option value="yes_no">Ja/Nei</option>
                      <option value="text">Fritekst</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!qText.trim()) return
                        oh.addQuestion(survey.id, qText, qType, true)
                        setQText('')
                      }}
                      className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                    >
                      Legg til
                    </button>
                  </div>
                </div>
              )}

              {aggregate && aggregate.count > 0 && Object.keys(aggregate.subscaleMeans ?? {}).length > 0 ? (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <p className={SETTINGS_FIELD_LABEL}>Del-skala (snitt)</p>
                  {!survey.anonymous || gate?.canShowDetailedResults ? (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {Object.entries(aggregate.subscaleMeans).map(([sub, val]) => (
                        <li key={sub} className={`${R_FLAT} border border-neutral-200 px-3 py-2 text-sm`}>
                          <span className="font-medium text-neutral-900">{sub}</span>
                          <span className="ml-2 tabular-nums text-[#1a3d32]">{val}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-amber-900">
                      Skjult inntil k-anonymitet er oppfylt (målgruppe og svar n≥{SURVEY_K_ANONYMITY_MIN}).
                    </p>
                  )}
                </div>
              ) : null}

              {survey.status === 'closed' && aggregate && aggregate.count > 0 ? (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <AddTaskLink
                    title={`Tiltak etter undersøkelse: ${survey.title.slice(0, 60)}`}
                    module="org_health"
                    sourceType="survey"
                    sourceId={survey.id}
                    sourceLabel={survey.title}
                    ownerRole="HR / leder"
                    requiresManagementSignOff
                  />
                </div>
              ) : null}

              {aggregate && aggregate.count > 0 ? (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <p className={SETTINGS_FIELD_LABEL}>Fritekst</p>
                  {survey.anonymous ? (
                    <div className={`${R_FLAT} mt-2 border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700`}>
                      <p>Innhold lagres ikke. Antall som har levert fritekst:</p>
                      {survey.questions
                        .filter((q) => q.type === 'text')
                        .map((q) => (
                          <p key={q.id} className="mt-2">
                            {q.text.slice(0, 72)}
                            {q.text.length > 72 ? '…' : ''} —{' '}
                            <strong>{aggregate.anonymousTextCount?.[q.id] ?? 0}</strong> (av n={aggregate.count})
                          </p>
                        ))}
                    </div>
                  ) : (
                    <div className={`${R_FLAT} mt-2 border border-neutral-200 bg-neutral-50 p-3 text-xs`}>
                      {survey.questions
                        .filter((q) => q.type === 'text')
                        .map((q) => (
                          <div key={q.id} className="mt-2">
                            <p className="font-medium text-neutral-800">{q.text.slice(0, 80)}</p>
                            {aggregate.textSamples[q.id]?.slice(0, 5).map((t, i) => (
                              <p key={i} className="mt-1 border-l-2 border-[#c9a227] pl-2 text-neutral-700">
                                {t}
                              </p>
                            )) ?? <p className="text-neutral-400">Ingen tekst ennå.</p>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="border-t border-neutral-200 px-5 py-4 text-xs text-neutral-500">
                <p>
                  Målgruppe (aktive i scope): ca. <strong className="text-neutral-800">{targetN}</strong> personer.
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`${HERO_ACTION_CLASS} w-full border border-neutral-300 bg-white text-neutral-800`}
          >
            Lukk
          </button>
        </div>
      </aside>
    </>
  )
}

function ResponseForm({
  survey,
  answers,
  setAnswers,
  onSubmit,
}: {
  survey: Survey
  answers: Record<string, number | string>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, number | string>>>
  onSubmit: () => void
}) {
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-neutral-200 p-4">
      {survey.questions.map((q) => (
        <div key={q.id}>
          <label className="text-sm font-medium text-neutral-900">
            {q.text}
            {q.required ? <span className="text-red-600"> *</span> : null}
          </label>
          {(q.type === 'likert_5') && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.low}</span>}
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  className={`size-10 rounded-full text-sm font-medium ${answers[q.id] === n ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{n}</button>
              ))}
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.high}</span>}
            </div>
          )}
          {(q.type === 'likert_7') && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.low}</span>}
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  className={`size-9 rounded-full text-xs font-medium ${answers[q.id] === n ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{n}</button>
              ))}
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.high}</span>}
            </div>
          )}
          {(q.type === 'scale_10') && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                    className={`flex-1 rounded py-2 text-xs font-semibold ${answers[q.id] === n ? (n >= 9 ? 'bg-emerald-600 text-white' : n >= 7 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white') : 'bg-neutral-100 hover:bg-neutral-200'}`}>{n}</button>
                ))}
              </div>
              {q.anchors && <div className="flex justify-between text-xs text-neutral-400"><span>{q.anchors.low}</span><span>{q.anchors.high}</span></div>}
            </div>
          )}
          {(q.type === 'yes_no') && (
            <div className="mt-2 flex gap-3">
              {['Ja', 'Nei'].map((v) => (
                <button key={v} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  className={`rounded-full px-6 py-2 text-sm font-medium ${answers[q.id] === v ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{v}</button>
              ))}
            </div>
          )}
          {(q.type === 'text') && (
            <div className="mt-2">
              {survey.anonymous ? (
                <div className={`${R_FLAT} mb-2 border-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950`}>
                  Viktig: Dette er en anonym undersøkelse. Ikke skriv navn, stillingstitler eller identifiserende
                  opplysninger i dette feltet. Reelle varsler skal meldes via{' '}
                  <Link to="/tasks?view=whistle" className="underline">
                    Varslingskanalen
                  </Link>
                  .
                </div>
              ) : null}
              <textarea
                value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                className={`${SETTINGS_INPUT} bg-white`}
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
      >
        Send svar
      </button>
    </div>
  )
}

// ─── SurveyCreator — template picker + group selector ─────────────────────────

function SurveyCreator({
  oh,
  onCreated,
}: {
  oh: ReturnType<typeof useOrgHealth>
  onCreated?: (id: string) => void
}) {
  const org = useOrganisation()
  const { supabase } = useOrgSetupContext()

  const [dbTemplates, setDbTemplates] = useState<SurveyTemplateCatalogRow[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('survey_template_catalog')
      .select('id,name,short_name,description,source,category,audience,estimated_minutes,recommend_anonymous,scoring_note,body,is_system,is_active')
      .eq('is_system', true)
      .eq('is_active', true)
      .then(({ data }) => { if (data) setDbTemplates(data as SurveyTemplateCatalogRow[]) })
  }, [supabase])

  const [mode, setMode] = useState<'template' | 'custom'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [targetGroupId, setTargetGroupId] = useState(org.groups[0]?.id ?? '')

  useEffect(() => {
    if (dbTemplates.length > 0 && !selectedTemplateId) setSelectedTemplateId(dbTemplates[0].id)
  }, [dbTemplates, selectedTemplateId])

  const filteredTemplates = categoryFilter === 'all'
    ? dbTemplates
    : dbTemplates.filter((t) => t.category === categoryFilter)

  const selectedTemplate = dbTemplates.find((t) => t.id === selectedTemplateId)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const displayTitle = title.trim() || (selectedTemplate?.name ?? 'Egendefinert undersøkelse')
    const group = org.groups.find((g) => g.id === targetGroupId)

    if (mode === 'template' && selectedTemplate) {
      const qs: SurveyQuestion[] = selectedTemplate.body.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: (['likert_5', 'likert_7', 'scale_10', 'yes_no', 'text'] as const).includes(q.type as never)
          ? (q.type as SurveyQuestion['type'])
          : 'text',
        required: q.required,
        ...(q.subscale ? { subscale: q.subscale } : {}),
        ...(q.anchors ? { anchors: q.anchors } : {}),
      }))
      const s = oh.createSurveyFromTemplate(
        selectedTemplate.id,
        qs,
        displayTitle,
        description || (selectedTemplate.description ?? ''),
        anonymous,
        targetGroupId || undefined,
        group ? org.getGroupLabel(group) : undefined,
      )
      onCreated?.(s.id)
    } else {
      const s = oh.createSurvey(displayTitle, description, anonymous, false)
      onCreated?.(s.id)
    }
    setTitle('')
    setDescription('')
  }

  return (
    <section className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Ny undersøkelse</h2>
        <div className="flex gap-1 rounded-full border border-neutral-200 p-1">
          <button type="button" onClick={() => setMode('template')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'template' ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            <BookMarked className="size-3.5" />
            Fra mal
          </button>
          <button type="button" onClick={() => setMode('custom')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'custom' ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            <Plus className="size-3.5" />
            Egendefinert
          </button>
        </div>
      </div>

      <form className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={handleCreate}>
        <div className="space-y-4">
          {mode === 'template' && (
            <>
              {/* Category filter */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Kategori</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setCategoryFilter('all')}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === 'all' ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                    Alle
                  </button>
                  {TEMPLATE_CATEGORIES.filter((c) => c.id !== 'custom').map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setCategoryFilter(cat.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === cat.id ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { setSelectedTemplateId(tpl.id); setAnonymous(tpl.recommend_anonymous) }}
                    className={`rounded-xl border p-4 text-left transition-all ${selectedTemplateId === tpl.id ? 'border-[#1a3d32] bg-[#1a3d32]/5 ring-1 ring-[#1a3d32]' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-neutral-900">{tpl.short_name ?? tpl.name}</span>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">~{tpl.estimated_minutes} min</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{tpl.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{tpl.body.questions.length} spørsmål</span>
                      {tpl.recommend_anonymous && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">Anbefalt anonym</span>}
                    </div>
                    <p className="mt-1.5 text-[10px] text-neutral-400 italic">{tpl.source}</p>
                  </button>
                ))}
              </div>

              {/* Selected template scoring info */}
              {selectedTemplate?.scoring_note && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  <strong>Scoringveiledning:</strong> {selectedTemplate.scoring_note}
                </div>
              )}
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="text-xs font-medium text-neutral-500">
              Tittel {mode === 'template' ? '(valgfritt — standard: malens navn)' : '*'}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required={mode === 'custom'}
              placeholder={selectedTemplate?.name ?? 'Skriv tittel…'}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500">Introduksjon / instruksjon</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={selectedTemplate?.use_case}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Right column: settings */}
        <div className="space-y-4">
          {/* Target group */}
          <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#1a3d32]" />
              <span className="text-sm font-semibold text-neutral-800">Målgruppe</span>
            </div>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="">— Ingen (åpen for alle)</option>
              {org.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({org.getGroupLabel(g)})
                </option>
              ))}
            </select>
            <Link to="/organisation" className="block text-xs text-[#1a3d32] hover:underline">
              + Administrer enheter og grupper →
            </Link>
          </div>

          {/* Privacy */}
          <div className="rounded-xl border border-neutral-200 p-4 space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Personvern</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
              />
              Anonyme svar (ingen identitet lagret)
            </label>
            {selectedTemplate?.recommend_anonymous && !anonymous && (
              <p className="text-xs text-amber-700">⚠ Denne malen anbefaler anonyme svar for å sikre ærlige svar.</p>
            )}
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-3 text-sm font-medium text-white hover:bg-[#142e26]"
          >
            <Plus className="size-4" />
            {mode === 'template' ? `Opprett fra «${selectedTemplate?.short_name ?? 'mal'}»` : 'Opprett egendefinert'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ─── Schedule constants + ScheduleEditor component ───────────────────────────

const SCHEDULE_KIND_LABELS: Record<SurveyScheduleKind, string> = {
  once:      'Én gang',
  weekly:    'Ukentlig',
  monthly:   'Månedlig',
  quarterly: 'Kvartalsvis',
  yearly:    'Årlig',
  custom:    'Egendefinert intervall',
}

function ScheduleEditor({
  current,
  onSave,
  onRemove,
}: {
  current?: SurveySchedule
  onSave: (s: SurveySchedule) => void
  onRemove: () => void
}) {
  const [kind, setKind] = useState<SurveyScheduleKind>(current?.kind ?? 'once')
  const [startsAt, setStartsAt] = useState(
    current?.startsAt
      ? current.startsAt.slice(0, 16)
      : // eslint-disable-next-line react-hooks/purity -- default start time for new schedule
        new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  )
  const [openForHours, setOpenForHours] = useState(current?.openForHours ?? 72)
  const [intervalN, setIntervalN] = useState(current?.intervalN ?? 1)
  const [endsAt, setEndsAt] = useState(current?.endsAt ? current.endsAt.slice(0, 10) : '')
  const [enabled, setEnabled] = useState(current?.enabled ?? true)

  const showInterval = kind === 'weekly' || kind === 'monthly' || kind === 'custom'
  const intervalLabel =
    kind === 'weekly' ? 'Hver N. uke' :
    kind === 'monthly' ? 'Hver N. måned' :
    'Intervall (dager)'

  function handleSave() {
    onSave({
      kind,
      startsAt: new Date(startsAt).toISOString(),
      openForHours,
      intervalN: showInterval ? intervalN : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      runCount: current?.runCount ?? 0,
      enabled,
      nextRunAt: current?.nextRunAt ?? new Date(startsAt).toISOString(),
      lastTriggeredAt: current?.lastTriggeredAt,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="size-4 text-sky-700" />
        <span className="text-sm font-semibold text-neutral-800">Planlegging</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Kind */}
        <div>
          <label className="text-xs font-medium text-neutral-500">Gjentakelse</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as SurveyScheduleKind)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            {(Object.keys(SCHEDULE_KIND_LABELS) as SurveyScheduleKind[]).map((k) => (
              <option key={k} value={k}>{SCHEDULE_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {/* Interval N */}
        {showInterval && (
          <div>
            <label className="text-xs font-medium text-neutral-500">{intervalLabel}</label>
            <input type="number" min={1} max={365} value={intervalN}
              onChange={(e) => setIntervalN(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </div>
        )}

        {/* Starts at */}
        <div>
          <label className="text-xs font-medium text-neutral-500">
            {kind === 'once' ? 'Åpnes' : 'Første kjøring'}
          </label>
          <input type="datetime-local" value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </div>

        {/* Open for hours */}
        <div>
          <label className="text-xs font-medium text-neutral-500">
            Åpen i (timer) — 0 = manuell lukking
          </label>
          <input type="number" min={0} max={8760} value={openForHours}
            onChange={(e) => setOpenForHours(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </div>

        {/* Ends at — only for recurring */}
        {kind !== 'once' && (
          <div>
            <label className="text-xs font-medium text-neutral-500">Slutt dato (valgfritt)</label>
            <input type="date" value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </div>
        )}

        {/* Enabled */}
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
            Tidsplan aktiv
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
        {kind === 'once' && `Undersøkelsen åpnes automatisk ${new Date(startsAt).toLocaleString('no-NO')}${openForHours > 0 ? `, lukkes etter ${openForHours} timer` : ', lukkes manuelt'}.`}
        {kind === 'weekly' && `Kjøres hver ${intervalN}. uke fra ${new Date(startsAt).toLocaleDateString('no-NO')}${openForHours > 0 ? `, åpen i ${openForHours} timer` : ''}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'monthly' && `Kjøres hver ${intervalN}. måned fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'quarterly' && `Kjøres hvert kvartal fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'yearly' && `Kjøres hvert år fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'custom' && `Kjøres hver ${intervalN}. dag fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave}
          className="flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
          <CalendarClock className="size-4" />
          Lagre tidsplan
        </button>
        {current && (
          <button type="button" onClick={onRemove}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            Fjern tidsplan
          </button>
        )}
      </div>
    </div>
  )
}
