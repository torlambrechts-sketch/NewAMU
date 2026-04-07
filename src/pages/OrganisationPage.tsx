import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  GitBranch,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
  PieChart,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { OrganisationHeaderIllustration } from '../components/organisation/OrganisationHeaderIllustration'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import {
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import type { EmploymentType, OrgEmployee, OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'

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

/** Terskel-bokser under meny (samme mørke bakgrunn som fanemeny) */
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
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
          <button type="submit" form="emp-form" className="flex-1 rounded-none bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
            {initial ? 'Lagre endringer' : 'Legg til ansatt'}
          </button>
          <button type="button" onClick={onClose} className="rounded-none border border-neutral-200 px-5 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">Avbryt</button>
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

type Tab = 'orgchart' | 'employees' | 'units' | 'groups' | 'insights' | 'settings'

const TAB_VALUES: Tab[] = ['orgchart', 'employees', 'units', 'groups', 'insights', 'settings']

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
  const rSeg = R_ORG_FLAT
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
  const [empSegment, setEmpSegment] = useState<'all' | 'active' | 'inactive'>('all')
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

  const hasAnyEmployees = org.displayEmployees.length > 0

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

  const toggleUnitExpanded = useCallback((id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'orgchart',  label: 'Org.kart',      icon: GitBranch },
    { id: 'employees', label: 'Ansatte',        icon: Users },
    { id: 'units',     label: 'Enheter',        icon: Building2 },
    { id: 'groups',    label: 'Brukergrupper',  icon: UserCheck },
    { id: 'insights',  label: 'Innsikt',        icon: PieChart },
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
      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            const tb = menu1.tabButton(active)
            const isInsightsTab = id === 'insights'
            const insightActive = active && isInsightsTab
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  insightActive
                    ? `${tb.className} !bg-white !text-neutral-900 shadow-none [&_svg]:opacity-100 [&_svg]:text-neutral-800`
                    : tb.className
                }
                style={
                  insightActive
                    ? {
                        ...tb.style,
                        backgroundColor: '#ffffff',
                        color: '#171717',
                        boxShadow: 'none',
                      }
                    : tb.style
                }
              >
                <Icon className={`size-4 shrink-0 ${insightActive ? 'opacity-100 text-neutral-800' : 'opacity-90'}`} />
                <span className="whitespace-nowrap">{label}</span>
                {id === 'employees' && (
                  <span
                    className={`rounded-none px-2 py-0.5 text-[10px] font-semibold ${
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

      {tab === 'settings' && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                title: 'Antall ansatte',
                sub: 'Grunnlag for terskler',
                value: `${org.totalEmployeeCount}`,
                valueClass: 'text-white',
              },
              {
                title: 'Verneombud (AML §6-1)',
                sub: 'Kreves ved ≥5 ansatte',
                value: ct.requiresVerneombud ? 'Ja (≥5)' : 'Nei',
                valueClass: ct.requiresVerneombud ? 'text-emerald-200' : 'text-white/80',
              },
              {
                title: 'AMU kan kreves',
                sub: 'Område 10–29 ansatte',
                value: ct.mayRequestAmu ? 'Ja' : 'Nei',
                valueClass: ct.mayRequestAmu ? 'text-amber-200' : 'text-white/80',
              },
              {
                title: 'AMU lovpålagt (AML §7-1)',
                sub: 'Kreves ved ≥30 ansatte',
                value: ct.requiresAmu ? 'Ja (≥30)' : 'Nei',
                valueClass: ct.requiresAmu ? 'text-emerald-200' : 'text-white/80',
              },
            ] as const
          ).map((item) => (
            <div
              key={item.title}
              className={SETTINGS_THRESHOLD_BOX}
              style={menu1.barStyle}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
              <p className="mt-1 text-xs text-white/70">{item.sub}</p>
              <p className={`mt-2 text-lg font-semibold tabular-nums ${item.valueClass}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'groups' && (
        <form id="org-new-group" className="mt-6 overflow-hidden rounded-none border border-black/10" onSubmit={handleCreateGroup} style={menu1.barStyle}>
          <div className={ORG_MERGED_PANEL}>
            <div className={ORG_MERGED_COL}>
              <p className={SETTINGS_LEAD_ON_DARK}>Hva skal gruppen hete, og hvordan beskrives den kort?</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-group-name">
                    Gruppenavn
                  </label>
                  <input
                    id="org-group-name"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className={SETTINGS_INPUT_ON_DARK}
                    placeholder="Påkrevd"
                  />
                </div>
                <div>
                  <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-group-desc">
                    Beskrivelse
                  </label>
                  <input
                    id="org-group-desc"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                    className={SETTINGS_INPUT_ON_DARK}
                    placeholder="Valgfritt"
                  />
                </div>
              </div>
            </div>

            <div className={ORG_MERGED_COL}>
              <p className={SETTINGS_LEAD_ON_DARK}>Hvem skal omfanget gjelde — alle, utvalgte enheter, utvalgte ansatte eller en kombinasjon?</p>
              <div className="mt-3">
                <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="org-group-scope">
                  Omfang
                </label>
                <select
                  id="org-group-scope"
                  value={groupForm.scopeKind}
                  onChange={(e) =>
                    setGroupForm((f) => ({ ...f, scopeKind: e.target.value as typeof groupForm.scopeKind }))
                  }
                  className={SETTINGS_INPUT_ON_DARK}
                >
                  <option value="all">Alle ansatte</option>
                  <option value="units">Bestemte enheter</option>
                  <option value="employees">Bestemte ansatte</option>
                  <option value="mixed">Enheter + ansatte</option>
                </select>
              </div>
            </div>

            <div className={`${ORG_MERGED_COL} min-h-[12rem] lg:max-w-[min(100%,560px)] lg:flex-[1.35]`}>
              {(groupForm.scopeKind === 'units' || groupForm.scopeKind === 'mixed') && (
                <>
                  <p className={SETTINGS_LEAD_ON_DARK}>Kryss av hvilke enheter som inngår i gruppen.</p>
                  <p className={`${SETTINGS_FIELD_LABEL_ON_DARK} mt-3`}>Velg enheter</p>
                  <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5 rounded-none border border-white/20 bg-black/15 p-2">
                    {org.units.length === 0 ? (
                      <p className="text-xs text-white/60">Ingen enheter ennå.</p>
                    ) : (
                      org.units.map((u) => (
                        <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/95">
                          <input
                            type="checkbox"
                            checked={groupForm.unitIds.includes(u.id)}
                            onChange={(e) =>
                              setGroupForm((f) => ({
                                ...f,
                                unitIds: e.target.checked ? [...f.unitIds, u.id] : f.unitIds.filter((id) => id !== u.id),
                              }))
                            }
                            className="size-4 rounded-none border-white/40 bg-white/10 text-[#1a3d32] focus:ring-1 focus:ring-white"
                          />
                          <span>{u.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              {(groupForm.scopeKind === 'employees' || groupForm.scopeKind === 'mixed') && (
                <>
                  <p
                    className={
                      SETTINGS_LEAD_ON_DARK +
                      (groupForm.scopeKind === 'mixed' ? ' mt-4 border-t border-white/15 pt-4' : '')
                    }
                  >
                    Velg enkeltpersoner som skal inngå.
                  </p>
                  <p className={`${SETTINGS_FIELD_LABEL_ON_DARK} mt-3`}>Velg ansatte</p>
                  <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5 rounded-none border border-white/20 bg-black/15 p-2">
                    {org.activeEmployees.length === 0 ? (
                      <p className="text-xs text-white/60">Ingen aktive ansatte.</p>
                    ) : (
                      org.activeEmployees.map((emp) => (
                        <label key={emp.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/95">
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
                            className="size-4 rounded-none border-white/40 bg-white/10 text-[#1a3d32] focus:ring-1 focus:ring-white"
                          />
                          <span>{emp.name}</span>
                          {emp.jobTitle && <span className="text-xs text-white/55">{emp.jobTitle}</span>}
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              {groupForm.scopeKind === 'all' && (
                <p className={SETTINGS_LEAD_ON_DARK}>Gruppen gjelder alle ansatte. Ingen ytterligere utvalg.</p>
              )}
            </div>

            <div className={ORG_MERGED_ACTION_COL}>
              <button
                type="submit"
                className="inline-flex w-full min-w-[10rem] items-center justify-center gap-2 rounded-none border border-white/35 bg-white px-5 py-3 text-sm font-semibold shadow-none transition hover:bg-white/95"
                style={{ color: layout.accent }}
              >
                <Plus className="size-4 shrink-0" />
                Opprett gruppe
              </button>
            </div>
          </div>
        </form>
      )}

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
                onClick={() => setEmpModal({ mode: 'create' })}
                className="mt-4 rounded-none bg-[#1a3d32] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#142e26]"
              >
                <Plus className="mr-1 inline size-4" />
                Legg til første ansatt
              </button>
            </div>
          ) : (
            <Table1Shell
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
              ) : (
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
                              onClick={() => setEmpModal({ mode: 'edit', emp })}
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
              )}
            </Table1Shell>
          )}
        </section>
      )}

      {/* ── Units — samlet panel under meny som brukergrupper ─ */}
      {tab === 'units' && (
        <>
          <form id="org-new-unit" className="mt-6 overflow-hidden rounded-none border border-black/10" onSubmit={handleCreateUnit} style={menu1.barStyle}>
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
                                    onClick={() => toggleUnitExpanded(unit.id)}
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

      {/* ── Groups — samme mønster som Innstillinger (bokser under meny + tabellayout) ─ */}
      {tab === 'groups' && (
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

      {/* ── Innsikt — oversiktstall (egen fane, aktiv fane lys som referanse) ─ */}
      {tab === 'insights' && (
        <section className="w-full space-y-6">
          <div>
            <h2
              className="text-xl font-semibold text-neutral-900 sm:text-2xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Organisasjonsinnsikt
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Samlet oversikt over medlemmer, ansatte, enheter og grupper — oppdatert fra dataene dine.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  label: 'Medlemmer (app)',
                  value: insightStats.members,
                  hint: 'Kontoer tilknyttet organisasjonen',
                },
                {
                  label: 'Ansatte (totalt)',
                  value: insightStats.employeesTotal,
                  hint: `${insightStats.employeesActive} aktive · ${insightStats.employeesInactive} inaktive`,
                },
                {
                  label: 'Enheter',
                  value: insightStats.units,
                  hint: `${insightStats.unitsTopLevel} på toppnivå`,
                },
                {
                  label: 'Brukergrupper',
                  value: insightStats.groups,
                  hint: 'Definerte grupper',
                },
              ] as const
            ).map((card) => (
              <div
                key={card.label}
                className="border border-neutral-200 bg-white px-4 py-4 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{card.value}</p>
                <p className="mt-1 text-xs text-neutral-500">{card.hint}</p>
              </div>
            ))}
          </div>
          <Mainbox1 title="Enheter etter type" subtitle="Fordeling på divisjon, avdeling, team og lokasjon.">
            <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
              {(['division', 'department', 'team', 'location'] as const).map((kind) => (
                <div key={kind} className={SETTINGS_ROW_GRID}>
                  <p className={SETTINGS_LEAD}>{KIND_LABELS[kind]}</p>
                  <div className="text-right sm:text-left">
                    <span className={SETTINGS_FIELD_LABEL}>Antall</span>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums text-neutral-900">
                      {insightStats.byKind[kind] ?? 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Mainbox1>
          <Mainbox1 title="Samsvar (AML-terskler)" subtitle="Basert på antall ansatte i beregningen.">
            <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>Verneombud etter arbeidsmiljøloven §6-1.</p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Status</span>
                  <p className={`mt-1.5 text-base font-semibold ${ct.requiresVerneombud ? 'text-emerald-700' : 'text-neutral-600'}`}>
                    {ct.requiresVerneombud ? 'Lovpålagt (≥5 ansatte)' : 'Ikke påkrevd (&lt;5)'}
                  </p>
                </div>
              </div>
              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>AMU kan kreves i området 10–29 ansatte.</p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Status</span>
                  <p className={`mt-1.5 text-base font-semibold ${ct.mayRequestAmu ? 'text-amber-800' : 'text-neutral-600'}`}>
                    {ct.mayRequestAmu ? 'Ja' : 'Nei'}
                  </p>
                </div>
              </div>
              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>AMU etter arbeidsmiljøloven §7-1 (vanligvis ≥30 ansatte).</p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Status</span>
                  <p className={`mt-1.5 text-base font-semibold ${ct.requiresAmu ? 'text-emerald-700' : 'text-neutral-600'}`}>
                    {ct.requiresAmu ? 'Lovpålagt (≥30)' : 'Nei'}
                  </p>
                </div>
              </div>
            </div>
          </Mainbox1>
        </section>
      )}

      {/* ── Settings — full bredde; terskler i bokser over (under meny) ─ */}
      {tab === 'settings' && (
        <section className="w-full">
          <Mainbox1
            title="Virksomhetsinnstillinger"
            subtitle="Disse verdiene driver AMU/verneombud-terskler og vises i Council-modulen."
          >
            <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
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
                    className={SETTINGS_INPUT}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>Offisielt organisasjonsnummer (Brønnøysund) brukes ved behov i dokumenter og referanser.</p>
                <div>
                  <label className={SETTINGS_FIELD_LABEL} htmlFor="org-settings-orgnr">
                    Organisasjonsnummer
                  </label>
                  <input
                    id="org-settings-orgnr"
                    value={org.settings.orgNumber ?? ''}
                    onChange={(e) => org.updateSettings({ orgNumber: e.target.value || undefined })}
                    placeholder="9 siffer"
                    className={SETTINGS_INPUT}
                    inputMode="numeric"
                  />
                </div>
              </div>

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
                    className={SETTINGS_INPUT}
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
                    className={SETTINGS_INPUT}
                  />
                </div>
              </div>

              <div className={SETTINGS_ROW_GRID}>
                <p className={SETTINGS_LEAD}>
                  Gjelder det en tariffavtale? Dette kan påvirke hvordan enkelte arbeidsmiljøregler tolkes i praksis.
                </p>
                <div>
                  <span className={SETTINGS_FIELD_LABEL}>Tariffavtale</span>
                  <label className={SETTINGS_CHECK_WRAP}>
                    <input
                      type="checkbox"
                      checked={org.settings.hasCollectiveAgreement}
                      onChange={(e) => org.updateSettings({ hasCollectiveAgreement: e.target.checked })}
                      className="mt-0.5 size-4 rounded-none border-neutral-400 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
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
                        className={SETTINGS_INPUT}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Mainbox1>
        </section>
      )}
      </div>
    </div>
  )
}
