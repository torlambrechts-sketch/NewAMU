import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { LegalDisclaimer } from '../components/internalControl/LegalDisclaimer'
import { ROS_CONSEQUENCE_CATEGORIES } from '../data/rosConsequenceCategories'
import { buildRosApprovedTaskDescription, shouldCreateTaskForRosRow } from '../lib/rosTaskFromLock'
import { RISK_COLOUR_CLASSES, riskColour } from '../data/rosTemplate'
import { useInternalControl } from '../hooks/useInternalControl'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useWorkplacePublishedComposerStacks } from '../hooks/useWorkplacePublishedComposerStacks'
import type {
  AnnualReview,
  AnnualReviewActionDraft,
  AnnualReviewSections,
  InternalControlAuditEntry,
  RosAssessment,
  RosCategory,
  RosWorkspaceCategory,
} from '../types/internalControl'
import { isRosDocumentDraft, isRosRiskRowDraft, isRosRowDoneForTracking } from '../types/internalControl'
import { EMPTY_ANNUAL_REVIEW_SECTIONS, isLegacyAnnualReview } from '../types/internalControl'
import { useHrCompliance } from '../hooks/useHrCompliance'
import { useHse } from '../hooks/useHse'
import { useTasks } from '../hooks/useTasks'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useWorkplaceKpiStripStyle } from '../hooks/useWorkplaceKpiStripStyle'
import { useUiTheme } from '../hooks/useUiTheme'
import { formatLevel1AuditLine } from '../lib/level1Signature'
import {
  INSIGHT_CARD,
  INSIGHT_CARD_TOP_RULE,
  ModuleDonutCard,
  type InsightSeg,
} from '../components/insights/ModuleInsightCharts'
import type { HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { LayoutScoreStatRow } from '../components/layout/LayoutScoreStatRow'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import { RosWorkplaceLayoutRiskMatrixSection, RosWorkplaceLayoutRiskTableSection } from './platform/rosRiskLayoutBlocks'
import { InternalControlTabShell } from './internalControl/InternalControlTabShell'
import { RosAssessmentsList2 } from './internalControl/RosAssessmentsList2'
import {
  resolveIcOverviewComposerFromPublishedRows,
  type IcOverviewComposerResolved,
} from '../lib/icOverviewLayoutFromPreset'
import { resolveRosTabLayoutFromPublishedRows, type RosTabLayoutResolved } from '../lib/rosLayoutFromPreset'
import { renderLayoutComposerBlock } from './platform/PlatformLayoutComposerPage'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: LayoutDashboard, iconOnly: false as const },
  { id: 'ros' as const, label: 'ROS / risiko', icon: ClipboardList, iconOnly: false as const },
  { id: 'annual' as const, label: 'Årsgjennomgang', icon: Calendar, iconOnly: false as const },
] as const

const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const TASK_PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'
const SETTINGS_FIELD_LABEL_ON_DARK = 'text-[10px] font-bold uppercase tracking-wider text-white/90'
const SETTINGS_INPUT_ON_DARK =
  'mt-1.5 w-full rounded-none border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none focus:ring-1 focus:ring-white'
const ORG_MERGED_PANEL =
  'mt-6 flex flex-col gap-4 rounded-none border border-black/15 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 md:p-5'
const ORG_MERGED_COL = 'min-w-0 flex-1 sm:max-w-[min(100%,280px)]'
const ORG_MERGED_ACTION_COL = 'flex w-full shrink-0 flex-col justify-end sm:w-auto sm:min-w-[160px]'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
/** Same strip boxes as HSE oversikt / rapporter */
const IC_THRESHOLD_STRIP = SETTINGS_THRESHOLD_BOX
const ROS_WORKSPACE_LABELS: Record<RosWorkspaceCategory, string> = {
  general: 'Generelt',
  production: 'Produksjon',
  office: 'Kontor',
  warehouse: 'Lager / logistikk',
  construction: 'Bygg / anlegg',
  healthcare: 'Helse / omsorg',
}
function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function auditLogSegment(a: InternalControlAuditEntry): 'init' | 'ros' | 'annual' | 'other' {
  const act = a.action
  if (act === 'init') return 'init'
  if (act.startsWith('ros_')) return 'ros'
  if (act.startsWith('annual_review')) return 'annual'
  return 'other'
}

