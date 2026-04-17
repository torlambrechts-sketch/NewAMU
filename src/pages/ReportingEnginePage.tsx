import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
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
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { useWorkplaceKpiStripStyle } from '../hooks/useWorkplaceKpiStripStyle'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import { useOrganisation } from '../hooks/useOrganisation'
import { useTasks } from '../hooks/useTasks'
import { useReportBuilder } from '../hooks/useReportBuilder'
import { useReportRuns } from '../hooks/useReportRuns'
import { useReportSchedules } from '../hooks/useReportSchedules'
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

const SCHEDULE_PRESETS = [
  { id: 'monthly_morning', label: 'Hver måned kl. 08:00 (Europe/Oslo)', cron: '0 8 1 * *', tz: 'Europe/Oslo' },
  { id: 'weekly_mon', label: 'Hver mandag kl. 08:00 (Europe/Oslo)', cron: '0 8 * * 1', tz: 'Europe/Oslo' },
  { id: 'daily_morning', label: 'Hver dag kl. 07:30 (Europe/Oslo)', cron: '30 7 * * *', tz: 'Europe/Oslo' },
] as const

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
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(data, null, 2)
  return (
    <div className="relative">
      <div className="sticky top-0 z-[1] flex justify-end border-b border-neutral-200 bg-neutral-50/95 px-2 py-1.5">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(
              () => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              },
              () => {
                /* ignore */
              },
            )
          }}
          className={`${R_FLAT} inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
        >
          {copied ? <Check className="size-3.5 text-emerald-700" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Kopiert' : 'Kopier'}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto px-4 pb-4 pt-2 text-xs leading-relaxed text-neutral-800">
        {text}
      </pre>
    </div>
  )
}

function ScopedError({
  message,
  onDismiss,
  className = '',
}: {
  message: string | null
  onDismiss: () => void
  className?: string
}) {
  if (!message) return null
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 ${className}`}
      role="alert"
    >
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-none p-1 text-red-700 hover:bg-red-100"
        aria-label="Lukk melding"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function templatesEqual(a: CustomReportTemplate, b: CustomReportTemplate): boolean {
  return a.name === b.name && a.id === b.id && JSON.stringify(a.modules) === JSON.stringify(b.modules)
}

type MainTab = 'reports' | 'history' | 'schedules' | 'tools'
type ToolsTab =
  | 'amu'
  | 'ik'
  | 'arp'
  | 'privacy'
  | 'analytics'
  | 'compliance'
  | 'integration'

