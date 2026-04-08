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
  ClipboardCheck,
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
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import { formatLevel1AuditLine } from '../lib/level1Signature'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { TRAINING_KIND_LABELS } from '../data/hseTemplates'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeIncidentWizard, makeSickLeaveWizard, makeSjaWizard, makeSafetyRoundWizard } from '../components/wizard/wizards'
import type {
  HseProtocolSignature,
  Incident,
  IncidentCategory,
  IncidentFormTemplate,
  Inspection,
  InspectionAttachment,
  InspectionFinding,
  InspectionSubjectKind,
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
  const { supabaseConfigured, supabase, organization, profile } = useOrgSetupContext()
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

  const [roundForm, setRoundForm] = useState({ title: '', conductedAt: '', location: '', department: '', conductedBy: '', notes: '', templateId: 'tpl-standard' })

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

  // Incident form — rich
  const [incForm, setIncForm] = useState({
    kind: 'incident' as Incident['kind'],
    category: 'physical_injury' as IncidentCategory,
    formTemplate: 'standard' as IncidentFormTemplate,
    severity: 'medium' as Incident['severity'],
    occurredAt: '',
    location: '',
    department: '',
    description: '',
    experienceDetail: '',
    witnesses: '',
    injuredPerson: '',
    immediateActions: '',
    rootCause: '',
    reportedBy: '',
    status: 'reported' as Incident['status'],
    arbeidstilsynetNotified: false,
    routeManager: '',
    routeVerneombud: false,
    routeAMU: false,
  })

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
  const [expandedSja, setExpandedSja] = useState<string | null>(null)
  const [sjaRowDraft, setSjaRowDraft] = useState<Record<string, Omit<SjaHazardRow, 'id'>>>({})
  const [sjaSignDraft, setSjaSignDraft] = useState<Record<string, { signerName: string; role: SjaAnalysis['signatures'][0]['role'] }>>({})

  // Training form
  const [trainingForm, setTrainingForm] = useState({ employeeName: '', department: '', role: '', trainingKind: 'hms_40hr' as TrainingKind, customLabel: '', completedAt: '', expiresAt: '', provider: '', certificateRef: '' })

  // GDPR + export
  const [exportMsg, setExportMsg] = useState('')

  // Expanded incident detail
  const [expandedInc, setExpandedInc] = useState<string | null>(null)
  // Expanded sick leave
  const [expandedSL, setExpandedSL] = useState<string | null>(null)
  // Portal message drafts
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({})
  const [msgRole, setMsgRole] = useState<Record<string, SickLeaveCase['portalMessages'][0]['senderRole']>>({})
  const [msgName, setMsgName] = useState<Record<string, string>>({})
  // Corrective action draft
  const [caDraft, setCaDraft] = useState<Record<string, { description: string; responsible: string; dueDate: string }>>({})

  const sortedAudit = useMemo(() => [...hse.auditTrail].sort((a, b) => a.at.localeCompare(b.at)), [hse.auditTrail])

  const inspectionStats = useMemo(() => {
    const list = hse.inspections
    return {
      total: list.length,
      open: list.filter((i) => i.status === 'open' && !i.locked).length,
      closedUnlocked: list.filter((i) => i.status === 'closed' && !i.locked).length,
      locked: list.filter((i) => i.locked).length,
    }
  }, [hse.inspections])

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

  const activeTemplate = FORM_TEMPLATES.find((t) => t.id === incForm.formTemplate)!

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

      {/* ── Overview ──────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Hurtigstatus</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Vernerunder" value={hse.stats.rounds} />
              <StatCard label="Hendelser" value={hse.stats.incidents} colour="neutral" />
              <StatCard label="Vold / trusler" value={hse.stats.violence} colour={hse.stats.violence > 0 ? 'red' : 'neutral'} />
              <StatCard label="Åpne SJA" value={hse.stats.openSja} colour={hse.stats.openSja > 0 ? 'amber' : 'neutral'} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <StatCard label="Aktive sykefravær" value={hse.stats.activeSickLeave} />
              <StatCard label="Forfalte frister" value={hse.stats.overdueMilestones} colour={hse.stats.overdueMilestones > 0 ? 'amber' : 'neutral'} />
              <StatCard label="Opplæringsrekorder" value={hse.stats.trainingRecords} />
              <StatCard label="Utløpt opplæring" value={hse.stats.expiredTraining} colour={hse.stats.expiredTraining > 0 ? 'red' : 'neutral'} />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-5 text-sm text-amber-950">
            <strong>Revisjonslogg:</strong> Alle opprettelser og endringer logges med tidspunkt (append-only). Sykefraværsdata vises kun i sykefravær-fanen og er logget separat.
          </div>
        </div>
      )}

      {/* ── Safety rounds ─────────────────────────────────────────────────────── */}
      {tab === 'rounds' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Ny vernerunde</h2>
              <WizardButton
                label="Veiviser"
                def={makeSafetyRoundWizard(
                  (data) => hse.createSafetyRound({
                    title: String(data.title), conductedAt: new Date(String(data.conductedAt)).toISOString(),
                    location: String(data.location) || '—', department: String(data.department) || undefined,
                    conductedBy: String(data.conductedBy) || '—', notes: String(data.notes) || '',
                  }),
                  hse.checklistTemplates.map((t) => ({ value: t.id, label: t.name })),
                )}
              />
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!roundForm.title.trim() || !roundForm.conductedAt) return
              hse.createSafetyRound({ title: roundForm.title.trim(), conductedAt: new Date(roundForm.conductedAt).toISOString(), location: roundForm.location.trim() || '—', department: roundForm.department.trim() || undefined, conductedBy: roundForm.conductedBy.trim() || '—', notes: roundForm.notes })
              setRoundForm((r) => ({ ...r, title: '', notes: '' }))
            }}>
              {/* Checklist template selector */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Sjekklistemal</label>
                <select
                  value={roundForm.templateId}
                  onChange={(e) => setRoundForm((r) => ({ ...r, templateId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  {hse.checklistTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}{tpl.department ? ` (${tpl.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Tittel</label>
                <input value={roundForm.title} onChange={(e) => setRoundForm((r) => ({ ...r, title: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Gjennomført</label>
                <input type="datetime-local" value={roundForm.conductedAt} onChange={(e) => setRoundForm((r) => ({ ...r, conductedAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Område / lokasjon</label>
                <input value={roundForm.location} onChange={(e) => setRoundForm((r) => ({ ...r, location: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Avdeling</label>
                <input value={roundForm.department} onChange={(e) => setRoundForm((r) => ({ ...r, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Gjennomført av (f.eks. verneombud)</label>
                <input value={roundForm.conductedBy} onChange={(e) => setRoundForm((r) => ({ ...r, conductedBy: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea value={roundForm.notes} onChange={(e) => setRoundForm((r) => ({ ...r, notes: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2">
                <ClipboardCheck className="size-4" />Opprett runde
              </button>
            </form>
          </section>
          <div className="space-y-6">
            {hse.safetyRounds.map((sr) => {
              // Use the template items if the round has a matching template, otherwise fall back to default
              const checklist = hse.checklistTemplate
              return <SafetyRoundCard key={sr.id} round={sr} checklist={checklist} hse={hse} />
            })}
          </div>
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

      {/* ── Incidents — expanded ──────────────────────────────────────────────── */}
      {tab === 'incidents' && (
        <div className="mt-8 space-y-8">

          {/* Registration form */}
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Registrer hendelse</h2>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Lavterskel</span>
              </div>
              <WizardButton
                label="Veiviser"
                variant="solid"
                def={makeIncidentWizard((data) => {
                  hse.createIncident({
                    kind: String(data.kind) as Incident['kind'],
                    category: String(data.category) as IncidentCategory,
                    formTemplate: String(data.formTemplate) as IncidentFormTemplate,
                    severity: String(data.severity) as Incident['severity'],
                    occurredAt: data.occurredAt ? new Date(String(data.occurredAt)).toISOString() : new Date().toISOString(),
                    location: String(data.location) || '—',
                    department: String(data.department) || '',
                    description: String(data.description) || '',
                    experienceDetail: data.experienceDetail ? String(data.experienceDetail) : undefined,
                    injuredPerson: data.injuredPerson ? String(data.injuredPerson) : undefined,
                    immediateActions: String(data.immediateActions) || '',
                    reportedBy: String(data.reportedBy) || '—',
                    status: String(data.status) as Incident['status'],
                    correctiveActions: [],
                    arbeidstilsynetNotified: Boolean(data.arbeidstilsynetNotified),
                    routing: data.routeManager ? {
                      managerName: String(data.routeManager),
                      verneombudNotified: Boolean(data.routeVerneombud),
                      amuCaseCreated: Boolean(data.routeAMU),
                      routedAt: new Date().toISOString(),
                    } : undefined,
                  })
                })}
              />
            </div>

            {/* Template picker */}
            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-500">Skjemamal</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORM_TEMPLATES.map((tpl) => (
                  <button key={tpl.id} type="button" onClick={() => {
                    setIncForm((i) => ({ ...i, formTemplate: tpl.id, kind: tpl.id === 'deviation' ? 'deviation' : tpl.showViolenceFields ? 'violence' : 'incident' }))
                  }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${incForm.formTemplate === tpl.id ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!incForm.description.trim()) return
              hse.createIncident({
                kind: incForm.kind,
                category: incForm.category,
                formTemplate: incForm.formTemplate,
                severity: incForm.severity,
                occurredAt: incForm.occurredAt ? new Date(incForm.occurredAt).toISOString() : new Date().toISOString(),
                location: incForm.location || '—',
                department: incForm.department,
                description: incForm.description,
                experienceDetail: incForm.experienceDetail || undefined,
                witnesses: incForm.witnesses || undefined,
                injuredPerson: incForm.injuredPerson || undefined,
                immediateActions: incForm.immediateActions,
                rootCause: incForm.rootCause || undefined,
                reportedBy: incForm.reportedBy || '—',
                status: incForm.status,
                correctiveActions: [],
                arbeidstilsynetNotified: incForm.arbeidstilsynetNotified,
                routing: incForm.routeManager ? { managerName: incForm.routeManager, verneombudNotified: incForm.routeVerneombud, amuCaseCreated: incForm.routeAMU, routedAt: new Date().toISOString() } : undefined,
              })
              setIncForm((i) => ({ ...i, description: '', immediateActions: '', experienceDetail: '', witnesses: '', injuredPerson: '', rootCause: '' }))
            }}>
              {/* Row 1: type + severity */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Type hendelse</label>
                <select value={incForm.kind} onChange={(e) => setIncForm((i) => ({ ...i, kind: e.target.value as Incident['kind'] }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="incident">Ulykke / skade</option>
                  <option value="near_miss">Nestenulykke</option>
                  <option value="dangerous_cond">Farlige forhold (AML §2-3)</option>
                  <option value="violence">Vold</option>
                  <option value="threat">Trussel</option>
                  <option value="deviation">Avvik</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Alvorlighetsgrad</label>
                <select value={incForm.severity} onChange={(e) => setIncForm((i) => ({ ...i, severity: e.target.value as Incident['severity'] }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="low">Lav</option>
                  <option value="medium">Middels</option>
                  <option value="high">Høy</option>
                  <option value="critical">Kritisk (melding til Arbeidstilsynet vurderes)</option>
                </select>
              </div>

              {/* Row 2: category + when */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Kategori</label>
                <select value={incForm.category} onChange={(e) => setIncForm((i) => ({ ...i, category: e.target.value as IncidentCategory }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Tidspunkt</label>
                <input type="datetime-local" value={incForm.occurredAt} onChange={(e) => setIncForm((i) => ({ ...i, occurredAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>

              {/* Row 3: location + department */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Sted</label>
                <input value={incForm.location} onChange={(e) => setIncForm((i) => ({ ...i, location: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Avdeling</label>
                <input value={incForm.department} onChange={(e) => setIncForm((i) => ({ ...i, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Beskrivelse av hendelsen *</label>
                <textarea value={incForm.description} onChange={(e) => setIncForm((i) => ({ ...i, description: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" required />
              </div>

              {/* Violence-specific fields */}
              {activeTemplate.showViolenceFields && (
                <>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-neutral-500">Hva opplevde du / den berørte? (beskriv adferd)</label>
                    <textarea value={incForm.experienceDetail} onChange={(e) => setIncForm((i) => ({ ...i, experienceDetail: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Berørt person</label>
                    <input value={incForm.injuredPerson} onChange={(e) => setIncForm((i) => ({ ...i, injuredPerson: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Vitner (valgfritt)</label>
                    <input value={incForm.witnesses} onChange={(e) => setIncForm((i) => ({ ...i, witnesses: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
                  </div>
                </>
              )}

              {/* Immediate actions + root cause */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Umiddelbare tiltak</label>
                <textarea value={incForm.immediateActions} onChange={(e) => setIncForm((i) => ({ ...i, immediateActions: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Rotårsak (kan fylles ut i etterkant)</label>
                <input value={incForm.rootCause} onChange={(e) => setIncForm((i) => ({ ...i, rootCause: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>

              {/* Reporter + status */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Meldt av</label>
                <input value={incForm.reportedBy} onChange={(e) => setIncForm((i) => ({ ...i, reportedBy: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Status</label>
                <select value={incForm.status} onChange={(e) => setIncForm((i) => ({ ...i, status: e.target.value as Incident['status'] }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="reported">Meldt</option>
                  <option value="investigating">Under utredning</option>
                  <option value="action_pending">Tiltak pågår</option>
                  <option value="closed">Lukket</option>
                </select>
              </div>

              {/* Routing */}
              <div className="sm:col-span-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-neutral-600">Automatisk ruting</p>
                <div>
                  <label className="text-xs text-neutral-500">Nærmeste leder (varsles)</label>
                  <input value={incForm.routeManager} onChange={(e) => setIncForm((i) => ({ ...i, routeManager: e.target.value }))} placeholder="Navn på nærmeste leder" className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={incForm.routeVerneombud} onChange={(e) => setIncForm((i) => ({ ...i, routeVerneombud: e.target.checked }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                    Varsle verneombud
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={incForm.routeAMU} onChange={(e) => setIncForm((i) => ({ ...i, routeAMU: e.target.checked }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                    Opprett AMU-sak
                  </label>
                  {incForm.severity === 'critical' && (
                    <label className="flex items-center gap-2 text-sm text-red-700">
                      <input type="checkbox" checked={incForm.arbeidstilsynetNotified} onChange={(e) => setIncForm((i) => ({ ...i, arbeidstilsynetNotified: e.target.checked }))} className="size-4 rounded border-red-300 text-red-600 focus:ring-1 focus:ring-red-600" />
                      Meldt til Arbeidstilsynet (AML §5-2)
                    </label>
                  )}
                </div>
              </div>

              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2">
                <FileWarning className="size-4" />
                Registrer hendelse
              </button>
            </form>
          </section>

          {/* Incident log */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Logg — hendelser</h2>
            </div>
            {hse.incidents.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen registreringer ennå.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {hse.incidents.map((inc) => {
                  const expanded = expandedInc === inc.id
                  const ca = caDraft[inc.id] ?? { description: '', responsible: '', dueDate: '' }
                  return (
                    <li key={inc.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_COLOURS[inc.kind]}`}>{KIND_LABELS[inc.kind]}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLOURS[inc.severity]}`}>{SEVERITY_LABELS[inc.severity]}</span>
                          {inc.formTemplate !== 'standard' && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{FORM_TEMPLATES.find((t) => t.id === inc.formTemplate)?.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={inc.status} onChange={(e) => hse.updateIncident(inc.id, { status: e.target.value as Incident['status'] })} className="rounded-full border border-neutral-200 px-2 py-1 text-xs">
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <button type="button" onClick={() => setExpandedInc(expanded ? null : inc.id)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs">
                            {expanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-neutral-500">
                        {formatWhen(inc.occurredAt)} · {inc.location}{inc.department ? ` · ${inc.department}` : ''}
                        {inc.reportedBy !== '—' ? ` · Meldt av: ${inc.reportedBy}` : ''}
                      </p>
                      <p className="mt-2 text-sm text-neutral-800">{inc.description}</p>

                      {/* Routing badge */}
                      {inc.routing && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-[#1a3d32]/10 px-2 py-0.5 text-[#1a3d32]">→ {inc.routing.managerName}</span>
                          {inc.routing.verneombudNotified && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Verneombud varslet</span>}
                          {inc.routing.amuCaseCreated && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">AMU-sak opprettet</span>}
                        </div>
                      )}
                      {inc.arbeidstilsynetNotified && (
                        <p className="mt-1 text-xs font-medium text-red-700">⚠ Meldt til Arbeidstilsynet (AML §5-2)</p>
                      )}

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="mt-4 space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
                          {inc.experienceDetail && <div><span className="font-medium text-neutral-700">Opplevelse:</span> {inc.experienceDetail}</div>}
                          {inc.injuredPerson && <div><span className="font-medium text-neutral-700">Berørt:</span> {inc.injuredPerson}</div>}
                          {inc.witnesses && <div><span className="font-medium text-neutral-700">Vitner:</span> {inc.witnesses}</div>}
                          {inc.immediateActions && <div><span className="font-medium text-neutral-700">Umiddelbare tiltak:</span> {inc.immediateActions}</div>}
                          {inc.rootCause && <div><span className="font-medium text-neutral-700">Rotårsak:</span> {inc.rootCause}</div>}

                          {/* Corrective actions */}
                          <div>
                            <p className="font-semibold text-neutral-700 mb-2">Tiltak ({inc.correctiveActions.length})</p>
                            {inc.correctiveActions.map((a) => (
                              <div key={a.id} className="flex items-start gap-2 mb-1">
                                <button type="button" onClick={() => hse.updateIncident(inc.id, { correctiveActions: inc.correctiveActions.map((x) => x.id === a.id ? { ...x, completedAt: x.completedAt ? undefined : new Date().toISOString() } : x) })} className={`mt-0.5 shrink-0 rounded-full p-0.5 ${a.completedAt ? 'text-emerald-600' : 'text-neutral-300'}`}>
                                  <CheckCircle2 className="size-4" />
                                </button>
                                <div className={a.completedAt ? 'line-through text-neutral-400' : ''}>
                                  {a.description} — <span className="text-neutral-500">{a.responsible}</span> · frist {formatDate(a.dueDate)}
                                </div>
                              </div>
                            ))}
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              <input placeholder="Tiltak" value={ca.description} onChange={(e) => setCaDraft((d) => ({ ...d, [inc.id]: { ...ca, description: e.target.value } }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                              <input placeholder="Ansvarlig" value={ca.responsible} onChange={(e) => setCaDraft((d) => ({ ...d, [inc.id]: { ...ca, responsible: e.target.value } }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                              <div className="flex gap-1">
                                <input type="date" value={ca.dueDate} onChange={(e) => setCaDraft((d) => ({ ...d, [inc.id]: { ...ca, dueDate: e.target.value } }))} className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                                <button type="button" onClick={() => {
                                  if (!ca.description.trim() || !ca.dueDate) return
                                  hse.addCorrectiveAction(inc.id, ca)
                                  setCaDraft((d) => ({ ...d, [inc.id]: { description: '', responsible: '', dueDate: '' } }))
                                }} className="rounded-lg bg-[#1a3d32] px-2 py-1 text-white">
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {expanded && (
                          <button
                            type="button"
                            onClick={() => { if (confirm('Anonymiser personopplysninger? Kan ikke angres.')) hse.anonymiseIncident(inc.id) }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="size-3.5" />
                            Anonymiser (GDPR)
                          </button>
                        )}
                        <AddTaskLink
                          title={`Oppfølging: ${KIND_LABELS[inc.kind]}`}
                          description={inc.description.slice(0, 200)}
                          module="hse"
                          sourceType="hse_incident"
                          sourceId={inc.id}
                          sourceLabel={`${inc.location} · ${SEVERITY_LABELS[inc.severity]}`}
                          ownerRole="HMS / verneombud"
                          requiresManagementSignOff={inc.severity === 'high' || inc.severity === 'critical'}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
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
                  setExpandedSja(sja.id)
                })}
              />
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!sjaForm.title.trim()) return
              const sja = hse.createSja({ title: sjaForm.title.trim(), jobDescription: sjaForm.jobDescription, location: sjaForm.location, department: sjaForm.department, plannedAt: sjaForm.plannedAt ? new Date(sjaForm.plannedAt).toISOString() : new Date().toISOString(), conductedBy: sjaForm.conductedBy, participants: sjaForm.participants, rows: [], status: 'draft', conclusion: '' })
              setExpandedSja(sja.id)
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

          {/* SJA list */}
          <div className="space-y-4">
            {hse.sjaAnalyses.length === 0 && <p className="text-center text-sm text-neutral-500 py-8">Ingen SJA-er registrert ennå.</p>}
            {hse.sjaAnalyses.map((sja) => {
              const expanded = expandedSja === sja.id
              const rowDraft = sjaRowDraft[sja.id] ?? { step: '', hazard: '', consequence: '', existingControls: '', additionalMeasures: '', responsible: '' }
              const sigDraft = sjaSignDraft[sja.id] ?? { signerName: '', role: 'foreman' as const }
              return (
                <div key={sja.id} className="rounded-2xl border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 px-4 py-3 border-b border-neutral-100">
                    <div>
                      <span className="font-semibold text-neutral-900">{sja.title}</span>
                      <span className="ml-2 text-xs text-neutral-500">{sja.location}{sja.department ? ` · ${sja.department}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={sja.status} onChange={(e) => hse.updateSja(sja.id, { status: e.target.value as SjaAnalysis['status'] })} className="rounded-full border border-neutral-200 px-2 py-1 text-xs">
                        <option value="draft">Utkast</option>
                        <option value="approved">Godkjent</option>
                        <option value="closed">Avsluttet</option>
                      </select>
                      <button type="button" onClick={() => setExpandedSja(expanded ? null : sja.id)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 text-xs">{expanded ? '▲' : '▼'}</button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-4 py-4 space-y-5">
                      {sja.jobDescription && <p className="text-sm text-neutral-700">{sja.jobDescription}</p>}

                      {/* Hazard rows table */}
                      <div>
                        <p className="text-xs font-semibold text-neutral-600 mb-2">Fareidentifikasjon og tiltak</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px] text-xs border-collapse">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                                {['Arbeidssteg', 'Fare', 'Konsekvens', 'Eksist. tiltak', 'Nye tiltak', 'Ansvarlig'].map((h) => (
                                  <th key={h} className="border border-neutral-200 px-2 py-1.5 text-left font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sja.rows.map((row) => (
                                <tr key={row.id} className="border border-neutral-200">
                                  {(['step', 'hazard', 'consequence', 'existingControls', 'additionalMeasures', 'responsible'] as const).map((field) => (
                                    <td key={field} className="border border-neutral-200 px-2 py-1">
                                      <input
                                        value={row[field]}
                                        onChange={(e) => hse.updateSjaRow(sja.id, row.id, { [field]: e.target.value })}
                                        className="w-full min-w-[80px] bg-transparent text-xs outline-none"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {/* Add row */}
                              <tr className="bg-neutral-50/50">
                                {(['step', 'hazard', 'consequence', 'existingControls', 'additionalMeasures', 'responsible'] as const).map((field) => (
                                  <td key={field} className="border border-neutral-200 px-2 py-1">
                                    <input
                                      value={rowDraft[field]}
                                      onChange={(e) => setSjaRowDraft((d) => ({ ...d, [sja.id]: { ...rowDraft, [field]: e.target.value } }))}
                                      placeholder={field === 'step' ? '+ Nytt steg' : ''}
                                      className="w-full min-w-[80px] bg-transparent text-xs outline-none placeholder:text-neutral-400"
                                    />
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <button type="button" onClick={() => {
                          if (!rowDraft.step.trim() && !rowDraft.hazard.trim()) return
                          hse.addSjaRow(sja.id, rowDraft)
                          setSjaRowDraft((d) => ({ ...d, [sja.id]: { step: '', hazard: '', consequence: '', existingControls: '', additionalMeasures: '', responsible: '' } }))
                        }} className="mt-2 text-xs font-medium text-[#1a3d32] hover:underline">+ Legg til rad</button>
                      </div>

                      {/* Conclusion */}
                      <div>
                        <label className="text-xs font-semibold text-neutral-600">Konklusjon / godkjenning</label>
                        <textarea value={sja.conclusion} onChange={(e) => hse.updateSja(sja.id, { conclusion: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" placeholder="Totalvurdering og godkjenning av arbeidet …" />
                      </div>

                      {/* Signatures */}
                      <div>
                        <p className="text-xs font-semibold text-neutral-600 mb-2">Signaturer ({sja.signatures.length})</p>
                        {sja.signatures.map((s, i) => {
                          const l1 = formatLevel1AuditLine(s.level1)
                          return (
                            <div key={i} className="whitespace-pre-line text-xs text-neutral-600">
                              {s.signerName} ({s.role}) · {formatDate(s.signedAt)}
                              {l1 ? `\n${l1}` : ''}
                            </div>
                          )
                        })}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select value={sigDraft.role} onChange={(e) => setSjaSignDraft((d) => ({ ...d, [sja.id]: { ...sigDraft, role: e.target.value as typeof sigDraft.role } }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs">
                            <option value="foreman">Arbeidsleder</option>
                            <option value="verneombud">Verneombud</option>
                            <option value="worker">Arbeider</option>
                            <option value="management">Ledelse</option>
                          </select>
                          <input value={sigDraft.signerName} onChange={(e) => setSjaSignDraft((d) => ({ ...d, [sja.id]: { ...sigDraft, signerName: e.target.value } }))} placeholder="Fullt navn" className="flex-1 min-w-[140px] rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                          <button type="button" onClick={() => {
                            if (!sigDraft.signerName.trim()) return
                            void (async () => {
                              await hse.signSja(sja.id, sigDraft)
                              setSjaSignDraft((d) => ({ ...d, [sja.id]: { signerName: '', role: 'worker' } }))
                            })()
                          }} className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white">Signer</button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <AddTaskLink title={`SJA oppfølging: ${sja.title.slice(0, 60)}`} module="hse" sourceType="hse_incident" sourceId={sja.id} sourceLabel={sja.title} ownerRole="Arbeidsleder / HMS" />
                      </div>
                    </div>
                  )}
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

          {/* Active cases */}
          <div className="space-y-6">
            {hse.sickLeaveCases.map((sc) => {
              const today = new Date().toISOString().slice(0, 10)
              const expanded = expandedSL === sc.id
              const msg = msgDraft[sc.id] ?? ''
              const role = msgRole[sc.id] ?? 'manager'
              const name = msgName[sc.id] ?? ''
              const overdue = sc.milestones.filter((m) => !m.completedAt && m.dueAt < today)
              const upcoming = sc.milestones.filter((m) => !m.completedAt && m.dueAt >= today).slice(0, 3)
              const done = sc.milestones.filter((m) => m.completedAt)

              return (
                <div key={sc.id} className="rounded-2xl border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-neutral-900">{sc.employeeName}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SICK_STATUS_COLOURS[sc.status]}`}>{SICK_STATUS_LABELS[sc.status]}</span>
                      <span className="text-xs text-neutral-500">{sc.sicknessDegree}% · {sc.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={sc.status} onChange={(e) => hse.updateSickLeaveCase(sc.id, { status: e.target.value as SickLeaveCase['status'] })} className="rounded-full border border-neutral-200 px-2 py-1 text-xs">
                        <option value="active">Sykemeldt</option>
                        <option value="partial">Gradert</option>
                        <option value="returning">I retur</option>
                        <option value="closed">Avsluttet</option>
                      </select>
                      <button type="button" onClick={() => setExpandedSL(expanded ? null : sc.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
                        {expanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-xs text-neutral-500">Sykemeldt fra: {formatDate(sc.sickFrom)} · Leder: {sc.managerName}</p>

                    {/* Overdue alert */}
                    {overdue.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-900 mb-1">Forfalt ({overdue.length})</p>
                        {overdue.map((m) => (
                          <div key={m.kind} className="flex items-center justify-between gap-2 text-xs text-amber-800">
                            <span>{m.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-600">Frist: {formatDate(m.dueAt)} ({Math.abs(daysUntil(m.dueAt))} dager siden)</span>
                              <button type="button" onClick={() => hse.completeMilestone(sc.id, m.kind as SickLeaveMilestoneKind)} className="rounded bg-amber-700 px-2 py-0.5 text-white">Fullført</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upcoming milestones */}
                    {upcoming.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-neutral-600 mb-1">Kommende frister</p>
                        <div className="space-y-1.5">
                          {upcoming.map((m) => {
                            const days = daysUntil(m.dueAt)
                            const urgent = days <= 7
                            return (
                              <div key={m.kind} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${urgent ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50 border border-neutral-100'}`}>
                                <div>
                                  <span className="font-medium text-neutral-800">{m.label}</span>
                                  <span className="ml-2 text-neutral-400">{m.lawRef}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={urgent ? 'font-semibold text-amber-700' : 'text-neutral-500'}>{formatDate(m.dueAt)} ({days}d)</span>
                                  <button type="button" onClick={() => hse.completeMilestone(sc.id, m.kind as SickLeaveMilestoneKind)} className="rounded-full bg-[#1a3d32] px-2 py-0.5 text-white text-[10px]">Fullført</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Completed milestones */}
                    {done.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {done.map((m) => (
                          <span key={m.kind} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">
                            <CheckCircle2 className="size-3" />{m.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded: accommodation notes + portal */}
                  {expanded && (
                    <div className="border-t border-neutral-100 px-4 py-4 space-y-4">
                      {/* Accommodation notes */}
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                          <Lock className="size-3.5" /> Tilretteleggingsnotater (konfidensielt)
                        </label>
                        <textarea
                          value={sc.accommodationNotes}
                          onChange={(e) => hse.updateSickLeaveCase(sc.id, { accommodationNotes: e.target.value })}
                          rows={3}
                          placeholder="Tilretteleggingsbehov, avtaler, plan …"
                          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Secure portal messages */}
                      <div>
                        <p className="text-xs font-semibold text-neutral-700 flex items-center gap-1 mb-2">
                          <MessageSquare className="size-3.5" /> Sikker dialog (leder ↔ ansatt)
                        </p>
                        <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                          {sc.portalMessages.length === 0 ? (
                            <p className="text-xs text-neutral-400">Ingen meldinger ennå.</p>
                          ) : sc.portalMessages.map((m) => (
                            <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.senderRole === 'manager' ? 'bg-[#1a3d32]/8 ml-4' : 'bg-neutral-100 mr-4'}`}>
                              <div className="text-[10px] text-neutral-500 mb-1">{m.senderName} ({m.senderRole === 'manager' ? 'Leder' : 'Ansatt'}) · {formatWhen(m.sentAt)}</div>
                              <p className="text-neutral-800">{m.text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select value={role} onChange={(e) => setMsgRole((r) => ({ ...r, [sc.id]: e.target.value as typeof role }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs">
                              <option value="manager">Leder</option>
                              <option value="employee">Ansatt</option>
                            </select>
                            <input value={name} onChange={(e) => setMsgName((n) => ({ ...n, [sc.id]: e.target.value }))} placeholder="Navn" className="min-w-[120px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                          </div>
                          <div className="flex gap-2">
                            <textarea value={msg} onChange={(e) => setMsgDraft((d) => ({ ...d, [sc.id]: e.target.value }))} placeholder="Skriv melding …" rows={2} className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                            <button type="button" onClick={() => {
                              if (!msg.trim()) return
                              hse.addPortalMessage(sc.id, role, name || (role === 'manager' ? 'Leder' : 'Ansatt'), msg)
                              setMsgDraft((d) => ({ ...d, [sc.id]: '' }))
                            }} className="self-end rounded-lg bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

function StatCard({ label, value, colour = 'neutral' }: { label: string; value: number; colour?: 'neutral' | 'red' | 'amber' | 'emerald' }) {
  const cls = colour === 'red' ? 'text-red-700' : colour === 'amber' ? 'text-amber-700' : colour === 'emerald' ? 'text-emerald-700' : 'text-[#1a3d32]'
  return (
    <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="text-sm text-neutral-600">{label}</div>
    </div>
  )
}

const INSPECTION_KIND_LABEL: Record<Inspection['kind'], string> = {
  internal: 'Intern',
  external: 'Ekstern',
  audit: 'Revisjon',
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

function SafetyRoundCard({ round, checklist, hse }: {
  round: SafetyRound
  checklist: { id: string; label: string; lawRef: string }[]
  hse: ReturnType<typeof useHse>
}) {
  const [approvalName, setApprovalName] = useState('')
  const [approvalComment, setApprovalComment] = useState('')
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

  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${isLocked ? 'border-emerald-200' : 'border-neutral-200/90'}`}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{round.title}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
            {isLocked && <Lock className="size-3.5 text-emerald-600" />}
          </div>
          <p className="mt-1 text-sm text-neutral-600">{round.location}{round.department ? ` · ${round.department}` : ''} · {round.conductedBy}</p>
          <p className="text-xs text-neutral-400">{fmtDate(round.conductedAt)}</p>
        </div>
        {/* Issue count badge */}
        {issueItems.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-3.5" />
            {issueItems.length} avvik
          </span>
        )}
      </div>

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        {/* Conceptual note for users */}
        <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <strong>Avvik i vernerunde</strong> = potensielle farer oppdaget under runden (ikke-hendelser). Meld ulykker og vold separat under fanen <strong>Hendelser</strong>.
        </div>

        <ul className="space-y-2">
          {checklist.map((item) => {
            const st = round.items[item.id] ?? 'na'
            const detail = (round.itemDetails ?? {})[item.id]
            const isIssue = st === 'issue'
            return (
              <li key={item.id} className={`rounded-xl border ${isIssue ? 'border-amber-200 bg-amber-50/50' : 'border-neutral-100 bg-[#faf8f4]'}`}>
                {/* Status row */}
                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-sm text-neutral-900">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">{item.lawRef}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(['ok', 'issue', 'na'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={isLocked}
                        onClick={() => hse.setChecklistStatus(round.id, item.id, v)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          st === v
                            ? v === 'issue' ? 'bg-amber-400 text-amber-950' : v === 'ok' ? 'bg-emerald-400 text-white' : 'bg-neutral-300 text-neutral-800'
                            : 'bg-white ring-1 ring-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {v === 'ok' ? 'OK' : v === 'issue' ? '⚠ Avvik' : 'N/A'}
                      </button>
                    ))}
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
                        className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none disabled:opacity-60"
                      />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <label className="text-xs font-medium text-neutral-600">Bilde / vedlegg</label>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {detail?.photoUrl ? (
                          <div className="relative">
                            <img src={detail.photoUrl} alt="Avvik" className="h-20 w-24 rounded-lg object-cover ring-1 ring-amber-200" />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => hse.setChecklistItemDetail(round.id, item.id, { photoUrl: undefined })}
                                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-xs"
                              >×</button>
                            )}
                          </div>
                        ) : !isLocked ? (
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-white px-3 py-2 text-xs text-amber-700 hover:bg-amber-50">
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
                        ) : <span className="text-xs text-neutral-400">Ingen bilde</span>}
                      </div>
                    </div>

                    {/* Assignee + due date */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Tildel oppgave til</label>
                        <input
                          value={detail?.assignee ?? ''}
                          onChange={(e) => !isLocked && hse.setChecklistItemDetail(round.id, item.id, { assignee: e.target.value })}
                          disabled={isLocked}
                          placeholder="Navn / rolle"
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Frist</label>
                        <input
                          type="date"
                          value={detail?.dueDate ?? ''}
                          onChange={(e) => !isLocked && hse.setChecklistItemDetail(round.id, item.id, { dueDate: e.target.value })}
                          disabled={isLocked}
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {/* Per-item task link */}
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

        {/* Global notes */}
        <div className="mt-4">
          <label className="text-xs font-medium text-neutral-500">Generelle notater fra runden</label>
          <textarea
            value={round.notes}
            onChange={(e) => !isLocked && hse.updateSafetyRound(round.id, { notes: e.target.value })}
            disabled={isLocked}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </div>

      {/* ── Approval workflow ──────────────────────────────────────────────── */}
      <div className="border-t border-neutral-100 px-5 py-4">
        {round.status === 'in_progress' && (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-800">Send til leder for godkjenning</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Runden låses (read-only) når leder har godkjent. Loven krever at både verneombud og leder bekrefter resultatet.
              </p>
            </div>
            <button
              type="button"
              disabled={issueItems.some((i) => !round.itemDetails?.[i.id]?.description?.trim())}
              onClick={() => hse.submitRoundForApproval(round.id)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-40"
              title={issueItems.some((i) => !round.itemDetails?.[i.id]?.description?.trim()) ? 'Fyll inn beskrivelse for alle avvik først' : undefined}
            >
              <Send className="size-4" />
              Send til godkjenning
            </button>
          </div>
        )}

        {round.status === 'pending_approval' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">Venter på lederens godkjenning</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Sendt: {round.submittedForApprovalAt ? fmtDate(round.submittedForApprovalAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-900">Godkjenn som leder</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-600">Leders navn</label>
                  <input
                    value={approvalName}
                    onChange={(e) => setApprovalName(e.target.value)}
                    placeholder="Fullt navn"
                    className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Kommentar (valgfritt)</label>
                  <input
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Merknad til vernerunden"
                    className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!approvalName.trim()}
                onClick={() => {
                  void (async () => {
                    const ok = await hse.approveRound(round.id, {
                      approverName: approvalName.trim(),
                      approvedAt: new Date().toISOString(),
                      comment: approvalComment.trim() || undefined,
                    })
                    if (ok) {
                      setApprovalName('')
                      setApprovalComment('')
                    }
                  })()
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                <CheckCircle2 className="size-4" />
                Godkjenn vernerunde
              </button>
            </div>
          </div>
        )}

        {round.status === 'approved' && round.approval && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Godkjent av {round.approval.approverName}</p>
              <p className="whitespace-pre-line text-xs text-emerald-700">
                {fmtDate(round.approval.approvedAt)}
                {round.approval.comment ? ` · ${round.approval.comment}` : ''}
                {formatLevel1AuditLine(round.approval.level1) ? `\n${formatLevel1AuditLine(round.approval.level1)}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
