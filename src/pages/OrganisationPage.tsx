import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  GitBranch,
  Mail,
  Pencil,
  Phone,
  Plus,
  Settings2,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { OrganisationHeaderIllustration } from '../components/organisation/OrganisationHeaderIllustration'
import { SidebarBox1 } from '../components/layout/SidebarBox1'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import {
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import type { EmploymentType, OrgEmployee, OrgUnitKind, UserGroup } from '../types/organisation'

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<OrgUnitKind, string> = {
  division: 'Divisjon', department: 'Avdeling', team: 'Team', location: 'Lokasjon',
}
const KIND_COLORS: Record<OrgUnitKind, string> = {
  division: '#1a3d32', department: '#0284c7', team: '#059669', location: '#6b7280',
}
const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  permanent: 'Fast ansatt', temporary: 'Midlertidig', intern: 'Intern/lærling', contractor: 'Konsulent/innleid',
}
const ROLE_OPTIONS = ['Leder', 'Fagansvarlig', 'Fagmedarbeider', 'Saksbehandler', 'Verneombud', 'Tillitsvalgt', 'Konsulent', 'Annet']

const BASE_INPUT =
  'mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'
/** Matches ProjectDashboard — shell content column */
const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
/** Hero action row: same height & typography as «Ny ansatt» */
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium leading-none'
/** Inputs aligned with table container (rounded-2xl) — not pill-shaped */
const FILTER_INPUT_CLASS =
  'rounded-xl border border-neutral-200/90 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1a3d32','#0284c7','#7c3aed','#d97706','#dc2626','#0d9488','#9333ea','#2563eb']
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Employee form modal ───────────────────────────────────────────────────────

function EmployeeFormModal({
  initial, employees, units, onSave, onClose,
}: {
  initial?: OrgEmployee | null
  employees: OrgEmployee[]
  units: ReturnType<typeof useOrganisation>['units']
  onSave: (data: Omit<OrgEmployee, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    jobTitle: initial?.jobTitle ?? '',
    role: initial?.role ?? '',
    unitId: initial?.unitId ?? '',
    reportsToId: initial?.reportsToId ?? '',
    location: initial?.location ?? '',
    employmentType: initial?.employmentType ?? 'permanent' as EmploymentType,
    startDate: initial?.startDate ?? '',
    active: initial?.active ?? true,
  })

  const unit = units.find((u) => u.id === form.unitId)
  const manager = employees.find((e) => e.id === form.reportsToId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      email: form.email || undefined,
      phone: form.phone || undefined,
      jobTitle: form.jobTitle || undefined,
      role: form.role || undefined,
      unitId: form.unitId || undefined,
      unitName: unit?.name,
      reportsToId: form.reportsToId || undefined,
      reportsToName: manager?.name,
      location: form.location || undefined,
      employmentType: form.employmentType,
      startDate: form.startDate || undefined,
      active: form.active,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 bg-neutral-50">
          <h2 className="font-semibold text-neutral-900">{initial ? 'Rediger ansatt' : 'Ny ansatt'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <form id="emp-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-600">Fullt navn *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} placeholder="Fornavn Etternavn" />
            </div>
            {/* Job title + role */}
            <div>
              <label className="text-xs font-medium text-neutral-600">Stillingstittel</label>
              <input value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} className={BASE_INPUT} placeholder="f.eks. Seniorkonsulent" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">Rollekategori</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={BASE_INPUT}>
                <option value="">— Velg —</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Email + phone */}
            <div>
              <label className="text-xs font-medium text-neutral-600">E-post</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={BASE_INPUT} placeholder="navn@firma.no" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">Telefon</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={BASE_INPUT} placeholder="+47 000 00 000" />
            </div>
            {/* Unit + reports to */}
            <div>
              <label className="text-xs font-medium text-neutral-600">Avdeling / team</label>
              <select value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))} className={BASE_INPUT}>
                <option value="">— Ingen —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({KIND_LABELS[u.kind]})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">Rapporterer til</label>
              <select value={form.reportsToId} onChange={(e) => setForm((f) => ({ ...f, reportsToId: e.target.value }))} className={BASE_INPUT}>
                <option value="">— Ingen (toppnivå) —</option>
                {employees.filter((e) => e.id !== initial?.id && e.active).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.jobTitle ? ` — ${e.jobTitle}` : ''}</option>
                ))}
              </select>
            </div>
            {/* Location + type */}
            <div>
              <label className="text-xs font-medium text-neutral-600">Arbeidssted</label>
              <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={BASE_INPUT} placeholder="f.eks. Oslo" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">Ansettelsestype</label>
              <select value={form.employmentType} onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value as EmploymentType }))} className={BASE_INPUT}>
                {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {/* Start date */}
            <div>
              <label className="text-xs font-medium text-neutral-600">Startdato</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={BASE_INPUT} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                Aktiv ansatt
              </label>
            </div>
          </form>
        </div>
        <div className="flex gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
          <button type="submit" form="emp-form" className="flex-1 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
            {initial ? 'Lagre endringer' : 'Legg til ansatt'}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">Avbryt</button>
        </div>
      </div>
    </div>
  )
}

