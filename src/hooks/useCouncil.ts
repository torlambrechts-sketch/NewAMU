import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultPreparationChecklist,
  suggestedAgendaItems,
} from '../data/meetingGovernance'
import { defaultComplianceItems } from '../data/norwegianLabourCompliance'
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
    const meetingsRaw = Array.isArray(parsed.meetings) ? parsed.meetings : seedMeetings
    return {
      board: Array.isArray(parsed.board) ? parsed.board : seedBoard,
      elections: Array.isArray(parsed.elections) ? parsed.elections : [seedElection],
      meetings: meetingsRaw.map(migrateMeeting),
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

export type AddMeetingInput = {
  title: string
  startsAt: string
  location: string
  agendaItems?: AgendaItem[]
  /** Legacy single text — converted to one or more items if agendaItems omitted */
  agendaText?: string
  status?: MeetingStatus
  quarterSlot?: QuarterSlot
  governanceYear?: number
  preparationNotes?: string
  applySuggestedAgenda?: boolean
}

function buildAgendaItems(
  input: AddMeetingInput,
): AgendaItem[] {
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

  const addMeeting = useCallback((input: AddMeetingInput) => {
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
    setState((s) => ({
      ...s,
      meetings: [m, ...s.meetings].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    }))
    return m
  }, [])

  const updateMeeting = useCallback((id: string, patch: Partial<CouncilMeeting>) => {
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }, [])

  const setAgendaItems = useCallback((meetingId: string, agendaItems: AgendaItem[]) => {
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              agendaItems: agendaItems.map((a, i) => ({ ...a, order: i })),
            }
          : m,
      ),
    }))
  }, [])

  const applySuggestedAgenda = useCallback((meetingId: string, quarter: QuarterSlot) => {
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
  }, [])

  const appendAuditEntry = useCallback(
    (meetingId: string, kind: AuditEntryKind, text: string, author?: string) => {
      const t = text.trim()
      if (!t) return
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind,
        text: t,
        author: author?.trim() || undefined,
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId ? { ...m, auditTrail: [...m.auditTrail, entry] } : m,
        ),
      }))
    },
    [],
  )

  const setPreparationNotes = useCallback((meetingId: string, notes: string) => {
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) =>
        m.id === meetingId ? { ...m, preparationNotes: notes } : m,
      ),
    }))
  }, [])

  const togglePrepChecklist = useCallback((meetingId: string, itemId: string) => {
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
  }, [])

  const addPrepChecklistItem = useCallback((meetingId: string, label: string) => {
    const l = label.trim()
    if (!l) return
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

  const signMeetingProtocol = useCallback(
    (meetingId: string, signerName: string, role: ProtocolSignature['role']) => {
      const name = signerName.trim()
      if (!name) return false
      const sig: ProtocolSignature = {
        signerName: name,
        signedAt: new Date().toISOString(),
        role,
      }
      setState((s) => ({
        ...s,
        meetings: s.meetings.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                protocolSignatures: [...(m.protocolSignatures ?? []), sig],
              }
            : m,
        ),
      }))
      appendAuditEntry(
        meetingId,
        'note',
        `Protokoll signert (${role}): ${name}`,
        name,
      )
      return true
    },
    [appendAuditEntry],
  )

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

  // ── Invitation ──────────────────────────────────────────────────────────────

  const sendInvitation = useCallback((meetingId: string, recipients: string[]) => {
    const now = new Date().toISOString()
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) =>
        m.id === meetingId ? { ...m, invitationSentAt: now, invitationRecipients: recipients } : m,
      ),
    }))
    appendAuditEntry(meetingId, 'note', `Innkalling sendt til: ${recipients.join(', ')}`, '')
  }, [appendAuditEntry])

  const setMeetingAttendance = useCallback((meetingId: string, attendees: string[], quorum: boolean) => {
    setState((s) => ({
      ...s,
      meetings: s.meetings.map((m) =>
        m.id === meetingId ? { ...m, attendees, quorum } : m,
      ),
    }))
  }, [])

  // ── Decisions (cross-meeting computed view) ──────────────────────────────────

  const allDecisions = useMemo(() => {
    return state.meetings.flatMap((m) => [
      // Decisions from per-item minutes
      ...m.agendaItems.flatMap((item) =>
        item.decision
          ? [{ meetingId: m.id, meetingTitle: m.title, meetingDate: m.startsAt, agendaItemTitle: item.title, decision: item.decision, id: `${m.id}-${item.id}` }]
          : [],
      ),
      // Decisions from audit trail
      ...m.auditTrail.filter((e) => e.kind === 'decision').map((e) => ({
        meetingId: m.id, meetingTitle: m.title, meetingDate: m.startsAt,
        agendaItemTitle: '', decision: e.text, id: e.id,
      })),
    ]).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
  }, [state.meetings])

  return {
    ...state,
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
