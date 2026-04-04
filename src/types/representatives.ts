/** Side in AMU: equal representation target 50/50 */
export type RepresentativeSide = 'employee' | 'leadership'

/**
 * Office roles — employee side is typically elected; leadership side appointed.
 * Keys used for validation and training matrix.
 */
export type RepresentativeOfficeRole =
  | 'employee_chair'
  | 'employee_deputy'
  | 'employee_member'
  | 'leadership_chair'
  | 'leadership_deputy'
  | 'leadership_member'

export type RepresentativeMember = {
  id: string
  name: string
  side: RepresentativeSide
  officeRole: RepresentativeOfficeRole
  /** elected for employee side; appointed for leadership */
  source: 'election' | 'appointment'
  startedAt: string
  termUntil?: string
  fromElectionId?: string
  /** requirement id → completed */
  trainingChecklist: Record<string, boolean>
  /** True if this member also serves as the verneombud (AML §6-1) */
  isVerneombud?: boolean
  /** Which area/section the verneombud covers (AML §6-1 — verneområde) */
  verneombudArea?: string
  /** Link to a Learning module certificate ID (proves 40-hr HMS course) */
  learningCertificateId?: string
  /** ISO date when the mandatory workplace posting was confirmed (AML §6-1) */
  postingConfirmedAt?: string
  /** References an OrgEmployee.id from the Organisation module */
  employeeId?: string
}

export type RepElectionCandidate = {
  id: string
  /** Real name — hidden in UI when election is anonymous until close */
  name: string
  voteCount: number
}

export type RepElectionStatus = 'draft' | 'open' | 'closed'

export type RepElectionAuditAction =
  | 'election_created'
  | 'election_opened'
  | 'candidate_added'
  | 'vote_cast'
  | 'election_closed'
  | 'board_synced'
  | 'member_updated'
  | 'training_updated'
  | 'settings_updated'

export type RepresentativesAuditEntry = {
  id: string
  at: string
  action: RepElectionAuditAction
  message: string
  meta?: Record<string, string | number | boolean>
}

export type RepresentativePeriod = {
  id: string
  label: string
  startDate: string
  endDate: string
  electionId?: string
  closedAt?: string
}

export type RepElection = {
  id: string
  title: string
  description: string
  anonymous: boolean
  status: RepElectionStatus
  /** How many employee representatives to elect (top by votes) */
  seatsToFill: number
  candidates: RepElectionCandidate[]
  votesCastTotal: number
  createdAt: string
  openedAt?: string
  closedAt?: string
  /** Links to period */
  periodId?: string
}

export type RepresentativesSettings = {
  /** Seats per side — AMU typically equal both sides (50/50) */
  seatsPerSide: number
  /** Require explicit chair + deputy on each side */
  requireChairAndDeputy: boolean
}