// ─── Org chart — reporting-line tree ──────────────────────────────────────────

const NODE_W = 180
const NODE_H = 72
const H_GAP = 24
const V_GAP = 60

type ChartNode = {
  emp: OrgEmployee
  x: number
  y: number
  children: ChartNode[]
  subtreeWidth: number
}

function buildTree(
  empId: string | undefined,
  reportingTree: Map<string, OrgEmployee[]>,
  employees: OrgEmployee[],
  depth: number,
): ChartNode | null {
  const emp = empId ? employees.find((e) => e.id === empId) : null
  if (!emp) return null
  const childEmps = reportingTree.get(emp.id) ?? []
  const childNodes = childEmps
    .map((c) => buildTree(c.id, reportingTree, employees, depth + 1))
    .filter(Boolean) as ChartNode[]

  const subtreeWidth = childNodes.length === 0
    ? NODE_W
    : childNodes.reduce((acc, c) => acc + c.subtreeWidth, 0) + H_GAP * (childNodes.length - 1)

  return { emp, x: 0, y: depth * (NODE_H + V_GAP), children: childNodes, subtreeWidth }
}

function layoutTree(node: ChartNode, left: number): void {
  if (node.children.length === 0) {
    node.x = left + (node.subtreeWidth - NODE_W) / 2
    return
  }
  let cursor = left
  for (const child of node.children) {
    layoutTree(child, cursor)
    cursor += child.subtreeWidth + H_GAP
  }
  const firstChild = node.children[0]
  const lastChild = node.children[node.children.length - 1]
  node.x = (firstChild.x + lastChild.x) / 2
}

function flattenTree(node: ChartNode): ChartNode[] {
  return [node, ...node.children.flatMap(flattenTree)]
}

