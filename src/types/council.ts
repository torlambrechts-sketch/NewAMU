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

export type AgendaActionItem = {
  id: string
  description: string
  responsible: string
  dueDate?: string
  /** Links to a task in the tasks module */
  taskId?: string
}

export type AgendaItem = {
  id: string
  title: string
  notes: string
  order: number
  /** Brief summary of what was discussed (for minutes) */
  minutesSummary?: string
  /** Formal decision taken, if any */
  decision?: string
  /** Vote counts — only set when a formal vote is taken */
  voteFor?: number
  voteAgainst?: number
  voteAbstain?: number
  /** Action items arising from this agenda item */
  actionItems?: AgendaActionItem[]
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

export type ProtocolSignature = {
  signerName: string
  signedAt: string
  role: 'chair' | 'secretary' | 'management'
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
  /** Forhåndsregistrering — IKKE juridisk bindende signatur. Krever eSignatur i produksjon. */
  protocolSignatures?: ProtocolSignature[]
  preparationNotes: string
  preparationChecklist: PrepChecklistItem[]
  auditTrail: AuditEntry[]
  /** Kvartal i årshjulet (1–4) */
  quarterSlot?: QuarterSlot
  /** Kalenderår for årshjul (f.eks. 2026) */
  governanceYear?: number
  /** ISO timestamp when invitation was sent to members */
  invitationSentAt?: string
  /** Names/roles of those invited */
  invitationRecipients?: string[]
  /** Whether the meeting had quorum (>50% of members present) */
  quorum?: boolean
  /** Names of those who attended */
  attendees?: string[]
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
