import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TD,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  GraduationCap,
  HardHat,
  ImagePlus,
  ListChecks,
  Layers,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { mergeSickLeaveMilestonesOnDateChange, useHse } from '../hooks/useHse'
import { HseInspectionRunsPanel } from '../components/hse/HseInspectionRunsPanel'
import { useOrganisation } from '../hooks/useOrganisation'
import { useWorkplaceKpiStripStyle } from '../hooks/useWorkplaceKpiStripStyle'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { canViewIncident } from '../lib/incidentAccess'
import { canViewSickLeaveCase } from '../lib/sickLeaveAccess'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import { formatLevel1AuditLine } from '../lib/level1Signature'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { resolveInspectionsTabLayoutFromPublishedRows } from '../lib/inspectionsLayoutFromPreset'
import {
  expandLegacyHeadingInLayoutOrder,
  matchesVernerunderTemplateName,
  resolveVernerunderTabLayoutFromPublishedRows,
  vernerunderVerticalSegments,
} from '../lib/vernerunderLayoutFromPreset'
import { isSafetyRoundUpcoming, safetyRoundCalendarDateIso, safetyRoundCalendarTimeLabel } from '../lib/safetyRoundCalendar'
import { LayoutScoreStatRow } from '../components/layout/LayoutScoreStatRow'
import { WorkplaceEventsDayCard } from '../components/layout/WorkplaceEventsDayCard'
import {
  WorkplaceTasksActionButtonsRow,
  WorkplaceTasksPrimaryButton,
  WorkplaceTasksSplitButton,
} from '../components/layout/WorkplaceTasksActionButtons'
import { WorkplaceSplit7030Layout } from '../components/layout/WorkplaceSplit7030Layout'
import { useWorkplacePublishedComposerStacks } from '../hooks/useWorkplacePublishedComposerStacks'
import { WorkplacePublishedGridLayout } from '../components/workplace/WorkplacePublishedGridLayout'
import { resolveInspectionsGridFromPublishedRows, resolveVernerunderGridFromPublishedRows } from '../lib/workplaceComposerGrid'
import {
  LAYOUT_COMPOSER_BLOCK_ORDER,
  type LayoutComposerBlockId,
} from './platform/PlatformLayoutComposerPage'
import { SAFETY_ROUND_TEMPLATE_ID, TRAINING_KIND_LABELS } from '../data/hseTemplates'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeSickLeaveWizard, makeSjaWizard, makeSafetyRoundWizard } from '../components/wizard/wizards'
import { useModuleTemplate } from '../hooks/useModuleTemplate'
import {
  MODULE_PAGE_TABLE_TD_CLASS,
  MODULE_PAGE_TABLE_TH_CLASS,
  ModulePageRenderer,
  StatusPill,
} from '../components/module/ModulePageRenderer'
import { WorkplaceListToolbar } from '../components/layout/WorkplaceStandardListLayout'
import { ModuleSettingsPanel } from '../components/module/ModuleSettingsPanel'
import type { TableColumn } from '../types/moduleTemplate'
import type {
  ChecklistTemplate,
  HseProtocolSignature,
  Incident,
  Inspection,
  InspectionAttachment,
  InspectionFinding,
  InspectionSubjectKind,
  SafetyRound,
  SjaAnalysis,
  SjaHazardRow,
  SickLeaveAbsenceType,
  SickLeaveCase,
  SickLeaveMilestoneKind,
  TrainingKind,
} from '../types/hse'

const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const TASK_PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'
const R_FLAT = 'rounded-none'
const HSE_INSPECTION_BUCKET = 'hse_inspection_files'
const ROUND_DRAFT_STORAGE_KEY = 'atics-hse-new-round-draft-v1'

const VERNERUNDER_PAGE_DESCRIPTION = (
  <div className="max-w-3xl space-y-3">
    <p>En vernerunde er en systematisk inspeksjon av det fysiske og psykososiale arbeidsmiljøet i en bedrift.</p>
    <p>Den gjennomføres regelmessig, vanligvis av leder og verneombud i fellesskap.</p>
    <p>
      Hovedmålet er å forebygge ulykker og helseskader ved å avdekke farer, feil og mangler på arbeidsplassen.
    </p>
    <p>
      Funnene dokumenteres alltid i en handlingsplan der konkrete tiltak, ansvarlige og tidsfrister fastsettes.
    </p>
    <p>
      Vernerunder er lovpålagt og utgjør en sentral del av virksomhetens systematiske helse-, miljø- og sikkerhetsarbeid
      (HMS).
    </p>
  </div>
)

const INSPECTIONS_PAGE_DESCRIPTION = (
  <div className="max-w-3xl space-y-3">
    <p>En inspeksjon er en målrettet og systematisk kontroll av utstyr, anlegg, prosesser eller tjenester.</p>
    <p>
      Den gjennomføres for å sikre at kvalitetskrav, sikkerhetsstandarder, lover og regler faktisk overholdes i praksis.
    </p>
    <p>
      Mens vernerunder fokuserer bredt på arbeidsmiljø, er inspeksjoner ofte mer tekniske og spisset mot spesifikke
      fagområder.
    </p>
    <p>
      Alle avvik og feil som avdekkes dokumenteres i en rapport som gir grunnlag for nødvendig vedlikehold eller
      utbedringer.
    </p>
    <p>
      De kan utføres internt av bedriften selv, eller eksternt av tilsynsmyndigheter og uavhengige kontrollorganer.
    </p>
  </div>
)
/** Same strip boxes as rapporter / organisasjonsinnsikt */
const HSE_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const HSE_INSIGHT_CARD =
  `${R_FLAT} flex flex-col border border-neutral-200/90 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:shadow`
const HSE_CARD_TOP_RULE = 'mb-4 h-0.5 w-full shrink-0 bg-[#1a3d32]'
// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: HardHat, iconOnly: false as const },
  { id: 'rounds' as const, label: 'Vernerunder', icon: ListChecks, iconOnly: false as const },
  { id: 'rounds2' as const, label: 'Vernerunder2', icon: Layers, iconOnly: false as const },
  { id: 'inspections' as const, label: 'Inspeksjoner', icon: Search, iconOnly: false as const },
  { id: 'sja' as const, label: 'SJA', icon: ShieldCheck, iconOnly: false as const },
  { id: 'training' as const, label: 'Opplæring', icon: GraduationCap, iconOnly: false as const },
  { id: 'sickness' as const, label: 'Sykefravær', icon: Users, iconOnly: false as const },
] as const

// ─── Label helpers ─────────────────────────────────────────────────────────────

/** Hendelser-fanen ligger under Arbeidsplassrapportering; oversikt bruker fortsatt typefordeling. */
const INCIDENT_KIND_LABELS: Record<Incident['kind'], string> = {
  incident: 'Ulykke / skade',
  near_miss: 'Nestenulykke',
  dangerous_cond: 'Farlige forhold',
  violence: 'Vold',
  threat: 'Trussel',
  deviation: 'Avvik',
}

const SEVERITY_LABELS: Record<Incident['severity'], string> = {
  low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
}

const SJA_STATUS_LABELS: Record<SjaAnalysis['status'], string> = {
  draft: 'Utkast',
  awaiting_participants: 'Venter på deltakere',
  approved: 'Godkjent (alle signert)',
  closed: 'Avsluttet',
}

const SICK_STATUS_LABELS: Record<SickLeaveCase['status'], string> = {
  active: 'Sykemeldt (100%)',
  partial: 'Gradert sykemeldt',
  returning: 'I retur',
  closed: 'Avsluttet',
}

const SICK_STATUS_COLOURS: Record<SickLeaveCase['status'], string> = {
  active: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-800',
  returning: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-neutral-100 text-neutral-600',
}

const SL_ABSENCE_LABELS: Record<SickLeaveAbsenceType, string> = {
  self_reported: 'Egenmelding',
  sick_child: 'Sykt barn',
  medical_certificate: 'Sykemelding (lege)',
}

const INSPECTION_KIND_LABEL: Record<Inspection['kind'], string> = {
  internal: 'Intern',
  external: 'Ekstern',
  audit: 'Revisjon',
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' })
  } catch { return iso }
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return iso }
}

