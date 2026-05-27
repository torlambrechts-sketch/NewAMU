// usePlanningOkr — fetch + CRUD for the OKR plan used by /planlegging.
//
// Behaviour:
//   * Auto-creates a draft plan if no active plan exists for the org.
//   * Fetches objectives + key_results + raci joined.
//   * Exposes mutation helpers (update objective, update KR, add/remove KR,
//     RACI upserts).
//   * All writes are RLS-gated by organization_id and refresh state
//     locally without round-tripping through reload() unless the schema
//     of the response is unclear (then reload()).
//
// Data shape: OkrPlanFull from src/types/planning.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
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

const SEED_OBJECTIVES: Array<Omit<DbObjective, 'id' | 'organization_id' | 'plan_id' | 'created_at' | 'updated_at'>> = [
  {
    ord_label: 'O1',
    position: 1,
    objective: 'Etablere en levende, dokumentert internkontroll som tåler enhver revisjon',
    why: 'Arbeidstilsynet kan varsle tilsyn når som helst. Vi skal ha ett system, ett spor, full sporbarhet.',
    law_ref: 'AML § 3-1 — Systematisk HMS',
    owner_user_id: null,
    owner_name: 'HMS-leder',
    health: 'on_track',
    progress: 0,
  },
  {
    ord_label: 'O2',
    position: 2,
    objective: 'Heve det psykososiale arbeidsmiljøet og senke sykefraværet',
    why: 'Psykososialt arbeidsmiljø er en sentral lovkrav fra 2026. Vi skal sette mål, kartlegge og handle.',
    law_ref: 'AML § 4-3 — Psykososialt arbeidsmiljø',
    owner_user_id: null,
    owner_name: 'HR-leder',
    health: 'on_track',
    progress: 0,
  },
  {
    ord_label: 'O3',
    position: 3,
    objective: 'Sikre at fysiske forhold er kartlagt og at ansatte aktivt medvirker',
    why: 'Vernetjenesten skal være synlig og brukt. Vi skal forebygge — ikke reagere.',
    law_ref: 'AML § 4-1, § 4-2 — Fysisk arbeidsmiljø + medvirkning',
    owner_user_id: null,
    owner_name: 'Hovedverneombud',
    health: 'on_track',
    progress: 0,
  },
  {
    ord_label: 'O4',
    position: 4,
    objective: 'Bygge HMS-kompetanse i hele organisasjonen — fra ledere til vikarer',
    why: 'Lovens § 3-2 og § 3-5 krever opplæring av både ledere og ansatte.',
    law_ref: 'AML § 3-2, § 3-5 — Opplæring + verneombud',
    owner_user_id: null,
    owner_name: 'HR-leder',
    health: 'on_track',
    progress: 0,
  },
]

const SEED_RACI: Array<Omit<DbRaci, 'id' | 'organization_id' | 'plan_id' | 'created_at' | 'updated_at'>> = [
  { position: 1, role_label: 'Styret / CEO', person_label: '', is_responsible: false, is_accountable: true, is_consulted: true, is_informed: false },
  { position: 2, role_label: 'HMS-leder', person_label: '', is_responsible: true, is_accountable: false, is_consulted: false, is_informed: false },
  { position: 3, role_label: 'HR-leder', person_label: '', is_responsible: true, is_accountable: false, is_consulted: false, is_informed: false },
  { position: 4, role_label: 'Hovedverneombud', person_label: '', is_responsible: true, is_accountable: false, is_consulted: true, is_informed: false },
  { position: 5, role_label: 'AMU', person_label: '', is_responsible: false, is_accountable: false, is_consulted: true, is_informed: true },
  { position: 6, role_label: 'BHT (ekstern)', person_label: '', is_responsible: false, is_accountable: false, is_consulted: true, is_informed: false },
  { position: 7, role_label: 'Linjeledere', person_label: '', is_responsible: true, is_accountable: false, is_consulted: false, is_informed: true },
  { position: 8, role_label: 'Verneombud', person_label: '', is_responsible: false, is_accountable: false, is_consulted: true, is_informed: true },
  { position: 9, role_label: 'Alle ansatte', person_label: '', is_responsible: false, is_accountable: false, is_consulted: false, is_informed: true },
]