function OrgChart({ employees, reportingTree }: {
  employees: OrgEmployee[]
  reportingTree: Map<string, OrgEmployee[]>
}) {
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)

  // Build tree from root(s) — employees with no reportsToId
  const roots = useMemo(
    () => employees.filter((e) => e.active && !e.reportsToId),
    [employees],
  )

  const { nodes, svgW, svgH } = useMemo(() => {
    const rootNodes = roots
      .map((r) => buildTree(r.id, reportingTree, employees, 0))
      .filter(Boolean) as ChartNode[]

    if (rootNodes.length === 0) return { nodes: [], svgW: 400, svgH: 200 }

    // Layout all roots side by side
    let cursor = 0
    for (const root of rootNodes) {
      layoutTree(root, cursor)
      cursor += root.subtreeWidth + H_GAP * 3
    }

    const allNodes = rootNodes.flatMap(flattenTree)
    const maxX = Math.max(...allNodes.map((n) => n.x + NODE_W))
    const maxY = Math.max(...allNodes.map((n) => n.y + NODE_H))
    return { nodes: allNodes, svgW: maxX + 32, svgH: maxY + 32 }
  }, [roots, reportingTree, employees])

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <GitBranch className="mb-3 size-10 text-neutral-300" />
        <p className="text-sm font-medium text-neutral-500">Ingen ansatte å vise</p>
        <p className="mt-1 text-xs text-neutral-400">Legg til ansatte i fanen «Ansatte» og sett «Rapporterer til»</p>
      </div>
    )
  }

  // Build connector lines (parent → child midpoints)
  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = []
  for (const node of nodes) {
    for (const child of node.children) {
      const x1 = node.x + NODE_W / 2
      const y1 = node.y + NODE_H
      const x2 = child.x + NODE_W / 2
      const y2 = child.y
      const midY = (y1 + y2) / 2
      lines.push({ x1, y1: midY, x2, y2: midY, key: `h-${node.emp.id}-${child.emp.id}` })
      lines.push({ x1, y1, x2: x1, y2: midY, key: `v1-${node.emp.id}-${child.emp.id}` })
      lines.push({ x1: x2, y1: midY, x2, y2, key: `v2-${node.emp.id}-${child.emp.id}` })
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
        <GitBranch className="size-4 text-neutral-400" />
        <span className="text-sm font-semibold text-neutral-700">Organisasjonskart</span>
        <span className="ml-1 text-xs text-neutral-400">({nodes.length} ansatte)</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200"><ZoomOut className="size-4" /></button>
          <span className="w-12 text-center text-xs tabular-nums text-neutral-500">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200"><ZoomIn className="size-4" /></button>
          <button type="button" onClick={() => setZoom(1)} className="ml-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200">Reset</button>
        </div>
      </div>

      {/* Scrollable chart area */}
      <div className="overflow-auto p-5" style={{ maxHeight: '70vh' }}>
        <div style={{ transformOrigin: 'top left', transform: `scale(${zoom})`, width: svgW, height: svgH, transition: 'transform 0.2s' }}>
          <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* Connector lines */}
            {lines.map((l) => (
              <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#d1d5db" strokeWidth="1.5" />
            ))}

            {/* Employee nodes */}
            {nodes.map((node) => {
              const bg = avatarColor(node.emp.name)
              const unitColor = node.emp.unitId
                ? (node.emp.unitId === 'u-all' ? '#1a3d32' : '#0284c7')
                : '#6b7280'
              return (
                <g key={node.emp.id} transform={`translate(${node.x}, ${node.y})`}>
                  {/* Card shadow */}
                  <rect x={1} y={2} width={NODE_W - 2} height={NODE_H} rx={10} fill="#0000000d" />
                  {/* Card */}
                  <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="white" stroke="#e5e7eb" strokeWidth="1" />
                  {/* Left accent bar */}
                  <rect x={0} y={0} width={5} height={NODE_H} rx={10} fill={unitColor} />
                  {/* Avatar */}
                  <circle cx={24} cy={NODE_H / 2} r={16} fill={bg} />
                  <text x={24} y={NODE_H / 2 + 5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'white', fontFamily: 'system-ui' }}>
                    {initials(node.emp.name)}
                  </text>
                  {/* Name */}
                  <text x={46} y={NODE_H / 2 - 9} style={{ fontSize: 11, fontWeight: 600, fill: '#111827', fontFamily: 'system-ui' }}>
                    {node.emp.name.length > 18 ? node.emp.name.slice(0, 17) + '…' : node.emp.name}
                  </text>
                  {/* Title */}
                  <text x={46} y={NODE_H / 2 + 5} style={{ fontSize: 9, fill: '#6b7280', fontFamily: 'system-ui' }}>
                    {(node.emp.jobTitle ?? '').length > 22 ? (node.emp.jobTitle ?? '').slice(0, 21) + '…' : (node.emp.jobTitle ?? '')}
                  </text>
                  {/* Role badge */}
                  {node.emp.role && (
                    <>
                      <rect x={46} y={NODE_H / 2 + 12} width={Math.min(node.emp.role.length * 6 + 8, NODE_W - 52)} height={14} rx={7} fill="#f3f4f6" />
                      <text x={50} y={NODE_H / 2 + 22} style={{ fontSize: 8, fill: '#374151', fontFamily: 'system-ui' }}>
                        {node.emp.role.length > 18 ? node.emp.role.slice(0, 17) + '…' : node.emp.role}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span>Linjer viser «Rapporterer til»-relasjoner.</span>
        <span>Venstre farge = avdelingstilknytning.</span>
        <span>Legg til ansatte og velg «Rapporterer til» for å bygge treet.</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'orgchart' | 'employees' | 'units' | 'groups' | 'settings'

const TAB_VALUES: Tab[] = ['orgchart', 'employees', 'units', 'groups', 'settings']

function tabFromSearch(raw: string | null): Tab {
  if (raw && TAB_VALUES.includes(raw as Tab)) return raw as Tab
  return 'orgchart'
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
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)
  const org = useOrganisation()
  const { supabaseConfigured, organization: orgRow, members: orgMembers, profile, user, isDemoMode } =
    useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(() => tabFromSearch(searchParams.get('tab')), [searchParams])
  const setTab = useCallback(
    (id: Tab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id === 'orgchart') next.delete('tab')
          else next.set('tab', id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const [empModal, setEmpModal] = useState<{ mode: 'create' | 'edit'; emp?: OrgEmployee } | null>(null)
  const [searchEmp, setSearchEmp] = useState('')
  const [filterUnit, setFilterUnit] = useState('')

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
      return matchSearch && matchUnit
    })
  }, [org.displayEmployees, searchEmp, filterUnit])

  const companyTitle = orgRow?.name?.trim() || org.settings.orgName || 'Organisasjon'
  const memberHeadline =
    supabaseConfigured && orgMembers.length > 0
      ? `${orgMembers.length} medlem${orgMembers.length === 1 ? '' : 'er'} i organisasjonen`
      : `${org.activeEmployees.length} aktive ansatte · ${org.units.length} enheter`

  function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitForm.name.trim()) return
    org.createUnit(unitForm.name, unitForm.kind, unitForm.parentId || undefined, {
      headName: unitForm.headName || undefined,
      color: unitForm.color,
    })
    setUnitForm((f) => ({ ...f, name: '', headName: '' }))
  }

  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!groupForm.name.trim()) return
    let scope: UserGroup['scope']
    if (groupForm.scopeKind === 'all') scope = { kind: 'all' }
    else if (groupForm.scopeKind === 'units') scope = { kind: 'units', unitIds: groupForm.unitIds }
    else if (groupForm.scopeKind === 'employees') scope = { kind: 'employees', employeeIds: groupForm.employeeIds }
    else scope = { kind: 'mixed', unitIds: groupForm.unitIds, employeeIds: groupForm.employeeIds }
    org.createGroup(groupForm.name, groupForm.description, scope)
    setGroupForm((f) => ({ ...f, name: '', description: '', unitIds: [], employeeIds: [] }))
  }

  const topLevelUnits = org.units.filter((u) => !u.parentId)
  const childrenOf = (id: string) => org.units.filter((u) => u.parentId === id)

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'orgchart',  label: 'Org.kart',      icon: GitBranch },
    { id: 'employees', label: 'Ansatte',        icon: Users },
    { id: 'units',     label: 'Enheter',        icon: Building2 },
    { id: 'groups',    label: 'Brukergrupper',  icon: UserCheck },
    { id: 'settings',  label: 'Innstillinger',  icon: Settings2 },
  ]

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
      {/* Employee modal */}
      {empModal && (
        <EmployeeFormModal
          initial={empModal.mode === 'edit' ? empModal.emp : null}
          employees={org.employees}
          units={org.units}
          onClose={() => setEmpModal(null)}
          onSave={(data) => {
            if (empModal.mode === 'edit' && empModal.emp) {
              const target = storedForEdit(empModal.emp, org.employees)
              if (target.id.startsWith('m-')) {
                org.createEmployee(data)
              } else {
                org.updateEmployee(target.id, data)
              }
            } else {
              org.createEmployee(data)
            }
            setEmpModal(null)
          }}
        />
      )}

      {/* Breadcrumb — aligned with ProjectDashboard */}
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <span>
          <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
            Workspace
          </Link>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Organisasjon</span>
        </span>
      </nav>

      {/* Hero block — matches dashboard org summary */}
      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {companyTitle}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{memberHeadline}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Struktur, ansatte og grupper for virksomheten. Terskler for verneombud og AMU oppdateres ut fra antall ansatte.
          </p>
          {supabaseConfigured && user && (
            <p className="mt-2 text-xs text-neutral-500">
              {isDemoMode ? 'Demo-besøkende (anonym sesjon)' : 'Innlogget som'}{' '}
              {!isDemoMode && (profile?.display_name ?? profile?.email ?? user.email ?? 'bruker')}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
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
              onClick={() => setEmpModal({ mode: 'create' })}
              className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white shadow-sm hover:bg-[#142e26]`}
            >
              <Plus className="size-4 shrink-0" /> Ny ansatt
            </button>
          </div>
        </div>
        <div className="flex shrink-0 justify-center sm:justify-end sm:pt-1" aria-hidden>
          <OrganisationHeaderIllustration className="h-[7.5rem] w-auto max-w-[min(100%,220px)] md:h-32" />
        </div>
      </div>

      {/* In-page nav — menu_1 tokens */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-black/10 shadow-sm" style={menu1.barStyle}>
        <div className="flex min-h-[3rem] flex-wrap items-stretch gap-0 px-1 py-1 sm:px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={tb.className}
                style={tb.style}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
                {id === 'employees' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      active ? 'bg-neutral-200 text-neutral-700' : 'bg-white/20 text-white'
                    }`}
                  >
                    {org.activeEmployees.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 space-y-8">
      {/* ── Org chart ─────────────────────────────────────────────────────── */}
      {tab === 'orgchart' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Organisasjonskart</h2>
            <p className="mt-1 text-sm text-neutral-500">Rapporteringslinjer og hierarki — samme visuelle ramme som tabellen under.</p>
          </div>
          <OrgChart employees={org.activeEmployees} reportingTree={org.reportingTree} />
        </section>
      )}

      {/* ── Employees — airy table (aligned with dashboard) ───────────────── */}
      {tab === 'employees' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Ansatte</h2>
              <p className="mt-1 text-sm text-neutral-500">Oversikt med romslige kolonner — samme uttrykk som forsiden.</p>
            </div>
            <span className="text-xs text-neutral-400">{filteredEmployees.length} vist</span>
          </div>
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

          {filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center shadow-sm">
              <Users className="mb-3 size-10 text-neutral-300" />
              <p className="text-sm text-neutral-500">Ingen ansatte ennå</p>
              <button
                type="button"
                onClick={() => setEmpModal({ mode: 'create' })}
                className="mt-4 rounded-full bg-[#1a3d32] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#142e26]"
              >
                <Plus className="mr-1 inline size-4" />
                Legg til første ansatt
              </button>
            </div>
          ) : (
            <Table1Shell>
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
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                              onClick={() => setEmpModal({ mode: 'edit', emp })}
                              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
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
                                className="rounded-lg p-2 text-neutral-400 hover:bg-amber-50 hover:text-amber-600"
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
            </Table1Shell>
          )}
        </section>
      )}

      {/* ── Units ─────────────────────────────────────────────────────────── */}
      {tab === 'units' && (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Organisasjonsstruktur</h2>
            <div className="space-y-2">
              {topLevelUnits.map((unit) => (
                <UnitRow key={unit.id} unit={unit} childrenOf={childrenOf} onDelete={org.deleteUnit} depth={0} />
              ))}
              {org.units.length === 0 && <p className="text-sm text-neutral-500">Ingen enheter ennå.</p>}
            </div>
          </div>
          <SidebarBox1
            heading="Ny enhet"
            primaryAction={({ className, style }) => (
              <button type="submit" form="org-sidebar-new-unit" className={className} style={style}>
                <Plus className="size-4" />
                Opprett enhet
              </button>
            )}
          >
            <form id="org-sidebar-new-unit" className="space-y-3" onSubmit={handleCreateUnit}>
              <div><label className="text-xs font-medium text-neutral-500">Navn *</label>
                <input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} /></div>
              <div><label className="text-xs font-medium text-neutral-500">Type</label>
                <select value={unitForm.kind} onChange={(e) => setUnitForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))} className={BASE_INPUT}>
                  {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-neutral-500">Overordnet enhet</label>
                <select value={unitForm.parentId} onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))} className={BASE_INPUT}>
                  <option value="">— Ingen —</option>
                  {org.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-neutral-500">Leder / enhetshode</label>
                <input value={unitForm.headName} onChange={(e) => setUnitForm((f) => ({ ...f, headName: e.target.value }))} className={BASE_INPUT} /></div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Farge (org.kart)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={unitForm.color} onChange={(e) => setUnitForm((f) => ({ ...f, color: e.target.value }))} className="h-9 w-14 cursor-pointer rounded-lg border border-neutral-200" />
                  <span className="text-xs text-neutral-400">{unitForm.color}</span>
                </div>
              </div>
            </form>
          </SidebarBox1>
        </div>
      )}

      {/* ── Groups ────────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Brukergrupper</h2>
            <Mainbox1>
              {org.groups.length === 0 ? <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen grupper ennå.</p> : (
                <ul className="divide-y divide-neutral-100">
                  {org.groups.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2"><Users className="size-4 text-[#1a3d32]" /><span className="font-medium">{g.name}</span></div>
                        <p className="mt-0.5 text-xs text-neutral-500">{org.getGroupLabel(g)}</p>
                        {g.description && <p className="text-xs text-neutral-400">{g.description}</p>}
                      </div>
                      <button type="button" onClick={() => { if (confirm(`Slett «${g.name}»?`)) org.deleteGroup(g.id) }} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </Mainbox1>
          </div>
          <SidebarBox1
            heading="Ny brukergruppe"
            primaryAction={({ className, style }) => (
              <button type="submit" form="org-sidebar-new-group" className={className} style={style}>
                <Plus className="size-4" />
                Opprett gruppe
              </button>
            )}
          >
            <form id="org-sidebar-new-group" className="space-y-3" onSubmit={handleCreateGroup}>
              <div><label className="text-xs font-medium text-neutral-500">Gruppenavn *</label><input value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} /></div>
              <div><label className="text-xs font-medium text-neutral-500">Beskrivelse</label><input value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} className={BASE_INPUT} /></div>
              <div><label className="text-xs font-medium text-neutral-500">Omfang</label>
                <select value={groupForm.scopeKind} onChange={(e) => setGroupForm((f) => ({ ...f, scopeKind: e.target.value as typeof groupForm.scopeKind }))} className={BASE_INPUT}>
                  <option value="all">Alle ansatte</option>
                  <option value="units">Bestemte enheter</option>
                  <option value="employees">Bestemte ansatte</option>
                  <option value="mixed">Enheter + ansatte</option>
                </select></div>
              {(groupForm.scopeKind === 'units' || groupForm.scopeKind === 'mixed') && (
                <div><label className="text-xs font-medium text-neutral-500">Velg enheter</label>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-neutral-200 p-2">
                    {org.units.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={groupForm.unitIds.includes(u.id)} onChange={(e) => setGroupForm((f) => ({ ...f, unitIds: e.target.checked ? [...f.unitIds, u.id] : f.unitIds.filter((id) => id !== u.id) }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                        <span>{u.name}</span>
                      </label>
                    ))}
                  </div></div>
              )}
              {(groupForm.scopeKind === 'employees' || groupForm.scopeKind === 'mixed') && (
                <div><label className="text-xs font-medium text-neutral-500">Velg ansatte</label>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-neutral-200 p-2">
                    {org.activeEmployees.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={groupForm.employeeIds.includes(emp.id)} onChange={(e) => setGroupForm((f) => ({ ...f, employeeIds: e.target.checked ? [...f.employeeIds, emp.id] : f.employeeIds.filter((id) => id !== emp.id) }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                        <span>{emp.name}</span><span className="text-xs text-neutral-400">{emp.jobTitle}</span>
                      </label>
                    ))}
                  </div></div>
              )}
            </form>
          </SidebarBox1>
        </div>
      )}

      {/* ── Settings — samme layout som Brukergrupper (liste/skjema venstre, boks høyre) ─ */}
      {tab === 'settings' && (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <Mainbox1
            title="Virksomhetsinnstillinger"
            subtitle="Disse verdiene driver AMU/verneombud-terskler og vises i Council-modulen."
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500">Virksomhetsnavn</label>
                <input
                  value={org.settings.orgName}
                  onChange={(e) => org.updateSettings({ orgName: e.target.value })}
                  className={BASE_INPUT}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Organisasjonsnummer</label>
                <input
                  value={org.settings.orgNumber ?? ''}
                  onChange={(e) => org.updateSettings({ orgNumber: e.target.value || undefined })}
                  placeholder="9 siffer"
                  className={BASE_INPUT}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  Antall ansatte (manuelt — overstyres av ansattlisten)
                </label>
                <input
                  type="number"
                  min={0}
                  value={org.settings.employeeCount}
                  onChange={(e) => org.updateSettings({ employeeCount: Number(e.target.value) || 0 })}
                  className={BASE_INPUT}
                />
                <p className="mt-1 text-xs text-neutral-400">Aktive i ansattlisten: {org.activeEmployees.length}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Bransje / sektor</label>
                <input
                  value={org.settings.industrySector ?? ''}
                  onChange={(e) => org.updateSettings({ industrySector: e.target.value || undefined })}
                  placeholder="f.eks. Helse og omsorg"
                  className={BASE_INPUT}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3.5">
                <input
                  type="checkbox"
                  checked={org.settings.hasCollectiveAgreement}
                  onChange={(e) => org.updateSettings({ hasCollectiveAgreement: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-900">Tariffavtale gjelder</span>
                  <p className="text-xs text-neutral-500">Kan fravike noen AML-regler.</p>
                </div>
              </label>
              {org.settings.hasCollectiveAgreement && (
                <div>
                  <label className="text-xs font-medium text-neutral-500">Tariffavtalens navn</label>
                  <input
                    value={org.settings.collectiveAgreementName ?? ''}
                    onChange={(e) => org.updateSettings({ collectiveAgreementName: e.target.value || undefined })}
                    placeholder="f.eks. Hovedavtalen LO-NHO"
                    className={BASE_INPUT}
                  />
                </div>
              )}
            </div>
          </Mainbox1>

          <SidebarBox1
            heading="Beregnede terskler (AML 2024)"
            subheading="Oppdateres ut fra antall ansatte og innstillinger."
          >
            <div className="space-y-3 text-sm">
              {[
                { label: 'Antall ansatte', value: `${org.totalEmployeeCount}`, ok: undefined },
                { label: 'Verneombud lovpålagt (AML §6-1)', value: ct.requiresVerneombud ? 'Ja (≥5)' : 'Nei', ok: ct.requiresVerneombud },
                { label: 'AMU kan kreves (10–29)', value: ct.mayRequestAmu ? 'Ja' : 'Nei', ok: ct.mayRequestAmu },
                { label: 'AMU lovpålagt (AML §7-1)', value: ct.requiresAmu ? 'Ja (≥30)' : 'Nei', ok: ct.requiresAmu },
              ].map(({ label, value, ok }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200/80 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-neutral-600">{label}</span>
                  <span
                    className={`shrink-0 font-medium ${ok === true ? 'text-emerald-700' : ok === false ? 'text-neutral-400' : 'text-neutral-700'}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </SidebarBox1>
        </div>
      )}
      </div>
    </div>
  )
}

// ─── Unit tree row ────────────────────────────────────────────────────────────

function UnitRow({ unit, childrenOf, onDelete, depth }: {
  unit: ReturnType<typeof useOrganisation>['units'][0]
  childrenOf: (id: string) => ReturnType<typeof useOrganisation>['units']
  onDelete: (id: string) => void
  depth: number
}) {
  const children = childrenOf(unit.id)
  const color = unit.color ?? KIND_COLORS[unit.kind]
  return (
    <div>
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm ${depth > 0 ? 'ml-6' : ''}`}>
        <div className="size-3 shrink-0 rounded-full" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-neutral-900">{unit.name}</span>
          <span className="ml-2 text-xs text-neutral-400">{KIND_LABELS[unit.kind]}</span>
          {(unit.headName || unit.managerName) && <span className="ml-2 text-xs text-neutral-500">· {unit.headName ?? unit.managerName}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm shrink-0" style={{ background: color }} />
          <button type="button" onClick={() => { if (confirm(`Slett «${unit.name}»?`)) onDelete(unit.id) }} className="rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="size-3.5" /></button>
        </div>
      </div>
      {children.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {children.map((child) => <UnitRow key={child.id} unit={child} childrenOf={childrenOf} onDelete={onDelete} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}
