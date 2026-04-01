import { useCallback, useEffect, useState } from 'react'
import { defaultComplianceItems } from '../data/norwegianLabourCompliance'
import type {
  BoardMember,
  BoardRole,
  ComplianceItem,
  CouncilMeeting,
  Election,
  ElectionCandidate,
  MeetingStatus,
} from '../types/council'

const STORAGE_KEY = 'atics-council-v1'

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

const seedMeetings: CouncilMeeting[] = [
  {
    id: 'm1',
    title: 'Kvartalsmøte Q1',
    startsAt: '2026-04-15T09:00:00',
    location: 'Møterom A / Teams',
    agenda: '1. Godkjenning av innkalling\n2. HMS-rapport\n3. Eventuelt',
    status: 'planned',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm2',
    title: 'Årsmøte arbeidsliv',
    startsAt: '2025-12-10T13:00:00',
    location: 'Hovedkontoret',
    agenda: 'Årsberetning, valg, økonomi',
    status: 'completed',
    minutes: 'Vedtak fattet om budsjett og neste møtedato.',
    createdAt: new Date().toISOString(),
  },
]

function complianceSeed(): ComplianceItem[] {
  return defaultComplianceItems.map((c) => ({
    ...c,
    done: false,
    notes: '',
  }))
}

function load(): CouncilState {
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
    return {
      board: Array.isArray(parsed.board) ? parsed.board : seedBoard,
      elections: Array.isArray(parsed.elections) ? parsed.elections : [seedElection],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : seedMeetings,
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

function save(state: CouncilState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const roleOrder: BoardRole[] = ['leader', 'deputy', 'member']

export function useCouncil() {
  const [state, setState] = useState<CouncilState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const addElection = useCallback((title: string) => {
    const e: Election = {
      id: crypto.randomUUID(),
      title,
      status: 'open',
      candidates: [],
      createdAt: new Date().toISOString(),
    }
    setState((s) => ({ ...s, elections: [e, ...s.elections] }))
    return e
  }, [])

  const addCandidate = useCallback((electionId: string, name: string) => {
    const cand: ElectionCandidate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      voteCount: 0,
    }
    if (!cand.name) return
    setState((s) => ({
      ...s,
      elections: s.elections.map((el) =>
        el.id === electionId
          ? { ...el, candidates: [...el.candidates, cand] }
          : el,
      ),
    }))
  }, [])

  const vote = useCallback((electionId: string, candidateId: string) => {
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
  }, [])

  const closeElection = useCallback((electionId: string) => {
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
        termUntil: undefined,
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
  }, [])

  const addMeeting = useCallback(
    (partial: Omit<CouncilMeeting, 'id' | 'createdAt' | 'status'> & { status?: MeetingStatus }) => {
      const m: CouncilMeeting = {
        ...partial,
        id: crypto.randomUUID(),
        status: partial.status ?? 'planned',
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, meetings: [m, ...s.meetings].sort((a, b) => b.startsAt.localeCompare(a.startsAt)) }))
      return m
    },
    [],
  )

  const updateMeeting = useCallback((id: string, patch: Partial<CouncilMeeting>) => {
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }, [])

  const toggleCompliance = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      compliance: s.compliance.map((c) =>
        c.id === id ? { ...c, done: !c.done } : c,
      ),
    }))
  }, [])

  const setComplianceNotes = useCallback((id: string, notes: string) => {
    setState((s) => ({
      ...s,
      compliance: s.compliance.map((c) => (c.id === id ? { ...c, notes } : c)),
    }))
  }, [])

  const addComplianceItem = useCallback((title: string, description: string, lawRef: string) => {
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
    setState((s) => ({ ...s, compliance: [...s.compliance, c] }))
  }, [])

  const resetToDemoData = useCallback(() => {
    const next: CouncilState = {
      board: seedBoard,
      elections: [seedElection],
      meetings: seedMeetings,
      compliance: complianceSeed(),
    }
    setState(next)
    save(next)
  }, [])

  return {
    ...state,
    addElection,
    addCandidate,
    vote,
    closeElection,
    addMeeting,
    updateMeeting,
    toggleCompliance,
    setComplianceNotes,
    addComplianceItem,
    resetToDemoData,
  }
}
