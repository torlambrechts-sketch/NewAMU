/* Data hook for Strategy v2 — org graph: teams (+members), objective alignment
   edges, and role charters. Powers Alignment, Accountability (charters), and
   the workload/team surfaces. Read + charter edit. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type StrategyTeam = {
  id: string
  name: string
  pillar: string
  lead: string
  members: string[] // member display labels
}
export type ObjectiveEdge = { id: string; from: string; to: string; type: 'contributes_to' | 'drives' }
export type RoleCharter = {
  id: string
  person: string
  purpose: string
  responsibilities: string[]
  decisions: string[]
  stakeholders: string[]
  priorities: string[]
  version: number
}

export type UseStrategyOrgGraphReturn = {
  loading: boolean
  error: string | null
  teams: StrategyTeam[]
  edges: ObjectiveEdge[]
  charters: RoleCharter[]
  reload: () => void
  updateCharter: (id: string, patch: Partial<Omit<RoleCharter, 'id'>>) => Promise<void>
}

export function useStrategyOrgGraph(): UseStrategyOrgGraphReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [teams, setTeams] = useState<StrategyTeam[]>([])
  const [edges, setEdges] = useState<ObjectiveEdge[]>([])
  const [charters, setCharters] = useState<RoleCharter[]>([])
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
        await supabase.rpc('provision_strategy_signal_for_org', { p_org_id: orgId })
        const [tRes, tmRes, eRes, cRes] = await Promise.all([
          supabase.from('strategy_teams').select('*').order('name', { ascending: true }),
          supabase.from('strategy_team_members').select('team_id, member_user_id, member_name'),
          supabase.from('strategy_objective_edges').select('*'),
          supabase.from('strategy_role_charters').select('*').order('person_name', { ascending: true }),
        ])
        if (cancelled) return
        for (const res of [tRes, tmRes, eRes, cRes]) if (res.error) throw res.error
        const membersBy: Record<string, string[]> = {}
        for (const m of (tmRes.data as Record<string, unknown>[] | null) || []) {
          ;(membersBy[m.team_id as string] ||= []).push((m.member_name as string) ?? (m.member_user_id as string) ?? '')
        }
        setTeams(((tRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), name: (r.name as string) ?? '', pillar: (r.pillar_code as string) ?? '', lead: (r.lead_name as string) ?? '',
          members: membersBy[String(r.id)] || [],
        })))
        setEdges(((eRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), from: r.from_objective_id as string, to: r.to_objective_id as string, type: (r.edge_type as ObjectiveEdge['type']) || 'contributes_to',
        })))
        setCharters(((cRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), person: (r.person_name as string) ?? '', purpose: (r.purpose as string) ?? '',
          responsibilities: (r.responsibilities as string[]) ?? [], decisions: (r.decisions as string[]) ?? [],
          stakeholders: (r.stakeholders as string[]) ?? [], priorities: (r.priorities as string[]) ?? [], version: (r.version as number) ?? 1,
        })))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste org-graf.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const updateCharter = useCallback<UseStrategyOrgGraphReturn['updateCharter']>(
    async (id, patch) => {
      setCharters((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      if (!supabase) return
      const db: Record<string, unknown> = {}
      if (patch.person !== undefined) db.person_name = patch.person
      if (patch.purpose !== undefined) db.purpose = patch.purpose
      if (patch.responsibilities !== undefined) db.responsibilities = patch.responsibilities
      if (patch.decisions !== undefined) db.decisions = patch.decisions
      if (patch.stakeholders !== undefined) db.stakeholders = patch.stakeholders
      if (patch.priorities !== undefined) db.priorities = patch.priorities
      if (patch.version !== undefined) db.version = patch.version
      const { error: e } = await supabase.from('strategy_role_charters').update(db).eq('id', id)
      if (e) { setError(e.message); reload() }
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({ loading, error, teams, edges, charters, reload, updateCharter }),
    [loading, error, teams, edges, charters, reload, updateCharter],
  )
}
