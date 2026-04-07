import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultPreparationChecklist,
  suggestedAgendaItems,
} from '../data/meetingGovernance'
import { defaultComplianceItems } from '../data/norwegianLabourCompliance'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'
import { fetchClientIpBestEffort, hashDocumentPayload } from '../lib/level1Signature'
import { insertSystemSignatureEvent } from '../lib/recordSystemSignature'
import type {
  AgendaItem,
  AuditEntry,
  AuditEntryKind,
  BoardMember,
  BoardRole,
  ComplianceItem,
  CouncilMeeting,
  Election,
  ElectionCandidate,
  MeetingStatus,
  ProtocolSignature,
  QuarterSlot,
} from '../types/council'

const STORAGE_KEY = 'atics-council-v1'
const snapKey = (orgId: string, userId: string) => `atics-council-snap:${orgId}:${userId}`

type CouncilState = {
  board: BoardMember[]
  elections: Election[]
  meetings: CouncilMeeting[]
  compliance: ComplianceItem[]
}

const seedBoard: BoardMember[] = [
  {
    id: 'bm1',
    name: 'Ingrid Nilsen',
    role: 'leader',
    electedAt: '2025-06-01',
    termUntil: '2027-05-31',
  },
  {
    id: 'bm2',
    name: 'Ole Hansen',
    role: 'deputy',
    electedAt: '2025-06-01',
    termUntil: '2027-05-31',
  },
  {
    id: 'bm3',
    name: 'Kari Svendsen',
    role: 'member',
    electedAt: '2025-06-01',
    termUntil: '2027-05-31',
  },
]

const seedElection: Election = {
  id: 'el1',
  title: 'Valg til arbeidsmiljøråd 2027',
  status: 'open',
  createdAt: new Date().toISOString(),
  candidates: [
    { id: 'cand1', name: 'Per Berg', voteCount: 4 },
    { id: 'cand2', name: 'Line Moen', voteCount: 2 },
    { id: 'cand3', name: 'Thomas Lie', voteCount: 1 },
  ],
}

function agendaFromLegacyText(agenda: string | undefined, meetingId: string): AgendaItem[] {
  if (!agenda?.trim()) return []
  return agenda
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => ({
      id: `legacy-${meetingId}-${i}`,
      title: line.replace(/^\d+\.\s*/, '').slice(0, 300),
      notes: '',
      order: i,
    }))
}

function migrateMeeting(raw: unknown): CouncilMeeting {
  const m = raw as Partial<CouncilMeeting> & { id: string; createdAt: string }
  let agendaItems: AgendaItem[] = Array.isArray(m.agendaItems) ? m.agendaItems : []
  if (!agendaItems.length) {
    agendaItems = agendaFromLegacyText(m.agenda, m.id)
  }
  const prep = Array.isArray(m.preparationChecklist) && m.preparationChecklist.length
    ? m.preparationChecklist
    : defaultPreparationChecklist()
  const audit = Array.isArray(m.auditTrail) ? m.auditTrail : []
  return {
    id: m.id,
    title: m.title ?? 'Møte',
    startsAt: m.startsAt ?? new Date().toISOString(),
    location: m.location ?? '',
    agenda: m.agenda,
    agendaItems,
    status: m.status ?? 'planned',
    minutes: m.minutes,
    protocolSignatures: Array.isArray(m.protocolSignatures) ? m.protocolSignatures : [],
    preparationNotes: typeof m.preparationNotes === 'string' ? m.preparationNotes : '',
    preparationChecklist: prep,
    auditTrail: audit,
    quarterSlot: m.quarterSlot,
    governanceYear: m.governanceYear,
    invitationSentAt: m.invitationSentAt,
    invitationRecipients: m.invitationRecipients,
    quorum: m.quorum,
    attendees: m.attendees,
    createdAt: m.createdAt,
  }
}