export function ReportingEnginePage() {
  const { barStyle: kpiStripStyle } = useWorkplaceKpiStripStyle()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const accent = layout.accent

  const { organization, supabaseConfigured, profile, user } = useOrgSetupContext()
  const rep = useReporting()
  const org = useOrganisation()
  const { tasks } = useTasks()
  const rb = useReportBuilder()
  const schedules = useReportSchedules()
  const {
    logRun: logReportRun,
    refresh: refreshReportRuns,
    clearError: clearReportRunsError,
    enabled: reportRunsEnabled,
    runs: reportRunRows,
    loading: reportRunsLoading,
    error: reportRunsError,
  } = useReportRuns()

  const [searchParams, setSearchParams] = useSearchParams()
  const mainTab: MainTab =
    searchParams.get('tab') === 'history'
      ? 'history'
      : searchParams.get('tab') === 'schedules'
        ? 'schedules'
        : searchParams.get('tab') === 'tools'
          ? 'tools'
          : 'reports'

  const setMainTabPreserveDef = useCallback(
    (t: MainTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'reports') {
            next.delete('tab')
            next.delete('def')
          } else {
            next.set('tab', t)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const reportHubItems = useMemo((): HubMenu1Item[] => {
    return (
      [
        { id: 'reports' as const, label: 'Rapporter', Icon: LayoutGrid },
        { id: 'history' as const, label: 'Rapportlogg', Icon: History },
        { id: 'schedules' as const, label: 'Planlegging', Icon: CalendarClock },
        { id: 'tools' as const, label: 'Verktøy (JSON)', Icon: Wrench },
      ] as const
    ).map(({ id, label, Icon }) => ({
      key: id,
      label,
      icon: Icon,
      active: mainTab === id,
      onClick: () => setMainTabPreserveDef(id),
    }))
  }, [mainTab, setMainTabPreserveDef])

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

  useEffect(() => {
    if (mainTab !== 'history' || !reportRunsEnabled) return
    void refreshReportRuns()
  }, [mainTab, reportRunsEnabled, refreshReportRuns])

  useEffect(() => {
    if (mainTab !== 'schedules' || !schedules.enabled) return
    void schedules.refresh()
  }, [mainTab, schedules.enabled, schedules.refresh])

  const defParam = searchParams.get('def') ?? ''

  useEffect(() => {
    if (mainTab !== 'schedules') return
    const id = defParam.trim()
    if (!id) return
    if (!rb.templates.some((t) => t.id === id)) return
    setNewScheduleDefId(id)
  }, [mainTab, defParam, rb.templates])

  useEffect(() => {
    return () => {
      if (saveOkTimer.current) clearTimeout(saveOkTimer.current)
      if (runOkTimer.current) clearTimeout(runOkTimer.current)
    }
  }, [])

  const templateNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of rb.templates) m.set(t.id, t.name)
    return m
  }, [rb.templates])

  const [newScheduleDefId, setNewScheduleDefId] = useState('')
  const [newScheduleTitle, setNewScheduleTitle] = useState('')
  const [newScheduleCron, setNewScheduleCron] = useState('0 8 1 * *')
  const [newScheduleTimezone, setNewScheduleTimezone] = useState('Europe/Oslo')
  const [scheduleCronAdvanced, setScheduleCronAdvanced] = useState(false)

  const [saveDraftLoading, setSaveDraftLoading] = useState(false)
  const [saveDraftOk, setSaveDraftOk] = useState(false)
  const [runCustomLoading, setRunCustomLoading] = useState(false)
  const [runCustomOk, setRunCustomOk] = useState(false)
  const [builderBaseline, setBuilderBaseline] = useState<CustomReportTemplate | null>(null)
  const saveOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentUserRunLabel = useMemo(() => {
    return (
      profile?.display_name?.trim() ||
      profile?.email?.trim() ||
      user?.email?.trim() ||
      'Du'
    )
  }, [profile?.display_name, profile?.email, user?.email])

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
        const logged = await logReportRun({
          kind: 'standard',
          title,
          reportYear: y,
          standardReportId: id,
          meta: { runner_display_name: currentUserRunLabel },
        })
        if (logged) void refreshReportRuns()
      } finally {
        setStandardLoading(false)
      }
    },
    [rep, y, logReportRun, refreshReportRuns, currentUserRunLabel],
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

  const builderDirty = useMemo(() => {
    if (!draft || !builderBaseline) return false
    return !templatesEqual(draft, builderBaseline)
  }, [draft, builderBaseline])

  const requestCloseBuilder = useCallback(() => {
    if (!builderOpen) return
    if (builderDirty) {
      const ok = window.confirm('Du har ulagrede endringer. Vil du lukke uten å lagre?')
      if (!ok) return
    }
    setBuilderOpen(false)
    setDraft(null)
    setBuilderBaseline(null)
    setSaveDraftOk(false)
    setRunCustomOk(false)
  }, [builderOpen, builderDirty])

  const openNewReport = useCallback(() => {
    const now = new Date().toISOString()
    const initial: CustomReportTemplate = {
      id: newModuleId(),
      name: 'Ny tilpasset rapport',
      createdAt: now,
      updatedAt: now,
      modules: [createDefaultModule('kpi'), createDefaultModule('table'), createDefaultModule('bar')],
    }
    setDraft(initial)
    setBuilderBaseline({ ...initial, modules: initial.modules.map((m) => ({ ...m })) })
    setBuilderOpen(true)
    setSaveDraftOk(false)
    setRunCustomOk(false)
  }, [])

  const openEditTemplate = useCallback((t: CustomReportTemplate) => {
    const d: CustomReportTemplate = { ...t, modules: t.modules.map((m) => ({ ...m })) }
    setDraft(d)
    setBuilderBaseline({ ...d, modules: d.modules.map((m) => ({ ...m })) })
    setBuilderOpen(true)
    setSaveDraftOk(false)
    setRunCustomOk(false)
  }, [])

  const saveDraft = useCallback(async () => {
    if (!draft?.name.trim()) return
    setSaveDraftLoading(true)
    setSaveDraftOk(false)
    try {
      const now = new Date().toISOString()
      const saved = await rb.saveTemplate({ ...draft, updatedAt: now })
      if (saved) {
        const next = { ...saved, modules: saved.modules.map((m) => ({ ...m })) }
        setDraft(next)
        setBuilderBaseline({ ...next, modules: next.modules.map((m) => ({ ...m })) })
        setSaveDraftOk(true)
        if (saveOkTimer.current) clearTimeout(saveOkTimer.current)
        saveOkTimer.current = setTimeout(() => setSaveDraftOk(false), 2500)
      }
    } finally {
      setSaveDraftLoading(false)
    }
  }, [draft, rb])

  const runCustomReportFromDraft = useCallback(
    async (tpl: CustomReportTemplate) => {
      setRunCustomLoading(true)
      setRunCustomOk(false)
      try {
        let runTpl = tpl
        if (tpl.rowVersion == null && tpl.name.trim()) {
          const saved = await rb.saveTemplate({ ...tpl, updatedAt: new Date().toISOString() })
          if (!saved) return
          runTpl = { ...saved, modules: saved.modules.map((m) => ({ ...m })) }
          setDraft((d) => (d && d.id === tpl.id ? runTpl : d))
          setBuilderBaseline({ ...runTpl, modules: runTpl.modules.map((m) => ({ ...m })) })
        }
        await refreshPreview(runTpl.modules)
        const entry: RunEntry = {
          id: crypto.randomUUID(),
          title: runTpl.name,
          at: new Date().toISOString(),
          kind: 'custom',
        }
        pushHistory(entry)
        setHistory(readHistory())
        const logged = await logReportRun({
          kind: 'custom',
          title: runTpl.name,
          reportYear: y,
          customTemplateId: runTpl.id,
          meta: {
            moduleCount: runTpl.modules.length,
            runner_display_name: currentUserRunLabel,
          },
        })
        if (logged) void refreshReportRuns()
        setRunCustomOk(true)
        if (runOkTimer.current) clearTimeout(runOkTimer.current)
        runOkTimer.current = setTimeout(() => setRunCustomOk(false), 2500)
      } finally {
        setRunCustomLoading(false)
      }
    },
    [refreshPreview, logReportRun, y, refreshReportRuns, currentUserRunLabel, rb],
  )

  const quickRunTemplate = useCallback(
    (t: CustomReportTemplate) => {
      const d: CustomReportTemplate = { ...t, modules: t.modules.map((m) => ({ ...m })) }
      setDraft(d)
      setBuilderBaseline({ ...d, modules: d.modules.map((m) => ({ ...m })) })
      setBuilderOpen(true)
      setSaveDraftOk(false)
      setRunCustomOk(false)
      queueMicrotask(() => void runCustomReportFromDraft(d))
    },
    [runCustomReportFromDraft],
  )

  const runCustomReport = useCallback(() => {
    if (!draft) return
    void runCustomReportFromDraft(draft)
  }, [draft, runCustomReportFromDraft])

  const reloadTemplateFromServer = useCallback(async () => {
    if (!draft?.id || draft.rowVersion == null) return
    const list = await rb.refresh()
    const fresh = list.find((t) => t.id === draft.id)
    if (fresh) {
      const next = { ...fresh, modules: fresh.modules.map((m) => ({ ...m })) }
      setDraft(next)
      setBuilderBaseline({ ...next, modules: next.modules.map((m) => ({ ...m })) })
    }
  }, [draft?.id, draft?.rowVersion, rb])

  useEffect(() => {
    if (!builderOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestCloseBuilder()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [builderOpen, requestCloseBuilder, saveDraft])

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
      <WorkplacePageHeading1
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Rapporter' },
          {
            label:
              mainTab === 'history'
                ? 'Historikk'
                : mainTab === 'schedules'
                  ? 'Planlegging'
                  : mainTab === 'tools'
                    ? 'Verktøy'
                    : 'Rapportmotor',
          },
        ]}
        title="Rapporter"
        description={
          <>
            <p className="text-sm text-neutral-500">{organization?.name ?? 'Organisasjon'}</p>
            <p className="mt-2 max-w-3xl leading-relaxed">
              Kjør standardrapporter eller bygg egne innsiktsrapporter med moduler (KPI, tabell, søylediagram, donut).
              Data hentes fra organisasjon, oppgaver og eksisterende rapport-RPC-er.
            </p>
          </>
        }
        headerActions={
          <>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              Standard <strong className="ml-1 font-semibold">{standardReportCount}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-700`}>
              Maler <strong className="ml-1 font-semibold">{rb.templates.length}</strong>
            </span>
            {schedules.enabled ? (
              <span className={`${HERO_ACTION_CLASS} bg-white text-neutral-700 ring-1 ring-neutral-200`}>
                Planer <strong className="ml-1 font-semibold">{schedules.schedules.length}</strong>
              </span>
            ) : null}
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
          </>
        }
        menu={<HubMenu1Bar ariaLabel="Rapporter — faner" items={reportHubItems} />}
      />

      {mainTab === 'reports' && (
        <>
          <ScopedError message={rep.error} onDismiss={rep.clearError} />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Standardrapporter', sub: 'Lovpålagte og analyse', value: `${standardReportCount}` },
                { title: 'Lagrede maler', sub: 'Tilpassede oppsett', value: `${rb.templates.length}` },
                { title: 'Aktivt år', sub: 'For RPC-data', value: `${y}` },
                { title: 'Oppgaver i org', sub: 'For datasett', value: `${tasks.length}` },
              ] as const
            ).map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={kpiStripStyle}>
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
                  Åpne en mal for å redigere moduler, kjøre rapport eller duplisere. Versjon økes ved hvert lagre for å
                  unngå at to redigerer overskriver hverandre.
                </p>
              </div>
              {rb.definitionsAvailable ? (
                <button
                  type="button"
                  disabled={rb.loading}
                  onClick={() => void rb.refresh()}
                  className={`${R_FLAT} inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50`}
                >
                  {rb.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                  Oppdater liste
                </button>
              ) : null}
            </div>
            <ScopedError message={rb.error} onDismiss={rb.clearError} />
            {rb.loading && rb.templates.length === 0 ? (
              <ul className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className={`${R_FLAT} h-[4.25rem] animate-pulse border border-neutral-200 bg-neutral-100/80 px-4 py-3`}
                  />
                ))}
              </ul>
            ) : rb.templates.length === 0 && !rb.error ? (
              <p className="text-sm text-neutral-500">Ingen maler ennå — bruk «Ny rapport».</p>
            ) : rb.templates.length === 0 && rb.error ? (
              <p className="text-sm text-neutral-600">
                Kunne ikke laste maler. Bruk «Oppdater liste» eller prøv igjen senere.
              </p>
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
                        {t.modules.length} modul(er)
                        {t.rowVersion != null ? ` · v${t.rowVersion}` : ''} · oppdatert{' '}
                        {new Date(t.updatedAt).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => quickRunTemplate(t)}
                        disabled={runCustomLoading}
                        className={`${R_FLAT} border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50`}
                      >
                        Kjør
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditTemplate(t)}
                        className={`${R_FLAT} border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50`}
                      >
                        Rediger
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void rb.duplicateTemplate(t).then((copy) => {
                            if (copy) void schedules.refresh()
                          })
                        }
                        className={`${R_FLAT} border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50`}
                      >
                        Dupliser
                      </button>
                      <Link
                        to={`/reports?tab=schedules&def=${encodeURIComponent(t.id)}`}
                        className={`${R_FLAT} inline-flex items-center border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50`}
                      >
                        Planlegg
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          void rb.deleteTemplate(t.id).then((ok) => {
                            if (ok) void schedules.refresh()
                          })
                        }
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
        <section className="mt-8 space-y-8">
          <ScopedError message={reportRunsError} onDismiss={clearReportRunsError} />
          <Mainbox1
            title="Rapportlogg (organisasjon)"
            subtitle={
              reportRunsEnabled
                ? 'Hvem som kjørte hvilken rapport, lagret i databasen.'
                : 'Krever innlogget bruker og migrasjon `report_runs` i Supabase.'
            }
          >
            {!reportRunsEnabled ? (
              <p className="text-sm text-neutral-500">Organisasjonslogg er ikke tilgjengelig i denne økten.</p>
            ) : reportRunsLoading && reportRunRows.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Laster logg…
              </p>
            ) : reportRunRows.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen kjøringer er lagret for organisasjonen ennå.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {reportRunRows.map((r) => {
                  const who =
                    (r.meta?.runner_display_name as string | undefined)?.trim() ||
                    r.runner_display_name?.trim() ||
                    null
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="font-medium text-neutral-900">{r.title}</span>
                      <span className="text-right text-xs text-neutral-500">
                        {new Date(r.run_at).toLocaleString('no-NO')}
                        <br />
                        {r.kind === 'custom' ? 'Tilpasset' : 'Standard'}
                        {r.report_year != null ? ` · år ${r.report_year}` : ''}
                        {who ? ` · ${who}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Mainbox1>
          <Mainbox1 title="Denne nettleserøkten" subtitle="Lokalt minne — slettes om du tømmer nettleserdata.">
            {history.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen kjøringer i økten ennå.</p>
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

      {mainTab === 'schedules' && (
        <section className="mt-8 space-y-6">
          <ScopedError message={schedules.error} onDismiss={schedules.clearError} />
          <Mainbox1
            title="Planlagte rapporter (utkast)"
            subtitle={
              schedules.enabled
                ? 'Lagre planer knyttet til en rapportmal. Utsending kjører ikke automatisk ennå — dette er datamodell og CRUD. Kanal: e-post når motoren kommer (webhook senere).'
                : 'Krever innlogget bruker og migrasjon `report_schedules`.'
            }
          >
            {!schedules.enabled ? (
              <p className="text-sm text-neutral-500">Planlegging er ikke tilgjengelig i denne økten.</p>
            ) : (
              <>
                <div className={`${R_FLAT} border border-neutral-200/90 bg-[#f4f1ea] p-4 sm:p-5`}>
                  <p className={`${SETTINGS_FIELD_LABEL}`}>Ny plan</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="md:col-span-2">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-def">
                        Rapportmal
                      </label>
                      <select
                        id="sched-def"
                        value={newScheduleDefId}
                        onChange={(e) => {
                          const v = e.target.value
                          setNewScheduleDefId(v)
                          setSearchParams(
                            (prev) => {
                              const next = new URLSearchParams(prev)
                              next.set('tab', 'schedules')
                              if (v) next.set('def', v)
                              else next.delete('def')
                              return next
                            },
                            { replace: true },
                          )
                        }}
                        className={`${SETTINGS_INPUT} bg-white`}
                      >
                        <option value="">Velg mal…</option>
                        {rb.templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-title">
                        Tittel (valgfri)
                      </label>
                      <input
                        id="sched-title"
                        value={newScheduleTitle}
                        onChange={(e) => setNewScheduleTitle(e.target.value)}
                        placeholder="f.eks. Månedlig til ledergruppe"
                        className={`${SETTINGS_INPUT} bg-white`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <p className={SETTINGS_FIELD_LABEL}>Frekvens</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SCHEDULE_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setNewScheduleCron(p.cron)
                              setNewScheduleTimezone(p.tz)
                              setScheduleCronAdvanced(false)
                            }}
                            className={`${R_FLAT} border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-neutral-800 hover:bg-neutral-50 sm:text-xs`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={scheduleCronAdvanced}
                          onChange={(e) => setScheduleCronAdvanced(e.target.checked)}
                          className="size-4 rounded-none border-neutral-300"
                        />
                        Avansert: rediger cron og tidssone selv
                      </label>
                      {scheduleCronAdvanced ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-cron">
                              Cron-uttrykk
                            </label>
                            <input
                              id="sched-cron"
                              value={newScheduleCron}
                              onChange={(e) => setNewScheduleCron(e.target.value)}
                              className={`${SETTINGS_INPUT} bg-white font-mono text-xs`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-tz">
                              Tidssone
                            </label>
                            <input
                              id="sched-tz"
                              value={newScheduleTimezone}
                              onChange={(e) => setNewScheduleTimezone(e.target.value)}
                              className={`${SETTINGS_INPUT} bg-white font-mono text-xs`}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-neutral-500">
                          <span className="font-mono">{newScheduleCron}</span> · {newScheduleTimezone}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!newScheduleDefId || schedules.loading}
                    onClick={async () => {
                      if (!newScheduleDefId) return
                      const created = await schedules.createSchedule({
                        report_definition_id: newScheduleDefId,
                        title: newScheduleTitle.trim() || templateNameById.get(newScheduleDefId) || 'Plan',
                        cron_expr: newScheduleCron.trim() || '0 8 1 * *',
                        timezone: newScheduleTimezone.trim() || 'Europe/Oslo',
                        enabled: false,
                        channel: 'email',
                      })
                      if (created) {
                        setNewScheduleTitle('')
                        setNewScheduleCron('0 8 1 * *')
                        setNewScheduleTimezone('Europe/Oslo')
                        setScheduleCronAdvanced(false)
                      }
                    }}
                    className={`${R_FLAT} mt-4 inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50`}
                  >
                    {schedules.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Legg til plan
                  </button>
                </div>

                {schedules.loading && schedules.schedules.length === 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Laster planer…
                  </p>
                ) : schedules.schedules.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-500">Ingen planer lagret ennå.</p>
                ) : (
                  <ul className="mt-6 divide-y divide-neutral-100 rounded-none border border-neutral-200 bg-white">
                    {schedules.schedules.map((s) => {
                      const malNavn = templateNameById.get(s.report_definition_id)
                      const malSlettet = !malNavn
                      return (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900">{s.title}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              Mal:{' '}
                              {malSlettet ? (
                                <span className="rounded-none border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                  Mal slettet
                                </span>
                              ) : (
                                malNavn
                              )}
                              {' · '}
                              <span className="font-mono">{s.cron_expr}</span>
                              {' · '}
                              {s.timezone}
                              {' · '}
                              {s.channel === 'email' ? 'E-post' : s.channel}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
                              <input
                                type="checkbox"
                                checked={s.enabled}
                                onChange={(e) => void schedules.updateSchedule(s.id, { enabled: e.target.checked })}
                                className="size-4 rounded-none border-neutral-300"
                              />
                              Aktiv (når motor er på plass)
                            </label>
                            <button
                              type="button"
                              onClick={() => void schedules.deleteSchedule(s.id)}
                              className={`${R_FLAT} border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50`}
                            >
                              Slett
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </Mainbox1>
        </section>
      )}

      {mainTab === 'tools' && (
        <section className="mt-8 space-y-6">
          <ScopedError message={rep.error} onDismiss={rep.clearError} />
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
            if (e.target === e.currentTarget) requestCloseBuilder()
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,1100px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-builder-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 flex-col gap-2 border-b border-neutral-200/90 bg-[#f7f6f2] px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-[min(100%,42rem)]">
                  <h2
                    id="report-builder-title"
                    className="text-xl font-semibold text-neutral-900 sm:text-2xl"
                    style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                  >
                    Rapport: {draft.name}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    {draft.rowVersion == null
                      ? 'Lagre én gang for å låse malen til organisasjonen før rapportlogg bruker stabil ID.'
                      : builderDirty
                        ? 'Ulagrede endringer — bruk «Lagre mal» eller Ctrl/Cmd+S.'
                        : 'Alt lagret.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={requestCloseBuilder}
                    className={`${R_FLAT} px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200/50`}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saveDraftLoading || !draft?.name.trim()}
                    className={`${R_FLAT} inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50 disabled:opacity-50`}
                  >
                    {saveDraftLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                    Lagre mal
                  </button>
                  <button
                    type="button"
                    onClick={() => void runCustomReport()}
                    disabled={runCustomLoading || previewLoading}
                    className={`${R_FLAT} px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50`}
                    style={{ backgroundColor: accent }}
                  >
                    {runCustomLoading || previewLoading ? 'Oppdaterer…' : 'Kjør rapport'}
                  </button>
                  <button
                    type="button"
                    onClick={requestCloseBuilder}
                    className="rounded-none p-2 text-neutral-500 hover:bg-neutral-200/60"
                    aria-label="Lukk"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-[1.25rem] flex-wrap items-center gap-3 text-xs">
                {saveDraftOk ? (
                  <span className="font-medium text-emerald-800">Mal lagret.</span>
                ) : null}
                {runCustomOk ? (
                  <span className="font-medium text-emerald-800">Rapport kjørt og logget.</span>
                ) : null}
                {rb.error?.includes('noen andre') ? (
                  <button
                    type="button"
                    onClick={() => void reloadTemplateFromServer()}
                    className="font-semibold text-[#1a3d32] underline decoration-neutral-400 underline-offset-2 hover:decoration-[#1a3d32]"
                  >
                    Last mal på nytt fra server
                  </button>
                ) : null}
              </div>
              {rb.error ? (
                <ScopedError message={rb.error} onDismiss={rb.clearError} className="mt-0" />
              ) : null}
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
