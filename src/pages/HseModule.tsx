import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileWarning,
  GraduationCap,
  HardHat,
  History,
  ImagePlus,
  ListChecks,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useHse } from '../hooks/useHse'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { canEditIncidentRootCause, canViewIncident } from '../lib/incidentAccess'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import { formatLevel1AuditLine } from '../lib/level1Signature'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { SAFETY_ROUND_TEMPLATE_ID, TRAINING_KIND_LABELS } from '../data/hseTemplates'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeIncidentWizard, makeSickLeaveWizard, makeSjaWizard, makeSafetyRoundWizard } from '../components/wizard/wizards'
import type {
  ChecklistTemplate,
  HseProtocolSignature,
  Incident,
  IncidentCategory,
  IncidentFormTemplate,
  Inspection,
  InspectionAttachment,
  InspectionFinding,
  InspectionSubjectKind,
  IncidentEvidencePhoto,
  SafetyRound,
  SjaAnalysis,
  SjaHazardRow,
  SickLeaveCase,
  SickLeaveMilestoneKind,
  TrainingKind,
} from '../types/hse'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
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
const HSE_INCIDENT_BUCKET = 'hse_incident_files'
/** Offisielt meldingsskjema (ekstern) — AML § 5-2 veiledning */
const ARBEIDSTILSYNET_MELDING_URL = 'https://www.arbeidstilsynet.no/skjema/meldingsskjema/'
const ROUND_DRAFT_STORAGE_KEY = 'atics-hse-new-round-draft-v1'
/** Same strip boxes as rapporter / organisasjonsinnsikt */
const HSE_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const HSE_INSIGHT_CARD =
  `${R_FLAT} flex flex-col border border-neutral-200/90 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:shadow`
const HSE_CARD_TOP_RULE = 'mb-4 h-0.5 w-full shrink-0 bg-[#1a3d32]'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'overview'   as const, label: 'Oversikt',           icon: HardHat       },
  { id: 'rounds'     as const, label: 'Vernerunder',         icon: ListChecks    },
  { id: 'inspections'as const, label: 'Inspeksjoner',        icon: Search        },
  { id: 'incidents'  as const, label: 'Hendelser',           icon: ShieldAlert   },
  { id: 'sja'        as const, label: 'SJA',                 icon: ShieldCheck   },
  { id: 'training'   as const, label: 'Opplæring',           icon: GraduationCap },
  { id: 'sickness'   as const, label: 'Sykefravær',          icon: Users         },
  { id: 'aml'        as const, label: 'AML & verneombud',    icon: BookOpen      },
  { id: 'audit'      as const, label: 'Revisjonslogg',       icon: History       },
]

// ─── Label helpers ─────────────────────────────────────────────────────────────

const KIND_LABELS: Record<Incident['kind'], string> = {
  incident: 'Ulykke / skade',
  near_miss: 'Nestenulykke',
  dangerous_cond: 'Farlige forhold',
  violence: 'Vold',
  threat: 'Trussel',
  deviation: 'Avvik',
}

const KIND_COLOURS: Record<Incident['kind'], string> = {
  incident: 'bg-red-100 text-red-800',
  near_miss: 'bg-amber-100 text-amber-800',
  dangerous_cond: 'bg-orange-100 text-orange-900',
  violence: 'bg-red-200 text-red-900',
  threat: 'bg-orange-200 text-orange-950',
  deviation: 'bg-neutral-100 text-neutral-700',
}

const SEVERITY_COLOURS: Record<Incident['severity'], string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-700 text-white',
}

const SEVERITY_LABELS: Record<Incident['severity'], string> = {
  low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
}

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  physical_injury: 'Fysisk skade',
  psychological: 'Psykisk / psykososialt',
  property_damage: 'Materiell skade',
  fire_explosion: 'Brann / eksplosjon',
  chemical: 'Kjemikalier / HMSK',
  ergonomic: 'Ergonomi',
  other: 'Annet',
}

