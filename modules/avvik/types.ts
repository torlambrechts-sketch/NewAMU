export type AvvikSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AvvikStatus =
  | 'open'
  | 'in_progress'
  | 'closed'
  | 'rapportert'
  | 'under_behandling'
  | 'tiltak_iverksatt'
  | 'lukket'

export type AvvikRow = {
  id: string
  organization_id: string
  source: string
  source_id: string | null
  title: string
  description: string
  severity: AvvikSeverity
  status: AvvikStatus
  due_at: string | null
  assigned_to: string | null
  risk_probability?: number | null
  risk_consequence?: number | null
  risk_score?: number | null
  root_cause_analysis: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AvvikCreatePayload = {
  title: string
  description: string
  severity: AvvikSeverity
  source?: string
  sourceId?: string
  dueAt?: string
  assignedTo?: string
  riskProbability?: number
  riskConsequence?: number
}

export type AvvikUpdatePayload = {
  avvikId: string
  title?: string
  description?: string
  severity?: AvvikSeverity
  status?: AvvikStatus
  dueAt?: string | null
  assignedTo?: string | null
  rootCauseAnalysis?: string | null
  riskProbability?: number | null
  riskConsequence?: number | null
}