const seedMeetings: CouncilMeeting[] = [
  migrateMeeting({
    id: 'm1',
    title: 'Kvartalsmøte Q1',
    startsAt: '2026-04-15T09:00:00',
    location: 'Møterom A / Teams',
    agenda:
      '1. Godkjenning av innkalling\n2. HMS-rapport\n3. Risikovurdering\n4. Eventuelt',
    agendaItems: [],
    status: 'planned',
    preparationNotes: 'Hent siste HMS-tall fra verneombud før møtet.',
    preparationChecklist: defaultPreparationChecklist(),
    auditTrail: [
      {
        id: 'a0',
        at: new Date().toISOString(),
        kind: 'note',
        text: 'Eksempel på revisjonslogg: møtet er opprettet i årshjulet.',
        author: 'System',
      },
    ],
    quarterSlot: 1,
    governanceYear: 2026,
    createdAt: new Date().toISOString(),
  }),
  migrateMeeting({
    id: 'm2',
    title: 'Årsmøte arbeidsliv',
    startsAt: '2025-12-10T13:00:00',
    location: 'Hovedkontoret',
    agenda: 'Årsberetning, valg, økonomi',
    agendaItems: [],
    status: 'completed',
    minutes: 'Vedtak fattet om budsjett og neste møtedato.',
    preparationNotes: '',
    preparationChecklist: defaultPreparationChecklist().map((p) => ({ ...p, done: true })),
    auditTrail: [
      {
        id: 'a1',
        at: '2025-12-10T15:00:00',
        kind: 'decision',
        text: 'Budsjett for neste år ble enstemmig vedtatt.',
        author: 'Referent',
      },
      {
        id: 'a2',
        at: '2025-12-10T14:30:00',
        kind: 'discussion',
        text: 'Drøfting om oppfølging av arbeidsmiljøundersøkelsen.',
        author: 'Leder',
      },
    ],
    quarterSlot: 4,
    governanceYear: 2025,
    createdAt: new Date().toISOString(),
  }),
]

function complianceSeed(): ComplianceItem[] {
  return defaultComplianceItems.map((c) => ({
    ...c,
    done: false,
    notes: '',
  }))
}

function loadLocal(): CouncilState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        board: seedBoard,
        elections: [seedElection],
        meetings: seedMeetings,
        compliance: complianceSeed(),
      }
    }
    const parsed = JSON.parse(raw) as CouncilState
    if (!parsed || typeof parsed !== 'object') throw new Error('bad')
    const meetingsRaw = Array.isArray(parsed.meetings) ? parsed.meetings : seedMeetings
    return {
      board: Array.isArray(parsed.board) ? parsed.board : seedBoard,
      elections: Array.isArray(parsed.elections) ? parsed.elections : [seedElection],
      meetings: meetingsRaw.map((m) => migrateMeeting(m)),
      compliance: Array.isArray(parsed.compliance) && parsed.compliance.length
        ? parsed.compliance
        : complianceSeed(),
    }
  } catch {
    return {
      board: seedBoard,
      elections: [seedElection],
      meetings: seedMeetings,
      compliance: complianceSeed(),
    }
  }
}

