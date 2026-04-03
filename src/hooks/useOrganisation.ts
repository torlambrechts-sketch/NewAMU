import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DEFAULT_ORG_SETTINGS, OrgEmployee, OrgSettings, OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'

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

const SEED_UNITS: OrgUnit[] = [
  { id: 'u-all', name: 'Hele organisasjonen', kind: 'division', description: 'Toppnivå — alle ansatte', createdAt: now, updatedAt: now },
  { id: 'u-dev', name: 'Development', kind: 'department', parentId: 'u-all', memberCount: 4, createdAt: now, updatedAt: now },
  { id: 'u-design', name: 'Design', kind: 'department', parentId: 'u-all', memberCount: 2, createdAt: now, updatedAt: now },
  { id: 'u-marketing', name: 'Marketing', kind: 'department', parentId: 'u-all', memberCount: 2, createdAt: now, updatedAt: now },
]

const SEED_GROUPS: UserGroup[] = [
  { id: 'g-all', name: 'Alle ansatte', description: 'Hele virksomheten', scope: { kind: 'all' }, createdAt: now, updatedAt: now },
  { id: 'g-dev', name: 'Development-team', scope: { kind: 'units', unitIds: ['u-dev'] }, createdAt: now, updatedAt: now },
  { id: 'g-design', name: 'Design-team', scope: { kind: 'units', unitIds: ['u-design'] }, createdAt: now, updatedAt: now },
]

function load(): OrgState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: SEED_SETTINGS, employees: [], units: SEED_UNITS, groups: SEED_GROUPS }
    const p = JSON.parse(raw) as OrgState
    return {
      settings: p.settings ?? SEED_SETTINGS,
      employees: Array.isArray(p.employees) ? p.employees : [],
      units: Array.isArray(p.units) && p.units.length ? p.units : SEED_UNITS,
      groups: Array.isArray(p.groups) && p.groups.length ? p.groups : SEED_GROUPS,
    }
  } catch {
    return { settings: SEED_SETTINGS, employees: [], units: SEED_UNITS, groups: SEED_GROUPS }
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

  const createEmployee = useCallback((
    partial: Omit<OrgEmployee, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
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
      employees: s.employees.map((e) => e.id === id ? { ...e, active: false, endDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() } : e),
    }))
  }, [])

  // ── Units ───────────────────────────────────────────────────────────────────

  const createUnit = useCallback((
    name: string,
    kind: OrgUnitKind,
    parentId?: string,
    opts?: Partial<Pick<OrgUnit, 'description' | 'managerName' | 'memberCount'>>,
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

  const tree = useMemo(() => {
    return [...state.units].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  }, [state.units])

  const unitById = useMemo(() => new Map(state.units.map((u) => [u.id, u])), [state.units])

  const activeEmployees = useMemo(() => state.employees.filter((e) => e.active), [state.employees])

  /**
   * Total employee count for threshold computation.
   * Prefers manual settings.employeeCount when employees list is empty/not maintained.
   */
  const totalEmployeeCount = useMemo(() => {
    const fromList = activeEmployees.length
    return fromList > 0 ? fromList : state.settings.employeeCount
  }, [activeEmployees, state.settings.employeeCount])

  /**
   * Computed compliance thresholds based on 2024 AML amendments.
   */
  const complianceThresholds = useMemo(() => {
    const n = totalEmployeeCount
    return {
      requiresVerneombud: n >= 5,            // AML §6-1 (2024)
      mayRequestAmu: n >= 10 && n < 30,       // AML §7-1 (2024) — on request
      requiresAmu: n >= 30,                   // AML §7-1 (2024)
      totalEmployeeCount: n,
    }
  }, [totalEmployeeCount])

  function getGroupLabel(group: UserGroup): string {
    const s = group.scope
    if (s.kind === 'all') return 'Alle ansatte'
    if (s.kind === 'units') return s.unitIds.map((id) => unitById.get(id)?.name ?? id).join(', ')
    if (s.kind === 'employees') return `${s.employeeIds.length} ansatte`
    if (s.kind === 'mixed') return `${s.unitIds.length} enheter + ${s.employeeIds.length} enkeltpersoner`
    return '—'
  }

  return {
    settings: state.settings,
    employees: state.employees,
    activeEmployees,
    units: state.units,
    groups: state.groups,
    tree,
    unitById,
    totalEmployeeCount,
    complianceThresholds,
    getGroupLabel,
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

// Re-export type for convenience
export type { DEFAULT_ORG_SETTINGS }
