import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  collectParsedAmuCandidates,
  collectParsedAmuElections,
  collectParsedAmuVoters,
  collectParsedAmuVotes,
} from './schema'
import type {
  AmuElectionCandidateRow,
  AmuElectionRow,
  AmuElectionVoteRow,
  AmuElectionVoterRow,
  CreateAmuElectionInput,
  UpdateAmuElectionInput,
} from './types'

/** Active for employees: visible elections they may participate in (not draft). */
function isActiveElectionStatus(s: AmuElectionRow['status']): boolean {
  return s === 'nomination' || s === 'voting' || s === 'closed'
}

export function useAmuElection({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('amu_election.manage')
  const currentUserId = user?.id ?? null

  const [elections, setElections] = useState<AmuElectionRow[]>([])
  const [candidatesByElection, setCandidatesByElection] = useState<Record<string, AmuElectionCandidateRow[]>>({})
  const [votersByElection, setVotersByElection] = useState<Record<string, AmuElectionVoterRow[]>>({})
  const [votesByElection, setVotesByElection] = useState<Record<string, AmuElectionVoteRow[]>>({})
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

        if (eRes.data) {
          const row = collectParsedAmuElections([eRes.data as unknown])[0]
          setElections((prev) => {
            const rest = prev.filter((x) => x.id !== electionId)
            return [row, ...rest]
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
        }
      } catch (e) {
        setErr(e)
      } finally {
        setLoading(false)
      }
    },
    [canManage, orgId, supabase, setErr],
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
      setError(null)
      try {
        const row = {
          organization_id: orgId,
          title,
          status: input.status ?? 'draft',
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
    [canManage, orgId, supabase, setErr],
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
    [canManage, orgId, supabase, setErr],
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

  return {
    organizationId: orgId,
    canManage,
    currentUserId,
    elections,
    activeElections,
    candidatesByElection,
    votersByElection,
    votesByElection,
    myVoterRows,
    loading,
    error,
    setError,
    loadElections,
    loadActiveElections,
    loadElectionDetail,
    createElection,
    updateElection,
    castVote,
  }
}