function saveLocal(state: CouncilState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function emptyRemoteState(): CouncilState {
  return { board: [], elections: [], meetings: [], compliance: [] }
}

function readSnap(orgId: string, userId: string): CouncilState | null {
  try {
    const raw = sessionStorage.getItem(snapKey(orgId, userId))
    if (!raw) return null
    return JSON.parse(raw) as CouncilState
  } catch {
    return null
  }
}

function writeSnap(orgId: string, userId: string, state: CouncilState) {
  try {
    sessionStorage.setItem(snapKey(orgId, userId), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function clearSnap(orgId: string, userId: string) {
  try {
    sessionStorage.removeItem(snapKey(orgId, userId))
  } catch {
    /* ignore */
  }
}

function mapBoardRow(r: {
  id: string
  name: string
  role: string
  elected_at: string
  term_until: string | null
  from_election_id: string | null
}): BoardMember {
  return {
    id: r.id,
    name: r.name,
    role: r.role as BoardRole,
    electedAt: r.elected_at,
    termUntil: r.term_until ?? undefined,
    fromElectionId: r.from_election_id ?? undefined,
  }
}

function mapElectionRow(r: {
  id: string
  title: string
  status: string
  candidates: unknown
  created_at: string
  closed_at: string | null
  winner_candidate_id: string | null
}): Election {
  return {
    id: r.id,
    title: r.title,
    status: r.status as Election['status'],
    candidates: Array.isArray(r.candidates) ? (r.candidates as ElectionCandidate[]) : [],
    createdAt: r.created_at,
    closedAt: r.closed_at ?? undefined,
    winnerCandidateId: r.winner_candidate_id ?? undefined,
  }
}

function mapComplianceRow(r: {
  id: string
  title: string
  description: string
  law_ref: string
  done: boolean
  notes: string
  is_custom: boolean
}): ComplianceItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    lawRef: r.law_ref,
    done: r.done,
    notes: r.notes,
    isCustom: r.is_custom,
  }
}

async function fetchCouncilState(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CouncilState> {
  const [bRes, eRes, mRes, cRes] = await Promise.all([
    supabase.from('council_board_members').select('*').eq('organization_id', orgId).order('role'),
    supabase.from('council_elections').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('council_meetings').select('id, payload').eq('organization_id', orgId),
    supabase.from('council_compliance_items').select('*').eq('organization_id', orgId).order('sort_order'),
  ])
  if (bRes.error) throw bRes.error
  if (eRes.error) throw eRes.error
  if (mRes.error) throw mRes.error
  if (cRes.error) throw cRes.error

  const meetings = (mRes.data ?? [])
    .map((row) => migrateMeeting(row.payload))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))

  return {
    board: (bRes.data ?? []).map(mapBoardRow),
    elections: (eRes.data ?? []).map(mapElectionRow),
    meetings,
    compliance: (cRes.data ?? []).map(mapComplianceRow),
  }
}

async function upsertMeeting(
  supabase: SupabaseClient,
  orgId: string,
  m: CouncilMeeting,
) {
  const { error } = await supabase.from('council_meetings').upsert(
    {
      id: m.id,
      organization_id: orgId,
      payload: m as unknown as Record<string, unknown>,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

const roleOrder: BoardRole[] = ['leader', 'deputy', 'member']

export type AddMeetingInput = {
  title: string
  startsAt: string
  location: string
  agendaItems?: AgendaItem[]
  agendaText?: string
  status?: MeetingStatus
  quarterSlot?: QuarterSlot
  governanceYear?: number
  preparationNotes?: string
  applySuggestedAgenda?: boolean
}

function buildAgendaItems(input: AddMeetingInput): AgendaItem[] {
  if (input.agendaItems?.length) {
    return input.agendaItems.map((a, i) => ({ ...a, order: a.order ?? i }))
  }
  if (input.applySuggestedAgenda && input.quarterSlot) {
    const sug = suggestedAgendaItems(input.quarterSlot)
    return sug.map((s, i) => ({
      id: crypto.randomUUID(),
      title: s.title,
      notes: s.notes,
      order: i,
    }))
  }
  const text = input.agendaText?.trim()
  if (text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => ({
        id: crypto.randomUUID(),
        title: line.replace(/^\d+\.\s*/, '').slice(0, 300),
        notes: '',
        order: i,
      }))
  }
  return []
}

export function useCouncil() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialSnap = useRemote && orgId && userId ? readSnap(orgId, userId) : null
  const [localState, setLocalState] = useState<CouncilState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<CouncilState>(() => initialSnap ?? emptyRemoteState())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)

  const state = useRemote ? remoteState : localState
  const setState = useRemote ? setRemoteState : setLocalState

  const refreshCouncil = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      await supabase.rpc('council_ensure_org_defaults')
      const data = await fetchCouncilState(supabase, orgId)
      setRemoteState(data)
      writeSnap(orgId, userId, data)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearSnap(orgId, userId)
      setRemoteState(emptyRemoteState())
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshCouncil()
  }, [useRemote, refreshCouncil])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localState)
    }
  }, [useRemote, localState])

  const addElection = useCallback(
    async (title: string) => {
      const e: Election = {
        id: crypto.randomUUID(),
        title,
        status: 'open',
        candidates: [],
        createdAt: new Date().toISOString(),
      }
      if (useRemote && supabase && orgId) {
        const { error: err } = await supabase.from('council_elections').insert({
          id: e.id,
          organization_id: orgId,
          title: e.title,
          status: e.status,
          candidates: e.candidates,
          created_at: e.createdAt,
        })
        if (err) throw err
        await refreshCouncil()
        return e
      }
      setState((s) => ({ ...s, elections: [e, ...s.elections] }))
      return e
    },
    [useRemote, supabase, orgId, refreshCouncil, setState],
  )

  const addCandidate = useCallback(
    async (electionId: string, name: string) => {
      const cand: ElectionCandidate = {
        id: crypto.randomUUID(),
        name: name.trim(),
        voteCount: 0,
      }
      if (!cand.name) return
      if (useRemote && supabase && orgId) {
        const el = remoteState.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open') return
        const nextCandidates = [...el.candidates, cand]
        const { error: err } = await supabase
          .from('council_elections')
          .update({ candidates: nextCandidates })
          .eq('id', electionId)
          .eq('organization_id', orgId)
        if (err) throw err
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        elections: s.elections.map((el) =>
          el.id === electionId ? { ...el, candidates: [...el.candidates, cand] } : el,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.elections, refreshCouncil, setState],
  )

  const vote = useCallback(
    async (electionId: string, candidateId: string) => {
      if (useRemote && supabase && orgId) {
        const el = remoteState.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open') return
        const nextCandidates = el.candidates.map((c) =>
          c.id === candidateId ? { ...c, voteCount: c.voteCount + 1 } : c,
        )
        const { error: err } = await supabase
          .from('council_elections')
          .update({ candidates: nextCandidates })
          .eq('id', electionId)
          .eq('organization_id', orgId)
        if (err) throw err
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        elections: s.elections.map((el) =>
          el.id === electionId && el.status === 'open'
            ? {
                ...el,
                candidates: el.candidates.map((c) =>
                  c.id === candidateId ? { ...c, voteCount: c.voteCount + 1 } : c,
                ),
              }
            : el,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.elections, refreshCouncil, setState],
  )

  const closeElection = useCallback(
    async (electionId: string) => {
      if (useRemote && supabase && orgId) {
        const el = remoteState.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open' || el.candidates.length === 0) return

        const sorted = [...el.candidates].sort((a, b) => b.voteCount - a.voteCount)
        const top = sorted.slice(0, 3)
        const winner = top[0]

        await supabase.from('council_board_members').delete().eq('organization_id', orgId)

        for (let i = 0; i < top.length; i += 1) {
          const c = top[i]
          const bm: BoardMember = {
            id: crypto.randomUUID(),
            name: c.name,
            role: roleOrder[i] ?? 'member',
            electedAt: new Date().toISOString().slice(0, 10),
            fromElectionId: electionId,
          }
          const { error: be } = await supabase.from('council_board_members').insert({
            id: bm.id,
            organization_id: orgId,
            name: bm.name,
            role: bm.role,
            elected_at: bm.electedAt,
            term_until: bm.termUntil ?? null,
            from_election_id: electionId,
          })
          if (be) throw be
        }

        const { error: ue } = await supabase
          .from('council_elections')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            winner_candidate_id: winner?.id ?? null,
          })
          .eq('id', electionId)
          .eq('organization_id', orgId)
        if (ue) throw ue
        await refreshCouncil()
        return
      }

      setState((s) => {
        const el = s.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open' || el.candidates.length === 0) return s

        const sorted = [...el.candidates].sort((a, b) => b.voteCount - a.voteCount)
        const top = sorted.slice(0, 3)
        const winner = top[0]
        const newBoard: BoardMember[] = top.map((c, i) => ({
          id: crypto.randomUUID(),
          name: c.name,
          role: roleOrder[i] ?? 'member',
          electedAt: new Date().toISOString().slice(0, 10),
          fromElectionId: electionId,
        }))

        return {
          ...s,
          board: newBoard.length ? newBoard : s.board,
          elections: s.elections.map((e) =>
            e.id === electionId
              ? {
                  ...e,
                  status: 'closed' as const,
                  closedAt: new Date().toISOString(),
                  winnerCandidateId: winner?.id,
                }
              : e,
          ),
        }
      })
    },
    [useRemote, supabase, orgId, remoteState.elections, refreshCouncil, setState],
  )

  const addMeeting = useCallback(
    async (input: AddMeetingInput) => {
      const agendaItems = buildAgendaItems(input)
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: 'note',
        text: `Møte opprettet: «${input.title.trim()}».`,
        author: 'System',
      }
      const m: CouncilMeeting = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        startsAt: new Date(input.startsAt).toISOString(),
        location: input.location.trim() || 'TBD',
        agendaItems,
        status: input.status ?? 'planned',
        protocolSignatures: [],
        preparationNotes: input.preparationNotes?.trim() ?? '',
        preparationChecklist: defaultPreparationChecklist(),
        auditTrail: [entry],
        quarterSlot: input.quarterSlot,
        governanceYear: input.governanceYear,
        createdAt: new Date().toISOString(),
      }

      if (useRemote && supabase && orgId) {
        await upsertMeeting(supabase, orgId, m)
        await refreshCouncil()
        return m
      }

      setState((s) => ({
        ...s,
        meetings: [m, ...s.meetings].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      }))
      return m
    },
    [useRemote, supabase, orgId, refreshCouncil, setState],
  )

  const updateMeeting = useCallback(
    async (id: string, patch: Partial<CouncilMeeting>) => {
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === id)
        if (!cur) return
        const next = { ...cur, ...patch }
        await upsertMeeting(supabase, orgId, next)
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const setAgendaItems = useCallback(
    async (meetingId: string, agendaItems: AgendaItem[]) => {
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const next = {
          ...cur,
          agendaItems: agendaItems.map((a, i) => ({ ...a, order: i })),
        }
        await upsertMeeting(supabase, orgId, next)
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId
            ? { ...m, agendaItems: agendaItems.map((a, i) => ({ ...a, order: i })) }
            : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const applySuggestedAgenda = useCallback(
    async (meetingId: string, quarter: QuarterSlot) => {
      const sug = suggestedAgendaItems(quarter)
      const items: AgendaItem[] = sug.map((s, i) => ({
        id: crypto.randomUUID(),
        title: s.title,
        notes: s.notes,
        order: i,
      }))
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: 'note',
        text: `Standardagenda for ${quarter}. kvartal ble lagt inn (forslag).`,
        author: 'System',
      }

      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const next = {
          ...cur,
          agendaItems: items,
          quarterSlot: quarter,
          auditTrail: [...cur.auditTrail, entry],
        }
        await upsertMeeting(supabase, orgId, next)
        await refreshCouncil()
        return
      }

      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                agendaItems: items,
                quarterSlot: quarter,
                auditTrail: [...m.auditTrail, entry],
              }
            : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const appendAuditEntry = useCallback(
    async (meetingId: string, kind: AuditEntryKind, text: string, author?: string) => {
      const t = text.trim()
      if (!t) return
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind,
        text: t,
        author: author?.trim() || undefined,
      }

      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const next = { ...cur, auditTrail: [...cur.auditTrail, entry] }
        await upsertMeeting(supabase, orgId, next)
        await refreshCouncil()
        return
      }

      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId ? { ...m, auditTrail: [...m.auditTrail, entry] } : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const setPreparationNotes = useCallback(
    async (meetingId: string, notes: string) => {
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        await upsertMeeting(supabase, orgId, { ...cur, preparationNotes: notes })
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId ? { ...m, preparationNotes: notes } : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const togglePrepChecklist = useCallback(
    async (meetingId: string, itemId: string) => {
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const preparationChecklist = cur.preparationChecklist.map((p) =>
          p.id === itemId ? { ...p, done: !p.done } : p,
        )
        await upsertMeeting(supabase, orgId, { ...cur, preparationChecklist })
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) => {
          if (m.id !== meetingId) return m
          const preparationChecklist = m.preparationChecklist.map((p) =>
            p.id === itemId ? { ...p, done: !p.done } : p,
          )
          return { ...m, preparationChecklist }
        }),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const addPrepChecklistItem = useCallback(
    async (meetingId: string, label: string) => {
      const l = label.trim()
      if (!l) return
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const preparationChecklist = [
          ...cur.preparationChecklist,
          { id: crypto.randomUUID(), label: l, done: false },
        ]
        await upsertMeeting(supabase, orgId, { ...cur, preparationChecklist })
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                preparationChecklist: [
                  ...m.preparationChecklist,
                  { id: crypto.randomUUID(), label: l, done: false },
                ],
              }
            : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const toggleCompliance = useCallback(
    async (id: string) => {
      if (useRemote && supabase && orgId) {
        const row = remoteState.compliance.find((c) => c.id === id)
        if (!row) return
        const { error: err } = await supabase
          .from('council_compliance_items')
          .update({ done: !row.done })
          .eq('organization_id', orgId)
          .eq('id', id)
        if (err) throw err
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        compliance: s.compliance.map((c) => (c.id === id ? { ...c, done: !c.done } : c)),
      }))
    },
    [useRemote, supabase, orgId, remoteState.compliance, refreshCouncil, setState],
  )

  const setComplianceNotes = useCallback(
    async (id: string, notes: string) => {
      if (useRemote && supabase && orgId) {
        const { error: err } = await supabase
          .from('council_compliance_items')
          .update({ notes })
          .eq('organization_id', orgId)
          .eq('id', id)
        if (err) throw err
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        compliance: s.compliance.map((c) => (c.id === id ? { ...c, notes } : c)),
      }))
    },
    [useRemote, supabase, orgId, refreshCouncil, setState],
  )

  const addComplianceItem = useCallback(
    async (title: string, description: string, lawRef: string) => {
      const c: ComplianceItem = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        lawRef: lawRef.trim() || 'Intern',
        done: false,
        notes: '',
        isCustom: true,
      }
      if (!c.title) return

      if (useRemote && supabase && orgId) {
        const { error: err } = await supabase.from('council_compliance_items').insert({
          organization_id: orgId,
          id: c.id,
          title: c.title,
          description: c.description,
          law_ref: c.lawRef,
          done: false,
          notes: '',
          is_custom: true,
          sort_order: 999,
        })
        if (err) throw err
        await refreshCouncil()
        return
      }
      setState((s) => ({ ...s, compliance: [...s.compliance, c] }))
    },
    [useRemote, supabase, orgId, refreshCouncil, setState],
  )

  const signMeetingProtocol = useCallback(
    async (meetingId: string, signerName: string, role: ProtocolSignature['role']) => {
      const name = signerName.trim()
      if (!name) return false
      setError(null)
      const signedAt = new Date().toISOString()
      const auditLine = `Protokoll signert (${role}): ${name}`
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        at: signedAt,
        kind: 'note',
        text: auditLine,
        author: name,
      }

      const stripProto = (sigs: ProtocolSignature[] | undefined) =>
        (sigs ?? []).map(({ signerName: sn, signedAt: sa, role: r }) => ({ signerName: sn, signedAt: sa, role: r }))

      const cur = state.meetings.find((x) => x.id === meetingId)
      if (!cur) return false

      const proposedSigs = [...stripProto(cur.protocolSignatures), { signerName: name, signedAt, role }]
      const hashPayload = {
        kind: 'council_meeting_protocol' as const,
        meetingId: cur.id,
        title: cur.title,
        startsAt: cur.startsAt,
        location: cur.location,
        minutes: cur.minutes ?? '',
        agendaItems: cur.agendaItems,
        protocolSignatures: proposedSigs,
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)

      let level1: ProtocolSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'council_meeting',
          resourceId: meetingId,
          action: `council_protocol_sign_${role}`,
          documentHashSha256,
          signerDisplayName: name,
          role,
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return false
        }
        level1 = ins.evidence
      }

      const sig: ProtocolSignature = { signerName: name, signedAt, role, level1 }

      if (useRemote && supabase && orgId) {
        const next: CouncilMeeting = {
          ...cur,
          protocolSignatures: [...(cur.protocolSignatures ?? []), sig],
          auditTrail: [...cur.auditTrail, entry],
        }
        await upsertMeeting(supabase, orgId, next)
        await refreshCouncil()
        return true
      }

      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                protocolSignatures: [...(m.protocolSignatures ?? []), sig],
                auditTrail: [...m.auditTrail, entry],
              }
            : m,
        ),
      }))
      return true
    },
    [useRemote, supabase, orgId, userId, state.meetings, refreshCouncil, setState],
  )

  const resetToDemoData = useCallback(async () => {
    if (useRemote && supabase && orgId) {
      await supabase.from('council_meetings').delete().eq('organization_id', orgId)
      await supabase.from('council_elections').delete().eq('organization_id', orgId)
      await supabase.from('council_board_members').delete().eq('organization_id', orgId)
      await supabase.from('council_compliance_items').delete().eq('organization_id', orgId)
      await supabase.rpc('council_ensure_org_defaults')
      await refreshCouncil()
      return
    }
    const next: CouncilState = {
      board: seedBoard,
      elections: [seedElection],
      meetings: seedMeetings,
      compliance: complianceSeed(),
    }
    setLocalState(next)
    saveLocal(next)
  }, [useRemote, supabase, orgId, refreshCouncil])

  const sendInvitation = useCallback(
    async (meetingId: string, recipients: string[]) => {
      const now = new Date().toISOString()
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        const next = { ...cur, invitationSentAt: now, invitationRecipients: recipients }
        await upsertMeeting(supabase, orgId, next)
        const entry: AuditEntry = {
          id: crypto.randomUUID(),
          at: now,
          kind: 'note',
          text: `Innkalling sendt til: ${recipients.join(', ')}`,
          author: undefined,
        }
        await upsertMeeting(supabase, orgId, { ...next, auditTrail: [...next.auditTrail, entry] })
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId ? { ...m, invitationSentAt: now, invitationRecipients: recipients } : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const setMeetingAttendance = useCallback(
    async (meetingId: string, attendees: string[], quorum: boolean) => {
      if (useRemote && supabase && orgId) {
        const cur = remoteState.meetings.find((x) => x.id === meetingId)
        if (!cur) return
        await upsertMeeting(supabase, orgId, { ...cur, attendees, quorum })
        await refreshCouncil()
        return
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId ? { ...m, attendees, quorum } : m,
        ),
      }))
    },
    [useRemote, supabase, orgId, remoteState.meetings, refreshCouncil, setState],
  )

  const allDecisions = useMemo(() => {
    return state.meetings.flatMap((m) => [
      ...m.agendaItems.flatMap((item) =>
        item.decision
          ? [{
              meetingId: m.id,
              meetingTitle: m.title,
              meetingDate: m.startsAt,
              agendaItemTitle: item.title,
              decision: item.decision,
              id: `${m.id}-${item.id}`,
            }]
          : [],
      ),
      ...m.auditTrail.filter((e) => e.kind === 'decision').map((e) => ({
        meetingId: m.id,
        meetingTitle: m.title,
        meetingDate: m.startsAt,
        agendaItemTitle: '',
        decision: e.text,
        id: e.id,
      })),
    ]).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
  }, [state.meetings])

  return {
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    loading: useRemote && loading,
    error,
    refreshCouncil,
    board: state.board,
    elections: state.elections,
    meetings: state.meetings,
    compliance: state.compliance,
    allDecisions,
    addElection,
    addCandidate,
    vote,
    closeElection,
    addMeeting,
    updateMeeting,
    setAgendaItems,
    applySuggestedAgenda,
    appendAuditEntry,
    sendInvitation,
    setMeetingAttendance,
    setPreparationNotes,
    togglePrepChecklist,
    addPrepChecklistItem,
    toggleCompliance,
    setComplianceNotes,
    addComplianceItem,
    resetToDemoData,
    signMeetingProtocol,
  }
}
