// usePlanningOkr — fetch + CRUD for the OKR plan used by /planlegging.
//
// Behaviour:
//   * On first load, calls the provision_okr_baseline_for_org RPC which
//     atomically creates a draft plan + seeds 4 default objectives + 9
//     RACI rows. Idempotent — concurrent loads / multiple tabs reach the
//     same plan via the partial unique index on okr_plans(org, pack).
//   * Fetches objectives + key_results + raci joined.
//   * Optimistic UI for mutations with error rollback and surfacing.
//   * All writes are RLS-gated by organization_id; admin-or-creator-write
//     on plans, admin-or-creator-write on objectives/krs/raci.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  OkrHealth,
  OkrKeyResult,
  OkrObjective,
  OkrPlan,
  OkrPlanFull,
  OkrPlanStatus,
  OkrRaciEntry,
} from '../types/planning'

type DbPlan = {
  id: string
  organization_id: string
  title: string
  description: string | null
  legal_basis: string | null
  horizon: string | null
  sponsor_user_id: string | null
  sponsor_name: string | null
  facilitator_user_id: string | null
  facilitator_name: string | null
  status: OkrPlanStatus
  pack: 'aml-amu' | 'iso-45001'
  activated_at: string | null
  archived_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type DbObjective = {
  id: string
  organization_id: string
  plan_id: string
  ord_label: string
  position: number
  objective: string
  why: string | null
  law_ref: string | null
  owner_user_id: string | null
  owner_name: string | null
  health: OkrHealth
  progress: number | string
  created_at: string
  updated_at: string
}

type DbKeyResult = {
  id: string
  organization_id: string
  objective_id: string
  position: number
  kr: string
  unit: string | null
  target: number | string
  current_value: number | string
  confidence: number | string
  invert: boolean
  owner_user_id: string | null
  owner_name: string | null
  created_at: string
  updated_at: string
}

type DbRaci = {
  id: string
  organization_id: string
  plan_id: string
  position: number
  role_label: string
  person_label: string | null
  is_responsible: boolean
  is_accountable: boolean
  is_consulted: boolean
  is_informed: boolean
  created_at: string
  updated_at: string
}

function mapPlan(r: DbPlan): OkrPlan {
  return {
    id: r.id,
    organizationId: r.organization_id,
    title: r.title,
    description: r.description ?? '',
    legalBasis: r.legal_basis ?? undefined,
    horizon: r.horizon ?? undefined,
    sponsorUserId: r.sponsor_user_id ?? undefined,
    sponsorName: r.sponsor_name ?? undefined,
    facilitatorUserId: r.facilitator_user_id ?? undefined,
    facilitatorName: r.facilitator_name ?? undefined,
    status: r.status,
    pack: r.pack,
    activatedAt: r.activated_at ?? undefined,
    archivedAt: r.archived_at ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapObjective(r: DbObjective): OkrObjective {
  return {
    id: r.id,
    organizationId: r.organization_id,
    planId: r.plan_id,
    ordLabel: r.ord_label,
    position: r.position,
    objective: r.objective,
    why: r.why ?? '',
    lawRef: r.law_ref ?? undefined,
    ownerUserId: r.owner_user_id ?? undefined,
    ownerName: r.owner_name ?? undefined,
    health: r.health,
    progress: Number(r.progress ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapKeyResult(r: DbKeyResult): OkrKeyResult {
  return {
    id: r.id,
    organizationId: r.organization_id,
    objectiveId: r.objective_id,
    position: r.position,
    kr: r.kr,
    unit: r.unit ?? '',
    target: Number(r.target ?? 0),
    currentValue: Number(r.current_value ?? 0),
    confidence: Number(r.confidence ?? 0),
    invert: r.invert,
    ownerUserId: r.owner_user_id ?? undefined,
    ownerName: r.owner_name ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapRaci(r: DbRaci): OkrRaciEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    planId: r.plan_id,
    position: r.position,
    roleLabel: r.role_label,
    personLabel: r.person_label ?? undefined,
    isResponsible: r.is_responsible,
    isAccountable: r.is_accountable,
    isConsulted: r.is_consulted,
    isInformed: r.is_informed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export type UsePlanningOkrReturn = {
  loading: boolean
  error: string | null
  plan: OkrPlanFull | null
  reload: () => void
  // Plan mutations
  updatePlan: (patch: Partial<Omit<OkrPlan, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  // Objective mutations
  addObjective: () => Promise<string | null>
  updateObjective: (id: string, patch: Partial<Omit<OkrObjective, 'id' | 'organizationId' | 'planId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  removeObjective: (id: string) => Promise<void>
  // Key result mutations
  addKeyResult: (objectiveId: string) => Promise<string | null>
  updateKeyResult: (id: string, patch: Partial<Omit<OkrKeyResult, 'id' | 'organizationId' | 'objectiveId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  removeKeyResult: (id: string) => Promise<void>
  // RACI mutations
  addRaci: () => Promise<string | null>
  updateRaci: (id: string, patch: Partial<Omit<OkrRaciEntry, 'id' | 'organizationId' | 'planId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  removeRaci: (id: string) => Promise<void>
}

export function usePlanningOkr(): UsePlanningOkrReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [plan, setPlan] = useState<OkrPlanFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // Keep a live ref to the current plan so callbacks can read it without
  // re-creating themselves on every mutation. Bonus: avoids stale-closure
  // bugs in async handlers that fire after the plan has been updated.
  const planRef = useRef<OkrPlanFull | null>(null)
  useEffect(() => {
    planRef.current = plan
  }, [plan])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        // 1. Provision (atomic, idempotent server-side RPC).
        const provRes = await supabase.rpc('provision_okr_baseline_for_org', {
          p_org_id: orgId,
          p_pack: 'aml-amu',
        })
        if (provRes.error) throw provRes.error
        const planId = String(provRes.data)

        // 2. Hent plan, objectives, raci parallelt.
        const [planRes, objRes, raciRes] = await Promise.all([
          supabase.from('okr_plans').select('*').eq('id', planId).single(),
          supabase
            .from('okr_objectives')
            .select('*')
            .eq('plan_id', planId)
            .order('position', { ascending: true }),
          supabase
            .from('okr_raci')
            .select('*')
            .eq('plan_id', planId)
            .order('position', { ascending: true }),
        ])
        if (planRes.error) throw planRes.error
        if (objRes.error) throw objRes.error
        if (raciRes.error) throw raciRes.error

        const planRow = planRes.data as DbPlan
        const objectives = (objRes.data ?? []) as DbObjective[]
        const objectiveIds = objectives.map((o) => o.id)
        let keyResults: DbKeyResult[] = []
        if (objectiveIds.length > 0) {
          const krRes = await supabase
            .from('okr_key_results')
            .select('*')
            .in('objective_id', objectiveIds)
            .order('position', { ascending: true })
          if (krRes.error) throw krRes.error
          keyResults = (krRes.data ?? []) as DbKeyResult[]
        }

        if (cancelled) return

        const objWithKrs = objectives.map((o) => ({
          ...mapObjective(o),
          keyResults: keyResults.filter((k) => k.objective_id === o.id).map(mapKeyResult),
        }))

        setPlan({
          ...mapPlan(planRow),
          objectives: objWithKrs,
          raci: (raciRes.data ?? []).map((r) => mapRaci(r as DbRaci)),
        })
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Kunne ikke laste OKR-data.'
        setError(msg)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, version])

  // Optimistic mutation helper: applies state, awaits DB write, rolls back
  // + surfaces error on failure. Avoids the "screen snaps back" UX.
  // runDb returns a PostgrestFilterBuilder which is a thenable; we await
  // it directly (it resolves to { error }).
  const optimisticPlanMutation = useCallback(
    async <T,>(
      applyLocal: () => T,
      runDb: () => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      const snapshot = planRef.current
      applyLocal()
      const { error: dbErr } = await runDb()
      if (dbErr) {
        setError(dbErr.message)
        if (snapshot) setPlan(snapshot)
        reload()
      }
    },
    [reload],
  )

  // ── Plan mutations ───────────────────────────────────────────────────────

  const updatePlan = useCallback<UsePlanningOkrReturn['updatePlan']>(
    async (patch) => {
      if (!supabase) return
      const current = planRef.current
      if (!current) return
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.description !== undefined) dbPatch.description = patch.description
      if (patch.legalBasis !== undefined) dbPatch.legal_basis = patch.legalBasis
      if (patch.horizon !== undefined) dbPatch.horizon = patch.horizon
      if (patch.sponsorUserId !== undefined) dbPatch.sponsor_user_id = patch.sponsorUserId
      if (patch.sponsorName !== undefined) dbPatch.sponsor_name = patch.sponsorName
      if (patch.facilitatorUserId !== undefined) dbPatch.facilitator_user_id = patch.facilitatorUserId
      if (patch.facilitatorName !== undefined) dbPatch.facilitator_name = patch.facilitatorName
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.pack !== undefined) dbPatch.pack = patch.pack
      if (Object.keys(dbPatch).length === 0) return
      await optimisticPlanMutation(
        () => setPlan((prev) => (prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev)),
        () => supabase.from('okr_plans').update(dbPatch).eq('id', current.id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  // ── Objective mutations ──────────────────────────────────────────────────

  const addObjective = useCallback<UsePlanningOkrReturn['addObjective']>(async () => {
    if (!supabase) return null
    const current = planRef.current
    if (!current) return null
    const maxPos = current.objectives.reduce((m, o) => Math.max(m, o.position), 0)
    const nextOrd = `O${current.objectives.length + 1}`
    const { data, error: insErr } = await supabase
      .from('okr_objectives')
      .insert({
        organization_id: current.organizationId,
        plan_id: current.id,
        ord_label: nextOrd,
        position: maxPos + 1,
        objective: 'Nytt mål — beskriv det målbare utfallet',
        why: '',
        owner_name: 'HMS-leder',
        health: 'on_track',
        progress: 0,
      })
      .select('*')
      .single()
    if (insErr || !data) {
      setError(insErr?.message ?? 'Kunne ikke opprette mål.')
      return null
    }
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            objectives: [
              ...prev.objectives,
              { ...mapObjective(data as DbObjective), keyResults: [] },
            ],
          }
        : prev,
    )
    return String(data.id)
  }, [supabase])

  const updateObjective = useCallback<UsePlanningOkrReturn['updateObjective']>(
    async (id, patch) => {
      if (!supabase) return
      const dbPatch: Record<string, unknown> = {}
      if (patch.ordLabel !== undefined) dbPatch.ord_label = patch.ordLabel
      if (patch.position !== undefined) dbPatch.position = patch.position
      if (patch.objective !== undefined) dbPatch.objective = patch.objective
      if (patch.why !== undefined) dbPatch.why = patch.why
      if (patch.lawRef !== undefined) dbPatch.law_ref = patch.lawRef
      if (patch.ownerUserId !== undefined) dbPatch.owner_user_id = patch.ownerUserId
      if (patch.ownerName !== undefined) dbPatch.owner_name = patch.ownerName
      if (patch.health !== undefined) dbPatch.health = patch.health
      if (patch.progress !== undefined) dbPatch.progress = patch.progress
      await optimisticPlanMutation(
        () =>
          setPlan((prev) =>
            prev
              ? {
                  ...prev,
                  objectives: prev.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)),
                }
              : prev,
          ),
        () => supabase.from('okr_objectives').update(dbPatch).eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  const removeObjective = useCallback<UsePlanningOkrReturn['removeObjective']>(
    async (id) => {
      if (!supabase) return
      await optimisticPlanMutation(
        () => setPlan((prev) => (prev ? { ...prev, objectives: prev.objectives.filter((o) => o.id !== id) } : prev)),
        () => supabase.from('okr_objectives').delete().eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  // ── Key result mutations ─────────────────────────────────────────────────

  const addKeyResult = useCallback<UsePlanningOkrReturn['addKeyResult']>(
    async (objectiveId) => {
      if (!supabase) return null
      const current = planRef.current
      if (!current) return null
      const obj = current.objectives.find((o) => o.id === objectiveId)
      if (!obj) return null
      const maxPos = obj.keyResults.reduce((m, k) => Math.max(m, k.position), 0)
      const { data, error: insErr } = await supabase
        .from('okr_key_results')
        .insert({
          organization_id: current.organizationId,
          objective_id: objectiveId,
          position: maxPos + 1,
          kr: 'Nytt nøkkelresultat — beskriv målbart utfall',
          unit: '%',
          target: 100,
          current_value: 0,
          confidence: 0.5,
          invert: false,
          owner_name: obj.ownerName ?? 'HMS-leder',
        })
        .select('*')
        .single()
      if (insErr || !data) {
        setError(insErr?.message ?? 'Kunne ikke opprette nøkkelresultat.')
        return null
      }
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              objectives: prev.objectives.map((o) =>
                o.id === objectiveId
                  ? { ...o, keyResults: [...o.keyResults, mapKeyResult(data as DbKeyResult)] }
                  : o,
              ),
            }
          : prev,
      )
      return String(data.id)
    },
    [supabase],
  )

  const updateKeyResult = useCallback<UsePlanningOkrReturn['updateKeyResult']>(
    async (id, patch) => {
      if (!supabase) return
      const dbPatch: Record<string, unknown> = {}
      if (patch.position !== undefined) dbPatch.position = patch.position
      if (patch.kr !== undefined) dbPatch.kr = patch.kr
      if (patch.unit !== undefined) dbPatch.unit = patch.unit
      if (patch.target !== undefined) dbPatch.target = patch.target
      if (patch.currentValue !== undefined) dbPatch.current_value = patch.currentValue
      if (patch.confidence !== undefined) dbPatch.confidence = patch.confidence
      if (patch.invert !== undefined) dbPatch.invert = patch.invert
      if (patch.ownerUserId !== undefined) dbPatch.owner_user_id = patch.ownerUserId
      if (patch.ownerName !== undefined) dbPatch.owner_name = patch.ownerName
      await optimisticPlanMutation(
        () =>
          setPlan((prev) =>
            prev
              ? {
                  ...prev,
                  objectives: prev.objectives.map((o) => ({
                    ...o,
                    keyResults: o.keyResults.map((k) => (k.id === id ? { ...k, ...patch } : k)),
                  })),
                }
              : prev,
          ),
        () => supabase.from('okr_key_results').update(dbPatch).eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  const removeKeyResult = useCallback<UsePlanningOkrReturn['removeKeyResult']>(
    async (id) => {
      if (!supabase) return
      await optimisticPlanMutation(
        () =>
          setPlan((prev) =>
            prev
              ? {
                  ...prev,
                  objectives: prev.objectives.map((o) => ({
                    ...o,
                    keyResults: o.keyResults.filter((k) => k.id !== id),
                  })),
                }
              : prev,
          ),
        () => supabase.from('okr_key_results').delete().eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  // ── RACI mutations ───────────────────────────────────────────────────────

  const addRaci = useCallback<UsePlanningOkrReturn['addRaci']>(async () => {
    if (!supabase) return null
    const current = planRef.current
    if (!current) return null
    const maxPos = current.raci.reduce((m, r) => Math.max(m, r.position), 0)
    const { data, error: insErr } = await supabase
      .from('okr_raci')
      .insert({
        organization_id: current.organizationId,
        plan_id: current.id,
        position: maxPos + 1,
        role_label: 'Ny rolle',
        person_label: '',
        is_responsible: false,
        is_accountable: false,
        is_consulted: false,
        is_informed: true,
      })
      .select('*')
      .single()
    if (insErr || !data) {
      setError(insErr?.message ?? 'Kunne ikke opprette RACI-rad.')
      return null
    }
    setPlan((prev) =>
      prev ? { ...prev, raci: [...prev.raci, mapRaci(data as DbRaci)] } : prev,
    )
    return String(data.id)
  }, [supabase])

  const updateRaci = useCallback<UsePlanningOkrReturn['updateRaci']>(
    async (id, patch) => {
      if (!supabase) return
      const dbPatch: Record<string, unknown> = {}
      if (patch.position !== undefined) dbPatch.position = patch.position
      if (patch.roleLabel !== undefined) dbPatch.role_label = patch.roleLabel
      if (patch.personLabel !== undefined) dbPatch.person_label = patch.personLabel
      if (patch.isResponsible !== undefined) dbPatch.is_responsible = patch.isResponsible
      if (patch.isAccountable !== undefined) dbPatch.is_accountable = patch.isAccountable
      if (patch.isConsulted !== undefined) dbPatch.is_consulted = patch.isConsulted
      if (patch.isInformed !== undefined) dbPatch.is_informed = patch.isInformed
      // RACI table check constraint requires at least one role flag to be true.
      // Validate client-side before the round-trip to give immediate feedback.
      const current = planRef.current?.raci.find((r) => r.id === id)
      if (current) {
        const next = { ...current, ...patch }
        if (!next.isResponsible && !next.isAccountable && !next.isConsulted && !next.isInformed) {
          setError('Minst én RACI-rolle (R/A/C/I) må være valgt for hver rad.')
          return
        }
      }
      await optimisticPlanMutation(
        () =>
          setPlan((prev) =>
            prev
              ? { ...prev, raci: prev.raci.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
              : prev,
          ),
        () => supabase.from('okr_raci').update(dbPatch).eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  const removeRaci = useCallback<UsePlanningOkrReturn['removeRaci']>(
    async (id) => {
      if (!supabase) return
      await optimisticPlanMutation(
        () => setPlan((prev) => (prev ? { ...prev, raci: prev.raci.filter((r) => r.id !== id) } : prev)),
        () => supabase.from('okr_raci').delete().eq('id', id),
      )
    },
    [supabase, optimisticPlanMutation],
  )

  return useMemo(
    () => ({
      loading,
      error,
      plan,
      reload,
      updatePlan,
      addObjective,
      updateObjective,
      removeObjective,
      addKeyResult,
      updateKeyResult,
      removeKeyResult,
      addRaci,
      updateRaci,
      removeRaci,
    }),
    [
      loading,
      error,
      plan,
      reload,
      updatePlan,
      addObjective,
      updateObjective,
      removeObjective,
      addKeyResult,
      updateKeyResult,
      removeKeyResult,
      addRaci,
      updateRaci,
      removeRaci,
    ],
  )
}
