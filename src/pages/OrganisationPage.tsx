import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  LayoutGrid,
  List,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  PieChart,
  ChevronRight,
  ChevronDown,
  FileText,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { InfoBox } from '../components/ui/AlertBox'
import { ComplianceBanner } from '../components/ui/ComplianceBanner'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { OrganisationHeaderIllustration } from '../components/organisation/OrganisationHeaderIllustration'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import type { HubMenu1Item } from '../components/layout/HubMenu1Bar'
import {
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import { AB_SCORECARD_CREAM_DEEP } from './actionboard/actionBoardScorecardLayout'
import { WORKPLACE_FOREST } from '../components/layout/WorkplaceChrome'
import { WorkplaceBoardTabStrip } from '../components/layout/WorkplaceBoardTabStrip'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import {
  WorkplaceStandardFormPanel,
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INSET,
  WPSTD_FORM_INPUT_ON_WHITE,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import {
  WorkplaceStandardListLayout,
  WORKPLACE_LIST_LAYOUT_CTA,
  type WorkplaceListViewMode,
} from '../components/layout/WorkplaceStandardListLayout'
import type { EmploymentType, OrgEmployee, OrgEmployeeMandate, OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'
import { MANDATE_TYPE_LABELS, MANDATE_TYPE_LAW_REFS } from '../types/organisation'
import { fetchEnhetByOrgnr } from '../lib/brreg'

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<OrgUnitKind, string> = {
  division: 'Divisjon', department: 'Avdeling', team: 'Team', location: 'Lokasjon',
}
const KIND_COLORS: Record<OrgUnitKind, string> = {
  division: '#1a3d32', department: '#0284c7', team: '#059669', location: '#6b7280',
}
const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  permanent:              'Fast ansatt',
  temporary:              'Midlertidig (AML § 14-9)',
  intern:                 'Intern/lærling',
  agency_worker:          'Innleid (bemanningsbyrå) — teller i AML',
  independent_contractor: 'Selvstendig oppdragstaker',
  contractor:             'Konsulent/innleid (eldre)',
}

/** Employment types that count toward AML § 6-1 / § 7-1 thresholds */
const AML_COUNTING_TYPES = new Set<EmploymentType>(['permanent', 'temporary', 'intern', 'agency_worker', 'contractor'])
const ROLE_OPTIONS = ['Leder', 'Fagansvarlig', 'Fagmedarbeider', 'Saksbehandler', 'Verneombud', 'Tillitsvalgt', 'Konsulent', 'Annet']

/** Layout-reference «Dashboard (kompakt)»: tan KPI uten handlingsknapp. */
function OrgInsightTanStat({ big, title, sub }: { big: string; title: string; sub: string }) {
  return (
    <div
      className="rounded-lg border border-neutral-200/60 px-5 py-4"
      style={{ backgroundColor: AB_SCORECARD_CREAM_DEEP }}
    >
      <p className="text-3xl font-bold tabular-nums text-neutral-900">{big}</p>
      <p className="mt-1 text-sm font-medium text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-600">{sub}</p>
    </div>
  )
}

function OrgInsightWhiteCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

/** Matches ProjectDashboard — shell content column */
const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
/** Hero action row: same height & typography as «Ny ansatt» — square corners */
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
/** Inputs on this page — square corners */
const FILTER_INPUT_CLASS =
  'rounded-none border border-neutral-200/90 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'
/** Toolbar / segment controls — square corners */
const R_ORG_FLAT = 'rounded-none'

/** Innstillinger: tabellaktig rader — skarpe hjørner, tydelig hierarki */
const SETTINGS_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,380px)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_LEAD_ON_DARK = 'text-sm leading-relaxed text-white/90'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const SETTINGS_CHECK_WRAP =
  'mt-1.5 flex cursor-pointer items-start gap-3 rounded-none border border-neutral-300 bg-neutral-50/80 p-3'

/** Innstillinger-fanen: avrundet som layout-referanse Malbibliotek (rounded-md / rounded-lg). */
const ORG_SETTINGS_INPUT = SETTINGS_INPUT.replace('rounded-none', 'rounded-md')
const ORG_SETTINGS_CHECK_WRAP = SETTINGS_CHECK_WRAP.replace('rounded-none', 'rounded-lg')

/** Én samlet mørk panel for skjema (grupper/enheter) — kolonner med vertikal deler */
const ORG_MERGED_PANEL =
  'flex min-h-0 flex-col border border-black/15 lg:flex-row lg:items-stretch lg:divide-x lg:divide-white/15'
const ORG_MERGED_COL = 'min-w-0 flex-1 p-4 sm:p-5'
const ORG_MERGED_ACTION_COL =
  'flex shrink-0 flex-col justify-center border-t border-white/15 p-4 sm:p-5 lg:border-t-0 lg:border-l lg:border-white/15'
/** Feltetikett på mørk boks (ny brukergruppe) */
const SETTINGS_FIELD_LABEL_ON_DARK = 'text-[10px] font-bold uppercase tracking-wider text-white/90'
/** Inndata på mørk bakgrunn — hvitt felt */
const SETTINGS_INPUT_ON_DARK =
  'mt-1.5 w-full rounded-none border border-white/25 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white'

// ─── Mandate badge helper ─────────────────────────────────────────────────────
// Returns a Badge for roles that carry a formal statutory mandate.
const MANDATE_ROLES: Record<string, { label: string; variant: 'info' | 'warning' | 'success' }> = {
  Verneombud:   { label: 'Verneombud',   variant: 'info' },
  Tillitsvalgt: { label: 'Tillitsvalgt', variant: 'warning' },
  'HMS-ansvarlig': { label: 'HMS-ansvarlig', variant: 'success' },
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1a3d32','#0284c7','#7c3aed','#d97706','#dc2626','#0d9488','#9333ea','#2563eb']
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'employees' | 'units' | 'groups' | 'insights' | 'mandates' | 'gdpr' | 'settings'

const TAB_VALUES: Tab[] = ['insights', 'employees', 'units', 'groups', 'mandates', 'gdpr', 'settings']

function tabFromSearch(raw: string | null): Tab {
  if (raw === 'orgchart') return 'insights'
  if (raw && TAB_VALUES.includes(raw as Tab)) return raw as Tab
  return 'insights'
}

/** Virtual rows from `organization_members` use ids `m-{memberId}`; resolve to a persisted org employee by email when possible */
function storedForEdit(emp: OrgEmployee, employees: OrgEmployee[]): OrgEmployee {
  if (!emp.id.startsWith('m-')) return emp
  const email = emp.email?.trim().toLowerCase()
  if (email) {
    const found = employees.find((e) => e.email?.trim().toLowerCase() === email)
    if (found) return found
  }
  return emp
}

export function OrganisationPage() {
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)
  const rSeg = R_ORG_FLAT
  const org = useOrganisation()
  const { supabaseConfigured, organization: orgRow, members: orgMembers, profile, user, isDemoMode } =
    useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = useMemo(() => tabFromSearch(searchParams.get('tab')), [searchParams])
  const setTab = useCallback(
    (id: Tab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id === 'insights') next.delete('tab')
          else next.set('tab', id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    if (searchParams.get('tab') === 'orgchart') {
      navigate({ pathname: '/organisation', search: '' }, { replace: true })
    }
  }, [searchParams, navigate])
  type OrgSlidePanel =
    | null
    | { kind: 'employee'; mode: 'create' | 'edit'; emp?: OrgEmployee }
    | { kind: 'unit'; mode: 'create' | 'edit'; unit?: OrgUnit }
    | { kind: 'group'; mode: 'create' | 'edit'; group?: UserGroup }

  const [orgSlidePanel, setOrgSlidePanel] = useState<OrgSlidePanel>(null)

  const [empFormPanel, setEmpFormPanel] = useState({
    name: '',
    email: '',
    phone: '',
    jobTitle: '',
    role: '',
    unitId: '',
    reportsToId: '',
    location: '',
    employmentType: 'permanent' as EmploymentType,
    agencyName: '',
    startDate: '',
    active: true,
  })
  const [searchEmp, setSearchEmp] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [empSegment, setEmpSegment] = useState<'all' | 'active' | 'inactive'>('all')
  const [empLayout, setEmpLayout] = useState<'list' | 'box'>('list')
  /** WorkplaceStandardListLayout (Ansatte / Enheter / Brukergrupper) */
  const [empStdFiltersOpen, setEmpStdFiltersOpen] = useState(false)
  const [empStdSort, setEmpStdSort] = useState<'name' | 'unit' | 'role' | 'status'>('name')
  const [empStdViewMode, setEmpStdViewMode] = useState<WorkplaceListViewMode>('table')
  const [unitStdFiltersOpen, setUnitStdFiltersOpen] = useState(false)
  const [unitStdSort, setUnitStdSort] = useState<'name' | 'kind' | 'head' | 'staff'>('name')
  const [unitStdViewMode, setUnitStdViewMode] = useState<WorkplaceListViewMode>('table')
  const [groupStdFiltersOpen, setGroupStdFiltersOpen] = useState(false)
  const [groupStdSearch, setGroupStdSearch] = useState('')
  const [groupStdSort, setGroupStdSort] = useState<'name' | 'scope'>('name')
  const [groupStdViewMode, setGroupStdViewMode] = useState<WorkplaceListViewMode>('table')

  const [unitSearch, setUnitSearch] = useState('')
  const [unitKindSeg, setUnitKindSeg] = useState<'all' | OrgUnitKind>('all')
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => new Set())

  // Unit form
  const [unitForm, setUnitForm] = useState({
    name: '', kind: 'department' as OrgUnitKind, parentId: '', headName: '', color: '#0284c7',
  })

  // Group form
  const [groupForm, setGroupForm] = useState({
    name: '', description: '', scopeKind: 'all' as UserGroup['scope']['kind'],
    unitIds: [] as string[], employeeIds: [] as string[],
  })

  const { complianceThresholds: ct } = org

  const filteredEmployees = useMemo(() => {
    return org.displayEmployees.filter((e) => {
      const matchSearch = !searchEmp || e.name.toLowerCase().includes(searchEmp.toLowerCase()) ||
        e.jobTitle?.toLowerCase().includes(searchEmp.toLowerCase()) ||
        e.email?.toLowerCase().includes(searchEmp.toLowerCase())
      const matchUnit = !filterUnit || e.unitId === filterUnit
      const matchSeg =
        empSegment === 'all' ? true : empSegment === 'active' ? e.active : !e.active
      return matchSearch && matchUnit && matchSeg
    })
  }, [org.displayEmployees, searchEmp, filterUnit, empSegment])

  const sortedFilteredEmployees = useMemo(() => {
    const list = [...filteredEmployees]
    list.sort((a, b) => {
      if (empStdSort === 'name') return a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
      if (empStdSort === 'unit') {
        return (
          (a.unitName ?? '').localeCompare(b.unitName ?? '', 'nb', { sensitivity: 'base' }) ||
          a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
        )
      }
      if (empStdSort === 'role') {
        return (
          (a.role ?? '').localeCompare(b.role ?? '', 'nb', { sensitivity: 'base' }) ||
          a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
        )
      }
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
    })
    return list
  }, [filteredEmployees, empStdSort])

  const hasAnyEmployees = org.displayEmployees.length > 0

  const companyTitle = orgRow?.name?.trim() || org.settings.orgName || 'Organisasjon'
  const memberHeadline =
    supabaseConfigured && orgMembers.length > 0
      ? `${orgMembers.length} medlem${orgMembers.length === 1 ? '' : 'er'} i organisasjonen`
      : `${org.activeEmployees.length} aktive ansatte · ${org.units.length} enheter`

  const closeOrgSlidePanel = useCallback(() => {
    setOrgSlidePanel(null)
  }, [setOrgSlidePanel])

  useEffect(() => {
    if (!orgSlidePanel || orgSlidePanel.kind !== 'employee') return
    const initial = orgSlidePanel.mode === 'edit' && orgSlidePanel.emp ? orgSlidePanel.emp : null
    // Sync draft fields when opening the employee panel (create vs edit / different row).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset form to match panel target
    setEmpFormPanel({
      name: initial?.name ?? '',
      email: initial?.email ?? '',
      phone: initial?.phone ?? '',
      jobTitle: initial?.jobTitle ?? '',
      role: initial?.role ?? '',
      unitId: initial?.unitId ?? '',
      reportsToId: initial?.reportsToId ?? '',
      location: initial?.location ?? '',
      employmentType: initial?.employmentType ?? 'permanent',
      agencyName: initial?.agencyName ?? '',
      startDate: initial?.startDate ?? '',
      active: initial?.active ?? true,
    })
  }, [orgSlidePanel])

  useEffect(() => {
    if (!orgSlidePanel) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [orgSlidePanel])

  function buildGroupScopeFromForm(): UserGroup['scope'] {
    if (groupForm.scopeKind === 'all') return { kind: 'all' }
    if (groupForm.scopeKind === 'units') return { kind: 'units', unitIds: groupForm.unitIds }
    if (groupForm.scopeKind === 'employees') return { kind: 'employees', employeeIds: groupForm.employeeIds }
    return { kind: 'mixed', unitIds: groupForm.unitIds, employeeIds: groupForm.employeeIds }
  }

  function submitUnitPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!unitForm.name.trim()) return
    if (orgSlidePanel?.kind === 'unit' && orgSlidePanel.mode === 'edit' && orgSlidePanel.unit) {
      org.updateUnit(orgSlidePanel.unit.id, {
        name: unitForm.name.trim(),
        kind: unitForm.kind,
        parentId: unitForm.parentId || undefined,
        headName: unitForm.headName || undefined,
        color: unitForm.color,
      })
    } else {
      org.createUnit(unitForm.name, unitForm.kind, unitForm.parentId || undefined, {
        headName: unitForm.headName || undefined,
        color: unitForm.color,
      })
    }
    closeOrgSlidePanel()
    setUnitForm({ name: '', kind: 'department', parentId: '', headName: '', color: '#0284c7' })
  }

  function submitGroupPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!groupForm.name.trim()) return
    const scope = buildGroupScopeFromForm()
    if (orgSlidePanel?.kind === 'group' && orgSlidePanel.mode === 'edit' && orgSlidePanel.group) {
      org.updateGroup(orgSlidePanel.group.id, {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        scope,
      })
    } else {
      org.createGroup(groupForm.name, groupForm.description, scope)
    }
    closeOrgSlidePanel()
    setGroupForm({ name: '', description: '', scopeKind: 'all', unitIds: [], employeeIds: [] })
  }

  function submitEmpPanel(e: React.FormEvent) {
    e.preventDefault()
    if (!empFormPanel.name.trim()) return
    const unit = org.units.find((u) => u.id === empFormPanel.unitId)
    const manager = org.employees.find((x) => x.id === empFormPanel.reportsToId)
    const data: Omit<OrgEmployee, 'id' | 'createdAt' | 'updatedAt'> = {
      name: empFormPanel.name.trim(),
      email: empFormPanel.email || undefined,
      phone: empFormPanel.phone || undefined,
      jobTitle: empFormPanel.jobTitle || undefined,
      role: empFormPanel.role || undefined,
      unitId: empFormPanel.unitId || undefined,
      unitName: unit?.name,
      reportsToId: empFormPanel.reportsToId || undefined,
      reportsToName: manager?.name,
      location: empFormPanel.location || undefined,
      employmentType: empFormPanel.employmentType,
      agencyName: empFormPanel.employmentType === 'agency_worker' ? (empFormPanel.agencyName || undefined) : undefined,
      startDate: empFormPanel.startDate || undefined,
      active: empFormPanel.active,
    }
    if (orgSlidePanel?.kind === 'employee' && orgSlidePanel.mode === 'edit' && orgSlidePanel.emp) {
      const target = storedForEdit(orgSlidePanel.emp, org.employees)
      if (target.id.startsWith('m-')) {
        org.createEmployee(data)
      } else {
        org.updateEmployee(target.id, data)
      }
    } else {
      org.createEmployee(data)
    }
    closeOrgSlidePanel()
  }

  const openUnitPanel = useCallback((mode: 'create' | 'edit', unit?: OrgUnit) => {
    if (mode === 'create') {
      setUnitForm({ name: '', kind: 'department', parentId: '', headName: '', color: '#0284c7' })
      setOrgSlidePanel({ kind: 'unit', mode: 'create' })
    } else if (unit) {
      setUnitForm({
        name: unit.name,
        kind: unit.kind,
        parentId: unit.parentId ?? '',
        headName: unit.headName ?? '',
        color: unit.color ?? KIND_COLORS[unit.kind],
      })
      setOrgSlidePanel({ kind: 'unit', mode: 'edit', unit })
    }
  }, [setOrgSlidePanel, setUnitForm])

  /** Legacy units/groups tabs (non–standard-list) still use inline forms */
  function handleCreateUnitLegacy(e: React.FormEvent) {
    e.preventDefault()
    if (!unitForm.name.trim()) return
    org.createUnit(unitForm.name, unitForm.kind, unitForm.parentId || undefined, {
      headName: unitForm.headName || undefined,
      color: unitForm.color,
    })
    setUnitForm((f) => ({ ...f, name: '', headName: '' }))
  }

  const openGroupPanel = useCallback((mode: 'create' | 'edit', group?: UserGroup) => {
    if (mode === 'create') {
      setGroupForm({ name: '', description: '', scopeKind: 'all', unitIds: [], employeeIds: [] })
      setOrgSlidePanel({ kind: 'group', mode: 'create' })
    } else if (group) {
      const sc = group.scope
      let scopeKind: UserGroup['scope']['kind'] = 'all'
      let unitIds: string[] = []
      let employeeIds: string[] = []
      if (sc.kind === 'all') scopeKind = 'all'
      else if (sc.kind === 'units') {
        scopeKind = 'units'
        unitIds = [...sc.unitIds]
      } else if (sc.kind === 'employees') {
        scopeKind = 'employees'
        employeeIds = [...sc.employeeIds]
      } else {
        scopeKind = 'mixed'
        unitIds = [...sc.unitIds]
        employeeIds = [...sc.employeeIds]
      }
      setGroupForm({
        name: group.name,
        description: group.description ?? '',
        scopeKind,
        unitIds,
        employeeIds,
      })
      setOrgSlidePanel({ kind: 'group', mode: 'edit', group })
    }
  }, [setOrgSlidePanel, setGroupForm])

  const unitRowsFlat = useMemo(() => {
    const byParent = (pid: string | undefined) =>
      org.units.filter((u) => u.parentId === pid).sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    const rows: { unit: OrgUnit; depth: number; hasChildren: boolean }[] = []
    const walk = (parentId: string | undefined, depth: number) => {
      for (const u of byParent(parentId)) {
        const hasChildren = org.units.some((x) => x.parentId === u.id)
        rows.push({ unit: u, depth, hasChildren })
        if (expandedUnits.has(u.id)) walk(u.id, depth + 1)
      }
    }
    walk(undefined, 0)
    return rows
  }, [org.units, expandedUnits])

  const filteredUnitRows = useMemo(() => {
    const q = unitSearch.trim().toLowerCase()
    return unitRowsFlat.filter(({ unit }) => {
      const matchKind = unitKindSeg === 'all' || unit.kind === unitKindSeg
      const matchSearch =
        !q ||
        unit.name.toLowerCase().includes(q) ||
        (unit.headName ?? '').toLowerCase().includes(q) ||
        (unit.managerName ?? '').toLowerCase().includes(q) ||
        KIND_LABELS[unit.kind].toLowerCase().includes(q)
      return matchKind && matchSearch
    })
  }, [unitRowsFlat, unitSearch, unitKindSeg])

  const sortedFilteredUnitRows = useMemo(() => {
    const list = [...filteredUnitRows]
    list.sort((a, b) => {
      const ua = a.unit
      const ub = b.unit
      if (unitStdSort === 'name') return ua.name.localeCompare(ub.name, 'nb', { sensitivity: 'base' })
      if (unitStdSort === 'kind') {
        return (
          KIND_LABELS[ua.kind].localeCompare(KIND_LABELS[ub.kind], 'nb') ||
          ua.name.localeCompare(ub.name, 'nb', { sensitivity: 'base' })
        )
      }
      if (unitStdSort === 'head') {
        const ha = (ua.headName ?? ua.managerName ?? '').toLowerCase()
        const hb = (ub.headName ?? ub.managerName ?? '').toLowerCase()
        return ha.localeCompare(hb, 'nb') || ua.name.localeCompare(ub.name, 'nb', { sensitivity: 'base' })
      }
      const ca = org.displayEmployees.filter((e) => e.unitId === ua.id && e.active).length
      const cb = org.displayEmployees.filter((e) => e.unitId === ub.id && e.active).length
      if (cb !== ca) return cb - ca
      return ua.name.localeCompare(ub.name, 'nb', { sensitivity: 'base' })
    })
    return list
  }, [filteredUnitRows, unitStdSort, org.displayEmployees])

  const groupsStdFiltered = useMemo(() => {
    const q = groupStdSearch.trim().toLowerCase()
    let list = [...org.groups]
    if (q) {
      list = list.filter((g) => {
        const scopeLabel = org.getGroupLabel(g).toLowerCase()
        return (
          g.name.toLowerCase().includes(q) ||
          scopeLabel.includes(q) ||
          (g.description ?? '').toLowerCase().includes(q)
        )
      })
    }
    list.sort((a, b) => {
      if (groupStdSort === 'name') return a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
      return (
        org.getGroupLabel(a).localeCompare(org.getGroupLabel(b), 'nb', { sensitivity: 'base' }) ||
        a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' })
      )
    })
    return list
  }, [org.groups, org, groupStdSearch, groupStdSort])

  const toggleUnitExpanded = useCallback((id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ─── Brreg sync state ───────────────────────────────────────────────────────
  const [brregSyncing, setBrregSyncing] = useState(false)
  const [brregError, setBrregError] = useState<string | null>(null)
  const [brregSuccess, setBrregSuccess] = useState(false)

  const handleBrregSync = useCallback(async () => {
    const orgnr = org.settings.orgNumber?.replace(/\D/g, '')
    if (!orgnr || orgnr.length !== 9) {
      setBrregError('Fyll inn et gyldig 9-sifret organisasjonsnummer først.')
      return
    }
    setBrregSyncing(true)
    setBrregError(null)
    setBrregSuccess(false)
    try {
      const enhet = await fetchEnhetByOrgnr(orgnr)
      org.updateSettings({
        orgName: enhet.navn ?? org.settings.orgName,
        brregAntallAnsatte: enhet.antallAnsatte,
        brregNaceKode: enhet.naeringskode1?.kode,
        brregNaceBeskrivelse: enhet.naeringskode1?.beskrivelse,
        brregOrgForm: enhet.organisasjonsform?.kode,
        brregSyncedAt: new Date().toISOString(),
        industrySector: enhet.naeringskode1?.beskrivelse ?? org.settings.industrySector,
      })
      setBrregSuccess(true)
    } catch (err) {
      setBrregError(err instanceof Error ? err.message : 'Ukjent feil fra Brreg.')
    } finally {
      setBrregSyncing(false)
    }
  }, [org])

  // ─── DPIA checklist state ───────────────────────────────────────────────────
  const [dpiaAnswers, setDpiaAnswers] = useState({ systematicMonitoring: false, profiling: false, sensitiveCategories: false })

  // ─── Mandates derived list ──────────────────────────────────────────────────
  const allMandates = useMemo(() => {
    const rows: { employee: OrgEmployee; mandate: OrgEmployeeMandate }[] = []
    for (const emp of org.displayEmployees) {
      if (emp.mandates?.length) {
        for (const m of emp.mandates) rows.push({ employee: emp, mandate: m })
      } else if (emp.role && ['Verneombud', 'Tillitsvalgt', 'HMS-ansvarlig'].includes(emp.role)) {
        const mandateType: OrgEmployeeMandate['mandateType'] =
          emp.role === 'Verneombud' ? 'verneombud' :
          emp.role === 'Tillitsvalgt' ? 'tillitsvalgt' : 'hms_ansvarlig'
        rows.push({
          employee: emp,
          mandate: {
            id: `derived-${emp.id}`,
            mandateType,
            startDate: emp.startDate ?? emp.createdAt,
            lawRef: MANDATE_TYPE_LAW_REFS[mandateType],
            scope: emp.unitName ?? 'Hele virksomheten',
          },
        })
      }
    }
    return rows.sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'nb'))
  }, [org.displayEmployees])

  const insightStats = useMemo(() => {
    const byKind = org.units.reduce(
      (acc, u) => {
        acc[u.kind] = (acc[u.kind] ?? 0) + 1
        return acc
      },
      {} as Partial<Record<OrgUnitKind, number>>,
    )
    const inactiveCount = org.displayEmployees.filter((e) => !e.active).length
    const rootUnits = org.units.filter((u) => !u.parentId).length
    return {
      members: orgMembers.length,
      employeesTotal: org.displayEmployees.length,
      employeesActive: org.activeEmployees.length,
      employeesInactive: inactiveCount,
      units: org.units.length,
      unitsTopLevel: rootUnits,
      groups: org.groups.length,
      byKind,
    }
  }, [org, orgMembers])

  const orgInsightKindBars = useMemo(() => {
    const kinds = ['division', 'department', 'team', 'location'] as const
    const rows = kinds.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      count: insightStats.byKind[kind] ?? 0,
    }))
    rows.sort((a, b) => b.count - a.count)
    const max = Math.max(...rows.map((r) => r.count), 1)
    const colors = ['#2563eb', '#dc2626', WORKPLACE_FOREST, '#ea580c'] as const
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length], max }))
  }, [insightStats.byKind])

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'insights',   label: 'Oversikt',         icon: PieChart },
    { id: 'employees',  label: 'Ansatte',           icon: Users },
    { id: 'units',      label: 'Enheter',           icon: Building2 },
    { id: 'groups',     label: 'Brukergrupper',     icon: UserCheck },
    { id: 'mandates',   label: 'Roller & verv',     icon: Shield },
    { id: 'gdpr',       label: 'GDPR & personvern', icon: Lock },
    { id: 'settings',   label: 'Innstillinger',     icon: Settings2 },
  ]

  const orgTabItems = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badgeCount: t.id === 'employees' ? org.activeEmployees.length : undefined,
  }))

  const tabLabel = TABS.find((x) => x.id === tab)?.label ?? 'Organisasjon'
  const useStandardOrgList =
    tab === 'insights' || tab === 'employees' || tab === 'units' || tab === 'groups' || tab === 'mandates' || tab === 'gdpr'

  const orgHubMenuItems = useMemo((): HubMenu1Item[] => {
    return TABS.map((t) => ({
      key: t.id,
      label: t.label,
      icon: t.icon as HubMenu1Item['icon'],
      active: tab === t.id,
      onClick: () => setTab(t.id),
      badgeCount: t.id === 'employees' ? org.activeEmployees.length : undefined,
    }))
  }, [tab, org.activeEmployees.length, setTab])

  const editingEmpId =
    orgSlidePanel?.kind === 'employee' && orgSlidePanel.mode === 'edit' && orgSlidePanel.emp
      ? orgSlidePanel.emp.id
      : undefined

  const orgStandardListOverlay =
    orgSlidePanel?.kind === 'employee' ? (
      <WorkplaceStandardFormPanel
        open
        onClose={closeOrgSlidePanel}
        titleId="org-emp-panel-title"
        title={orgSlidePanel.mode === 'edit' ? 'Rediger ansatt' : 'Ny ansatt'}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              form="org-emp-slide-form"
              disabled={!empFormPanel.name.trim()}
              className="flex w-full items-center justify-center rounded-none px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[12rem]"
              style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
            >
              {orgSlidePanel.mode === 'edit' ? 'Lagre ansatt' : 'Opprett ansatt'}
            </button>
            <button
              type="button"
              onClick={closeOrgSlidePanel}
              className="w-full rounded-none border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200/40 sm:w-auto"
            >
              Avbryt
            </button>
          </div>
        }
      >
        <form id="org-emp-slide-form" onSubmit={submitEmpPanel} className="space-y-0">
          <ComplianceBanner title="Personopplysninger (GDPR)">
            Navn, e-post og telefon er personopplysninger behandlet med grunnlag i arbeidskontrakt (GDPR Art. 6 (1) b)
            og arbeidsmiljøloven §§ 3-1, 6-1, 7-1. Ansatte har rett til innsyn, retting og sletting av egne data.
          </ComplianceBanner>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Grunnleggende</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Navn, kontakt og tilknytning til enhet.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-name">
                    Fullt navn *
                  </label>
                  <input
                    id="org-emp-name"
                    value={empFormPanel.name}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, name: e.target.value }))}
                    required
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    placeholder="Fornavn Etternavn"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-email">
                    E-post
                  </label>
                  <input
                    id="org-emp-email"
                    type="email"
                    value={empFormPanel.email}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, email: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    placeholder="navn@firma.no"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-phone">
                    Telefon
                  </label>
                  <input
                    id="org-emp-phone"
                    type="tel"
                    value={empFormPanel.phone}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, phone: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    placeholder="+47 …"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-job">
                    Stillingstittel
                  </label>
                  <input
                    id="org-emp-job"
                    value={empFormPanel.jobTitle}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, jobTitle: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-role">
                    Rollekategori
                  </label>
                  <select
                    id="org-emp-role"
                    value={empFormPanel.role}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, role: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    <option value="">— Velg —</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-unit">
                    Avdeling / team
                  </label>
                  <select
                    id="org-emp-unit"
                    value={empFormPanel.unitId}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, unitId: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    <option value="">— Ingen —</option>
                    {org.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({KIND_LABELS[u.kind]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-reports">
                    Rapporterer til
                  </label>
                  <select
                    id="org-emp-reports"
                    value={empFormPanel.reportsToId}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, reportsToId: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    <option value="">— Ingen —</option>
                    {org.employees
                      .filter((e) => e.id !== editingEmpId && e.active)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.jobTitle ? ` — ${e.jobTitle}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="my-8 border-t border-neutral-200/90" />
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Ansettelse</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Type, startdato og om posten er aktiv.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-loc">
                    Arbeidssted
                  </label>
                  <input
                    id="org-emp-loc"
                    value={empFormPanel.location}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, location: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-etype">
                    Ansettelsestype
                  </label>
                  <select
                    id="org-emp-etype"
                    value={empFormPanel.employmentType}
                    onChange={(e) =>
                      setEmpFormPanel((f) => ({ ...f, employmentType: e.target.value as EmploymentType }))
                    }
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    {Object.entries(EMPLOYMENT_LABELS)
                      .filter(([k]) => k !== 'contractor')
                      .map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                  </select>
                  {AML_COUNTING_TYPES.has(empFormPanel.employmentType) ? (
                    <p className="mt-1 text-[11px] text-emerald-700">Teller i AML-terskler (verneombud/AMU)</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-neutral-500">Teller IKKE i AML-terskler</p>
                  )}
                </div>
                {empFormPanel.employmentType === 'agency_worker' && (
                  <div className="sm:col-span-2">
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-agency">
                      Bemanningsbyrå
                    </label>
                    <input
                      id="org-emp-agency"
                      value={empFormPanel.agencyName}
                      onChange={(e) => setEmpFormPanel((f) => ({ ...f, agencyName: e.target.value }))}
                      placeholder="Navn på bemanningsbyrå (AML § 14-12)"
                      className={WPSTD_FORM_INPUT_ON_WHITE}
                    />
                  </div>
                )}
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-emp-start">
                    Startdato
                  </label>
                  <input
                    id="org-emp-start"
                    type="date"
                    value={empFormPanel.startDate}
                    onChange={(e) => setEmpFormPanel((f) => ({ ...f, startDate: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={empFormPanel.active}
                      onChange={(e) => setEmpFormPanel((f) => ({ ...f, active: e.target.checked }))}
                      className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                    />
                    Aktiv ansatt
                  </label>
                </div>
              </div>
            </div>
          </div>
        </form>
      </WorkplaceStandardFormPanel>
    ) : orgSlidePanel?.kind === 'unit' ? (
      <WorkplaceStandardFormPanel
        open
        onClose={closeOrgSlidePanel}
        titleId="org-unit-panel-title"
        title={orgSlidePanel.mode === 'edit' ? 'Rediger enhet' : 'Ny enhet'}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              form="org-unit-slide-form"
              disabled={!unitForm.name.trim()}
              className="flex w-full items-center justify-center rounded-none px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[12rem]"
              style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
            >
              {orgSlidePanel.mode === 'edit' ? 'Lagre enhet' : 'Opprett enhet'}
            </button>
            {orgSlidePanel.mode === 'edit' ? (
              <button
                type="button"
                onClick={() => {
                  if (orgSlidePanel.unit && confirm(`Slett «${orgSlidePanel.unit.name}»?`)) {
                    org.deleteUnit(orgSlidePanel.unit.id)
                    closeOrgSlidePanel()
                  }
                }}
                className="w-full rounded-none border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100 sm:w-auto"
              >
                Slett enhet
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeOrgSlidePanel}
              className="w-full rounded-none border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200/40 sm:w-auto"
            >
              Avbryt
            </button>
          </div>
        }
      >
        <form id="org-unit-slide-form" onSubmit={submitUnitPanel} className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Struktur</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Navn, type og overordnet enhet.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-unit-slide-name">
                    Navn *
                  </label>
                  <input
                    id="org-unit-slide-name"
                    value={unitForm.name}
                    onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-unit-slide-kind">
                    Type
                  </label>
                  <select
                    id="org-unit-slide-kind"
                    value={unitForm.kind}
                    onChange={(e) => setUnitForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    {Object.entries(KIND_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-unit-slide-parent">
                    Overordnet enhet
                  </label>
                  <select
                    id="org-unit-slide-parent"
                    value={unitForm.parentId}
                    onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    <option value="">— Ingen (toppnivå) —</option>
                    {org.units
                      .filter((u) => u.id !== orgSlidePanel.unit?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="my-8 border-t border-neutral-200/90" />
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Visning</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Leder og farge i org.kart.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-unit-slide-head">
                    Leder / enhetshode
                  </label>
                  <input
                    id="org-unit-slide-head"
                    value={unitForm.headName}
                    onChange={(e) => setUnitForm((f) => ({ ...f, headName: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-unit-slide-color">
                    Farge (org.kart)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="org-unit-slide-color"
                      type="color"
                      value={unitForm.color}
                      onChange={(e) => setUnitForm((f) => ({ ...f, color: e.target.value }))}
                      className="h-10 w-16 cursor-pointer rounded-none border border-neutral-300 bg-white"
                    />
                    <span className="text-xs text-neutral-500">{unitForm.color}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </WorkplaceStandardFormPanel>
    ) : orgSlidePanel?.kind === 'group' ? (
      <WorkplaceStandardFormPanel
        open
        onClose={closeOrgSlidePanel}
        titleId="org-group-panel-title"
        title={orgSlidePanel.mode === 'edit' ? 'Rediger brukergruppe' : 'Ny brukergruppe'}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              form="org-group-slide-form"
              disabled={!groupForm.name.trim()}
              className="flex w-full items-center justify-center rounded-none px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[12rem]"
              style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
            >
              {orgSlidePanel.mode === 'edit' ? 'Lagre gruppe' : 'Opprett gruppe'}
            </button>
            {orgSlidePanel.mode === 'edit' ? (
              <button
                type="button"
                onClick={() => {
                  if (orgSlidePanel.group && confirm(`Slett «${orgSlidePanel.group.name}»?`)) {
                    org.deleteGroup(orgSlidePanel.group.id)
                    closeOrgSlidePanel()
                  }
                }}
                className="w-full rounded-none border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100 sm:w-auto"
              >
                Slett gruppe
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeOrgSlidePanel}
              className="w-full rounded-none border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200/40 sm:w-auto"
            >
              Avbryt
            </button>
          </div>
        }
      >
        <form id="org-group-slide-form" onSubmit={submitGroupPanel} className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Gruppe</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Navn og kort beskrivelse.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-group-slide-name">
                    Gruppenavn *
                  </label>
                  <input
                    id="org-group-slide-name"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-group-slide-desc">
                    Beskrivelse
                  </label>
                  <input
                    id="org-group-slide-desc"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    placeholder="Valgfritt"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="my-8 border-t border-neutral-200/90" />
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Omfang</h3>
              <p className={`${WPSTD_FORM_LEAD} mt-2`}>Hvem gruppen skal omfatte.</p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              <div className="space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="org-group-slide-scope">
                    Omfang
                  </label>
                  <select
                    id="org-group-slide-scope"
                    value={groupForm.scopeKind}
                    onChange={(e) =>
                      setGroupForm((f) => ({
                        ...f,
                        scopeKind: e.target.value as typeof groupForm.scopeKind,
                        unitIds: e.target.value === 'employees' ? [] : f.unitIds,
                        employeeIds: e.target.value === 'units' ? [] : f.employeeIds,
                      }))
                    }
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                  >
                    <option value="all">Alle ansatte</option>
                    <option value="units">Bestemte enheter</option>
                    <option value="employees">Bestemte ansatte</option>
                    <option value="mixed">Enheter + ansatte</option>
                  </select>
                </div>
                {(groupForm.scopeKind === 'units' || groupForm.scopeKind === 'mixed') && (
                  <div>
                    <p className={WPSTD_FORM_FIELD_LABEL}>Velg enheter</p>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2">
                      {org.units.length === 0 ? (
                        <p className="text-xs text-neutral-500">Ingen enheter.</p>
                      ) : (
                        org.units.map((u) => (
                          <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={groupForm.unitIds.includes(u.id)}
                              onChange={(e) =>
                                setGroupForm((f) => ({
                                  ...f,
                                  unitIds: e.target.checked
                                    ? [...f.unitIds, u.id]
                                    : f.unitIds.filter((id) => id !== u.id),
                                }))
                              }
                              className="size-4 rounded border-neutral-300 text-[#1a3d32]"
                            />
                            {u.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
                {(groupForm.scopeKind === 'employees' || groupForm.scopeKind === 'mixed') && (
                  <div>
                    <p className={WPSTD_FORM_FIELD_LABEL}>Velg ansatte</p>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2">
                      {org.activeEmployees.length === 0 ? (
                        <p className="text-xs text-neutral-500">Ingen aktive ansatte.</p>
                      ) : (
                        org.activeEmployees.map((emp) => (
                          <label key={emp.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={groupForm.employeeIds.includes(emp.id)}
                              onChange={(e) =>
                                setGroupForm((f) => ({
                                  ...f,
                                  employeeIds: e.target.checked
                                    ? [...f.employeeIds, emp.id]
                                    : f.employeeIds.filter((id) => id !== emp.id),
                                }))
                              }
                              className="size-4 rounded border-neutral-300 text-[#1a3d32]"
                            />
                            <span>
                              {emp.name}
                              {emp.jobTitle ? (
                                <span className="ml-1 text-xs text-neutral-500">{emp.jobTitle}</span>
                              ) : null}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </WorkplaceStandardFormPanel>
    ) : null

  return (
    <div className={PAGE_WRAP}>
      {isDemoMode && (
        <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Demomodus</strong> — du er koblet til en anonym sesjon med forhåndsutfylt
          data i databasen. Endringer lagres i demoområdet. For å bruke egen organisasjon,{' '}
          <Link to="/login" className="font-medium text-[#1a3d32] underline underline-offset-2">
            logg inn
          </Link>
          .
        </div>
      )}
      {org.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {org.error}
        </p>
      )}
      {org.loading && supabaseConfigured && (
        <p className="mb-4 text-sm text-neutral-500">Laster organisasjonsdata…</p>
      )}
      <div className="mt-2 w-full space-y-6 font-[Inter,system-ui,sans-serif] text-[#171717]">
        {!useStandardOrgList ? (
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Organisasjon' }, { label: tabLabel }]}
            title={companyTitle}
            description={
              <>
                <p className="text-sm text-neutral-500">{memberHeadline}</p>
                <p className="mt-2 max-w-2xl leading-relaxed">
                  Struktur, ansatte og grupper for virksomheten. Terskler for verneombud og AMU oppdateres ut fra antall
                  ansatte.
                </p>
                {supabaseConfigured && user ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    {isDemoMode ? 'Demo-besøkende (anonym sesjon)' : 'Innlogget som'}{' '}
                    {!isDemoMode && (profile?.display_name ?? profile?.email ?? user.email ?? 'bruker')}
                  </p>
                ) : null}
              </>
            }
            headerActions={
              tab === 'settings' ? (
                <div className="hidden shrink-0 justify-center sm:flex" aria-hidden>
                  <OrganisationHeaderIllustration className="h-[7.5rem] w-auto max-w-[min(100%,220px)] md:h-32" />
                </div>
              ) : (
                <>
                  <div className="hidden shrink-0 justify-center sm:flex" aria-hidden>
                    <OrganisationHeaderIllustration className="h-[7.5rem] w-auto max-w-[min(100%,220px)] md:h-32" />
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                      {ct.totalEmployeeCount} i beregning
                    </span>
                    {ct.requiresVerneombud ? (
                      <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-800`}>
                        <CheckCircle2 className="size-4 shrink-0" />
                        Verneombud lovpålagt
                      </span>
                    ) : (
                      <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-600`}>Verneombud: &lt;5</span>
                    )}
                    {ct.requiresAmu ? (
                      <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-800`}>
                        <CheckCircle2 className="size-4 shrink-0" />
                        AMU lovpålagt
                      </span>
                    ) : ct.mayRequestAmu ? (
                      <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-900`}>
                        <AlertTriangle className="size-4 shrink-0" />
                        AMU kan kreves
                      </span>
                    ) : (
                      <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-600`}>AMU: &lt;10</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'create' })}
                      className={`${HERO_ACTION_CLASS} text-white shadow-sm hover:opacity-95`}
                      style={{ backgroundColor: WORKPLACE_FOREST }}
                    >
                      <Plus className="size-4 shrink-0" /> Ny ansatt
                    </button>
                  </div>
                </>
              )
            }
            menu={
              <WorkplaceBoardTabStrip
                ariaLabel="Organisasjon — faner"
                items={orgTabItems}
                activeId={tab}
                onSelect={(id) => setTab(id as Tab)}
              />
            }
          />
        ) : null}

        {tab === 'insights' ? (
          <WorkplaceStandardListLayout
            className="!mt-0"
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Organisasjon' }, { label: 'Oversikt' }]}
            title="Oversikt"
            description={
              <>
                <p className="text-sm text-neutral-500">{memberHeadline}</p>
                <p className="mt-2 max-w-2xl leading-relaxed">
                  {ct.totalEmployeeCount} i beregning for AML-terskler
                  {ct.requiresVerneombud ? ' · Verneombud lovpålagt' : ''}
                  {ct.requiresAmu ? ' · AMU lovpålagt' : ct.mayRequestAmu ? ' · AMU kan kreves' : ''}.
                </p>
              </>
            }
            hubAriaLabel="Organisasjon — faner"
            hubItems={orgHubMenuItems}
            contentClassName="!p-0"
          >
            <div className="space-y-6 p-4 md:p-6">
              <InfoBox>
                <span>
                  <strong>Arbeidsmiljøloven (AML) — terskler:</strong> Verneombud er lovpålagt fra 5 ansatte (§ 6-1).
                  AMU kan kreves av flertallet ved 10–29 ansatte, og er lovpålagt fra 30 ansatte (§ 7-1). Innleide
                  fra bemanningsbyrå teller med. Beregningene nedenfor er veiledende — verifiser mot gjeldende lovdata.no
                  og tariffavtale.
                </span>
              </InfoBox>
              <div className="grid gap-4 sm:grid-cols-2">
                <OrgInsightTanStat
                  big={String(insightStats.members)}
                  title="Medlemmer (app)"
                  sub="Kontoer tilknyttet organisasjonen"
                />
                <OrgInsightTanStat
                  big={String(insightStats.employeesTotal)}
                  title="Ansatte (totalt)"
                  sub={`${insightStats.employeesActive} aktive · ${insightStats.employeesInactive} inaktive`}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <OrgInsightTanStat
                  big={String(insightStats.units)}
                  title="Enheter"
                  sub={`${insightStats.unitsTopLevel} på toppnivå`}
                />
                <OrgInsightTanStat
                  big={String(insightStats.groups)}
                  title="Brukergrupper"
                  sub="Definerte grupper"
                />
              </div>
              <OrgInsightWhiteCard className="p-0">
                <div className="flex items-center border-b border-neutral-100 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Building2 className="size-4 text-neutral-500" aria-hidden />
                    Enheter etter type
                  </p>
                </div>
                <div className="p-4">
                  <div className="rounded-md border border-neutral-100 p-4">
                    <p className="text-[10px] font-bold uppercase text-neutral-500">Fordeling</p>
                    <p className="mt-1 text-sm text-neutral-600">Divisjon, avdeling, team og lokasjon.</p>
                    <div className="mt-4 space-y-3">
                      {orgInsightKindBars.map((row) => (
                        <div key={row.kind} className="flex items-center gap-3 text-sm">
                          <span className="w-28 shrink-0 text-neutral-600 sm:w-32">{row.label}</span>
                          <span className="w-6 tabular-nums font-semibold text-neutral-900">{row.count}</span>
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(row.count / row.max) * 100}%`,
                                backgroundColor: row.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </OrgInsightWhiteCard>
              <OrgInsightWhiteCard className="p-5">
                <p className="text-sm font-semibold text-neutral-900">Samsvar (AML-terskler)</p>
                <p className="text-[10px] font-bold uppercase text-neutral-500">Basert på antall ansatte i beregningen</p>
                <p className="mt-1 text-sm text-neutral-600">Verneombud og AMU etter arbeidsmiljøloven.</p>
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Verneombud (§ 6-1)</p>
                      <p className="mt-0.5 text-xs text-neutral-500">Lovpålagt ved ≥ 5 ansatte</p>
                    </div>
                    {ct.requiresVerneombud ? (
                      <Badge variant="success">Lovpålagt</Badge>
                    ) : (
                      <Badge variant="neutral">Under terskel</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">AMU kan kreves (§ 7-1)</p>
                      <p className="mt-0.5 text-xs text-neutral-500">Flertallet kan kreve AMU ved 10–29 ansatte</p>
                    </div>
                    {ct.requiresAmu ? (
                      <Badge variant="success">Lovpålagt</Badge>
                    ) : ct.mayRequestAmu ? (
                      <Badge variant="warning">Kan kreves</Badge>
                    ) : (
                      <Badge variant="neutral">Under terskel</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">AMU lovpålagt (§ 7-1)</p>
                      <p className="mt-0.5 text-xs text-neutral-500">Automatisk krav ved ≥ 30 ansatte</p>
                    </div>
                    {ct.requiresAmu ? (
                      <Badge variant="success">Lovpålagt</Badge>
                    ) : (
                      <Badge variant="neutral">Under terskel</Badge>
                    )}
                  </div>
                </div>
              </OrgInsightWhiteCard>
            </div>
          </WorkplaceStandardListLayout>
        ) : null}

        {tab === 'employees' ? (
          <WorkplaceStandardListLayout
            className="!mt-0"
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Organisasjon' }, { label: 'Ansatte' }]}
            title="Ansatte"
            description={
              <>
                <p className="text-sm text-neutral-500">{memberHeadline}</p>
                <p className="mt-2 max-w-2xl leading-relaxed">
                  {ct.totalEmployeeCount} i beregning for AML-terskler
                  {ct.requiresVerneombud ? ' · Verneombud lovpålagt' : ''}
                  {ct.requiresAmu ? ' · AMU lovpålagt' : ct.mayRequestAmu ? ' · AMU kan kreves' : ''}.
                </p>
              </>
            }
            hubAriaLabel="Organisasjon — faner"
            hubItems={orgHubMenuItems}
            toolbar={{
              count: hasAnyEmployees ? { value: sortedFilteredEmployees.length, label: 'i visning' } : undefined,
              searchPlaceholder: 'Søk navn, tittel, e-post…',
              searchValue: searchEmp,
              onSearchChange: setSearchEmp,
              filtersOpen: empStdFiltersOpen,
              onFiltersOpenChange: setEmpStdFiltersOpen,
              filterStatusText:
                filterUnit || empSegment !== 'all' ? 'Filter aktive' : 'Ingen filter',
              filterPanel: (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Enhet</p>
                    <select
                      value={filterUnit}
                      onChange={(e) => setFilterUnit(e.target.value)}
                      className="mt-2 w-full max-w-md rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Alle enheter</option>
                      {org.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Status</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(['all', 'active', 'inactive'] as const).map((id) => {
                        const label = id === 'all' ? 'Alle' : id === 'active' ? 'Aktive' : 'Inaktive'
                        const selected = empSegment === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setEmpSegment(id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                              selected ? 'text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'
                            }`}
                            style={selected ? { backgroundColor: WORKPLACE_LIST_LAYOUT_CTA } : undefined}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchEmp('')
                      setFilterUnit('')
                      setEmpSegment('all')
                    }}
                    className="self-start rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Nullstill filter
                  </button>
                </div>
              ),
              sortOptions: [
                { value: 'name', label: 'Navn A–Å' },
                { value: 'unit', label: 'Enhet' },
                { value: 'role', label: 'Rolle' },
                { value: 'status', label: 'Status (aktive først)' },
              ],
              sortValue: empStdSort,
              onSortChange: (v) => setEmpStdSort(v as typeof empStdSort),
              viewMode: empStdViewMode,
              onViewModeChange: (m) => {
                setEmpStdViewMode(m)
                setEmpLayout(m === 'box' ? 'box' : 'list')
              },
              primaryAction: { label: 'Ny ansatt', onClick: () => setOrgSlidePanel({ kind: 'employee', mode: 'create' }), icon: Plus },
            }}
            overlay={orgStandardListOverlay}
            contentClassName="!p-0"
          >
            {(() => {
              const userEmail = (profile?.email ?? user?.email)?.trim().toLowerCase()
              const myRecord = userEmail
                ? org.displayEmployees.find((e) => e.email?.trim().toLowerCase() === userEmail)
                : undefined
              return myRecord ? (
                <div className="border-b border-neutral-100 px-4 py-3 md:px-6">
                  <InfoBox>
                    Du er registrert som{' '}
                    <strong>{myRecord.name}</strong>
                    {myRecord.jobTitle ? ` — ${myRecord.jobTitle}` : ''}
                    {myRecord.unitName ? ` · ${myRecord.unitName}` : ''}.{' '}
                    <button
                      type="button"
                      onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp: myRecord })}
                      className="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      Se dine opplysninger
                    </button>
                    {' '}— du kan be om retting ved å kontakte din administrator.
                  </InfoBox>
                </div>
              ) : null
            })()}
            {!hasAnyEmployees ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-neutral-200 py-16 text-center">
                <p className="text-sm text-neutral-500">Ingen ansatte ennå</p>
                <button
                  type="button"
                  onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'create' })}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
                  style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
                >
                  <Plus className="size-4 shrink-0" strokeWidth={2.5} />
                  Legg til ansatt
                </button>
              </div>
            ) : sortedFilteredEmployees.length === 0 ? (
              <div className="px-5 py-14 text-center md:px-6">
                <p className="text-sm font-medium text-neutral-700">Ingen treff</p>
                <p className="mt-1 text-xs text-neutral-500">Juster søk eller filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEmpSegment('all')
                    setSearchEmp('')
                    setFilterUnit('')
                  }}
                  className="mt-4 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
                >
                  Nullstill
                </button>
              </div>
            ) : empStdViewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={`text-sm ${theadRow}`}>
                      <th className={`${tableCell} font-medium`}>Ansatt</th>
                      <th className={`${tableCell} font-medium`}>Stilling / rolle</th>
                      <th className={`${tableCell} font-medium`}>Enhet</th>
                      <th className={`${tableCell} font-medium`}>
                        <span className="inline-flex items-center gap-1.5">
                          Kontakt
                          <Lock
                            className="size-3 shrink-0 text-neutral-400"
                            aria-label="Personopplysninger — synlig for administratorer"
                          />
                        </span>
                      </th>
                      <th className={`${tableCell} w-32 font-medium`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredEmployees.map((emp, rowIdx) => {
                      const bg = avatarColor(emp.name)
                      return (
                        <tr
                          key={emp.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Rediger ${emp.name}`}
                          className={`${table1BodyRowClass(layout, rowIdx)} cursor-pointer hover:bg-neutral-50/50`}
                          onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })
                            }
                          }}
                        >
                          <td className={tableCell}>
                            <div className="flex items-center gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ background: bg }}
                              >
                                {initials(emp.name)}
                              </div>
                              <span className="font-medium text-neutral-900">{emp.name}</span>
                            </div>
                          </td>
                          <td className={tableCell}>
                            <div className="text-neutral-800">{emp.jobTitle ?? '—'}</div>
                            {emp.role ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {MANDATE_ROLES[emp.role] ? (
                                  <Badge variant={MANDATE_ROLES[emp.role].variant}>
                                    {MANDATE_ROLES[emp.role].label}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-neutral-500">{emp.role}</span>
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td className={`${tableCell} text-neutral-700`}>{emp.unitName ?? '—'}</td>
                          <td className={`${tableCell} text-neutral-600`}>
                            <div className="space-y-0.5 text-sm">
                              {emp.email ? <div>{emp.email}</div> : null}
                              {emp.phone ? <div className="text-neutral-500">{emp.phone}</div> : null}
                              {!emp.email && !emp.phone ? '—' : null}
                            </div>
                          </td>
                          <td className={tableCell}>
                            <span
                              className={`inline-flex rounded-none px-2.5 py-0.5 text-xs font-medium ${
                                emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-500'
                              }`}
                            >
                              {emp.active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                            <div className="mt-1 text-xs text-neutral-500">{EMPLOYMENT_LABELS[emp.employmentType]}</div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : empStdViewMode === 'box' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
                {sortedFilteredEmployees.map((emp) => {
                  const bg = avatarColor(emp.name)
                  const mandateDef = emp.role ? MANDATE_ROLES[emp.role] : undefined
                  const roleLine = emp.jobTitle || (!mandateDef && emp.role) ? [emp.jobTitle, !mandateDef ? emp.role : undefined].filter(Boolean).join(' · ') : emp.jobTitle ?? '—'
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })}
                      className="flex flex-col overflow-hidden rounded-lg border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: bg }}
                        >
                          {initials(emp.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-neutral-900">{emp.name}</p>
                          <p className="mt-1 text-sm text-neutral-600">{roleLine || '—'}</p>
                          <p className="mt-1 text-xs text-neutral-500">{emp.unitName ?? '—'}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              {emp.active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                            {mandateDef ? (
                              <Badge variant={mandateDef.variant}>{mandateDef.label}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100 px-4 py-2 md:px-6">
                {sortedFilteredEmployees.map((emp) => {
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })}
                        className="flex w-full flex-wrap items-start justify-between gap-3 py-4 text-left first:pt-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-900">{emp.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {[emp.jobTitle, emp.role].filter(Boolean).join(' · ') || '—'} · {emp.unitName ?? '—'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                            emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {emp.active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </WorkplaceStandardListLayout>
        ) : null}

        {tab === 'units' ? (
          <WorkplaceStandardListLayout
              className="!mt-0"
              breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Organisasjon' }, { label: 'Enheter' }]}
              title="Enheter"
              description="Trestruktur med utvidbare rader. Klikk på en rad for å redigere; slett fra sidevinduet."
              hubAriaLabel="Organisasjon — faner"
              hubItems={orgHubMenuItems}
              toolbar={{
                count: org.units.length > 0 ? { value: sortedFilteredUnitRows.length, label: 'i visning' } : undefined,
                searchPlaceholder: 'Søk navn, type, leder…',
                searchValue: unitSearch,
                onSearchChange: setUnitSearch,
                filtersOpen: unitStdFiltersOpen,
                onFiltersOpenChange: setUnitStdFiltersOpen,
                filterStatusText: unitKindSeg !== 'all' ? 'Filter aktive' : 'Ingen filter',
                filterPanel: (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Type</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          [
                            ['all', 'Alle'] as const,
                            ['department', 'Avdeling'] as const,
                            ['division', 'Divisjon'] as const,
                            ['team', 'Team'] as const,
                            ['location', 'Lokasjon'] as const,
                          ] as const
                        ).map(([id, label]) => {
                          const selected = unitKindSeg === id
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setUnitKindSeg(id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                selected ? 'text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'
                              }`}
                              style={selected ? { backgroundColor: WORKPLACE_LIST_LAYOUT_CTA } : undefined}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUnitSearch('')
                        setUnitKindSeg('all')
                      }}
                      className="self-start rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Nullstill filter
                    </button>
                  </div>
                ),
                sortOptions: [
                  { value: 'name', label: 'Navn A–Å' },
                  { value: 'kind', label: 'Type' },
                  { value: 'head', label: 'Leder' },
                  { value: 'staff', label: 'Ansatte (flest)' },
                ],
                sortValue: unitStdSort,
                onSortChange: (v) => setUnitStdSort(v as typeof unitStdSort),
                viewMode: unitStdViewMode,
                onViewModeChange: setUnitStdViewMode,
                primaryAction: { label: 'Ny enhet', onClick: () => openUnitPanel('create'), icon: Plus },
              }}
              overlay={orgStandardListOverlay}
              contentClassName="!p-0"
            >
              {org.units.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-neutral-200 py-16 text-center">
                  <p className="text-sm text-neutral-500">Ingen enheter ennå</p>
                  <button
                    type="button"
                    onClick={() => openUnitPanel('create')}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
                    style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
                  >
                    <Plus className="size-4 shrink-0" strokeWidth={2.5} />
                    Opprett enhet
                  </button>
                </div>
              ) : sortedFilteredUnitRows.length === 0 ? (
                <div className="px-5 py-14 text-center md:px-6">
                  <p className="text-sm font-medium text-neutral-700">Ingen treff</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitSearch('')
                      setUnitKindSeg('all')
                    }}
                    className="mt-4 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
                  >
                    Nullstill
                  </button>
                </div>
              ) : unitStdViewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={`text-sm ${theadRow}`}>
                        <th className={`${tableCell} font-medium`}>Enhet</th>
                        <th className={`${tableCell} font-medium`}>Type</th>
                        <th className={`${tableCell} font-medium`}>Leder</th>
                        <th className={`${tableCell} w-28 font-medium`}>Ansatte</th>
                        <th className={`${tableCell} w-12 font-medium`} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredUnitRows.map(({ unit, depth, hasChildren }, rowIdx) => {
                        const color = unit.color ?? KIND_COLORS[unit.kind]
                        const empHere = org.displayEmployees.filter((e) => e.unitId === unit.id && e.active).length
                        const pad = 12 + depth * 20
                        return (
                          <tr
                            key={unit.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Rediger enhet ${unit.name}`}
                            onClick={() => openUnitPanel('edit', unit)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openUnitPanel('edit', unit)
                              }
                            }}
                            className={`group ${table1BodyRowClass(layout, rowIdx)} cursor-pointer hover:bg-neutral-50/50`}
                          >
                            <td className={tableCell}>
                              <div className="flex items-center gap-2" style={{ paddingLeft: pad }}>
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleUnitExpanded(unit.id)
                                    }}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-none border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                                    aria-expanded={expandedUnits.has(unit.id)}
                                    title={expandedUnits.has(unit.id) ? 'Skjul underenheter' : 'Vis underenheter'}
                                  >
                                    {expandedUnits.has(unit.id) ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="inline-block w-8 shrink-0" aria-hidden />
                                )}
                                <div className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                                <span className="font-medium text-neutral-900">{unit.name}</span>
                              </div>
                            </td>
                            <td className={`${tableCell} text-neutral-700`}>{KIND_LABELS[unit.kind]}</td>
                            <td className={`${tableCell} text-neutral-600`}>{unit.headName ?? unit.managerName ?? '—'}</td>
                            <td className={`${tableCell} tabular-nums text-neutral-700`}>{empHere}</td>
                            <td className={`${tableCell} text-right`}>
                              <Pencil
                                className="size-3.5 text-neutral-300 opacity-0 transition group-hover:opacity-100"
                                aria-hidden
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : unitStdViewMode === 'box' ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
                  {sortedFilteredUnitRows.map(({ unit, depth }) => {
                    const color = unit.color ?? KIND_COLORS[unit.kind]
                    const empHere = org.displayEmployees.filter((e) => e.unitId === unit.id && e.active).length
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => openUnitPanel('edit', unit)}
                        className="flex flex-col rounded-lg border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
                        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginLeft: depth * 8 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="size-3 shrink-0 rounded-full" style={{ background: color }} />
                          <p className="font-semibold text-neutral-900">{unit.name}</p>
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">{KIND_LABELS[unit.kind]}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {unit.headName ?? unit.managerName ?? '—'} · {empHere} ansatte
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 px-4 py-2 md:px-6">
                  {sortedFilteredUnitRows.map(({ unit, depth }) => {
                    const empHere = org.displayEmployees.filter((e) => e.unitId === unit.id && e.active).length
                    return (
                      <li key={unit.id} className="first:pt-2" style={{ paddingLeft: depth * 12 }}>
                        <button
                          type="button"
                          onClick={() => openUnitPanel('edit', unit)}
                          className="flex w-full flex-wrap items-start justify-between gap-2 py-4 text-left"
                        >
                          <div>
                            <p className="font-medium text-neutral-900">{unit.name}</p>
                            <p className="text-xs text-neutral-500">
                              {KIND_LABELS[unit.kind]} · {empHere} ansatte
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </WorkplaceStandardListLayout>
        ) : null}

        {tab === 'groups' ? (
            <WorkplaceStandardListLayout
              className="!mt-0"
              breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Organisasjon' }, { label: 'Brukergrupper' }]}
              title="Brukergrupper"
              description="Oversikt over grupper og omfang. Klikk for å redigere; slett fra sidevinduet."
              hubAriaLabel="Organisasjon — faner"
              hubItems={orgHubMenuItems}
              overlay={orgStandardListOverlay}
              toolbar={{
                count: org.groups.length > 0 ? { value: groupsStdFiltered.length, label: 'i visning' } : undefined,
                searchPlaceholder: 'Søk gruppe eller omfang…',
                searchValue: groupStdSearch,
                onSearchChange: setGroupStdSearch,
                filtersOpen: groupStdFiltersOpen,
                onFiltersOpenChange: setGroupStdFiltersOpen,
                filterStatusText: 'Ingen filter',
                filterPanel: <p className="text-sm text-neutral-600">Bruk søk for å filtrere listen.</p>,
                sortOptions: [
                  { value: 'name', label: 'Navn A–Å' },
                  { value: 'scope', label: 'Omfang' },
                ],
                sortValue: groupStdSort,
                onSortChange: (v) => setGroupStdSort(v as typeof groupStdSort),
                viewMode: groupStdViewMode,
                onViewModeChange: setGroupStdViewMode,
                primaryAction: { label: 'Ny gruppe', onClick: () => openGroupPanel('create'), icon: Plus },
              }}
              contentClassName="!p-0"
            >
              {org.groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-neutral-200 py-16 text-center">
                  <p className="text-sm text-neutral-500">Ingen grupper ennå</p>
                </div>
              ) : groupsStdFiltered.length === 0 ? (
                <div className="px-5 py-14 text-center md:px-6">
                  <p className="text-sm font-medium text-neutral-700">Ingen treff</p>
                  <button
                    type="button"
                    onClick={() => setGroupStdSearch('')}
                    className="mt-4 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
                  >
                    Nullstill søk
                  </button>
                </div>
              ) : groupStdViewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={`text-sm ${theadRow}`}>
                        <th className={`${tableCell} font-medium`}>Gruppe</th>
                        <th className={`${tableCell} font-medium`}>Omfang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupsStdFiltered.map((g, rowIdx) => (
                        <tr
                          key={g.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openGroupPanel('edit', g)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openGroupPanel('edit', g)
                            }
                          }}
                          className={`${table1BodyRowClass(layout, rowIdx)} cursor-pointer hover:bg-neutral-50/50`}
                        >
                          <td className={tableCell}>
                            <p className="font-medium text-neutral-900">{g.name}</p>
                            {g.description ? <p className="mt-0.5 text-xs text-neutral-500">{g.description}</p> : null}
                          </td>
                          <td className={`${tableCell} text-neutral-600`}>{org.getGroupLabel(g)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : groupStdViewMode === 'box' ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
                  {groupsStdFiltered.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => openGroupPanel('edit', g)}
                      className="flex flex-col rounded-lg border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      <p className="font-semibold text-neutral-900">{g.name}</p>
                      <p className="mt-2 text-sm text-neutral-600">{org.getGroupLabel(g)}</p>
                      {g.description ? <p className="mt-2 text-xs text-neutral-500">{g.description}</p> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 px-4 py-2 md:px-6">
                  {groupsStdFiltered.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => openGroupPanel('edit', g)}
                        className="flex w-full flex-wrap items-start justify-between gap-3 py-4 text-left first:pt-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-900">{g.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">{org.getGroupLabel(g)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </WorkplaceStandardListLayout>
        ) : null}

      <div className="mt-2 space-y-8">

      {/* ── Roller & verv ────────────────────────────────────────────────────── */}
      {tab === 'mandates' && (
        <section className="w-full space-y-6">
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4 md:px-6">
              <Shield className="size-5 shrink-0 text-[#1a3d32]" />
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Formelle verv og mandater</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Lovpålagte representasjonsroller og valgperioder. Avledet fra ansattlisten — legg til formelle mandater per ansatt.
                </p>
              </div>
            </div>
            {allMandates.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Shield className="mb-3 size-10 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-600">Ingen formelle verv registrert</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Sett rolle til «Verneombud», «Tillitsvalgt» eller «HMS-ansvarlig» på ansatte for automatisk oppføring.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      <th className="px-5 py-3">Ansatt</th>
                      <th className="px-4 py-3">Verv / mandat</th>
                      <th className="px-4 py-3">Lovhjemmel</th>
                      <th className="px-4 py-3">Omfang</th>
                      <th className="px-4 py-3">Periode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {allMandates.map(({ employee: emp, mandate: m }) => (
                      <tr key={`${emp.id}-${m.id}`} className="hover:bg-neutral-50/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: avatarColor(emp.name) }}
                            >
                              {initials(emp.name)}
                            </div>
                            <div>
                              <p className="font-medium text-neutral-900">{emp.name}</p>
                              {emp.jobTitle ? (
                                <p className="text-xs text-neutral-500">{emp.jobTitle}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              m.mandateType === 'verneombud' || m.mandateType === 'hoved_verneombud' ? 'info' :
                              m.mandateType === 'tillitsvalgt' ? 'warning' :
                              m.mandateType === 'amu_arbeidstaker' || m.mandateType === 'amu_arbeidsgiver' || m.mandateType === 'amu_chair' ? 'success' :
                              'neutral'
                            }
                          >
                            {MANDATE_TYPE_LABELS[m.mandateType]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{m.lawRef}</td>
                        <td className="px-4 py-3 text-xs text-neutral-700">{m.scope ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {m.startDate ? m.startDate.slice(0, 7) : '—'}
                          {m.endDate ? ` → ${m.endDate.slice(0, 7)}` : ' →'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OrgInsightWhiteCard>

          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h3 className="text-base font-semibold text-neutral-900">AML-oppsummering</h3>
              <p className="mt-1 text-sm text-neutral-500">Oversikt over lovpålagte krav basert på antall ansatte.</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {[
                {
                  label: 'Verneombud',
                  lawRef: 'AML § 6-1',
                  required: org.complianceThresholds.requiresVerneombud,
                  present: allMandates.some((r) => r.mandate.mandateType === 'verneombud' || r.mandate.mandateType === 'hoved_verneombud'),
                  threshold: '≥ 5 ansatte',
                },
                {
                  label: 'AMU (arbeidsmiljøutvalg)',
                  lawRef: 'AML § 7-1',
                  required: org.complianceThresholds.requiresAmu,
                  present: allMandates.some((r) => r.mandate.mandateType === 'amu_arbeidstaker' || r.mandate.mandateType === 'amu_arbeidsgiver'),
                  threshold: '≥ 30 ansatte (kan kreves fra 10)',
                },
                {
                  label: 'HMS-ansvarlig / daglig leder',
                  lawRef: 'AML § 3-1',
                  required: true,
                  present: allMandates.some((r) => r.mandate.mandateType === 'hms_ansvarlig'),
                  threshold: 'Alle virksomheter',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{row.label}</p>
                    <p className="text-xs text-neutral-500">{row.lawRef} · {row.threshold}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.required ? (
                      <Badge variant="warning">Lovpålagt</Badge>
                    ) : (
                      <Badge variant="neutral">Ikke krav</Badge>
                    )}
                    {row.present ? (
                      <Badge variant="success">Registrert</Badge>
                    ) : (
                      <Badge variant="draft">Mangler</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </OrgInsightWhiteCard>
        </section>
      )}

      {/* ── GDPR & personvern ────────────────────────────────────────────────── */}
      {tab === 'gdpr' && (
        <section className="w-full space-y-6">
          <ComplianceBanner title="Art. 30 — Behandlingsprotokoll">
            GDPR Art. 30 krever at behandlingsansvarlig fører en protokoll over alle behandlingsaktiviteter. Dokumentet
            nedenfor viser de viktigste behandlingene i organisasjonsmodulen. Last ned som PDF for å oppfylle krav fra
            Datatilsynet ved tilsyn.
          </ComplianceBanner>

          {/* Art. 30 register */}
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 md:px-6">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-neutral-500" />
                <h2 className="text-base font-semibold text-neutral-900">Behandlingsprotokoll (Art. 30)</h2>
              </div>
              <Badge variant="info">Veiledende</Badge>
            </div>
            {[
              {
                name: 'Ansattregister',
                purpose: 'Administrasjon av arbeidsforhold',
                basis: 'GDPR Art. 6(1)(b) — nødvendig for arbeidskontrakt',
                lawRef: 'AML §§ 3-1, 6-1, 7-1',
                categories: 'Navn, e-post, telefon, stillingstittel, enhet, ansettelsestype, start-/sluttdato',
                recipients: 'Arbeidstilsynet (ved tilsyn), intern HMS',
                retention: '3 år etter ansettelsesslutt (HMS-data: 10 år)',
                thirdCountry: false,
              },
              {
                name: 'Brukergrupper',
                purpose: 'Målretting av undersøkelser, opplæring og rapporter',
                basis: 'GDPR Art. 6(1)(b) — nødvendig for arbeidsforholdets administrasjon',
                lawRef: 'Intern prosess',
                categories: 'Ansatt-ID, enhetstilknytning',
                recipients: 'Interne moduler',
                retention: 'Så lenge gruppen er aktiv + 1 år',
                thirdCountry: false,
              },
              {
                name: 'Verv og mandater',
                purpose: 'Dokumentasjon av lovpålagte representasjonsroller',
                basis: 'GDPR Art. 6(1)(c) — rettslig forpliktelse',
                lawRef: 'AML § 6-1, § 7-1',
                categories: 'Navn, rolle, valgperiode',
                recipients: 'Arbeidstilsynet (ved tilsyn), AMU-protokoll',
                retention: '5 år etter valgperiodens utløp',
                thirdCountry: false,
              },
            ].map((row) => (
              <div key={row.name} className="border-b border-neutral-100 px-5 py-4 last:border-b-0 md:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-neutral-900">{row.name}</h3>
                  {row.thirdCountry ? (
                    <Badge variant="warning">Tredjelandsoverføring</Badge>
                  ) : (
                    <Badge variant="success">Ingen tredjeland</Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-y-2 text-sm sm:grid-cols-2">
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Formål</span><p className="text-neutral-700">{row.purpose}</p></div>
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Behandlingsgrunnlag</span><p className="text-neutral-700">{row.basis}</p></div>
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Datakategorier</span><p className="text-neutral-700">{row.categories}</p></div>
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Mottakere</span><p className="text-neutral-700">{row.recipients}</p></div>
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Oppbevaringstid</span><p className="text-neutral-700">{row.retention}</p></div>
                  <div><span className="text-[10px] font-bold uppercase text-neutral-400">Lovgrunnlag</span><p className="text-neutral-700">{row.lawRef}</p></div>
                </div>
              </div>
            ))}
          </OrgInsightWhiteCard>

          {/* DPIA checklist */}
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h2 className="text-base font-semibold text-neutral-900">DPIA-sjekkliste (Art. 35)</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Dersom ≥ 2 av følgende gjelder, kan behandlingen kreve en konsekvensutredning (DPIA).
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {[
                { key: 'systematicMonitoring' as const, label: 'Systematisk overvåkning av ansatte', lawRef: 'GDPR Art. 35(3)(c)' },
                { key: 'profiling' as const, label: 'Profilering eller automatiserte beslutninger', lawRef: 'GDPR Art. 35(3)(a)' },
                { key: 'sensitiveCategories' as const, label: 'Behandling av særlige kategorier (fagforeningsmedlemskap, helse)', lawRef: 'GDPR Art. 35(3)(b)' },
              ].map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start gap-3 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={dpiaAnswers[item.key]}
                    onChange={(e) => setDpiaAnswers((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                    <p className="text-xs text-neutral-500">{item.lawRef}</p>
                  </div>
                </label>
              ))}
            </div>
            {Object.values(dpiaAnswers).filter(Boolean).length >= 2 ? (
              <div className="border-t border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-900">DPIA kan være påkrevd</p>
                <p className="mt-1 text-sm text-amber-800">
                  To eller flere faktorer er til stede. Gjennomfør en konsekvensutredning og dokumenter funnene i
                  internkontrollmodulen (IK-ROS). Kontakt Datatilsynet ved tvil.
                </p>
                <a
                  href="https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdere-personvernkonsekvenser-dpia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline"
                >
                  Datatilsynets DPIA-veiledning <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <div className="border-t border-neutral-100 px-5 py-3">
                <p className="text-xs text-neutral-500">Ingen DPIA-plikt avdekket basert på valgte faktorer.</p>
              </div>
            )}
          </OrgInsightWhiteCard>

          {/* Data retention policy */}
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h2 className="text-base font-semibold text-neutral-900">Oppbevaringsregler (GDPR Art. 5(1)(e))</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-5 py-3">Datakategori</th>
                    <th className="px-4 py-3">Oppbevaringstid</th>
                    <th className="px-4 py-3">Lovgrunnlag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {[
                    { cat: 'Ansattregister (aktiv)', retention: 'Hele ansettelsesperioden', law: 'AML, GDPR Art. 6(1)(b)' },
                    { cat: 'Ansattregister (inaktiv)', retention: `${org.settings.dataRetentionInactiveMonths ?? 36} mnd. etter sluttdato`, law: 'Reklamasjonsfrist, AML kap. 17' },
                    { cat: 'Lønnsdata / A-ordning', retention: '10 år', law: 'Regnskapsloven § 13' },
                    { cat: 'HMS-registre', retention: '10 år (yrkesskade: 30 år)', law: 'Arbeidsskadetrygdloven' },
                    { cat: 'Auditlogg', retention: `${org.settings.dataRetentionAuditYears ?? 5} år`, law: 'Datatilsynets praksis' },
                    { cat: 'Sykefravær', retention: '5 år', law: 'GDPR Art. 9, AML § 4-6' },
                  ].map((row) => (
                    <tr key={row.cat} className="hover:bg-neutral-50/60">
                      <td className="px-5 py-3 font-medium text-neutral-900">{row.cat}</td>
                      <td className="px-4 py-3 text-neutral-700">{row.retention}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{row.law}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </OrgInsightWhiteCard>

          {/* Data subject rights */}
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h2 className="text-base font-semibold text-neutral-900">Registrertes rettigheter (Art. 15–21)</h2>
              <p className="mt-1 text-sm text-neutral-500">Ansatte kan utøve disse rettighetene. Send forespørsler til personvernombudet.</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {[
                { art: 'Art. 15', right: 'Innsyn', desc: 'Ansatte har rett til å se hvilke opplysninger som er lagret om dem.' },
                { art: 'Art. 16', right: 'Retting', desc: 'Ansatte kan kreve at feil opplysninger korrigeres.' },
                { art: 'Art. 17', right: 'Sletting', desc: 'Ansatte kan be om sletting. Gjelder ikke data som oppbevares etter lovkrav.' },
                { art: 'Art. 18', right: 'Begrensning', desc: 'Behandlingen kan begrenses mens en tvist pågår.' },
                { art: 'Art. 20', right: 'Dataportabilitet', desc: 'Ansatte kan be om en maskinlesbar kopi av egne opplysninger.' },
                { art: 'Art. 21', right: 'Innsigelse', desc: 'Ansatte kan protestere mot behandling basert på berettiget interesse.' },
              ].map((row) => (
                <div key={row.art} className="flex items-start gap-4 px-5 py-3.5">
                  <span className="mt-0.5 shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{row.art}</span>
                  <div>
                    <p className="font-medium text-neutral-900">{row.right}</p>
                    <p className="text-sm text-neutral-600">{row.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
              <p className="text-sm text-neutral-600">
                Personvernombud:{' '}
                {org.settings.privacyOfficerEmail ? (
                  <a href={`mailto:${org.settings.privacyOfficerEmail}`} className="font-medium text-[#1a3d32] underline">
                    {org.settings.privacyOfficerEmail}
                  </a>
                ) : (
                  <span className="italic text-neutral-400">Ikke konfigurert — fyll inn under Innstillinger</span>
                )}
              </p>
            </div>
          </OrgInsightWhiteCard>

          {/* Disclaimer */}
          <p className="text-xs text-neutral-400">
            Informasjonen ovenfor er veiledende og ikke rettslig rådgivning. Verifiser mot gjeldende lovdata.no og
            eventuelle avvik fra Datatilsynet. Sist oppdatert: 2026-05-01.
          </p>
        </section>
      )}

      {/* ── Employees — legacy (standard layout brukes på Ansatte-fanen) ─────── */}
      {tab === 'employees' && !useStandardOrgList && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Ansatte</h2>
              <p className="mt-1 text-sm text-neutral-500">Oversikt med romslige kolonner — samme uttrykk som forsiden.</p>
            </div>
            <span className="text-xs text-neutral-400">{filteredEmployees.length} vist</span>
          </div>
          {!layout.table_1.toolbar.search && (
            <div className="flex flex-wrap gap-3">
              <input
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                placeholder="Søk navn, tittel, e-post…"
                className={`min-w-[240px] flex-1 ${FILTER_INPUT_CLASS}`}
              />
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className={`min-w-[180px] ${FILTER_INPUT_CLASS}`}
              >
                <option value="">Alle enheter</option>
                {org.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!hasAnyEmployees ? (
            <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-neutral-300 bg-white py-16 text-center shadow-sm">
              <Users className="mb-3 size-10 text-neutral-300" />
              <p className="text-sm text-neutral-500">Ingen ansatte ennå</p>
              <button
                type="button"
                onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'create' })}
                className="mt-4 rounded-none bg-[#1a3d32] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#142e26]"
              >
                <Plus className="mr-1 inline size-4" />
                Legg til første ansatt
              </button>
            </div>
          ) : (
            <Table1Shell
              variant="pinpoint"
              toolbar={
                <Table1Toolbar
                  payloadOverride={layout}
                  searchSlot={
                    <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                      <div
                        className="relative min-w-[200px] flex-1"
                        style={{ ['--layout-accent' as string]: layout.accent }}
                      >
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <input
                          value={searchEmp}
                          onChange={(e) => setSearchEmp(e.target.value)}
                          placeholder="Søk navn, tittel, e-post…"
                          className={`w-full border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--layout-accent)] ${rSeg}`}
                        />
                      </div>
                      <select
                        value={filterUnit}
                        onChange={(e) => setFilterUnit(e.target.value)}
                        className={`min-w-[180px] border border-neutral-200 bg-white px-3 py-2 text-sm ${rSeg}`}
                      >
                        <option value="">Alle enheter</option>
                        {org.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  }
                  segmentSlot={
                    <div className={`inline-flex border border-neutral-200 bg-neutral-50/80 p-1 ${rSeg}`}>
                      {(['all', 'active', 'inactive'] as const).map((id) => {
                        const label = id === 'all' ? 'Alle' : id === 'active' ? 'Aktive' : 'Inaktive'
                        const selected = empSegment === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setEmpSegment(id)}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${rSeg} ${
                              selected ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-white'
                            }`}
                            style={selected ? { backgroundColor: layout.accent, color: '#fff' } : undefined}
                          >
                            {selected ? (
                              <span className="flex size-4 items-center justify-center rounded-none bg-white/20">
                                <Check className="size-3" />
                              </span>
                            ) : (
                              <span className="size-4 rounded-none border-2 border-neutral-300" />
                            )}
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  }
                  endSlot={
                    <>
                      <button
                        type="button"
                        onClick={() => setEmpLayout('list')}
                        title="Liste"
                        className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          empLayout === 'list'
                            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <List className="size-3.5 shrink-0" aria-hidden />
                        Liste
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmpLayout('box')}
                        title="Bokser"
                        className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          empLayout === 'box'
                            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
                        Bokser
                      </button>
                    </>
                  }
                />
              }
            >
              {filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-t border-neutral-100 bg-neutral-50/50 px-6 py-16 text-center">
                  <Users className="mb-3 size-10 text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-700">Ingen ansatte i dette utvalget</p>
                  <p className="mt-1 max-w-sm text-xs text-neutral-500">
                    Det finnes ansatte, men ingen samsvarer med segment, søk eller enhetsfilter. Juster filtre eller vis alle.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmpSegment('all')
                        setSearchEmp('')
                        setFilterUnit('')
                      }}
                      className="rounded-none bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
                    >
                      Vis alle ansatte
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmpSegment('all')}
                      className="rounded-none border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Nullstill segment
                    </button>
                  </div>
                </div>
              ) : empLayout === 'list' ? (
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={`text-sm ${theadRow}`}>
                      <th className={`${tableCell} font-medium`}>Ansatt</th>
                      <th className={`${tableCell} font-medium`}>Stilling / rolle</th>
                      <th className={`${tableCell} font-medium`}>Enhet</th>
                      <th className={`${tableCell} font-medium`}>Kontakt</th>
                      <th className={`${tableCell} w-32 font-medium`}>Status</th>
                      <th className={`${tableCell} w-28 text-right font-medium`} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp, rowIdx) => {
                      const bg = avatarColor(emp.name)
                      const target = storedForEdit(emp, org.employees)
                      return (
                        <tr key={emp.id} className={`${table1BodyRowClass(layout, rowIdx)} hover:bg-neutral-50/50`}>
                          <td className={tableCell}>
                            <div className="flex items-center gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ background: bg }}
                              >
                                {initials(emp.name)}
                              </div>
                              <span className="font-medium text-neutral-900">{emp.name}</span>
                            </div>
                          </td>
                          <td className={tableCell}>
                            <div className="text-neutral-800">{emp.jobTitle ?? '—'}</div>
                            {emp.role && <div className="mt-0.5 text-xs text-neutral-500">{emp.role}</div>}
                          </td>
                          <td className={`${tableCell} text-neutral-700`}>{emp.unitName ?? '—'}</td>
                          <td className={`${tableCell} text-neutral-600`}>
                            <div className="space-y-0.5">
                              {emp.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="size-3.5 shrink-0 text-neutral-400" />
                                  {emp.email}
                                </div>
                              )}
                              {emp.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="size-3.5 shrink-0 text-neutral-400" />
                                  {emp.phone}
                                </div>
                              )}
                              {!emp.email && !emp.phone && '—'}
                            </div>
                          </td>
                          <td className={tableCell}>
                            <span
                              className={`inline-flex rounded-none px-2.5 py-0.5 text-xs font-medium ${
                                emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-500'
                              }`}
                            >
                              {emp.active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                            <div className="mt-1 text-xs text-neutral-500">{EMPLOYMENT_LABELS[emp.employmentType]}</div>
                          </td>
                          <td className={`${tableCell} text-right`}>
                            <button
                              type="button"
                              onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })}
                              className="rounded-none p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Rediger"
                            >
                              <Pencil className="size-4" />
                            </button>
                            {emp.active && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (target.id.startsWith('m-')) {
                                    window.alert(
                                      'Denne personen finnes bare i medlemslisten. Legg til som ansatt før du deaktiverer.',
                                    )
                                    return
                                  }
                                  if (confirm(`Deaktiver ${emp.name}?`)) org.deactivateEmployee(target.id)
                                }}
                                className="rounded-none p-2 text-neutral-400 hover:bg-amber-50 hover:text-amber-600"
                                title="Deaktiver"
                              >
                                <UserMinus className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 md:px-5 md:pb-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEmployees.map((emp) => {
                      const bg = avatarColor(emp.name)
                      const target = storedForEdit(emp, org.employees)
                      const roleLine = [emp.jobTitle, emp.role].filter(Boolean).join(' · ') || '—'
                      const contactBits: string[] = []
                      if (emp.email) contactBits.push(emp.email)
                      if (emp.phone) contactBits.push(emp.phone)
                      const detailLines = [
                        `${roleLine}`,
                        emp.unitName ? `Enhet: ${emp.unitName}` : 'Enhet: —',
                        `${emp.active ? 'Aktiv' : 'Inaktiv'} · ${EMPLOYMENT_LABELS[emp.employmentType]}`,
                        ...(contactBits.length ? [`Kontakt: ${contactBits.join(' · ')}`] : []),
                      ]
                      return (
                        <div
                          key={emp.id}
                          className={`${R_ORG_FLAT} flex flex-col border border-neutral-200/90 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:shadow`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ background: bg }}
                            >
                              {initials(emp.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-neutral-900">{emp.name}</p>
                              <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-neutral-600">
                                {detailLines.map((line, li) => (
                                  <p key={li}>{line}</p>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                            <button
                              type="button"
                              onClick={() => setOrgSlidePanel({ kind: 'employee', mode: 'edit', emp })}
                              className={`${R_ORG_FLAT} inline-flex flex-1 items-center justify-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 sm:flex-none`}
                            >
                              <Pencil className="size-4 shrink-0" />
                              Rediger
                            </button>
                            {emp.active ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (target.id.startsWith('m-')) {
                                    window.alert(
                                      'Denne personen finnes bare i medlemslisten. Legg til som ansatt før du deaktiverer.',
                                    )
                                    return
                                  }
                                  if (confirm(`Deaktiver ${emp.name}?`)) org.deactivateEmployee(target.id)
                                }}
                                className={`${R_ORG_FLAT} inline-flex flex-1 items-center justify-center gap-1.5 border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 sm:flex-none`}
                              >
                                <UserMinus className="size-4 shrink-0" />
                                Deaktiver
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Table1Shell>
          )}
        </section>
      )}

      {/* ── Units — legacy ─ */}
      {tab === 'units' && !useStandardOrgList && (
        <>
          <form
            id="org-new-unit"
            className="mt-2 overflow-hidden rounded-xl border border-neutral-200/80"
            onSubmit={handleCreateUnitLegacy}
            style={{ backgroundColor: WORKPLACE_FOREST }}
          >
            <div className={ORG_MERGED_PANEL}>
              <div className={ORG_MERGED_COL}>
                <p className={SETTINGS_LEAD_ON_DARK}>Navn og type for den nye enheten. Velg overordnet hvis den skal ligge under en annen.</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-unit-name">
                      Navn
                    </label>
                    <input
                      id="org-unit-name"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className={SETTINGS_INPUT_ON_DARK}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-unit-kind">
                      Type
                    </label>
                    <select
                      id="org-unit-kind"
                      value={unitForm.kind}
                      onChange={(e) => setUnitForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))}
                      className={SETTINGS_INPUT_ON_DARK}
                    >
                      {Object.entries(KIND_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-unit-parent">
                      Overordnet enhet
                    </label>
                    <select
                      id="org-unit-parent"
                      value={unitForm.parentId}
                      onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))}
                      className={SETTINGS_INPUT_ON_DARK}
                    >
                      <option value="">— Ingen (toppnivå) —</option>
                      {org.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className={ORG_MERGED_COL}>
                <p className={SETTINGS_LEAD_ON_DARK}>Valgfritt: hvem leder enheten, og hvilken farge brukes i org.kartet?</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-unit-head">
                      Leder / enhetshode
                    </label>
                    <input
                      id="org-unit-head"
                      value={unitForm.headName}
                      onChange={(e) => setUnitForm((f) => ({ ...f, headName: e.target.value }))}
                      className={SETTINGS_INPUT_ON_DARK}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-unit-color">
                      Farge (org.kart)
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        id="org-unit-color"
                        type="color"
                        value={unitForm.color}
                        onChange={(e) => setUnitForm((f) => ({ ...f, color: e.target.value }))}
                        className="h-10 w-16 cursor-pointer rounded-none border border-white/30 bg-white"
                      />
                      <span className="text-xs text-white/70">{unitForm.color}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={ORG_MERGED_ACTION_COL}>
                <button
                  type="submit"
                  className="inline-flex w-full min-w-[10rem] items-center justify-center gap-2 rounded-none border border-white/35 bg-white px-5 py-3 text-sm font-semibold shadow-none transition hover:bg-white/95"
                  style={{ color: layout.accent }}
                >
                  <Plus className="size-4 shrink-0" />
                  Opprett enhet
                </button>
              </div>
            </div>
          </form>
          <section className="mt-8 w-full space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Avdelinger og enheter</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Trestruktur med utvidbare rader — samme tabelloppsett som under Ansatte.
                </p>
              </div>
              <span className="text-xs text-neutral-400">{filteredUnitRows.length} vist</span>
            </div>

            {org.units.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-neutral-300 bg-white py-16 text-center shadow-sm">
                <Building2 className="mb-3 size-10 text-neutral-300" />
                <p className="text-sm text-neutral-500">Ingen enheter ennå</p>
                <p className="mt-1 text-xs text-neutral-400">Opprett en enhet i skjemaet over.</p>
              </div>
            ) : (
              <Table1Shell
                variant="pinpoint"
                toolbar={
                  <Table1Toolbar
                    payloadOverride={layout}
                    searchSlot={
                      <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                        <div
                          className="relative min-w-[200px] flex-1"
                          style={{ ['--layout-accent' as string]: layout.accent }}
                        >
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                          <input
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            placeholder="Søk navn, type, leder…"
                            className={`w-full border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--layout-accent)] ${rSeg}`}
                          />
                        </div>
                      </div>
                    }
                    segmentSlot={
                      <div className={`inline-flex flex-wrap border border-neutral-200 bg-neutral-50/80 p-1 ${rSeg}`}>
                        {(
                          [
                            ['all', 'Alle'] as const,
                            ['department', 'Avdeling'] as const,
                            ['division', 'Divisjon'] as const,
                            ['team', 'Team'] as const,
                            ['location', 'Lokasjon'] as const,
                          ] as const
                        ).map(([id, label]) => {
                          const selected = unitKindSeg === id
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setUnitKindSeg(id)}
                              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${rSeg} ${
                                selected ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-white'
                              }`}
                              style={selected ? { backgroundColor: layout.accent, color: '#fff' } : undefined}
                            >
                              {selected ? (
                                <span className="flex size-4 items-center justify-center rounded-none bg-white/20">
                                  <Check className="size-3" />
                                </span>
                              ) : (
                                <span className="size-4 rounded-none border-2 border-neutral-300" />
                              )}
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    }
                  />
                }
              >
                {filteredUnitRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center border-t border-neutral-100 bg-neutral-50/50 px-6 py-14 text-center">
                    <Building2 className="mb-3 size-10 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-700">Ingen treff</p>
                    <p className="mt-1 max-w-sm text-xs text-neutral-500">
                      Juster søk eller typefilter, eller vis alle enheter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUnitSearch('')
                        setUnitKindSeg('all')
                      }}
                      className="mt-4 rounded-none bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
                    >
                      Nullstill filtre
                    </button>
                  </div>
                ) : (
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={`text-sm ${theadRow}`}>
                        <th className={`${tableCell} font-medium`}>Enhet</th>
                        <th className={`${tableCell} font-medium`}>Type</th>
                        <th className={`${tableCell} font-medium`}>Leder</th>
                        <th className={`${tableCell} w-28 font-medium`}>Ansatte</th>
                        <th className={`${tableCell} w-28 text-right font-medium`} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnitRows.map(({ unit, depth, hasChildren }, rowIdx) => {
                        const color = unit.color ?? KIND_COLORS[unit.kind]
                        const empHere = org.displayEmployees.filter((e) => e.unitId === unit.id && e.active).length
                        const pad = 12 + depth * 20
                        return (
                          <tr key={unit.id} className={`${table1BodyRowClass(layout, rowIdx)} hover:bg-neutral-50/50`}>
                            <td className={tableCell}>
                              <div className="flex items-center gap-2" style={{ paddingLeft: pad }}>
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleUnitExpanded(unit.id)
                                    }}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-none border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                                    aria-expanded={expandedUnits.has(unit.id)}
                                    title={expandedUnits.has(unit.id) ? 'Skjul underenheter' : 'Vis underenheter'}
                                  >
                                    {expandedUnits.has(unit.id) ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="inline-block w-8 shrink-0" aria-hidden />
                                )}
                                <div
                                  className="size-3 shrink-0 rounded-full"
                                  style={{ background: color }}
                                  aria-hidden
                                />
                                <span className="font-medium text-neutral-900">{unit.name}</span>
                              </div>
                            </td>
                            <td className={`${tableCell} text-neutral-700`}>{KIND_LABELS[unit.kind]}</td>
                            <td className={`${tableCell} text-neutral-600`}>{unit.headName ?? unit.managerName ?? '—'}</td>
                            <td className={`${tableCell} tabular-nums text-neutral-700`}>{empHere}</td>
                            <td className={`${tableCell} text-right`}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Slett «${unit.name}»?`)) org.deleteUnit(unit.id)
                                }}
                                className="rounded-none p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                title="Slett"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </Table1Shell>
            )}
          </section>
        </>
      )}

      {/* ── Groups — legacy ─ */}
      {tab === 'groups' && !useStandardOrgList && (
        <section className="w-full space-y-0">
          <Mainbox1
            title="Brukergrupper"
            subtitle="Oversikt over grupper og omfang. Opprett nye grupper i boksene over."
          >
            {org.groups.length === 0 ? (
              <p className="border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">Ingen grupper ennå.</p>
            ) : (
              <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
                {org.groups.map((g) => (
                  <div key={g.id} className={SETTINGS_ROW_GRID}>
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 size-5 shrink-0 text-[#1a3d32]" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{g.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">{org.getGroupLabel(g)}</p>
                        {g.description ? (
                          <p className="mt-1 text-xs text-neutral-400">{g.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="min-w-0 sm:text-right">
                        <span className={SETTINGS_FIELD_LABEL}>Handling</span>
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Slett «${g.name}»?`)) org.deleteGroup(g.id)
                            }}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 sm:w-auto"
                          >
                            <Trash2 className="size-4" />
                            Slett
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Mainbox1>
        </section>
      )}

      {/* ── Settings — KPI-stripe som på hjem, deretter skjema ─ */}
      {tab === 'settings' && (
        <section className="w-full space-y-8">
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h2 className="text-lg font-semibold text-neutral-900">Virksomhetsinnstillinger</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Disse verdiene driver AMU/verneombud-terskler og vises i Council-modulen.
              </p>
            </div>
            <div className="p-4 md:p-6">
              <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
                <div className="divide-y divide-neutral-200">
              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>Hvilket navn skal vises for virksomheten i løsningen og i rapporter?</p>
                <div>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-name">
                    Virksomhetsnavn
                  </label>
                  <input
                    id="org-settings-name"
                    value={org.settings.orgName}
                    onChange={(e) => org.updateSettings({ orgName: e.target.value })}
                    className={ORG_SETTINGS_INPUT}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <div>
                  <p className={SETTINGS_LEAD}>Offisielt organisasjonsnummer (Brønnøysund) brukes ved behov i dokumenter og referanser.</p>
                  <p className="mt-2 text-xs text-neutral-400">Klikk «Hent fra Brreg» for å synkronisere navn, NACE og ansattall.</p>
                </div>
                <div>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-orgnr">
                    Organisasjonsnummer
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="org-settings-orgnr"
                      value={org.settings.orgNumber ?? ''}
                      onChange={(e) => org.updateSettings({ orgNumber: e.target.value || undefined })}
                      placeholder="9 siffer"
                      className={`${ORG_SETTINGS_INPUT} flex-1`}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={handleBrregSync}
                      disabled={brregSyncing || !org.settings.orgNumber}
                      className="mt-1.5 flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${brregSyncing ? 'animate-spin' : ''}`} />
                      Hent fra Brreg
                    </button>
                  </div>
                  {brregError && <p className="mt-1.5 text-xs text-red-600">{brregError}</p>}
                  {brregSuccess && <p className="mt-1.5 text-xs text-emerald-700">Synkronisert fra Brønnøysundregistrene.</p>}
                  {org.settings.brregSyncedAt && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Sist synkronisert: {new Date(org.settings.brregSyncedAt).toLocaleDateString('nb-NO')}
                    </p>
                  )}
                </div>
              </div>

              {/* Brreg status panel — shown when we have synced data */}
              {(org.settings.brregOrgForm || org.settings.brregNaceKode) && (
                <div className={SETTINGS_ROW_GRID}>
                  <p className={SETTINGS_LEAD}>Data hentet fra Brønnøysundregistrene (Enhetsregisteret).</p>
                  <div className="rounded-md border border-neutral-200 bg-neutral-50/70 p-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      {org.settings.brregOrgForm && (
                        <div>
                          <p className={SETTINGS_FIELD_LABEL}>Selskapsform</p>
                          <p className="mt-0.5 font-medium text-neutral-900">{org.settings.brregOrgForm}</p>
                        </div>
                      )}
                      {org.settings.brregAntallAnsatte !== undefined && (
                        <div>
                          <p className={SETTINGS_FIELD_LABEL}>Ansatte (Brreg)</p>
                          <p className="mt-0.5 font-medium text-neutral-900">{org.settings.brregAntallAnsatte}</p>
                          {Math.abs((org.settings.brregAntallAnsatte ?? 0) - org.activeEmployees.length) > Math.ceil((org.settings.brregAntallAnsatte ?? 1) * 0.2) && (
                            <p className="mt-0.5 text-[11px] text-amber-700">Avviker &gt;20% fra ansattlisten</p>
                          )}
                        </div>
                      )}
                      {org.settings.brregNaceKode && (
                        <div className="col-span-2">
                          <p className={SETTINGS_FIELD_LABEL}>Bransje (NACE)</p>
                          <p className="mt-0.5 text-neutral-900">{org.settings.brregNaceKode} — {org.settings.brregNaceBeskrivelse}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>
                  Terskler for verneombud og AMU kan beregnes ut fra dette tallet. Vanligvis synkroniseres det med ansattlisten; du kan overstyre manuelt ved behov.
                </p>
                <div>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-emp-count">
                    Antall ansatte (manuelt)
                  </label>
                  <input
                    id="org-settings-emp-count"
                    type="number"
                    min={0}
                    value={org.settings.employeeCount}
                    onChange={(e) => org.updateSettings({ employeeCount: Number(e.target.value) || 0 })}
                    className={ORG_SETTINGS_INPUT}
                  />
                  <p className="mt-2 text-xs text-neutral-500">Aktive i ansattlisten: {org.activeEmployees.length}</p>
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>Hvilken bransje eller sektor beskriver virksomheten best? Brukes i oversikter og sammenligninger.</p>
                <div>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-sector">
                    Bransje / sektor
                  </label>
                  <input
                    id="org-settings-sector"
                    value={org.settings.industrySector ?? ''}
                    onChange={(e) => org.updateSettings({ industrySector: e.target.value || undefined })}
                    placeholder="f.eks. Helse og omsorg"
                    className={ORG_SETTINGS_INPUT}
                  />
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>
                  Gjelder det en tariffavtale? Dette kan påvirke hvordan enkelte arbeidsmiljøregler tolkes i praksis.
                </p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Tariffavtale</span>
                  <label className={ORG_SETTINGS_CHECK_WRAP}>
                    <input
                      type="checkbox"
                      checked={org.settings.hasCollectiveAgreement}
                      onChange={(e) => org.updateSettings({ hasCollectiveAgreement: e.target.checked })}
                      className="mt-0.5 size-4 rounded border-neutral-400 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-900">Tariffavtale gjelder</span>
                      <p className="text-xs text-neutral-500">Kan fravike noen AML-regler.</p>
                    </div>
                  </label>
                  {org.settings.hasCollectiveAgreement && (
                    <div className="mt-4">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-tariff-name">
                        Avtalens navn
                      </label>
                      <input
                        id="org-settings-tariff-name"
                        value={org.settings.collectiveAgreementName ?? ''}
                        onChange={(e) => org.updateSettings({ collectiveAgreementName: e.target.value || undefined })}
                        placeholder="f.eks. Hovedavtalen LO-NHO"
                        className={ORG_SETTINGS_INPUT}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>
                  Hvem kan velges som digital signatar på oppgaver (utfører og leder)? Tom liste betyr at alle aktive
                  ansatte med e-post kan velges. Når du krysser av minst én person, gjelder kun de som er avkrysset.
                  Oppgaver oppretter automatisk en påminnelse til leder-signatar når utfører har signert.
                </p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Godkjente signatarer</span>
                  <p className="mt-1 text-xs text-neutral-500">
                    Krever e-post på ansatt / medlem. Oppdater under Ansatte eller synk fra medlemmer.
                  </p>
                  <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3">
                    {org.activeEmployees.filter((e) => e.email?.trim()).length === 0 ? (
                      <li className="text-sm text-neutral-500">Ingen aktive med e-post — legg til e-post først.</li>
                    ) : (
                      org.activeEmployees
                        .filter((e) => e.email?.trim())
                        .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
                        .map((e) => {
                          const approved = org.settings.approvedTaskSignerEmployeeIds ?? []
                          const restricted = approved.length > 0
                          const checked = restricted ? approved.includes(e.id) : false
                          return (
                            <li key={e.id} className="flex items-start gap-3 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(ev) => org.toggleApprovedTaskSigner(e.id, ev.target.checked)}
                                className="mt-0.5 size-4 rounded border-neutral-400 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                                aria-label={`Godkjenn ${e.name} som signatar`}
                              />
                              <span className="min-w-0">
                                <span className="font-medium text-neutral-900">{e.name}</span>
                                <span className="mt-0.5 block text-xs text-neutral-500">{e.email}</span>
                              </span>
                            </li>
                          )
                        })
                    )}
                  </ul>
                  {(org.settings.approvedTaskSignerEmployeeIds?.length ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => org.updateSettings({ approvedTaskSignerEmployeeIds: [] })}
                      className="mt-3 text-xs font-medium text-[#1a3d32] underline hover:text-[#142e26]"
                    >
                      Nullstill (alle med e-post kan signere igjen)
                    </button>
                  ) : null}
                </div>
              </div>
                </div>
              </div>
            </div>
          </OrgInsightWhiteCard>

          {/* A-ordning + GDPR admin settings */}
          <OrgInsightWhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-5 py-4 md:px-6">
              <h2 className="text-lg font-semibold text-neutral-900">A-ordning og GDPR-innstillinger</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Supplerende data for terskler og personvernhåndtering.
              </p>
            </div>
            <div className="p-4 md:p-6">
              <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
                <div className="divide-y divide-neutral-200">

                  <div className={SETTINGS_ROW_GRID}>
                    <div>
                      <p className={SETTINGS_LEAD}>Antall ansatte fra siste A-melding til Skatteetaten/NAV/SSB (manuell oppdatering).</p>
                      <a
                        href="https://www.altinn.no"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[#1a3d32] underline"
                      >
                        Åpne Altinn <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="org-aordning-count">
                        A-ordning ansattall
                      </label>
                      <input
                        id="org-aordning-count"
                        type="number"
                        min={0}
                        value={org.settings.aOrdningAntallAnsatte ?? ''}
                        onChange={(e) => org.updateSettings({ aOrdningAntallAnsatte: e.target.value ? Number(e.target.value) : undefined, aOrdningUpdatedAt: new Date().toISOString() })}
                        placeholder="Antall"
                        className={ORG_SETTINGS_INPUT}
                      />
                      {org.settings.aOrdningUpdatedAt && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                          <Calendar className="size-3" />
                          Oppdatert: {new Date(org.settings.aOrdningUpdatedAt).toLocaleDateString('nb-NO')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={SETTINGS_ROW_GRID}>
                    <p className={SETTINGS_LEAD}>E-post til personvernombudet (DPO) eller ansvarlig for GDPR-forespørsler i virksomheten.</p>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="org-dpo-email">
                        Personvernombud (e-post)
                      </label>
                      <input
                        id="org-dpo-email"
                        type="email"
                        value={org.settings.privacyOfficerEmail ?? ''}
                        onChange={(e) => org.updateSettings({ privacyOfficerEmail: e.target.value || undefined })}
                        placeholder="personvern@virksomheten.no"
                        className={ORG_SETTINGS_INPUT}
                      />
                    </div>
                  </div>

                  <div className={SETTINGS_ROW_GRID}>
                    <p className={SETTINGS_LEAD}>Hvor lenge skal inaktive ansattoppføringer bevares etter sluttdato? GDPR Art. 5(1)(e) krever begrensning.</p>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="org-retention-inactive">
                        Oppbevaringstid inaktive ansatte (måneder)
                      </label>
                      <input
                        id="org-retention-inactive"
                        type="number"
                        min={0}
                        max={120}
                        value={org.settings.dataRetentionInactiveMonths ?? 36}
                        onChange={(e) => org.updateSettings({ dataRetentionInactiveMonths: Number(e.target.value) || 36 })}
                        className={ORG_SETTINGS_INPUT}
                      />
                      <p className="mt-1 text-xs text-neutral-400">Standard: 36 måneder (3 år) — reklamasjonsfrist</p>
                    </div>
                  </div>

                  <div className={SETTINGS_ROW_GRID}>
                    <p className={SETTINGS_LEAD}>Referanse til databehandleravtale (DPA) med eventuelle databehandlere (leverandører, HR-system).</p>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="org-dpa-ref">
                        DPA-referanse
                      </label>
                      <input
                        id="org-dpa-ref"
                        value={org.settings.dpaDocumentRef ?? ''}
                        onChange={(e) => org.updateSettings({ dpaDocumentRef: e.target.value || undefined })}
                        placeholder="f.eks. DPA-2026-001 eller lenke til dokument"
                        className={ORG_SETTINGS_INPUT}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </OrgInsightWhiteCard>
        </section>
      )}
      </div>
      </div>
    </div>
  )
}
