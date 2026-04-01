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

export type CouncilMeeting = {
  id: string
  title: string
  startsAt: string
  location: string
  agenda: string
  status: MeetingStatus
  minutes?: string
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
