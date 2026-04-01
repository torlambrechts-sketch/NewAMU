export type BoardRole = 'leader' | 'deputy' | 'member'

export type BoardMember = {
  id: string
  name: string
  role: BoardRole
  electedAt: string
  termUntil?: string
  fromElectionId?: string
}

export type ElectionCandidate = {
  id: string
  name: string
  voteCount: number
}

export type ElectionStatus = 'open' | 'closed'

export type Election = {
  id: string
  title: string
  status: ElectionStatus
  candidates: ElectionCandidate[]
  createdAt: string
  closedAt?: string
  winnerCandidateId?: string
}

export type MeetingStatus = 'planned' | 'completed' | 'cancelled'

export type QuarterSlot = 1 | 2 | 3 | 4

export type AgendaItem = {
  id: string
  title: string
  notes: string
  order: number
}

export type AuditEntryKind = 'discussion' | 'note' | 'decision'

export type AuditEntry = {
  id: string
  at: string
  kind: AuditEntryKind
  text: string
  author?: string
}

export type PrepChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type CouncilMeeting = {
  id: string
  title: string
  startsAt: string
  location: string
  /** @deprecated Bruk agendaItems — beholdes for migrering */
  agenda?: string
  agendaItems: AgendaItem[]
  status: MeetingStatus
  /** Fritekst referat (kan suppleres med revisjonslogg) */
  minutes?: string
  preparationNotes: string
  preparationChecklist: PrepChecklistItem[]
  auditTrail: AuditEntry[]
  /** Kvartal i årshjulet (1–4) */
  quarterSlot?: QuarterSlot
  /** Kalenderår for årshjul (f.eks. 2026) */
  governanceYear?: number
  createdAt: string
}

export type ComplianceItem = {
  id: string
  title: string
  description: string
  lawRef: string
  done: boolean
  notes?: string
  isCustom?: boolean
}