export function usePlanningOkr(): UsePlanningOkrReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [plan, setPlan] = useState<OkrPlanFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        // 1. Hent / opprett aktiv plan.
        let planRow: DbPlan | null = null
        const planRes = await supabase
          .from('okr_plans')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('status', ['active', 'draft'])
          .order('created_at', { ascending: false })
          .limit(1)
        if (planRes.error) throw planRes.error
        planRow = (planRes.data?.[0] as DbPlan | undefined) ?? null

        if (!planRow) {
          // Opprett en default draft-plan + seed objectives + RACI.
          const insRes = await supabase
            .from('okr_plans')
            .insert({
              organization_id: orgId,
              title: 'Et arbeidsmiljø som er fullt forsvarlig — og målbart bedre.',
              description: 'Vi skal etterleve Arbeidsmiljøloven til punkt og prikke, og samtidig løfte arbeidsmiljøet utover lovens minstekrav.',
              legal_basis: 'AML § 1-1, § 3-1, § 4-1 til § 4-3',
              horizon: `${new Date().getFullYear()} → ${new Date().getFullYear() + 1}`,
              status: 'draft',
              pack: 'aml-amu',
            })
            .select('*')
            .single()
          if (insRes.error) throw insRes.error
          planRow = insRes.data as DbPlan

          // Seed default objectives.
          await supabase
            .from('okr_objectives')
            .insert(
              SEED_OBJECTIVES.map((o) => ({
                ...o,
                organization_id: orgId,
                plan_id: planRow!.id,
              })),
            )

          // Seed default RACI.
          await supabase
            .from('okr_raci')
            .insert(
              SEED_RACI.map((r) => ({
                ...r,
                organization_id: orgId,
                plan_id: planRow!.id,
              })),
            )
        }

        // 2. Hent objectives + key results + raci.
        const [objRes, raciRes] = await Promise.all([
          supabase
            .from('okr_objectives')
            .select('*')
            .eq('plan_id', planRow.id)
            .order('position', { ascending: true }),
          supabase
            .from('okr_raci')
            .select('*')
            .eq('plan_id', planRow.id)
            .order('position', { ascending: true }),
        ])
        if (objRes.error) throw objRes.error
        if (raciRes.error) throw raciRes.error

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

  // ── Plan mutations ───────────────────────────────────────────────────────

  const updatePlan = useCallback<UsePlanningOkrReturn['updatePlan']>(
    async (patch) => {
      if (!supabase || !plan) return
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
      setPlan((prev) => (prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev))
      const { error: upErr } = await supabase.from('okr_plans').update(dbPatch).eq('id', plan.id)
      if (upErr) reload()
    },
    [supabase, plan, reload],
  )

  // ── Objective mutations ──────────────────────────────────────────────────

  const addObjective = useCallback<UsePlanningOkrReturn['addObjective']>(async () => {
    if (!supabase || !plan) return null
    const nextPos = (plan.objectives[plan.objectives.length - 1]?.position ?? 0) + 1
    const nextOrd = `O${plan.objectives.length + 1}`
    const { data, error: insErr } = await supabase
      .from('okr_objectives')
      .insert({
        organization_id: plan.organizationId,
        plan_id: plan.id,
        ord_label: nextOrd,
        position: nextPos,
        objective: 'Nytt mål — beskriv det målbare utfallet',
        why: '',
        owner_name: 'HMS-leder',
        health: 'on_track',
        progress: 0,
      })
      .select('*')
      .single()
    if (insErr || !data) return null
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
    return data.id as string
  }, [supabase, plan])

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
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              objectives: prev.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)),
            }
          : prev,
      )
      const { error: upErr } = await supabase.from('okr_objectives').update(dbPatch).eq('id', id)
      if (upErr) reload()
    },
    [supabase, reload],
  )

  const removeObjective = useCallback<UsePlanningOkrReturn['removeObjective']>(
    async (id) => {
      if (!supabase) return
      setPlan((prev) => (prev ? { ...prev, objectives: prev.objectives.filter((o) => o.id !== id) } : prev))
      const { error: delErr } = await supabase.from('okr_objectives').delete().eq('id', id)
      if (delErr) reload()
    },
    [supabase, reload],
  )

  // ── Key result mutations ─────────────────────────────────────────────────

  const addKeyResult = useCallback<UsePlanningOkrReturn['addKeyResult']>(
    async (objectiveId) => {
      if (!supabase || !plan) return null
      const obj = plan.objectives.find((o) => o.id === objectiveId)
      if (!obj) return null
      const nextPos = (obj.keyResults[obj.keyResults.length - 1]?.position ?? 0) + 1
      const { data, error: insErr } = await supabase
        .from('okr_key_results')
        .insert({
          organization_id: plan.organizationId,
          objective_id: objectiveId,
          position: nextPos,
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
      if (insErr || !data) return null
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
      return data.id as string
    },
    [supabase, plan],
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
      )
      const { error: upErr } = await supabase.from('okr_key_results').update(dbPatch).eq('id', id)
      if (upErr) reload()
    },
    [supabase, reload],
  )

  const removeKeyResult = useCallback<UsePlanningOkrReturn['removeKeyResult']>(
    async (id) => {
      if (!supabase) return
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
      )
      const { error: delErr } = await supabase.from('okr_key_results').delete().eq('id', id)
      if (delErr) reload()
    },
    [supabase, reload],
  )

  // ── RACI mutations ───────────────────────────────────────────────────────

  const addRaci = useCallback<UsePlanningOkrReturn['addRaci']>(async () => {
    if (!supabase || !plan) return null
    const nextPos = (plan.raci[plan.raci.length - 1]?.position ?? 0) + 1
    const { data, error: insErr } = await supabase
      .from('okr_raci')
      .insert({
        organization_id: plan.organizationId,
        plan_id: plan.id,
        position: nextPos,
        role_label: 'Ny rolle',
        person_label: '',
        is_responsible: false,
        is_accountable: false,
        is_consulted: false,
        is_informed: true,
      })
      .select('*')
      .single()
    if (insErr || !data) return null
    setPlan((prev) =>
      prev ? { ...prev, raci: [...prev.raci, mapRaci(data as DbRaci)] } : prev,
    )
    return data.id as string
  }, [supabase, plan])

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
      setPlan((prev) =>
        prev
          ? { ...prev, raci: prev.raci.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
          : prev,
      )
      const { error: upErr } = await supabase.from('okr_raci').update(dbPatch).eq('id', id)
      if (upErr) reload()
    },
    [supabase, reload],
  )

  const removeRaci = useCallback<UsePlanningOkrReturn['removeRaci']>(
    async (id) => {
      if (!supabase) return
      setPlan((prev) => (prev ? { ...prev, raci: prev.raci.filter((r) => r.id !== id) } : prev))
      const { error: delErr } = await supabase.from('okr_raci').delete().eq('id', id)
      if (delErr) reload()
    },
    [supabase, reload],
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
