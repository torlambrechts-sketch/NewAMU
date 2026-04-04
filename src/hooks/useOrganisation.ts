import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OrgEmployee, OrgSettings, OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'

const STORAGE_KEY = 'atics-organisation-v2'

const KIND_ORDER: OrgUnitKind[] = ['division', 'department', 'team', 'location']

type OrgState = {
  settings: OrgSettings
  employees: OrgEmployee[]
  units: OrgUnit[]
  groups: UserGroup[]
}

const now = new Date().toISOString()

const SEED_SETTINGS: OrgSettings = {
  orgName: 'Virksomheten AS',
  employeeCount: 0,
  hasCollectiveAgreement: false,
}

// Seed with a realistic hierarchy
const SEED_UNITS: OrgUnit[] = [
  { id: 'u-all', name: 'Hele organisasjonen', kind: 'division', color: '#1a3d32', createdAt: now, updatedAt: now },
  { id: 'u-tech', name: 'Teknologi', kind: 'department', parentId: 'u-all', color: '#0284c7', createdAt: now, updatedAt: now },
  { id: 'u-people', name: 'Personal og HMS', kind: 'department', parentId: 'u-all', color: '#7c3aed', createdAt: now, updatedAt: now },
  { id: 'u-ops', name: 'Drift og produksjon', kind: 'department', parentId: 'u-all', color: '#d97706', createdAt: now, updatedAt: now },
  { id: 'u-dev', name: 'Development', kind: 'team', parentId: 'u-tech', color: '#0369a1', createdAt: now, updatedAt: now },
  { id: 'u-design', name: 'Design', kind: 'team', parentId: 'u-tech', color: '#0891b2', createdAt: now, updatedAt: now },
]

const SEED_EMPLOYEES: OrgEmployee[] = [
  { id: 'e1', name: 'Anne Nilsen', email: 'anne@virksomheten.no', phone: '+47 900 00 001', jobTitle: 'Administrerende direktør', role: 'Leder', unitId: 'u-all', unitName: 'Hele organisasjonen', reportsToId: undefined, reportsToName: undefined, location: 'Oslo', employmentType: 'permanent', startDate: '2019-01-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e2', name: 'Bjørn Hansen', email: 'bjorn@virksomheten.no', phone: '+47 900 00 002', jobTitle: 'Teknologidirektør (CTO)', role: 'Leder', unitId: 'u-tech', unitName: 'Teknologi', reportsToId: 'e1', reportsToName: 'Anne Nilsen', location: 'Oslo', employmentType: 'permanent', startDate: '2020-03-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e3', name: 'Camilla Berg', email: 'camilla@virksomheten.no', phone: '+47 900 00 003', jobTitle: 'HR- og HMS-sjef', role: 'Leder', unitId: 'u-people', unitName: 'Personal og HMS', reportsToId: 'e1', reportsToName: 'Anne Nilsen', location: 'Oslo', employmentType: 'permanent', startDate: '2020-06-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e4', name: 'David Lund', email: 'david@virksomheten.no', phone: '+47 900 00 004', jobTitle: 'Driftssjef', role: 'Leder', unitId: 'u-ops', unitName: 'Drift og produksjon', reportsToId: 'e1', reportsToName: 'Anne Nilsen', location: 'Bergen', employmentType: 'permanent', startDate: '2021-01-15', active: true, createdAt: now, updatedAt: now },
  { id: 'e5', name: 'Eva Strand', email: 'eva@virksomheten.no', jobTitle: 'Senioutvikler', role: 'Fagansvarlig', unitId: 'u-dev', unitName: 'Development', reportsToId: 'e2', reportsToName: 'Bjørn Hansen', location: 'Oslo', employmentType: 'permanent', startDate: '2021-08-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e6', name: 'Frode Moe', email: 'frode@virksomheten.no', jobTitle: 'Utvikler', role: 'Fagmedarbeider', unitId: 'u-dev', unitName: 'Development', reportsToId: 'e5', reportsToName: 'Eva Strand', location: 'Oslo', employmentType: 'permanent', startDate: '2022-04-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e7', name: 'Guro Kvam', email: 'guro@virksomheten.no', jobTitle: 'UX-designer', role: 'Fagmedarbeider', unitId: 'u-design', unitName: 'Design', reportsToId: 'e2', reportsToName: 'Bjørn Hansen', location: 'Oslo', employmentType: 'permanent', startDate: '2022-09-01', active: true, createdAt: now, updatedAt: now },
  { id: 'e8', name: 'Hanne Vik', email: 'hanne@virksomheten.no', jobTitle: 'HMS-koordinator', role: 'Verneombud', unitId: 'u-people', unitName: 'Personal og HMS', reportsToId: 'e3', reportsToName: 'Camilla Berg', location: 'Oslo', employmentType: 'permanent', startDate: '2021-03-01', active: true, createdAt: now, updatedAt: now },
]

const SEED_GROUPS: UserGroup[] = [
  { id: 'g-all', name: 'Alle ansatte', description: 'Hele virksomheten', scope: { kind: 'all' }, createdAt: now, updatedAt: now },
  { id: 'g-tech', name: 'Teknologi-avdelingen', scope: { kind: 'units', unitIds: ['u-tech'] }, createdAt: now, updatedAt: now },
  { id: 'g-hms', name: 'HMS-team', scope: { kind: 'units', unitIds: ['u-people'] }, createdAt: now, updatedAt: now },
]