export function InternalControlModule() {
  const { barStyle: kpiStripStyle } = useWorkplaceKpiStripStyle()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const ic = useInternalControl()
  const hr = useHrCompliance()
  const hse = useHse()
  const { addTask } = useTasks()
  const { supabaseConfigured, profile, user } = useOrgSetupContext()
  const { publishedStackTemplates } = useWorkplacePublishedComposerStacks()
  const [searchParams, setSearchParams] = useSearchParams()
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })
  const navigate = useNavigate()

  useEffect(() => {
    if (tabParam === 'audit') {
      queueMicrotask(() => navigate('/workspace/revisjonslogg?source=internal_control', { replace: true }))
    }
  }, [tabParam, navigate])

  const annualFocus = searchParams.get('focus')
  useEffect(() => {
    if (tab !== 'annual' || annualFocus !== 'yearskontroll') return
    const t = window.setTimeout(() => {
      document.getElementById('ic-annual-yearskontroll')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('focus')
          return p
        },
        { replace: true },
      )
    }, 250)
    return () => window.clearTimeout(t)
  }, [tab, annualFocus, setSearchParams])

  const [overviewTimeAnchor] = useState(() => Date.now())

  const [rosTitle, setRosTitle] = useState('')
  const [rosDescription, setRosDescription] = useState('')
  const [rosDept, setRosDept] = useState('')
  const [rosAssessor, setRosAssessor] = useState('')
  const [rosCategory, setRosCategory] = useState<RosCategory>('general')
  const [rosWorkspace, setRosWorkspace] = useState<RosWorkspaceCategory>('general')
  const [oRosAmuId, setORosAmuId] = useState('')
  const [oRosVoId, setORosVoId] = useState('')
  const [rosPanelOpen, setRosPanelOpen] = useState(false)
  const [rosPanelMode, setRosPanelMode] = useState<'create' | 'view'>('create')
  const [rosViewId, setRosViewId] = useState<string | null>(null)
  const [rosHighlightRowId, setRosHighlightRowId] = useState<string | null>(null)
  const [rosListSearch, setRosListSearch] = useState('')
  const [annualListSearch, setAnnualListSearch] = useState('')
  const [annualPanelOpen, setAnnualPanelOpen] = useState(false)
  type AnnualFormState = {
    id: string
    year: number
    reviewedAt: string
    nextReviewDue: string
    reviewerDisplay: string
    sections: AnnualReviewSections
    actionRows: AnnualReviewActionDraft[]
    status: AnnualReview['status']
    /** Eldre årsgjennomgang — vises read-only */
    legacySummary?: string | null
  }
  const [annualForm, setAnnualForm] = useState<AnnualFormState | null>(null)

  const annualFormFieldsLocked = useMemo(
    () =>
      annualForm
        ? Boolean(annualForm.legacySummary) ||
          annualForm.status === 'locked' ||
          annualForm.status === 'pending_safety_rep'
        : false,
    [annualForm],
  )

  const resetRosPanelForm = useCallback(() => {
    setRosTitle('')
    setRosDescription('')
    setRosDept('')
    setRosAssessor('')
    setRosCategory('general')
    setRosWorkspace('general')
    setORosAmuId('')
    setORosVoId('')
  }, [])

  const closeRosPanel = useCallback(() => {
    setRosPanelOpen(false)
    setRosPanelMode('create')
    setRosViewId(null)
    setRosHighlightRowId(null)
    resetRosPanelForm()
  }, [resetRosPanelForm])

  const openRosViewPanel = useCallback((id: string, rowId?: string | null) => {
    setRosPanelMode('view')
    setRosViewId(id)
    setRosHighlightRowId(rowId ?? null)
    setRosPanelOpen(true)
  }, [])

  const openNewRosPanel = useCallback(() => {
    resetRosPanelForm()
    setRosPanelMode('create')
    setRosViewId(null)
    setRosPanelOpen(true)
  }, [resetRosPanelForm])

  const rosBeingViewed = useMemo(
    () => (rosViewId ? ic.rosAssessments.find((x) => x.id === rosViewId) : undefined),
    [ic.rosAssessments, rosViewId],
  )

  useEffect(() => {
    if (!rosPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [rosPanelOpen])

  useEffect(() => {
    if (!rosPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRosPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rosPanelOpen, closeRosPanel])

  const auditStats = useMemo(() => {
    const list = ic.auditTrail
    return {
      total: list.length,
      ros: list.filter((a) => auditLogSegment(a) === 'ros').length,
      annual: list.filter((a) => auditLogSegment(a) === 'annual').length,
      other: list.filter((a) => {
        const s = auditLogSegment(a)
        return s !== 'ros' && s !== 'annual'
      }).length,
    }
  }, [ic.auditTrail])

  const auditEntriesLast90 = useMemo(
    () =>
      ic.auditTrail.filter((a) => {
        try {
          return new Date(a.at).getTime() > overviewTimeAnchor - 90 * 86400000
        } catch {
          return false
        }
      }),
    [ic.auditTrail, overviewTimeAnchor],
  )

  const rosStats = useMemo(() => {
    const list = ic.rosAssessments
    const locked = list.filter((r) => r.locked).length
    const drafts = list.filter((r) => !r.locked).length
    return { total: list.length, locked, drafts }
  }, [ic.rosAssessments])

  const annualStats = useMemo(() => {
    const list = ic.annualReviews
    return {
      total: list.length,
      draft: list.filter((a) => (a.status ?? 'draft') === 'draft' && !a.locked).length,
      pending: list.filter((a) => a.status === 'pending_safety_rep').length,
      locked: list.filter((a) => a.locked || a.status === 'locked').length,
    }
  }, [ic.annualReviews])

  const icOverviewKpis = useMemo(
    () => [
      {
        title: 'ROS',
        sub: 'Totalt / låst',
        value: `${rosStats.total} / ${rosStats.locked}`,
      },
      {
        title: 'Årsgjennomgang',
        sub: 'Låst / pågår',
        value: `${annualStats.locked} / ${annualStats.draft + annualStats.pending}`,
      },
      {
        title: 'Logg (90 d.)',
        sub: 'Hendelser i revisjonslogg',
        value: String(auditEntriesLast90.length),
      },
      {
        title: 'Åpne ROS-rader',
        sub: 'Tiltak / risiko som ikke er lukket',
        value: String(
          ic.rosAssessments.reduce(
            (n, r) => n + r.rows.filter((row) => !isRosRowDoneForTracking(row.status)).length,
            0,
          ),
        ),
      },
    ],
    [annualStats, auditEntriesLast90.length, ic.rosAssessments, rosStats],
  )

  const icRosCategorySegments = useMemo(() => {
    const palette = ['#1a3d32', '#7c3aed']
    const general = ic.rosAssessments.filter((r) => (r.rosCategory ?? 'general') === 'general').length
    const org = ic.rosAssessments.filter((r) => r.rosCategory === 'organizational_change').length
    const entries: InsightSeg[] = [
      { label: 'Generell ROS', value: general, color: palette[0] },
      { label: 'O-ROS (endring)', value: org, color: palette[1] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [ic.rosAssessments])

  const icRosWorkspaceSegments = useMemo(() => {
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#0d9488', '#dc2626', '#7c3aed']
    const keys = Object.keys(ROS_WORKSPACE_LABELS) as RosWorkspaceCategory[]
    const counts: Record<RosWorkspaceCategory, number> = {
      general: 0,
      production: 0,
      office: 0,
      warehouse: 0,
      construction: 0,
      healthcare: 0,
    }
    for (const r of ic.rosAssessments) {
      const w = r.workspaceCategory ?? 'general'
      counts[w] = (counts[w] ?? 0) + 1
    }
    const entries: InsightSeg[] = keys
      .map((k, idx) => ({
        label: ROS_WORKSPACE_LABELS[k],
        value: counts[k] ?? 0,
        color: palette[idx % palette.length],
      }))
      .filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [ic.rosAssessments])

  const icAnnualStatusSegments = useMemo(() => {
    const palette = ['#94a3b8', '#0284c7', '#059669']
    const entries: InsightSeg[] = [
      { label: 'Utkast', value: annualStats.draft, color: palette[0] },
      { label: 'Venter VO', value: annualStats.pending, color: palette[1] },
      { label: 'Låst', value: annualStats.locked, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [annualStats])

  const icRosRowRiskSegments = useMemo(() => {
    const palette = ['#059669', '#f59e0b', '#dc2626']
    let green = 0
    let yellow = 0
    let red = 0
    for (const r of ic.rosAssessments) {
      for (const row of r.rows) {
        const c = riskColour(row.riskScore)
        if (c === 'green') green += 1
        else if (c === 'yellow') yellow += 1
        else red += 1
      }
    }
    const entries: InsightSeg[] = [
      { label: RISK_COLOUR_CLASSES.green.label, value: green, color: palette[0] },
      { label: RISK_COLOUR_CLASSES.yellow.label, value: yellow, color: palette[1] },
      { label: RISK_COLOUR_CLASSES.red.label, value: red, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [ic.rosAssessments])

  const icAuditSegmentSlices = useMemo(() => {
    const palette = ['#0284c7', '#d97706', '#64748b', '#94a3b8']
    const entries: InsightSeg[] = [
      { label: 'ROS-relatert', value: auditStats.ros, color: palette[0] },
      { label: 'Årsgjennomgang', value: auditStats.annual, color: palette[1] },
      { label: 'Øvrig', value: auditStats.other, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [auditStats])

  const sortedAnnuals = useMemo(
    () => [...ic.annualReviews].sort((a, b) => b.year - a.year || b.reviewedAt.localeCompare(a.reviewedAt)),
    [ic.annualReviews],
  )

  const annualReviewsFiltered = useMemo(() => {
    const q = annualListSearch.trim().toLowerCase()
    if (!q) return sortedAnnuals
    return sortedAnnuals.filter((a) => {
      const y = String(a.year)
      const rev = (a.reviewer ?? '').toLowerCase()
      const dt = (a.reviewedAt ?? '').toLowerCase()
      const legacy = isLegacyAnnualReview(a)
      const st = a.status ?? (a.locked ? 'locked' : legacy ? 'locked' : 'draft')
      const statusText =
        st === 'locked' ? 'låst' : st === 'pending_safety_rep' ? 'venter verneombud' : 'utkast'
      return y.includes(q) || rev.includes(q) || dt.includes(q) || statusText.includes(q)
    })
  }, [sortedAnnuals, annualListSearch])

  const tbodyRow = useCallback((ri: number) => table1BodyRowClass(layout, ri), [layout])

  const canSignAsSafetyRep = Boolean(
    user?.id &&
      (profile?.is_org_admin === true ||
        (profile?.learning_metadata &&
          (profile.learning_metadata as { is_safety_rep?: boolean }).is_safety_rep === true)),
  )

  const annualDashboardYear = annualForm?.year ?? new Date().getFullYear()
  const annualDashboard = useMemo(() => {
    const year = annualDashboardYear
    const incidents = hse.incidents.filter((i) => {
      try {
        return new Date(i.occurredAt).getFullYear() === year
      } catch {
        return false
      }
    })
    const openIncidents = incidents.filter((i) => i.status !== 'closed')
    const safetyRounds = hse.safetyRounds.filter((sr) => {
      try {
        return new Date(sr.conductedAt).getFullYear() === year
      } catch {
        return false
      }
    })
    const approvedRounds = safetyRounds.filter((sr) => sr.status === 'approved')
    const sickCases = hse.sickLeaveCases.filter((c) => {
      try {
        return new Date(c.sickFrom).getFullYear() === year
      } catch {
        return false
      }
    })
    const rosInYear = ic.rosAssessments.filter((r) => {
      try {
        return new Date(r.assessedAt).getFullYear() === year
      } catch {
        return false
      }
    })
    const rosLocked = rosInYear.filter((r) => r.locked).length
    let sickNote = '—'
    if (sickCases.length > 0) {
      const avgDeg = sickCases.reduce((s, c) => s + (c.sicknessDegree ?? 0), 0) / sickCases.length
      sickNote = `${sickCases.length} sykefraværssaker · snitt sykdomsgrad ${avgDeg.toFixed(0)} % (ikke samme som fraværsprosent)`
    }
    return {
      incidentCount: incidents.length,
      openIncidents: openIncidents.length,
      safetyTotal: safetyRounds.length,
      safetyApproved: approvedRounds.length,
      sickCases: sickCases.length,
      sickNote,
      rosTotal: rosInYear.length,
      rosLocked,
    }
  }, [annualDashboardYear, hse.incidents, hse.safetyRounds, hse.sickLeaveCases, ic.rosAssessments])

  const closeAnnualPanel = useCallback(() => {
    setAnnualPanelOpen(false)
    setAnnualForm(null)
  }, [])

  useEffect(() => {
    if (!annualPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [annualPanelOpen])

  useEffect(() => {
    if (!annualPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAnnualPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [annualPanelOpen, closeAnnualPanel])

  const openNewAnnualPanel = useCallback(() => {
    const y = new Date().getFullYear()
    const id = crypto.randomUUID()
    const today = new Date().toISOString().slice(0, 10)
    const nextDue = `${y + 1}-12-31`
    const reviewerDisplay = profile?.display_name?.trim() || user?.email || ''
    setAnnualForm({
      id,
      year: y,
      reviewedAt: today,
      nextReviewDue: nextDue,
      reviewerDisplay,
      sections: { ...EMPTY_ANNUAL_REVIEW_SECTIONS },
      actionRows: [],
      status: 'draft',
    })
    ic.upsertAnnualReview({
      id,
      year: y,
      reviewedAt: today,
      reviewer: reviewerDisplay,
      summary: '',
      nextReviewDue: nextDue,
      sections: { ...EMPTY_ANNUAL_REVIEW_SECTIONS },
      actionPlanDrafts: [],
      signatures: [],
      status: 'draft',
      locked: false,
    })
    setAnnualPanelOpen(true)
  }, [ic, profile?.display_name, user?.email])

  const openAnnualPanelFor = useCallback(
    (a: AnnualReview) => {
      if (isLegacyAnnualReview(a)) {
        setAnnualForm({
          id: a.id,
          year: a.year,
          reviewedAt: a.reviewedAt,
          nextReviewDue: a.nextReviewDue,
          reviewerDisplay: a.reviewer,
          sections: { ...EMPTY_ANNUAL_REVIEW_SECTIONS },
          actionRows: [],
          status: 'locked',
          legacySummary: a.summary,
        })
        setAnnualPanelOpen(true)
        return
      }
      setAnnualForm({
        id: a.id,
        year: a.year,
        reviewedAt: a.reviewedAt,
        nextReviewDue: a.nextReviewDue,
        reviewerDisplay: a.reviewer,
        sections: a.sections ? { ...a.sections } : { ...EMPTY_ANNUAL_REVIEW_SECTIONS },
        actionRows: [...(a.actionPlanDrafts ?? [])],
        status: a.status ?? (a.locked ? 'locked' : 'draft'),
        legacySummary: null,
      })
      setAnnualPanelOpen(true)
    },
    [],
  )

  const persistAnnualDraftFromForm = useCallback(() => {
    if (!annualForm) return
    const cur = ic.annualReviews.find((x) => x.id === annualForm.id)
    const prevSec = cur?.sections
    const nextSec = annualForm.sections
    const labels: Partial<Record<keyof typeof nextSec, string>> = {
      goalsLastYearComment: 'Kommentar fjorårets mål',
      deviationsReview: 'Avvik',
      rosReview: 'ROS',
      sickLeaveReview: 'Sykefravær',
      goalsNextYear: 'HMS-mål',
      actionPlanStatusReview: 'Tiltaksplan (årskontroll)',
      effectEvaluation: 'Effektevaluering',
      incidentsRealityCheck: 'Hendelser/avvik',
      threatLandscapeChanges: 'Trusselbilde',
      pdcaCheckActNotes: 'PDCA Check/Act',
    }
    let changeLog = [...(cur?.changeLog ?? [])]
    if (prevSec && cur && !cur.locked) {
      const at = new Date().toISOString()
      for (const k of Object.keys(labels) as (keyof typeof nextSec)[]) {
        const a = (prevSec[k] ?? '').trim()
        const b = (nextSec[k] ?? '').trim()
        if (a !== b && labels[k]) {
          changeLog = [...changeLog, { at, message: `Oppdatert: ${labels[k]}` }].slice(-80)
        }
      }
    }
    ic.upsertAnnualReview({
      id: annualForm.id,
      year: annualForm.year,
      reviewedAt: annualForm.reviewedAt,
      reviewer: annualForm.reviewerDisplay,
      summary: cur?.summary ?? '',
      nextReviewDue: annualForm.nextReviewDue,
      sections: annualForm.sections,
      actionPlanDrafts: annualForm.actionRows,
      status: annualForm.status ?? cur?.status ?? 'draft',
      locked: cur?.locked ?? false,
      signatures: cur?.signatures ?? [],
      createdAt: cur?.createdAt,
      changeLog,
    })
  }, [annualForm, ic])

  const handleRosLockTasks = useCallback(
    (ros: RosAssessment) => {
      for (const row of ros.rows) {
        if (!shouldCreateTaskForRosRow(row)) continue
        const measure = row.proposedMeasures!.trim()
        const who = row.responsible!.trim()
        const due = row.dueDate!.trim()
        addTask({
          title: `ROS-tiltak: ${measure.slice(0, 80)}${measure.length > 80 ? '…' : ''}`,
          description: buildRosApprovedTaskDescription(ros, row),
          assignee: who,
          ownerRole: 'Ansvarlig (ROS)',
          dueDate: due,
          status: 'todo',
          module: 'hse',
          sourceType: 'ros_measure',
          sourceId: ros.id,
          sourceLabel: `ROS-rad ${row.id.slice(0, 8)}`,
          requiresManagementSignOff: false,
        })
      }
    },
    [addTask],
  )

  const icHubItems: HubMenu1Item[] = useMemo(
    () =>
      tabs.map(({ id, label, icon: Icon }) => ({
        key: id,
        label,
        icon: Icon,
        active: tab === id,
        to: `/internal-control?tab=${id}`,
      })),
    [tab],
  )

  const [icOverviewComposer, setIcOverviewComposer] = useState<IcOverviewComposerResolved>(() =>
    resolveIcOverviewComposerFromPublishedRows(null),
  )

  const [rosTabLayout, setRosTabLayout] = useState<RosTabLayoutResolved>(() =>
    resolveRosTabLayoutFromPublishedRows(null),
  )

  useEffect(() => {
    setIcOverviewComposer(resolveIcOverviewComposerFromPublishedRows(publishedStackTemplates))
    setRosTabLayout(resolveRosTabLayoutFromPublishedRows(publishedStackTemplates))
  }, [publishedStackTemplates])

  const rosLayoutNodes = useMemo(() => {
    const order = rosTabLayout.order
    const nodes: ReactNode[] = []
    let i = 0
    while (i < order.length) {
      const id = order[i]
      const next = order[i + 1]
      if (id === 'rosRiskMatrix' && next === 'rosRiskTable') {
        nodes.push(
          <div key={`ros-split-${i}`} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <RosWorkplaceLayoutRiskMatrixSection assessments={ic.rosAssessments} onNewRisk={openNewRosPanel} />
            </div>
            <div className="min-w-0">
              <RosWorkplaceLayoutRiskTableSection
                assessments={ic.rosAssessments}
                onRowClick={(rosId, rowId) => openRosViewPanel(rosId, rowId)}
              />
            </div>
          </div>,
        )
        i += 2
        continue
      }
      if (id === 'scoreStatRow') {
        nodes.push(
          <div key="scoreStatRow">
            <LayoutScoreStatRow
              items={[
                { big: String(rosStats.total), title: 'Totalt', sub: 'ROS-vurderinger' },
                { big: String(rosStats.drafts), title: 'Utkast', sub: 'Ikke signert / låst' },
                { big: String(rosStats.locked), title: 'Låst', sub: 'Signert leder + VO' },
              ]}
            />
          </div>,
        )
      } else if (id === 'list2') {
        nodes.push(
          <RosAssessmentsList2
            key="list2"
            assessments={ic.rosAssessments}
            search={rosListSearch}
            onSearchChange={setRosListSearch}
            onNewRos={openNewRosPanel}
            onOpenRow={openRosViewPanel}
          />,
        )
      } else if (id === 'rosRiskMatrix') {
        nodes.push(
          <div key="rosRiskMatrix" className="min-w-0">
            <RosWorkplaceLayoutRiskMatrixSection assessments={ic.rosAssessments} onNewRisk={openNewRosPanel} />
          </div>,
        )
      } else if (id === 'rosRiskTable') {
        nodes.push(
            <div key="rosRiskTable" className="min-w-0">
            <RosWorkplaceLayoutRiskTableSection
              assessments={ic.rosAssessments}
              onRowClick={(rosId, rowId) => openRosViewPanel(rosId, rowId)}
            />
          </div>,
        )
      } else {
        const demo = renderLayoutComposerBlock(id)
        if (demo) nodes.push(<div key={id}>{demo}</div>)
      }
      i += 1
    }
    return nodes
  }, [
    rosTabLayout.order,
    rosStats.total,
    rosStats.drafts,
    rosStats.locked,
    ic.rosAssessments,
    rosListSearch,
    openNewRosPanel,
    openRosViewPanel,
  ])

  useEffect(() => {
    if (!rosPanelOpen || rosPanelMode !== 'view' || !rosHighlightRowId) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`ros-risk-section-${rosHighlightRowId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(t)
  }, [rosPanelOpen, rosPanelMode, rosHighlightRowId, rosViewId])

  return (
    <>
      {tab === 'overview' ? (
        <InternalControlTabShell
          hubItems={icHubItems}
          description={
            <p>
              <strong>ROS / risiko</strong> og <strong>årsgjennomgang</strong>.{' '}
              <Link to="/workspace/revisjonslogg?source=internal_control" className="font-medium text-[#1a3d32] underline">
                Revisjonslogg (Workspace)
              </Link>
              . Varsling (AML kap. 2A) i{' '}
              <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">
                Oppgaver → Varslingssaker
              </Link>
              .
            </p>
          }
        >
          <LegalDisclaimer />

          {ic.error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ic.error}</p>
          )}
          {ic.loading && supabaseConfigured && (
            <p className="mb-4 text-sm text-neutral-500">Laster internkontrolldata…</p>
          )}

          <div className="space-y-10">
          {icOverviewComposer.presetNameMatched ? (
            <div className="space-y-8">
              <p className="text-xs text-neutral-500">
                Oppsett fra plattform-admin layout-komponer:{' '}
                <span className="font-medium text-neutral-700">«{icOverviewComposer.presetNameMatched}»</span> (lagret i
                denne nettleseren).
              </p>
              {icOverviewComposer.order.map((blockId) => {
                const node: ReactNode = renderLayoutComposerBlock(blockId)
                if (!node) return null
                return <div key={blockId}>{node}</div>
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {icOverviewKpis.map((item) => (
                  <div key={item.title} className={IC_THRESHOLD_STRIP} style={kpiStripStyle}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                    <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <section>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Internkontroll-innsikt</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ModuleDonutCard
                    title="ROS etter type"
                    subtitle="Generell vs. organisatorisk endring"
                    segments={icRosCategorySegments.entries}
                    total={icRosCategorySegments.total}
                    emptyHint="Ingen ROS registrert ennå."
                  />
                  <ModuleDonutCard
                    title="ROS etter arbeidsområde"
                    subtitle="Fordeling i registeret"
                    segments={icRosWorkspaceSegments.entries}
                    total={icRosWorkspaceSegments.total}
                    emptyHint="Ingen ROS å vise."
                  />
                  <ModuleDonutCard
                    title="Årsgjennomgang"
                    subtitle="Status på år"
                    segments={icAnnualStatusSegments.entries}
                    total={icAnnualStatusSegments.total}
                    emptyHint="Ingen årsgjennomgang registrert."
                  />
                  <ModuleDonutCard
                    title="ROS-rader etter risiko (brutto)"
                    subtitle="Alle rader i alle ROS"
                    segments={icRosRowRiskSegments.entries}
                    total={icRosRowRiskSegments.total}
                    emptyHint="Ingen risikorader."
                  />
                  <ModuleDonutCard
                    title="Revisjonslogg (kategorier)"
                    subtitle="Totalt i loggen fordelt"
                    segments={icAuditSegmentSlices.entries}
                    total={icAuditSegmentSlices.total}
                    emptyHint="Loggen er tom."
                  />
                  <div className={INSIGHT_CARD}>
                    <div className={INSIGHT_CARD_TOP_RULE} />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Drift og koblinger</p>
                    <p className="mt-3 text-3xl font-semibold tabular-nums text-[#1a3d32]">{rosStats.drafts}</p>
                    <p className="mt-1 text-sm text-neutral-600">ROS-utkast (åpne)</p>
                    <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm text-neutral-700">
                      <div className="flex justify-between gap-2">
                        <span className="text-neutral-500">Årsgj. utkast / venter VO</span>
                        <span className="font-semibold tabular-nums">
                          {annualStats.draft} / {annualStats.pending}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-neutral-500">Hendelser i logg (90 d.)</span>
                        <span className="font-semibold tabular-nums">{auditEntriesLast90.length}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setTab('ros')}
                        className="text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                      >
                        Gå til ROS →
                      </button>
                      <Link to="/tasks?view=whistle" className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline">
                        Varslingssaker →
                      </Link>
                      <Link to="/workplace-reporting/anonymous-aml" className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline">
                        Anonym rapportering →
                      </Link>
                      <Link
                        to="/workspace/revisjonslogg?source=internal_control"
                        className="text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                      >
                        Revisjonslogg →
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <div className="rounded-none border border-amber-200/80 bg-amber-50/90 p-5 text-sm text-amber-950">
            <strong>Meldingsflyt:</strong> Mottatt → vurdering → undersøkelse → intern revisjon ved behov → avsluttet når
            dokumentert. Anonym AML-innsending gir referanse-ID; fritekst lagres ikke i organisasjonshelse.
          </div>
          </div>
        </InternalControlTabShell>
      ) : null}

      {tab === 'ros' ? (
        <InternalControlTabShell
          hubItems={icHubItems}
          description={
            <p>
              ROS, årsgjennomgang og logg. Varsling ligger under{' '}
              <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">
                Oppgaver → Varslingssaker
              </Link>
              .
            </p>
          }
        >
          {ic.error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ic.error}</p>
          )}
          {ic.loading && supabaseConfigured && (
            <p className="mb-4 text-sm text-neutral-500">Laster internkontrolldata…</p>
          )}

          {/** Layout-ROS: rekkefølge fra publisert stack-mal «Layout_ROS» (DB) eller lokalt oppsett; standard KPI → List 2 → matrise | risiko-tabell */}
          <div className="mt-2 min-w-0 space-y-6">
            {rosTabLayout.presetNameMatched ? (
              <p className="text-xs text-neutral-500">
                Oppsett fra plattform-admin:{' '}
                <span className="font-medium text-neutral-700">«{rosTabLayout.presetNameMatched}»</span>
                {supabaseConfigured
                  ? ' (oppdateres automatisk når publiserte maler endres i plattform-admin).'
                  : ' (lagret i denne nettleseren).'}
              </p>
            ) : null}
            {rosLayoutNodes}
          </div>

          {rosPanelOpen ? (
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeRosPanel()
              }}
            >
              <div
                className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ros-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
                  <div className="min-w-0 flex-1">
                    <h2
                      id="ros-panel-title"
                      className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                    >
                      {rosPanelMode === 'create'
                        ? 'Ny ROS-vurdering'
                        : rosBeingViewed
                          ? rosBeingViewed.title
                          : 'ROS'}
                    </h2>
                    {rosPanelMode === 'view' && rosBeingViewed ? (
                      <p className="mt-1 text-sm text-neutral-500">
                        {rosBeingViewed.department || '—'} · {rosBeingViewed.assessedAt}
                        {rosBeingViewed.locked ? (
                          <span className="ml-2 rounded-none border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Låst
                          </span>
                        ) : (
                          <span className="ml-2 rounded-none border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Utkast
                          </span>
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {rosPanelMode === 'view' && rosBeingViewed?.locked ? (
                      <button
                        type="button"
                        onClick={() => {
                          const newId = ic.duplicateRosRevision(rosBeingViewed.id)
                          if (newId) setRosViewId(newId)
                        }}
                        className="rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#142e26]"
                      >
                        Ny revisjon
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeRosPanel}
                      className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
                      aria-label="Lukk"
                    >
                      <X className="size-6" />
                    </button>
                  </div>
                </header>

                {rosPanelMode === 'view' ? (
                  rosBeingViewed ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                      <RosAssessmentCard
                        ros={rosBeingViewed}
                        ic={ic}
                        hr={hr}
                        onLocked={handleRosLockTasks}
                        highlightRowId={rosHighlightRowId}
                        hideDuplicateRevisionButton
                        duplicateRevision={(lockedSourceId) => {
                          const newId = ic.duplicateRosRevision(lockedSourceId)
                          if (newId) setRosViewId(newId)
                        }}
                        onDeleteRos={(rosId) => {
                          ic.deleteRosAssessment(rosId)
                          closeRosPanel()
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col justify-center px-6 py-12 text-center text-sm text-neutral-600">
                      <p>Fant ikke denne ROS-vurderingen.</p>
                      <button
                        type="button"
                        onClick={closeRosPanel}
                        className="mx-auto mt-4 rounded-none border border-neutral-300 px-4 py-2 text-sm font-medium"
                      >
                        Lukk
                      </button>
                    </div>
                  )
                ) : null}

                {rosPanelMode === 'create' ? (
                <form
                  className="flex min-h-0 flex-1 flex-col"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!rosTitle.trim() || !rosAssessor.trim()) return
                    const isO = rosCategory === 'organizational_change'
                    const r = ic.createRosAssessment(rosTitle.trim(), rosDept.trim(), rosAssessor.trim(), {
                      category: rosCategory,
                      seedORosRows: isO,
                      workspaceCategory: rosWorkspace,
                      description: rosDescription,
                    })
                    if (isO && r && supabaseConfigured && oRosAmuId && oRosVoId) {
                      void hr.upsertRosSignoff(r.id, oRosAmuId, oRosVoId)
                    }
                    if (r?.id) {
                      resetRosPanelForm()
                      setRosPanelMode('view')
                      setRosViewId(r.id)
                    } else {
                      closeRosPanel()
                    }
                  }}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Kontekst</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Gi ROS-en et tydelig navn og område. Juridisk kategori (generell vs. O-ROS) styrer forhåndsutfylling
                          og krav til HR-signatur.
                        </p>
                      </div>
                      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6">
                        <div className="space-y-4">
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-title-input">
                              Tittel
                            </label>
                            <input
                              id="ros-panel-title-input"
                              value={rosTitle}
                              onChange={(e) => setRosTitle(e.target.value)}
                              required
                              className={SETTINGS_INPUT}
                              placeholder="f.eks. ROS — Lager 2027"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-description">
                              Beskrivelse / omfang
                            </label>
                            <textarea
                              id="ros-panel-description"
                              value={rosDescription}
                              onChange={(e) => setRosDescription(e.target.value)}
                              rows={4}
                              className={SETTINGS_INPUT}
                              placeholder="Bakgrunn, avgrensning, metode, referanser …"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-dept">
                              Avdeling / område
                            </label>
                            <input
                              id="ros-panel-dept"
                              value={rosDept}
                              onChange={(e) => setRosDept(e.target.value)}
                              className={SETTINGS_INPUT}
                              placeholder="f.eks. Produksjon"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-assessor">
                              Vurdert av
                            </label>
                            <input
                              id="ros-panel-assessor"
                              value={rosAssessor}
                              onChange={(e) => setRosAssessor(e.target.value)}
                              required
                              className={SETTINGS_INPUT}
                              placeholder="Navn / rolle"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="my-8 border-t border-neutral-200/90" />

                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Kategori</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          O-ROS krever AMU/VO under HR før låsing. For forslagsrader etter arbeidsområde, bruk veiviseren
                          øverst på siden.
                        </p>
                      </div>
                      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6 space-y-4">
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-legal-cat">
                            Juridisk type
                          </label>
                          <select
                            id="ros-panel-legal-cat"
                            value={rosCategory}
                            onChange={(e) => setRosCategory(e.target.value as RosCategory)}
                            className={SETTINGS_INPUT}
                          >
                            <option value="general">Generell ROS</option>
                            <option value="organizational_change">Organisatorisk endring (O-ROS)</option>
                          </select>
                        </div>
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-ws">
                            Arbeidsområde (veiledning)
                          </label>
                          <select
                            id="ros-panel-ws"
                            value={rosWorkspace}
                            onChange={(e) => setRosWorkspace(e.target.value as RosWorkspaceCategory)}
                            className={SETTINGS_INPUT}
                          >
                            <option value="general">Generelt</option>
                            <option value="production">Produksjon</option>
                            <option value="office">Kontor</option>
                            <option value="warehouse">Lager / logistikk</option>
                            <option value="construction">Bygg / anlegg</option>
                            <option value="healthcare">Helse / omsorg</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {rosCategory === 'organizational_change' && hr.orgUsers.length > 0 ? (
                      <>
                        <div className="my-8 border-t border-neutral-200/90" />
                        <div className={ORG_MERGED_PANEL} style={kpiStripStyle}>
                          <div className={ORG_MERGED_COL}>
                            <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="ros-panel-amu">
                              AMU-representant
                            </label>
                            <select
                              id="ros-panel-amu"
                              value={oRosAmuId}
                              onChange={(e) => setORosAmuId(e.target.value)}
                              className={SETTINGS_INPUT_ON_DARK}
                            >
                              <option value="">—</option>
                              {hr.orgUsers.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.display_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={ORG_MERGED_COL}>
                            <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="ros-panel-vo">
                              Verneombud
                            </label>
                            <select
                              id="ros-panel-vo"
                              value={oRosVoId}
                              onChange={(e) => setORosVoId(e.target.value)}
                              className={SETTINGS_INPUT_ON_DARK}
                            >
                              <option value="">—</option>
                              {hr.orgUsers.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.display_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={ORG_MERGED_ACTION_COL} />
                        </div>
                        <p className="mt-2 text-xs text-amber-800">
                          O-ROS kan ikke låses før AMU og verneombud har signert under HR → O-ROS.
                        </p>
                      </>
                    ) : null}
                  </div>

                  <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                    <button
                      type="submit"
                      className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Opprett ROS
                    </button>
                    <button
                      type="button"
                      onClick={closeRosPanel}
                      className="mt-3 w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                    >
                      Avbryt
                    </button>
                  </footer>
                </form>
                ) : null}
              </div>
            </div>
          ) : null}
        </InternalControlTabShell>
      ) : null}

      {tab === 'annual' ? (
        <InternalControlTabShell
          hubItems={icHubItems}
          description={
            <p>
              Strukturert årsgjennomgang (IK-f § 5 nr. 8), data fra HMS-modulen og dobbeltsignatur (leder → verneombud).
              Varsling:{' '}
              <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">
                Oppgaver → Varslingssaker
              </Link>
              .{' '}
              <Link to="/action-board" className="font-medium text-[#1a3d32] underline">
                Handlingsplan på tavle
              </Link>
              .
            </p>
          }
        >
          {ic.error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ic.error}</p>
          )}
          {ic.loading && supabaseConfigured && (
            <p className="mb-4 text-sm text-neutral-500">Laster internkontrolldata…</p>
          )}

          <div className="mt-6">
            <LayoutScoreStatRow
              items={[
                { big: String(annualStats.total), title: 'Totalt', sub: 'Registrerte år' },
                { big: String(annualStats.draft), title: 'Utkast', sub: 'Ikke sendt til VO' },
                { big: String(annualStats.pending), title: 'Venter VO', sub: 'Leder signert' },
              ]}
              childrenByIndex={{
                2: (
                  <p className="mt-2 text-xs text-neutral-600">
                    <span className="font-semibold text-neutral-800">{annualStats.locked}</span> låst
                  </p>
                ),
              }}
            />
          </div>

          <section className="mt-8" aria-label="Tidligere årsgjennomganger">
            <Table1Shell
              variant="pinpoint"
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="relative min-w-[200px] flex-1">
                      <label htmlFor="annual-list-search" className="sr-only">
                        Søk i årsgjennomganger
                      </label>
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        id="annual-list-search"
                        type="search"
                        value={annualListSearch}
                        onChange={(e) => setAnnualListSearch(e.target.value)}
                        placeholder="Søk etter år, status, dato, leder …"
                        className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
                      />
                    </div>
                  }
                  segmentSlot={<span className="sr-only">Verktøylinje</span>}
                  endSlot={
                    <button
                      type="button"
                      onClick={openNewAnnualPanel}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#1a3d32] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#142e26]"
                    >
                      <Plus className="size-4 shrink-0" aria-hidden />
                      Ny årsgjennomgang
                    </button>
                  }
                />
              }
            >
              <div className="border-b border-neutral-100 px-4 py-3 md:px-5">
                <h2 className="font-semibold text-neutral-900">Tidligere årsgjennomganger</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Nye skjemaer krever obligatoriske felt og dobbeltsignatur (leder → verneombud). Eldre rader viser fri tekst.
                </p>
              </div>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className={`${tableCell} font-medium`}>År</th>
                    <th className={`${tableCell} font-medium`}>Status</th>
                    <th className={`${tableCell} font-medium`}>Dato</th>
                    <th className={`${tableCell} font-medium`}>Leder / ansvarlig</th>
                    <th className={`${tableCell} text-right font-medium`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {annualReviewsFiltered.map((a, ri) => {
                    const legacy = isLegacyAnnualReview(a)
                    const st = a.status ?? (a.locked ? 'locked' : legacy ? 'locked' : 'draft')
                    const statusLabel =
                      st === 'locked'
                        ? 'Låst'
                        : st === 'pending_safety_rep'
                          ? 'Venter verneombud'
                          : 'Utkast'
                    return (
                      <tr key={a.id} className={tbodyRow(ri)}>
                        <td className={`${tableCell} font-medium`}>{a.year}</td>
                        <td className={tableCell}>
                          <span
                            className={`rounded-none border px-2 py-0.5 text-xs font-medium ${
                              st === 'locked'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : st === 'pending_safety_rep'
                                  ? 'border-sky-300 bg-sky-50 text-sky-900'
                                  : 'border-amber-300 bg-amber-50 text-amber-950'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {legacy ? (
                            <span className="ml-2 text-[10px] text-neutral-400">(eldre format)</span>
                          ) : null}
                        </td>
                        <td className={`${tableCell} text-neutral-600`}>{a.reviewedAt}</td>
                        <td className={tableCell}>{a.reviewer || '—'}</td>
                        <td className={`${tableCell} text-right`}>
                          <button
                            type="button"
                            onClick={() => openAnnualPanelFor(a)}
                            className="rounded-none border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                          >
                            {st === 'locked' ? 'Vis' : st === 'pending_safety_rep' ? 'Godkjenn / vis' : 'Fortsett'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {annualReviewsFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
                  {annualListSearch.trim() ? 'Ingen årsgjennomganger matcher søket.' : 'Ingen årsgjennomganger ennå.'}
                </p>
              ) : null}
            </Table1Shell>
          </section>

          {annualPanelOpen && annualForm ? (
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeAnnualPanel()
              }}
            >
              <div
                className="flex h-full w-full max-w-[min(100vw,960px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="annual-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
                  <div>
                    <h2
                      id="annual-panel-title"
                      className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                    >
                      Årsgjennomgang {annualForm.year}
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      {annualForm.legacySummary
                        ? 'Eldre registrering (fri tekst). Opprett ny årsgjennomgang for strukturert flyt og signatur.'
                        : annualForm.status === 'locked'
                          ? 'Dokumentet er låst etter verneombudets signatur.'
                          : annualForm.status === 'pending_safety_rep'
                            ? 'Venter signatur fra verneombud / AMU-representant (AML § 3-1).'
                            : 'Utfyll strukturerte felt, legg inn tiltak og signer som leder.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAnnualPanel}
                    className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
                    aria-label="Lukk"
                  >
                    <X className="size-6" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                  <div className="rounded-none border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Datagrunnlag ({annualForm.year})</p>
                    <p className="mt-2 leading-relaxed">
                      I {annualForm.year} er det registrert{' '}
                      <strong>{annualDashboard.incidentCount}</strong> hendelser/avvik ({annualDashboard.openIncidents} åpne),{' '}
                      <strong>{annualDashboard.safetyApproved}</strong> godkjente vernerunder (av {annualDashboard.safetyTotal} registrerte), og{' '}
                      <strong>{annualDashboard.rosTotal}</strong> ROS-vurderinger ({annualDashboard.rosLocked} låst). Sykefravær:{' '}
                      {annualDashboard.sickNote}.
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Tallene hentes fra HMS-modulen og internkontroll (ROS). Bruk dem som utgangspunkt i vurderingene under.
                    </p>
                  </div>

                  {annualForm.legacySummary ? (
                    <div className="mt-6 rounded-none border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-semibold">Oppsummering (historisk)</p>
                      <p className="mt-2 whitespace-pre-wrap">{annualForm.legacySummary}</p>
                    </div>
                  ) : null}

                  {!annualForm.legacySummary ? (
                    <>
                      <div className={`${TASK_PANEL_ROW_GRID} mt-6`}>
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900">Grunninfo</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>
                            År for gjennomgang, dato og neste planlagte revisjon. Ansvarlig leder fylles fra profil (kan justeres).
                          </p>
                        </div>
                        <div className={TASK_PANEL_INSET}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className={SETTINGS_FIELD_LABEL}>År</label>
                              <input
                                type="number"
                                disabled={annualFormFieldsLocked}
                                value={annualForm.year}
                                onChange={(e) =>
                                  setAnnualForm((f) => (f ? { ...f, year: Number(e.target.value) || f.year } : f))
                                }
                                className={SETTINGS_INPUT}
                              />
                            </div>
                            <div>
                              <label className={SETTINGS_FIELD_LABEL}>Gjennomført (dato)</label>
                              <input
                                type="date"
                                disabled={annualFormFieldsLocked}
                                value={annualForm.reviewedAt}
                                onChange={(e) =>
                                  setAnnualForm((f) => (f ? { ...f, reviewedAt: e.target.value } : f))
                                }
                                className={SETTINGS_INPUT}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={SETTINGS_FIELD_LABEL}>Neste planlagte gjennomgang</label>
                              <input
                                type="date"
                                disabled={annualFormFieldsLocked}
                                value={annualForm.nextReviewDue}
                                onChange={(e) =>
                                  setAnnualForm((f) => (f ? { ...f, nextReviewDue: e.target.value } : f))
                                }
                                className={SETTINGS_INPUT}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={SETTINGS_FIELD_LABEL}>Ansvarlig leder (visning)</label>
                              <input
                                disabled={annualFormFieldsLocked}
                                value={annualForm.reviewerDisplay}
                                onChange={(e) =>
                                  setAnnualForm((f) => (f ? { ...f, reviewerDisplay: e.target.value } : f))
                                }
                                className={SETTINGS_INPUT}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="my-6 border-t border-neutral-200/90" />

                      <div className={TASK_PANEL_ROW_GRID}>
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900">Obligatoriske vurderinger (IK-f § 5 nr. 8)</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>
                            Alle felt må fylles ut før leder kan signere. «Ja/Nei» for fjorårets mål krever alltid en kort begrunnelse.
                          </p>
                        </div>
                        <div className={`${TASK_PANEL_INSET} space-y-4`}>
                          <div>
                            <p className={SETTINGS_FIELD_LABEL}>Ble fjorårets HMS-mål nådd?</p>
                            <div className="mt-2 flex flex-wrap gap-3">
                              {(['yes', 'no'] as const).map((v) => (
                                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name="goalsLastYear"
                                    disabled={annualFormFieldsLocked}
                                    checked={annualForm.sections.goalsLastYearAchieved === v}
                                    onChange={() =>
                                      setAnnualForm((f) =>
                                        f
                                          ? {
                                              ...f,
                                              sections: { ...f.sections, goalsLastYearAchieved: v },
                                            }
                                          : f,
                                      )
                                    }
                                  />
                                  {v === 'yes' ? 'Ja' : 'Nei'}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>Kommentar til fjorårets mål</label>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.goalsLastYearComment}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, goalsLastYearComment: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={SETTINGS_INPUT}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>Avvik og rapporteringskultur</label>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              placeholder="Rapporteringskultur, korrigerende tiltak, åpne saker …"
                              value={annualForm.sections.deviationsReview}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, deviationsReview: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={SETTINGS_INPUT}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>ROS — årskontroll og oppdatering</label>
                            <p className="mt-1 text-xs text-neutral-600">
                              Kobling til{' '}
                              <Link to="/internal-control?tab=ros" className="font-medium text-[#1a3d32] underline">
                                ROS / risiko
                              </Link>
                              : vurder om analyser er oppdatert, om restrisiko og tiltak fra låste ROS stemmer med
                              erfaring i perioden, og om matrisen må justeres etter hendelser.
                            </p>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={4}
                              placeholder="F.eks. hvilke ROS er revidert, nye farer, avvik mot tidligere sannsynlighetsvurdering …"
                              value={annualForm.sections.rosReview}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, rosReview: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-2`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>Sykefravær — trender og oppfølging</label>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.sickLeaveReview}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, sickLeaveReview: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={SETTINGS_INPUT}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>Nye konkrete HMS-mål (neste 12 mnd)</label>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.goalsNextYear}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, goalsNextYear: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={SETTINGS_INPUT}
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        id="ic-annual-yearskontroll"
                        className="my-8 scroll-mt-24 rounded-lg border border-[#1a3d32]/20 bg-[#f6f8f7] p-4 sm:p-5"
                      >
                        <h3 className="text-base font-semibold text-[#1a3d32]">Årskontroll (PDCA Check / Act)</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Utfyllende gjennomgang av tiltak, effekt, hendelser og endret trusselbilde. Neste planlagte
                          revisjon registreres i feltet «Neste gjennomgang» over.
                        </p>
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>1. Status på tiltaksplan (oppfølging)</label>
                            <p className="text-xs text-neutral-500">
                              Fremdrift: gjennomført i tide og av riktig ansvarlig? Ressursbruk vs. forventning?
                            </p>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.actionPlanStatusReview}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, actionPlanStatusReview: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>2. Effektevaluering</label>
                            <p className="text-xs text-neutral-500">
                              Har tiltak redusert restrisikoen som antatt? (Teknikk uten opplæring kan f.eks. gi vedvarende
                              menneskelig risiko.)
                            </p>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.effectEvaluation}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, effectEvaluation: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>3. Hendelser og avvik (reality check)</label>
                            <p className="text-xs text-neutral-500">
                              Faktiske hendelser og nesten-ulykker. Juster ROS hvis virkeligheten ikke matcher vurderingen.
                            </p>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.incidentsRealityCheck}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, incidentsRealityCheck: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>4. Endringer i trusselbildet og rammebetingelser</label>
                            <p className="text-xs text-neutral-500">
                              Ny teknologi, arbeidsmåter, omorganisering; lover, forskrifter, kundekrav.
                            </p>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={3}
                              value={annualForm.sections.threatLandscapeChanges}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, threatLandscapeChanges: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL}>5. PDCA — Check / Act (oppsummering)</label>
                            <textarea
                              disabled={annualFormFieldsLocked}
                              rows={2}
                              placeholder="Hva lærte vi, hva endres neste år …"
                              value={annualForm.sections.pdcaCheckActNotes}
                              onChange={(e) =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        sections: { ...f.sections, pdcaCheckActNotes: e.target.value },
                                      }
                                    : f,
                                )
                              }
                              className={`${SETTINGS_INPUT} mt-1`}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">
                          Mer bakgrunn:{' '}
                          <Link to="/modules/aarskontroll" className="font-medium text-[#1a3d32] underline">
                            Modul Årskontroll
                          </Link>
                          .
                        </p>
                      </div>

                      {(ic.annualReviews.find((x) => x.id === annualForm.id)?.changeLog?.length ?? 0) > 0 ? (
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                            Historikk (utkast — tekstendringer)
                          </p>
                          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs text-neutral-700">
                            {(
                              ic.annualReviews.find((x) => x.id === annualForm.id)?.changeLog ?? []
                            )
                              .slice()
                              .reverse()
                              .map((e) => (
                                <li key={`${e.at}-${e.message}`}>
                                  <span className="text-neutral-400">{formatWhen(e.at)}</span> — {e.message}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="my-6 border-t border-neutral-200/90" />

                      <div className={TASK_PANEL_ROW_GRID}>
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900">Handlingsplan (til Kanban)</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>
                            Legg inn tiltak som skal følges opp. De opprettes som oppgaver når leder signerer.
                          </p>
                        </div>
                        <div className={`${TASK_PANEL_INSET} space-y-3`}>
                          {annualForm.actionRows.length === 0 && annualForm.status === 'draft' ? (
                            <p className="text-xs text-neutral-500">Ingen tiltak ennå — bruk «Legg til tiltak» eller signer uten.</p>
                          ) : null}
                          {annualForm.actionRows.map((r) => (
                            <div key={r.id} className="rounded-none border border-neutral-200 bg-white p-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  disabled={annualFormFieldsLocked}
                                  placeholder="Tiltak / tittel"
                                  value={r.title}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setAnnualForm((f) =>
                                      f
                                        ? {
                                            ...f,
                                            actionRows: f.actionRows.map((x) =>
                                              x.id === r.id ? { ...x, title: v } : x,
                                            ),
                                          }
                                        : f,
                                    )
                                  }}
                                  className={SETTINGS_INPUT}
                                />
                                <input
                                  disabled={annualFormFieldsLocked}
                                  type="date"
                                  value={r.dueDate}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setAnnualForm((f) =>
                                      f
                                        ? {
                                            ...f,
                                            actionRows: f.actionRows.map((x) =>
                                              x.id === r.id ? { ...x, dueDate: v } : x,
                                            ),
                                          }
                                        : f,
                                    )
                                  }}
                                  className={SETTINGS_INPUT}
                                />
                                <input
                                  disabled={annualFormFieldsLocked}
                                  placeholder="Ansvarlig (navn)"
                                  value={r.assignee}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setAnnualForm((f) =>
                                      f
                                        ? {
                                            ...f,
                                            actionRows: f.actionRows.map((x) =>
                                              x.id === r.id ? { ...x, assignee: v } : x,
                                            ),
                                          }
                                        : f,
                                    )
                                  }}
                                  className={`${SETTINGS_INPUT} sm:col-span-2`}
                                />
                                <textarea
                                  disabled={annualFormFieldsLocked}
                                  placeholder="Beskrivelse"
                                  rows={2}
                                  value={r.description}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setAnnualForm((f) =>
                                      f
                                        ? {
                                            ...f,
                                            actionRows: f.actionRows.map((x) =>
                                              x.id === r.id ? { ...x, description: v } : x,
                                            ),
                                          }
                                        : f,
                                    )
                                  }}
                                  className={`${SETTINGS_INPUT} sm:col-span-2`}
                                />
                              </div>
                              {!annualFormFieldsLocked ? (
                                <button
                                  type="button"
                                  className="mt-2 text-xs font-medium text-red-700 underline"
                                  onClick={() =>
                                    setAnnualForm((f) =>
                                      f
                                        ? {
                                            ...f,
                                            actionRows: f.actionRows.filter((x) => x.id !== r.id),
                                          }
                                        : f,
                                    )
                                  }
                                >
                                  Fjern
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {!annualFormFieldsLocked ? (
                            <button
                              type="button"
                              onClick={() =>
                                setAnnualForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        actionRows: [
                                          ...f.actionRows,
                                          {
                                            id: crypto.randomUUID(),
                                            title: '',
                                            description: '',
                                            assignee: '',
                                            dueDate: '',
                                          },
                                        ],
                                      }
                                    : f,
                                )
                              }
                              className="rounded-none border border-dashed border-neutral-400 px-3 py-2 text-xs font-medium text-neutral-700"
                            >
                              + Legg til tiltak
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {(annualForm.status === 'pending_safety_rep' || annualForm.status === 'locked') &&
                      (ic.annualReviews.find((x) => x.id === annualForm.id)?.signatures?.length ?? 0) > 0 ? (
                        <div className="mt-6 rounded-none border border-emerald-200 bg-emerald-50/80 p-4 text-sm">
                          <p className="font-semibold text-emerald-900">Signaturer (nivå 1)</p>
                          <ul className="mt-2 space-y-1 text-emerald-900">
                            {(ic.annualReviews.find((x) => x.id === annualForm.id)?.signatures ?? []).map((s) => (
                              <li key={`${s.role}-${s.signedAt}`} className="whitespace-pre-line text-xs">
                                {s.role === 'manager' ? 'Leder' : 'Verneombud'}: {s.signerName} —{' '}
                                {formatWhen(s.signedAt)}
                                {formatLevel1AuditLine(s.level1) ? `\n${formatLevel1AuditLine(s.level1)}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                <footer className="shrink-0 space-y-3 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                  {!annualForm.legacySummary && !annualFormFieldsLocked && annualForm.status === 'draft' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          persistAnnualDraftFromForm()
                        }}
                        className="w-full rounded-none border border-neutral-400 bg-white px-5 py-3 text-sm font-semibold text-neutral-800"
                      >
                        Lagre utkast
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            persistAnnualDraftFromForm()
                            const name = profile?.display_name?.trim() || user?.email || 'Leder'
                            const ok = await ic.signAnnualReviewManager(annualForm.id, {
                              signerName: name,
                              signerUserId: user?.id,
                              reviewerDisplay: annualForm.reviewerDisplay,
                              sections: annualForm.sections,
                              nextReviewDue: annualForm.nextReviewDue,
                              year: annualForm.year,
                              reviewedAt: annualForm.reviewedAt,
                              actionPlanDrafts: annualForm.actionRows.filter((x) => x.title.trim()),
                              onCreateTasks: (drafts) => {
                                for (const d of drafts) {
                                  if (!d.title.trim()) continue
                                  addTask({
                                    title: `Årsgjennomgang ${annualForm.year}: ${d.title.trim().slice(0, 120)}`,
                                    description:
                                      d.description.trim() ||
                                      `Tiltak fra årsgjennomgang ${annualForm.year} (IK-f § 5 nr. 8).`,
                                    assignee: d.assignee.trim() || 'Unassigned',
                                    ownerRole: 'Ansvarlig (årsgjennomgang)',
                                    dueDate: d.dueDate.trim() || '—',
                                    status: 'todo',
                                    module: 'hse',
                                    sourceType: 'annual_review_action',
                                    sourceId: annualForm.id,
                                    sourceLabel: d.title.trim().slice(0, 80),
                                    requiresManagementSignOff: false,
                                  })
                                }
                              },
                            })
                            if (ok) {
                              setAnnualForm((f) =>
                                f
                                  ? { ...f, status: 'pending_safety_rep', actionRows: [] }
                                  : f,
                              )
                            }
                          })()
                        }}
                        className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white"
                      >
                        Signer som leder (send til verneombud)
                      </button>
                    </>
                  ) : null}

                  {!annualForm.legacySummary &&
                  annualForm.status === 'pending_safety_rep' &&
                  !ic.annualReviews.find((x) => x.id === annualForm.id)?.signatures?.some((s) => s.role === 'safety_rep') ? (
                    <div className="rounded-none border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950">
                      {canSignAsSafetyRep ? (
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const name =
                                profile?.display_name?.trim() || user?.email || 'Verneombud'
                              const ok = await ic.signAnnualReviewSafetyRep(annualForm.id, {
                                signerName: name,
                                signerUserId: user?.id,
                              })
                              if (ok) closeAnnualPanel()
                            })()
                          }}
                          className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white"
                        >
                          Signer og godkjenn (verneombud)
                        </button>
                      ) : (
                        <p>
                          Kun brukere merket som verneombud (profil) eller organisasjonsadministrator kan godkjenne.
                          Kontakt administrator for tilgang.
                        </p>
                      )}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={closeAnnualPanel}
                    className="w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                  >
                    Lukk
                  </button>
                </footer>
              </div>
            </div>
          ) : null}
        </InternalControlTabShell>
      ) : null}
    </>
  )
}

// ─── RosAssessmentCard ────────────────────────────────────────────────────────

function RosAssessmentCard({
  ros,
  ic,
  hr,
  onLocked,
  duplicateRevision,
  highlightRowId,
  hideDuplicateRevisionButton,
  onDeleteRos,
}: {
  ros: RosAssessment
  ic: ReturnType<typeof useInternalControl>
  hr: ReturnType<typeof useHrCompliance>
  onLocked: (ros: RosAssessment) => void
  duplicateRevision: (lockedSourceId: string) => void
  /** Scroll/highlight denne risikoraden (f.eks. fra gruppert oversikt). */
  highlightRowId?: string | null
  /** When true, omit «Opprett ny revisjon» in card header (e.g. side panel has its own). */
  hideDuplicateRevisionButton?: boolean
  /** Slett hele ROS (kun utkast uten signaturer). */
  onDeleteRos?: (rosId: string) => void
}) {
  const [leaderName, setLeaderName] = useState('')
  const [verneombudName, setVerneombudName] = useState('')

  const leaderSig = ros.signatures.find((s) => s.role === 'leader')
  const verneombudSig = ros.signatures.find((s) => s.role === 'verneombud')
  const bothSigned = !!leaderSig && !!verneombudSig
  const oRosBlock = hr.rosSignoffs.find((s) => s.ros_assessment_id === ros.id)
  const oRosBlocked = ros.rosCategory === 'organizational_change' && oRosBlock?.blocked === true
  const isLocked = ros.locked
  const rosDocDraft = isRosDocumentDraft(ros)

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' }) } catch { return iso }
  }

  // 5×5 risk matrix — plot rows by gross score position
  const matrix = Array.from({ length: 5 }, (_, si) =>
    Array.from({ length: 5 }, (_, li) => {
      const s = 5 - si   // severity top=5, bottom=1
      const l = li + 1   // likelihood left=1, right=5
      const score = s * l
      const colour = riskColour(score)
      const rowsHere = ros.rows.filter((r) => r.severity === s && r.likelihood === l)
      const residualHere = ros.rows.filter((r) =>
        r.residualSeverity === s && r.residualLikelihood === l,
      )
      return { s, l, score, colour, rows: rowsHere, residual: residualHere }
    }),
  )

  return (
    <div className={`overflow-hidden rounded-none border bg-white shadow-sm ${isLocked ? 'border-emerald-200' : 'border-neutral-200/90'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{ros.title}</h3>
            {ros.rosCategory === 'organizational_change' && (
              <span className="rounded-none bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                O-ROS
              </span>
            )}
            {isLocked && <Lock className="size-4 text-emerald-600" aria-label="Låst — begge signaturer innhentet" />}
          </div>
          {oRosBlocked && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Sperret til AMU og verneombud har signert under HR → O-ROS.
            </p>
          )}
          <p className="text-xs text-neutral-500">{ros.department} · {ros.assessor} · {ros.assessedAt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLocked && !hideDuplicateRevisionButton ? (
            <button
              type="button"
              onClick={() => duplicateRevision(ros.id)}
              className="rounded-none border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Opprett ny revisjon
            </button>
          ) : null}
          {rosDocDraft && onDeleteRos ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Slette denne ROS-vurderingen? Dette kan ikke angres.')) onDeleteRos(ros.id)
              }}
              className="inline-flex items-center gap-1 rounded-none border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              Slett ROS
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => ic.addRosRow(ros.id)}
            className="text-sm font-medium text-[#1a3d32] hover:underline"
          >
            + Risiko
          </button>
        </div>
      </div>

      {rosDocDraft ? (
        <div className="border-b border-neutral-100 bg-white px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dokument (utkast)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={SETTINGS_FIELD_LABEL}>Tittel</label>
              <input
                value={ros.title}
                onChange={(e) => ic.updateRosAssessment(ros.id, { title: e.target.value })}
                className={SETTINGS_INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={SETTINGS_FIELD_LABEL}>Beskrivelse / omfang</label>
              <textarea
                value={ros.description ?? ''}
                onChange={(e) => ic.updateRosAssessment(ros.id, { description: e.target.value })}
                rows={4}
                className={SETTINGS_INPUT}
                placeholder="Bakgrunn, avgrensning, metode …"
              />
            </div>
            <div>
              <label className={SETTINGS_FIELD_LABEL}>Avdeling / område</label>
              <input
                value={ros.department}
                onChange={(e) => ic.updateRosAssessment(ros.id, { department: e.target.value })}
                className={SETTINGS_INPUT}
              />
            </div>
            <div>
              <label className={SETTINGS_FIELD_LABEL}>Vurdert av</label>
              <input
                value={ros.assessor}
                onChange={(e) => ic.updateRosAssessment(ros.id, { assessor: e.target.value })}
                className={SETTINGS_INPUT}
              />
            </div>
            <div>
              <label className={SETTINGS_FIELD_LABEL}>Vurderingsdato</label>
              <input
                type="date"
                value={ros.assessedAt}
                onChange={(e) => ic.updateRosAssessment(ros.id, { assessedAt: e.target.value })}
                className={SETTINGS_INPUT}
              />
            </div>
            <div>
              <label className={SETTINGS_FIELD_LABEL}>Arbeidsområde (veiledning)</label>
              <select
                value={ros.workspaceCategory ?? 'general'}
                onChange={(e) =>
                  ic.updateRosAssessment(ros.id, { workspaceCategory: e.target.value as RosWorkspaceCategory })
                }
                className={SETTINGS_INPUT}
              >
                {Object.entries(ROS_WORKSPACE_LABELS).map(([k, lab]) => (
                  <option key={k} value={k}>
                    {lab}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={SETTINGS_FIELD_LABEL}>Juridisk type</label>
              <select
                value={ros.rosCategory ?? 'general'}
                onChange={(e) => ic.updateRosAssessment(ros.id, { rosCategory: e.target.value as RosCategory })}
                className={SETTINGS_INPUT}
              >
                <option value="general">Generell ROS</option>
                <option value="organizational_change">Organisatorisk endring (O-ROS)</option>
              </select>
            </div>
          </div>
        </div>
      ) : ros.description?.trim() ? (
        <div className="border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Beskrivelse</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{ros.description}</p>
        </div>
      ) : null}

      {/* 5×5 visual risk matrix */}
      <div className="border-b border-neutral-100 p-4">
        <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Risikomatrise (5×5)</p>
        <div className="flex gap-2">
          {/* Y-axis label */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-neutral-400 rotate-[-90deg] whitespace-nowrap mt-8">Alvorlighetsgrad →</span>
          </div>
          <div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gridTemplateRows: 'repeat(5,2.25rem)', gap: '2px' }}>
              {matrix.map((row, ri) =>
                row.map((cell, ci) => {
                  const cls = RISK_COLOUR_CLASSES[cell.colour]
                  return (
                    <div key={`${ri}-${ci}`}
                      className={`relative flex items-center justify-center rounded-none text-xs font-bold ${cls.bg} ${cls.text}`}
                      title={`Alvor ${cell.s} × Sanns. ${cell.l} = ${cell.score}`}>
                      <span>{cell.score}</span>
                      {/* Gross risk dots */}
                      {cell.rows.map((r) => (
                        <span key={r.id} className="absolute top-0.5 right-0.5 size-2 rounded-full bg-neutral-800 ring-1 ring-white" title={r.hazard} />
                      ))}
                      {/* Residual risk dots (lighter) */}
                      {cell.residual.map((r) => (
                        <span key={`res-${r.id}`} className="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-white ring-1 ring-neutral-400" title={`Restrisiko: ${r.hazard}`} />
                      ))}
                    </div>
                  )
                }),
              )}
            </div>
            {/* X-axis */}
            <div className="mt-1 grid text-center" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gap: '2px' }}>
              {[1,2,3,4,5].map((n) => <div key={n} className="text-[10px] text-neutral-400">{n}</div>)}
            </div>
            <p className="mt-0.5 text-center text-[10px] text-neutral-400">Sannsynlighet →</p>
          </div>
          <div className="ml-3 flex flex-col gap-1 justify-center text-[10px] text-neutral-500">
            <span>● Brutto (før tiltak)</span>
            <span>○ Restrisiko (etter)</span>
          </div>
        </div>
      </div>

      {/* Risikoer — én seksjon per rad (lettere å lese enn én komprimert tabellrad) */}
      <div className="space-y-4 border-t border-neutral-100 bg-[#faf9f6] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Registrerte risikoer</p>
        <div className="space-y-4">
          {ros.rows.map((row, idx) => {
            const grossColour = riskColour(row.riskScore)
            const grossCls = RISK_COLOUR_CLASSES[grossColour]
            const residual = row.residualScore != null ? row.residualScore : null
            const residualColour = residual != null ? riskColour(residual) : null
            const residualCls = residualColour ? RISK_COLOUR_CLASSES[residualColour] : null
            const rowDone = isRosRowDoneForTracking(row.status)
            const rowDraft = isRosRiskRowDraft(row)
            /** Hele radinnhold kan redigeres i «Utkast» selv om ROS-dokumentet er låst. */
            const rowBodyDisabled = !rowDraft
            const redResidual = residual != null && residual >= 15
            const needJust = redResidual && !(row.redResidualJustification && row.redResidualJustification.trim().length >= 10)
            const highlighted = highlightRowId === row.id
            return (
              <section
                key={row.id}
                id={`ros-risk-section-${row.id}`}
                className={`scroll-mt-4 rounded-lg border bg-white p-4 shadow-sm transition ${
                  highlighted ? 'border-[#1a3d32] ring-2 ring-[#1a3d32]/25' : 'border-neutral-200/90'
                } ${rowDone ? 'opacity-75' : ''}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                  <span className="text-xs font-bold text-neutral-500">Risiko {idx + 1}</span>
                  <div className="flex flex-wrap items-center gap-2">
                  {rowDraft && ros.rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Fjerne denne risikoraden?')) ic.removeRosRow(ros.id, row.id)
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-900 hover:bg-red-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Fjern rad
                    </button>
                  ) : null}
                  <select
                    disabled={isLocked}
                    value={row.status}
                    onChange={(e) =>
                      ic.updateRosRow(ros.id, row.id, {
                        status: e.target.value as import('../types/internalControl').RosRowStatus,
                      })
                    }
                    className={`max-w-full rounded-md border px-2 py-1 text-xs font-semibold disabled:cursor-default ${
                      row.status === 'finished' || row.status === 'closed'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : row.status === 'submitted'
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : row.status === 'in_progress'
                            ? 'border-sky-300 bg-sky-50 text-sky-900'
                            : row.status === 'deferred'
                              ? 'border-violet-300 bg-violet-50 text-violet-900'
                              : row.status === 'cancelled'
                                ? 'border-neutral-300 bg-neutral-100 text-neutral-600'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <option value="draft">Utkast</option>
                    <option value="submitted">Innsendt</option>
                    <option value="in_progress">Pågår</option>
                    <option value="deferred">Utsett</option>
                    <option value="finished">Ferdig</option>
                    <option value="cancelled">Avbrutt</option>
                    <option value="open">Åpen (eldre)</option>
                    <option value="closed">Lukket (eldre)</option>
                  </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Konsekvenskategori (hva som rammes)</label>
                    <select
                      disabled={rowBodyDisabled}
                      value={row.consequenceCategory ?? ''}
                      onChange={(e) =>
                        ic.updateRosRow(ros.id, row.id, { consequenceCategory: e.target.value || undefined })
                      }
                      className={SETTINGS_INPUT}
                    >
                      <option value="">Velg …</option>
                      {ROS_CONSEQUENCE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {row.consequenceCategory ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {ROS_CONSEQUENCE_CATEGORIES.find((c) => c.id === row.consequenceCategory)?.hint ?? ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-neutral-500">
                        Grader konsekvens på skala (f.eks. 1–5) i alvor-feltet under — typisk fra ubetydelig til katastrofal.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Tema / risikotype (valgfritt)</label>
                    <input
                      disabled={rowBodyDisabled}
                      value={row.riskCategory ?? ''}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { riskCategory: e.target.value })}
                      placeholder="F.eks. brann, kjemikalier, ergonomi …"
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Aktivitet</label>
                    <textarea
                      disabled={rowBodyDisabled}
                      value={row.activity}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { activity: e.target.value })}
                      rows={3}
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Fare / hendelse</label>
                    <textarea
                      disabled={rowBodyDisabled}
                      value={row.hazard}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { hazard: e.target.value })}
                      rows={3}
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-md border border-neutral-200/80 bg-neutral-50/50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                      1. Sårbarhetsvurdering (hvorfor rammes vi?)
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Trussel × intern sårbarhet. Kartlegg svakheter i eget system.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Menneskelige faktorer</label>
                        <textarea
                          disabled={rowBodyDisabled}
                          value={row.vulnerabilityHuman ?? ''}
                          onChange={(e) => ic.updateRosRow(ros.id, row.id, { vulnerabilityHuman: e.target.value })}
                          rows={2}
                          placeholder="Opplæring, nøkkelpersoner, bemanning …"
                          className={SETTINGS_INPUT}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Tekniske faktorer</label>
                        <textarea
                          disabled={rowBodyDisabled}
                          value={row.vulnerabilityTechnical ?? ''}
                          onChange={(e) => ic.updateRosRow(ros.id, row.id, { vulnerabilityTechnical: e.target.value })}
                          rows={2}
                          placeholder="Utstyr, redundans, single points of failure …"
                          className={SETTINGS_INPUT}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Organisatoriske faktorer</label>
                        <textarea
                          disabled={rowBodyDisabled}
                          value={row.vulnerabilityOrganizational ?? ''}
                          onChange={(e) =>
                            ic.updateRosRow(ros.id, row.id, { vulnerabilityOrganizational: e.target.value })
                          }
                          rows={2}
                          placeholder="Ansvar, rutiner, sikkerhetskultur …"
                          className={SETTINGS_INPUT}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-md border border-amber-200/60 bg-amber-50/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950">
                      2. Eksisterende barrierer (forsvarsverk / sløyfemodell)
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Forebyggende barrierer</label>
                        <textarea
                          disabled={rowBodyDisabled}
                          value={row.barrierPreventive ?? ''}
                          onChange={(e) => ic.updateRosRow(ros.id, row.id, { barrierPreventive: e.target.value })}
                          rows={2}
                          placeholder="Reduserer sannsynlighet (tilsyn, adgangskontroll, brannmur …)"
                          className={SETTINGS_INPUT}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Konsekvensreduserende barrierer</label>
                        <textarea
                          disabled={rowBodyDisabled}
                          value={row.barrierConsequenceReducing ?? ''}
                          onChange={(e) =>
                            ic.updateRosRow(ros.id, row.id, { barrierConsequenceReducing: e.target.value })
                          }
                          rows={2}
                          placeholder="Begrenser skade når hendelsen inntreffer (sprinkler, beredskap, backup …)"
                          className={SETTINGS_INPUT}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={SETTINGS_FIELD_LABEL}>Eksisterende tiltak (øvrig / sammendrag)</label>
                    <textarea
                      disabled={rowBodyDisabled}
                      value={row.existingControls}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { existingControls: e.target.value })}
                      rows={2}
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={SETTINGS_FIELD_LABEL}>3. Usikkerhet og kunnskapsgrunnlag</label>
                    <textarea
                      disabled={rowBodyDisabled}
                      value={row.uncertaintyNotes ?? ''}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { uncertaintyNotes: e.target.value })}
                      rows={2}
                      placeholder="F.eks. NS 5814: solid data vs. gjetting, datagrunnlag for vurderingen …"
                      className={SETTINGS_INPUT}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-neutral-100 pt-4">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Alvor (1–5)</label>
                    <input
                      disabled={rowBodyDisabled}
                      type="number"
                      min={1}
                      max={5}
                      value={row.severity}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { severity: Number(e.target.value) || 1 })}
                      className={`${SETTINGS_INPUT} max-w-[5.5rem]`}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Sannsynlighet (1–5)</label>
                    <input
                      disabled={rowBodyDisabled}
                      type="number"
                      min={1}
                      max={5}
                      value={row.likelihood}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { likelihood: Number(e.target.value) || 1 })}
                      className={`${SETTINGS_INPUT} max-w-[5.5rem]`}
                    />
                  </div>
                  <div>
                    <span className={SETTINGS_FIELD_LABEL}>Brutt score</span>
                    <p className={`mt-1.5 inline-flex min-h-[2.5rem] min-w-[3rem] items-center justify-center rounded-md px-3 text-sm font-bold ${grossCls.bg} ${grossCls.text}`}>
                      {row.riskScore}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-[#1a3d32]/20 bg-[#f4f7f5] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a3d32]">
                    4. Risikoreduserende tiltak (handlingsplan)
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Ved godkjenning og låsing av ROS opprettes oppgave automatisk når risiko er gul/rød og tiltak, ansvarlig og frist er utfylt.
                  </p>
                  <label className={`${SETTINGS_FIELD_LABEL} mt-3 block`}>Konkret tiltak</label>
                  <textarea
                    disabled={rowBodyDisabled}
                    value={row.proposedMeasures}
                    onChange={(e) => ic.updateRosRow(ros.id, row.id, { proposedMeasures: e.target.value })}
                    rows={3}
                    className={SETTINGS_INPUT}
                  />
                </div>
                <div className="mt-4 rounded-md border border-sky-200/80 bg-sky-50/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">5. Restrisiko (etter tiltak)</p>
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <div>
                      <label className={SETTINGS_FIELD_LABEL}>Rest-alvor</label>
                      <input
                        disabled={rowBodyDisabled}
                        type="number"
                        min={1}
                        max={5}
                        value={row.residualSeverity ?? ''}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value)
                          ic.updateRosRow(ros.id, row.id, { residualSeverity: v })
                        }}
                        className={`${SETTINGS_INPUT} max-w-[5.5rem] bg-white`}
                      />
                    </div>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL}>Rest-sannsynlighet</label>
                      <input
                        disabled={rowBodyDisabled}
                        type="number"
                        min={1}
                        max={5}
                        value={row.residualLikelihood ?? ''}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value)
                          ic.updateRosRow(ros.id, row.id, { residualLikelihood: v })
                        }}
                        className={`${SETTINGS_INPUT} max-w-[5.5rem] bg-white`}
                      />
                    </div>
                    <div>
                      <span className={SETTINGS_FIELD_LABEL}>Rest-score</span>
                      {residual != null && residualCls ? (
                        <p className={`mt-1.5 inline-flex min-h-[2.5rem] min-w-[3rem] items-center justify-center rounded-md px-3 text-sm font-bold ${residualCls.bg} ${residualCls.text}`}>
                          {residual}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-sm text-neutral-400">—</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 sm:col-span-2">
                    <label className={SETTINGS_FIELD_LABEL}>Vurdering av restrisiko og aksept</label>
                    <textarea
                      disabled={rowBodyDisabled}
                      value={row.residualNarrative ?? ''}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { residualNarrative: e.target.value })}
                      rows={3}
                      placeholder="Hvordan situasjonen er etter tiltak, om restrisiko aksepteres av ledelse / systemeier …"
                      className={`${SETTINGS_INPUT} bg-white`}
                    />
                  </div>
                </div>
                <div className={`mt-4 rounded-md border p-3 ${needJust && !rowBodyDisabled ? 'border-rose-300 bg-rose-50' : 'border-rose-100 bg-rose-50/40'}`}>
                  <label className={SETTINGS_FIELD_LABEL}>Strakstiltak / eskalering (ved rød restrisiko)</label>
                  <textarea
                    disabled={rowBodyDisabled}
                    value={row.redResidualJustification ?? ''}
                    onChange={(e) => ic.updateRosRow(ros.id, row.id, { redResidualJustification: e.target.value })}
                    rows={3}
                    placeholder={redResidual ? 'Påkrevd ved rød restrisiko (min. 10 tegn)…' : 'Kun ved behov…'}
                    className={`${SETTINGS_INPUT} bg-white ${needJust && !rowBodyDisabled ? 'border-rose-400' : ''}`}
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Ansvarlig</label>
                    <input
                      disabled={rowBodyDisabled}
                      value={row.responsible}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { responsible: e.target.value })}
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Frist</label>
                    <input
                      disabled={rowBodyDisabled}
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { dueDate: e.target.value })}
                      className={SETTINGS_INPUT}
                    />
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* Dual electronic signature section (AML §3-1 medvirkning) */}
      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-[#1a3d32]" />
          <h4 className="text-sm font-semibold text-neutral-800">Behandlet og godkjent av</h4>
          <span className="text-xs text-neutral-400">(AML §3-1 — medvirkning fra arbeidstakere)</span>
        </div>

        {isLocked ? (
          <div className="flex flex-wrap gap-4">
            {ros.signatures.map((sig) => {
              const l1 = formatLevel1AuditLine(sig.level1)
              return (
                <div key={sig.role} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      {sig.role === 'leader' ? 'Leder' : 'Verneombud'}: {sig.signerName}
                    </p>
                    <p className="text-xs text-emerald-700">{fmtDate(sig.signedAt)}</p>
                    {l1 ? <p className="mt-1 font-mono text-[10px] text-emerald-800/90">{l1}</p> : null}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3">
              <Lock className="size-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-900">Dokumentet er låst og read-only</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Leader sign */}
            <div className={`rounded-xl border p-4 ${leaderSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Leder</p>
              {leaderSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <div>
                    <span className="text-sm text-emerald-800">{leaderSig.signerName} — {fmtDate(leaderSig.signedAt)}</span>
                    {(() => {
                      const l1 = formatLevel1AuditLine(leaderSig.level1)
                      return l1 ? <p className="mt-0.5 font-mono text-[10px] text-emerald-800/90">{l1}</p> : null
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Leders fulle navn" className="flex-1 rounded-none border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!leaderName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'leader', leaderName, { onLocked }); setLeaderName('') }} className="rounded-none bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
            {/* Verneombud sign */}
            <div className={`rounded-xl border p-4 ${verneombudSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Verneombud</p>
              {verneombudSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <div>
                    <span className="text-sm text-emerald-800">{verneombudSig.signerName} — {fmtDate(verneombudSig.signedAt)}</span>
                    {(() => {
                      const l1 = formatLevel1AuditLine(verneombudSig.level1)
                      return l1 ? <p className="mt-0.5 font-mono text-[10px] text-emerald-800/90">{l1}</p> : null
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={verneombudName} onChange={(e) => setVerneombudName(e.target.value)} placeholder="Verneombudets fulle navn" className="flex-1 rounded-none border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!verneombudName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'verneombud', verneombudName, { onLocked }); setVerneombudName('') }} className="rounded-none bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!isLocked && !bothSigned && (
          <p className="mt-3 text-xs text-neutral-400">
            Dokumentet låses automatisk når begge parter har signert (godkjent ROS). Signering bruker <strong>nivå 1</strong>{' '}
            (innlogget bruker + SHA-256 av innhold + logg i databasen). Når ROS er låst, opprettes oppgaver på tavlen for
            handlingsplaner der risikoen er gul eller rød (brutto eller restrisiko) og tiltak, ansvarlig og frist er satt —
            med full kontekst fra beskrivelse og risikoraden.
          </p>
        )}
      </div>
    </div>
  )
}
