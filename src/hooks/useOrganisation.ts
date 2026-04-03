import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'

const STORAGE_KEY = 'atics-organisation-v1'

const KIND_ORDER: OrgUnitKind[] = ['division', 'department', 'team', 'location']

type OrgState = {
  units: OrgUnit[]
  groups: UserGroup[]
}

const SEED_UNITS: OrgUnit[] = [
  { id: 'u-all', name: 'Hele organisasjonen', kind: 'division', description: 'Toppnivå — alle ansatte', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-dev', name: 'Development', kind: 'department', parentId: 'u-all', memberCount: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-design', name: 'Design', kind: 'department', parentId: 'u-all', memberCount: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-marketing', name: 'Marketing', kind: 'department', parentId: 'u-all', memberCount: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

const SEED_GROUPS: UserGroup[] = [
  { id: 'g-all', name: 'Alle ansatte', description: 'Hele virksomheten', scope: { kind: 'all' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'g-dev', name: 'Development-team', scope: { kind: 'units', unitIds: ['u-dev'] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'g-design', name: 'Design-team', scope: { kind: 'units', unitIds: ['u-design'] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

function load(): OrgState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { units: SEED_UNITS, groups: SEED_GROUPS }
    const p = JSON.parse(raw) as OrgState
    return {
      units: Array.isArray(p.units) && p.units.length ? p.units : SEED_UNITS,
      groups: Array.isArray(p.groups) && p.groups.length ? p.groups : SEED_GROUPS,
    }
  } catch {
    return { units: SEED_UNITS, groups: SEED_GROUPS }
  }
}

function save(state: OrgState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useOrganisation() {
  const [state, setState] = useState<OrgState>(load)
  useEffect(() => { save(state) }, [state])

  // ── Units ───────────────────────────────────────────────────────────────────

  const createUnit = useCallback((
    name: string,
    kind: OrgUnitKind,
    parentId?: string,
    opts?: Partial<Pick<OrgUnit, 'description' | 'managerName' | 'memberCount'>>,
  ) => {
    const now = new Date().toISOString()
    const unit: OrgUnit = { id: crypto.randomUUID(), name: name.trim(), kind, parentId, ...opts, createdAt: now, updatedAt: now }
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
    const now = new Date().toISOString()
    const group: UserGroup = { id: crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined, scope, createdAt: now, updatedAt: now }
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
    const sorted = [...state.units].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    return sorted
  }, [state.units])

  const unitById = useMemo(() => new Map(state.units.map((u) => [u.id, u])), [state.units])

  function getGroupLabel(group: UserGroup): string {
    const s = group.scope
    if (s.kind === 'all') return 'Alle ansatte'
    if (s.kind === 'units') return s.unitIds.map((id) => unitById.get(id)?.name ?? id).join(', ')
    if (s.kind === 'employees') return `${s.employeeIds.length} ansatte`
    if (s.kind === 'mixed') return `${s.unitIds.length} enheter + ${s.employeeIds.length} enkeltpersoner`
    return '—'
  }

  return {
    units: state.units,
    groups: state.groups,
    tree,
    unitById,
    getGroupLabel,
    createUnit,
    updateUnit,
    deleteUnit,
    createGroup,
    updateGroup,
    deleteGroup,
  }
}
