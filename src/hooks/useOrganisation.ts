import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
  type OrgModulePayloadKey,
} from '../lib/orgModulePayload'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { OrganizationMemberRow } from '../types/organization'
import type { OrgEmployee, OrgSettings, OrgUnit, OrgUnitKind, UserGroup } from '../types/organisation'

const MODULE_KEY: OrgModulePayloadKey = 'organisation'
const STORAGE_KEY = 'atics-organisation-v2'
const PERSIST_DEBOUNCE_MS = 450

function normEmail(s: string | null | undefined) {
  const t = s?.trim().toLowerCase()
  return t || undefined
}

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
  approvedTaskSignerEmployeeIds: [],
}

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

function normalizeParsed(p: OrgState): OrgState {
  const rawSettings = p.settings ?? SEED_SETTINGS
  const approved = rawSettings.approvedTaskSignerEmployeeIds
  return {
    settings: {
      ...SEED_SETTINGS,
      ...rawSettings,
      approvedTaskSignerEmployeeIds: Array.isArray(approved) ? approved : [],
    },
    employees: Array.isArray(p.employees) ? p.employees : [],
    units: Array.isArray(p.units) ? p.units : [],
    groups: Array.isArray(p.groups) ? p.groups : [],
  }
}

function seedDemoLocal(): OrgState {
  return { settings: SEED_SETTINGS, employees: SEED_EMPLOYEES, units: SEED_UNITS, groups: SEED_GROUPS }
}

function emptyRemoteState(orgName: string): OrgState {
  return {
    settings: { ...SEED_SETTINGS, orgName, approvedTaskSignerEmployeeIds: [] },
    employees: [],
    units: [],
    groups: [],
  }
}

function loadLocal(): OrgState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDemoLocal()
    const p = JSON.parse(raw) as OrgState
    return normalizeParsed(p)
  } catch {
    return seedDemoLocal()
  }
}

