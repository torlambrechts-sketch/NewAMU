export type AmuElectionStatus = 'draft' | 'nomination' | 'voting' | 'closed'

export type AmuElectionCandidateStatus = 'nominated' | 'approved'

export type AmuElectionRow = {
  id: string
  organization_id: string
  title: string
  status: AmuElectionStatus
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export type AmuElectionCandidateRow = {
  id: string
  election_id: string
  organization_id: string
  user_id: string
  manifesto: string
  status: AmuElectionCandidateStatus
  created_at: string
  updated_at: string
}

export type AmuElectionVoterRow = {
  id: string
  election_id: string
  organization_id: string
  user_id: string
  has_voted: boolean
  voted_at: string | null
  created_at: string
}

/** Anonymous ballot row — no user_id by design. */
export type AmuElectionVoteRow = {
  id: string
  election_id: string
  organization_id: string
  candidate_id: string
  created_at: string
}

export type CreateAmuElectionInput = {
  title: string
  status?: AmuElectionStatus
  start_date: string
  end_date: string
}

export type UpdateAmuElectionInput = {
  electionId: string
  title?: string
  status?: AmuElectionStatus
  start_date?: string
  end_date?: string
}

export type AmuElectionVoteTotalRow = {
  candidate_id: string
  vote_count: number
}

export type AddAmuElectionCandidateInput = {
  electionId: string
  userId: string
  manifesto: string
  status?: AmuElectionCandidateStatus
}

/** Per-org settings in org_module_payloads (module_key = amu_election). */
export type AmuElectionCommitteeMember = {
  user_id: string
  role_label: string
}

export type AmuElectionModuleSettings = {
  /** Minimum varighet for stemmeperioden (dager), brukt som valideringsregel i admin. */
  minimum_voting_days: number
  election_committee: AmuElectionCommitteeMember[]
}
