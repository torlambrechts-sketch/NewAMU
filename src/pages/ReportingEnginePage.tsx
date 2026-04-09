import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  Download,
  FileDown,
  History,
  Info,
  LayoutGrid,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Wrench,
  X,
} from 'lucide-react'
import { useReporting } from '../hooks/useReporting'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import { useOrganisation } from '../hooks/useOrganisation'
import { useTasks } from '../hooks/useTasks'
import { useReportBuilder } from '../hooks/useReportBuilder'
import { STANDARD_REPORT_CATEGORIES, type StandardReportId } from '../data/standardReports'
import { buildReportDatasets } from '../lib/reportDatasets'
import { createDefaultModule, newModuleId } from '../lib/reportModuleCatalog'
import type { CustomReportTemplate, ReportModule } from '../types/reportBuilder'
import { CustomReportPreview } from '../components/reports/CustomReportPreview'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { StandardReportDashboard } from '../components/reports/StandardReportDashboard'
import { ShareSensitiveDataModal } from '../components/reports/ShareSensitiveDataModal'
import { buildStandardReportVisualModel } from '../lib/standardReportVisualModel'
import { ReportModuleDesigner } from '../components/dashboard/ReportModuleDesigner'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'

const HISTORY_KEY = 'atics-report-run-history'

type RunEntry = { id: string; title: string; at: string; kind: 'standard' | 'custom' }

function readHistory(): RunEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as RunEntry[]
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function pushHistory(entry: RunEntry) {
  const prev = readHistory().filter((e) => e.id !== entry.id)
  prev.unshift(entry)
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(prev.slice(0, 80)))
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-none border border-neutral-200 bg-neutral-50/80 p-4 text-xs leading-relaxed text-neutral-800">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

type MainTab = 'reports' | 'history' | 'tools'
type ToolsTab =
  | 'amu'
  | 'ik'
  | 'arp'
  | 'privacy'
  | 'analytics'
  | 'compliance'
  | 'integration'