function load(): OrgState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: SEED_SETTINGS, employees: SEED_EMPLOYEES, units: SEED_UNITS, groups: SEED_GROUPS }
    const p = JSON.parse(raw) as OrgState
    return {
      settings: p.settings ?? SEED_SETTINGS,
      employees: Array.isArray(p.employees) ? p.employees : SEED_EMPLOYEES,
      units: Array.isArray(p.units) && p.units.length ? p.units : SEED_UNITS,
      groups: Array.isArray(p.groups) && p.groups.length ? p.groups : SEED_GROUPS,
    }
  } catch {
    return { settings: SEED_SETTINGS, employees: SEED_EMPLOYEES, units: SEED_UNITS, groups: SEED_GROUPS }
  }
}

function save(state: OrgState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useOrganisation() {
  const [state, setState] = useState<OrgState>(load)
  useEffect(() => { save(state) }, [state])

  // ── Settings ────────────────────────────────────────────────────────────────

  const updateSettings = useCallback((patch: Partial<OrgSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  // ── Employees ───────────────────────────────────────────────────────────────

  const createEmployee = useCallback((partial: Omit<OrgEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
    const n = new Date().toISOString()
    const emp: OrgEmployee = { ...partial, id: crypto.randomUUID(), createdAt: n, updatedAt: n }
    setState((s) => ({ ...s, employees: [...s.employees, emp] }))
    return emp
  }, [])

  const updateEmployee = useCallback((id: string, patch: Partial<OrgEmployee>) => {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e),
    }))
  }, [])

  const deactivateEmployee = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) =>
        e.id === id ? { ...e, active: false, endDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() } : e,
      ),
    }))
  }, [])

  // ── Units ───────────────────────────────────────────────────────────────────

  const createUnit = useCallback((
    name: string,
    kind: OrgUnitKind,
    parentId?: string,
    opts?: Partial<Pick<OrgUnit, 'description' | 'headName' | 'memberCount' | 'color'>>,
  ) => {
    const n = new Date().toISOString()
    const unit: OrgUnit = { id: crypto.randomUUID(), name: name.trim(), kind, parentId, ...opts, createdAt: n, updatedAt: n }
    setState((s) => ({ ...s, units: [...s.units, unit] }))
    return unit
  }, [])

  const updateUnit = useCallback((id: string, patch: Partial<OrgUnit>) => {
    setState((s) => ({
      ...s,
      units: s.units.map((u) => u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u),
    }))
  }, [])

  const deleteUnit = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      units: s.units.filter((u) => u.id !== id && u.parentId !== id),
    }))
  }, [])

  // ── User groups ─────────────────────────────────────────────────────────────

  const createGroup = useCallback((name: string, description: string, scope: UserGroup['scope']) => {
    const n = new Date().toISOString()
    const group: UserGroup = { id: crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined, scope, createdAt: n, updatedAt: n }
    setState((s) => ({ ...s, groups: [...s.groups, group] }))
    return group
  }, [])

  const updateGroup = useCallback((id: string, patch: Partial<UserGroup>) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) => g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g),
    }))
  }, [])

  const deleteGroup = useCallback((id: string) => {
    setState((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== id) }))
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const tree = useMemo(
    () => [...state.units].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [state.units],
  )

  const unitById = useMemo(() => new Map(state.units.map((u) => [u.id, u])), [state.units])
  const employeeById = useMemo(() => new Map(state.employees.map((e) => [e.id, e])), [state.employees])

  const activeEmployees = useMemo(() => state.employees.filter((e) => e.active), [state.employees])

  const totalEmployeeCount = useMemo(() => {
    const n = activeEmployees.length
    return n > 0 ? n : state.settings.employeeCount
  }, [activeEmployees, state.settings.employeeCount])

  const complianceThresholds = useMemo(() => {
    const n = totalEmployeeCount
    return {
      requiresVerneombud: n >= 5,
      mayRequestAmu: n >= 10 && n < 30,
      requiresAmu: n >= 30,
      totalEmployeeCount: n,
    }
  }, [totalEmployeeCount])

  /**
   * Build a manager→reports-to tree for the org chart.
   * Returns a map: managerId (or '__root__') → direct reports.
   */
  const reportingTree = useMemo(() => {
    const map = new Map<string, OrgEmployee[]>()
    for (const emp of activeEmployees) {
      const key = emp.reportsToId ?? '__root__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(emp)
    }
    return map
  }, [activeEmployees])

  function getGroupLabel(group: UserGroup): string {
    const s = group.scope
    if (s.kind === 'all') return 'Alle ansatte'
    if (s.kind === 'units') return s.unitIds.map((id) => unitById.get(id)?.name ?? id).join(', ')
    if (s.kind === 'employees') return `${s.employeeIds.length} ansatte`
    if (s.kind === 'mixed') return `${s.unitIds.length} enheter + ${s.employeeIds.length} enkeltpersoner`
    return '—'
  }

  /** Initials from name */
  function initials(name: string): string {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  }

  return {
    settings: state.settings,
    employees: state.employees,
    activeEmployees,
    units: state.units,
    groups: state.groups,
    tree,
    unitById,
    employeeById,
    totalEmployeeCount,
    complianceThresholds,
    reportingTree,
    getGroupLabel,
    initials,
    updateSettings,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    createUnit,
    updateUnit,
    deleteUnit,
    createGroup,
    updateGroup,
    deleteGroup,
  }
}
