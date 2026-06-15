/* Data hook for Strategy v2 — initiatives (the Execution + Insight spine).
   Loads initiatives + their team, dependency graph, risks and per-initiative
   RACI, provisions the worked portfolio on first view, and exposes CRUD for the
   list/board/detail views. Mirrors the established optimistic + snake_case
   pattern (usePlanningOkr / useStrategyToolAnalyses). */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  InitiativeHealth,
  InitiativeRaciMap,
  InitiativeStage,
  RaciRole,
  RiskStatus,
  StrategyInitiative,
  StrategyRisk,
} from '../types/strategyTools'

type DbInitiative = {
  id: string
  organization_id: string
  key: string
  title: string
  summary: string | null
  pillar_code: string | null
  objective_id: string | null
  owner_user_id: string | null
  owner_name: string | null
  stage: string
  health: string
  progress: number
  start_month: number | null
  end_month: number | null
  budget: number | null
  spent: number | null
}
type DbRisk = {
  id: string
  initiative_id: string | null
  title: string
  owner_user_id: string | null
  owner_name: string | null
  likelihood: number
  impact: number
  status: string
  mitigation: string | null
}

function mapInitiative(r: DbInitiative, team: string[], depends: string[]): StrategyInitiative {
  return {
    id: String(r.id),
    organizationId: r.organization_id,
    key: r.key,
    title: r.title,
    summary: r.summary ?? '',
    pillar: r.pillar_code ?? '',
    objectiveId: r.objective_id,
    owner: r.owner_user_id ?? '',
    ownerName: r.owner_name ?? '',
    stage: r.stage as InitiativeStage,
    health: r.health as InitiativeHealth,
    progress: r.progress,
    s: r.start_month ?? 0,
    e: r.end_month ?? 11,
    budget: Number(r.budget ?? 0),
    spent: Number(r.spent ?? 0),
    team,
    depends,
  }
}
function mapRisk(r: DbRisk): StrategyRisk {
  return {
    id: String(r.id),
    initiativeId: r.initiative_id,
    title: r.title,
    owner: r.owner_user_id ?? '',
    ownerName: r.owner_name ?? '',
    likelihood: r.likelihood,
    impact: r.impact,
    status: r.status as RiskStatus,
    mitigation: r.mitigation ?? '',
  }
}

export type NewInitiative = {
  title: string
  summary?: string
  pillar?: string
  objectiveId?: string | null
  ownerId?: string
  ownerName?: string
  stage?: InitiativeStage
  health?: InitiativeHealth
  progress?: number
  s?: number
  e?: number
  budget?: number
}

export type UseStrategyInitiativesReturn = {
  loading: boolean
  error: string | null
  initiatives: StrategyInitiative[]
  risks: StrategyRisk[]
  raci: InitiativeRaciMap
  raciPeople: string[]
  reload: () => void
  create: (input: NewInitiative) => Promise<StrategyInitiative | null>
  update: (id: string, patch: Partial<StrategyInitiative>) => Promise<void>
  remove: (id: string) => Promise<void>
  moveStage: (id: string, stage: InitiativeStage) => Promise<void>
  addRisk: (initiativeId: string, title: string) => Promise<void>
  updateRisk: (id: string, patch: Partial<StrategyRisk>) => Promise<void>
  removeRisk: (id: string) => Promise<void>
  addDep: (initiativeId: string, dependsOnId: string) => Promise<void>
  removeDep: (initiativeId: string, dependsOnId: string) => Promise<void>
  setRaci: (initiativeId: string, personLabel: string, role: RaciRole | null) => Promise<void>
}