export function ReportingEnginePage() {
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const accent = layout.accent

  const { organization, supabaseConfigured } = useOrgSetupContext()
  const rep = useReporting()
  const org = useOrganisation()
  const { tasks } = useTasks()
  const rb = useReportBuilder()

  const [searchParams, setSearchParams] = useSearchParams()
  const mainTab: MainTab =
    searchParams.get('tab') === 'history'
      ? 'history'
      : searchParams.get('tab') === 'tools'
        ? 'tools'
        : 'reports'

  const setMainTab = useCallback(
    (t: MainTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'reports') next.delete('tab')
          else next.set('tab', t)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const year = new Date().getFullYear()
  const [y, setY] = useState(year)
  const [toolsTab, setToolsTab] = useState<ToolsTab>('amu')
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STANDARD_REPORT_CATEGORIES.map((c) => [c.id, true])),
  )

  const [standardPayload, setStandardPayload] = useState<unknown>(null)
  const [standardLoading, setStandardLoading] = useState(false)
  const [activeStandardId, setActiveStandardId] = useState<StandardReportId | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [shareModal, setShareModal] = useState<null | 'pdf' | 'email'>(null)
  const [showJsonInViewer, setShowJsonInViewer] = useState(false)
  const reportViewRef = useRef<HTMLDivElement>(null)

  const [builderOpen, setBuilderOpen] = useState(false)
  const [draft, setDraft] = useState<CustomReportTemplate | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [history, setHistory] = useState<RunEntry[]>(() => readHistory())

  const [amu, setAmu] = useState<unknown>(null)
  const [ik, setIk] = useState<unknown>(null)
  const [arp, setArp] = useState<unknown>(null)
  const [sick, setSick] = useState<unknown>(null)
  const [corr, setCorr] = useState<unknown>(null)
  const [cost, setCost] = useState<unknown>(null)
  const [score, setScore] = useState<unknown>(null)

  const loadCompliance = useCallback(async () => {
    const s = await rep.fetchComplianceScore()
    setScore(s)
  }, [rep])

  useEffect(() => {
    queueMicrotask(() => void loadCompliance())
  }, [loadCompliance])

  const standardReportCount = useMemo(
    () => STANDARD_REPORT_CATEGORIES.reduce((a, c) => a + c.reports.length, 0),
    [],
  )

  const runStandard = useCallback(
    async (id: StandardReportId) => {
      setActiveStandardId(id)
      setStandardLoading(true)
      setStandardPayload(null)
      try {
        let data: unknown = null
        switch (id) {
          case 'amu_annual':
            data = await rep.fetchAmuAnnual(y)
            break
          case 'annual_ik':
            data = await rep.fetchAnnualIk(y)
            break
          case 'arp':
            data = await rep.fetchArp(y)
            break
          case 'sick_privacy':
            data = await rep.fetchSickByDept(y, 5)
            break
          case 'training_incidents':
            data = await rep.fetchCorrelation(y)
            break
          case 'cost_friction':
            data = await rep.fetchCostFriction(y)
            break
          case 'compliance_score':
            data = await rep.fetchComplianceScore()
            break
          default:
            break
        }
        setStandardPayload(data)
        setShowJsonInViewer(false)
        setViewerOpen(true)
        const title =
          STANDARD_REPORT_CATEGORIES.flatMap((c) => c.reports).find((r) => r.id === id)?.title ?? id
        const entry: RunEntry = { id: crypto.randomUUID(), title, at: new Date().toISOString(), kind: 'standard' }
        pushHistory(entry)
        setHistory(readHistory())
      } finally {
        setStandardLoading(false)
      }
    },
    [rep, y],
  )

  const standardVisualModel = useMemo(() => {
    if (!activeStandardId || standardPayload == null) return null
    return buildStandardReportVisualModel(activeStandardId, standardPayload)
  }, [activeStandardId, standardPayload])

  const activeStandardTitle = useMemo(() => {
    if (!activeStandardId) return ''
    return STANDARD_REPORT_CATEGORIES.flatMap((c) => c.reports).find((r) => r.id === activeStandardId)?.title ?? ''
  }, [activeStandardId])

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
    setShareModal(null)
    setShowJsonInViewer(false)
  }, [])

  function openPrintWindowForPdf() {
    const el = reportViewRef.current
    if (!el) return
    const orgName = organization?.name ?? 'Organisasjon'
    const title = activeStandardTitle || 'Rapport'
    const w = window.open('', '_blank')
    if (!w) return
    const styles = `
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 20px; color: #171717; background: #fff; }
      h1 { font-size: 1.25rem; margin: 0 0 8px; }
      .meta { font-size: 12px; color: #525252; margin-bottom: 20px; }
      @media print { body { padding: 12px; } }
    `
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>${styles}</style></head><body>` +
        `<h1>${title}</h1><div class="meta">${orgName} · ${y} · ${new Date().toLocaleString('no-NO')}</div>` +
        el.innerHTML +
        `</body></html>`,
    )
    w.document.close()
    w.focus()
    queueMicrotask(() => {
      w.print()
    })
  }

  function buildEmailSummary(): string {
    const lines: string[] = []
    lines.push(`Rapport: ${activeStandardTitle}`)
    lines.push(`Organisasjon: ${organization?.name ?? '—'}`)
    lines.push(`År: ${y}`)
    lines.push(`Generert: ${new Date().toLocaleString('no-NO')}`)
    lines.push('')
    if (standardVisualModel?.kpis.length) {
      lines.push('Nøkkeltall:')
      for (const k of standardVisualModel.kpis.slice(0, 12)) {
        lines.push(`- ${k.label}: ${k.value}`)
      }
    }
    lines.push('')
    lines.push('Full data finnes i løsningen. Ved behag, legg ved JSON-eksport manuelt.')
    return lines.join('\n')
  }

  function openEmailWithSummary() {
    const subject = encodeURIComponent(`${activeStandardTitle || 'Rapport'} — ${organization?.name ?? ''} (${y})`)
    const body = encodeURIComponent(buildEmailSummary())
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const datasetKeysForModules = useCallback((mods: ReportModule[]) => {
    const s = new Set(mods.map((m) => m.datasetKey))
    return [...s]
  }, [])

  const refreshPreview = useCallback(
    async (modules: ReportModule[]) => {
      const keys = datasetKeysForModules(modules)
      setPreviewLoading(true)
      try {
        const data = await buildReportDatasets({
          keys,
          year: y,
          org: {
            settings: org.settings,
            employees: org.employees,
            units: org.units,
          },
          tasks,
          fetchAmuAnnual: (yr) => rep.fetchAmuAnnual(yr),
          fetchAnnualIk: (yr) => rep.fetchAnnualIk(yr),
          fetchArp: (yr) => rep.fetchArp(yr),
          fetchSickByDept: (yr, m) => rep.fetchSickByDept(yr, m),
          fetchCorrelation: (yr) => rep.fetchCorrelation(yr),
          fetchCostFriction: (yr) => rep.fetchCostFriction(yr),
          fetchComplianceScore: () => rep.fetchComplianceScore(),
        })
        setPreviewData(data)
      } finally {
        setPreviewLoading(false)
      }
    },
    [datasetKeysForModules, y, org.settings, org.employees, org.units, tasks, rep],
  )

  const modulesSig = draft ? JSON.stringify(draft.modules) : ''

  useEffect(() => {
    if (!builderOpen || !modulesSig) return
    try {
      const mods = JSON.parse(modulesSig) as ReportModule[]
      void refreshPreview(mods)
    } catch {
      /* ignore */
    }
  }, [builderOpen, modulesSig, y, refreshPreview])

  useEffect(() => {
    if (!builderOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [builderOpen])

  useEffect(() => {
    if (!builderOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBuilderOpen(false)
        setDraft(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [builderOpen])

  useEffect(() => {
    if (!viewerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [viewerOpen])

  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerOpen, closeViewer])

  function openNewReport() {
    const now = new Date().toISOString()
    setDraft({
      id: newModuleId(),
      name: 'Ny tilpasset rapport',
      createdAt: now,
      updatedAt: now,
      modules: [createDefaultModule('kpi'), createDefaultModule('table'), createDefaultModule('bar')],
    })
    setBuilderOpen(true)
  }

  function openEditTemplate(t: CustomReportTemplate) {
    setDraft({ ...t, modules: t.modules.map((m) => ({ ...m })) })
    setBuilderOpen(true)
  }

  function closeBuilder() {
    setBuilderOpen(false)
    setDraft(null)
  }

  function saveDraft() {
    if (!draft?.name.trim()) return
    const now = new Date().toISOString()
    rb.saveTemplate({ ...draft, updatedAt: now })
  }

  function runCustomReport() {
    if (!draft) return
    void refreshPreview(draft.modules).then(() => {
      const entry: RunEntry = {
        id: crypto.randomUUID(),
        title: draft.name,
        at: new Date().toISOString(),
        kind: 'custom',
      }
      pushHistory(entry)
      setHistory(readHistory())
    })
  }

  async function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const toolsTabs = useMemo(
    () =>
      [
        { id: 'amu' as const, label: 'AMU årsrapport' },
        { id: 'ik' as const, label: 'Årlig gjennomgang (IK)' },
        { id: 'arp' as const, label: 'ARP' },
        { id: 'privacy' as const, label: 'Personvern (k-anonymitet)' },
        { id: 'analytics' as const, label: 'Kryssmodul-analyse' },
        { id: 'compliance' as const, label: 'Compliance-score' },
        { id: 'integration' as const, label: 'Eksport & drift' },
      ] as const,
    [],
  )

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Rapporter</span>
      </nav>

      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Rapporter
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{organization?.name ?? 'Organisasjon'}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Kjør standardrapporter eller bygg egne innsiktsrapporter med moduler (KPI, tabell, søylediagram, donut).
            Data hentes fra organisasjon, oppgaver og eksisterende rapport-RPC-er.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              Standard <strong className="ml-1 font-semibold">{standardReportCount}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-700`}>
              Maler <strong className="ml-1 font-semibold">{rb.templates.length}</strong>
            </span>
            <label className={`${HERO_ACTION_CLASS} cursor-pointer bg-white text-neutral-800 ring-1 ring-neutral-200`}>
              År{' '}
              <input
                type="number"
                value={y}
                min={2000}
                max={2100}
                onChange={(e) => setY(Number(e.target.value))}
                className="ml-2 w-[5.25rem] min-w-[5.25rem] rounded-none border border-neutral-200 bg-white px-2 py-1 text-center text-sm tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={openNewReport}
              className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
            >
              <Plus className="size-4 shrink-0" />
              Ny rapport
            </button>
          </div>
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {(
            [
              { id: 'reports' as const, label: 'Rapporter', Icon: LayoutGrid },
              { id: 'history' as const, label: 'Rapportlogg', Icon: History },
              { id: 'tools' as const, label: 'Verktøy (JSON)', Icon: Wrench },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = mainTab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMainTab(id)}
                className={tb.className}
                style={tb.style}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {(rep.error || rb.error) && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {rep.error ?? rb.error}
        </p>
      )}

      {mainTab === 'reports' && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Standardrapporter', sub: 'Lovpålagte og analyse', value: `${standardReportCount}` },
                { title: 'Lagrede maler', sub: 'Tilpassede oppsett', value: `${rb.templates.length}` },
                { title: 'Aktivt år', sub: 'For RPC-data', value: `${y}` },
                { title: 'Oppgaver i org', sub: 'For datasett', value: `${tasks.length}` },
              ] as const
            ).map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <section className="mt-10">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Standardrapporter</h2>
              <Info className="size-3.5 text-neutral-400" aria-hidden />
            </div>

            {STANDARD_REPORT_CATEGORIES.map((cat) => {
              const open = catOpen[cat.id] ?? true
              return (
                <div key={cat.id} className="mb-10">
                  <button
                    type="button"
                    onClick={() => setCatOpen((s) => ({ ...s, [cat.id]: !open }))}
                    className="mb-4 flex w-full items-center justify-between rounded-none border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    {cat.title}
                    <ChevronDown className={`size-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {cat.reports.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => void runStandard(r.id)}
                          className={`${R_FLAT} flex flex-col border border-neutral-200/90 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:shadow`}
                        >
                          <span className="font-semibold text-neutral-900">{r.title}</span>
                          <span className="mt-2 text-sm leading-relaxed text-neutral-600">{r.description}</span>
                          <span className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
                            Kjør rapport →
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </section>

          <section className="mt-8">
            <Mainbox1
              title="Siste rapport"
              subtitle={
                viewerOpen && activeStandardTitle
                  ? 'Rapportvinduet er åpent til høyre. Du kan også hente JSON her.'
                  : 'Kjør en standardrapport over — resultat åpnes i sidevindu med grafer og tabeller.'
              }
            >
              {standardLoading ? (
                <p className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="size-4 animate-spin" /> Henter rapport…
                </p>
              ) : standardPayload != null && activeStandardId ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJsonInViewer(false)
                      setViewerOpen(true)
                    }}
                    className={`${R_FLAT} inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50`}
                  >
                    Åpne rapportvisning
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadJson(`report-${activeStandardId}-${y}.json`, standardPayload)}
                    className={`${R_FLAT} inline-flex items-center gap-2 bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white`}
                  >
                    <Download className="size-4" /> Last ned JSON
                  </button>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Ingen rapport i økten ennå.</p>
              )}
            </Mainbox1>
          </section>

          <section className="mt-12 border-t border-neutral-200/80 pt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Lagrede rapportmaler</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Åpne en mal for å redigere moduler, eller kjør forhåndsvisning med ferske data.
                </p>
              </div>
            </div>
            {rb.templates.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen maler ennå — bruk «Ny rapport».</p>
            ) : (
              <ul className="space-y-2">
                {rb.templates.map((t) => (
                  <li
                    key={t.id}
                    className={`${R_FLAT} flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white px-4 py-3`}
                  >
                    <div>
                      <p className="font-medium text-neutral-900">{t.name}</p>
                      <p className="text-xs text-neutral-500">
                        {t.modules.length} modul(er) · oppdatert{' '}
                        {new Date(t.updatedAt).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTemplate(t)}
                        className={`${R_FLAT} border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50`}
                      >
                        Rediger
                      </button>
                      <button
                        type="button"
                        onClick={() => rb.deleteTemplate(t.id)}
                        className={`${R_FLAT} border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50`}
                      >
                        Slett
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {mainTab === 'history' && (
        <section className="mt-8">
          <Mainbox1 title="Rapportlogg" subtitle="Siste kjøringer i denne nettleserøkten.">
            {history.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen kjøringer logget ennå.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="font-medium text-neutral-900">{h.title}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(h.at).toLocaleString('no-NO')} · {h.kind === 'custom' ? 'Tilpasset' : 'Standard'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Mainbox1>
        </section>
      )}

      {mainTab === 'tools' && (
        <section className="mt-8 space-y-6">
          <div className={`inline-flex flex-wrap border border-neutral-200 bg-neutral-50/80 p-1 ${R_FLAT}`}>
            {toolsTabs.map((t) => {
              const sel = toolsTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setToolsTab(t.id)}
                  className={`${R_FLAT} px-3 py-2 text-xs font-medium sm:text-sm ${
                    sel ? 'text-white' : 'text-neutral-600 hover:bg-white'
                  }`}
                  style={sel ? { backgroundColor: accent, color: '#fff' } : undefined}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {!supabaseConfigured && (
            <p className="rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Supabase er ikke konfigurert — rapport-RPC-er krever database.
            </p>
          )}

          {toolsTab === 'amu' && (
            <ToolsRpcSection
              title="AMU årsrapport"
              loading={rep.loading}
              onRun={async () => setAmu(await rep.fetchAmuAnnual(y))}
              onDownload={() => void downloadJson(`amu-annual-${y}.json`, amu)}
              data={amu}
            />
          )}
          {toolsTab === 'ik' && (
            <ToolsRpcSection
              title="Årlig gjennomgang — internkontroll (§ 5.8)"
              loading={rep.loading}
              onRun={async () => setIk(await rep.fetchAnnualIk(y))}
              onDownload={() => void downloadJson(`annual-review-ik-${y}.json`, ik)}
              data={ik}
            />
          )}
          {toolsTab === 'arp' && (
            <ToolsRpcSection
              title="ARP — aktivitets- og redegjørelsesplikt"
              loading={rep.loading}
              onRun={async () => setArp(await rep.fetchArp(y))}
              onDownload={() => void downloadJson(`arp-${y}.json`, arp)}
              data={arp}
            />
          )}
          {toolsTab === 'privacy' && (
            <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-6 shadow-sm`}>
              <h2 className="text-lg font-semibold text-neutral-900">Anonymitetsgrense (k ≥ 5)</h2>
              <p className="mt-2 text-sm text-neutral-600">
                RPC <code className="rounded bg-neutral-100 px-1">reporting_sick_leave_by_department</code> returnerer
                bare avdelinger med tilstrekkelig antall ansatte.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rep.loading}
                  onClick={async () => setSick(await rep.fetchSickByDept(y, 5))}
                  className={`${R_FLAT} inline-flex min-w-[10rem] items-center justify-center gap-2 border border-neutral-200 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50`}
                >
                  {rep.loading ? <Loader2 className="size-4 animate-spin" /> : null} Test sykefravær per avdeling
                </button>
                {sick != null && (
                  <button
                    type="button"
                    onClick={() => void downloadJson(`sick-by-dept-${y}.json`, sick)}
                    className={`${R_FLAT} inline-flex items-center gap-2 bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white`}
                  >
                    <Download className="size-4" /> JSON
                  </button>
                )}
              </div>
              {sick ? <div className="mt-4"><JsonBlock data={sick} /></div> : null}
            </div>
          )}
          {toolsTab === 'analytics' && (
            <div className="space-y-6">
              <ToolsRpcSection
                title="Opplæring vs. hendelser (produksjon)"
                loading={rep.loading}
                onRun={async () => setCorr(await rep.fetchCorrelation(y))}
                onDownload={() => void downloadJson(`training-incident-corr-${y}.json`, corr)}
                data={corr}
              />
              <ToolsRpcSection
                title="Cost of friction"
                loading={rep.loading}
                onRun={async () => setCost(await rep.fetchCostFriction(y))}
                onDownload={() => void downloadJson(`cost-friction-${y}.json`, cost)}
                data={cost}
              />
            </div>
          )}
          {toolsTab === 'compliance' && (
            <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-6 shadow-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Materialisert compliance-score</h2>
                <button
                  type="button"
                  disabled={rep.loading}
                  onClick={async () => {
                    await rep.refreshComplianceMv()
                    await loadCompliance()
                  }}
                  className={`${R_FLAT} inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50`}
                >
                  {rep.loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Oppdater MV
                </button>
              </div>
              {score ? <div className="mt-4"><JsonBlock data={score} /></div> : (
                <p className="mt-4 text-sm text-neutral-500">Laster…</p>
              )}
            </div>
          )}
          {toolsTab === 'integration' && (
            <div className={`${R_FLAT} space-y-4 border border-neutral-200/90 bg-white p-6 shadow-sm`}>
              <h2 className="text-lg font-semibold text-neutral-900">Eksport, BI og jobber</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
                <li>
                  <strong>Power BI / Tableau:</strong> Supabase er PostgreSQL — skrivebeskyttet tilkobling til samme
                  data som RPC-ene.
                </li>
                <li>
                  <strong>PDF / e-post:</strong> Edge Function eller cron mot RPC-resultat.
                </li>
                <li>
                  <strong>Revisjonslogg:</strong> Endringer i <code className="rounded bg-neutral-100 px-1">org_module_payloads</code>{' '}
                  logges til <code className="rounded bg-neutral-100 px-1">reporting_audit_log</code>.
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      <ShareSensitiveDataModal
        open={shareModal === 'pdf'}
        title="Eksporter som PDF"
        actionLabel="Åpne utskrift / lagre som PDF"
        onCancel={() => setShareModal(null)}
        onConfirm={() => {
          setShareModal(null)
          openPrintWindowForPdf()
        }}
      />
      <ShareSensitiveDataModal
        open={shareModal === 'email'}
        title="Send som e-post"
        actionLabel="Åpne e-postklient"
        onCancel={() => setShareModal(null)}
        onConfirm={() => {
          setShareModal(null)
          openEmailWithSummary()
        }}
      />

      {viewerOpen && activeStandardId && standardVisualModel ? (
        <div
          className="fixed inset-0 z-[110] flex justify-end bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeViewer()
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,960px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-viewer-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200/90 bg-[#f7f6f2] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2
                  id="report-viewer-title"
                  className="truncate text-xl font-semibold text-neutral-900 sm:text-2xl"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  {activeStandardTitle}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {organization?.name ?? 'Organisasjon'} · {y}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowJsonInViewer((v) => !v)}
                  className={`${R_FLAT} border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
                >
                  {showJsonInViewer ? 'Skjul JSON' : 'Vis JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadJson(`report-${activeStandardId}-${y}.json`, standardPayload)}
                  className={`${R_FLAT} border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
                >
                  <Download className="mr-1 inline size-3.5 align-middle" />
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setShareModal('pdf')}
                  className={`${R_FLAT} border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
                >
                  <FileDown className="mr-1 inline size-3.5 align-middle" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShareModal('email')}
                  className={`${R_FLAT} border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
                >
                  <Mail className="mr-1 inline size-3.5 align-middle" />
                  E-post
                </button>
                <button
                  type="button"
                  onClick={closeViewer}
                  className="rounded-none p-2 text-neutral-500 hover:bg-neutral-200/60"
                  aria-label="Lukk"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {standardLoading ? (
                <div className="flex items-center justify-center p-16">
                  <Loader2 className="size-8 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div ref={reportViewRef}>
                  <StandardReportDashboard
                    subtitle={`${organization?.name ?? 'Organisasjon'} · år ${y}`}
                    model={standardVisualModel}
                    accent={accent}
                  />
                  {showJsonInViewer ? (
                    <div className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-6">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Rådata</p>
                      <JsonBlock data={standardPayload} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {builderOpen && draft ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeBuilder()
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,1100px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-builder-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-neutral-200/90 bg-[#f7f6f2] px-5 py-4 sm:px-7">
              <h2
                id="report-builder-title"
                className="min-w-0 max-w-[70%] text-xl font-semibold text-neutral-900 sm:text-2xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Rapport: {draft.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={closeBuilder}
                  className={`${R_FLAT} px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200/50`}
                >
                  Tilbake
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className={`${R_FLAT} px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200/50`}
                >
                  Lagre mal
                </button>
                <button
                  type="button"
                  onClick={() => void runCustomReport()}
                  disabled={previewLoading}
                  className={`${R_FLAT} px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50`}
                  style={{ backgroundColor: accent }}
                >
                  {previewLoading ? 'Oppdaterer…' : 'Kjør rapport'}
                </button>
                <button
                  type="button"
                  onClick={closeBuilder}
                  className="rounded-none p-2 text-neutral-500 hover:bg-neutral-200/60"
                  aria-label="Lukk"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Grunnlag</h3>
                  <p className={`${SETTINGS_LEAD} mt-2`}>
                    Gi rapporten et navn og legg til moduler til venstre. Forhåndsvisningen til høyre bruker sanntidsdata
                    fra organisasjon, oppgaver og valgte RPC-sammendrag for året {y}.
                  </p>
                </div>
                <div className={PANEL_INSET}>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="rb-name">
                    Rapportnavn
                  </label>
                  <input
                    id="rb-name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : null))}
                    className={`${SETTINGS_INPUT} bg-white`}
                  />
                </div>
              </div>

              <div className="my-8 border-t border-neutral-200/90" />

              <div className="grid min-h-[min(70vh,640px)] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
                <ReportModuleDesigner
                  modules={draft.modules}
                  onModulesChange={(next) => setDraft((d) => (d ? { ...d, modules: next } : null))}
                />

                <div className="flex min-h-0 flex-col">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                      Filtre (0) — kommer
                    </p>
                    <button
                      type="button"
                      disabled
                      className={`${R_FLAT} border border-neutral-200 px-2 py-1 text-[10px] font-bold uppercase text-neutral-400`}
                    >
                      + Legg til filter
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-none border border-neutral-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-neutral-500">
                      <Settings2 className="size-4" />
                      <span className="text-xs">Forhåndsvisning — ikke alle felt er sanntidsdata.</span>
                    </div>
                    {previewLoading ? (
                      <p className="flex items-center gap-2 text-sm text-neutral-500">
                        <Loader2 className="size-4 animate-spin" /> Henter datasett…
                      </p>
                    ) : (
                      <CustomReportPreview modules={draft.modules} datasets={previewData} accent={accent} />
                    )}
                    <p className="mt-6 text-xs italic text-neutral-500">
                      Dette er en forhåndsvisning. Kjør rapport for å logge i rapportlogg og laste ned rådata under
                      verktøy-fanen om nødvendig.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ToolsRpcSection({
  title,
  loading,
  onRun,
  onDownload,
  data,
}: {
  title: string
  loading: boolean
  onRun: () => Promise<void>
  onDownload: () => void
  data: unknown
}) {
  return (
    <div className="rounded-none border border-neutral-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void onRun()}
            className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-none border border-neutral-200 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null} Kjør
          </button>
          {data != null && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-none bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
            >
              <Download className="size-4" /> JSON
            </button>
          )}
        </div>
      </div>
      {data != null ? (
        <div className="mt-4">
          <JsonBlock data={data} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">Klikk «Kjør».</p>
      )}
    </div>
  )
}