function daysUntil(isoDate: string) {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function isoToDatetimeLocal(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  } catch {
    return ''
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

export function HseModule() {
  const hse = useHse()
  const { publishedStackTemplates, publishedComposerTemplates, loadState: composerLoadState } =
    useWorkplacePublishedComposerStacks()
  const { supabaseConfigured, supabase, organization, profile, user, isAdmin, departments } = useOrgSetupContext()
  const org = useOrganisation()
  const { addTask } = useTasks()
  const { barStyle: kpiStripStyle } = useWorkplaceKpiStripStyle()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')

  useEffect(() => {
    if (tabParam === 'audit') {
      queueMicrotask(() => navigate('/workspace/revisjonslogg?source=hse', { replace: true }))
    }
  }, [tabParam, navigate])

  const tab: TabId = tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'

  const hseHubItems: HubMenu1Item[] = useMemo(
    () =>
      tabs.map(({ id, label, icon: Icon }) => {
        let badgeCount: number | undefined
        if (id === 'sja' && hse.stats.openSja > 0) badgeCount = hse.stats.openSja
        if (id === 'training' && hse.stats.expiredTraining > 0) badgeCount = hse.stats.expiredTraining
        if (id === 'sickness' && hse.stats.overdueMilestones > 0) badgeCount = hse.stats.overdueMilestones
        return {
          key: id,
          label,
          icon: Icon,
          active: tab === id,
          to: `/hse?tab=${id}`,
          badgeCount,
        }
      }),
    [tab, hse.stats.openSja, hse.stats.expiredTraining, hse.stats.overdueMilestones],
  )

  useEffect(() => {
    if (tabParam === 'incidents') {
      navigate('/workplace-reporting/incidents', { replace: true })
    }
  }, [tabParam, navigate])

  const [roundSearch, setRoundSearch] = useState('')
  const [roundPanelId, setRoundPanelId] = useState<string | null>(null)
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false)
  const [calendarDayOffset, setCalendarDayOffset] = useState(0)
  const [roundDraft, setRoundDraft] = useState({
    templateId: 'tpl-standard',
    title: '',
    conductedAt: '',
    location: '',
    department: '',
    notes: '',
  })

  const [scheduleDraft, setScheduleDraft] = useState({
    mode: 'single' as 'single' | 'series',
    templateId: 'tpl-standard',
    title: '',
    plannedAt: '',
    location: '',
    department: '',
    notes: '',
    intervalWeeks: 4,
    seriesEndAt: '',
  })

  const [inspectionPanelOpen, setInspectionPanelOpen] = useState(false)
  const [insDraftId, setInsDraftId] = useState<string | null>(null)
  const [insKind, setInsKind] = useState<Inspection['kind']>('internal')
  const [insTitle, setInsTitle] = useState('')
  const [insConductedAt, setInsConductedAt] = useState('')
  const [insScope, setInsScope] = useState('')
  const [insFindingsSummary, setInsFindingsSummary] = useState('')
  const [insFollowUp, setInsFollowUp] = useState('')
  const [insStatus, setInsStatus] = useState<Inspection['status']>('open')
  const [insSubjectKind, setInsSubjectKind] = useState<InspectionSubjectKind>('free_text')
  const [insSubjectUnitId, setInsSubjectUnitId] = useState('')
  const [insSubjectLabel, setInsSubjectLabel] = useState('')
  const [insResponsibleEmployeeId, setInsResponsibleEmployeeId] = useState('')
  const [findingDrafts, setFindingDrafts] = useState<
    { id: string; description: string; photoDataUrl?: string; status?: InspectionFinding['status'] }[]
  >([])
  const [newFindingText, setNewFindingText] = useState('')
  const [insFileQueue, setInsFileQueue] = useState<File[]>([])
  const [insSearch, setInsSearch] = useState('')

  // ── Module template: DB-driven config for inspections ──────────────────
  const inspModuleTemplate = useModuleTemplate('hse.inspections')
  const [insSettingsOpen, setInsSettingsOpen] = useState(false)
  const [insSettingsSaving, setInsSettingsSaving] = useState(false)
  const [inspectionsCalendarDayOffset, setInspectionsCalendarDayOffset] = useState(0)
  const [protoName, setProtoName] = useState('')
  const [protoRole, setProtoRole] = useState<HseProtocolSignature['role']>('inspector')
  const [finalizeName, setFinalizeName] = useState('')

  const employeePickList = useMemo(
    () => [...org.activeEmployees].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [org.activeEmployees],
  )

  const resetInspectionPanel = useCallback(() => {
    setInsDraftId(null)
    setInsKind('internal')
    setInsTitle('')
    setInsConductedAt('')
    setInsScope('')
    setInsFindingsSummary('')
    setInsFollowUp('')
    setInsStatus('open')
    setInsSubjectKind('free_text')
    setInsSubjectUnitId('')
    setInsSubjectLabel('')
    setInsResponsibleEmployeeId('')
    setFindingDrafts([])
    setNewFindingText('')
    setInsFileQueue([])
  }, [])

  const openNewInspectionPanel = useCallback(() => {
    resetInspectionPanel()
    setProtoName('')
    setProtoRole('inspector')
    setFinalizeName('')
    setInsDraftId(crypto.randomUUID())
    setInspectionPanelOpen(true)
  }, [resetInspectionPanel])

  const closeInspectionPanel = useCallback(() => {
    setInspectionPanelOpen(false)
    resetInspectionPanel()
  }, [resetInspectionPanel])

  useEffect(() => {
    if (!inspectionPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [inspectionPanelOpen])

  useEffect(() => {
    if (!inspectionPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInspectionPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inspectionPanelOpen, closeInspectionPanel])

  const [slSearch, setSlSearch] = useState('')
  const [slPanelId, setSlPanelId] = useState<string | null>(null)
  const [slPanelEmployeeId, setSlPanelEmployeeId] = useState('')
  const [slPanelDepartmentId, setSlPanelDepartmentId] = useState('')
  const [slPanelManagerId, setSlPanelManagerId] = useState('')
  const [slPanelAbsenceType, setSlPanelAbsenceType] = useState<SickLeaveAbsenceType>('medical_certificate')
  const [slPanelSickFrom, setSlPanelSickFrom] = useState('')
  const [slPanelReturnDate, setSlPanelReturnDate] = useState('')
  const [slPanelSicknessDegree, setSlPanelSicknessDegree] = useState('100')
  const [slPanelStatus, setSlPanelStatus] = useState<SickLeaveCase['status']>('active')
  const [slPanelConsent, setSlPanelConsent] = useState(false)
  const [slPanelSeedKanban, setSlPanelSeedKanban] = useState(true)

  // SJA form
  const [sjaSearch, setSjaSearch] = useState('')
  const [sjaFiltersOpen, setSjaFiltersOpen] = useState(false)
  const [sjaPanelId, setSjaPanelId] = useState<string | null>(null)
  const [sjaPanelTitle, setSjaPanelTitle] = useState('')
  const [sjaPanelJobDescription, setSjaPanelJobDescription] = useState('')
  const [sjaPanelLocation, setSjaPanelLocation] = useState('')
  const [sjaPanelDepartmentId, setSjaPanelDepartmentId] = useState('')
  const [sjaPanelPlannedAt, setSjaPanelPlannedAt] = useState('')
  const [sjaPanelWorkLeaderId, setSjaPanelWorkLeaderId] = useState('')
  const [sjaPanelParticipantIds, setSjaPanelParticipantIds] = useState<string[]>([])
  const [sjaPanelInvolvesHotWork, setSjaPanelInvolvesHotWork] = useState(false)
  const [sjaPanelRequiresLoto, setSjaPanelRequiresLoto] = useState(false)
  const [sjaPanelPermitNote, setSjaPanelPermitNote] = useState('')
  const [sjaPanelConclusion, setSjaPanelConclusion] = useState('')
  const [sjaPanelRowDraft, setSjaPanelRowDraft] = useState<
    Omit<SjaHazardRow, 'id'> & { responsibleEmployeeId?: string }
  >({
    step: '',
    hazard: '',
    consequence: '',
    existingControls: '',
    additionalMeasures: '',
    responsible: '',
    responsibleEmployeeId: undefined,
  })

  // Training form (side panel — ny registrering)
  const [trainingForm, setTrainingForm] = useState({
    employeeName: '',
    department: '',
    role: '',
    trainingKind: 'hms_40hr' as TrainingKind,
    customLabel: '',
    completedAt: '',
    expiresAt: '',
    provider: '',
    certificateRef: '',
    notes: '',
  })

  // GDPR + export
  /** Stable anchor for «siste 90 dager» (unngår Date.now() under render). */
  const [overviewTimeAnchor] = useState(() => Date.now())

  const [slPanelMsg, setSlPanelMsg] = useState('')
  const [slPanelRole, setSlPanelRole] = useState<SickLeaveCase['portalMessages'][0]['senderRole']>('manager')
  const [slPanelName, setSlPanelName] = useState('')
  const [trainingPanelId, setTrainingPanelId] = useState<string | null>(null)

  const sjaPanelExisting = sjaPanelId && sjaPanelId !== '__new__' ? hse.sjaAnalyses.find((s) => s.id === sjaPanelId) : undefined
  /** Oppdatert rad fra state (milepæler / dialog etter lagring i panelet). */
  const slPanelLive =
    slPanelId && slPanelId !== '__new__' ? hse.sickLeaveCases.find((s) => s.id === slPanelId) : undefined
  const trainingPanelIsNew = trainingPanelId === '__new__'
  const trainingPanelRec =
    trainingPanelId && !trainingPanelIsNew ? hse.trainingRecords.find((r) => r.id === trainingPanelId) : undefined

  const viewerEmployeeId = useMemo(() => {
    const email = (profile?.email ?? user?.email)?.trim().toLowerCase()
    if (!email) return null
    const e = org.displayEmployees.find((emp) => emp.email?.trim().toLowerCase() === email)
    return e?.id ?? null
  }, [profile?.email, user?.email, org.displayEmployees])

  const incidentViewerCtx = useMemo(
    () => ({
      userId: user?.id,
      viewerEmployeeId,
      isAdmin: Boolean(isAdmin),
      viewerDisplayName: profile?.display_name ?? null,
      viewerEmail: profile?.email ?? user?.email ?? null,
      viewerJobHint: org.displayEmployees.find((e) => e.id === viewerEmployeeId)?.jobTitle ?? null,
    }),
    [user?.id, viewerEmployeeId, isAdmin, profile?.display_name, profile?.email, user?.email, org.displayEmployees],
  )

  const sickLeaveEmployeeRefs = useMemo(
    () =>
      org.displayEmployees.map((e) => ({
        id: e.id,
        reportsToId: e.reportsToId,
        unitId: e.unitId,
      })),
    [org.displayEmployees],
  )

  const sickLeaveViewerCtx = useMemo(
    () => ({
      viewerEmployeeId,
      isAdmin: Boolean(isAdmin),
      viewerJobHint: org.displayEmployees.find((e) => e.id === viewerEmployeeId)?.jobTitle ?? null,
    }),
    [viewerEmployeeId, isAdmin, org.displayEmployees],
  )

  const resetSjaPanelForm = useCallback(() => {
    setSjaPanelTitle('')
    setSjaPanelJobDescription('')
    setSjaPanelLocation('')
    setSjaPanelDepartmentId('')
    setSjaPanelPlannedAt('')
    setSjaPanelWorkLeaderId('')
    setSjaPanelParticipantIds([])
    setSjaPanelInvolvesHotWork(false)
    setSjaPanelRequiresLoto(false)
    setSjaPanelPermitNote('')
    setSjaPanelConclusion('')
    setSjaPanelRowDraft({
      step: '',
      hazard: '',
      consequence: '',
      existingControls: '',
      additionalMeasures: '',
      responsible: '',
      responsibleEmployeeId: undefined,
    })
  }, [])

  const closeSjaPanel = useCallback(() => {
    setSjaPanelId(null)
    resetSjaPanelForm()
  }, [resetSjaPanelForm])

  const openNewSjaPanel = useCallback(() => {
    resetSjaPanelForm()
    setSjaPanelId('__new__')
    const self = viewerEmployeeId ? org.displayEmployees.find((e) => e.id === viewerEmployeeId) : undefined
    if (self) {
      setSjaPanelWorkLeaderId(self.id)
      setSjaPanelParticipantIds([self.id])
    }
  }, [resetSjaPanelForm, viewerEmployeeId, org.displayEmployees])

  const openEditSjaPanel = useCallback(
    (sja: SjaAnalysis) => {
      setSjaPanelId(sja.id)
      setSjaPanelTitle(sja.title)
      setSjaPanelJobDescription(sja.jobDescription)
      setSjaPanelLocation(sja.location)
      setSjaPanelDepartmentId(sja.departmentId ?? '')
      setSjaPanelPlannedAt(isoToDatetimeLocal(sja.plannedAt))
      setSjaPanelWorkLeaderId(sja.workLeaderEmployeeId ?? '')
      setSjaPanelParticipantIds(sja.participantEmployeeIds ?? [])
      setSjaPanelInvolvesHotWork(sja.involvesHotWork ?? false)
      setSjaPanelRequiresLoto(sja.requiresLoto ?? false)
      setSjaPanelPermitNote(sja.permitChecklistNote ?? '')
      setSjaPanelConclusion(sja.conclusion)
      setSjaPanelRowDraft({
        step: '',
        hazard: '',
        consequence: '',
        existingControls: '',
        additionalMeasures: '',
        responsible: '',
        responsibleEmployeeId: undefined,
      })
    },
    [],
  )
  const resetSlPanelForm = useCallback(() => {
    setSlPanelEmployeeId('')
    setSlPanelDepartmentId('')
    setSlPanelManagerId('')
    setSlPanelAbsenceType('medical_certificate')
    setSlPanelSickFrom('')
    setSlPanelReturnDate('')
    setSlPanelSicknessDegree('100')
    setSlPanelStatus('active')
    setSlPanelConsent(false)
    setSlPanelSeedKanban(true)
    setSlPanelMsg('')
    setSlPanelRole('manager')
    setSlPanelName('')
  }, [])

  const closeSlPanel = useCallback(() => {
    setSlPanelId(null)
    resetSlPanelForm()
  }, [resetSlPanelForm])

  const openNewSickLeavePanel = useCallback(() => {
    resetSlPanelForm()
    setSlPanelId('__new__')
    const self = viewerEmployeeId ? org.displayEmployees.find((e) => e.id === viewerEmployeeId) : undefined
    if (self) {
      setSlPanelEmployeeId(self.id)
      if (self.reportsToId) setSlPanelManagerId(self.reportsToId)
      if (self.unitId) setSlPanelDepartmentId(self.unitId)
    }
  }, [resetSlPanelForm, viewerEmployeeId, org.displayEmployees])

  const openEditSickLeavePanel = useCallback((sc: SickLeaveCase) => {
    setSlPanelId(sc.id)
    setSlPanelEmployeeId(sc.employeeId ?? '')
    setSlPanelDepartmentId(sc.departmentId ?? '')
    setSlPanelManagerId(sc.managerEmployeeId ?? '')
    setSlPanelAbsenceType(sc.absenceType ?? 'medical_certificate')
    setSlPanelSickFrom(sc.sickFrom)
    setSlPanelReturnDate(sc.returnDate ?? '')
    setSlPanelSicknessDegree(String(sc.sicknessDegree))
    setSlPanelStatus(sc.status)
    setSlPanelConsent(sc.consentRecorded)
    setSlPanelSeedKanban(!sc.kanbanMilestonesSynced)
    setSlPanelMsg('')
    setSlPanelRole('manager')
    setSlPanelName('')
  }, [])

  const resetTrainingForm = useCallback(() => {
    setTrainingForm({
      employeeName: '',
      department: '',
      role: '',
      trainingKind: 'hms_40hr',
      customLabel: '',
      completedAt: '',
      expiresAt: '',
      provider: '',
      certificateRef: '',
      notes: '',
    })
  }, [])

  const closeTrainingPanel = useCallback(() => {
    setTrainingPanelId(null)
    resetTrainingForm()
  }, [resetTrainingForm])

  const openNewTrainingPanel = useCallback(() => {
    resetTrainingForm()
    setTrainingPanelId('__new__')
  }, [resetTrainingForm])

  const submitNewTrainingFromPanel = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!trainingForm.employeeName.trim()) return
      hse.createTrainingRecord({
        employeeName: trainingForm.employeeName.trim(),
        department: trainingForm.department,
        role: trainingForm.role,
        trainingKind: trainingForm.trainingKind,
        customLabel: trainingForm.customLabel.trim() || undefined,
        completedAt: trainingForm.completedAt || undefined,
        expiresAt: trainingForm.expiresAt || undefined,
        provider: trainingForm.provider.trim() || undefined,
        certificateRef: trainingForm.certificateRef.trim() || undefined,
        notes: trainingForm.notes.trim() || undefined,
      })
      closeTrainingPanel()
    },
    [trainingForm, hse, closeTrainingPanel],
  )

  useEffect(() => {
    if (!sjaPanelId && !slPanelId && !trainingPanelId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sjaPanelId, slPanelId, trainingPanelId])

  useEffect(() => {
    if (!sjaPanelId && !slPanelId && !trainingPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSjaPanel()
        closeSlPanel()
        closeTrainingPanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sjaPanelId, slPanelId, trainingPanelId, closeSjaPanel, closeSlPanel, closeTrainingPanel])

  const roundStats = useMemo(() => {
    const list = hse.safetyRounds
    return {
      total: list.length,
      planned: list.filter((r) => r.scheduleKind === 'planned' && isSafetyRoundUpcoming(r)).length,
      inProgress: list.filter((r) => r.status === 'in_progress' && r.scheduleKind !== 'planned').length,
      pending: list.filter((r) => r.status === 'pending_verneombud' || r.status === 'pending_approval').length,
      approved: list.filter((r) => r.status === 'approved').length,
      withIssues: list.filter((r) => Object.values(r.items).some((v) => v === 'issue')).length,
    }
  }, [hse.safetyRounds])

  const [vernerunderTabLayout, setVernerunderTabLayout] = useState(() =>
    resolveVernerunderTabLayoutFromPublishedRows(null),
  )

  const [inspectionsTabLayout, setInspectionsTabLayout] = useState(() =>
    resolveInspectionsTabLayoutFromPublishedRows(null),
  )

  useEffect(() => {
    setVernerunderTabLayout(resolveVernerunderTabLayoutFromPublishedRows(publishedStackTemplates))
    setInspectionsTabLayout(resolveInspectionsTabLayoutFromPublishedRows(publishedStackTemplates))
  }, [publishedStackTemplates])

  const vernerunderGridResolved = useMemo(
    () => resolveVernerunderGridFromPublishedRows(publishedComposerTemplates),
    [publishedComposerTemplates],
  )

  const inspectionsGridResolved = useMemo(
    () => resolveInspectionsGridFromPublishedRows(publishedComposerTemplates),
    [publishedComposerTemplates],
  )

  const stackVernerunderOrder = useMemo(
    () => expandLegacyHeadingInLayoutOrder(vernerunderTabLayout.order as LayoutComposerBlockId[]),
    [vernerunderTabLayout.order],
  )

  const stackInspectionsOrder = useMemo(
    () => expandLegacyHeadingInLayoutOrder(inspectionsTabLayout.order as LayoutComposerBlockId[]),
    [inspectionsTabLayout.order],
  )

  /** Når layout-mal legger hub i egen blokk, skjul modulskallets dupliserte faner på berørte faner. */
  const hseShellHubOverride = useMemo(() => {
    const out: Partial<Record<TabId, 'hide'>> = {}
    if (!vernerunderGridResolved && stackVernerunderOrder.includes('hubMenu1Bar')) {
      out.rounds = 'hide'
      out.rounds2 = 'hide'
    }
    // Inspeksjoner / SJA tabs use ModulePageRenderer + WorkplaceStandardListLayout (own hub + list chrome)
    out.inspections = 'hide'
    out.sja = 'hide'
    return out
  }, [vernerunderGridResolved, inspectionsGridResolved, stackVernerunderOrder, stackInspectionsOrder])

  const calendarSelectedDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + calendarDayOffset)
    return d
  }, [calendarDayOffset])

  const calendarDayIso = useMemo(
    () => calendarSelectedDate.toISOString().slice(0, 10),
    [calendarSelectedDate],
  )

  const calendarDayLabel = useMemo(() => {
    const s = calendarSelectedDate.toLocaleDateString('nb-NO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [calendarSelectedDate])

  const upcomingSafetyRounds = useMemo(
    () => hse.safetyRounds.filter((r) => isSafetyRoundUpcoming(r)),
    [hse.safetyRounds],
  )

  const roundsOnCalendarDay = useMemo(() => {
    return upcomingSafetyRounds
      .filter((r) => safetyRoundCalendarDateIso(r) === calendarDayIso)
      .sort((a, b) => {
        const ta = new Date(a.scheduleKind === 'planned' && a.plannedAt ? a.plannedAt : a.conductedAt).getTime()
        const tb = new Date(b.scheduleKind === 'planned' && b.plannedAt ? b.plannedAt : b.conductedAt).getTime()
        return ta - tb
      })
  }, [upcomingSafetyRounds, calendarDayIso])

  const roundsFiltered = useMemo(() => {
    const q = roundSearch.trim().toLowerCase()
    let list = [...hse.safetyRounds]
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q) ||
          r.conductedBy.toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      const da = safetyRoundCalendarDateIso(a)
      const db = safetyRoundCalendarDateIso(b)
      if (da !== db) return db.localeCompare(da)
      const ta = new Date(a.scheduleKind === 'planned' && a.plannedAt ? a.plannedAt : a.conductedAt).getTime()
      const tb = new Date(b.scheduleKind === 'planned' && b.plannedAt ? b.plannedAt : b.conductedAt).getTime()
      return tb - ta
    })
    return list
  }, [hse.safetyRounds, roundSearch])

  const openNewRoundPanel = useCallback(() => {
    setRoundPanelId('__new__')
  }, [])

  const openRoundPanel = useCallback((id: string) => {
    setRoundPanelId(id)
  }, [])

  const closeRoundPanel = useCallback(() => {
    setRoundPanelId(null)
  }, [])

  const toCalendarListItem = useCallback(
    (r: SafetyRound) => {
      const dateIso = safetyRoundCalendarDateIso(r)
      const iso = r.scheduleKind === 'planned' && r.plannedAt ? r.plannedAt : r.conductedAt
      const time = safetyRoundCalendarTimeLabel(iso)
      const cat =
        r.scheduleKind === 'planned'
          ? r.seriesId
            ? 'Planlagt · serie'
            : 'Planlagt'
          : 'Kommende'
      let dateLabel = dateIso
      try {
        dateLabel = new Date(`${dateIso}T12:00:00`).toLocaleDateString('nb-NO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } catch {
        /* keep dateIso */
      }
      return {
        id: r.id,
        category: cat,
        title: r.title,
        startLabel: dateLabel,
        endLabel: time || undefined,
        onClick: () => openRoundPanel(r.id),
      }
    },
    [openRoundPanel],
  )

  const calendarAllUpcomingEventsItems = useMemo(() => {
    const sorted = [...upcomingSafetyRounds].sort((a, b) => {
      const ta = new Date(a.scheduleKind === 'planned' && a.plannedAt ? a.plannedAt : a.conductedAt).getTime()
      const tb = new Date(b.scheduleKind === 'planned' && b.plannedAt ? b.plannedAt : b.conductedAt).getTime()
      return ta - tb
    })
    return sorted.map(toCalendarListItem)
  }, [upcomingSafetyRounds, toCalendarListItem])

  const calendarDayEventsItems = useMemo(
    () => roundsOnCalendarDay.map(toCalendarListItem),
    [roundsOnCalendarDay, toCalendarListItem],
  )

  const isoToDatetimeLocalFromDate = useCallback((d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }, [])

  const openSchedulePanelForCalendarDay = useCallback(() => {
    setScheduleDraft((d) => ({
      ...d,
      mode: 'single',
      plannedAt: isoToDatetimeLocalFromDate(calendarSelectedDate),
    }))
    setSchedulePanelOpen(true)
  }, [calendarSelectedDate, isoToDatetimeLocalFromDate])

  const submitSchedule = useCallback(() => {
    const title = scheduleDraft.title.trim()
    const plannedAt = scheduleDraft.plannedAt.trim()
    if (!title || !plannedAt) return
    const conductedBy =
      profile?.display_name?.trim() || user?.email?.trim() || 'Registrert bruker'
    const base = {
      title,
      conductedAt: new Date(plannedAt).toISOString(),
      location: scheduleDraft.location.trim() || '—',
      department: scheduleDraft.department.trim() || undefined,
      conductedBy,
      notes: scheduleDraft.notes.trim() || '',
      checklistTemplateId: scheduleDraft.templateId,
      scheduleKind: 'planned' as const,
      plannedAt: new Date(plannedAt).toISOString(),
    }
    if (scheduleDraft.mode === 'single') {
      const sr = hse.createSafetyRound(base)
      openRoundPanel(sr.id)
    } else {
      const interval = Math.max(1, Math.floor(scheduleDraft.intervalWeeks || 1))
      const endRaw = scheduleDraft.seriesEndAt.trim()
      if (!endRaw) return
      const start = new Date(plannedAt)
      const end = new Date(endRaw)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return
      const seriesId = crypto.randomUUID()
      let cursor = new Date(start)
      const createdIds: string[] = []
      while (cursor <= end) {
        const iso = cursor.toISOString()
        const sr = hse.createSafetyRound({
          ...base,
          title: `${title} (${iso.slice(0, 10)})`,
          conductedAt: iso,
          plannedAt: iso,
          seriesId,
          seriesIntervalWeeks: interval,
          seriesEndPlannedAt: end.toISOString(),
        })
        createdIds.push(sr.id)
        cursor = new Date(cursor)
        cursor.setDate(cursor.getDate() + interval * 7)
      }
      if (createdIds[0]) openRoundPanel(createdIds[0])
    }
    setSchedulePanelOpen(false)
    setScheduleDraft((d) => ({
      ...d,
      title: '',
      plannedAt: '',
      notes: '',
      seriesEndAt: '',
    }))
  }, [scheduleDraft, hse, profile?.display_name, user?.email, openRoundPanel])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROUND_DRAFT_STORAGE_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as Record<string, unknown>
      if (!p || typeof p !== 'object') return
      queueMicrotask(() => {
        setRoundDraft((d) => ({
          templateId: typeof p.templateId === 'string' ? p.templateId : d.templateId,
          title: typeof p.title === 'string' ? p.title : d.title,
          conductedAt: typeof p.conductedAt === 'string' ? p.conductedAt : d.conductedAt,
          location: typeof p.location === 'string' ? p.location : d.location,
          department: typeof p.department === 'string' ? p.department : d.department,
          notes: typeof p.notes === 'string' ? p.notes : d.notes,
        }))
      })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(ROUND_DRAFT_STORAGE_KEY, JSON.stringify(roundDraft))
    } catch {
      /* ignore */
    }
  }, [roundDraft])

  useEffect(() => {
    if (!roundPanelId && !schedulePanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [roundPanelId, schedulePanelOpen])

  useEffect(() => {
    if (!roundPanelId && !schedulePanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (roundPanelId) closeRoundPanel()
      if (schedulePanelOpen) setSchedulePanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roundPanelId, schedulePanelOpen, closeRoundPanel])

  const openSchedulePanel = useCallback(() => {
    setScheduleDraft((d) => ({
      ...d,
      plannedAt: d.plannedAt.trim() ? d.plannedAt : isoToDatetimeLocalFromDate(calendarSelectedDate),
    }))
    setSchedulePanelOpen(true)
  }, [calendarSelectedDate, isoToDatetimeLocalFromDate])
  const closeSchedulePanel = useCallback(() => setSchedulePanelOpen(false), [])

  const setCalendarDayFromIso = useCallback((isoDate: string) => {
    if (!isoDate) return
    const pick = new Date(`${isoDate}T12:00:00`)
    if (Number.isNaN(pick.getTime())) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const pick0 = new Date(pick.getFullYear(), pick.getMonth(), pick.getDate())
    const diff = Math.round((pick0.getTime() - today.getTime()) / 86400000)
    setCalendarDayOffset(diff)
  }, [])

  /**
   * Vernerunder: én renderer for blokk-ID → innhold (samme kode som i stack og i publisert **Komponer**-rutenett).
   * Publisert **kind=grid** med navn som Layout_vernerunder brukes i stedet for stack-rekkefølge (matcher platform-admin).
   */
  const buildVernerunderLayoutUi = useCallback((): ReactNode => {
    const layoutTableCell = `${LAYOUT_TABLE1_POSTINGS_TD} text-neutral-800`

    const safetyRoundWizardDef = makeSafetyRoundWizard(
      (data) => {
        const sr = hse.createSafetyRound({
          title: String(data.title),
          conductedAt: new Date(String(data.conductedAt)).toISOString(),
          location: String(data.location) || '—',
          department: String(data.department) || undefined,
          conductedBy: profile?.display_name?.trim() || user?.email?.trim() || 'Registrert bruker',
          notes: String(data.notes) || '',
          checklistTemplateId: String(data.templateId) || SAFETY_ROUND_TEMPLATE_ID,
        })
        openRoundPanel(sr.id)
      },
      hse.checklistTemplates.map((t) => ({ value: t.id, label: t.name })),
    )

    const renderVernerunderComposerBlock = (blockId: string): ReactNode => {
      const id = blockId as LayoutComposerBlockId
      if (!LAYOUT_COMPOSER_BLOCK_ORDER.includes(id)) {
        return (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
            Ukjent blokk <strong className="font-mono">{blockId}</strong> — ikke i layout-registeret.
          </div>
        )
      }

      switch (id) {
        case 'pageHeading1':
          return (
            <WorkplacePageHeading1
              breadcrumb={[]}
              title="Vernerunder"
              description={VERNERUNDER_PAGE_DESCRIPTION}
            />
          )
        case 'hubMenu1Bar':
          return <HubMenu1Bar ariaLabel="HSE / HMS — faner" items={hseHubItems} />
        case 'heading1':
          return (
            <>
              <WorkplacePageHeading1
                breadcrumb={[]}
                title="Vernerunder"
                description={VERNERUNDER_PAGE_DESCRIPTION}
              />
              <div className="mt-4 min-w-0">
                <HubMenu1Bar ariaLabel="HSE / HMS — faner" items={hseHubItems} />
              </div>
            </>
          )
        case 'scoreStatRow':
          return (
            <LayoutScoreStatRow
              items={[
                { big: String(roundStats.total), title: 'Totalt', sub: 'I registeret' },
                { big: String(roundStats.planned), title: 'Planlagt', sub: 'Kommende' },
                { big: String(roundStats.inProgress), title: 'Utfylling', sub: 'Ikke planlagt' },
                { big: String(roundStats.approved), title: 'Godkjent', sub: 'Arkiv' },
              ]}
            />
          )
        case 'workplaceTasksActions':
          return (
            <WorkplaceTasksActionButtonsRow>
              <WorkplaceTasksPrimaryButton label="Registrer gjennomført runde" onClick={openNewRoundPanel} />
              <WorkplaceTasksSplitButton
                label="Planlegg"
                onMainClick={openSchedulePanelForCalendarDay}
                options={[
                  { id: 'day', label: 'For valgt dag', onSelect: openSchedulePanelForCalendarDay },
                  { id: 'full', label: 'Én dato eller serie…', onSelect: openSchedulePanel },
                ]}
              />
              <WizardButton
                def={safetyRoundWizardDef}
                label="Veiviser"
                renderTrigger={(open) => (
                  <WorkplaceTasksPrimaryButton label="Veiviser" icon={Wand2} onClick={open} />
                )}
              />
            </WorkplaceTasksActionButtonsRow>
          )
        case 'table1':
          return (
            <LayoutTable1PostingsShell
              wrap
              title="Runder"
              description="Tidligere og kommende runder — sortert etter dato."
              toolbar={
                <div className="relative min-w-[200px] flex-1">
                  <label className="sr-only" htmlFor="round-search">
                    Søk
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="round-search"
                    type="search"
                    value={roundSearch}
                    onChange={(e) => setRoundSearch(e.target.value)}
                    placeholder="Søk i tittel, sted, avdeling …"
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                  />
                </div>
              }
              footer={
                <span className="text-neutral-500">
                  {roundSearch.trim()
                    ? `${roundsFiltered.length} treff`
                    : `Viser ${roundsFiltered.length} runder`}
                </span>
              }
            >
              <>
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lokasjon</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type / status</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Dato</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Avvik</th>
                      <th className={`w-12 ${LAYOUT_TABLE1_POSTINGS_TH}`} aria-label="Handling" />
                    </tr>
                  </thead>
                  <tbody>
                    {roundsFiltered.map((sr) => (
                      <SafetyRoundTableRow
                        key={sr.id}
                        round={sr}
                        templates={hse.checklistTemplates}
                        rowClass={LAYOUT_TABLE1_POSTINGS_BODY_ROW}
                        cellClass={layoutTableCell}
                        actionStyle="icon"
                        onOpen={() => openRoundPanel(sr.id)}
                      />
                    ))}
                  </tbody>
                </table>
                {roundsFiltered.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen runder matcher søket.</p>
                ) : null}
              </>
            </LayoutTable1PostingsShell>
          )
        case 'vernerunderScheduleCalendar':
          return (
            <div className="min-w-0">
              <WorkplaceEventsDayCard
                cardTitle="Kommende vernerunder"
                badge={calendarAllUpcomingEventsItems.length}
                dateLabel={calendarDayLabel}
                onPrevDay={() => setCalendarDayOffset((x) => x - 1)}
                onNextDay={() => setCalendarDayOffset((x) => x + 1)}
                datePickerSlot={
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <Calendar className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
                    <input
                      type="date"
                      value={calendarDayIso}
                      onChange={(e) => setCalendarDayFromIso(e.target.value)}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900"
                    />
                  </label>
                }
                tabs={[
                  {
                    id: 'all',
                    label: 'Alle kommende',
                    count: calendarAllUpcomingEventsItems.length,
                    items: calendarAllUpcomingEventsItems,
                    emptyHint: 'Ingen kommende vernerunder. Bruk «Planlegg» i verktøylinjen over.',
                  },
                  {
                    id: 'day',
                    label: 'Valgt dag',
                    count: calendarDayEventsItems.length,
                    items: calendarDayEventsItems,
                    emptyHint: 'Ingen vernerunder på valgt dato.',
                  },
                ]}
                defaultTabId="all"
                footer={{
                  label: 'Serie med intervall (avansert)',
                  onMoreClick: openSchedulePanel,
                }}
              />
            </div>
          )
        default:
          return (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600">
              <strong className="font-mono">{blockId}</strong> — ikke koblet til vernerunder-data ennå. Bruk blokker fra
              Layout_vernerunder-malen, eller utvid registeret på siden.
            </div>
          )
      }
    }

    if (vernerunderGridResolved) {
      return (
        <WorkplacePublishedGridLayout
          rows={vernerunderGridResolved.rows}
          renderBlock={renderVernerunderComposerBlock}
        />
      )
    }

    /** Stack-mal: tabell + kalender holdes på én rad (2/3 | 1/3) som før — grid-mal styrer kolonner selv. */
    const order = stackVernerunderOrder
    const showTable = order.includes('table1')
    const showCalendar = order.includes('vernerunderScheduleCalendar')
    const splitRow =
      showTable && showCalendar ? (
        <WorkplaceSplit7030Layout
          key="vernerunder-split"
          cardWrap={false}
          main={<div className="min-w-0">{renderVernerunderComposerBlock('table1')}</div>}
          aside={renderVernerunderComposerBlock('vernerunderScheduleCalendar')}
        />
      ) : showTable ? (
        <div key="vernerunder-table-only" className="min-w-0">
          {renderVernerunderComposerBlock('table1')}
        </div>
      ) : showCalendar ? (
        renderVernerunderComposerBlock('vernerunderScheduleCalendar')
      ) : null

    const nodes: ReactNode[] = []
    for (const seg of vernerunderVerticalSegments(order)) {
      if (seg.kind === 'pageHeading1' && order.includes('pageHeading1')) {
        nodes.push(<Fragment key="pageHeading1">{renderVernerunderComposerBlock('pageHeading1')}</Fragment>)
      }
      if (seg.kind === 'hubMenu1Bar' && order.includes('hubMenu1Bar')) {
        nodes.push(<Fragment key="hubMenu1Bar">{renderVernerunderComposerBlock('hubMenu1Bar')}</Fragment>)
      }
      if (seg.kind === 'scoreStatRow' && order.includes('scoreStatRow')) {
        nodes.push(<Fragment key="scoreStatRow">{renderVernerunderComposerBlock('scoreStatRow')}</Fragment>)
      }
      if (seg.kind === 'workplaceTasksActions' && order.includes('workplaceTasksActions')) {
        nodes.push(
          <Fragment key="workplaceTasksActions">{renderVernerunderComposerBlock('workplaceTasksActions')}</Fragment>,
        )
      }
      if (seg.kind === 'split' && splitRow) {
        nodes.push(<Fragment key="vernerunder-split-wrap">{splitRow}</Fragment>)
      }
    }

    return <>{nodes}</>
  }, [
    vernerunderGridResolved,
    stackVernerunderOrder,
    hseHubItems,
    roundStats.total,
    roundStats.planned,
    roundStats.inProgress,
    roundStats.approved,
    calendarDayLabel,
    calendarDayIso,
    calendarAllUpcomingEventsItems,
    calendarDayEventsItems,
    roundsFiltered,
    roundSearch,
    hse,
    profile?.display_name,
    user?.email,
    openNewRoundPanel,
    openSchedulePanel,
    openSchedulePanelForCalendarDay,
    openRoundPanel,
    setCalendarDayFromIso,
  ])

  const vernerunderLayoutNodes = useMemo(() => buildVernerunderLayoutUi(), [buildVernerunderLayoutUi])

  const vernerunder2Diagnostics = useMemo(() => {
    const all = publishedComposerTemplates ?? []
    const publishedGrids = all.filter((r) => r.published && r.kind === 'grid')
    const publishedStacks = all.filter((r) => r.published && r.kind === 'stack')
    const gridMatch = publishedGrids.find((r) => matchesVernerunderTemplateName(r.name))
    const stackMatch = publishedStacks.find((r) => matchesVernerunderTemplateName(r.name))
    return {
      composerLoadState,
      publishedGridCount: publishedGrids.length,
      publishedStackCount: publishedStacks.length,
      gridMatchName: gridMatch?.name ?? null,
      gridMatchKind: gridMatch?.kind ?? null,
      stackMatchName: stackMatch?.name ?? null,
      stackMatchKind: stackMatch?.kind ?? null,
      vernerunderGridActive: Boolean(vernerunderGridResolved),
      vernerunderStackPreset: vernerunderTabLayout.presetNameMatched,
      stackOrder: vernerunderTabLayout.order,
    }
  }, [
    publishedComposerTemplates,
    composerLoadState,
    vernerunderGridResolved,
    vernerunderTabLayout.presetNameMatched,
    vernerunderTabLayout.order,
  ])

  const inspectionsFiltered = useMemo(() => {
    const q = insSearch.trim().toLowerCase()
    let list = [...hse.inspections]
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.scope.toLowerCase().includes(q) ||
          i.findings.toLowerCase().includes(q) ||
          (i.subjectLabel ?? '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.conductedAt.localeCompare(a.conductedAt))
    return list
  }, [hse.inspections, insSearch])

  const openSavedInspectionAttachment = useCallback(
    async (a: InspectionAttachment) => {
      if (!supabase || a.path.startsWith('local/')) {
        window.alert('Kan ikke åpne vedlegg uten Supabase eller for lokale opplastinger.')
        return
      }
      const { data, error } = await supabase.storage.from(HSE_INSPECTION_BUCKET).createSignedUrl(a.path, 3600)
      if (error || !data?.signedUrl) {
        window.alert('Kunne ikke hente signert URL for vedlegg.')
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    },
    [supabase],
  )

  const uploadInspectionFile = useCallback(
    async (
      inspectionId: string,
      file: File,
    ): Promise<{ path: string; kind: InspectionAttachment['kind'] } | null> => {
      const mime = file.type || ''
      const kind: InspectionAttachment['kind'] = mime.includes('pdf')
        ? 'pdf'
        : mime.startsWith('image/')
          ? 'image'
          : 'other'
      const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 120)
      const rel = `inspections/${inspectionId}/${crypto.randomUUID()}-${safeName}`
      if (supabase && organization?.id) {
        const path = `${organization.id}/${rel}`
        const { error } = await supabase.storage.from(HSE_INSPECTION_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) {
          console.warn('hse_inspection_files upload', error.message)
          return null
        }
        return { path, kind }
      }
      return { path: `local/${rel}`, kind }
    },
    [supabase, organization],
  )

  function responsibleLabelFromEmployeeId(id: string) {
    const e = employeePickList.find((x) => x.id === id)
    return e?.name ?? ''
  }

  const panelInspection = insDraftId ? hse.inspections.find((i) => i.id === insDraftId) : undefined
  const insFormLocked = Boolean(panelInspection?.locked)
  const isNewInspectionDraft = Boolean(insDraftId && !panelInspection)

  const openEditInspectionPanel = useCallback((ins: Inspection) => {
    let scopeForForm = ins.scope
    if (ins.subjectKind === 'org_unit' && ins.subjectUnitId) {
      scopeForForm = ins.scope.replace(/\nEnhet:\s*.+$/m, '').trimEnd()
    }
    setInsDraftId(ins.id)
    setInsKind(ins.kind)
    setInsTitle(ins.title)
    setInsConductedAt(isoToDatetimeLocal(ins.conductedAt))
    setInsScope(scopeForForm)
    setInsFindingsSummary(ins.findings)
    setInsFollowUp(ins.followUp)
    setInsStatus(ins.status)
    setInsSubjectKind(ins.subjectKind ?? 'free_text')
    setInsSubjectUnitId(ins.subjectUnitId ?? '')
    setInsSubjectLabel(ins.subjectLabel ?? '')
    setInsResponsibleEmployeeId(ins.responsibleEmployeeId ?? '')
    setFindingDrafts(
      (ins.concreteFindings ?? []).map((f) => ({
        id: f.id,
        description: f.description,
        photoDataUrl: f.photoUrl,
        status: f.status,
      })),
    )
    setNewFindingText('')
    setInsFileQueue([])
    setProtoName('')
    setProtoRole('inspector')
    setFinalizeName('')
    setInspectionPanelOpen(true)
  }, [])

  const inspectionsCalendarSelectedDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + inspectionsCalendarDayOffset)
    return d
  }, [inspectionsCalendarDayOffset])

  const inspectionsCalendarDayIso = useMemo(
    () => inspectionsCalendarSelectedDate.toISOString().slice(0, 10),
    [inspectionsCalendarSelectedDate],
  )

  const inspectionsCalendarDayLabel = useMemo(() => {
    const s = inspectionsCalendarSelectedDate.toLocaleDateString('nb-NO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [inspectionsCalendarSelectedDate])

  const setInspectionsCalendarDayFromIso = useCallback((isoDate: string) => {
    if (!isoDate) return
    const pick = new Date(`${isoDate}T12:00:00`)
    if (Number.isNaN(pick.getTime())) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const pick0 = new Date(pick.getFullYear(), pick.getMonth(), pick.getDate())
    const diff = Math.round((pick0.getTime() - today.getTime()) / 86400000)
    setInspectionsCalendarDayOffset(diff)
  }, [])

  const inspectionCalendarDateIso = useCallback((ins: Inspection) => ins.conductedAt.slice(0, 10), [])

  const inspectionsOnCalendarDay = useMemo(() => {
    return inspectionsFiltered
      .filter((i) => inspectionCalendarDateIso(i) === inspectionsCalendarDayIso)
      .sort((a, b) => b.conductedAt.localeCompare(a.conductedAt))
  }, [inspectionsFiltered, inspectionsCalendarDayIso, inspectionCalendarDateIso])

  const toInspectionCalendarListItem = useCallback(
    (ins: Inspection) => {
      const dateIso = inspectionCalendarDateIso(ins)
      let time = ''
      try {
        time = new Date(ins.conductedAt).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
      } catch {
        /* keep empty */
      }
      let dateLabel = dateIso
      try {
        dateLabel = new Date(`${dateIso}T12:00:00`).toLocaleDateString('nb-NO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } catch {
        /* keep dateIso */
      }
      const cat = INSPECTION_KIND_LABEL[ins.kind]
      return {
        id: ins.id,
        category: cat,
        title: ins.title,
        startLabel: dateLabel,
        endLabel: time || undefined,
        onClick: () => openEditInspectionPanel(ins),
      }
    },
    [inspectionCalendarDateIso, openEditInspectionPanel],
  )

  const inspectionCalendarAllItems = useMemo(() => {
    const sorted = [...inspectionsFiltered].sort((a, b) => b.conductedAt.localeCompare(a.conductedAt))
    return sorted.map(toInspectionCalendarListItem)
  }, [inspectionsFiltered, toInspectionCalendarListItem])

  const inspectionCalendarDayItems = useMemo(
    () => inspectionsOnCalendarDay.map(toInspectionCalendarListItem),
    [inspectionsOnCalendarDay, toInspectionCalendarListItem],
  )

  const inspectionLayoutStats = useMemo(() => {
    const list = hse.inspections
    return {
      total: list.length,
      open: list.filter((i) => i.status === 'open' && !i.locked).length,
      closedUnlocked: list.filter((i) => i.status === 'closed' && !i.locked).length,
      locked: list.filter((i) => i.locked).length,
    }
  }, [hse.inspections])

  /**
   * Inspeksjoner: kept for fallback/reference — tab now uses ModulePageRenderer.
   * @deprecated replaced by ModulePageRenderer + useModuleTemplate
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _inspectionsLayoutNodes = useMemo(() => {
    const layoutTableCell = `${LAYOUT_TABLE1_POSTINGS_TD} text-neutral-800`

    const renderInspectionsComposerBlock = (blockId: string): ReactNode => {
      const id = blockId as LayoutComposerBlockId
      if (!LAYOUT_COMPOSER_BLOCK_ORDER.includes(id)) {
        return (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
            Ukjent blokk <strong className="font-mono">{blockId}</strong> — ikke i layout-registeret.
          </div>
        )
      }

      switch (id) {
        case 'pageHeading1':
          return (
            <WorkplacePageHeading1
              breadcrumb={[]}
              title="Inspeksjoner"
              description={INSPECTIONS_PAGE_DESCRIPTION}
            />
          )
        case 'hubMenu1Bar':
          return <HubMenu1Bar ariaLabel="HSE / HMS — faner" items={hseHubItems} />
        case 'heading1':
          return (
            <>
              <WorkplacePageHeading1
                breadcrumb={[]}
                title="Inspeksjoner"
                description={INSPECTIONS_PAGE_DESCRIPTION}
              />
              <div className="mt-4 min-w-0">
                <HubMenu1Bar ariaLabel="HSE / HMS — faner" items={hseHubItems} />
              </div>
            </>
          )
        case 'scoreStatRow':
          return (
            <LayoutScoreStatRow
              items={[
                { big: String(inspectionLayoutStats.total), title: 'Totalt', sub: 'I registeret' },
                { big: String(inspectionLayoutStats.open), title: 'Åpne', sub: 'Pågår' },
                {
                  big: String(inspectionLayoutStats.closedUnlocked),
                  title: 'Lukket (utkast)',
                  sub: 'Kan låses',
                },
                { big: String(inspectionLayoutStats.locked), title: 'Låst', sub: 'Arkiv' },
              ]}
            />
          )
        case 'workplaceTasksActions':
          return (
            <WorkplaceTasksActionButtonsRow>
              <WorkplaceTasksPrimaryButton label="Ny inspeksjon" onClick={openNewInspectionPanel} />
            </WorkplaceTasksActionButtonsRow>
          )
        case 'table1':
          return (
            <LayoutTable1PostingsShell
              wrap
              title="Inspeksjoner"
              description="Tidligere inspeksjoner — sortert etter gjennomført tid. Åpne en rad i sidevinduet for redigering, signatur og låsing."
              toolbar={
                <div className="relative min-w-[200px] flex-1">
                  <label className="sr-only" htmlFor="ins-search-layout">
                    Søk
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="ins-search-layout"
                    type="search"
                    value={insSearch}
                    onChange={(e) => setInsSearch(e.target.value)}
                    placeholder="Søk i tittel, omfang, funn …"
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                  />
                </div>
              }
              footer={
                <span className="text-neutral-500">
                  {insSearch.trim()
                    ? `${inspectionsFiltered.length} treff`
                    : `Viser ${inspectionsFiltered.length} inspeksjoner`}
                </span>
              }
            >
              <>
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Gjennomført</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Avvik</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={`w-12 ${LAYOUT_TABLE1_POSTINGS_TH}`} aria-label="Handling" />
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionsFiltered.map((ins) => (
                      <InspectionTableRow
                        key={ins.id}
                        ins={ins}
                        rowClass={LAYOUT_TABLE1_POSTINGS_BODY_ROW}
                        cellClass={layoutTableCell}
                        actionStyle="icon"
                        onOpen={() => openEditInspectionPanel(ins)}
                      />
                    ))}
                  </tbody>
                </table>
                {inspectionsFiltered.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen inspeksjoner matcher søket.</p>
                ) : null}
              </>
            </LayoutTable1PostingsShell>
          )
        case 'vernerunderScheduleCalendar':
          return (
            <div className="min-w-0">
              <WorkplaceEventsDayCard
                surface="flat"
                cardTitle="Inspeksjoner etter dato"
                badge={inspectionCalendarAllItems.length}
                dateLabel={inspectionsCalendarDayLabel}
                onPrevDay={() => setInspectionsCalendarDayOffset((x) => x - 1)}
                onNextDay={() => setInspectionsCalendarDayOffset((x) => x + 1)}
                datePickerSlot={
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <Calendar className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
                    <input
                      type="date"
                      value={inspectionsCalendarDayIso}
                      onChange={(e) => setInspectionsCalendarDayFromIso(e.target.value)}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900"
                    />
                  </label>
                }
                tabs={[
                  {
                    id: 'all',
                    label: 'Alle',
                    count: inspectionCalendarAllItems.length,
                    items: inspectionCalendarAllItems,
                    emptyHint: 'Ingen inspeksjoner registrert ennå.',
                  },
                  {
                    id: 'day',
                    label: 'Valgt dag',
                    count: inspectionCalendarDayItems.length,
                    items: inspectionCalendarDayItems,
                    emptyHint: 'Ingen inspeksjoner på valgt dato.',
                  },
                ]}
                defaultTabId="all"
              />
            </div>
          )
        default:
          return (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600">
              <strong className="font-mono">{blockId}</strong> — ikke koblet til inspeksjoner-data ennå.
            </div>
          )
      }
    }

    if (inspectionsGridResolved) {
      return (
        <WorkplacePublishedGridLayout
          rows={inspectionsGridResolved.rows}
          renderBlock={renderInspectionsComposerBlock}
        />
      )
    }

    const order = stackInspectionsOrder
    const showTable = order.includes('table1')
    const showCalendar = order.includes('vernerunderScheduleCalendar')
    const splitRow =
      showTable && showCalendar ? (
        <WorkplaceSplit7030Layout
          key="inspections-split"
          cardWrap={false}
          main={<div className="min-w-0">{renderInspectionsComposerBlock('table1')}</div>}
          aside={renderInspectionsComposerBlock('vernerunderScheduleCalendar')}
        />
      ) : showTable ? (
        <div key="inspections-table-only" className="min-w-0">
          {renderInspectionsComposerBlock('table1')}
        </div>
      ) : showCalendar ? (
        renderInspectionsComposerBlock('vernerunderScheduleCalendar')
      ) : null

    const nodes: ReactNode[] = []
    for (const seg of vernerunderVerticalSegments(order)) {
      if (seg.kind === 'pageHeading1' && order.includes('pageHeading1')) {
        nodes.push(<Fragment key="ins-pageHeading1">{renderInspectionsComposerBlock('pageHeading1')}</Fragment>)
      }
      if (seg.kind === 'hubMenu1Bar' && order.includes('hubMenu1Bar')) {
        nodes.push(<Fragment key="ins-hubMenu1Bar">{renderInspectionsComposerBlock('hubMenu1Bar')}</Fragment>)
      }
      if (seg.kind === 'scoreStatRow' && order.includes('scoreStatRow')) {
        nodes.push(<Fragment key="ins-scoreStatRow">{renderInspectionsComposerBlock('scoreStatRow')}</Fragment>)
      }
      if (seg.kind === 'workplaceTasksActions' && order.includes('workplaceTasksActions')) {
        nodes.push(
          <Fragment key="ins-workplaceTasksActions">
            {renderInspectionsComposerBlock('workplaceTasksActions')}
          </Fragment>,
        )
      }
      if (seg.kind === 'split' && splitRow) {
        nodes.push(<Fragment key="ins-split">{splitRow}</Fragment>)
      }
    }

    return <>{nodes}</>
  }, [
    inspectionsGridResolved,
    stackInspectionsOrder,
    hseHubItems,
    inspectionLayoutStats.total,
    inspectionLayoutStats.open,
    inspectionLayoutStats.closedUnlocked,
    inspectionLayoutStats.locked,
    inspectionsFiltered,
    insSearch,
    inspectionsCalendarDayLabel,
    inspectionsCalendarDayIso,
    inspectionCalendarAllItems,
    inspectionCalendarDayItems,
    openNewInspectionPanel,
    openEditInspectionPanel,
    setInspectionsCalendarDayFromIso,
    setInsSearch,
  ])
  void _inspectionsLayoutNodes // kept for fallback; tab uses ModulePageRenderer

  async function submitInspectionPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!insTitle.trim() || !insDraftId || insFormLocked) return
    const conductedIso = insConductedAt ? new Date(insConductedAt).toISOString() : new Date().toISOString()
    const respName =
      insResponsibleEmployeeId ? responsibleLabelFromEmployeeId(insResponsibleEmployeeId) : '—'
    const subjectUnitName =
      insSubjectKind === 'org_unit' && insSubjectUnitId
        ? org.units.find((u) => u.id === insSubjectUnitId)?.name
        : undefined
    const scopeText =
      insSubjectKind === 'org_unit' && subjectUnitName
        ? [insScope.trim(), `Enhet: ${subjectUnitName}`].filter(Boolean).join('\n')
        : insScope.trim()
    const existing = hse.inspections.find((x) => x.id === insDraftId)
    const existingFindings = existing?.concreteFindings ?? []
    const findingsRows: InspectionFinding[] = findingDrafts.map((d) => {
      const prev = existingFindings.find((f) => f.id === d.id)
      const status = d.status ?? prev?.status ?? 'open'
      const resolvedAt =
        status === 'resolved' ? prev?.resolvedAt ?? new Date().toISOString() : undefined
      return {
        id: d.id,
        description: d.description.trim(),
        status,
        photoPath: prev?.photoPath,
        photoUrl: d.photoDataUrl ?? prev?.photoUrl,
        linkedTaskId: prev?.linkedTaskId,
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        resolvedAt,
      }
    })
    const attList: InspectionAttachment[] = [...(existing?.attachments ?? [])]
    for (const f of insFileQueue) {
      const r = await uploadInspectionFile(insDraftId, f)
      if (r) {
        attList.push({
          id: crypto.randomUUID(),
          kind: r.kind,
          path: r.path,
          fileName: f.name,
          uploadedAt: new Date().toISOString(),
        })
      }
    }
    if (insKind === 'external' && !attList.some((a) => a.kind === 'pdf')) {
      window.alert('Ved ekstern inspeksjon (Arbeidstilsynet, Mattilsynet, brannvesen m.m.) må offisiell PDF-rapport lastes opp.')
      return
    }
    const base: Omit<Inspection, 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: insDraftId,
      kind: insKind,
      title: insTitle.trim(),
      conductedAt: conductedIso,
      scope: scopeText,
      findings: insFindingsSummary.trim(),
      followUp: insFollowUp.trim(),
      status: insStatus,
      responsible: respName,
      responsibleEmployeeId: insResponsibleEmployeeId || undefined,
      subjectKind: insSubjectKind,
      subjectUnitId: insSubjectKind === 'org_unit' ? insSubjectUnitId || undefined : undefined,
      subjectLabel: insSubjectKind === 'equipment_or_area' ? insSubjectLabel.trim() || undefined : undefined,
      concreteFindings: findingsRows,
      attachments: attList,
      protocolSignatures: existing?.protocolSignatures ?? [],
      locked: existing?.locked ?? false,
      closureSignature: existing?.closureSignature,
      findingTasksSynced: existing?.findingTasksSynced ?? false,
    }
    if (existing) {
      hse.updateInspection(insDraftId, base)
    } else {
      hse.createInspection(base)
    }
    closeInspectionPanel()
  }

  const sjaStats = useMemo(() => {
    const list = hse.sjaAnalyses
    return {
      total: list.length,
      draft: list.filter((s) => s.status === 'draft').length,
      awaiting: list.filter((s) => s.status === 'awaiting_participants').length,
      approved: list.filter((s) => s.status === 'approved').length,
    }
  }, [hse.sjaAnalyses])

  const sjaFiltered = useMemo(() => {
    const q = sjaSearch.trim().toLowerCase()
    let list = [...hse.sjaAnalyses]
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          (s.jobDescription ?? '').toLowerCase().includes(q) ||
          (s.department ?? '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.plannedAt.localeCompare(a.plannedAt))
    return list
  }, [hse.sjaAnalyses, sjaSearch])

  function sjaDepartmentLabel(sja: SjaAnalysis) {
    if (sja.departmentId) {
      const u = org.units.find((x) => x.id === sja.departmentId)
      if (u) return u.name
      const d = departments.find((x) => x.id === sja.departmentId)
      if (d) return d.name
    }
    return sja.department || '—'
  }

  const departmentSelectOptions = useMemo(() => {
    const fromUnits = [...org.units]
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
      .map((u) => ({ value: u.id, label: u.name }))
    const deptRows = departments.filter((d) => !org.units.some((u) => u.id === d.id))
    const fromDb = deptRows
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
      .map((d) => ({ value: d.id, label: d.name }))
    return [...fromUnits, ...fromDb]
  }, [org.units, departments])

  function submitSjaPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!sjaPanelTitle.trim()) return
    if (!sjaPanelDepartmentId) {
      window.alert('Velg avdeling / enhet.')
      return
    }
    const deptName = departmentSelectOptions.find((o) => o.value === sjaPanelDepartmentId)?.label ?? ''
    const leader = sjaPanelWorkLeaderId ? org.displayEmployees.find((x) => x.id === sjaPanelWorkLeaderId) : undefined
    const participantNames = sjaPanelParticipantIds
      .map((id) => org.displayEmployees.find((em) => em.id === id)?.name)
      .filter(Boolean)
      .join(', ')
    const plannedIso = sjaPanelPlannedAt ? new Date(sjaPanelPlannedAt).toISOString() : new Date().toISOString()
    const baseFields = {
      title: sjaPanelTitle.trim(),
      jobDescription: sjaPanelJobDescription,
      location: sjaPanelLocation.trim() || '—',
      department: deptName,
      departmentId: sjaPanelDepartmentId,
      plannedAt: plannedIso,
      conductedBy: leader?.name ?? '—',
      workLeaderEmployeeId: sjaPanelWorkLeaderId || undefined,
      participantEmployeeIds: sjaPanelParticipantIds,
      participants: participantNames,
      conclusion: sjaPanelConclusion,
      involvesHotWork: sjaPanelInvolvesHotWork,
      requiresLoto: sjaPanelRequiresLoto,
      permitChecklistNote: sjaPanelPermitNote.trim() || undefined,
    }
    if (sjaPanelId === '__new__') {
      const created = hse.createSja({ ...baseFields, rows: [], status: 'draft' })
      closeSjaPanel()
      openEditSjaPanel(created)
      return
    }
    const editId = sjaPanelId
    if (!editId || editId === '__new__') return
    const existing = hse.sjaAnalyses.find((x) => x.id === editId)
    if (!existing) return
    hse.updateSja(editId, {
      ...baseFields,
      rows: existing.rows,
      signatures: existing.signatures,
    })
    closeSjaPanel()
  }

  const slStats = useMemo(() => {
    const list = hse.sickLeaveCases.filter((sc) => canViewSickLeaveCase(sc, sickLeaveViewerCtx, sickLeaveEmployeeRefs))
    const today = new Date(overviewTimeAnchor).toISOString().slice(0, 10)
    const overdue = list.reduce(
      (n, sc) => n + sc.milestones.filter((m) => !m.completedAt && m.dueAt < today).length,
      0,
    )
    return {
      total: list.length,
      active: list.filter((s) => s.status === 'active' || s.status === 'partial').length,
      overdue,
    }
  }, [hse.sickLeaveCases, overviewTimeAnchor, sickLeaveViewerCtx, sickLeaveEmployeeRefs])

  const slFiltered = useMemo(() => {
    const q = slSearch.trim().toLowerCase()
    let list = hse.sickLeaveCases.filter((sc) => canViewSickLeaveCase(sc, sickLeaveViewerCtx, sickLeaveEmployeeRefs))
    if (q) {
      list = list.filter(
        (s) =>
          s.employeeName.toLowerCase().includes(q) ||
          s.managerName.toLowerCase().includes(q) ||
          (s.department ?? '').toLowerCase().includes(q) ||
          SL_ABSENCE_LABELS[s.absenceType ?? 'medical_certificate'].toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.sickFrom.localeCompare(a.sickFrom))
    return list
  }, [hse.sickLeaveCases, slSearch, sickLeaveViewerCtx, sickLeaveEmployeeRefs])

  function seedKanbanMilestoneTasks(sc: SickLeaveCase) {
    const leaderEmp = sc.managerEmployeeId
      ? org.displayEmployees.find((e) => e.id === sc.managerEmployeeId)
      : undefined
    const assignee = leaderEmp?.name?.trim() || sc.managerName.trim() || 'Nærmeste leder'
    for (const m of sc.milestones) {
      if (m.completedAt) continue
      addTask({
        title: `Sykefravær: ${m.label}`,
        description: `Sak: ${sc.employeeName} (fra ${formatDate(sc.sickFrom)}).\n${m.lawRef}\nFrist: ${formatDate(m.dueAt)}`,
        status: 'todo',
        assignee,
        assigneeEmployeeId: sc.managerEmployeeId,
        dueDate: m.dueAt,
        module: 'hse',
        sourceType: 'hse_sick_leave_milestone',
        sourceId: `${sc.id}:${m.kind}`,
        sourceLabel: sc.employeeName,
        ownerRole: 'Nærmeste leder',
        requiresManagementSignOff: false,
      })
    }
  }

  function submitSickLeavePanel(e: React.FormEvent) {
    e.preventDefault()
    if (!slPanelSickFrom) return
    if (slPanelId === '__new__') {
      if (!slPanelEmployeeId) {
        window.alert('Velg ansatt fra listen.')
        return
      }
      if (!slPanelManagerId) {
        window.alert('Velg nærmeste leder.')
        return
      }
    }
    const emp = slPanelEmployeeId ? org.displayEmployees.find((x) => x.id === slPanelEmployeeId) : undefined
    const deptName = slPanelDepartmentId
      ? departmentSelectOptions.find((o) => o.value === slPanelDepartmentId)?.label ?? ''
      : emp?.unitName ?? ''
    const mgr = slPanelManagerId ? org.displayEmployees.find((x) => x.id === slPanelManagerId) : undefined
    if (slPanelId === '__new__') {
      const created = hse.createSickLeaveCase({
        employeeName: emp?.name?.trim() || 'Ukjent ansatt',
        employeeId: slPanelEmployeeId || undefined,
        department: deptName,
        departmentId: slPanelDepartmentId || emp?.unitId,
        managerName: mgr?.name?.trim() || '—',
        managerEmployeeId: slPanelManagerId || undefined,
        absenceType: slPanelAbsenceType,
        sickFrom: slPanelSickFrom,
        returnDate: slPanelReturnDate.trim() || undefined,
        status: slPanelStatus,
        sicknessDegree: Number(slPanelSicknessDegree) || 100,
        accommodationNotes: '',
        consentRecorded: slPanelConsent,
        kanbanMilestonesSynced: false,
      })
      if (slPanelSeedKanban) {
        seedKanbanMilestoneTasks(created)
        hse.updateSickLeaveCase(created.id, { kanbanMilestonesSynced: true })
      }
      closeSlPanel()
      return
    }

    const editId = slPanelId
    if (!editId || editId === '__new__') return
    const existing = hse.sickLeaveCases.find((x) => x.id === editId)
    if (!existing) return

    const milestonesNext =
      slPanelSickFrom !== existing.sickFrom
        ? mergeSickLeaveMilestonesOnDateChange(existing.milestones, slPanelSickFrom)
        : existing.milestones

    hse.updateSickLeaveCase(editId, {
      employeeName: emp?.name?.trim() || existing.employeeName,
      employeeId: slPanelEmployeeId || undefined,
      department: deptName || existing.department,
      departmentId: slPanelDepartmentId || emp?.unitId || existing.departmentId,
      managerName: mgr?.name?.trim() || existing.managerName,
      managerEmployeeId: slPanelManagerId || undefined,
      absenceType: slPanelAbsenceType,
      sickFrom: slPanelSickFrom,
      returnDate: slPanelReturnDate.trim() || undefined,
      status: slPanelStatus,
      sicknessDegree: Number(slPanelSicknessDegree) || 100,
      consentRecorded: slPanelConsent,
      milestones: milestonesNext,
    })

    const mergedMilestones = milestonesNext
    const afterPatch: SickLeaveCase = {
      ...existing,
      employeeName: emp?.name?.trim() || existing.employeeName,
      employeeId: slPanelEmployeeId || existing.employeeId,
      department: deptName || existing.department,
      departmentId: slPanelDepartmentId || emp?.unitId || existing.departmentId,
      managerName: mgr?.name?.trim() || existing.managerName,
      managerEmployeeId: slPanelManagerId ?? existing.managerEmployeeId,
      absenceType: slPanelAbsenceType,
      sickFrom: slPanelSickFrom,
      returnDate: slPanelReturnDate.trim() || existing.returnDate,
      status: slPanelStatus,
      sicknessDegree: Number(slPanelSicknessDegree) || 100,
      consentRecorded: slPanelConsent,
      milestones: mergedMilestones,
    }

    if (slPanelSeedKanban && !existing.kanbanMilestonesSynced) {
      seedKanbanMilestoneTasks(afterPatch)
      hse.updateSickLeaveCase(editId, { kanbanMilestonesSynced: true })
    }

    closeSlPanel()
  }

  const hseOverviewKpis = useMemo(
    () => [
      {
        title: 'Registreringer',
        sub: 'Hendelser siste 90 dager',
        value: String(
          hse.incidents.filter((i) => {
            if (!canViewIncident(i, incidentViewerCtx)) return false
            try {
              return new Date(i.occurredAt).getTime() > overviewTimeAnchor - 90 * 86400000
            } catch {
              return false
            }
          }).length,
        ),
      },
      {
        title: 'Åpne avvik',
        sub: 'Inspeksjonsfunn',
        value: String(
          hse.inspections.reduce(
            (n, ins) => n + (ins.concreteFindings ?? []).filter((f) => f.status === 'open').length,
            0,
          ),
        ),
      },
      {
        title: 'Vernerunder',
        sub: 'Godkjente / totalt',
        value: `${hse.safetyRounds.filter((r) => r.status === 'approved').length} / ${hse.safetyRounds.length}`,
      },
      {
        title: 'Sykefravær',
        sub: 'Aktive saker',
        value: String(hse.stats.activeSickLeave),
      },
    ],
    [hse.incidents, hse.inspections, hse.safetyRounds, hse.stats.activeSickLeave, overviewTimeAnchor, incidentViewerCtx],
  )

  const hseIncidentKindSegments = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const k of Object.keys(INCIDENT_KIND_LABELS) as Incident['kind'][]) counts[k] = 0
    for (const i of hse.incidents) {
      if (!canViewIncident(i, incidentViewerCtx)) continue
      counts[i.kind] = (counts[i.kind] ?? 0) + 1
    }
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#0d9488']
    const entries = (Object.keys(INCIDENT_KIND_LABELS) as Incident['kind'][])
      .map((k, idx) => ({
        label: INCIDENT_KIND_LABELS[k],
        value: counts[k] ?? 0,
        color: palette[idx % palette.length],
      }))
      .filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [hse.incidents, incidentViewerCtx])

  const hseSeveritySegments = useMemo(() => {
    const counts: Record<Incident['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }
    for (const i of hse.incidents) {
      if (!canViewIncident(i, incidentViewerCtx)) continue
      counts[i.severity] += 1
    }
    const entries = [
      { label: SEVERITY_LABELS.low, value: counts.low, color: '#059669' },
      { label: SEVERITY_LABELS.medium, value: counts.medium, color: '#d97706' },
      { label: SEVERITY_LABELS.high, value: counts.high, color: '#ea580c' },
      { label: SEVERITY_LABELS.critical, value: counts.critical, color: '#b91c1c' },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [hse.incidents, incidentViewerCtx])

  const hseSafetyRoundSegments = useMemo(() => {
    const map: Record<SafetyRound['status'], number> = {
      in_progress: 0,
      pending_verneombud: 0,
      pending_approval: 0,
      approved: 0,
    }
    for (const r of hse.safetyRounds) {
      map[r.status] = (map[r.status] ?? 0) + 1
    }
    const label: Record<SafetyRound['status'], string> = {
      in_progress: 'Pågår',
      pending_verneombud: 'Venter VO',
      pending_approval: 'Venter godkjenning',
      approved: 'Godkjent',
    }
    const entries = [
      { label: label.in_progress, value: map.in_progress, color: '#0284c7' },
      { label: label.pending_verneombud, value: map.pending_verneombud + map.pending_approval, color: '#d97706' },
      { label: label.approved, value: map.approved, color: '#1a3d32' },
    ].filter((x) => x.value > 0)
    const total = hse.safetyRounds.length
    return { entries, total }
  }, [hse.safetyRounds])

  const hseInspectionSegments = useMemo(() => {
    const internal = hse.inspections.filter((i) => i.kind === 'internal').length
    const external = hse.inspections.filter((i) => i.kind === 'external').length
    const audit = hse.inspections.filter((i) => i.kind === 'audit').length
    const entries = [
      { label: 'Intern', value: internal, color: '#1a3d32' },
      { label: 'Ekstern', value: external, color: '#d97706' },
      { label: 'Revisjon', value: audit, color: '#7c3aed' },
    ].filter((x) => x.value > 0)
    const total = hse.inspections.length
    return { entries, total }
  }, [hse.inspections])

  const hseTrainingKindEntries = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of hse.trainingRecords) {
      const k = r.trainingKind
      counts[k] = (counts[k] ?? 0) + 1
    }
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#0d9488']
    const kinds = Object.keys(TRAINING_KIND_LABELS) as TrainingKind[]
    return kinds
      .map((k, idx) => ({
        label: TRAINING_KIND_LABELS[k],
        value: counts[k] ?? 0,
        color: palette[idx % palette.length],
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [hse.trainingRecords])

  return (
    <>
    <ComplianceModuleChrome
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Samsvar', to: '/compliance' },
        { label: 'HSE / HMS' },
      ]}
      title="HMS & verneombud"
      description={
        <p className="max-w-2xl">
          Vernerunder, inspeksjoner, SJA, sykefraværsoppfølging og revisjonslogg. Hendelser finner du under{' '}
          <Link to="/workplace-reporting/incidents" className="text-[#1a3d32] underline">
            Arbeidsplassrapportering
          </Link>
          . Støtteverktøy — verifiser mot{' '}
          <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">
            lovdata.no
          </a>
          .
        </p>
      }
      showTitleBlock={tab !== 'rounds' && tab !== 'rounds2' && tab !== 'inspections' && tab !== 'sja'}
      hubAriaLabel="HSE / HMS — faner"
      hubItems={hseShellHubOverride[tab] === 'hide' ? [] : hseHubItems}
      contentCard={tab !== 'rounds' && tab !== 'rounds2' && tab !== 'inspections' && tab !== 'sja'}
    >
      {hse.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hse.error}</p>
      )}
      {hse.loading && supabaseConfigured && (
        <p className="mb-4 text-sm text-neutral-500">Laster HMS-data…</p>
      )}

      {/* ── Overview — boxed layout som rapporter / innsikt + grafer ─────────── */}
      {tab === 'overview' && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hseOverviewKpis.map((item) => (
              <div key={item.title} className={HSE_THRESHOLD_BOX} style={kpiStripStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">HMS-innsikt</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HseDonutCard
                title="Hendelser etter type"
                subtitle="Fordeling i registeret"
                segments={hseIncidentKindSegments.entries}
                total={hseIncidentKindSegments.total}
                emptyHint="Ingen hendelser registrert ennå."
              />
              <HseDonutCard
                title="Alvorlighetsgrad"
                subtitle="Hendelser etter risikonivå"
                segments={hseSeveritySegments.entries}
                total={hseSeveritySegments.total}
                emptyHint="Ingen hendelser å vise."
              />
              <HseDonutCard
                title="Vernerunder"
                subtitle="Status på runder"
                segments={hseSafetyRoundSegments.entries}
                total={hseSafetyRoundSegments.total}
                emptyHint="Ingen vernerunder ennå."
              />
              <HseDonutCard
                title="Inspeksjoner"
                subtitle="Intern / ekstern / revisjon"
                segments={hseInspectionSegments.entries}
                total={hseInspectionSegments.total}
                emptyHint="Ingen inspeksjoner registrert."
              />
              <HseFilledListCard
                title="Opplæring etter type"
                subtitle="Antall registreringer"
                rows={hseTrainingKindEntries}
                emptyHint="Ingen opplæringsdata."
              />
              <div className={HSE_INSIGHT_CARD}>
                <div className={HSE_CARD_TOP_RULE} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Driftsstatus</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-[#1a3d32]">{hse.stats.openInspections}</p>
                <p className="mt-1 text-sm text-neutral-600">Åpne inspeksjoner</p>
                <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm text-neutral-700">
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">SJA (utkast)</span>
                    <span className="font-semibold tabular-nums">{hse.stats.openSja}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Forfalte milepæler (sykefravær)</span>
                    <span
                      className={`font-semibold tabular-nums ${hse.stats.overdueMilestones > 0 ? 'text-amber-700' : ''}`}
                    >
                      {hse.stats.overdueMilestones}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Utløpt opplæring</span>
                    <span className={`font-semibold tabular-nums ${hse.stats.expiredTraining > 0 ? 'text-red-700' : ''}`}>
                      {hse.stats.expiredTraining}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Vold / trusler (totalt)</span>
                    <span className={`font-semibold tabular-nums ${hse.stats.violence > 0 ? 'text-red-700' : ''}`}>
                      {hse.stats.violence}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
                  <Link to="/workplace-reporting/incidents" className="hover:underline">
                    Gå til hendelser →
                  </Link>
                </p>
              </div>
            </div>
          </section>

          <div className={`${R_FLAT} border border-amber-200/80 bg-amber-50/90 p-5 text-sm text-amber-950`}>
            <strong>Revisjonslogg:</strong> Alle opprettelser og endringer logges med tidspunkt (append-only). Sykefraværsdata
            vises i sykefravær-fanen og er logget separat.
          </div>
        </div>
      )}

      {/* ── Vernerunder + Vernerunder2 (samme Layout_vernerunder-motor) ───────── */}
      {(tab === 'rounds' || tab === 'rounds2') && (
        <div className="mt-2 min-w-0 space-y-6">
          {tab === 'rounds2' ? (
            <div className="rounded-lg border border-sky-200/90 bg-sky-50/90 p-4 text-sm text-sky-950">
              <p className="font-semibold text-neutral-900">Vernerunder2 — diagnose for Layout_vernerunder</p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700">
                Denne fanen bruker <strong>samme blokk-renderer og data</strong> som «Vernerunder». Forskjellen er bare denne
                boksen: den viser hva som faktisk ble hentet fra <code className="rounded bg-white/80 px-1">platform_composer_templates</code>.
                Mal-navn må matche (f.eks. <strong>Layout_vernerunder</strong>). <strong>Komponer</strong> ={' '}
                <code className="rounded bg-white/80 px-1">kind: grid</code>, <strong>Layout-komponenter</strong> ={' '}
                <code className="rounded bg-white/80 px-1">kind: stack</code> — begge må være <strong>publisert</strong>.
              </p>
              <dl className="mt-3 grid gap-2 text-xs text-neutral-800 sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">Lastetilstand (arbeidsflate)</dt>
                  <dd className="font-mono">{vernerunder2Diagnostics.composerLoadState}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Publiserte maler i cache</dt>
                  <dd>
                    {publishedComposerTemplates === null
                      ? 'null (ikke lastet)'
                      : `${publishedComposerTemplates.length} rader totalt`}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Grid «Layout_vernerunder» (Komponer)</dt>
                  <dd className="font-mono">
                    {vernerunder2Diagnostics.gridMatchName
                      ? `treff: ${vernerunder2Diagnostics.gridMatchName} (${vernerunder2Diagnostics.gridMatchKind})`
                      : 'ingen treff blant publiserte grid-maler'}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Stack «Layout_vernerunder»</dt>
                  <dd className="font-mono">
                    {vernerunder2Diagnostics.stackMatchName
                      ? `treff: ${vernerunder2Diagnostics.stackMatchName} (${vernerunder2Diagnostics.stackMatchKind})`
                      : 'ingen treff blant publiserte stack-maler'}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Aktiv grid på siden</dt>
                  <dd>{vernerunder2Diagnostics.vernerunderGridActive ? 'ja' : 'nei (bruker stack eller fallback)'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Stack preset brukt</dt>
                  <dd className="font-mono">
                    {vernerunder2Diagnostics.vernerunderStackPreset ?? 'null (lokal/default)'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-neutral-500">Stack-rekkefølge (filtrert)</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px]">
                    {vernerunder2Diagnostics.stackOrder.join(' → ') || '(tom)'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {tab === 'rounds' ? (
            <>
              {vernerunderGridResolved ? (
                <p className="text-xs text-neutral-500">
                  Oppsett fra plattform-admin (Komponer / rutenett):{' '}
                  <span className="font-medium text-neutral-700">«{vernerunderGridResolved.templateName}»</span>
                  {supabaseConfigured
                    ? ' — samme rader og kolonnebredder (fr) som i layout-designer.'
                    : '.'}
                </p>
              ) : vernerunderTabLayout.presetNameMatched ? (
                <p className="text-xs text-neutral-500">
                  Oppsett fra plattform-admin (Layout-komponenter / stack):{' '}
                  <span className="font-medium text-neutral-700">«{vernerunderTabLayout.presetNameMatched}»</span>
                  {supabaseConfigured
                    ? ' (oppdateres når publiserte maler endres).'
                    : ' (lagret i denne nettleseren).'}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-neutral-500">
              Samme innhold som «Vernerunder» — se diagnoseboksen over om DB-matching feiler.
            </p>
          )}

          <div className="min-w-0 space-y-6">{vernerunderLayoutNodes}</div>

          {schedulePanelOpen ? (
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeSchedulePanel()
              }}
            >
              <aside
                className="flex h-full w-full max-w-[min(100vw,520px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="schedule-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5">
                  <h2 id="schedule-panel-title" className="text-xl font-semibold text-neutral-900">
                    Planlegg vernerunde
                  </h2>
                  <button
                    type="button"
                    onClick={closeSchedulePanel}
                    className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800`}
                    aria-label="Lukk"
                  >
                    <X className="size-6" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleDraft((d) => ({ ...d, mode: 'single' }))}
                      className={`${R_FLAT} flex-1 border px-3 py-2 text-sm font-medium ${
                        scheduleDraft.mode === 'single'
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-300 bg-white text-neutral-800'
                      }`}
                    >
                      Én dato
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleDraft((d) => ({ ...d, mode: 'series' }))}
                      className={`${R_FLAT} flex-1 border px-3 py-2 text-sm font-medium ${
                        scheduleDraft.mode === 'series'
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-300 bg-white text-neutral-800'
                      }`}
                    >
                      Serie med intervall
                    </button>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-template">
                      Sjekklistemal
                    </label>
                    <select
                      id="sched-template"
                      value={scheduleDraft.templateId}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, templateId: e.target.value }))}
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    >
                      {hse.checklistTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                          {tpl.department ? ` (${tpl.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-title">
                      Tittel
                    </label>
                    <input
                      id="sched-title"
                      value={scheduleDraft.title}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, title: e.target.value }))}
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      placeholder="f.eks. Vernerunde — Lager"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-when">
                        {scheduleDraft.mode === 'series' ? 'Første planlagte tid' : 'Planlagt tid'}
                      </label>
                      <input
                        id="sched-when"
                        type="datetime-local"
                        value={scheduleDraft.plannedAt}
                        onChange={(e) => setScheduleDraft((d) => ({ ...d, plannedAt: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-loc">
                        Område / lokasjon
                      </label>
                      <input
                        id="sched-loc"
                        value={scheduleDraft.location}
                        onChange={(e) => setScheduleDraft((d) => ({ ...d, location: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-dept">
                      Avdeling
                    </label>
                    <input
                      id="sched-dept"
                      value={scheduleDraft.department}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, department: e.target.value }))}
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    />
                  </div>
                  {scheduleDraft.mode === 'series' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-interval">
                          Intervall (uker)
                        </label>
                        <input
                          id="sched-interval"
                          type="number"
                          min={1}
                          value={scheduleDraft.intervalWeeks}
                          onChange={(e) =>
                            setScheduleDraft((d) => ({ ...d, intervalWeeks: Number(e.target.value) || 1 }))
                          }
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-end">
                          Siste planlagte dato
                        </label>
                        <input
                          id="sched-end"
                          type="date"
                          value={scheduleDraft.seriesEndAt}
                          onChange={(e) => setScheduleDraft((d) => ({ ...d, seriesEndAt: e.target.value }))}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="sched-notes">
                      Notater
                    </label>
                    <textarea
                      id="sched-notes"
                      value={scheduleDraft.notes}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, notes: e.target.value }))}
                      rows={3}
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    />
                  </div>
                </div>
                <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5">
                  <button
                    type="button"
                    className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142e26]"
                    onClick={submitSchedule}
                  >
                    {scheduleDraft.mode === 'series' ? 'Opprett serie og åpne første' : 'Opprett planlagt runde'}
                  </button>
                  <button
                    type="button"
                    onClick={closeSchedulePanel}
                    className="mt-3 w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                  >
                    Avbryt
                  </button>
                </footer>
              </aside>
            </div>
          ) : null}

          {roundPanelId ? (
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeRoundPanel()
              }}
            >
              <aside
                className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="round-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8">
                  <h2
                    id="round-panel-title"
                    className="text-xl font-semibold text-neutral-900 sm:text-2xl"
                    style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                  >
                    {roundPanelId === '__new__' ? 'Ny vernerunde' : hse.safetyRounds.find((r) => r.id === roundPanelId)?.title ?? 'Vernerunde'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeRoundPanel}
                    className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800`}
                    aria-label="Lukk"
                  >
                    <X className="size-6" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                  {roundPanelId === '__new__' ? (
                    <div className="space-y-6">
                      <p className={`${SETTINGS_LEAD} rounded-none border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950`}>
                        <strong>Medvirkning (AML § 3-1):</strong> Signering skjer med innlogget bruker (nivå 1) — ikke fritekst «gjennomført av». Velg mal under — sjekklisten vises her før du oppretter runden.
                      </p>
                      <div className={TASK_PANEL_ROW_GRID}>
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900">Mal og kontekst</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>Sjekklisten lastes inn straks du velger mal. Utkast lagres automatisk i denne nettleseren.</p>
                        </div>
                        <div className={TASK_PANEL_INSET}>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-template">
                            Sjekklistemal
                          </label>
                          <select
                            id="new-round-template"
                            value={roundDraft.templateId}
                            onChange={(e) => setRoundDraft((d) => ({ ...d, templateId: e.target.value }))}
                            className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                          >
                            {hse.checklistTemplates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                                {tpl.department ? ` (${tpl.department})` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="mt-5">
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-title">
                              Tittel
                            </label>
                            <input
                              id="new-round-title"
                              value={roundDraft.title}
                              onChange={(e) => setRoundDraft((d) => ({ ...d, title: e.target.value }))}
                              className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                              placeholder="f.eks. Vernerunde — Lager Q2"
                            />
                          </div>
                          <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-when">
                                Gjennomført
                              </label>
                              <input
                                id="new-round-when"
                                type="datetime-local"
                                value={roundDraft.conductedAt}
                                onChange={(e) => setRoundDraft((d) => ({ ...d, conductedAt: e.target.value }))}
                                className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                              />
                            </div>
                            <div>
                              <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-loc">
                                Område / lokasjon
                              </label>
                              <input
                                id="new-round-loc"
                                value={roundDraft.location}
                                onChange={(e) => setRoundDraft((d) => ({ ...d, location: e.target.value }))}
                                className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                              />
                            </div>
                          </div>
                          <div className="mt-5">
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-dept">
                              Avdeling
                            </label>
                            <input
                              id="new-round-dept"
                              value={roundDraft.department}
                              onChange={(e) => setRoundDraft((d) => ({ ...d, department: e.target.value }))}
                              className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                            />
                          </div>
                          <div className="mt-5">
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="new-round-notes">
                              Notater
                            </label>
                            <textarea
                              id="new-round-notes"
                              value={roundDraft.notes}
                              onChange={(e) => setRoundDraft((d) => ({ ...d, notes: e.target.value }))}
                              rows={3}
                              className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className={`${R_FLAT} border border-amber-200/90 bg-amber-50/60 px-4 py-3 text-xs text-amber-950`}>
                        <strong>Frakoblet:</strong> du kan fylle ut skjemaet uten nett — trykk «Opprett runde» når du er tilkoblet igjen for å synkronisere til Supabase.
                      </div>
                      {(() => {
                        const previewTpl = hse.checklistTemplates.find((t) => t.id === roundDraft.templateId)
                        const previewItems = previewTpl?.items ?? []
                        return previewItems.length > 0 ? (
                          <div className={`${R_FLAT} border border-neutral-200 bg-white p-4`}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                              Forhåndsvisning — {previewItems.length} punkter
                            </p>
                            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-neutral-700">
                              {previewItems.slice(0, 12).map((it) => (
                                <li key={it.id} className="border-b border-neutral-100 py-1 last:border-0">
                                  {it.label}
                                </li>
                              ))}
                              {previewItems.length > 12 ? (
                                <li className="py-1 text-neutral-400">+ {previewItems.length - 12} flere …</li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null
                      })()}
                    </div>
                  ) : roundPanelId && hse.safetyRounds.some((r) => r.id === roundPanelId) ? (
                    <SafetyRoundCard
                      round={hse.safetyRounds.find((r) => r.id === roundPanelId)!}
                      templates={hse.checklistTemplates}
                      hse={hse}
                      addTask={addTask}
                    />
                  ) : (
                    <p className="text-sm text-neutral-600">Fant ikke denne runden.</p>
                  )}
                </div>
                {roundPanelId === '__new__' ? (
                  <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                    <button
                      type="button"
                      className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142e26]"
                      onClick={() => {
                        if (!roundDraft.title.trim() || !roundDraft.conductedAt) return
                        const sr = hse.createSafetyRound({
                          title: roundDraft.title.trim(),
                          conductedAt: new Date(roundDraft.conductedAt).toISOString(),
                          location: roundDraft.location.trim() || '—',
                          department: roundDraft.department.trim() || undefined,
                          conductedBy: profile?.display_name?.trim() || user?.email?.trim() || 'Registrert bruker',
                          notes: roundDraft.notes,
                          checklistTemplateId: roundDraft.templateId,
                        })
                        setRoundPanelId(sr.id)
                      }}
                    >
                      Opprett runde og fortsett
                    </button>
                    <button
                      type="button"
                      onClick={closeRoundPanel}
                      className="mt-3 w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                    >
                      Avbryt
                    </button>
                  </footer>
                ) : null}
              </aside>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Inspections — Layout_inspeksjoner (grid Komponer eller stack, fra DB) ── */}
      {tab === 'inspections' && (
        <div className="mt-2 min-w-0 space-y-8">
          <HseInspectionRunsPanel hse={hse} />
          <ModulePageRenderer
            template={inspModuleTemplate.template}
            records={inspectionsFiltered as unknown as Record<string, unknown>[]}
            totalCount={hse.inspections.length}
            search={insSearch}
            onSearchChange={setInsSearch}
            sortField="conductedAt"
            hubItems={hseHubItems}
            showListHeading={false}
            primaryActionLabel="Ny inspeksjon"
            onPrimaryAction={openNewInspectionPanel}
            onSettingsClick={isAdmin ? () => setInsSettingsOpen(true) : undefined}
            emptyMessage="Ingen inspeksjoner matcher søket."
            renderCell={(col: TableColumn, record) => {
              const ins = record as unknown as Inspection
              switch (col.id) {
                case 'title':
                  return (
                    <button type="button" onClick={() => openEditInspectionPanel(ins)} className="text-left font-medium text-neutral-900 hover:text-[#1a3d32] hover:underline">
                      {ins.title}
                    </button>
                  )
                case 'kind':
                  return (
                    <StatusPill
                      statusKey={ins.kind}
                      statuses={inspModuleTemplate.template.caseTypes.map(ct => ({ key: ct.id, label: ct.label, color: ct.color ?? 'neutral', sortOrder: 0 }))}
                    />
                  )
                case 'conductedAt':
                  return (
                    <span className="tabular-nums text-neutral-600 text-xs">
                      {new Date(ins.conductedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  )
                case 'responsible':
                  return <span className="text-neutral-700">{ins.responsible || '—'}</span>
                case 'findings':
                  return (
                    (ins.concreteFindings?.filter(f => f.status === 'open').length ?? 0) > 0
                      ? <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                          {ins.concreteFindings!.filter(f => f.status === 'open').length}
                        </span>
                      : <span className="text-neutral-300">0</span>
                  )
                case 'status':
                  return (
                    <StatusPill
                      statusKey={ins.status}
                      statuses={inspModuleTemplate.template.statuses}
                    />
                  )
                case '_actions':
                  return (
                    <button type="button" onClick={() => openEditInspectionPanel(ins)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-[#1a3d32]" title="Åpne">
                      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor"><path d="M11.7 1.3a1 1 0 0 1 1.4 1.4L4.4 11.4l-2.1.7.7-2.1 8.7-8.7Z"/></svg>
                    </button>
                  )
                default:
                  return <span className="text-neutral-500 text-xs">{String((record as Record<string, unknown>)[col.id] ?? '—')}</span>
              }
            }}
            overlay={
              insSettingsOpen ? (
                <div className="fixed inset-0 z-[200] flex">
                  <div className="flex-1 bg-black/30 backdrop-blur-[1px]" onClick={() => setInsSettingsOpen(false)} />
                  <aside className="flex h-full w-[420px] shrink-0 flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.18)]">
                    <ModuleSettingsPanel
                      template={inspModuleTemplate.template}
                      saving={insSettingsSaving}
                      hasDb={supabaseConfigured}
                      onSave={async (partial) => {
                        setInsSettingsSaving(true)
                        await inspModuleTemplate.save(partial)
                        setInsSettingsSaving(false)
                      }}
                      onPublish={inspModuleTemplate.publish}
                      onUnpublish={inspModuleTemplate.unpublish}
                      onClose={() => setInsSettingsOpen(false)}
                    />
                  </aside>
                </div>
              ) : null
            }
          />
        </div>
      )}

      {/* ── SJA — samme liste-krom som Inspeksjonsrunder (WorkplaceStandardListLayout) ── */}
      {tab === 'sja' && (
        <div className="relative mt-2 min-w-0 space-y-6">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar', to: '/compliance' }, { label: 'HSE / HMS' }]}
            title="Sikker jobb analyse (SJA)"
            description={
              <p className="max-w-2xl text-sm text-neutral-600">
                <strong>Sikker Jobb Analyse (SJA)</strong> er påkrevd for <em>ikke-rutinepregede og høyrisikooperasjoner</em> etter
                IK-forskriften §5 nr. 2 og AML §3-1. Analysen gjennomføres med berørte arbeidstakere <strong>før</strong> arbeidet
                starter. Deltakere velges fra ansattregisteret og må signere med innlogget bruker (nivå 1) før status blir godkjent.
              </p>
            }
            menu={<HubMenu1Bar ariaLabel="HSE / HMS — faner" items={hseHubItems} />}
          />

          <WorkplaceListToolbar
            count={{ value: sjaFiltered.length, label: `sja (${sjaFiltered.length} treff)` }}
            searchPlaceholder="Søk i tittel, sted, beskrivelse …"
            searchValue={sjaSearch}
            onSearchChange={setSjaSearch}
            filtersOpen={sjaFiltersOpen}
            onFiltersOpenChange={setSjaFiltersOpen}
            filterStatusText={
              sjaFiltersOpen
                ? 'Statusfordeling — samme tall som kortene under'
                : undefined
            }
            filterPanel={
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                  Totalt <strong className="ml-1">{sjaStats.total}</strong>
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950">
                  Utkast <strong className="ml-1">{sjaStats.draft}</strong>
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-950">
                  Venter signatur <strong className="ml-1">{sjaStats.awaiting}</strong>
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950">
                  Godkjent <strong className="ml-1">{sjaStats.approved}</strong>
                </span>
              </div>
            }
            viewMode="table"
            onViewModeChange={() => void 0}
            primaryAction={{
              label: 'Ny SJA',
              icon: Plus,
              onClick: openNewSjaPanel,
            }}
          />

          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm md:p-6"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
              <WizardButton
                label="Veiviser"
                variant="solid"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                def={makeSjaWizard((data) => {
                  const deptStr = String(data.department ?? '').trim()
                  const deptOpt = departmentSelectOptions.find(
                    (o) => o.label.trim().toLowerCase() === deptStr.toLowerCase(),
                  )
                  const leaderStr = String(data.conductedBy ?? '').trim()
                  const leaderEmp = org.displayEmployees.find(
                    (e) => e.name.trim().toLowerCase() === leaderStr.toLowerCase(),
                  )
                  const partStr = String(data.participants ?? '')
                  const partNames = partStr
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                  const partIds: string[] = []
                  for (const n of partNames) {
                    const em = org.displayEmployees.find((e) => e.name.trim().toLowerCase() === n.toLowerCase())
                    if (em) partIds.push(em.id)
                  }
                  if (leaderEmp && !partIds.includes(leaderEmp.id)) partIds.unshift(leaderEmp.id)
                  const sja = hse.createSja({
                    title: String(data.title),
                    jobDescription: String(data.jobDescription),
                    location: String(data.location),
                    department: deptOpt?.label ?? deptStr,
                    departmentId: deptOpt?.value,
                    plannedAt: data.plannedAt
                      ? new Date(String(data.plannedAt)).toISOString()
                      : new Date().toISOString(),
                    conductedBy: leaderEmp?.name ?? leaderStr,
                    workLeaderEmployeeId: leaderEmp?.id,
                    participantEmployeeIds: partIds,
                    participants: partNames.join(', ') || leaderEmp?.name || '',
                    rows: [],
                    status: 'draft',
                    conclusion: '',
                  })
                  openEditSjaPanel(sja)
                })}
              />
            </div>

            <div className="mb-5">
              <LayoutScoreStatRow
                items={[
                  { big: String(sjaStats.total), title: 'Registrert', sub: 'Alle SJA-er' },
                  { big: String(sjaStats.draft), title: 'Utkast', sub: 'Under arbeid' },
                  { big: String(sjaStats.awaiting), title: 'Venter deltakere', sub: 'Signaturer' },
                  { big: String(sjaStats.approved), title: 'Alle signert', sub: 'Godkjent' },
                ]}
              />
            </div>

            <p className="mb-4 text-xs text-neutral-500">
              Sortert etter planlagt tid. Åpne en rad for skall, faretabell, arbeidstillatelser og signaturer.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className={`${MODULE_PAGE_TABLE_TH_CLASS} lg:w-[22%]`}>Operasjon</th>
                    <th className={MODULE_PAGE_TABLE_TH_CLASS}>Planlagt</th>
                    <th className={`${MODULE_PAGE_TABLE_TH_CLASS} lg:w-[22%]`}>Sted / avdeling</th>
                    <th className={`${MODULE_PAGE_TABLE_TH_CLASS} w-20`}>Rader</th>
                    <th className={`${MODULE_PAGE_TABLE_TH_CLASS} lg:w-[18%]`}>Status</th>
                    <th className={`${MODULE_PAGE_TABLE_TH_CLASS} text-right`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {sjaFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-neutral-400">
                        Ingen SJA-er matcher søket.
                      </td>
                    </tr>
                  ) : (
                    sjaFiltered.map((sja, ri) => (
                      <SjaTableRow
                        key={sja.id}
                        sja={sja}
                        deptLabel={sjaDepartmentLabel(sja)}
                        rowClass={`${table1BodyRowClass(layout, ri)} hover:bg-neutral-50/70`}
                        cellClass={MODULE_PAGE_TABLE_TD_CLASS}
                        onOpen={() => openEditSjaPanel(sja)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-right text-xs text-neutral-400">
              {sjaFiltered.length} {sjaFiltered.length === 1 ? 'post' : 'poster'}
            </div>
          </div>
        </div>
      )}

      {/* ── Training register ─────────────────────────────────────────────────── */}
      {tab === 'training' && (
        <div className="mt-8 space-y-6">
          <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-4`}>
            <p className="text-sm text-neutral-700">
              Lovpålagt opplæringsoversikt. Verneombud og ledere har krav på <strong>40 timers HMS-kurs</strong> (AML §3-5 og §6-5).
              Systemet varsler med rød badge når sertifiseringer er utløpt.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-xl font-semibold text-neutral-900 md:text-2xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Opplæringsmatrise
            </h2>
            <button
              type="button"
              onClick={openNewTrainingPanel}
              className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
            >
              <Plus className="size-4 shrink-0" />
              Registrer opplæring
            </button>
          </div>

          <Mainbox1
            title="Registrerte kurs og sertifiseringer"
            subtitle="Klikk «Åpne» for å redigere i sidevinduet. Utløpte og forfallende rader er markert."
          >
            {hse.trainingRecords.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen opplæringsrekorder ennå.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={theadRow}>
                      <th className={`${tableCell} font-medium`}>Ansatt</th>
                      <th className={`${tableCell} font-medium`}>Avdeling / rolle</th>
                      <th className={`${tableCell} font-medium`}>Type opplæring</th>
                      <th className={`${tableCell} font-medium`}>Gjennomført</th>
                      <th className={`${tableCell} font-medium`}>Utløper</th>
                      <th className={`${tableCell} font-medium`}>Sertifikat</th>
                      <th className={`${tableCell} text-right font-medium`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hse.trainingRecords.map((rec, ri) => {
                      const today = new Date().toISOString().slice(0, 10)
                      const expired = rec.expiresAt && rec.expiresAt < today
                      const expiringSoon = rec.expiresAt && !expired && daysUntil(rec.expiresAt) <= 30
                      return (
                        <tr key={rec.id} className={table1BodyRowClass(layout, ri)}>
                          <td className={`${tableCell} font-medium text-neutral-900`}>{rec.employeeName}</td>
                          <td className={`${tableCell} text-neutral-600`}>
                            {rec.department}
                            {rec.role ? ` · ${rec.role}` : ''}
                          </td>
                          <td className={`${tableCell} text-neutral-700`}>
                            {rec.trainingKind === 'custom' ? rec.customLabel : TRAINING_KIND_LABELS[rec.trainingKind]}
                          </td>
                          <td className={`${tableCell} text-neutral-500`}>
                            {rec.completedAt ? formatDate(rec.completedAt) : '—'}
                          </td>
                          <td className={tableCell}>
                            {rec.expiresAt ? (
                              <span
                                className={`rounded-none px-2 py-0.5 text-xs font-medium ${
                                  expired
                                    ? 'bg-red-100 text-red-800'
                                    : expiringSoon
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {expired ? 'Utløpt: ' : ''}
                                {formatDate(rec.expiresAt)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={`${tableCell} font-mono text-xs text-neutral-500`}>{rec.certificateRef ?? '—'}</td>
                          <td className={`${tableCell} text-right`}>
                            <button
                              type="button"
                              onClick={() => setTrainingPanelId(rec.id)}
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
            )}
          </Mainbox1>
        </div>
      )}

      {/* ── Sykefravær (samme mønster som inspeksjoner) ───────────────────────── */}
      {tab === 'sickness' && (
        <div className="mt-8 space-y-6">
          <div className={`${R_FLAT} flex items-start gap-3 border border-sky-200 bg-sky-50 px-4 py-3`}>
            <Lock className="mt-0.5 size-4 shrink-0 text-sky-700" />
            <p className="text-sm text-sky-900">
              <strong>Taushetsbelagt sone.</strong> Sykefraværsdata er adskilt fra avviksregistreringen. Tilgang styres i
              appen: administrator ser alle; nærmeste leder ser egne saker; verneombud ser normalt ikke individuelle
              fraværslinjer. <span className="text-xs">(AML §4-6, GDPR / helseopplysninger)</span>
            </p>
          </div>

          {slStats.overdue > 0 && (
            <div className={`${R_FLAT} flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3`}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                <strong>{slStats.overdue} åpne milepæler er forfalt</strong> i saker du har tilgang til — åpne saken og
                marker fullført, eller oppdater frister ved behov.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Sykefravær
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Liste og detaljer i sidevindu. Lovpålagte milepæler (kontakt, oppfølgingsplan, dialogmøter, NAV-vurdering
                m.m.) kan sendes til Kanban for nærmeste leder. Fraværstype og kobling til ansatt/leder gir bedre
                rapportering enn fritekst.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Synlige <strong className="ml-1 font-semibold">{slStats.total}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
                  Aktive <strong className="ml-1 font-semibold">{slStats.active}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                  Forfalte milepæler <strong className="ml-1 font-semibold">{slStats.overdue}</strong>
                </span>
                <button
                  type="button"
                  onClick={openNewSickLeavePanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny sykefraværssak
                </button>
                <WizardButton
                  label="Veiviser"
                  variant="solid"
                  className={HERO_ACTION_CLASS}
                  def={makeSickLeaveWizard((data) => {
                    const nameStr = String(data.employeeName ?? '').trim()
                    const mgrStr = String(data.managerName ?? '').trim()
                    const emp = org.displayEmployees.find((e) => e.name.trim().toLowerCase() === nameStr.toLowerCase())
                    const mgr = org.displayEmployees.find((e) => e.name.trim().toLowerCase() === mgrStr.toLowerCase())
                    const deptName = String(data.department ?? '').trim()
                    const unitFromName = deptName
                      ? org.units.find((u) => u.name.trim().toLowerCase() === deptName.toLowerCase())
                      : undefined
                    const created = hse.createSickLeaveCase({
                      employeeName: (emp?.name ?? nameStr) || 'Ukjent ansatt',
                      employeeId: emp?.id,
                      department: unitFromName?.name ?? deptName,
                      departmentId: unitFromName?.id ?? emp?.unitId,
                      managerName: (mgr?.name ?? mgrStr) || '—',
                      managerEmployeeId: mgr?.id,
                      absenceType: 'medical_certificate',
                      sickFrom: String(data.sickFrom),
                      status: String(data.status) as SickLeaveCase['status'],
                      sicknessDegree: Number(data.sicknessDegree) || 100,
                      accommodationNotes: '',
                      consentRecorded: Boolean(data.consentRecorded),
                      kanbanMilestonesSynced: false,
                    })
                    openEditSickLeavePanel(created)
                  })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{slStats.total}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Saker (din tilgang)</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{slStats.active}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Aktive / gradert</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{slStats.overdue}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Forfalte milepæler</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={kpiStripStyle}>
              <div className="text-2xl font-semibold tabular-nums">{hse.sickLeaveCases.length}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Totalt i org. (alle roller)</div>
            </div>
          </div>

          <Mainbox1
            title="Sykefraværssaker"
            subtitle="Sortert etter startdato. Åpne en rad for milepæler, tilrettelegging og dialog."
          >
            <Table1Shell
              variant="pinpoint"
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor="sl-search">
                        Søk
                      </label>
                      <input
                        id="sl-search"
                        value={slSearch}
                        onChange={(e) => setSlSearch(e.target.value)}
                        placeholder="Søk i navn, leder, avdeling, fraværstype …"
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
                      <th className={tableCell}>Ansatt</th>
                      <th className={tableCell}>Fraværstype</th>
                      <th className={tableCell}>Fra dato</th>
                      <th className={tableCell}>Avdeling</th>
                      <th className={tableCell}>Leder</th>
                      <th className={tableCell}>Milepæler</th>
                      <th className={tableCell}>Status</th>
                      <th className={`${tableCell} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slFiltered.map((sc, ri) => (
                      <SickLeaveTableRow
                        key={sc.id}
                        sc={sc}
                        rowClass={table1BodyRowClass(layout, ri)}
                        cellClass={tableCell}
                        onOpen={() => openEditSickLeavePanel(sc)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {slFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
                  Ingen sykefraværssaker å vise (eller ingen treff i søket).
                </p>
              ) : null}
            </Table1Shell>
          </Mainbox1>
        </div>
      )}
    </ComplianceModuleChrome>

      {/* SJA — sidevindu (skall + analyse + signering) */}
      {sjaPanelId ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeSjaPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-[#f7f6f2] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {sjaPanelId === '__new__' ? 'Ny SJA' : sjaPanelExisting?.title ?? 'SJA'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {SJA_STATUS_LABELS[sjaPanelExisting?.status ?? 'draft']}
                  {sjaPanelExisting ? ` · ${sjaPanelExisting.rows.length} analyse-rad(er)` : ''}
                </p>
              </div>
              <button type="button" onClick={closeSjaPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitSjaPanel}>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Grunnlag</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>Operasjon, sted og avdeling fra organisasjonsdata.</p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-title">
                      Arbeidsoperasjon / tittel *
                    </label>
                    <input
                      id="sja-title"
                      value={sjaPanelTitle}
                      onChange={(e) => setSjaPanelTitle(e.target.value)}
                      required
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    />
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-job">
                        Beskrivelse av jobben
                      </label>
                      <textarea
                        id="sja-job"
                        value={sjaPanelJobDescription}
                        onChange={(e) => setSjaPanelJobDescription(e.target.value)}
                        rows={3}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-loc">
                          Sted
                        </label>
                        <input
                          id="sja-loc"
                          value={sjaPanelLocation}
                          onChange={(e) => setSjaPanelLocation(e.target.value)}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-dept">
                          Avdeling / enhet *
                        </label>
                        <select
                          id="sja-dept"
                          value={sjaPanelDepartmentId}
                          onChange={(e) => setSjaPanelDepartmentId(e.target.value)}
                          required
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        >
                          <option value="">Velg …</option>
                          {departmentSelectOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-when">
                        Planlagt dato og tid
                      </label>
                      <input
                        id="sja-when"
                        type="datetime-local"
                        value={sjaPanelPlannedAt}
                        onChange={(e) => setSjaPanelPlannedAt(e.target.value)}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-leader">
                        Arbeidsleder
                      </label>
                      <select
                        id="sja-leader"
                        value={sjaPanelWorkLeaderId}
                        onChange={(e) => setSjaPanelWorkLeaderId(e.target.value)}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      >
                        <option value="">Velg …</option>
                        {employeePickList.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Deltakere</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Velg alle som skal bekrefte at de har forstått analysen. Hver deltaker signerer som innlogget bruker (nivå 1)
                      før jobben regnes som godkjent.
                    </p>
                  </div>
                  <div className={`${TASK_PANEL_INSET} max-h-56 overflow-y-auto`}>
                    {employeePickList.map((e) => (
                      <label key={e.id} className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 py-2 text-sm last:border-0">
                        <input
                          type="checkbox"
                          checked={sjaPanelParticipantIds.includes(e.id)}
                          onChange={() => {
                            setSjaPanelParticipantIds((ids) =>
                              ids.includes(e.id) ? ids.filter((x) => x !== e.id) : [...ids, e.id],
                            )
                          }}
                          className="size-4 rounded border-neutral-300"
                        />
                        <span>{e.name}</span>
                        {e.unitName ? <span className="text-xs text-neutral-500">({e.unitName})</span> : null}
                      </label>
                    ))}
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Arbeidstillatelser</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Kryss av ved behov. Knytt til relevante sjekklister i dokumentbiblioteket (referanse under).
                    </p>
                  </div>
                  <div className={`${TASK_PANEL_INSET} space-y-3`}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sjaPanelInvolvesHotWork}
                        onChange={(e) => setSjaPanelInvolvesHotWork(e.target.checked)}
                        className="size-4 rounded border-neutral-300"
                      />
                      Involverer varmt arbeid
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sjaPanelRequiresLoto}
                        onChange={(e) => setSjaPanelRequiresLoto(e.target.checked)}
                        className="size-4 rounded border-neutral-300"
                      />
                      Krever utkobling av strøm (LOTO)
                    </label>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="sja-permit">
                        Referanse til sjekklister / dokumenter
                      </label>
                      <textarea
                        id="sja-permit"
                        value={sjaPanelPermitNote}
                        onChange={(e) => setSjaPanelPermitNote(e.target.value)}
                        rows={2}
                        placeholder="f.eks. Dokument «Varmt arbeid» i biblioteket, versjon …"
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                  </div>
                </div>

                {sjaPanelExisting ? (
                  <>
                    <div className={`${TASK_PANEL_ROW_GRID} border-t border-neutral-200`}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Trinnvis analyse</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Del-operasjon, fare, konsekvens, eksisterende og nye tiltak, ansvarlig (velg ansatt).
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="mt-2 w-full min-w-[720px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-neutral-100 text-neutral-700">
                              {['Del-operasjon', 'Fare', 'Konsekvens', 'Eksisterende', 'Tiltak', 'Ansvarlig'].map((h) => (
                                <th key={h} className="border border-neutral-200 px-2 py-2 text-left font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sjaPanelExisting.rows.map((row) => (
                              <tr key={row.id}>
                                <td className="border border-neutral-200 p-1">
                                  <input
                                    value={row.step}
                                    onChange={(e) => hse.updateSjaRow(sjaPanelExisting.id, row.id, { step: e.target.value })}
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  />
                                </td>
                                <td className="border border-neutral-200 p-1">
                                  <input
                                    value={row.hazard}
                                    onChange={(e) => hse.updateSjaRow(sjaPanelExisting.id, row.id, { hazard: e.target.value })}
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  />
                                </td>
                                <td className="border border-neutral-200 p-1">
                                  <input
                                    value={row.consequence}
                                    onChange={(e) =>
                                      hse.updateSjaRow(sjaPanelExisting.id, row.id, { consequence: e.target.value })
                                    }
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  />
                                </td>
                                <td className="border border-neutral-200 p-1">
                                  <input
                                    value={row.existingControls}
                                    onChange={(e) =>
                                      hse.updateSjaRow(sjaPanelExisting.id, row.id, { existingControls: e.target.value })
                                    }
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  />
                                </td>
                                <td className="border border-neutral-200 p-1">
                                  <input
                                    value={row.additionalMeasures}
                                    onChange={(e) =>
                                      hse.updateSjaRow(sjaPanelExisting.id, row.id, { additionalMeasures: e.target.value })
                                    }
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  />
                                </td>
                                <td className="border border-neutral-200 p-1">
                                  <select
                                    value={row.responsibleEmployeeId ?? ''}
                                    onChange={(e) => {
                                      const id = e.target.value
                                      const emp = employeePickList.find((x) => x.id === id)
                                      hse.updateSjaRow(sjaPanelExisting.id, row.id, {
                                        responsibleEmployeeId: id || undefined,
                                        responsible: emp?.name ?? row.responsible,
                                      })
                                    }}
                                    className={`${SETTINGS_INPUT} bg-white text-xs`}
                                  >
                                    <option value="">—</option>
                                    {employeePickList.map((em) => (
                                      <option key={em.id} value={em.id}>
                                        {em.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(['step', 'hazard', 'consequence', 'existingControls', 'additionalMeasures'] as const).map(
                            (field) => (
                              <input
                                key={field}
                                value={sjaPanelRowDraft[field]}
                                onChange={(e) => setSjaPanelRowDraft((d) => ({ ...d, [field]: e.target.value }))}
                                placeholder={
                                  field === 'step'
                                    ? 'Del-operasjon'
                                    : field === 'hazard'
                                      ? 'Fare'
                                      : field === 'consequence'
                                        ? 'Konsekvens'
                                        : field === 'existingControls'
                                          ? 'Eksisterende kontroll'
                                          : 'Tiltak'
                                }
                                className={`${SETTINGS_INPUT} text-xs`}
                              />
                            ),
                          )}
                          <select
                            value={sjaPanelRowDraft.responsibleEmployeeId ?? ''}
                            onChange={(e) => {
                              const id = e.target.value
                              const emp = employeePickList.find((x) => x.id === id)
                              setSjaPanelRowDraft((d) => ({
                                ...d,
                                responsibleEmployeeId: id || undefined,
                                responsible: emp?.name ?? d.responsible,
                              }))
                            }}
                            className={`${SETTINGS_INPUT} text-xs`}
                          >
                            <option value="">Ansvarlig …</option>
                            {employeePickList.map((em) => (
                              <option key={em.id} value={em.id}>
                                {em.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!sjaPanelRowDraft.step.trim() && !sjaPanelRowDraft.hazard.trim()) return
                            const emp = sjaPanelRowDraft.responsibleEmployeeId
                              ? employeePickList.find((x) => x.id === sjaPanelRowDraft.responsibleEmployeeId)
                              : undefined
                            hse.addSjaRow(sjaPanelExisting.id, {
                              ...sjaPanelRowDraft,
                              responsible: emp?.name ?? sjaPanelRowDraft.responsible,
                            })
                            setSjaPanelRowDraft({
                              step: '',
                              hazard: '',
                              consequence: '',
                              existingControls: '',
                              additionalMeasures: '',
                              responsible: '',
                              responsibleEmployeeId: undefined,
                            })
                          }}
                          className={`${HERO_ACTION_CLASS} mt-3 bg-neutral-800 text-white`}
                        >
                          <Plus className="size-4" />
                          Legg til rad
                        </button>
                      </div>
                    </div>

                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Konklusjon</h3>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <textarea
                          value={sjaPanelConclusion}
                          onChange={(e) => setSjaPanelConclusion(e.target.value)}
                          rows={3}
                          className={`${SETTINGS_INPUT} bg-white`}
                        />
                      </div>
                    </div>

                    <div className={`${TASK_PANEL_ROW_GRID} border-t border-neutral-200`}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Status og signering</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Status oppdateres automatisk til «Venter på deltakere» når deltakere og analyse-rader er på plass, og til
                          «Godkjent» når alle valgte deltakere og arbeidsleder har signert (nivå 1).
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <p className="text-sm font-medium text-neutral-800">
                          {SJA_STATUS_LABELS[sjaPanelExisting.status]}
                        </p>
                        {sjaPanelExisting.status === 'closed' ? (
                          <p className="mt-2 text-xs text-neutral-500">Avsluttet — ikke endre signaturer.</p>
                        ) : (
                          <>
                            <div className="mt-4">
                              <p className={SETTINGS_FIELD_LABEL}>Manuell status (valgfritt)</p>
                              <select
                                value={sjaPanelExisting.status}
                                onChange={(e) =>
                                  hse.updateSja(sjaPanelExisting.id, {
                                    status: e.target.value as SjaAnalysis['status'],
                                  })
                                }
                                className={`${SETTINGS_INPUT} mt-2 bg-white`}
                              >
                                <option value="draft">Utkast</option>
                                <option value="awaiting_participants">Venter på deltakere</option>
                                <option value="approved">Godkjent (alle signert)</option>
                                <option value="closed">Avsluttet</option>
                              </select>
                            </div>
                            <ul className="mt-4 space-y-2 text-xs text-neutral-700">
                              {sjaPanelExisting.signatures.map((s, i) => {
                                const l1 = formatLevel1AuditLine(s.level1)
                                return (
                                  <li key={i} className="whitespace-pre-line rounded-none border border-neutral-200 bg-white p-2">
                                    <strong>{s.signerName}</strong> ({s.role}) · {formatWhen(s.signedAt)}
                                    {l1 ? `\n${l1}` : ''}
                                  </li>
                                )
                              })}
                            </ul>
                            {user ? (
                              <div className="mt-4 flex flex-col gap-2">
                                {viewerEmployeeId &&
                                sjaPanelExisting.participantEmployeeIds?.includes(viewerEmployeeId) &&
                                !sjaPanelExisting.signatures.some(
                                  (s) => s.signerEmployeeId === viewerEmployeeId && s.role === 'worker',
                                ) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void (async () => {
                                        const name =
                                          profile?.display_name?.trim() || user.email?.trim() || 'Bruker'
                                        await hse.signSja(sjaPanelExisting.id, {
                                          signerName: name,
                                          role: 'worker',
                                          signerEmployeeId: viewerEmployeeId,
                                        })
                                      })()
                                    }}
                                    className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white`}
                                  >
                                    Signer som deltaker (innlogget)
                                  </button>
                                ) : null}
                                {viewerEmployeeId &&
                                sjaPanelExisting.workLeaderEmployeeId === viewerEmployeeId &&
                                !sjaPanelExisting.signatures.some(
                                  (s) => s.signerEmployeeId === viewerEmployeeId && s.role === 'foreman',
                                ) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void (async () => {
                                        const name =
                                          profile?.display_name?.trim() || user.email?.trim() || 'Bruker'
                                        await hse.signSja(sjaPanelExisting.id, {
                                          signerName: name,
                                          role: 'foreman',
                                          signerEmployeeId: viewerEmployeeId,
                                        })
                                      })()
                                    }}
                                    className={`${HERO_ACTION_CLASS} border border-[#1a3d32] bg-white text-[#1a3d32]`}
                                  >
                                    Signer som arbeidsleder (innlogget)
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-red-700">Logg inn for å signere.</p>
                            )}
                          </>
                        )}
                        <div className="mt-6">
                          <AddTaskLink
                            title={`SJA oppfølging: ${sjaPanelExisting.title.slice(0, 60)}`}
                            module="hse"
                            sourceType="hse_sja"
                            sourceId={sjaPanelExisting.id}
                            sourceLabel={sjaPanelExisting.title}
                            ownerRole="Arbeidsleder / HMS"
                            className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-xs text-[#1a3d32]`}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
                <button
                  type="button"
                  onClick={closeSjaPanel}
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                >
                  Avbryt
                </button>
                <button type="submit" className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26]`}>
                  <ShieldCheck className="size-4" />
                  {sjaPanelId === '__new__' ? 'Opprett og fortsett' : 'Lagre grunnlag'}
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {/* Sykefravær — sidevindu (ny / rediger + milepæler + dialog) */}
      {slPanelId ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeSlPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={submitSickLeavePanel}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {slPanelId === '__new__' ? 'Ny sykefraværssak' : slPanelLive?.employeeName ?? 'Sykefravær'}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {slPanelId === '__new__'
                      ? 'Relasjonelle felt og milepæler — samme mønster som inspeksjoner.'
                      : `${SICK_STATUS_LABELS[slPanelLive?.status ?? 'active']} · ${slPanelLive?.sicknessDegree ?? '—'}% · ${slPanelLive?.department ?? '—'}`}
                  </p>
                </div>
                <button type="button" onClick={closeSlPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                  <X className="size-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <p className={SETTINGS_LEAD}>
                      Velg ansatt og nærmeste leder fra organisasjonen. Startdato styrer alle lovpålagte milepæler. Du kan
                      sende åpne milepæler til Kanban for lederen (én gang per sak, med mindre du krysser av på nytt etter
                      endring av startdato).
                    </p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={SETTINGS_FIELD_LABEL}>Ansatt</label>
                        <select
                          value={slPanelEmployeeId}
                          onChange={(e) => {
                            const id = e.target.value
                            setSlPanelEmployeeId(id)
                            const row = org.displayEmployees.find((x) => x.id === id)
                            if (row?.reportsToId) setSlPanelManagerId(row.reportsToId)
                            if (row?.unitId) setSlPanelDepartmentId(row.unitId)
                          }}
                          required={slPanelId === '__new__'}
                          className={`${SETTINGS_INPUT} bg-white`}
                        >
                          <option value="">Velg ansatt …</option>
                          {employeePickList.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.unitName ? ` · ${e.unitName}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={SETTINGS_FIELD_LABEL}>Avdeling / enhet</label>
                        <select
                          value={slPanelDepartmentId}
                          onChange={(e) => setSlPanelDepartmentId(e.target.value)}
                          className={`${SETTINGS_INPUT} bg-white`}
                        >
                          <option value="">Velg enhet …</option>
                          {departmentSelectOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={SETTINGS_FIELD_LABEL}>Nærmeste leder</label>
                        <select
                          value={slPanelManagerId}
                          onChange={(e) => setSlPanelManagerId(e.target.value)}
                          required={slPanelId === '__new__'}
                          className={`${SETTINGS_INPUT} bg-white`}
                        >
                          <option value="">Velg leder …</option>
                          {employeePickList.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Fraværstype</label>
                        <select
                          value={slPanelAbsenceType}
                          onChange={(e) => setSlPanelAbsenceType(e.target.value as SickLeaveAbsenceType)}
                          className={`${SETTINGS_INPUT} bg-white`}
                        >
                          {(Object.keys(SL_ABSENCE_LABELS) as SickLeaveAbsenceType[]).map((k) => (
                            <option key={k} value={k}>
                              {SL_ABSENCE_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Status</label>
                        <select
                          value={slPanelStatus}
                          onChange={(e) => setSlPanelStatus(e.target.value as SickLeaveCase['status'])}
                          className={`${SETTINGS_INPUT} bg-white`}
                        >
                          <option value="active">Sykemeldt</option>
                          <option value="partial">Gradert</option>
                          <option value="returning">I retur</option>
                          <option value="closed">Avsluttet</option>
                        </select>
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Sykemeldt fra</label>
                        <input
                          type="date"
                          value={slPanelSickFrom}
                          onChange={(e) => setSlPanelSickFrom(e.target.value)}
                          required
                          className={`${SETTINGS_INPUT} bg-white`}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Forventet retur (valgfritt)</label>
                        <input
                          type="date"
                          value={slPanelReturnDate}
                          onChange={(e) => setSlPanelReturnDate(e.target.value)}
                          className={`${SETTINGS_INPUT} bg-white`}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL}>Grad (%)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={slPanelSicknessDegree}
                          onChange={(e) => setSlPanelSicknessDegree(e.target.value)}
                          className={`${SETTINGS_INPUT} bg-white`}
                        />
                      </div>
                    </div>
                    <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={slPanelConsent}
                        onChange={(e) => setSlPanelConsent(e.target.checked)}
                        className="mt-1 size-4 rounded-none border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                      />
                      <span>
                        Arbeidstaker er informert om registreringen (ihht. personvernerklæringen). Deling med BHT eller NAV
                        kan kreve eget samtykke.
                      </span>
                    </label>
                    <label className="mt-3 flex items-start gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={slPanelSeedKanban}
                        onChange={(e) => setSlPanelSeedKanban(e.target.checked)}
                        className="mt-1 size-4 rounded-none border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                      />
                      <span>
                        Opprett åpne milepæler som oppgaver på Kanban for nærmeste leder (anbefales ved nye saker eller ny
                        startdato).
                      </span>
                    </label>
                  </div>
                </div>

                {slPanelId !== '__new__' && slPanelLive ? (
                  <>
                    <div className="border-t border-neutral-200 px-5 py-5">
                      <p className={SETTINGS_FIELD_LABEL}>Lovpålagte milepæler</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Frister beregnes fra {formatDate(slPanelLive.sickFrom)}. Marker fullført når kravet er oppfylt.
                      </p>
                      {(() => {
                        const today = new Date().toISOString().slice(0, 10)
                        const overdue = slPanelLive.milestones.filter((m) => !m.completedAt && m.dueAt < today)
                        const upcoming = slPanelLive.milestones.filter((m) => !m.completedAt && m.dueAt >= today)
                        const done = slPanelLive.milestones.filter((m) => m.completedAt)
                        return (
                          <div className="mt-4 space-y-4">
                            {overdue.length > 0 && (
                              <div className={`${R_FLAT} border border-amber-200 bg-amber-50 px-3 py-2`}>
                                <p className="text-xs font-semibold text-amber-900">Forfalt ({overdue.length})</p>
                                {overdue.map((m) => (
                                  <div key={m.kind} className="mt-2 flex items-center justify-between gap-2 text-xs text-amber-800">
                                    <span>{m.label}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        hse.completeMilestone(slPanelLive.id, m.kind as SickLeaveMilestoneKind)
                                      }
                                      className={`${HERO_ACTION_CLASS} bg-amber-700 text-white`}
                                    >
                                      Fullført
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {upcoming.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-neutral-600">Kommende frister</p>
                                <div className="mt-2 space-y-2">
                                  {upcoming.map((m) => {
                                    const days = daysUntil(m.dueAt)
                                    return (
                                      <div
                                        key={m.kind}
                                        className={`${R_FLAT} flex items-center justify-between border border-neutral-200 px-3 py-2 text-xs`}
                                      >
                                        <span className="font-medium text-neutral-800">{m.label}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-neutral-500">
                                            {formatDate(m.dueAt)} ({days}d)
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              hse.completeMilestone(slPanelLive.id, m.kind as SickLeaveMilestoneKind)
                                            }
                                            className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-[10px] text-white`}
                                          >
                                            Fullført
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {done.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {done.map((m) => (
                                  <span
                                    key={m.kind}
                                    className={`${R_FLAT} inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800`}
                                  >
                                    <CheckCircle2 className="size-3" />
                                    {m.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className={`${TASK_PANEL_ROW_GRID} border-t border-neutral-200`}>
                      <div>
                        <p className={SETTINGS_LEAD}>
                          Tilretteleggingsnotater er taushetsbelagte. Bruk dialogfeltet for strukturert kommunikasjon i saken.
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <label className={`${SETTINGS_FIELD_LABEL} flex items-center gap-1`}>
                          <Lock className="size-3.5" /> Tilretteleggingsnotater
                        </label>
                        <textarea
                          value={slPanelLive.accommodationNotes}
                          onChange={(e) =>
                            hse.updateSickLeaveCase(slPanelLive.id, { accommodationNotes: e.target.value })
                          }
                          rows={4}
                          className={`${SETTINGS_INPUT} mt-2 bg-white`}
                        />
                      </div>
                    </div>

                    <div className={`${TASK_PANEL_ROW_GRID} border-t border-neutral-200`}>
                      <div>
                        <p className={`${SETTINGS_FIELD_LABEL} flex items-center gap-1`}>
                          <MessageSquare className="size-3.5" /> Dialog
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">Meldinger logges i saken.</p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <div className="max-h-48 space-y-2 overflow-y-auto border border-neutral-200 bg-neutral-50 p-3 text-sm">
                          {slPanelLive.portalMessages.length === 0 ? (
                            <p className="text-xs text-neutral-400">Ingen meldinger ennå.</p>
                          ) : (
                            slPanelLive.portalMessages.map((m) => (
                              <div
                                key={m.id}
                                className={`${R_FLAT} px-3 py-2 ${m.senderRole === 'manager' ? 'ml-4 bg-[#1a3d32]/8' : 'mr-4 bg-white'}`}
                              >
                                <div className="mb-1 text-[10px] text-neutral-500">
                                  {m.senderName} ({m.senderRole === 'manager' ? 'Leder' : 'Ansatt'}) ·{' '}
                                  {formatWhen(m.sentAt)}
                                </div>
                                <p className="text-neutral-800">{m.text}</p>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <select
                            value={slPanelRole}
                            onChange={(e) =>
                              setSlPanelRole(e.target.value as SickLeaveCase['portalMessages'][0]['senderRole'])
                            }
                            className={`${SETTINGS_INPUT} w-auto bg-white text-xs`}
                          >
                            <option value="manager">Leder</option>
                            <option value="employee">Ansatt</option>
                          </select>
                          <input
                            value={slPanelName}
                            onChange={(e) => setSlPanelName(e.target.value)}
                            placeholder="Navn"
                            className={`${SETTINGS_INPUT} min-w-[120px] flex-1 text-xs`}
                          />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <textarea
                            value={slPanelMsg}
                            onChange={(e) => setSlPanelMsg(e.target.value)}
                            placeholder="Skriv melding …"
                            rows={2}
                            className={`${SETTINGS_INPUT} min-h-0 flex-1 bg-white text-sm`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const t = slPanelMsg.trim()
                              if (!t) return
                              hse.addPortalMessage(
                                slPanelLive.id,
                                slPanelRole,
                                slPanelName.trim() || (slPanelRole === 'manager' ? 'Leder' : 'Ansatt'),
                                t,
                              )
                              setSlPanelMsg('')
                            }}
                            className={`${HERO_ACTION_CLASS} shrink-0 self-end bg-[#1a3d32] text-white`}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
                <button
                  type="button"
                  onClick={closeSlPanel}
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                >
                  Avbryt
                </button>
                <button type="submit" className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}>
                  <Calendar className="size-4" />
                  {slPanelId === '__new__' ? 'Opprett sak' : 'Lagre'}
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {/* Opplæring — sidevindu (samme mønster som oppgaver / inspeksjon) */}
      {trainingPanelId && (trainingPanelIsNew || trainingPanelRec) ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeTrainingPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {trainingPanelIsNew ? 'Registrer opplæring' : 'Rediger opplæring'}
                </h2>
                {!trainingPanelIsNew && trainingPanelRec ? (
                  <p className="text-xs text-neutral-500">ID: {trainingPanelRec.id.slice(0, 8)}…</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeTrainingPanel}
                className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}
              >
                <X className="size-5" />
              </button>
            </div>
            <form
              onSubmit={
                trainingPanelIsNew
                  ? submitNewTrainingFromPanel
                  : (e) => {
                      e.preventDefault()
                    }
              }
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Registrer lovpålagt og annen HMS-relatert opplæring. Verneombud og ledere har krav på{' '}
                    <strong>40 timers HMS-kurs</strong> (AML §3-5 og §6-5). Utløpsdato gir varsel i oversikten.
                  </p>
                </div>
                <div className={`${TASK_PANEL_INSET} flex flex-col gap-4`}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-employee">
                      Ansatt navn *
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-employee"
                        value={trainingForm.employeeName}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, employeeName: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                        required
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-employee"
                        value={trainingPanelRec.employeeName}
                        onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { employeeName: e.target.value })}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Avdeling og rolle for sporbarhet i matrisen og rapporter.</p>
                </div>
                <div className={`${TASK_PANEL_INSET} grid gap-4 sm:grid-cols-2`}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-dept">
                      Avdeling
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-dept"
                        value={trainingForm.department}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, department: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-dept"
                        value={trainingPanelRec.department}
                        onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { department: e.target.value })}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-role">
                      Rolle / stilling
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-role"
                        value={trainingForm.role}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, role: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-role"
                        value={trainingPanelRec.role}
                        onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { role: e.target.value })}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Velg kurstype. Ved egendefinert kurs, fyll inn visningsnavn.</p>
                </div>
                <div className={`${TASK_PANEL_INSET} flex flex-col gap-4`}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-kind">
                      Type opplæring
                    </label>
                    {trainingPanelIsNew ? (
                      <select
                        id="train-panel-kind"
                        value={trainingForm.trainingKind}
                        onChange={(e) =>
                          setTrainingForm((f) => ({ ...f, trainingKind: e.target.value as TrainingKind }))
                        }
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      >
                        {Object.entries(TRAINING_KIND_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : trainingPanelRec ? (
                      <select
                        id="train-panel-kind"
                        value={trainingPanelRec.trainingKind}
                        onChange={(e) =>
                          hse.updateTrainingRecord(trainingPanelRec.id, {
                            trainingKind: e.target.value as TrainingKind,
                          })
                        }
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      >
                        {Object.entries(TRAINING_KIND_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  {(trainingPanelIsNew ? trainingForm.trainingKind === 'custom' : trainingPanelRec?.trainingKind === 'custom') ? (
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-custom">
                        Egendefinert label
                      </label>
                      {trainingPanelIsNew ? (
                        <input
                          id="train-panel-custom"
                          value={trainingForm.customLabel}
                          onChange={(e) => setTrainingForm((f) => ({ ...f, customLabel: e.target.value }))}
                          className={`${SETTINGS_INPUT} mt-2 bg-white`}
                        />
                      ) : trainingPanelRec ? (
                        <input
                          id="train-panel-custom"
                          value={trainingPanelRec.customLabel ?? ''}
                          onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { customLabel: e.target.value })}
                          className={`${SETTINGS_INPUT} mt-2 bg-white`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Dato for gjennomføring og eventuell utløp (f.eks. førstehjelp).</p>
                </div>
                <div className={`${TASK_PANEL_INSET} grid gap-4 sm:grid-cols-2`}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-done">
                      Gjennomført
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-done"
                        type="date"
                        value={trainingForm.completedAt}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, completedAt: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-done"
                        type="date"
                        value={trainingPanelRec.completedAt ?? ''}
                        onChange={(e) =>
                          hse.updateTrainingRecord(trainingPanelRec.id, {
                            completedAt: e.target.value || undefined,
                          })
                        }
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-exp">
                      Utløper
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-exp"
                        type="date"
                        value={trainingForm.expiresAt}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, expiresAt: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-exp"
                        type="date"
                        value={trainingPanelRec.expiresAt ?? ''}
                        onChange={(e) =>
                          hse.updateTrainingRecord(trainingPanelRec.id, {
                            expiresAt: e.target.value || undefined,
                          })
                        }
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Kursholder og dokumentreferanse for revisjon.</p>
                </div>
                <div className={`${TASK_PANEL_INSET} grid gap-4 sm:grid-cols-2`}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-provider">
                      Leverandør / kursholder
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-provider"
                        value={trainingForm.provider}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, provider: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-provider"
                        value={trainingPanelRec.provider ?? ''}
                        onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { provider: e.target.value })}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-cert">
                      Sertifikat / referansenr.
                    </label>
                    {trainingPanelIsNew ? (
                      <input
                        id="train-panel-cert"
                        value={trainingForm.certificateRef}
                        onChange={(e) => setTrainingForm((f) => ({ ...f, certificateRef: e.target.value }))}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : trainingPanelRec ? (
                      <input
                        id="train-panel-cert"
                        value={trainingPanelRec.certificateRef ?? ''}
                        onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { certificateRef: e.target.value })}
                        className={`${SETTINGS_INPUT} mt-2 bg-white`}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Valgfrie interne notater (synlige kun for autoriserte brukere).</p>
                </div>
                <div className={TASK_PANEL_INSET}>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="train-panel-notes">
                    Notater
                  </label>
                  {trainingPanelIsNew ? (
                    <textarea
                      id="train-panel-notes"
                      value={trainingForm.notes}
                      onChange={(e) => setTrainingForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={4}
                      className={`${SETTINGS_INPUT} mt-2 bg-white`}
                    />
                  ) : trainingPanelRec ? (
                    <textarea
                      id="train-panel-notes"
                      value={trainingPanelRec.notes ?? ''}
                      onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { notes: e.target.value })}
                      rows={4}
                      className={`${SETTINGS_INPUT} mt-2 bg-white`}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
                <button
                  type="button"
                  onClick={closeTrainingPanel}
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                >
                  Avbryt
                </button>
                {trainingPanelIsNew ? (
                  <button type="submit" className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}>
                    <GraduationCap className="size-4 shrink-0" />
                    Registrer opplæring
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeTrainingPanel}
                    className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                  >
                    Ferdig
                  </button>
                )}
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {/* Ny inspeksjon — sidepanel (samme mønster som oppgaver) */}
      {inspectionPanelOpen && (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeInspectionPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {isNewInspectionDraft
                    ? 'Ny inspeksjon'
                    : insFormLocked
                      ? 'Inspeksjon (skrivebeskyttet)'
                      : 'Rediger inspeksjon'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {isNewInspectionDraft ? `Utkast-ID: ${insDraftId}` : `ID: ${insDraftId}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInspectionPanel}
                className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={submitInspectionPanel} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Registrer inspeksjon med relasjonell ansvarlig (ansatt), inspeksjonsobjekt (enhet eller utstyr/lokasjon) og
                    konkrete avvik som hver kan følges på Kanban. Ved ekstern tilsyn kreves PDF-rapport som vedlegg.
                  </p>
                </div>
                <div className={TASK_PANEL_INSET}>
                  <label className={SETTINGS_FIELD_LABEL}>Type</label>
                  <select
                    value={insKind}
                    onChange={(e) => setInsKind(e.target.value as Inspection['kind'])}
                    disabled={insFormLocked}
                    className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="internal">Intern</option>
                    <option value="external">Ekstern</option>
                    <option value="audit">Revisjon</option>
                  </select>
                </div>
              </div>
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Tittel og tidspunkt for gjennomføring.</p>
                </div>
                <div className={TASK_PANEL_INSET} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Tittel *</label>
                    <input
                      value={insTitle}
                      onChange={(e) => setInsTitle(e.target.value)}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                      required
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Dato / tid</label>
                    <input
                      type="datetime-local"
                      value={insConductedAt}
                      onChange={(e) => setInsConductedAt(e.target.value)}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                </div>
              </div>
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Velg hva som inspiseres for sporbarhet i rapporter (historikk per maskin, rom, enhet).</p>
                </div>
                <div className={TASK_PANEL_INSET} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Inspeksjonsobjekt</label>
                    <select
                      value={insSubjectKind}
                      onChange={(e) => setInsSubjectKind(e.target.value as InspectionSubjectKind)}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <option value="free_text">Kun fritekst i omfang</option>
                      <option value="org_unit">Organisasjonsenhet</option>
                      <option value="equipment_or_area">Utstyr / lokasjon (merkelapp)</option>
                    </select>
                  </div>
                  {insSubjectKind === 'org_unit' && (
                    <div>
                      <label className={SETTINGS_FIELD_LABEL}>Enhet</label>
                      <select
                        value={insSubjectUnitId}
                        onChange={(e) => setInsSubjectUnitId(e.target.value)}
                        disabled={insFormLocked}
                        className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <option value="">Velg enhet …</option>
                        {org.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {insSubjectKind === 'equipment_or_area' && (
                    <div>
                      <label className={SETTINGS_FIELD_LABEL}>Merkelapp (f.eks. Truck 3, Fryserom B)</label>
                      <input
                        value={insSubjectLabel}
                        onChange={(e) => setInsSubjectLabel(e.target.value)}
                        disabled={insFormLocked}
                        className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                        placeholder="Beskriv objektet"
                      />
                    </div>
                  )}
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Omfang / notater</label>
                    <textarea
                      value={insScope}
                      onChange={(e) => setInsScope(e.target.value)}
                      rows={3}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                </div>
              </div>
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Kort oppsummering av funn pluss én rad per konkret avvik — hver rad kan få egen status og Kanban-oppgave ved låsing.
                  </p>
                </div>
                <div className={TASK_PANEL_INSET} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Funn (kort oppsummering)</label>
                    <textarea
                      value={insFindingsSummary}
                      onChange={(e) => setInsFindingsSummary(e.target.value)}
                      rows={2}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                  {!insFormLocked && (
                    <div className="flex flex-wrap gap-2 border border-neutral-200/80 bg-white p-3">
                      <input
                        value={newFindingText}
                        onChange={(e) => setNewFindingText(e.target.value)}
                        placeholder="Beskriv konkret avvik …"
                        className={`min-w-[200px] flex-1 ${SETTINGS_INPUT} bg-neutral-50`}
                      />
                      <button
                        type="button"
                        className={`${HERO_ACTION_CLASS} bg-neutral-800 text-white hover:bg-neutral-900`}
                        onClick={() => {
                          const t = newFindingText.trim()
                          if (!t) return
                          setFindingDrafts((d) => [...d, { id: crypto.randomUUID(), description: t, status: 'open' }])
                          setNewFindingText('')
                        }}
                      >
                        + Registrer konkret avvik
                      </button>
                    </div>
                  )}
                  {findingDrafts.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {findingDrafts.map((f) => (
                        <li key={f.id} className="flex flex-col gap-2 border border-neutral-200 bg-white p-3 sm:flex-row sm:items-start">
                          {insFormLocked ? (
                            <div className="min-w-0 flex-1">
                              <p className="text-neutral-900">{f.description}</p>
                              <p className="mt-1 text-xs text-neutral-500">
                                Status: {f.status === 'resolved' ? 'Løst' : 'Åpen'}
                              </p>
                              {f.photoDataUrl ? (
                                <img src={f.photoDataUrl} alt="" className="mt-2 max-h-24 border border-neutral-200" />
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <textarea
                                value={f.description}
                                onChange={(e) =>
                                  setFindingDrafts((rows) =>
                                    rows.map((x) => (x.id === f.id ? { ...x, description: e.target.value } : x)),
                                  )
                                }
                                className={`min-h-[60px] flex-1 ${SETTINGS_INPUT} bg-neutral-50`}
                              />
                              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-40">
                                <label className={SETTINGS_FIELD_LABEL}>Status</label>
                                <select
                                  value={f.status ?? 'open'}
                                  onChange={(e) =>
                                    setFindingDrafts((rows) =>
                                      rows.map((x) =>
                                        x.id === f.id
                                          ? { ...x, status: e.target.value as InspectionFinding['status'] }
                                          : x,
                                      ),
                                    )
                                  }
                                  className={`${SETTINGS_INPUT} bg-white text-xs`}
                                >
                                  <option value="open">Åpen</option>
                                  <option value="resolved">Løst</option>
                                </select>
                                <label className={`${SETTINGS_FIELD_LABEL} cursor-pointer`}>
                                  <span className="inline-flex items-center gap-1">
                                    <ImagePlus className="size-3.5" /> Bilde
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (!file) return
                                      const reader = new FileReader()
                                      reader.onload = () => {
                                        const url = typeof reader.result === 'string' ? reader.result : undefined
                                        setFindingDrafts((rows) =>
                                          rows.map((x) => (x.id === f.id ? { ...x, photoDataUrl: url } : x)),
                                        )
                                      }
                                      reader.readAsDataURL(file)
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-700`}
                                  onClick={() => setFindingDrafts((rows) => rows.filter((x) => x.id !== f.id))}
                                >
                                  Fjern
                                </button>
                              </div>
                              {f.photoDataUrl ? (
                                <img src={f.photoDataUrl} alt="" className="max-h-24 rounded border border-neutral-200" />
                              ) : null}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Last opp bilder av forhold eller offisiell PDF ved ekstern inspeksjon. Filer lagres under organisasjonens mappe i Supabase Storage når klient er konfigurert.
                  </p>
                </div>
                <div className={TASK_PANEL_INSET}>
                  <label className={SETTINGS_FIELD_LABEL}>Vedlegg</label>
                  {!insFormLocked && (
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files) : []
                        setInsFileQueue((q) => [...q, ...files])
                        e.target.value = ''
                      }}
                      className="mt-2 block w-full text-sm text-neutral-600"
                    />
                  )}
                  {insFileQueue.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                      {insFileQueue.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-red-600 hover:underline"
                            onClick={() => setInsFileQueue((q) => q.filter((_, j) => j !== i))}
                          >
                            Fjern
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {panelInspection && (panelInspection.attachments ?? []).length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-neutral-200/80 pt-3 text-xs">
                      <li className={SETTINGS_FIELD_LABEL}>Lagrede vedlegg</li>
                      {(panelInspection.attachments ?? []).map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-left text-[#1a3d32] underline"
                            onClick={() => void openSavedInspectionAttachment(a)}
                          >
                            {a.fileName}
                          </button>
                          <span className="text-neutral-400">({a.kind})</span>
                          {!insFormLocked && insDraftId && (
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => hse.removeInspectionAttachment(insDraftId, a.id)}
                            >
                              Fjern
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className={TASK_PANEL_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>
                    Ansvarlig kobles til ansattlisten slik at oppfølgingsoppgaver kan tildeles riktig person på Kanban.
                  </p>
                </div>
                <div className={TASK_PANEL_INSET} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Ansvarlig (ansatt)</label>
                    <select
                      value={insResponsibleEmployeeId}
                      onChange={(e) => setInsResponsibleEmployeeId(e.target.value)}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <option value="">Velg ansatt …</option>
                      {employeePickList.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.unitName ? ` — ${e.unitName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Oppfølging</label>
                    <textarea
                      value={insFollowUp}
                      onChange={(e) => setInsFollowUp(e.target.value)}
                      rows={2}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL}>Status</label>
                    <select
                      value={insStatus}
                      onChange={(e) => setInsStatus(e.target.value as Inspection['status'])}
                      disabled={insFormLocked}
                      className={`${SETTINGS_INPUT} bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <option value="open">Åpen</option>
                      <option value="closed">Lukket / fullført (klar for låsing)</option>
                    </select>
                  </div>
                </div>
              </div>

              {panelInspection && (
                <div className={`${R_FLAT} mx-4 mb-4 border border-neutral-200 bg-white p-4 md:mx-5`}>
                  <span className="text-xs font-semibold text-neutral-800">Protokollsignatur (underveis)</span>
                  <ul className="mt-2 space-y-1 text-xs text-neutral-700">
                    {(panelInspection.protocolSignatures ?? []).map((s, i) => {
                      const l1 = formatLevel1AuditLine(s.level1)
                      return (
                        <li key={`${s.signedAt}-${i}`} className="whitespace-pre-line">
                          {s.role === 'inspector' ? 'Inspektør' : s.role === 'verneombud' ? 'Verneombud' : 'Ledelse'}:{' '}
                          {s.signerName} — {formatWhen(s.signedAt)}
                          {l1 ? `\n${l1}` : ''}
                        </li>
                      )
                    })}
                  </ul>
                  {!insFormLocked && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        value={protoRole}
                        onChange={(e) => setProtoRole(e.target.value as HseProtocolSignature['role'])}
                        className={`${SETTINGS_INPUT} w-auto bg-neutral-50 text-xs`}
                      >
                        <option value="inspector">Inspektør</option>
                        <option value="verneombud">Verneombud</option>
                        <option value="management">Ledelse</option>
                      </select>
                      <input
                        value={protoName}
                        onChange={(e) => setProtoName(e.target.value)}
                        placeholder="Navn"
                        className={`${SETTINGS_INPUT} min-w-[140px] flex-1 bg-neutral-50 text-xs`}
                      />
                      <button
                        type="button"
                        className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white`}
                        onClick={() => {
                          if (!insDraftId) return
                          void (async () => {
                            if (await hse.signInspectionProtocol(insDraftId, protoName, protoRole)) setProtoName('')
                          })()
                        }}
                      >
                        Signer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {panelInspection?.closureSignature && (
                <div className={`${R_FLAT} mx-4 mb-4 border border-emerald-200 bg-emerald-50/80 p-4 text-xs md:mx-5`}>
                  <span className="font-semibold text-emerald-900">Låsesignatur (nivå 1)</span>
                  <p className="mt-1 whitespace-pre-line text-emerald-950">
                    {panelInspection.closureSignature.signerName} — {formatWhen(panelInspection.closureSignature.signedAt)}
                    {formatLevel1AuditLine(panelInspection.closureSignature.level1)
                      ? `\n${formatLevel1AuditLine(panelInspection.closureSignature.level1)}`
                      : ''}
                  </p>
                </div>
              )}

              {panelInspection && !insFormLocked && panelInspection.status === 'closed' && (
                <div className="mx-4 mb-4 space-y-2 rounded-none border border-amber-200/80 bg-amber-50/50 p-4 text-sm md:mx-5">
                  <p className="text-xs text-neutral-700">
                    Lås rapporten: skrivebeskyttelse, nivå 1-signatur i logg, og Kanban-oppgaver for åpne avvik (
                    <code className="text-[10px]">hse_inspection_finding</code>).
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <label className={SETTINGS_FIELD_LABEL}>Signer som inspektør (fullt navn)</label>
                      <input
                        value={finalizeName}
                        onChange={(e) => setFinalizeName(e.target.value)}
                        placeholder={profile?.display_name ?? ''}
                        className={`${SETTINGS_INPUT} bg-white text-sm`}
                      />
                    </div>
                    <button
                      type="button"
                      className={`${HERO_ACTION_CLASS} bg-emerald-800 text-white hover:bg-emerald-900`}
                      onClick={() => {
                        if (!insDraftId) return
                        const nm = finalizeName.trim() || profile?.display_name?.trim()
                        if (!nm) {
                          window.alert('Fyll inn navn for signatur.')
                          return
                        }
                        void (async () => {
                          const r = await hse.finalizeInspectionClose(insDraftId, nm)
                          if (!r.ok) return
                          const links: { findingId: string; taskId: string }[] = []
                          for (const s of r.seeds) {
                            const t = addTask({ ...s.task, status: 'todo' })
                            links.push({ findingId: s.findingId, taskId: t.id })
                          }
                          if (links.length) hse.linkInspectionFindingTasks(insDraftId, links)
                          setFinalizeName('')
                        })()
                      }}
                    >
                      Lås og opprett oppgaver
                    </button>
                  </div>
                </div>
              )}

              {panelInspection && (
                <div className="mx-4 mb-6 md:mx-5">
                  <AddTaskLink
                    title={`Oppfølging inspeksjon: ${panelInspection.title.slice(0, 60)}`}
                    description={panelInspection.followUp || panelInspection.findings?.slice(0, 200)}
                    module="hse"
                    sourceType="hse_inspection"
                    sourceId={panelInspection.id}
                    sourceLabel={panelInspection.title}
                    ownerRole={panelInspection.responsible || 'Ansvarlig'}
                    className={`${HERO_ACTION_CLASS} inline-flex gap-1.5 border border-neutral-300 bg-white text-xs text-[#1a3d32]`}
                  />
                </div>
              )}

              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-neutral-200 px-5 py-4">
                <button
                  type="button"
                  onClick={closeInspectionPanel}
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                >
                  {insFormLocked ? 'Lukk' : 'Avbryt'}
                </button>
                {!insFormLocked && (
                  <button
                    type="submit"
                    className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                  >
                    Lagre inspeksjon
                  </button>
                )}
              </div>
            </form>
          </aside>
        </>
      )}
    </>
  )
}


// ─── Sub-components ────────────────────────────────────────────────────────────

type HseSeg = { label: string; value: number; color: string }

function hseConicGradient(segments: HseSeg[], total: number): string {
  if (total <= 0 || segments.length === 0) {
    return 'conic-gradient(#e5e7eb 0deg 360deg)'
  }
  const parts: string[] = []
  let from = 0
  for (const s of segments) {
    if (s.value <= 0) continue
    const deg = (s.value / total) * 360
    const to = from + deg
    parts.push(`${s.color} ${from}deg ${to}deg`)
    from = to
  }
  if (parts.length === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)'
  return `conic-gradient(${parts.join(', ')})`
}

function HseDonutChart({ segments, total }: { segments: HseSeg[]; total: number }) {
  const bg = hseConicGradient(segments, total)
  return (
    <div
      className="relative mx-auto size-36 shrink-0 rounded-full"
      style={{ background: bg }}
      aria-hidden
    >
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-2xl font-bold tabular-nums text-neutral-900">{total}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Totalt</span>
      </div>
    </div>
  )
}

function HseDonutCard({
  title,
  subtitle,
  segments,
  total,
  emptyHint,
}: {
  title: string
  subtitle: string
  segments: HseSeg[]
  total: number
  emptyHint: string
}) {
  return (
    <div className={HSE_INSIGHT_CARD}>
      <div className={HSE_CARD_TOP_RULE} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-400">{emptyHint}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <HseDonutChart segments={segments} total={total} />
          <ul className="min-w-0 flex-1 space-y-2 text-sm">
            {segments.map((s) => {
              const pct = total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0
              return (
                <li key={s.label} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-neutral-700">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {s.value}{' '}
                    <span className="text-neutral-400">({pct}%)</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function HseFilledListCard({
  title,
  subtitle,
  rows,
  emptyHint,
}: {
  title: string
  subtitle: string
  rows: HseSeg[]
  emptyHint: string
}) {
  return (
    <div className={HSE_INSIGHT_CARD}>
      <div className={HSE_CARD_TOP_RULE} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">{emptyHint}</p>
      ) : (
        <ul className="mt-4 max-h-52 space-y-0 overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="truncate font-medium text-neutral-800">{r.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SjaTableRow({
  sja,
  deptLabel,
  rowClass,
  cellClass,
  onOpen,
}: {
  sja: SjaAnalysis
  deptLabel: string
  rowClass: string
  cellClass: string
  onOpen: () => void
}) {
  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="max-w-[220px] font-medium text-neutral-900">{sja.title}</div>
      </td>
      <td className={`${cellClass} text-neutral-600`}>{formatWhen(sja.plannedAt)}</td>
      <td className={cellClass}>
        <div>{sja.location}</div>
        <div className="text-xs text-neutral-500">{deptLabel}</div>
      </td>
      <td className={cellClass}>{sja.rows.length}</td>
      <td className={cellClass}>
        <span className={`${R_FLAT} border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium`}>
          {SJA_STATUS_LABELS[sja.status]}
        </span>
      </td>
      <td className={`${cellClass} text-right`}>
        <button type="button" onClick={onOpen} className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}>
          Åpne
        </button>
      </td>
    </tr>
  )
}

function SickLeaveTableRow({
  sc,
  rowClass,
  cellClass,
  onOpen,
}: {
  sc: SickLeaveCase
  rowClass: string
  cellClass: string
  onOpen: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = sc.milestones.filter((m) => !m.completedAt && m.dueAt < today).length
  const upcoming = sc.milestones.filter((m) => !m.completedAt && m.dueAt >= today).length
  const done = sc.milestones.filter((m) => m.completedAt).length
  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="max-w-[200px] font-medium text-neutral-900">{sc.employeeName}</div>
      </td>
      <td className={cellClass}>
        <span className={`${R_FLAT} border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs`}>
          {SL_ABSENCE_LABELS[sc.absenceType ?? 'medical_certificate']}
        </span>
      </td>
      <td className={`${cellClass} text-neutral-600`}>{formatDate(sc.sickFrom)}</td>
      <td className={cellClass}>{sc.department || '—'}</td>
      <td className={cellClass}>{sc.managerName || '—'}</td>
      <td className={`${cellClass} text-xs text-neutral-600`}>
        {done} fullført · {overdue} forfalt · {upcoming} åpne
      </td>
      <td className={cellClass}>
        <span className={`${R_FLAT} border px-2 py-0.5 text-xs font-medium ${SICK_STATUS_COLOURS[sc.status]}`}>
          {SICK_STATUS_LABELS[sc.status]}
        </span>
      </td>
      <td className={`${cellClass} text-right`}>
        <button type="button" onClick={onOpen} className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}>
          Åpne
        </button>
      </td>
    </tr>
  )
}

function InspectionTableRow({
  ins,
  rowClass,
  cellClass,
  actionStyle = 'button',
  onOpen,
}: {
  ins: Inspection
  rowClass: string
  cellClass: string
  actionStyle?: 'button' | 'icon'
  onOpen: () => void
}) {
  const org = useOrganisation()

  function formatWhenLocal(iso: string) {
    try {
      return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  const unitName =
    ins.subjectUnitId && ins.subjectKind === 'org_unit'
      ? org.units.find((u) => u.id === ins.subjectUnitId)?.name
      : null
  const subjectBits = [unitName, ins.subjectLabel].filter(Boolean)
  const openFindings = (ins.concreteFindings ?? []).filter((f) => f.status === 'open').length

  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="max-w-[220px] font-medium text-neutral-900">{ins.title}</div>
        {subjectBits.length > 0 && (
          <div className="mt-0.5 text-xs text-neutral-500">{subjectBits.join(' · ')}</div>
        )}
      </td>
      <td className={cellClass}>
        <span className={`${R_FLAT} inline-block border border-neutral-200 px-2 py-0.5 text-xs`}>
          {INSPECTION_KIND_LABEL[ins.kind]}
        </span>
      </td>
      <td className={cellClass}>{formatWhenLocal(ins.conductedAt)}</td>
      <td className={cellClass}>{ins.responsible || '—'}</td>
      <td className={cellClass}>
        {(ins.concreteFindings ?? []).length > 0 ? (
          <span>
            {openFindings} åpne / {(ins.concreteFindings ?? []).length} totalt
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={cellClass}>
        {ins.locked ? (
          <span className={`${R_FLAT} inline-flex items-center gap-1 border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900`}>
            <Lock className="size-3" /> Låst
          </span>
        ) : ins.status === 'closed' ? (
          <span className={`${R_FLAT} inline-block border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900`}>
            Lukket
          </span>
        ) : (
          <span className={`${R_FLAT} inline-block border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-900`}>
            Åpen
          </span>
        )}
      </td>
      <td className={`${cellClass} text-right`}>
        {actionStyle === 'icon' ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Åpne"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
          >
            Åpne
          </button>
        )}
      </td>
    </tr>
  )
}

function SafetyRoundTableRow({
  round,
  templates,
  rowClass,
  cellClass,
  actionStyle = 'button',
  onOpen,
}: {
  round: SafetyRound
  templates: ChecklistTemplate[]
  rowClass: string
  cellClass: string
  /** `icon` — som Table 1 (Postings) i layout-komponisten */
  actionStyle?: 'button' | 'icon'
  onOpen: () => void
}) {
  const tpl = templates.find((t) => t.id === (round.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID))
  const issueCount = (tpl?.items ?? []).filter((it) => round.items[it.id] === 'issue').length
  const statusBadge =
    {
      in_progress: { label: 'Pågår', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
      pending_verneombud: { label: 'Signering', cls: 'border-amber-300 bg-amber-50 text-amber-950' },
      pending_approval: { label: 'Signering', cls: 'border-amber-300 bg-amber-50 text-amber-950' },
      approved: { label: 'Låst', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
    }[round.status] ?? { label: round.status, cls: 'border-neutral-200 bg-neutral-50 text-neutral-700' }
  const isPlanned = round.scheduleKind === 'planned'
  const plannedUpcoming = isPlanned && isSafetyRoundUpcoming(round)

  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="max-w-[240px] font-medium text-neutral-900">{round.title}</div>
        {round.seriesId ? (
          <div className="mt-0.5 text-xs text-neutral-500">Serie · hver {round.seriesIntervalWeeks ?? '?'} uke(r)</div>
        ) : null}
      </td>
      <td className={cellClass}>
        <div className="text-neutral-800">{round.location}</div>
        {round.department ? <div className="text-xs text-neutral-500">{round.department}</div> : null}
      </td>
      <td className={cellClass}>
        {isPlanned ? (
          <div className="flex flex-col gap-1">
            <span
              className={`${R_FLAT} inline-block w-fit border px-2 py-0.5 text-xs font-medium ${
                plannedUpcoming ? 'border-violet-300 bg-violet-50 text-violet-950' : 'border-neutral-300 bg-neutral-50 text-neutral-700'
              }`}
            >
              {plannedUpcoming ? 'Planlagt' : 'Planlagt (dato passert)'}
            </span>
            <span className={`${R_FLAT} inline-block w-fit border px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
        ) : (
          <span className={`${R_FLAT} inline-block border px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        )}
      </td>
      <td className={`${cellClass} text-neutral-600`}>
        {isPlanned && round.plannedAt ? (
          <>
            <div className="font-medium text-neutral-800">Plan: {formatWhen(round.plannedAt)}</div>
            <div className="text-xs text-neutral-500">Registrert: {formatWhen(round.conductedAt)}</div>
          </>
        ) : (
          formatWhen(round.conductedAt)
        )}
      </td>
      <td className={cellClass}>
        {issueCount > 0 ? (
          <span className={`${R_FLAT} inline-flex items-center gap-1 border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900`}>
            <AlertTriangle className="size-3" />
            {issueCount}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">0</span>
        )}
      </td>
      <td className={`${cellClass} text-right`}>
        {actionStyle === 'icon' ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Åpne"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        ) : (
          <button type="button" onClick={onOpen} className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}>
            Åpne
          </button>
        )}
      </td>
    </tr>
  )
}

function SafetyRoundCard({
  round,
  templates,
  hse,
  addTask,
}: {
  round: SafetyRound
  templates: ChecklistTemplate[]
  hse: ReturnType<typeof useHse>
  addTask: ReturnType<typeof useTasks>['addTask']
}) {
  const checklist = useMemo(() => {
    const tpl = templates.find((t) => t.id === (round.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID))
    return tpl?.items ?? []
  }, [templates, round.checklistTemplateId])
  const isLocked = round.status === 'approved'
  const issueItems = checklist.filter((item) => round.items[item.id] === 'issue')

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return iso }
  }

  const statusBadge =
    {
      in_progress: { label: 'Pågår', cls: 'bg-sky-100 text-sky-800' },
      pending_verneombud: { label: 'Venter verneombud', cls: 'bg-amber-100 text-amber-800' },
      pending_approval: { label: 'Venter på godkjenning', cls: 'bg-amber-100 text-amber-800' },
      approved: { label: 'Godkjent', cls: 'bg-emerald-100 text-emerald-800' },
    }[round.status] ?? { label: round.status, cls: 'bg-neutral-100 text-neutral-700' }

  const hasMgmtSig = (round.signatures ?? []).some((s) => s.role === 'management')
  const hasVoSig = (round.signatures ?? []).some((s) => s.role === 'safety_rep')

  return (
    <div className={`${R_FLAT} border bg-white ${isLocked ? 'border-emerald-200' : 'border-neutral-200/90'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 px-1 py-4 sm:px-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{round.title}</h3>
            <span className={`${R_FLAT} px-2.5 py-0.5 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
            {isLocked && <Lock className="size-3.5 text-emerald-600" />}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {round.location}
            {round.department ? ` · ${round.department}` : ''}
          </p>
          <p className="text-xs text-neutral-400">{fmtDate(round.conductedAt)}</p>
        </div>
        {issueItems.length > 0 && (
          <span className={`${R_FLAT} inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900`}>
            <AlertTriangle className="size-3.5" />
            {issueItems.length} avvik
          </span>
        )}
      </div>

      <div className="px-1 py-4 sm:px-2">
        <div className={`${R_FLAT} mb-4 border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-950`}>
          <strong>Handlingsplan (IK-f § 5 nr. 7):</strong> Når runden er ferdig signert av både leder og verneombud, opprettes én oppgave per avvik på Kanban-tavlen automatisk. Du kan også opprette oppgaver manuelt underveis.
        </div>
        <div className={`${R_FLAT} mb-4 border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800`}>
          <strong>Avvik i vernerunde</strong> = potensielle farer under runden. Meld ulykker og vold under <strong>Hendelser</strong>.
        </div>

        <ul className="space-y-2">
          {checklist.map((item) => {
            const st = round.items[item.id] ?? 'na'
            const detail = (round.itemDetails ?? {})[item.id]
            const isIssue = st === 'issue'
            return (
              <li key={item.id} className={`${R_FLAT} border ${isIssue ? 'border-amber-200 bg-amber-50/50' : 'border-neutral-100 bg-[#faf8f4]'}`}>
                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-sm text-neutral-900">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">{item.lawRef}</span>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => hse.setChecklistStatus(round.id, item.id, 'ok')}
                      className={`${R_FLAT} px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        st === 'ok' ? 'bg-emerald-600 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => hse.setChecklistStatus(round.id, item.id, 'issue')}
                      className={`${R_FLAT} px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        st === 'issue' ? 'bg-amber-500 text-amber-950' : 'border border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                      }`}
                    >
                      Registrer avvik
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => hse.setChecklistStatus(round.id, item.id, 'na')}
                      className={`${R_FLAT} px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      Ikke relevant
                    </button>
                  </div>
                </div>

                {/* Inline avvik detail panel — appears only when 'Avvik' is selected */}
                {isIssue && (
                  <div className="border-t border-amber-200 bg-amber-50 px-3 pb-3 pt-3 space-y-3">
                    <p className="text-xs font-semibold text-amber-900">Avviksdetaljer</p>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-medium text-neutral-600">Beskriv avviket *</label>
                      <textarea
                        value={detail?.description ?? ''}
                        onChange={(e) => !isLocked && hse.setChecklistItemDetail(round.id, item.id, { description: e.target.value })}
                        disabled={isLocked}
                        rows={2}
                        placeholder="Hva ble observert? Angi omfang og plassering…"
                        className={`${SETTINGS_INPUT} mt-1 border-amber-200 bg-white focus:border-amber-400 disabled:opacity-60`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-neutral-600">Bilde / vedlegg</label>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {detail?.photoUrl ? (
                          <div className="relative">
                            <img src={detail.photoUrl} alt="Avvik" className={`${R_FLAT} h-20 w-24 object-cover ring-1 ring-amber-200`} />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => hse.setChecklistItemDetail(round.id, item.id, { photoUrl: undefined })}
                                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-xs"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ) : !isLocked ? (
                          <label className={`${R_FLAT} flex cursor-pointer items-center gap-1.5 border border-dashed border-amber-300 bg-white px-3 py-2 text-xs text-amber-700 hover:bg-amber-50`}>
                            <ImagePlus className="size-4" />
                            Legg til bilde
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const reader = new FileReader()
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    hse.setChecklistItemDetail(round.id, item.id, { photoUrl: reader.result })
                                  }
                                }
                                reader.readAsDataURL(file)
                              }}
                            />
                          </label>
                        ) : (
                          <span className="text-xs text-neutral-400">Ingen bilde</span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Tildel oppgave til</label>
                        <input
                          value={detail?.assignee ?? ''}
                          onChange={(e) => !isLocked && hse.setChecklistItemDetail(round.id, item.id, { assignee: e.target.value })}
                          disabled={isLocked}
                          placeholder="Navn / rolle"
                          className={`${SETTINGS_INPUT} mt-1 border-amber-200 bg-white disabled:opacity-60`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Frist</label>
                        <input
                          type="date"
                          value={detail?.dueDate ?? ''}
                          onChange={(e) => !isLocked && hse.setChecklistItemDetail(round.id, item.id, { dueDate: e.target.value })}
                          disabled={isLocked}
                          className={`${SETTINGS_INPUT} mt-1 border-amber-200 bg-white disabled:opacity-60`}
                        />
                      </div>
                    </div>

                    {!isLocked && (detail?.assignee || detail?.description) && (
                      <AddTaskLink
                        title={`Avvik: ${item.label.slice(0, 60)}`}
                        description={detail?.description?.slice(0, 200)}
                        module="hse"
                        sourceType="hse_safety_round"
                        sourceId={round.id}
                        sourceLabel={`${round.title} — ${item.label}`}
                        ownerRole={detail?.assignee || 'Verneombud'}
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-4">
          <label className="text-xs font-medium text-neutral-500">Generelle notater fra runden</label>
          <textarea
            value={round.notes}
            onChange={(e) => !isLocked && hse.updateSafetyRound(round.id, { notes: e.target.value })}
            disabled={isLocked}
            rows={3}
            className={`${SETTINGS_INPUT} mt-1 disabled:opacity-60`}
          />
        </div>
      </div>

      <div className="border-t border-neutral-100 px-1 py-4 sm:px-2">
        {!isLocked && (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-neutral-800">Klar for signering (AML § 3-1)</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Signatur bruker innlogget bruker (nivå 1). Begge roller må signere med hver sin brukerkonto. Runden låses når begge er på plass; åpne avvik sendes til Kanban.
              </p>
            </div>
            <button
              type="button"
              disabled={
                round.status !== 'in_progress' ||
                issueItems.some((i) => !round.itemDetails?.[i.id]?.description?.trim())
              }
              onClick={() => hse.submitRoundForApproval(round.id)}
              className={`${HERO_ACTION_CLASS} inline-flex items-center gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26] disabled:opacity-40`}
              title={
                issueItems.some((i) => !round.itemDetails?.[i.id]?.description?.trim())
                  ? 'Fyll inn beskrivelse for alle avvik først'
                  : undefined
              }
            >
              <Send className="size-4" />
              Send til signering
            </button>
          </div>
        )}

        {(round.status === 'pending_verneombud' || round.status === 'pending_approval') && (
          <div className="mt-4 space-y-4">
            <div className={`${R_FLAT} border border-amber-200 bg-amber-50 px-4 py-3`}>
              <p className="text-sm font-semibold text-amber-900">Venter på to signaturer</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Sendt: {round.submittedForApprovalAt ? fmtDate(round.submittedForApprovalAt) : '—'} · Leder og verneombud må signere hver for seg.
              </p>
            </div>
            <SafetyRoundSignPanel
              label="Signer som leder (arbeidsgiver)"
              signed={hasMgmtSig}
              onSign={async () => {
                const r = await hse.signSafetyRound(round.id, 'management')
                if (r.ok && r.seeds.length) {
                  for (const t of r.seeds) {
                    addTask(t)
                  }
                }
              }}
            />
            <SafetyRoundSignPanel
              label="Signer som verneombud"
              signed={hasVoSig}
              onSign={async () => {
                const r = await hse.signSafetyRound(round.id, 'safety_rep')
                if (r.ok && r.seeds.length) {
                  for (const t of r.seeds) {
                    addTask(t)
                  }
                }
              }}
            />
          </div>
        )}

        {isLocked && (round.signatures?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-900">Signaturer (nivå 1)</p>
            {(round.signatures ?? []).map((s) => (
              <div key={`${s.role}-${s.signedAt}`} className={`${R_FLAT} flex flex-wrap items-start gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3`}>
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {s.role === 'management' ? 'Leder' : 'Verneombud'}: {s.signerName}
                  </p>
                  <p className="whitespace-pre-line text-xs text-emerald-800">
                    {fmtDate(s.signedAt)}
                    {formatLevel1AuditLine(s.level1) ? `\n${formatLevel1AuditLine(s.level1)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SafetyRoundSignPanel({
  label,
  signed,
  onSign,
}: {
  label: string
  signed: boolean
  onSign: () => Promise<void>
}) {
  const { user, profile } = useOrgSetupContext()
  const [busy, setBusy] = useState(false)
  const display = profile?.display_name?.trim() || user?.email?.trim() || 'Innlogget bruker'

  if (signed) {
    return (
      <div className={`${R_FLAT} border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900`}>
        <strong>{label}:</strong> registrert.
      </div>
    )
  }

  return (
    <div className={`${R_FLAT} border border-neutral-200 bg-white p-4`}>
      <p className="text-sm font-semibold text-neutral-900">{label}</p>
      <p className="mt-1 text-xs text-neutral-500">
        Signerer som: <span className="font-medium text-neutral-800">{display}</span>
      </p>
      <button
        type="button"
        disabled={busy || !user}
        onClick={() => {
          void (async () => {
            setBusy(true)
            try {
              await onSign()
            } finally {
              setBusy(false)
            }
          })()
        }}
        className={`${HERO_ACTION_CLASS} mt-3 inline-flex items-center gap-2 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40`}
      >
        <CheckCircle2 className="size-4" />
        {busy ? 'Signerer…' : 'Signer og godkjenn'}
      </button>
      {!user ? <p className="mt-2 text-xs text-red-700">Du må være innlogget for å signere.</p> : null}
    </div>
  )
}