export function useStrategyInitiatives(): UseStrategyInitiativesReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [initiatives, setInitiatives] = useState<StrategyInitiative[]>([])
  const [risks, setRisks] = useState<StrategyRisk[]>([])
  const [raci, setRaci] = useState<InitiativeRaciMap>({})
  const [raciPeople, setRaciPeople] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true); setError(null)
      try {
        await supabase.rpc('provision_strategy_initiatives_for_org', { p_org_id: orgId })
        const [iniRes, depRes, memRes, riskRes, raciRes] = await Promise.all([
          supabase.from('strategy_initiatives').select('*').is('deleted_at', null).order('key', { ascending: true }),
          supabase.from('strategy_initiative_deps').select('initiative_id, depends_on_initiative_id'),
          supabase.from('strategy_initiative_members').select('initiative_id, member_user_id, member_name'),
          supabase.from('strategy_risks').select('*'),
          supabase.from('strategy_initiative_raci').select('initiative_id, person_user_id, person_name, role'),
        ])
        if (cancelled) return
        if (iniRes.error) throw iniRes.error
        const dependsBy: Record<string, string[]> = {}
        for (const d of (depRes.data as Array<{ initiative_id: string; depends_on_initiative_id: string }> | null) || []) {
          ;(dependsBy[d.initiative_id] ||= []).push(String(d.depends_on_initiative_id))
        }
        const teamBy: Record<string, string[]> = {}
        for (const m of (memRes.data as Array<{ initiative_id: string; member_user_id: string | null; member_name: string | null }> | null) || []) {
          ;(teamBy[m.initiative_id] ||= []).push(m.member_user_id ?? m.member_name ?? '')
        }
        const inis = ((iniRes.data as DbInitiative[] | null) || []).map((r) =>
          mapInitiative(r, teamBy[r.id] || [], dependsBy[r.id] || []),
        )
        const raciMap: InitiativeRaciMap = {}
        const people = new Set<string>()
        for (const r of (raciRes.data as Array<{ initiative_id: string; person_user_id: string | null; person_name: string | null; role: RaciRole }> | null) || []) {
          const label = r.person_name ?? r.person_user_id ?? '—'
          ;(raciMap[r.initiative_id] ||= {})[label] = r.role
          people.add(label)
        }
        setInitiatives(inis)
        setRisks(((riskRes.data as DbRisk[] | null) || []).map(mapRisk))
        setRaci(raciMap)
        setRaciPeople([...people])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste initiativer.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const create = useCallback<UseStrategyInitiativesReturn['create']>(
    async (input) => {
      if (!supabase || !orgId) return null
      const seq = initiatives.length + 1
      const { data, error: insErr } = await supabase
        .from('strategy_initiatives')
        .insert({
          organization_id: orgId,
          key: 'STR-' + String(seq).padStart(2, '0'),
          title: input.title,
          summary: input.summary ?? '',
          pillar_code: input.pillar || null,
          objective_id: input.objectiveId ?? null,
          owner_user_id: input.ownerId || null,
          owner_name: input.ownerName || null,
          stage: input.stage ?? 'planned',
          health: input.health ?? 'on',
          progress: input.progress ?? 0,
          start_month: input.s ?? 0,
          end_month: input.e ?? 2,
          budget: input.budget ?? 0,
        })
        .select('*')
        .single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke opprette initiativ.'); return null }
      const ini = mapInitiative(data as DbInitiative, [], [])
      setInitiatives((arr) => [...arr, ini])
      return ini
    },
    [supabase, orgId, initiatives.length],
  )

  const update = useCallback<UseStrategyInitiativesReturn['update']>(
    async (id, patch) => {
      setInitiatives((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      if (!supabase) return
      const db: Record<string, unknown> = {}
      if (patch.title !== undefined) db.title = patch.title
      if (patch.summary !== undefined) db.summary = patch.summary
      if (patch.pillar !== undefined) db.pillar_code = patch.pillar || null
      if (patch.objectiveId !== undefined) db.objective_id = patch.objectiveId
      if (patch.owner !== undefined) db.owner_user_id = patch.owner || null
      if (patch.ownerName !== undefined) db.owner_name = patch.ownerName || null
      if (patch.stage !== undefined) db.stage = patch.stage
      if (patch.health !== undefined) db.health = patch.health
      if (patch.progress !== undefined) db.progress = patch.progress
      if (patch.s !== undefined) db.start_month = patch.s
      if (patch.e !== undefined) db.end_month = patch.e
      if (patch.budget !== undefined) db.budget = patch.budget
      if (patch.spent !== undefined) db.spent = patch.spent
      if (Object.keys(db).length === 0) return
      const { error: upErr } = await supabase.from('strategy_initiatives').update(db).eq('id', id)
      if (upErr) { setError(upErr.message); reload() }
    },
    [supabase, reload],
  )

  const remove = useCallback<UseStrategyInitiativesReturn['remove']>(
    async (id) => {
      setInitiatives((arr) => arr.filter((i) => i.id !== id))
      if (!supabase) return
      const { error: delErr } = await supabase.from('strategy_initiatives').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  const moveStage = useCallback<UseStrategyInitiativesReturn['moveStage']>(
    async (id, stage) => {
      const patch: Partial<StrategyInitiative> = { stage }
      if (stage === 'done') { patch.health = 'done'; patch.progress = 100 }
      await update(id, patch)
    },
    [update],
  )

  const addRisk = useCallback<UseStrategyInitiativesReturn['addRisk']>(
    async (initiativeId, title) => {
      if (!supabase || !orgId) return
      const { data, error: insErr } = await supabase
        .from('strategy_risks')
        .insert({ organization_id: orgId, initiative_id: initiativeId, title, likelihood: 2, impact: 2, status: 'open' })
        .select('*').single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke opprette risiko.'); return }
      setRisks((arr) => [...arr, mapRisk(data as DbRisk)])
    },
    [supabase, orgId],
  )
  const updateRisk = useCallback<UseStrategyInitiativesReturn['updateRisk']>(
    async (id, patch) => {
      setRisks((arr) => arr.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      if (!supabase) return
      const db: Record<string, unknown> = {}
      if (patch.title !== undefined) db.title = patch.title
      if (patch.ownerName !== undefined) db.owner_name = patch.ownerName
      if (patch.likelihood !== undefined) db.likelihood = patch.likelihood
      if (patch.impact !== undefined) db.impact = patch.impact
      if (patch.status !== undefined) db.status = patch.status
      if (patch.mitigation !== undefined) db.mitigation = patch.mitigation
      const { error: upErr } = await supabase.from('strategy_risks').update(db).eq('id', id)
      if (upErr) { setError(upErr.message); reload() }
    },
    [supabase, reload],
  )
  const removeRisk = useCallback<UseStrategyInitiativesReturn['removeRisk']>(
    async (id) => {
      setRisks((arr) => arr.filter((r) => r.id !== id))
      if (!supabase) return
      const { error: delErr } = await supabase.from('strategy_risks').delete().eq('id', id)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  const addDep = useCallback<UseStrategyInitiativesReturn['addDep']>(
    async (initiativeId, dependsOnId) => {
      setInitiatives((arr) => arr.map((i) => (i.id === initiativeId && !i.depends.includes(dependsOnId) ? { ...i, depends: [...i.depends, dependsOnId] } : i)))
      if (!supabase || !orgId) return
      const { error: insErr } = await supabase
        .from('strategy_initiative_deps')
        .insert({ organization_id: orgId, initiative_id: initiativeId, depends_on_initiative_id: dependsOnId })
      if (insErr) { setError(insErr.message); reload() }
    },
    [supabase, orgId, reload],
  )
  const removeDep = useCallback<UseStrategyInitiativesReturn['removeDep']>(
    async (initiativeId, dependsOnId) => {
      setInitiatives((arr) => arr.map((i) => (i.id === initiativeId ? { ...i, depends: i.depends.filter((d) => d !== dependsOnId) } : i)))
      if (!supabase) return
      const { error: delErr } = await supabase
        .from('strategy_initiative_deps').delete()
        .eq('initiative_id', initiativeId).eq('depends_on_initiative_id', dependsOnId)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  const setRaciCell = useCallback<UseStrategyInitiativesReturn['setRaci']>(
    async (initiativeId, personLabel, role) => {
      setRaci((m) => {
        const next = { ...m, [initiativeId]: { ...(m[initiativeId] || {}) } }
        if (role) next[initiativeId][personLabel] = role
        else delete next[initiativeId][personLabel]
        return next
      })
      if (!raciPeople.includes(personLabel)) setRaciPeople((p) => [...p, personLabel])
      if (!supabase || !orgId) return
      await supabase.from('strategy_initiative_raci').delete().eq('initiative_id', initiativeId).eq('person_name', personLabel)
      if (role) {
        const { error: insErr } = await supabase
          .from('strategy_initiative_raci')
          .insert({ organization_id: orgId, initiative_id: initiativeId, person_name: personLabel, role })
        if (insErr) { setError(insErr.message); reload() }
      }
    },
    [supabase, orgId, raciPeople, reload],
  )

  return useMemo(
    () => ({
      loading, error, initiatives, risks, raci, raciPeople, reload,
      create, update, remove, moveStage, addRisk, updateRisk, removeRisk, addDep, removeDep, setRaci: setRaciCell,
    }),
    [loading, error, initiatives, risks, raci, raciPeople, reload, create, update, remove, moveStage, addRisk, updateRisk, removeRisk, addDep, removeDep, setRaciCell],
  )
}
