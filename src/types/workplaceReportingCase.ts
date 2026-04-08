export type WorkplaceCaseCategory =
  | 'work_environment'
  | 'coworkers'
  | 'health_safety'
  | 'management'
  | 'ethics'
  | 'policy_violation'
  | 'other'

export type WorkplaceCaseStatus = 'received' | 'triage' | 'in_progress' | 'closed'

/** Extra fields vary by category; all optional at type level, UI enforces relevance. */
export type WorkplaceCaseDetails = {
  locationOrUnit?: string
  desiredFollowUp?: string
  relationshipOrTheme?: string
  riskOrConsequence?: string
  immediateMeasures?: string
  managementContext?: string
  ethicalQuestion?: string
  policyReference?: string
}

export type WorkplaceCase = {
  id: string
  createdAt: string
  updatedAt: string
  category: WorkplaceCaseCategory
  status: WorkplaceCaseStatus
  title: string
  description: string
  details: WorkplaceCaseDetails
  /** If true, only creator + admin + varsling committee see the row in the list. */
  confidential: boolean
  createdByUserId: string
}

export type WorkplaceReportingStore = {
  cases: WorkplaceCase[]
}