const STATUS_LABELS: Record<Incident['status'], string> = {
  reported: 'Meldt',
  investigating: 'Under utredning',
  action_pending: 'Tiltak pågår',
  closed: 'Lukket',
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

// ─── Form templates — dynamic fields ─────────────────────────────────────────

const FORM_TEMPLATES: { id: IncidentFormTemplate; label: string; showViolenceFields: boolean }[] = [
  { id: 'standard',        label: 'Standard',                        showViolenceFields: false },
  { id: 'violence_school', label: 'Vold og trusler — skole',         showViolenceFields: true  },
  { id: 'violence_health', label: 'Vold og trusler — helse/omsorg',  showViolenceFields: true  },
  { id: 'deviation',       label: 'Avvik fra intern rutine',         showViolenceFields: false },
]

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
  const { supabaseConfigured, supabase, organization, profile, user, isAdmin, departments } = useOrgSetupContext()
  const org = useOrganisation()
  const { addTask } = useTasks()
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const [searchParams] = useSearchParams()
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId = tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'

  const [roundSearch, setRoundSearch] = useState('')
  const [roundPanelId, setRoundPanelId] = useState<string | null>(null)
  const [roundDraft, setRoundDraft] = useState({
    templateId: 'tpl-standard',
    title: '',
    conductedAt: '',
    location: '',
    department: '',
    notes: '',
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

  const [incSearch, setIncSearch] = useState('')
  const [incPanelKind, setIncPanelKind] = useState<Incident['kind']>('incident')
  const [incPanelCategory, setIncPanelCategory] = useState<IncidentCategory>('physical_injury')
  const [incPanelFormTemplate, setIncPanelFormTemplate] = useState<IncidentFormTemplate>('standard')
  const [incPanelSeverity, setIncPanelSeverity] = useState<Incident['severity']>('medium')
  const [incPanelOccurredAt, setIncPanelOccurredAt] = useState('')
  const [incPanelLocation, setIncPanelLocation] = useState('')
  const [incPanelDepartmentId, setIncPanelDepartmentId] = useState('')
  const [incPanelDescription, setIncPanelDescription] = useState('')
  const [incPanelExperienceDetail, setIncPanelExperienceDetail] = useState('')
  const [incPanelWitnesses, setIncPanelWitnesses] = useState('')
  const [incPanelInjuredPerson, setIncPanelInjuredPerson] = useState('')
  const [incPanelImmediateActions, setIncPanelImmediateActions] = useState('')
  const [incPanelRootCause, setIncPanelRootCause] = useState('')
  const [incPanelReportedByEmployeeId, setIncPanelReportedByEmployeeId] = useState('')
  const [incPanelNearestLeaderEmployeeId, setIncPanelNearestLeaderEmployeeId] = useState('')
  const [incPanelStatus, setIncPanelStatus] = useState<Incident['status']>('reported')
  const [incPanelRouteVerneombud, setIncPanelRouteVerneombud] = useState(false)
  const [incPanelRouteAMU, setIncPanelRouteAMU] = useState(false)
  const [incPanelArbeidstilsynetNotified, setIncPanelArbeidstilsynetNotified] = useState(false)
  const [incPanelEvidenceQueue, setIncPanelEvidenceQueue] = useState<File[]>([])
  const [incPanelExistingPhotos, setIncPanelExistingPhotos] = useState<IncidentEvidencePhoto[]>([])
  const [incFollowTaskTitle, setIncFollowTaskTitle] = useState('')
  const [incFollowDueDate, setIncFollowDueDate] = useState('')

  // Sick leave form
  const [slForm, setSlForm] = useState({
    employeeName: '',
    department: '',
    managerName: '',
    sickFrom: '',
    sicknessDegree: '100',
    returnDate: '',
    status: 'active' as SickLeaveCase['status'],
    consentRecorded: false,
  })

  // SJA form
  const [sjaForm, setSjaForm] = useState({ title: '', jobDescription: '', location: '', department: '', plannedAt: '', conductedBy: '', participants: '' })
  const [sjaPanelId, setSjaPanelId] = useState<string | null>(null)
  const [sjaPanelRowDraft, setSjaPanelRowDraft] = useState<Omit<SjaHazardRow, 'id'>>({
    step: '',
    hazard: '',
    consequence: '',
    existingControls: '',
    additionalMeasures: '',
    responsible: '',
  })
  const [sjaPanelSig, setSjaPanelSig] = useState<{ signerName: string; role: SjaAnalysis['signatures'][0]['role'] }>({
    signerName: '',
    role: 'foreman',
  })

  // Training form
  const [trainingForm, setTrainingForm] = useState({ employeeName: '', department: '', role: '', trainingKind: 'hms_40hr' as TrainingKind, customLabel: '', completedAt: '', expiresAt: '', provider: '', certificateRef: '' })

  // GDPR + export
  const [exportMsg, setExportMsg] = useState('')
  /** Stable anchor for «siste 90 dager» (unngår Date.now() under render). */
  const [overviewTimeAnchor] = useState(() => Date.now())

  // Expanded incident detail
  const [incidentPanelId, setIncidentPanelId] = useState<string | null>(null)
  const [slPanelId, setSlPanelId] = useState<string | null>(null)
  const [slPanelMsg, setSlPanelMsg] = useState('')
  const [slPanelRole, setSlPanelRole] = useState<SickLeaveCase['portalMessages'][0]['senderRole']>('manager')
  const [slPanelName, setSlPanelName] = useState('')
  const [trainingPanelId, setTrainingPanelId] = useState<string | null>(null)
  // Corrective action draft
  const [caDraft, setCaDraft] = useState<Record<string, { description: string; responsible: string; dueDate: string }>>({})

  const sortedAudit = useMemo(() => [...hse.auditTrail].sort((a, b) => a.at.localeCompare(b.at)), [hse.auditTrail])

  const incidentPanelExisting =
    incidentPanelId && incidentPanelId !== '__new__' ? hse.incidents.find((i) => i.id === incidentPanelId) : undefined
  const sjaPanelSja = sjaPanelId ? hse.sjaAnalyses.find((s) => s.id === sjaPanelId) : undefined
  const slPanelCase = slPanelId ? hse.sickLeaveCases.find((s) => s.id === slPanelId) : undefined
  const trainingPanelRec = trainingPanelId ? hse.trainingRecords.find((r) => r.id === trainingPanelId) : undefined

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

  const resetIncidentPanelForm = useCallback(() => {
    setIncPanelKind('incident')
    setIncPanelCategory('physical_injury')
    setIncPanelFormTemplate('standard')
    setIncPanelSeverity('medium')
    setIncPanelOccurredAt('')
    setIncPanelLocation('')
    setIncPanelDepartmentId('')
    setIncPanelDescription('')
    setIncPanelExperienceDetail('')
    setIncPanelWitnesses('')
    setIncPanelInjuredPerson('')
    setIncPanelImmediateActions('')
    setIncPanelRootCause('')
    setIncPanelReportedByEmployeeId('')
    setIncPanelNearestLeaderEmployeeId('')
    setIncPanelStatus('reported')
    setIncPanelRouteVerneombud(false)
    setIncPanelRouteAMU(false)
    setIncPanelArbeidstilsynetNotified(false)
    setIncPanelEvidenceQueue([])
    setIncPanelExistingPhotos([])
    setIncFollowTaskTitle('')
    setIncFollowDueDate('')
  }, [])

  const closeIncidentPanel = useCallback(() => {
    setIncidentPanelId(null)
    resetIncidentPanelForm()
  }, [resetIncidentPanelForm])

  const openNewIncidentPanel = useCallback(() => {
    resetIncidentPanelForm()
    setIncidentPanelId('__new__')
    const selfEmp = viewerEmployeeId ? org.displayEmployees.find((e) => e.id === viewerEmployeeId) : undefined
    if (selfEmp) {
      setIncPanelReportedByEmployeeId(selfEmp.id)
      if (selfEmp.reportsToId) setIncPanelNearestLeaderEmployeeId(selfEmp.reportsToId)
    }
  }, [resetIncidentPanelForm, viewerEmployeeId, org.displayEmployees])

  const openEditIncidentPanel = useCallback(
    (inc: Incident) => {
      if (!canViewIncident(inc, incidentViewerCtx)) return
      setIncidentPanelId(inc.id)
      setIncPanelKind(inc.kind)
      setIncPanelCategory(inc.category)
      setIncPanelFormTemplate(inc.formTemplate)
      setIncPanelSeverity(inc.severity)
      setIncPanelOccurredAt(isoToDatetimeLocal(inc.occurredAt))
      setIncPanelLocation(inc.location)
      setIncPanelDepartmentId(inc.departmentId ?? '')
      setIncPanelDescription(inc.description)
      setIncPanelExperienceDetail(inc.experienceDetail ?? '')
      setIncPanelWitnesses(inc.witnesses ?? '')
      setIncPanelInjuredPerson(inc.injuredPerson ?? '')
      setIncPanelImmediateActions(inc.immediateActions)
      setIncPanelRootCause(inc.rootCause ?? '')
      setIncPanelReportedByEmployeeId(inc.reportedByEmployeeId ?? '')
      setIncPanelNearestLeaderEmployeeId(inc.nearestLeaderEmployeeId ?? '')
      setIncPanelStatus(inc.status)
      setIncPanelRouteVerneombud(inc.routing?.verneombudNotified ?? false)
      setIncPanelRouteAMU(inc.routing?.amuCaseCreated ?? false)
      setIncPanelArbeidstilsynetNotified(inc.arbeidstilsynetNotified ?? false)
      setIncPanelEvidenceQueue([])
      setIncPanelExistingPhotos(inc.evidencePhotos ?? [])
      setIncFollowTaskTitle('')
      setIncFollowDueDate('')
    },
    [incidentViewerCtx],
  )
  const closeSjaPanel = useCallback(() => {
    setSjaPanelId(null)
    setSjaPanelRowDraft({
      step: '',
      hazard: '',
      consequence: '',
      existingControls: '',
      additionalMeasures: '',
      responsible: '',
    })
    setSjaPanelSig({ signerName: '', role: 'foreman' })
  }, [])
  const closeSlPanel = useCallback(() => {
    setSlPanelId(null)
    setSlPanelMsg('')
    setSlPanelRole('manager')
    setSlPanelName('')
  }, [])

  const closeTrainingPanel = useCallback(() => setTrainingPanelId(null), [])

  useEffect(() => {
    if (!incidentPanelId && !sjaPanelId && !slPanelId && !trainingPanelId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [incidentPanelId, sjaPanelId, slPanelId, trainingPanelId])

  useEffect(() => {
    if (!incidentPanelId && !sjaPanelId && !slPanelId && !trainingPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeIncidentPanel()
        closeSjaPanel()
        closeSlPanel()
        closeTrainingPanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [incidentPanelId, sjaPanelId, slPanelId, trainingPanelId, closeIncidentPanel, closeSjaPanel, closeSlPanel, closeTrainingPanel])

  const inspectionStats = useMemo(() => {
    const list = hse.inspections
    return {
      total: list.length,
      open: list.filter((i) => i.status === 'open' && !i.locked).length,
      closedUnlocked: list.filter((i) => i.status === 'closed' && !i.locked).length,
      locked: list.filter((i) => i.locked).length,
    }
  }, [hse.inspections])

  const roundStats = useMemo(() => {
    const list = hse.safetyRounds
    return {
      total: list.length,
      inProgress: list.filter((r) => r.status === 'in_progress').length,
      pending: list.filter((r) => r.status === 'pending_verneombud' || r.status === 'pending_approval').length,
      approved: list.filter((r) => r.status === 'approved').length,
      withIssues: list.filter((r) => Object.values(r.items).some((v) => v === 'issue')).length,
    }
  }, [hse.safetyRounds])

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
    list.sort((a, b) => b.conductedAt.localeCompare(a.conductedAt))
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
    if (!roundPanelId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [roundPanelId])

  useEffect(() => {
    if (!roundPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRoundPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roundPanelId, closeRoundPanel])

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

  const incidentStats = useMemo(() => {
    const list = hse.incidents.filter((i) => canViewIncident(i, incidentViewerCtx))
    return {
      total: list.length,
      open: list.filter((i) => i.status !== 'closed').length,
      critical: list.filter((i) => i.severity === 'critical').length,
      high: list.filter((i) => i.severity === 'high').length,
    }
  }, [hse.incidents, incidentViewerCtx])

  const incidentsFiltered = useMemo(() => {
    const q = incSearch.trim().toLowerCase()
    let list = hse.incidents.filter((i) => canViewIncident(i, incidentViewerCtx))
    if (q) {
      list = list.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q) ||
          (i.department ?? '').toLowerCase().includes(q) ||
          KIND_LABELS[i.kind].toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    return list
  }, [hse.incidents, incSearch, incidentViewerCtx])

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

  function departmentLabelForIncident(inc: Incident) {
    if (inc.departmentId) {
      const u = org.units.find((x) => x.id === inc.departmentId)
      if (u) return u.name
      const d = departments.find((x) => x.id === inc.departmentId)
      if (d) return d.name
    }
    return inc.department || '—'
  }

  function employeeLabelById(id: string) {
    const e = org.displayEmployees.find((x) => x.id === id)
    return e?.name ?? '—'
  }

  const uploadIncidentEvidence = useCallback(
    async (incidentId: string, file: File): Promise<IncidentEvidencePhoto | null> => {
      const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 120)
      const rel = `incidents/${incidentId}/${crypto.randomUUID()}-${safeName}`
      if (supabase && organization?.id) {
        const path = `${organization.id}/${rel}`
        const { error } = await supabase.storage.from(HSE_INCIDENT_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) {
          console.warn('hse_incident_files upload', error.message)
          return null
        }
        return { path, fileName: file.name, uploadedAt: new Date().toISOString() }
      }
      return { path: `local/${rel}`, fileName: file.name, uploadedAt: new Date().toISOString() }
    },
    [supabase, organization],
  )

  const openSavedIncidentPhoto = useCallback(
    async (p: IncidentEvidencePhoto) => {
      if (!supabase || p.path.startsWith('local/')) {
        window.alert('Kan ikke åpne bildet uten Supabase eller for lokale opplastinger.')
        return
      }
      const { data, error } = await supabase.storage.from(HSE_INCIDENT_BUCKET).createSignedUrl(p.path, 3600)
      if (error || !data?.signedUrl) {
        window.alert('Kunne ikke hente signert URL.')
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    },
    [supabase],
  )

  async function submitIncidentPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!incPanelDescription.trim()) return
    if (incidentPanelId === '__new__' && !incPanelDepartmentId) {
      window.alert('Velg avdeling/enhet fra listen (påkrevd for nye hendelser).')
      return
    }
    const occurredIso = incPanelOccurredAt ? new Date(incPanelOccurredAt).toISOString() : new Date().toISOString()
    const deptName = incPanelDepartmentId
      ? departmentSelectOptions.find((o) => o.value === incPanelDepartmentId)?.label ?? ''
      : ''
    const reporterName = incPanelReportedByEmployeeId
      ? employeeLabelById(incPanelReportedByEmployeeId)
      : profile?.display_name?.trim() || user?.email?.trim() || '—'
    const leaderName = incPanelNearestLeaderEmployeeId ? employeeLabelById(incPanelNearestLeaderEmployeeId) : ''
    const routing =
      leaderName.trim() || reporterName.trim() || incPanelRouteVerneombud || incPanelRouteAMU
        ? {
            managerName: leaderName.trim() || reporterName.trim() || '—',
            verneombudNotified: incPanelRouteVerneombud,
            amuCaseCreated: incPanelRouteAMU,
            routedAt: new Date().toISOString(),
          }
        : undefined

    const evidence: IncidentEvidencePhoto[] = [...incPanelExistingPhotos]
    if (incidentPanelId && incidentPanelId !== '__new__') {
      for (const f of incPanelEvidenceQueue) {
        const row = await uploadIncidentEvidence(incidentPanelId, f)
        if (row) evidence.push(row)
      }
    }

    const base: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'> = {
      kind: incPanelKind,
      category: incPanelCategory,
      formTemplate: incPanelFormTemplate,
      severity: incPanelSeverity,
      occurredAt: occurredIso,
      location: incPanelLocation.trim() || '—',
      departmentId: incPanelDepartmentId || undefined,
      department: deptName || incPanelDepartmentId || '',
      description: incPanelDescription.trim(),
      experienceDetail: incPanelExperienceDetail.trim() || undefined,
      witnesses: incPanelWitnesses.trim() || undefined,
      injuredPerson: incPanelInjuredPerson.trim() || undefined,
      immediateActions: incPanelImmediateActions.trim(),
      rootCause: incPanelRootCause.trim() || undefined,
      correctiveActions: [],
      reportedBy: reporterName,
      reportedByEmployeeId: incPanelReportedByEmployeeId || undefined,
      nearestLeaderEmployeeId: incPanelNearestLeaderEmployeeId || undefined,
      status: incPanelStatus,
      routing,
      arbeidstilsynetNotified: incPanelArbeidstilsynetNotified,
      evidencePhotos: evidence,
    }

    if (incidentPanelId === '__new__') {
      const created = hse.createIncident({ ...base, evidencePhotos: [] })
      const uploaded: IncidentEvidencePhoto[] = []
      for (const f of incPanelEvidenceQueue) {
        const row = await uploadIncidentEvidence(created.id, f)
        if (row) uploaded.push(row)
      }
      if (uploaded.length) hse.updateIncident(created.id, { evidencePhotos: uploaded })
      closeIncidentPanel()
      return
    }

    const editId = incidentPanelId
    if (!editId || editId === '__new__') return
    const existing = hse.incidents.find((x) => x.id === editId)
    if (!existing) return
    hse.updateIncident(editId, {
      ...base,
      createdByUserId: existing.createdByUserId,
      evidencePhotos: evidence,
    })
    closeIncidentPanel()
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
    for (const k of Object.keys(KIND_LABELS) as Incident['kind'][]) counts[k] = 0
    for (const i of hse.incidents) {
      if (!canViewIncident(i, incidentViewerCtx)) continue
      counts[i.kind] = (counts[i.kind] ?? 0) + 1
    }
    const palette = ['#1a3d32', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#0d9488']
    const entries = (Object.keys(KIND_LABELS) as Incident['kind'][])
      .map((k, idx) => ({
        label: KIND_LABELS[k],
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
    <div className={PAGE_WRAP}>
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">Prosjekter</Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">HMS / verneombud</span>
      </nav>

      {hse.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hse.error}</p>
      )}
      {hse.loading && supabaseConfigured && (
        <p className="mb-4 text-sm text-neutral-500">Laster HMS-data…</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            HMS & verneombud
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Vernerunder, inspeksjoner, hendelsesregistrering (inkl. vold og trusler), sykefraværsoppfølging og
            revisjonslogg. Støtteverktøy — verifiser mot{' '}
            <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">lovdata.no</a>.
          </p>
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            const tb = menu1.tabButton(active)
            return (
              <Link key={id} to={`?tab=${id}`} className={tb.className} style={tb.style}>
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
                {id === 'incidents' && hse.stats.violence > 0 && (
                  <span className="ml-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{hse.stats.violence}</span>
                )}
                {id === 'sja' && hse.stats.openSja > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{hse.stats.openSja}</span>
                )}
                {id === 'training' && hse.stats.expiredTraining > 0 && (
                  <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{hse.stats.expiredTraining}</span>
                )}
                {id === 'sickness' && hse.stats.overdueMilestones > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{hse.stats.overdueMilestones}</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Overview — boxed layout som rapporter / innsikt + grafer ─────────── */}
      {tab === 'overview' && (
        <div className="mt-6 space-y-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hseOverviewKpis.map((item) => (
              <div key={item.title} className={HSE_THRESHOLD_BOX} style={menu1.barStyle}>
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
                  <Link to="?tab=incidents" className="hover:underline">
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

      {/* ── Safety rounds (samme mønster som inspeksjoner) ───────────────────── */}
      {tab === 'rounds' && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Vernerunder
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Velg mal — sjekklisten lastes inn med én gang. Registrer avvik per punkt (bilde + kommentar). Ved signering (leder + verneombud, nivå 1) låses runden og åpne avvik sendes til Kanban-tavlen. Utkast lagres lokalt i nettleseren til du oppretter runden (støtte for arbeid uten nett).
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Totalt <strong className="ml-1 font-semibold">{roundStats.total}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
                  Pågår <strong className="ml-1 font-semibold">{roundStats.inProgress}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                  Signering <strong className="ml-1 font-semibold">{roundStats.pending}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-900`}>
                  Låst <strong className="ml-1 font-semibold">{roundStats.approved}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-rose-50 text-rose-900 ring-1 ring-rose-200`}>
                  Med avvik <strong className="ml-1 font-semibold">{roundStats.withIssues}</strong>
                </span>
                <button
                  type="button"
                  onClick={openNewRoundPanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny vernerunde
                </button>
                <WizardButton
                  label="Veiviser"
                  variant="solid"
                  className={HERO_ACTION_CLASS}
                  def={makeSafetyRoundWizard(
                    (data) => {
                      const sr = hse.createSafetyRound({
                        title: String(data.title),
                        conductedAt: new Date(String(data.conductedAt)).toISOString(),
                        location: String(data.location) || '—',
                        department: String(data.department) || undefined,
                        conductedBy:
                          profile?.display_name?.trim() || user?.email?.trim() || 'Registrert bruker',
                        notes: String(data.notes) || '',
                        checklistTemplateId: String(data.templateId) || SAFETY_ROUND_TEMPLATE_ID,
                      })
                      openRoundPanel(sr.id)
                    },
                    hse.checklistTemplates.map((t) => ({ value: t.id, label: t.name })),
                  )}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{roundStats.total}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Registrert</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{roundStats.inProgress}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Utfylling</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{roundStats.pending}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Venter signatur</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{roundStats.approved}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Arkiv</div>
            </div>
          </div>

          <Mainbox1
            title="Vernerunder"
            subtitle="Sortert etter gjennomføringstid. Åpne raden i sidevinduet for sjekkliste, avvik og dobbeltsignatur."
          >
            <Table1Shell
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor="round-search">
                        Søk
                      </label>
                      <input
                        id="round-search"
                        value={roundSearch}
                        onChange={(e) => setRoundSearch(e.target.value)}
                        placeholder="Søk i tittel, sted, avdeling …"
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
                      <th className={tableCell}>Lokasjon</th>
                      <th className={tableCell}>Status</th>
                      <th className={tableCell}>Gjennomført</th>
                      <th className={tableCell}>Avvik</th>
                      <th className={`${tableCell} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundsFiltered.map((sr, ri) => (
                      <SafetyRoundTableRow
                        key={sr.id}
                        round={sr}
                        templates={hse.checklistTemplates}
                        rowClass={table1BodyRowClass(layout, ri)}
                        cellClass={tableCell}
                        onOpen={() => openRoundPanel(sr.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {roundsFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">Ingen runder matcher søket.</p>
              ) : null}
            </Table1Shell>
          </Mainbox1>

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

      {/* ── Inspections (Tasks / Organisasjon layout) ─────────────────────────── */}
      {tab === 'inspections' && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Inspeksjoner
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Registrer inspeksjoner med sporbar ansvarlig, inspeksjonsobjekt, konkrete avvik og vedlegg. Når status er lukket og du låser rapporten, opprettes Kanban-oppgaver per åpent avvik og dokumentet blir skrivebeskyttet.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Totalt <strong className="ml-1 font-semibold">{inspectionStats.total}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
                  Åpne <strong className="ml-1 font-semibold">{inspectionStats.open}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                  Lukket (utkast) <strong className="ml-1 font-semibold">{inspectionStats.closedUnlocked}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-900`}>
                  Låst <strong className="ml-1 font-semibold">{inspectionStats.locked}</strong>
                </span>
                <button
                  type="button"
                  onClick={openNewInspectionPanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny inspeksjon
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{inspectionStats.total}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Registrert</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{inspectionStats.open}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Pågår</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{inspectionStats.closedUnlocked}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Lukket — kan låses</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{inspectionStats.locked}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Arkiv (signert)</div>
            </div>
          </div>

          <Mainbox1 title="Tidligere inspeksjoner" subtitle="Sortert etter gjennomført tid. Åpne en rad i sidevinduet for redigering, signatur og låsing.">
            <Table1Shell
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor="ins-search">
                        Søk
                      </label>
                      <input
                        id="ins-search"
                        value={insSearch}
                        onChange={(e) => setInsSearch(e.target.value)}
                        placeholder="Søk i tittel, omfang, funn …"
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
                      <th className={tableCell}>Type</th>
                      <th className={tableCell}>Gjennomført</th>
                      <th className={tableCell}>Ansvarlig</th>
                      <th className={tableCell}>Avvik</th>
                      <th className={tableCell}>Status</th>
                      <th className={`${tableCell} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionsFiltered.map((ins, ri) => (
                      <InspectionTableRow
                        key={ins.id}
                        ins={ins}
                        rowClass={table1BodyRowClass(layout, ri)}
                        cellClass={tableCell}
                        onOpen={() => openEditInspectionPanel(ins)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {inspectionsFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">Ingen inspeksjoner matcher søket.</p>
              ) : null}
            </Table1Shell>
          </Mainbox1>
        </div>
      )}

      {/* ── Hendelser (samme mønster som inspeksjoner) ───────────────────────── */}
      {tab === 'incidents' && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Hendelser
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Registrering i sidevindu med strukturerte felt (avdeling, melder, leder), bildebevis i sikker lagring og
                tydelig varsel ved høy alvorlighetsgrad (AML § 5-2). Listen viser kun saker du har tilgang til (melder,
                valgt nærmeste leder, eller administrator).
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Synlige <strong className="ml-1 font-semibold">{incidentStats.total}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
                  Åpne <strong className="ml-1 font-semibold">{incidentStats.open}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                  Høy alvor <strong className="ml-1 font-semibold">{incidentStats.high}</strong>
                </span>
                <span className={`${HERO_ACTION_CLASS} bg-red-100 text-red-900`}>
                  Kritisk <strong className="ml-1 font-semibold">{incidentStats.critical}</strong>
                </span>
                <button
                  type="button"
                  onClick={openNewIncidentPanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny hendelse
                </button>
                <WizardButton
                  label="Veiviser"
                  variant="solid"
                  className={HERO_ACTION_CLASS}
                  def={makeIncidentWizard((data) => {
                    const kind = String(data.kind) as Incident['kind']
                    const ft = String(data.formTemplate) as IncidentFormTemplate
                    const leaderName = String(data.routeManager ?? '').trim()
                    const reportedByStr = String(data.reportedBy || '').trim()
                    const repEmp = org.displayEmployees.find(
                      (e) => e.name.trim().toLowerCase() === reportedByStr.toLowerCase(),
                    )
                    const leaderEmp = leaderName
                      ? org.displayEmployees.find((e) => e.name.trim().toLowerCase() === leaderName.toLowerCase())
                      : undefined
                    const created = hse.createIncident({
                      kind,
                      category: 'physical_injury',
                      formTemplate: ft,
                      severity: String(data.severity) as Incident['severity'],
                      occurredAt: data.occurredAt
                        ? new Date(String(data.occurredAt)).toISOString()
                        : new Date().toISOString(),
                      location: String(data.location) || '—',
                      department: String(data.department ?? ''),
                      departmentId: undefined,
                      description: String(data.description) || '',
                      experienceDetail: data.experienceDetail ? String(data.experienceDetail) : undefined,
                      injuredPerson: data.injuredPerson ? String(data.injuredPerson) : undefined,
                      immediateActions: String(data.immediateActions) || '',
                      reportedBy: repEmp?.name ?? (reportedByStr || '—'),
                      reportedByEmployeeId: repEmp?.id,
                      nearestLeaderEmployeeId: leaderEmp?.id,
                      status: String(data.status) as Incident['status'],
                      correctiveActions: [],
                      arbeidstilsynetNotified: Boolean(data.arbeidstilsynetNotified),
                      routing: leaderName
                        ? {
                            managerName: leaderEmp?.name ?? leaderName,
                            verneombudNotified: Boolean(data.routeVerneombud),
                            amuCaseCreated: Boolean(data.routeAMU),
                            routedAt: new Date().toISOString(),
                          }
                        : undefined,
                    })
                    openEditIncidentPanel(created)
                  })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{incidentStats.total}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">I din liste</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{incidentStats.open}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Ikke lukket</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{incidentStats.high}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Høy</div>
            </div>
            <div className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`} style={menu1.barStyle}>
              <div className="text-2xl font-semibold">{incidentStats.critical}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/85">Kritisk</div>
            </div>
          </div>

          <Mainbox1
            title="Hendelseslogg"
            subtitle="Sortert etter tidspunkt. Åpne en rad for full redigering, dokumentasjon og oppfølgingsoppgaver."
          >
            <Table1Shell
              toolbar={
                <Table1Toolbar
                  searchSlot={
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor="inc-search">
                        Søk
                      </label>
                      <input
                        id="inc-search"
                        value={incSearch}
                        onChange={(e) => setIncSearch(e.target.value)}
                        placeholder="Søk i beskrivelse, sted, type …"
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
                      <th className={tableCell}>Type / alvor</th>
                      <th className={tableCell}>Tidspunkt</th>
                      <th className={tableCell}>Sted / avdeling</th>
                      <th className={tableCell}>Melder</th>
                      <th className={tableCell}>Status</th>
                      <th className={`${tableCell} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentsFiltered.map((inc, ri) => (
                      <IncidentTableRow
                        key={inc.id}
                        inc={inc}
                        deptLabel={departmentLabelForIncident(inc)}
                        rowClass={table1BodyRowClass(layout, ri)}
                        cellClass={tableCell}
                        onOpen={() => {
                          openEditIncidentPanel(inc)
                          setCaDraft((d) => ({
                            ...d,
                            [inc.id]: d[inc.id] ?? { description: '', responsible: '', dueDate: '' },
                          }))
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {incidentsFiltered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
                  Ingen hendelser å vise (eller ingen treff i søk).
                </p>
              ) : null}
            </Table1Shell>
          </Mainbox1>
        </div>
      )}

      {/* ── SJA ──────────────────────────────────────────────────────────────── */}
      {tab === 'sja' && (
        <div className="mt-8 space-y-8">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-700">
              <strong>Sikker Jobb Analyse (SJA)</strong> er påkrevd for ikke-rutinepregede og høyrisikooperasjoner etter
              IK-forskriften §5 nr. 2 og AML §3-1. Analysen gjennomføres med berørte arbeidstakere <em>før</em> arbeidet starter.
            </p>
          </div>

          {/* New SJA form */}
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Ny SJA</h2>
              <WizardButton
                label="Veiviser"
                def={makeSjaWizard((data) => {
                  const sja = hse.createSja({
                    title: String(data.title), jobDescription: String(data.jobDescription),
                    location: String(data.location), department: String(data.department) || '',
                    plannedAt: data.plannedAt ? new Date(String(data.plannedAt)).toISOString() : new Date().toISOString(),
                    conductedBy: String(data.conductedBy), participants: String(data.participants) || '',
                    rows: [], status: 'draft', conclusion: '',
                  })
                  setSjaPanelId(sja.id)
                })}
              />
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!sjaForm.title.trim()) return
              const sja = hse.createSja({ title: sjaForm.title.trim(), jobDescription: sjaForm.jobDescription, location: sjaForm.location, department: sjaForm.department, plannedAt: sjaForm.plannedAt ? new Date(sjaForm.plannedAt).toISOString() : new Date().toISOString(), conductedBy: sjaForm.conductedBy, participants: sjaForm.participants, rows: [], status: 'draft', conclusion: '' })
              setSjaPanelId(sja.id)
              setSjaForm({ title: '', jobDescription: '', location: '', department: '', plannedAt: '', conductedBy: '', participants: '' })
            }}>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Arbeidsoperasjon / tittel *</label>
                <input value={sjaForm.title} onChange={(e) => setSjaForm((s) => ({ ...s, title: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Beskrivelse av jobben</label>
                <textarea value={sjaForm.jobDescription} onChange={(e) => setSjaForm((s) => ({ ...s, jobDescription: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Sted</label>
                <input value={sjaForm.location} onChange={(e) => setSjaForm((s) => ({ ...s, location: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Avdeling</label>
                <input value={sjaForm.department} onChange={(e) => setSjaForm((s) => ({ ...s, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Planlagt dato</label>
                <input type="datetime-local" value={sjaForm.plannedAt} onChange={(e) => setSjaForm((s) => ({ ...s, plannedAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Gjennomført av / arbeidsleder</label>
                <input value={sjaForm.conductedBy} onChange={(e) => setSjaForm((s) => ({ ...s, conductedBy: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Deltakere (navn, kommaseparert)</label>
                <input value={sjaForm.participants} onChange={(e) => setSjaForm((s) => ({ ...s, participants: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2">
                <ShieldCheck className="size-4" />
                Opprett SJA
              </button>
            </form>
          </section>

          {/* SJA list — redigering i sidevindu */}
          <div className="space-y-3">
            {hse.sjaAnalyses.length === 0 && <p className="text-center text-sm text-neutral-500 py-8">Ingen SJA-er registrert ennå.</p>}
            {hse.sjaAnalyses.map((sja) => {
              const stLabel = sja.status === 'draft' ? 'Utkast' : sja.status === 'approved' ? 'Godkjent' : 'Avsluttet'
              return (
                <div key={sja.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/90 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <span className="font-semibold text-neutral-900">{sja.title}</span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {sja.location}
                      {sja.department ? ` · ${sja.department}` : ''}
                    </span>
                    <div className="mt-1 text-xs text-neutral-500">
                      {sja.rows.length} fare-rad(er) · {stLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSjaPanelId(sja.id)
                      setSjaPanelRowDraft({
                        step: '',
                        hazard: '',
                        consequence: '',
                        existingControls: '',
                        additionalMeasures: '',
                        responsible: '',
                      })
                      setSjaPanelSig({ signerName: '', role: 'foreman' })
                    }}
                    className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                  >
                    Åpne
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Training register ─────────────────────────────────────────────────── */}
      {tab === 'training' && (
        <div className="mt-8 space-y-8">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-700">
              Lovpålagt opplæringsoversikt. Verneombud og ledere har krav på <strong>40 timers HMS-kurs</strong> (AML §3-5 og §6-5).
              Systemet varsler med rød badge når sertifiseringer er utløpt.
            </p>
          </div>

          {/* New training record form */}
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer opplæring</h2>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!trainingForm.employeeName.trim()) return
              hse.createTrainingRecord({ employeeName: trainingForm.employeeName.trim(), department: trainingForm.department, role: trainingForm.role, trainingKind: trainingForm.trainingKind, customLabel: trainingForm.customLabel || undefined, completedAt: trainingForm.completedAt || undefined, expiresAt: trainingForm.expiresAt || undefined, provider: trainingForm.provider || undefined, certificateRef: trainingForm.certificateRef || undefined })
              setTrainingForm((f) => ({ ...f, employeeName: '', certificateRef: '' }))
            }}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Ansatt navn *</label>
                <input value={trainingForm.employeeName} onChange={(e) => setTrainingForm((f) => ({ ...f, employeeName: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Avdeling</label>
                <input value={trainingForm.department} onChange={(e) => setTrainingForm((f) => ({ ...f, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Rolle / stilling</label>
                <input value={trainingForm.role} onChange={(e) => setTrainingForm((f) => ({ ...f, role: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Type opplæring</label>
                <select value={trainingForm.trainingKind} onChange={(e) => setTrainingForm((f) => ({ ...f, trainingKind: e.target.value as TrainingKind }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  {Object.entries(TRAINING_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {trainingForm.trainingKind === 'custom' && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-500">Egendefinert label</label>
                  <input value={trainingForm.customLabel} onChange={(e) => setTrainingForm((f) => ({ ...f, customLabel: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-neutral-500">Gjennomført dato</label>
                <input type="date" value={trainingForm.completedAt} onChange={(e) => setTrainingForm((f) => ({ ...f, completedAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Utløper dato</label>
                <input type="date" value={trainingForm.expiresAt} onChange={(e) => setTrainingForm((f) => ({ ...f, expiresAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Leverandør / kursholder</label>
                <input value={trainingForm.provider} onChange={(e) => setTrainingForm((f) => ({ ...f, provider: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Sertifikat / referansenr.</label>
                <input value={trainingForm.certificateRef} onChange={(e) => setTrainingForm((f) => ({ ...f, certificateRef: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2">
                <GraduationCap className="size-4" />
                Registrer opplæring
              </button>
            </form>
          </section>

          {/* Training matrix table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Opplæringsmatrise</h2>
            </div>
            {hse.trainingRecords.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen opplæringsrekorder ennå.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Ansatt</th>
                      <th className="px-4 py-3">Avdeling / Rolle</th>
                      <th className="px-4 py-3">Type opplæring</th>
                      <th className="px-4 py-3">Gjennomført</th>
                      <th className="px-4 py-3">Utløper</th>
                      <th className="px-4 py-3">Sertifikat</th>
                      <th className="px-4 py-3 text-right">Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {hse.trainingRecords.map((rec) => {
                      const today = new Date().toISOString().slice(0, 10)
                      const expired = rec.expiresAt && rec.expiresAt < today
                      const expiringSoon = rec.expiresAt && !expired && daysUntil(rec.expiresAt) <= 30
                      return (
                        <tr key={rec.id} className={expired ? 'bg-red-50' : expiringSoon ? 'bg-amber-50' : ''}>
                          <td className="px-4 py-3 font-medium text-neutral-900">{rec.employeeName}</td>
                          <td className="px-4 py-3 text-neutral-600">{rec.department}{rec.role ? ` · ${rec.role}` : ''}</td>
                          <td className="px-4 py-3 text-neutral-700">
                            {rec.trainingKind === 'custom' ? rec.customLabel : TRAINING_KIND_LABELS[rec.trainingKind]}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{rec.completedAt ? formatDate(rec.completedAt) : '—'}</td>
                          <td className="px-4 py-3">
                            {rec.expiresAt ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${expired ? 'bg-red-100 text-red-800' : expiringSoon ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
                                {expired ? 'Utløpt: ' : ''}{formatDate(rec.expiresAt)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500">{rec.certificateRef ?? '—'}</td>
                          <td className="px-4 py-3 text-right">
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
          </div>
        </div>
      )}

      {/* ── Sykefravær ────────────────────────────────────────────────────────── */}
      {tab === 'sickness' && (
        <div className="mt-8 space-y-8">
          {/* Confidentiality notice */}
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-sky-700" />
            <p className="text-sm text-sky-900">
              <strong>Taushetsbelagt sone.</strong> Sykefraværsdata og tilretteleggingsdialog er strengt
              adskilt fra avviksregistreringen. Kun leder og HR med tilgang ser disse postene. Alle visninger logges separat.{' '}
              <span className="text-xs">(AML §4-6, Personopplysningsloven §9)</span>
            </p>
          </div>

          {/* Overdue milestones alert */}
          {hse.stats.overdueMilestones > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                <strong>{hse.stats.overdueMilestones} forfalte lovpålagte milepæler</strong> — se sakene nedenfor og marker fullført.
              </p>
            </div>
          )}

          {/* New sick leave case form */}
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Ny sykefraværssak</h2>
                <p className="mt-0.5 text-sm text-neutral-600">Lovpålagte frister genereres automatisk (AML §4-6).</p>
              </div>
              <WizardButton
                label="Veiviser"
                def={makeSickLeaveWizard((data) => hse.createSickLeaveCase({
                  employeeName: String(data.employeeName),
                  department:   String(data.department) || '',
                  managerName:  String(data.managerName),
                  sickFrom:     String(data.sickFrom),
                  status:       String(data.status) as SickLeaveCase['status'],
                  sicknessDegree: Number(data.sicknessDegree) || 100,
                  accommodationNotes: '',
                  consentRecorded: Boolean(data.consentRecorded),
                }))}
              />
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!slForm.employeeName.trim() || !slForm.sickFrom) return
              hse.createSickLeaveCase({
                employeeName: slForm.employeeName.trim(),
                department: slForm.department,
                managerName: slForm.managerName,
                sickFrom: slForm.sickFrom,
                returnDate: slForm.returnDate || undefined,
                status: slForm.status,
                sicknessDegree: Number(slForm.sicknessDegree) || 100,
                accommodationNotes: '',
                consentRecorded: slForm.consentRecorded,
              })
              setSlForm({ employeeName: '', department: '', managerName: '', sickFrom: '', sicknessDegree: '100', returnDate: '', status: 'active', consentRecorded: false })
            }}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Ansatt navn</label>
                <input value={slForm.employeeName} onChange={(e) => setSlForm((s) => ({ ...s, employeeName: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Avdeling</label>
                <input value={slForm.department} onChange={(e) => setSlForm((s) => ({ ...s, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Nærmeste leder</label>
                <input value={slForm.managerName} onChange={(e) => setSlForm((s) => ({ ...s, managerName: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Sykemeldt fra</label>
                <input type="date" value={slForm.sickFrom} onChange={(e) => setSlForm((s) => ({ ...s, sickFrom: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Grad (%)</label>
                <input type="number" min={1} max={100} value={slForm.sicknessDegree} onChange={(e) => setSlForm((s) => ({ ...s, sicknessDegree: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Status</label>
                <select value={slForm.status} onChange={(e) => setSlForm((s) => ({ ...s, status: e.target.value as SickLeaveCase['status'] }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="active">Sykemeldt (100%)</option>
                  <option value="partial">Gradert sykemeldt</option>
                  <option value="returning">I retur</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={slForm.consentRecorded} onChange={(e) => setSlForm((s) => ({ ...s, consentRecorded: e.target.checked }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                  Samtykke til behandling av personopplysninger er registrert (GDPR)
                </label>
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2">
                <Calendar className="size-4" />
                Opprett sak og generer frister
              </button>
            </form>
          </section>

          {/* Active cases — detaljer i sidevindu */}
          <div className="space-y-4">
            {hse.sickLeaveCases.map((sc) => {
              const today = new Date().toISOString().slice(0, 10)
              const overdue = sc.milestones.filter((m) => !m.completedAt && m.dueAt < today)
              const upcoming = sc.milestones.filter((m) => !m.completedAt && m.dueAt >= today)
              const done = sc.milestones.filter((m) => m.completedAt)
              return (
                <div key={sc.id} className="rounded-2xl border border-neutral-200/90 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-neutral-900">{sc.employeeName}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SICK_STATUS_COLOURS[sc.status]}`}>
                          {SICK_STATUS_LABELS[sc.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {sc.sicknessDegree}% · {sc.department} · Sykemeldt fra {formatDate(sc.sickFrom)} · Leder: {sc.managerName}
                      </p>
                      <p className="mt-2 text-xs text-neutral-600">
                        Milepæler: {done.length} fullført · {overdue.length} forfalt · {upcoming.length} åpne
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlPanelId(sc.id)}
                      className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                    >
                      Åpne
                    </button>
                  </div>
                </div>
              )
            })}
            {hse.sickLeaveCases.length === 0 && (
              <p className="text-center text-sm text-neutral-500 py-8">Ingen sykefraværssaker registrert.</p>
            )}
          </div>
        </div>
      )}

      {/* ── AML ───────────────────────────────────────────────────────────────── */}
      {tab === 'aml' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Struktur etter arbeidsmiljøloven (oversikt)</h2>
            <p className="mt-2 text-sm text-neutral-600">Forenklet struktur for dokumentasjon og verneroller — tilpass til virksomhetens risikovurdering og bransje.</p>
            <ul className="mt-4 space-y-4">
              {hse.amlStructure.map((block) => (
                <li key={block.title} className="rounded-xl border border-neutral-100 bg-[#faf8f4] p-4">
                  <div className="font-medium text-neutral-900">{block.title}</div>
                  <div className="text-xs text-[#1a3d32]/90">{block.lawRef}</div>
                  <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
                    {block.points.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Audit log ─────────────────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="mt-8 space-y-6">

          {/* Export + GDPR controls */}
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Eksport og arkivverdighet</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Eksporter alle HMS-data til JSON for arkivering. Sykefraværsnotes og dialogmeldinger er automatisk
              fjernet fra eksporten (GDPR). For PDF-eksport, bruk nettleserens utskriftsfunksjon.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const json = hse.exportJson()
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `hse-export-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  setExportMsg('Eksport fullført — filen er lastet ned.')
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                <Download className="size-4" />
                Eksporter alle HSE-data (JSON)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Skriv ut / PDF
              </button>
            </div>
            {exportMsg && <p className="mt-2 text-sm text-emerald-700">{exportMsg}</p>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Streng revisjonslogg (append-only)</h2>
              <button type="button" onClick={() => { if (confirm('Tilbakestill HSE-demodata? Revisjonslogg regenereres.')) hse.resetDemo() }} className="text-xs text-neutral-500 hover:underline">
                Tilbakestill demo
              </button>
            </div>
            <ul className="max-h-[640px] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span>{formatWhen(a.at)}</span>
                    <span className="font-mono text-neutral-600">{a.action}</span>
                    <span>{a.entityType}</span>
                    <span className="truncate font-mono text-neutral-400">{a.entityId}</span>
                  </div>
                  <p className="mt-1 font-medium text-neutral-900">{a.summary}</p>
                  {a.detail && Object.keys(a.detail).length > 0 && (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-neutral-50 p-2 text-xs text-neutral-600">{JSON.stringify(a.detail, null, 0)}</pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Hendelse — sidevindu (skjema som inspeksjoner) */}
      {incidentPanelId ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeIncidentPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-[#f7f6f2] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {incidentPanelId === '__new__' ? 'Ny hendelse' : 'Rediger hendelse'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {KIND_LABELS[incPanelKind]} · {SEVERITY_LABELS[incPanelSeverity]}
                </p>
              </div>
              <button type="button" onClick={closeIncidentPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitIncidentPanel}>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className={`${SETTINGS_LEAD} mb-4 rounded-none border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600`}>
                  Personvern: unngå unødvendige helseopplysninger i bilder. Tilgang til saken er begrenset i appen til melder,
                  valgt nærmeste leder og administrator. Full rad-nivå RLS krever egen databasetabell for hendelser.
                </div>

                {(incPanelSeverity === 'high' || incPanelSeverity === 'critical') && (
                  <div className="mb-4 rounded-none border-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-950">
                    <p className="font-bold">OBS — AML § 5-2</p>
                    <p className="mt-1">
                      Ved <strong>alvorlig personskade eller dødsfall</strong> har arbeidsgiver plikt til å varsle{' '}
                      <strong>Arbeidstilsynet</strong> og <strong>politiet</strong> straks. Dette er ikke erstattet av
                      registrering i dette systemet.
                    </p>
                    <ul className="mt-2 list-inside list-disc text-xs">
                      <li>Sikre liv og helse — ring 113 ved behov.</li>
                      <li>Varsle nærmeste leder og verneombud.</li>
                      <li>Bruk Arbeidstilsynets offisielle meldingskanal uten opphold.</li>
                    </ul>
                    <a
                      href={ARBEIDSTILSYNET_MELDING_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-xs font-semibold text-red-900 underline"
                    >
                      Åpne Arbeidstilsynets meldingsskjema (ekstern lenke) →
                    </a>
                  </div>
                )}

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Mal og type</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>Velg skjemamal og hendelsestype.</p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <p className={SETTINGS_FIELD_LABEL}>Skjemamal</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {FORM_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setIncPanelFormTemplate(tpl.id)
                            setIncPanelKind(tpl.id === 'deviation' ? 'deviation' : tpl.showViolenceFields ? 'violence' : 'incident')
                          }}
                          className={`${R_FLAT} border px-3 py-1.5 text-xs font-medium ${
                            incPanelFormTemplate === tpl.id
                              ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                              : 'border-neutral-200 bg-white text-neutral-700'
                          }`}
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-kind">
                          Type hendelse
                        </label>
                        <select
                          id="inc-kind"
                          value={incPanelKind}
                          onChange={(e) => setIncPanelKind(e.target.value as Incident['kind'])}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        >
                          <option value="incident">Ulykke / skade</option>
                          <option value="near_miss">Nestenulykke</option>
                          <option value="dangerous_cond">Farlige forhold (AML §2-3)</option>
                          <option value="violence">Vold</option>
                          <option value="threat">Trussel</option>
                          <option value="deviation">Avvik</option>
                        </select>
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-severity">
                          Alvorlighetsgrad
                        </label>
                        <select
                          id="inc-severity"
                          value={incPanelSeverity}
                          onChange={(e) => setIncPanelSeverity(e.target.value as Incident['severity'])}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        >
                          <option value="low">Lav</option>
                          <option value="medium">Middels</option>
                          <option value="high">Høy</option>
                          <option value="critical">Kritisk</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-cat">
                        Kategori
                      </label>
                      <select
                        id="inc-cat"
                        value={incPanelCategory}
                        onChange={(e) => setIncPanelCategory(e.target.value as IncidentCategory)}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-when">
                        Tidspunkt
                      </label>
                      <input
                        id="inc-when"
                        type="datetime-local"
                        value={incPanelOccurredAt}
                        onChange={(e) => setIncPanelOccurredAt(e.target.value)}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Sted og avdeling</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>Avdeling velges fra organisasjonens enheter / avdelinger (felles nøkkel for rapporter).</p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-loc">
                        Sted
                      </label>
                      <input
                        id="inc-loc"
                        value={incPanelLocation}
                        onChange={(e) => setIncPanelLocation(e.target.value)}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-dept">
                        Avdeling / enhet {incidentPanelId === '__new__' ? '(påkrevd)' : ''}
                      </label>
                      <select
                        id="inc-dept"
                        value={incPanelDepartmentId}
                        onChange={(e) => {
                          const v = e.target.value
                          setIncPanelDepartmentId(v)
                          const emp = org.displayEmployees.find((x) => x.id === incPanelReportedByEmployeeId)
                          if (emp?.reportsToId && !incPanelNearestLeaderEmployeeId) {
                            setIncPanelNearestLeaderEmployeeId(emp.reportsToId)
                          }
                        }}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        required={incidentPanelId === '__new__'}
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
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Beskrivelse</h3>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-desc">
                      Hva skjedde? *
                    </label>
                    <textarea
                      id="inc-desc"
                      value={incPanelDescription}
                      onChange={(e) => setIncPanelDescription(e.target.value)}
                      rows={4}
                      required
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    />
                  </div>
                </div>

                {FORM_TEMPLATES.find((t) => t.id === incPanelFormTemplate)?.showViolenceFields ? (
                  <div className={TASK_PANEL_ROW_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Vold / trusler</h3>
                    </div>
                    <div className={TASK_PANEL_INSET}>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-exp">
                        Opplevelse / atferd
                      </label>
                      <textarea
                        id="inc-exp"
                        value={incPanelExperienceDetail}
                        onChange={(e) => setIncPanelExperienceDetail(e.target.value)}
                        rows={2}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      />
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-inj">
                            Berørt person
                          </label>
                          <input
                            id="inc-inj"
                            value={incPanelInjuredPerson}
                            onChange={(e) => setIncPanelInjuredPerson(e.target.value)}
                            className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                          />
                        </div>
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-wit">
                            Vitner
                          </label>
                          <input
                            id="inc-wit"
                            value={incPanelWitnesses}
                            onChange={(e) => setIncPanelWitnesses(e.target.value)}
                            className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Tiltak og rotårsak</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Umiddelbare tiltak kan omsettes til Kanban-oppgave. Rotårsak fylles av nærmeste leder / saksbehandler, ikke
                      nødvendigvis av melder.
                    </p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-imm">
                      Umiddelbare tiltak
                    </label>
                    <textarea
                      id="inc-imm"
                      value={incPanelImmediateActions}
                      onChange={(e) => setIncPanelImmediateActions(e.target.value)}
                      rows={3}
                      className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-ftitle">
                          Oppgavetittel
                        </label>
                        <input
                          id="inc-ftitle"
                          value={incFollowTaskTitle}
                          onChange={(e) => setIncFollowTaskTitle(e.target.value)}
                          placeholder="f.eks. Sperre av maskin / renhold"
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-fdue">
                          Frist
                        </label>
                        <input
                          id="inc-fdue"
                          type="date"
                          value={incFollowDueDate}
                          onChange={(e) => setIncFollowDueDate(e.target.value)}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!incPanelImmediateActions.trim()}
                      onClick={() => {
                        if (!incPanelImmediateActions.trim()) return
                        const title =
                          incFollowTaskTitle.trim() ||
                          `Oppfølging: ${KIND_LABELS[incPanelKind].slice(0, 40)}`
                        addTask({
                          title,
                          description: incPanelImmediateActions.trim(),
                          status: 'todo',
                          assignee: incPanelNearestLeaderEmployeeId
                            ? employeeLabelById(incPanelNearestLeaderEmployeeId)
                            : 'HMS',
                          assigneeEmployeeId: incPanelNearestLeaderEmployeeId || undefined,
                          dueDate: incFollowDueDate.trim() || '—',
                          module: 'hse',
                          sourceType: 'hse_incident',
                          sourceId: incidentPanelId !== '__new__' ? incidentPanelId : undefined,
                          sourceLabel: incPanelDescription.slice(0, 120),
                          ownerRole: 'HMS',
                          requiresManagementSignOff:
                            incPanelSeverity === 'high' || incPanelSeverity === 'critical',
                        })
                        setIncFollowTaskTitle('')
                        setIncFollowDueDate('')
                      }}
                      className={`${HERO_ACTION_CLASS} mt-3 border border-neutral-300 bg-white text-neutral-800 disabled:opacity-40`}
                    >
                      <Plus className="size-4" />
                      Opprett oppfølgingsoppgave
                    </button>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-root">
                        Rotårsak (saksbehandler)
                      </label>
                      <textarea
                        id="inc-root"
                        value={incPanelRootCause}
                        onChange={(e) => setIncPanelRootCause(e.target.value)}
                        rows={2}
                        disabled={
                          !incidentPanelExisting
                            ? true
                            : !canEditIncidentRootCause(incidentPanelExisting, incidentViewerCtx)
                        }
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white disabled:opacity-60`}
                      />
                      {incidentPanelExisting &&
                      !canEditIncidentRootCause(incidentPanelExisting, incidentViewerCtx) ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          Kun nærmeste leder (som er valgt på saken) eller administrator kan oppdatere rotårsak.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Melder og leder</h3>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-rep">
                          Meldt av (ansatt)
                        </label>
                        <select
                          id="inc-rep"
                          value={incPanelReportedByEmployeeId}
                          onChange={(e) => setIncPanelReportedByEmployeeId(e.target.value)}
                          className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                        >
                          <option value="">Velg …</option>
                          {employeePickList.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.unitName ? ` — ${e.unitName}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-lead">
                          Nærmeste leder (varsles / oppfølging)
                        </label>
                        <select
                          id="inc-lead"
                          value={incPanelNearestLeaderEmployeeId}
                          onChange={(e) => setIncPanelNearestLeaderEmployeeId(e.target.value)}
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
                    <p className="mt-2 text-xs text-neutral-500">
                      Navn på melder settes automatisk fra valgt ansatt. Leder kan forhåndsvelges fra organisasjonsdata.
                    </p>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="inc-status">
                        Status
                      </label>
                      <select
                        id="inc-status"
                        value={incPanelStatus}
                        onChange={(e) => setIncPanelStatus(e.target.value as Incident['status'])}
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white`}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Automatisk ruting</h3>
                  </div>
                  <div className={`${TASK_PANEL_INSET} space-y-3`}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={incPanelRouteVerneombud}
                        onChange={(e) => setIncPanelRouteVerneombud(e.target.checked)}
                        className="size-4 rounded border-neutral-300"
                      />
                      Varsle verneombud
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={incPanelRouteAMU}
                        onChange={(e) => setIncPanelRouteAMU(e.target.checked)}
                        className="size-4 rounded border-neutral-300"
                      />
                      Opprett AMU-sak
                    </label>
                    {(incPanelSeverity === 'high' || incPanelSeverity === 'critical') && (
                      <label className="flex items-center gap-2 text-sm text-red-800">
                        <input
                          type="checkbox"
                          checked={incPanelArbeidstilsynetNotified}
                          onChange={(e) => setIncPanelArbeidstilsynetNotified(e.target.checked)}
                          className="size-4 rounded border-red-300"
                        />
                        Bekreftet at Arbeidstilsynet/politiet er varslet etter behov (intern kontroll)
                      </label>
                    )}
                  </div>
                </div>

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Bildebevis</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>Dra og slipp bilder (skadested / utstyr). Lagres i bucket «hse_incident_files».</p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <label
                      className={`${R_FLAT} flex min-h-[100px] cursor-pointer flex-col items-center justify-center border-2 border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-600`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
                        setIncPanelEvidenceQueue((q) => [...q, ...files])
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = [...(e.target.files ?? [])]
                          setIncPanelEvidenceQueue((q) => [...q, ...files])
                        }}
                      />
                      Slipp bilder her eller klikk for å velge
                    </label>
                    {incPanelExistingPhotos.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs">
                        {incPanelExistingPhotos.map((p) => (
                          <li key={p.path} className="flex flex-wrap items-center gap-2">
                            <span className="truncate">{p.fileName}</span>
                            <button
                              type="button"
                              className="text-[#1a3d32] underline"
                              onClick={() => void openSavedIncidentPhoto(p)}
                            >
                              Åpne
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {incPanelEvidenceQueue.length > 0 ? (
                      <p className="mt-2 text-xs text-neutral-600">
                        {incPanelEvidenceQueue.length} fil(er) klare for opplasting ved lagring.
                      </p>
                    ) : null}
                  </div>
                </div>

                {incidentPanelExisting ? (
                  <div className="border-b border-neutral-200 px-4 py-4 md:px-5">
                    <p className={SETTINGS_FIELD_LABEL}>Korrigerende tiltak</p>
                    {incidentPanelExisting.correctiveActions.map((a) => (
                      <div key={a.id} className="mt-2 flex items-start gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            hse.updateIncident(incidentPanelExisting.id, {
                              correctiveActions: incidentPanelExisting.correctiveActions.map((x) =>
                                x.id === a.id
                                  ? { ...x, completedAt: x.completedAt ? undefined : new Date().toISOString() }
                                  : x,
                              ),
                            })
                          }
                          className={`mt-0.5 shrink-0 ${a.completedAt ? 'text-emerald-600' : 'text-neutral-300'}`}
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                        <div className={a.completedAt ? 'text-neutral-400 line-through' : ''}>
                          {a.description} — <span className="text-neutral-500">{a.responsible}</span> · frist{' '}
                          {formatDate(a.dueDate)}
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const ca = caDraft[incidentPanelExisting.id] ?? { description: '', responsible: '', dueDate: '' }
                      return (
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <input
                            placeholder="Tiltak"
                            value={ca.description}
                            onChange={(e) =>
                              setCaDraft((d) => ({
                                ...d,
                                [incidentPanelExisting.id]: { ...ca, description: e.target.value },
                              }))
                            }
                            className={`${SETTINGS_INPUT} bg-neutral-50 text-xs`}
                          />
                          <input
                            placeholder="Ansvarlig"
                            value={ca.responsible}
                            onChange={(e) =>
                              setCaDraft((d) => ({
                                ...d,
                                [incidentPanelExisting.id]: { ...ca, responsible: e.target.value },
                              }))
                            }
                            className={`${SETTINGS_INPUT} bg-neutral-50 text-xs`}
                          />
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={ca.dueDate}
                              onChange={(e) =>
                                setCaDraft((d) => ({
                                  ...d,
                                  [incidentPanelExisting.id]: { ...ca, dueDate: e.target.value },
                                }))
                              }
                              className={`${SETTINGS_INPUT} min-w-0 flex-1 bg-neutral-50 text-xs`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!ca.description.trim() || !ca.dueDate) return
                                hse.addCorrectiveAction(incidentPanelExisting.id, ca)
                                setCaDraft((d) => ({
                                  ...d,
                                  [incidentPanelExisting.id]: { description: '', responsible: '', dueDate: '' },
                                }))
                              }}
                              className={`${HERO_ACTION_CLASS} shrink-0 bg-[#1a3d32] text-white`}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : null}

                {incidentPanelExisting ? (
                  <div className="flex flex-wrap gap-2 px-4 py-4 md:px-5">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Anonymiser personopplysninger? Kan ikke angres.'))
                          hse.anonymiseIncident(incidentPanelExisting.id)
                      }}
                      className={`${HERO_ACTION_CLASS} border border-red-200 bg-red-50 text-red-800`}
                    >
                      <Trash2 className="size-3.5" />
                      Anonymiser (GDPR)
                    </button>
                    <AddTaskLink
                      title={`Oppfølging: ${KIND_LABELS[incidentPanelExisting.kind]}`}
                      description={incidentPanelExisting.description.slice(0, 200)}
                      module="hse"
                      sourceType="hse_incident"
                      sourceId={incidentPanelExisting.id}
                      sourceLabel={`${incidentPanelExisting.location} · ${SEVERITY_LABELS[incidentPanelExisting.severity]}`}
                      ownerRole="HMS / verneombud"
                      requiresManagementSignOff={
                        incidentPanelExisting.severity === 'high' ||
                        incidentPanelExisting.severity === 'critical'
                      }
                      className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-xs text-[#1a3d32]`}
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
                <button
                  type="button"
                  onClick={closeIncidentPanel}
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                >
                  Avbryt
                </button>
                <button type="submit" className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26]`}>
                  <FileWarning className="size-4" />
                  Lagre
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {/* SJA — sidevindu */}
      {sjaPanelId && sjaPanelSja ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeSjaPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{sjaPanelSja.title}</h2>
                <p className="text-xs text-neutral-500">
                  {sjaPanelSja.location}
                  {sjaPanelSja.department ? ` · ${sjaPanelSja.department}` : ''}
                </p>
              </div>
              <button type="button" onClick={closeSjaPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4">
                <label className={SETTINGS_FIELD_LABEL}>Status</label>
                <select
                  value={sjaPanelSja.status}
                  onChange={(e) =>
                    hse.updateSja(sjaPanelSja.id, { status: e.target.value as SjaAnalysis['status'] })
                  }
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                >
                  <option value="draft">Utkast</option>
                  <option value="approved">Godkjent</option>
                  <option value="closed">Avsluttet</option>
                </select>
              </div>
              {sjaPanelSja.jobDescription ? (
                <p className="text-sm text-neutral-700">{sjaPanelSja.jobDescription}</p>
              ) : null}
              <div className="mt-6 overflow-x-auto">
                <p className={SETTINGS_FIELD_LABEL}>Fareidentifikasjon</p>
                <table className="mt-2 w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-600">
                      {['Steg', 'Fare', 'Konsekvens', 'Eksist.', 'Nye tiltak', 'Ansvarlig'].map((h) => (
                        <th key={h} className="border border-neutral-200 px-2 py-1.5 text-left font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sjaPanelSja.rows.map((row) => (
                      <tr key={row.id}>
                        {(['step', 'hazard', 'consequence', 'existingControls', 'additionalMeasures', 'responsible'] as const).map(
                          (field) => (
                            <td key={field} className="border border-neutral-200 px-1 py-1">
                              <input
                                value={row[field]}
                                onChange={(e) => hse.updateSjaRow(sjaPanelSja.id, row.id, { [field]: e.target.value })}
                                className="w-full min-w-[72px] bg-transparent px-1 py-0.5 outline-none"
                              />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {(['step', 'hazard', 'consequence', 'existingControls', 'additionalMeasures', 'responsible'] as const).map(
                  (field) => (
                    <input
                      key={field}
                      value={sjaPanelRowDraft[field]}
                      onChange={(e) => setSjaPanelRowDraft((d) => ({ ...d, [field]: e.target.value }))}
                      placeholder={field}
                      className={`${SETTINGS_INPUT} text-xs`}
                    />
                  ),
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!sjaPanelRowDraft.step.trim() && !sjaPanelRowDraft.hazard.trim()) return
                  hse.addSjaRow(sjaPanelSja.id, sjaPanelRowDraft)
                  setSjaPanelRowDraft({
                    step: '',
                    hazard: '',
                    consequence: '',
                    existingControls: '',
                    additionalMeasures: '',
                    responsible: '',
                  })
                }}
                className={`${HERO_ACTION_CLASS} mt-2 bg-neutral-800 text-white`}
              >
                + Legg til rad
              </button>
              <div className="mt-6">
                <label className={SETTINGS_FIELD_LABEL}>Konklusjon</label>
                <textarea
                  value={sjaPanelSja.conclusion}
                  onChange={(e) => hse.updateSja(sjaPanelSja.id, { conclusion: e.target.value })}
                  rows={3}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
              <div className="mt-6">
                <p className={SETTINGS_FIELD_LABEL}>Signaturer</p>
                <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                  {sjaPanelSja.signatures.map((s, i) => {
                    const l1 = formatLevel1AuditLine(s.level1)
                    return (
                      <li key={i} className="whitespace-pre-line">
                        {s.signerName} ({s.role}) · {formatDate(s.signedAt)}
                        {l1 ? `\n${l1}` : ''}
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={sjaPanelSig.role}
                    onChange={(e) =>
                      setSjaPanelSig((d) => ({
                        ...d,
                        role: e.target.value as SjaAnalysis['signatures'][0]['role'],
                      }))
                    }
                    className={`${SETTINGS_INPUT} w-auto bg-neutral-50 text-xs`}
                  >
                    <option value="foreman">Arbeidsleder</option>
                    <option value="verneombud">Verneombud</option>
                    <option value="worker">Arbeider</option>
                    <option value="management">Ledelse</option>
                  </select>
                  <input
                    value={sjaPanelSig.signerName}
                    onChange={(e) => setSjaPanelSig((d) => ({ ...d, signerName: e.target.value }))}
                    placeholder="Fullt navn"
                    className={`${SETTINGS_INPUT} min-w-[160px] flex-1 bg-neutral-50 text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!sjaPanelSig.signerName.trim()) return
                      void (async () => {
                        await hse.signSja(sjaPanelSja.id, sjaPanelSig)
                        setSjaPanelSig((d) => ({ ...d, signerName: '' }))
                      })()
                    }}
                    className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white`}
                  >
                    Signer
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end border-t border-neutral-200 pt-4">
                <AddTaskLink
                  title={`SJA oppfølging: ${sjaPanelSja.title.slice(0, 60)}`}
                  module="hse"
                  sourceType="hse_incident"
                  sourceId={sjaPanelSja.id}
                  sourceLabel={sjaPanelSja.title}
                  ownerRole="Arbeidsleder / HMS"
                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-xs text-[#1a3d32]`}
                />
              </div>
            </div>
            <div className="border-t border-neutral-200 px-5 py-4">
              <button
                type="button"
                onClick={closeSjaPanel}
                className={`${HERO_ACTION_CLASS} w-full border border-neutral-300 bg-white text-neutral-800`}
              >
                Lukk
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Sykefravær — sidevindu */}
      {slPanelId && slPanelCase ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeSlPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[920px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{slPanelCase.employeeName}</h2>
                <p className="text-xs text-neutral-500">
                  {SICK_STATUS_LABELS[slPanelCase.status]} · {slPanelCase.sicknessDegree}% · {slPanelCase.department}
                </p>
              </div>
              <button type="button" onClick={closeSlPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4">
                <label className={SETTINGS_FIELD_LABEL}>Status</label>
                <select
                  value={slPanelCase.status}
                  onChange={(e) =>
                    hse.updateSickLeaveCase(slPanelCase.id, { status: e.target.value as SickLeaveCase['status'] })
                  }
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                >
                  <option value="active">Sykemeldt</option>
                  <option value="partial">Gradert</option>
                  <option value="returning">I retur</option>
                  <option value="closed">Avsluttet</option>
                </select>
              </div>
              <p className="text-xs text-neutral-500">
                Sykemeldt fra: {formatDate(slPanelCase.sickFrom)} · Leder: {slPanelCase.managerName}
              </p>
              {(() => {
                const today = new Date().toISOString().slice(0, 10)
                const overdue = slPanelCase.milestones.filter((m) => !m.completedAt && m.dueAt < today)
                const upcoming = slPanelCase.milestones.filter((m) => !m.completedAt && m.dueAt >= today)
                const done = slPanelCase.milestones.filter((m) => m.completedAt)
                return (
                  <div className="mt-4 space-y-4">
                    {overdue.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-900">Forfalt ({overdue.length})</p>
                        {overdue.map((m) => (
                          <div key={m.kind} className="mt-2 flex items-center justify-between gap-2 text-xs text-amber-800">
                            <span>{m.label}</span>
                            <button
                              type="button"
                              onClick={() => hse.completeMilestone(slPanelCase.id, m.kind as SickLeaveMilestoneKind)}
                              className="rounded bg-amber-700 px-2 py-0.5 text-white"
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
                                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                              >
                                <span className="font-medium text-neutral-800">{m.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-neutral-500">
                                    {formatDate(m.dueAt)} ({days}d)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      hse.completeMilestone(slPanelCase.id, m.kind as SickLeaveMilestoneKind)
                                    }
                                    className="rounded-none bg-[#1a3d32] px-2 py-0.5 text-[10px] text-white"
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
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800"
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
              <div className="mt-6">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                  <Lock className="size-3.5" /> Tilretteleggingsnotater
                </label>
                <textarea
                  value={slPanelCase.accommodationNotes}
                  onChange={(e) =>
                    hse.updateSickLeaveCase(slPanelCase.id, { accommodationNotes: e.target.value })
                  }
                  rows={4}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
              <div className="mt-6">
                <p className="text-xs font-semibold text-neutral-700 flex items-center gap-1 mb-2">
                  <MessageSquare className="size-3.5" /> Dialog
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-none border border-neutral-200 bg-neutral-50 p-3 text-sm">
                  {slPanelCase.portalMessages.length === 0 ? (
                    <p className="text-xs text-neutral-400">Ingen meldinger ennå.</p>
                  ) : (
                    slPanelCase.portalMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg px-3 py-2 ${m.senderRole === 'manager' ? 'ml-4 bg-[#1a3d32]/8' : 'mr-4 bg-white'}`}
                      >
                        <div className="mb-1 text-[10px] text-neutral-500">
                          {m.senderName} ({m.senderRole === 'manager' ? 'Leder' : 'Ansatt'}) · {formatWhen(m.sentAt)}
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
                        slPanelCase.id,
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
            <div className="border-t border-neutral-200 px-5 py-4">
              <button
                type="button"
                onClick={closeSlPanel}
                className={`${HERO_ACTION_CLASS} w-full border border-neutral-300 bg-white text-neutral-800`}
              >
                Lukk
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Opplæringspost — sidevindu */}
      {trainingPanelId && trainingPanelRec ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeTrainingPanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[640px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Rediger opplæring</h2>
              <button type="button" onClick={closeTrainingPanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className={SETTINGS_FIELD_LABEL}>Ansatt</label>
                <input
                  value={trainingPanelRec.employeeName}
                  onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { employeeName: e.target.value })}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={SETTINGS_FIELD_LABEL}>Avdeling</label>
                  <input
                    value={trainingPanelRec.department}
                    onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { department: e.target.value })}
                    className={`${SETTINGS_INPUT} mt-2 bg-white`}
                  />
                </div>
                <div>
                  <label className={SETTINGS_FIELD_LABEL}>Rolle</label>
                  <input
                    value={trainingPanelRec.role}
                    onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { role: e.target.value })}
                    className={`${SETTINGS_INPUT} mt-2 bg-white`}
                  />
                </div>
              </div>
              <div>
                <label className={SETTINGS_FIELD_LABEL}>Type</label>
                <select
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
              </div>
              {trainingPanelRec.trainingKind === 'custom' && (
                <div>
                  <label className={SETTINGS_FIELD_LABEL}>Egendefinert</label>
                  <input
                    value={trainingPanelRec.customLabel ?? ''}
                    onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { customLabel: e.target.value })}
                    className={`${SETTINGS_INPUT} mt-2 bg-white`}
                  />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={SETTINGS_FIELD_LABEL}>Gjennomført</label>
                  <input
                    type="date"
                    value={trainingPanelRec.completedAt ?? ''}
                    onChange={(e) =>
                      hse.updateTrainingRecord(trainingPanelRec.id, {
                        completedAt: e.target.value || undefined,
                      })
                    }
                    className={`${SETTINGS_INPUT} mt-2 bg-white`}
                  />
                </div>
                <div>
                  <label className={SETTINGS_FIELD_LABEL}>Utløper</label>
                  <input
                    type="date"
                    value={trainingPanelRec.expiresAt ?? ''}
                    onChange={(e) =>
                      hse.updateTrainingRecord(trainingPanelRec.id, {
                        expiresAt: e.target.value || undefined,
                      })
                    }
                    className={`${SETTINGS_INPUT} mt-2 bg-white`}
                  />
                </div>
              </div>
              <div>
                <label className={SETTINGS_FIELD_LABEL}>Leverandør</label>
                <input
                  value={trainingPanelRec.provider ?? ''}
                  onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { provider: e.target.value })}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
              <div>
                <label className={SETTINGS_FIELD_LABEL}>Sertifikat / ref.</label>
                <input
                  value={trainingPanelRec.certificateRef ?? ''}
                  onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { certificateRef: e.target.value })}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
              <div>
                <label className={SETTINGS_FIELD_LABEL}>Notater</label>
                <textarea
                  value={trainingPanelRec.notes ?? ''}
                  onChange={(e) => hse.updateTrainingRecord(trainingPanelRec.id, { notes: e.target.value })}
                  rows={3}
                  className={`${SETTINGS_INPUT} mt-2 bg-white`}
                />
              </div>
            </div>
            <div className="border-t border-neutral-200 px-5 py-4">
              <button
                type="button"
                onClick={closeTrainingPanel}
                className={`${HERO_ACTION_CLASS} w-full border border-neutral-300 bg-white text-neutral-800`}
              >
                Lukk
              </button>
            </div>
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
    </div>
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

const INSPECTION_KIND_LABEL: Record<Inspection['kind'], string> = {
  internal: 'Intern',
  external: 'Ekstern',
  audit: 'Revisjon',
}

function IncidentTableRow({
  inc,
  deptLabel,
  rowClass,
  cellClass,
  onOpen,
}: {
  inc: Incident
  deptLabel: string
  rowClass: string
  cellClass: string
  onOpen: () => void
}) {
  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="flex flex-wrap gap-1">
          <span className={`${R_FLAT} border px-2 py-0.5 text-xs font-semibold ${KIND_COLOURS[inc.kind]}`}>
            {KIND_LABELS[inc.kind]}
          </span>
          <span className={`${R_FLAT} border px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOURS[inc.severity]}`}>
            {SEVERITY_LABELS[inc.severity]}
          </span>
        </div>
      </td>
      <td className={`${cellClass} text-neutral-600`}>{formatWhen(inc.occurredAt)}</td>
      <td className={cellClass}>
        <div className="max-w-[200px] text-neutral-900">{inc.location}</div>
        <div className="text-xs text-neutral-500">{deptLabel}</div>
      </td>
      <td className={cellClass}>{inc.reportedBy}</td>
      <td className={cellClass}>
        <span className={`${R_FLAT} border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium`}>
          {STATUS_LABELS[inc.status]}
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
  onOpen,
}: {
  ins: Inspection
  rowClass: string
  cellClass: string
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
        <button
          type="button"
          onClick={onOpen}
          className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
        >
          Åpne
        </button>
      </td>
    </tr>
  )
}

function SafetyRoundTableRow({
  round,
  templates,
  rowClass,
  cellClass,
  onOpen,
}: {
  round: SafetyRound
  templates: ChecklistTemplate[]
  rowClass: string
  cellClass: string
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

  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="max-w-[240px] font-medium text-neutral-900">{round.title}</div>
      </td>
      <td className={cellClass}>
        <div className="text-neutral-800">{round.location}</div>
        {round.department ? <div className="text-xs text-neutral-500">{round.department}</div> : null}
      </td>
      <td className={cellClass}>
        <span className={`${R_FLAT} inline-block border px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </td>
      <td className={`${cellClass} text-neutral-600`}>{formatWhen(round.conductedAt)}</td>
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
        <button type="button" onClick={onOpen} className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}>
          Åpne
        </button>
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
