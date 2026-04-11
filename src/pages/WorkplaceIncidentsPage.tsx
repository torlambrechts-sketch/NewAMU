import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import { CheckCircle2, FileWarning, Plus, Trash2, X } from 'lucide-react'
import { useHse } from '../hooks/useHse'
import { useOrganisation } from '../hooks/useOrganisation'
import { useWorkplaceKpiStripStyle } from '../hooks/useWorkplaceKpiStripStyle'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { canEditIncidentRootCause, canViewIncident } from '../lib/incidentAccess'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeIncidentWizard } from '../components/wizard/wizards'
import type {
  Incident,
  IncidentCategory,
  IncidentFormTemplate,
  IncidentEvidencePhoto,
} from '../types/hse'
import { WorkplaceReportingHubMenu } from '../components/workplace/WorkplaceReportingHubMenu'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'

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
const HSE_INCIDENT_BUCKET = 'hse_incident_files'
const ARBEIDSTILSYNET_MELDING_URL = 'https://www.arbeidstilsynet.no/skjema/meldingsskjema/'

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
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
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

const FORM_TEMPLATES: { id: IncidentFormTemplate; label: string; showViolenceFields: boolean }[] = [
  { id: 'standard', label: 'Standard', showViolenceFields: false },
  { id: 'violence_school', label: 'Vold og trusler — skole', showViolenceFields: true },
  { id: 'violence_health', label: 'Vold og trusler — helse/omsorg', showViolenceFields: true },
  { id: 'deviation', label: 'Avvik fra intern rutine', showViolenceFields: false },
]

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' })
  } catch {
    return iso
  }
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
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

export function WorkplaceIncidentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const hse = useHse()
  const { supabaseConfigured, supabase, organization, profile, user, isAdmin, departments } = useOrgSetupContext()
  const org = useOrganisation()
  const { addTask } = useTasks()
  const { barStyle: kpiStripStyle } = useWorkplaceKpiStripStyle()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const employeePickList = useMemo(
    () => [...org.activeEmployees].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [org.activeEmployees],
  )

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

  const [incidentPanelId, setIncidentPanelId] = useState<string | null>(null)
  const [caDraft, setCaDraft] = useState<Record<string, { description: string; responsible: string; dueDate: string }>>(
    {},
  )

  const incidentPanelExisting =
    incidentPanelId && incidentPanelId !== '__new__' ? hse.incidents.find((i) => i.id === incidentPanelId) : undefined

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

  const incidentStats = useMemo(() => {
    const list = hse.incidents.filter((i) => canViewIncident(i, incidentViewerCtx))
    return {
      total: list.length,
      open: list.filter((i) => i.status !== 'closed').length,
      critical: list.filter((i) => i.severity === 'critical').length,
      high: list.filter((i) => i.severity === 'high').length,
    }
  }, [hse.incidents, incidentViewerCtx])

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

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    queueMicrotask(() => {
      openNewIncidentPanel()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('new')
          return next
        },
        { replace: true },
      )
    })
  }, [searchParams, setSearchParams, openNewIncidentPanel])

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

  useEffect(() => {
    if (!incidentPanelId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [incidentPanelId])

  useEffect(() => {
    if (!incidentPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIncidentPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [incidentPanelId, closeIncidentPanel])

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

  return (
    <div className={PAGE_WRAP}>
      {hse.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hse.error}</p>
      )}
      {hse.loading && supabaseConfigured && <p className="mb-4 text-sm text-neutral-500">Laster HMS-data…</p>}

      <WorkplacePageHeading1
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Arbeidsplassrapportering', to: '/workplace-reporting' },
          { label: 'Hendelser' },
        ]}
        title="Hendelser (HSE)"
        description="Ulykker, nestenulykker og avvik under arbeidsplassrapportering. Registrering i sidevindu med strukturerte felt, bildebevis og varsel ved høy alvorlighetsgrad (AML § 5-2)."
        headerActions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
        }
        menu={<WorkplaceReportingHubMenu incidentsBadgeCount={incidentStats.open} />}
      />

      <div className="mt-8 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`}
            style={kpiStripStyle}
          >
            <div className="text-2xl font-semibold">{incidentStats.total}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/85">I din liste</div>
          </div>
          <div
            className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`}
            style={kpiStripStyle}
          >
            <div className="text-2xl font-semibold">{incidentStats.open}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/85">Ikke lukket</div>
          </div>
          <div
            className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`}
            style={kpiStripStyle}
          >
            <div className="text-2xl font-semibold">{incidentStats.high}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/85">Høy</div>
          </div>
          <div
            className={`${R_FLAT} flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5`}
            style={kpiStripStyle}
          >
            <div className="text-2xl font-semibold">{incidentStats.critical}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/85">Kritisk</div>
          </div>
        </div>

        <Mainbox1
          title="Hendelseslogg"
          subtitle="Sortert etter tidspunkt. Åpne en rad for full redigering, dokumentasjon og oppfølgingsoppgaver."
        >
          <Table1Shell
            variant="pinpoint"
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
                <div
                  className={`${SETTINGS_LEAD} mb-4 rounded-none border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600`}
                >
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
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Avdeling velges fra organisasjonens enheter / avdelinger (felles nøkkel for rapporter).
                    </p>
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
                      Umiddelbare tiltak kan omsettes til Kanban-oppgave. Rotårsak fylles av nærmeste leder / saksbehandler.
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
                          incFollowTaskTitle.trim() || `Oppfølging: ${KIND_LABELS[incPanelKind].slice(0, 40)}`
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
                          requiresManagementSignOff: incPanelSeverity === 'high' || incPanelSeverity === 'critical',
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
                          !incidentPanelExisting ? true : !canEditIncidentRootCause(incidentPanelExisting, incidentViewerCtx)
                        }
                        className={`${SETTINGS_INPUT} mt-1.5 bg-white disabled:opacity-60`}
                      />
                      {incidentPanelExisting && !canEditIncidentRootCause(incidentPanelExisting, incidentViewerCtx) ? (
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
                        incidentPanelExisting.severity === 'high' || incidentPanelExisting.severity === 'critical'
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
    </div>
  )
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
