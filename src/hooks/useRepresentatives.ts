import { useCallback, useEffect, useMemo, useState } from 'react'
import { REPRESENTATIVE_ROLE_REQUIREMENTS } from '../data/representativeRules'
import type {
  RepElection,
  RepElectionCandidate,
  RepresentativeMember,
  RepresentativeOfficeRole,
  RepresentativePeriod,
  RepresentativesAuditEntry,
  RepresentativesSettings,
  RepElectionAuditAction,
} from '../types/representatives'

const STORAGE_KEY = 'atics-representatives-v1'

type RepState = {
  settings: RepresentativesSettings
  elections: RepElection[]
  members: RepresentativeMember[]
  periods: RepresentativePeriod[]
  auditTrail: RepresentativesAuditEntry[]
  /** electionId -> Set of opaque voter tokens (browser session) to prevent double vote in demo */
  voterTokens: Record<string, string[]>
}

const defaultSettings: RepresentativesSettings = {
  seatsPerSide: 3,
  requireChairAndDeputy: true,
}

const roleOrderEmployee: RepresentativeOfficeRole[] = [
  'employee_chair',
  'employee_deputy',
  'employee_member',
]

function auditEntry(
  action: RepElectionAuditAction,
  message: string,
  meta?: Record<string, string | number | boolean>,
): RepresentativesAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    message,
    meta,
  }
}

function emptyTrainingChecklist(): Record<string, boolean> {
  const m: Record<string, boolean> = {}
  for (const r of REPRESENTATIVE_ROLE_REQUIREMENTS) {
    m[r.id] = false
  }
  return m
}

const seedPeriods: RepresentativePeriod[] = [
  {
    id: 'p1',
    label: '2024–2026',
    startDate: '2024-06-01',
    endDate: '2026-05-31',
    closedAt: undefined,
  },
]

const seedLeadership: RepresentativeMember[] = [
  {
    id: 'lm1',
    name: 'Ledelse — Leder',
    side: 'leadership',
    officeRole: 'leadership_chair',
    source: 'appointment',
    startedAt: '2024-06-01',
    termUntil: '2026-05-31',
    trainingChecklist: emptyTrainingChecklist(),
  },
  {
    id: 'lm2',
    name: 'Ledelse — Nestleder',
    side: 'leadership',
    officeRole: 'leadership_deputy',
    source: 'appointment',
    startedAt: '2024-06-01',
    termUntil: '2026-05-31',
    trainingChecklist: emptyTrainingChecklist(),
  },
  {
    id: 'lm3',
    name: 'Ledelse — Medlem',
    side: 'leadership',
    officeRole: 'leadership_member',
    source: 'appointment',
    startedAt: '2024-06-01',
    termUntil: '2026-05-31',
    trainingChecklist: emptyTrainingChecklist(),
  },
]

function mergeTrainingChecklist(existing?: Record<string, boolean>): Record<string, boolean> {
  const base = emptyTrainingChecklist()
  if (!existing) return base
  for (const k of Object.keys(base)) {
    if (existing[k] !== undefined) base[k] = existing[k]
  }
  return base
}

function normalizeMembers(members: RepresentativeMember[]): RepresentativeMember[] {
  return members.map((m) => ({
    ...m,
    trainingChecklist: mergeTrainingChecklist(m.trainingChecklist),
  }))
}

function load(): RepState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        settings: defaultSettings,
        elections: [],
        members: normalizeMembers(seedLeadership),
        periods: seedPeriods,
        auditTrail: [
          auditEntry('election_created', 'Representasjonsmodul initialisert med illustrativ ledergruppe.', {
            demo: true,
          }),
        ],
        voterTokens: {},
      }
    }
    const p = JSON.parse(raw) as RepState
    return {
      settings: p.settings ?? defaultSettings,
      elections: Array.isArray(p.elections) ? p.elections : [],
      members: normalizeMembers(Array.isArray(p.members) ? p.members : seedLeadership),
      periods: Array.isArray(p.periods) ? p.periods : seedPeriods,
      auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
      voterTokens: p.voterTokens && typeof p.voterTokens === 'object' ? p.voterTokens : {},
    }
  } catch {
    return {
      settings: defaultSettings,
      elections: [],
      members: normalizeMembers(seedLeadership),
      periods: seedPeriods,
      auditTrail: [],
      voterTokens: {},
    }
  }
}