function saveLocal(state: OrgState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function mergeMembersIntoEmployees(
  employees: OrgEmployee[],
  members: OrganizationMemberRow[],
  departments: { id: string; name: string }[],
): OrgEmployee[] {
  if (members.length === 0) return employees
  const deptName = (id: string | null | undefined) => departments.find((d) => d.id === id)?.name
  const byEmail = new Map(
    employees.filter((e) => e.email?.trim()).map((e) => [e.email!.trim().toLowerCase(), e]),
  )
  const memberEmails = new Set(
    members.map((m) => m.email?.trim().toLowerCase()).filter((x): x is string => !!x),
  )
  const out: OrgEmployee[] = []

  for (const m of members) {
    const emailKey = m.email?.trim().toLowerCase()
    const existing = emailKey ? byEmail.get(emailKey) : undefined
    const unitLabel = deptName(m.department_id)
    if (existing) {
      out.push({
        ...existing,
        name: m.display_name.trim() || existing.name,
        unitId: m.department_id ?? existing.unitId,
        unitName: unitLabel ?? existing.unitName,
        email: m.email ?? existing.email,
        updatedAt: new Date().toISOString(),
      })
      continue
    }
    const n = new Date().toISOString()
    out.push({
      id: `m-${m.id}`,
      name: m.display_name.trim() || 'Medlem',
      email: m.email ?? undefined,
      jobTitle: undefined,
      role: undefined,
      unitId: m.department_id ?? undefined,
      unitName: unitLabel,
      reportsToId: undefined,
      reportsToName: undefined,
      location: undefined,
      employmentType: 'permanent',
      startDate: undefined,
      active: true,
      createdAt: n,
      updatedAt: n,
    })
  }

  for (const e of employees) {
    const ek = e.email?.trim().toLowerCase()
    if (ek && memberEmails.has(ek)) continue
    out.push(e)
  }

  return out
}

export function useOrganisation() {
  const { supabase, organization, user, members: orgMembers, departments } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<OrgState>(MODULE_KEY, orgId, userId) : null
  const [localState, setLocalState] = useState<OrgState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<OrgState>(() => {
    if (initialRemote) return normalizeParsed(initialRemote)
    if (organization?.name) return emptyRemoteState(organization.name)
    return emptyRemoteState(SEED_SETTINGS.orgName)
  })
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const state = useRemote ? remoteState : localState
  const setState = useRemote ? setRemoteState : setLocalState

  /** Prefer Supabase organization_members (+ departments) so the org view matches the signed-in tenant. */
  const displayEmployees = useMemo(() => {
    if (!useRemote || orgMembers.length === 0) return state.employees
    return mergeMembersIntoEmployees(state.employees, orgMembers, departments)
  }, [useRemote, orgMembers, departments, state.employees])

  const refreshOrganisation = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<OrgState>(supabase, orgId, MODULE_KEY)
      const orgName = organization?.name ?? SEED_SETTINGS.orgName
      const next = payload
        ? normalizeParsed(payload)
        : emptyRemoteState(orgName)
      if (!payload && organization?.name) {
        next.settings = { ...next.settings, orgName: organization.name }
      }
      setRemoteState(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      setRemoteState(emptyRemoteState(organization?.name ?? SEED_SETTINGS.orgName))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, organization?.name])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshOrganisation()
  }, [useRemote, refreshOrganisation])

  useEffect(() => {
    if (!useRemote || !organization?.name) return
    setRemoteState((s) =>
      s.settings.orgName === organization.name ? s : { ...s, settings: { ...s.settings, orgName: organization.name } },
    )
  }, [useRemote, organization?.name])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localState)
    }
  }, [useRemote, localState])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, remoteState)
          if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, remoteState)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, remoteState])

  const updateSettings = useCallback(
    (patch: Partial<OrgSettings>) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
    },
    [setState],
  )

  const createEmployee = useCallback(
    (partial: Omit<OrgEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
      const n = new Date().toISOString()
      const emp: OrgEmployee = { ...partial, id: crypto.randomUUID(), createdAt: n, updatedAt: n }
      setState((s) => ({ ...s, employees: [...s.employees, emp] }))
      return emp
    },
    [setState],
  )

  const updateEmployee = useCallback(
    (id: string, patch: Partial<OrgEmployee>) => {
      setState((s) => ({
        ...s,
        employees: s.employees.map((e) =>
          e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
        ),
      }))
    },
    [setState],
  )

  const deactivateEmployee = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        employees: s.employees.map((e) =>
          e.id === id
            ? {
                ...e,
                active: false,
                endDate: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString(),
              }
            : e,
        ),
      }))
    },
    [setState],
  )

  const createUnit = useCallback(
    (
      name: string,
      kind: OrgUnitKind,
      parentId?: string,
      opts?: Partial<Pick<OrgUnit, 'description' | 'headName' | 'memberCount' | 'color'>>,
    ) => {
      const n = new Date().toISOString()
      const unit: OrgUnit = {
        id: crypto.randomUUID(),
        name: name.trim(),
        kind,
        parentId,
        ...opts,
        createdAt: n,
        updatedAt: n,
      }
      setState((s) => ({ ...s, units: [...s.units, unit] }))
      return unit
    },
    [setState],
  )

  const updateUnit = useCallback(
    (id: string, patch: Partial<OrgUnit>) => {
      setState((s) => ({
        ...s,
        units: s.units.map((u) => (u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u)),
      }))
    },
    [setState],
  )

  const deleteUnit = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        units: s.units.filter((u) => u.id !== id && u.parentId !== id),
      }))
    },
    [setState],
  )

  const createGroup = useCallback(
    (name: string, description: string, scope: UserGroup['scope']) => {
      const n = new Date().toISOString()
      const group: UserGroup = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim() || undefined,
        scope,
        createdAt: n,
        updatedAt: n,
      }
      setState((s) => ({ ...s, groups: [...s.groups, group] }))
      return group
    },
    [setState],
  )

  const updateGroup = useCallback(
    (id: string, patch: Partial<UserGroup>) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g)),
      }))
    },
    [setState],
  )

  const deleteGroup = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== id) }))
    },
    [setState],
  )

  const tree = useMemo(
    () => [...state.units].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [state.units],
  )

  const unitById = useMemo(() => new Map(state.units.map((u) => [u.id, u])), [state.units])
  const employeeById = useMemo(() => new Map(state.employees.map((e) => [e.id, e])), [state.employees])

  const activeEmployees = useMemo(
    () => displayEmployees.filter((e) => e.active),
    [displayEmployees],
  )

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

  /** Aktive ansatte med e-post som kan velges som signatar på oppgaver (filtrert hvis godkjent-liste er satt). */
  const allowedTaskSignerEmployees = useMemo(() => {
    const withEmail = activeEmployees.filter((e) => normEmail(e.email))
    const approved = state.settings.approvedTaskSignerEmployeeIds
    if (!approved?.length) return withEmail
    const set = new Set(approved)
    return withEmail.filter((e) => set.has(e.id))
  }, [activeEmployees, state.settings.approvedTaskSignerEmployeeIds])

  const toggleApprovedTaskSigner = useCallback(
    (employeeId: string, on: boolean) => {
      const cur = new Set(state.settings.approvedTaskSignerEmployeeIds ?? [])
      if (on) cur.add(employeeId)
      else cur.delete(employeeId)
      updateSettings({ approvedTaskSignerEmployeeIds: [...cur] })
    },
    [state.settings.approvedTaskSignerEmployeeIds, updateSettings],
  )

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

  function initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const resetDemo = useCallback(async () => {
    const next = seedDemoLocal()
    if (useRemote && supabase && orgId) {
      try {
        setError(null)
        await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
        setRemoteState(next)
        if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      }
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    setLocalState(loadLocal())
  }, [useRemote, supabase, orgId, userId])

  return {
    settings: state.settings,
    employees: state.employees,
    /** Employees merged with `organization_members` when using Supabase (for display). */
    displayEmployees,
    activeEmployees,
    units: state.units,
    groups: state.groups,
    tree,
    unitById,
    employeeById,
    totalEmployeeCount,
    complianceThresholds,
    allowedTaskSignerEmployees,
    toggleApprovedTaskSigner,
    reportingTree,
    getGroupLabel,
    initials,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
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
    resetDemo,
  }
}
