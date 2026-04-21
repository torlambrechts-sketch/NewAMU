import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../../src/lib/orgModulePayload'
import {
  collectParsedAmuCandidates,
  collectParsedAmuElections,
  collectParsedAmuVoters,
  collectParsedAmuVotes,
  parseAmuElectionModuleSettings,
} from './schema'
import type {
  AddAmuElectionCandidateInput,
  AmuElectionCandidateRow,
  AmuElectionModuleSettings,
  AmuElectionRow,
  AmuElectionVoteRow,
  AmuElectionVoteTotalRow,
  AmuElectionVoterRow,
  AmuElectionCandidateStatus,
  CreateAmuElectionInput,
  UpdateAmuElectionInput,
} from './types'

/** Active for employees: visible elections they may participate in (not draft). */
function isActiveElectionStatus(s: AmuElectionRow['status']): boolean {
  return s === 'nomination' || s === 'voting' || s === 'closed'
}

const DEFAULT_AMU_SETTINGS: AmuElectionModuleSettings = {
  minimum_voting_days: 3,
  election_committee: [],
}

function votingWindowTooShort(startIso: string, endIso: string, minDays: number): boolean {
  const a = new Date(startIso).getTime()
  const b = new Date(endIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return true
  const minMs = minDays * 24 * 60 * 60 * 1000
  return b - a < minMs
}

export function useAmuElection({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage =
    isAdmin ||
    can('amu_election.manage') ||
    can('internkontroll.manage') ||
    can('ik.manage')
  const currentUserId = user?.id ?? null

  const [elections, setElections] = useState<AmuElectionRow[]>([])
  const [candidatesByElection, setCandidatesByElection] = useState<Record<string, AmuElectionCandidateRow[]>>({})
  const [votersByElection, setVotersByElection] = useState<Record<string, AmuElectionVoterRow[]>>({})
  const [votesByElection, setVotesByElection] = useState<Record<string, AmuElectionVoteRow[]>>({})
  const [voteTotalsByElection, setVoteTotalsByElection] = useState<Record<string, AmuElectionVoteTotalRow[]>>({})
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [moduleSettings, setModuleSettings] = useState<AmuElectionModuleSettings>(DEFAULT_AMU_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setErr = useCallback((e: unknown) => {
    setError(getSupabaseErrorMessage(e))
  }, [])

  const myVoterRows = useMemo(() => {
    if (!currentUserId) return [] as AmuElectionVoterRow[]
    const out: AmuElectionVoterRow[] = []
    for (const list of Object.values(votersByElection)) {
      for (const v of list) {
        if (v.user_id === currentUserId) out.push(v)
      }
    }
    return out
  }, [currentUserId, votersByElection])

  const activeElections = useMemo(
    () => elections.filter((e) => isActiveElectionStatus(e.status)),
    [elections],
  )

  const loadElections = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const res = await supabase
        .from('amu_elections')
        .select('*')
        .eq('organization_id', orgId)
        .order('start_date', { ascending: false })
      if (res.error) throw res.error
      setElections(collectParsedAmuElections((res.data ?? []) as unknown[]))
    } catch (e) {
      setErr(e)
    } finally {
      setLoading(false)
    }
  }, [orgId, supabase, setErr])

  const loadActiveElections = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const res = await supabase
        .from('amu_elections')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['nomination', 'voting', 'closed'])
        .order('start_date', { ascending: false })
      if (res.error) throw res.error
      setElections(collectParsedAmuElections((res.data ?? []) as unknown[]))
    } catch (e) {
      setErr(e)
    } finally {
      setLoading(false)
    }
  }, [orgId, supabase, setErr])

  const loadVoteTotals = useCallback(
    async (electionId: string) => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_amu_election_vote_totals', {
          p_election_id: electionId,
        })
        if (rpcErr) throw rpcErr
        const rows: AmuElectionVoteTotalRow[] = (data ?? []).map((r: { candidate_id: string; vote_count: number | string }) => ({
          candidate_id: r.candidate_id,
          vote_count: typeof r.vote_count === 'string' ? Number(r.vote_count) : Number(r.vote_count),
        }))
        setVoteTotalsByElection((prev) => ({ ...prev, [electionId]: rows }))
      } catch (e) {
        setErr(e)
      }
    },
    [orgId, supabase, setErr],
  )

  const loadAssignableUsersList = useCallback(async () => {
    if (!supabase || !orgId) return
    setError(null)
    try {
      const list = await fetchAssignableUsers(supabase, orgId)
      setAssignableUsers(list)
    } catch (e) {
      setErr(e)
    }
  }, [orgId, supabase, setErr])

  const loadModuleSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSettingsLoading(true)
    setError(null)
    try {
      const raw = await fetchOrgModulePayload<unknown>(supabase, orgId, 'amu_election')
      setModuleSettings(parseAmuElectionModuleSettings(raw))
    } catch (e) {
      setErr(e)
    } finally {
      setSettingsLoading(false)
    }
  }, [orgId, supabase, setErr])

  const saveModuleSettings = useCallback(
    async (next: AmuElectionModuleSettings) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang.')
        return false
      }
      setError(null)
      try {
        const parsed = parseAmuElectionModuleSettings(next)
        await upsertOrgModulePayload(supabase, orgId, 'amu_election', parsed)
        setModuleSettings(parsed)
        return true
      } catch (e) {
        setErr(e)
        return false
      }
    },
    [canManage, orgId, supabase, setErr],
  )

  const loadElectionDetail = useCallback(
    async (electionId: string) => {
      if (!supabase || !orgId) return
      setLoading(true)
      setError(null)
      try {
        const [eRes, cRes, vRes] = await Promise.all([
          supabase.from('amu_elections').select('*').eq('organization_id', orgId).eq('id', electionId).maybeSingle(),
          supabase
            .from('amu_election_candidates')
            .select('*')
            .eq('organization_id', orgId)
            .eq('election_id', electionId)
            .order('created_at', { ascending: true }),
          supabase
            .from('amu_election_voters')
            .select('*')
            .eq('organization_id', orgId)
            .eq('election_id', electionId)
            .order('created_at', { ascending: true }),
        ])
        if (eRes.error) throw eRes.error
        if (cRes.error) throw cRes.error
        if (vRes.error) throw vRes.error

        let electionRow: AmuElectionRow | null = null
        if (eRes.data) {
          electionRow = collectParsedAmuElections([eRes.data as unknown])[0]
          setElections((prev) => {
            const rest = prev.filter((x) => x.id !== electionId)
            return [electionRow!, ...rest]
          })
        }

        setCandidatesByElection((prev) => ({
          ...prev,
          [electionId]: collectParsedAmuCandidates((cRes.data ?? []) as unknown[]),
        }))
        setVotersByElection((prev) => ({
          ...prev,
          [electionId]: collectParsedAmuVoters((vRes.data ?? []) as unknown[]),
        }))

        if (canManage) {
          const votesRes = await supabase
            .from('amu_election_votes')
            .select('*')
            .eq('organization_id', orgId)
            .eq('election_id', electionId)
            .order('created_at', { ascending: true })
          if (votesRes.error) throw votesRes.error
          setVotesByElection((prev) => ({
            ...prev,
            [electionId]: collectParsedAmuVotes((votesRes.data ?? []) as unknown[]),
          }))
        } else {
          setVotesByElection((prev) => {
            const next = { ...prev }
            delete next[electionId]
            return next
          })
        }

        if (electionRow?.status === 'closed') {
          await loadVoteTotals(electionId)
        }
      } catch (e) {
        setErr(e)
      } finally {
        setLoading(false)
      }
    },
    [canManage, loadVoteTotals, orgId, supabase, setErr],
  )

  const createElection = useCallback(
    async (input: CreateAmuElectionInput) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette valg.')
        return null
      }
      const title = input.title?.trim()
      if (!title) {
        setError('Tittel er påkrevd.')
        return null
      }
      const status = input.status ?? 'draft'
      if (
        status === 'voting' &&
        votingWindowTooShort(input.start_date, input.end_date, moduleSettings.minimum_voting_days)
      ) {
        setError(
          `Stemmeperioden må vare minst ${moduleSettings.minimum_voting_days} døgn (juster i innstillinger eller utvid datoene).`,
        )
        return null
      }
      setError(null)
      try {
        const row = {
          organization_id: orgId,
          title,
          status,
          start_date: input.start_date,
          end_date: input.end_date,
        }
        const res = await supabase.from('amu_elections').insert(row).select('*').single()
        if (res.error) throw res.error
        const parsed = collectParsedAmuElections([res.data as unknown])[0]
        setElections((prev) => [parsed, ...prev.filter((x) => x.id !== parsed.id)])
        return parsed
      } catch (e) {
        setErr(e)
        return null
      }
    },
    [canManage, moduleSettings.minimum_voting_days, orgId, supabase, setErr],
  )

  const updateElection = useCallback(
    async (input: UpdateAmuElectionInput) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å oppdatere valg.')
        return false
      }
      setError(null)
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title.trim()
      if (input.status !== undefined) patch.status = input.status
      if (input.start_date !== undefined) patch.start_date = input.start_date
      if (input.end_date !== undefined) patch.end_date = input.end_date
      if (Object.keys(patch).length === 0) {
        setError('Ingen felter å oppdatere.')
        return false
      }

      const prev = elections.find((e) => e.id === input.electionId)
      if (prev) {
        const merged: AmuElectionRow = {
          ...prev,
          ...(patch.title !== undefined ? { title: String(patch.title) } : {}),
          ...(patch.status !== undefined ? { status: patch.status as AmuElectionRow['status'] } : {}),
          ...(patch.start_date !== undefined ? { start_date: String(patch.start_date) } : {}),
          ...(patch.end_date !== undefined ? { end_date: String(patch.end_date) } : {}),
        }
        if (
          merged.status === 'voting' &&
          votingWindowTooShort(merged.start_date, merged.end_date, moduleSettings.minimum_voting_days)
        ) {
          setError(
            `Stemmeperioden må vare minst ${moduleSettings.minimum_voting_days} døgn (juster i innstillinger eller utvid datoene).`,
          )
          return false
        }
      }

      try {
        const res = await supabase
          .from('amu_elections')
          .update(patch)
          .eq('organization_id', orgId)
          .eq('id', input.electionId)
          .select('*')
          .maybeSingle()
        if (res.error) throw res.error
        if (res.data) {
          const parsed = collectParsedAmuElections([res.data as unknown])[0]
          setElections((prev) => prev.map((x) => (x.id === parsed.id ? parsed : x)))
        }
        return true
      } catch (e) {
        setErr(e)
        return false
      }
    },
    [canManage, elections, moduleSettings.minimum_voting_days, orgId, supabase, setErr],
  )

  /**
   * Cast a vote via the database RPC only (secret ballot — never insert into amu_election_votes from the client).
   */
  const castVote = useCallback(
    async (electionId: string, candidateId: string) => {
      if (!supabase || !orgId) {
        const msg = 'Supabase er ikke konfigurert.'
        setError(msg)
        return { ok: false as const, error: msg }
      }
      setError(null)
      try {
        const { error: rpcError } = await supabase.rpc('cast_amu_vote', {
          p_election_id: electionId,
          p_candidate_id: candidateId,
        })
        if (rpcError) throw rpcError
        await loadElectionDetail(electionId)
        return { ok: true as const }
      } catch (e) {
        const msg = getSupabaseErrorMessage(e)
        setError(msg)
        return { ok: false as const, error: msg }
      }
    },
    [loadElectionDetail, orgId, supabase],
  )

  const addCandidate = useCallback(
    async (input: AddAmuElectionCandidateInput) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å nominere kandidater.')
        return null
      }
      setError(null)
      try {
        const row = {
          election_id: input.electionId,
          organization_id: orgId,
          user_id: input.userId,
          manifesto: (input.manifesto ?? '').trim(),
          status: input.status ?? 'nominated',
        }
        const res = await supabase.from('amu_election_candidates').insert(row).select('*').single()
        if (res.error) throw res.error
        const parsed = collectParsedAmuCandidates([res.data as unknown])[0]
        setCandidatesByElection((prev) => ({
          ...prev,
          [input.electionId]: [...(prev[input.electionId] ?? []), parsed],
        }))
        return parsed
      } catch (e) {
        setErr(e)
        return null
      }
    },
    [canManage, orgId, supabase, setErr],
  )

  const setCandidateStatus = useCallback(
    async (electionId: string, candidateId: string, status: AmuElectionCandidateStatus) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang.')
        return false
      }
      setError(null)
      try {
        const res = await supabase
          .from('amu_election_candidates')
          .update({ status })
          .eq('organization_id', orgId)
          .eq('election_id', electionId)
          .eq('id', candidateId)
          .select('*')
          .maybeSingle()
        if (res.error) throw res.error
        if (res.data) {
          const parsed = collectParsedAmuCandidates([res.data as unknown])[0]
          setCandidatesByElection((prev) => ({
            ...prev,
            [electionId]: (prev[electionId] ?? []).map((c) => (c.id === parsed.id ? parsed : c)),
          }))
        }
        return true
      } catch (e) {
        setErr(e)
        return false
      }
    },
    [canManage, orgId, supabase, setErr],
  )

  return {
    organizationId: orgId,
    canManage,
    currentUserId,
    elections,
    activeElections,
    candidatesByElection,
    votersByElection,
    votesByElection,
    voteTotalsByElection,
    assignableUsers,
    moduleSettings,
    settingsLoading,
    myVoterRows,
    loading,
    error,
    setError,
    loadModuleSettings,
    saveModuleSettings,
    loadElections,
    loadActiveElections,
    loadElectionDetail,
    loadVoteTotals,
    loadAssignableUsersList,
    createElection,
    updateElection,
    addCandidate,
    setCandidateStatus,
    castVote,
  }
}