function save(state: RepState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function mapVotesToRoles(
  sortedCandidates: RepElectionCandidate[],
  seats: number,
): RepresentativeOfficeRole[] {
  const roles: RepresentativeOfficeRole[] = []
  for (let i = 0; i < Math.min(seats, sortedCandidates.length); i++) {
    roles.push(roleOrderEmployee[i] ?? 'employee_member')
  }
  return roles
}

export function useRepresentatives() {
  const [state, setState] = useState<RepState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const appendAudit = useCallback(
    (action: RepElectionAuditAction, message: string, meta?: Record<string, string | number | boolean>) => {
      setState((s) => ({
        ...s,
        auditTrail: [...s.auditTrail, auditEntry(action, message, meta)],
      }))
    },
    [],
  )

  const updateSettings = useCallback(
    (patch: Partial<RepresentativesSettings>) => {
      setState((s) => ({
        ...s,
        settings: { ...s.settings, ...patch },
      }))
      appendAudit('settings_updated', 'Innstillinger for seter og krav oppdatert.', patch as Record<string, string | number | boolean>)
    },
    [appendAudit],
  )

  const createElection = useCallback(
    (title: string, description: string, anonymous: boolean, seatsToFill: number, periodId?: string) => {
      const e: RepElection = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        anonymous,
        status: 'draft',
        seatsToFill: Math.max(1, seatsToFill),
        candidates: [],
        votesCastTotal: 0,
        createdAt: new Date().toISOString(),
        periodId,
      }
      setState((s) => ({
        ...s,
        elections: [e, ...s.elections],
      }))
      appendAudit('election_created', `Valg opprettet: «${e.title}» (${anonymous ? 'anonym stemmegivning' : 'åpne navn'}).`, {
        electionId: e.id,
        anonymous,
      })
      return e
    },
    [appendAudit],
  )

  const addCandidate = useCallback(
    (electionId: string, name: string) => {
      const n = name.trim()
      if (!n) return
      const c: RepElectionCandidate = { id: crypto.randomUUID(), name: n, voteCount: 0 }
      setState((s) => ({
        ...s,
        elections: s.elections.map((el) =>
          el.id === electionId && el.status !== 'closed'
            ? { ...el, candidates: [...el.candidates, c] }
            : el,
        ),
      }))
      appendAudit('candidate_added', `Kandidat registrert i valg.`, {
        electionId,
        candidateId: c.id,
      })
    },
    [appendAudit],
  )

  const openElection = useCallback(
    (electionId: string) => {
      setState((s) => ({
        ...s,
        elections: s.elections.map((el) =>
          el.id === electionId
            ? { ...el, status: 'open' as const, openedAt: new Date().toISOString() }
            : el,
        ),
        voterTokens: { ...s.voterTokens, [electionId]: s.voterTokens[electionId] ?? [] },
      }))
      appendAudit('election_opened', `Valg åpnet for stemmegivning.`, { electionId })
    },
    [appendAudit],
  )

  const getVoterToken = useCallback(() => {
    const k = 'atics-rep-voter'
    let t = sessionStorage.getItem(k)
    if (!t) {
      t = crypto.randomUUID()
      sessionStorage.setItem(k, t)
    }
    return t
  }, [])

  const vote = useCallback(
    (electionId: string, candidateId: string) => {
      const token = getVoterToken()
      let voted = false
      let anonymous = false
      setState((s) => {
        const el = s.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open') return s
        anonymous = el.anonymous
        const tokens = s.voterTokens[electionId] ?? []
        if (tokens.includes(token)) return s
        voted = true
        return {
          ...s,
          elections: s.elections.map((e) =>
            e.id === electionId
              ? {
                  ...e,
                  votesCastTotal: e.votesCastTotal + 1,
                  candidates: e.candidates.map((c) =>
                    c.id === candidateId ? { ...c, voteCount: c.voteCount + 1 } : c,
                  ),
                }
              : e,
          ),
          voterTokens: {
            ...s.voterTokens,
            [electionId]: [...tokens, token],
          },
        }
      })
      if (voted) {
        appendAudit('vote_cast', 'Stemme registrert (én stemme per nettleserøkt i demo).', {
          electionId,
          anonymous,
        })
      }
    },
    [appendAudit, getVoterToken],
  )

  const closeElectionAndSync = useCallback(
    (electionId: string) => {
      setState((s) => {
        const el = s.elections.find((x) => x.id === electionId)
        if (!el || el.status !== 'open') return s

        const sorted = [...el.candidates].sort((a, b) => b.voteCount - a.voteCount)
        const seats = el.seatsToFill
        const top = sorted.slice(0, seats)
        const roles = mapVotesToRoles(top, seats)

        const newEmployeeMembers: RepresentativeMember[] = top.map((c, i) => ({
          id: crypto.randomUUID(),
          name: c.name,
          side: 'employee' as const,
          officeRole: roles[i] ?? 'employee_member',
          source: 'election' as const,
          startedAt: new Date().toISOString().slice(0, 10),
          termUntil: undefined,
          fromElectionId: el.id,
          trainingChecklist: emptyTrainingChecklist(),
        }))

        const withoutOldElected = s.members.filter(
          (m) => !(m.side === 'employee' && m.source === 'election'),
        )

        const closedElection: RepElection = {
          ...el,
          status: 'closed',
          closedAt: new Date().toISOString(),
        }

        return {
          ...s,
          elections: s.elections.map((e) => (e.id === electionId ? closedElection : e)),
          members: [...withoutOldElected, ...newEmployeeMembers],
        }
      })
      appendAudit('election_closed', 'Valg avsluttet og arbeidstakerrepresentanter oppdatert.', {
        electionId,
      })
      appendAudit('board_synced', 'AMU-sammensetting oppdatert etter valg.', { electionId })
    },
    [appendAudit],
  )

  const toggleTraining = useCallback(
    (memberId: string, requirementId: string) => {
      setState((s) => ({
        ...s,
        members: s.members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                trainingChecklist: {
                  ...m.trainingChecklist,
                  [requirementId]: !m.trainingChecklist[requirementId],
                },
              }
            : m,
        ),
      }))
      appendAudit('training_updated', 'Opplæringsstatus endret.', { memberId, requirementId })
    },
    [appendAudit],
  )

  const updateMember = useCallback(
    (id: string, patch: Partial<Pick<RepresentativeMember, 'name' | 'officeRole' | 'termUntil'>>) => {
      setState((s) => ({
        ...s,
        members: s.members.map((m) =>
          m.id === id
            ? {
                ...m,
                ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                ...(patch.officeRole !== undefined ? { officeRole: patch.officeRole } : {}),
                ...(patch.termUntil !== undefined ? { termUntil: patch.termUntil } : {}),
              }
            : m,
        ),
      }))
      appendAudit('member_updated', 'Representant oppdatert (navn/rolle/periode).', { memberId: id })
    },
    [appendAudit],
  )

  const addLeadershipPlaceholder = useCallback(() => {
    const m: RepresentativeMember = {
      id: crypto.randomUUID(),
      name: 'Ny lederrepresentant',
      side: 'leadership',
      officeRole: 'leadership_member',
      source: 'appointment',
      startedAt: new Date().toISOString().slice(0, 10),
      trainingChecklist: emptyTrainingChecklist(),
    }
    setState((s) => ({ ...s, members: [...s.members, m] }))
    appendAudit('member_updated', 'Lederrepresentant lagt til (juster rolle og navn).', { memberId: m.id })
  }, [appendAudit])

  const addPeriod = useCallback(
    (label: string, startDate: string, endDate: string) => {
      const p: RepresentativePeriod = {
        id: crypto.randomUUID(),
        label: label.trim(),
        startDate,
        endDate,
      }
      setState((s) => ({ ...s, periods: [...s.periods, p] }))
      appendAudit('election_created', `Periode registrert: ${p.label}`, { periodId: p.id })
    },
    [appendAudit],
  )

  const validation = useMemo(() => {
    const { seatsPerSide } = state.settings
    const employees = state.members.filter((m) => m.side === 'employee')
    const leadership = state.members.filter((m) => m.side === 'leadership')
    const empCount = employees.length
    const leadCount = leadership.length

    const balanced = empCount === leadCount && empCount === seatsPerSide
    const hasChairEmp = employees.some((m) => m.officeRole === 'employee_chair')
    const hasDepEmp = employees.some((m) => m.officeRole === 'employee_deputy')
    const hasChairLead = leadership.some((m) => m.officeRole === 'leadership_chair')
    const hasDepLead = leadership.some((m) => m.officeRole === 'leadership_deputy')

    const issues: string[] = []
    if (empCount !== seatsPerSide) {
      issues.push(
        `Arbeidstakersiden skal ha nøyaktig ${seatsPerSide} representanter (nå: ${empCount}).`,
      )
    }
    if (leadCount !== seatsPerSide) {
      issues.push(
        `Arbeidsgiversiden skal ha nøyaktig ${seatsPerSide} representanter (nå: ${leadCount}).`,
      )
    }
    if (!balanced && empCount !== leadCount) {
      issues.push('Lik representasjon (50/50) er ikke oppfylt — juster antall på begge sider.')
    }
    if (state.settings.requireChairAndDeputy) {
      if (!hasChairEmp) issues.push('Mangler leder på arbeidstakersiden.')
      if (!hasDepEmp) issues.push('Mangler nestleder på arbeidstakersiden.')
      if (!hasChairLead) issues.push('Mangler leder på arbeidsgiversiden.')
      if (!hasDepLead) issues.push('Mangler nestleder på arbeidsgiversiden.')
    }

    const empChairs = employees.filter((m) => m.officeRole === 'employee_chair').length
    const leadChairs = leadership.filter((m) => m.officeRole === 'leadership_chair').length
    if (empChairs > 1) issues.push('Kun én leder (arbeidstaker) tillatt — juster roller.')
    if (leadChairs > 1) issues.push('Kun én leder (arbeidsgiver) tillatt — juster roller.')

    return {
      balanced,
      empCount,
      leadCount,
      seatsPerSide,
      issues,
      ok: issues.length === 0,
    }
  }, [state.members, state.settings])

  const periodCount = state.periods.length

  const resetDemo = useCallback(() => {
    const next: RepState = {
      settings: defaultSettings,
      elections: [],
      members: normalizeMembers(seedLeadership),
      periods: seedPeriods,
      auditTrail: [auditEntry('election_created', 'Demodata tilbakestilt.')],
      voterTokens: {},
    }
    setState(next)
    save(next)
  }, [])

  return {
    ...state,
    validation,
    periodCount,
    updateSettings,
    createElection,
    addCandidate,
    openElection,
    vote,
    closeElectionAndSync,
    toggleTraining,
    updateMember,
    addLeadershipPlaceholder,
    addPeriod,
    resetDemo,
  }
}
