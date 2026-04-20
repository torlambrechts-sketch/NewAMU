export type IkLawCode = 'AML' | 'BVL' | 'ETL' | 'FL' | 'PKL'

export type IkStatus = 'ok' | 'attention' | 'critical' | 'unassessed'

// ── Pillar 1 ──────────────────────────────────────────────
export type IkLegalRegisterRow = {
  id: string
  organization_id: string
  law_code: IkLawCode
  paragraph: string
  title: string
  description: string | null
  applicable: boolean
  deviation_note: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

// ── Pillar 3 ──────────────────────────────────────────────
export type IkOrgRoleRow = {
  id: string
  organization_id: string
  role_key: string
  display_name: string
  law_basis: string
  is_mandatory: boolean
  assigned_to: string | null
  assigned_name: string | null
  valid_from: string | null
  valid_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Pillar 2 ──────────────────────────────────────────────
export type IkCompetenceRequirementRow = {
  id: string
  organization_id: string
  role_key: string
  display_name: string
  cert_name: string
  law_basis: string | null
  is_hard_gate: boolean
  validity_months: number | null
  created_at: string
}

export type IkCompetenceRecordRow = {
  id: string
  organization_id: string
  requirement_id: string
  user_id: string | null
  user_name: string
  issued_at: string
  expires_at: string | null
  issuer: string | null
  document_url: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export type CertStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing'

export type IkCompetenceRecordWithStatus = IkCompetenceRecordRow & {
  cert_status: CertStatus
}

// ── Pillar 4 ──────────────────────────────────────────────
export type IkHseGoalRow = {
  id: string
  organization_id: string
  year: number
  title: string
  description: string | null
  goal_type: 'lagging' | 'leading'
  target_value: number | null
  target_unit: string | null
  law_pillar: IkLawCode | null
  owner_id: string | null
  owner_name: string | null
  status: 'active' | 'achieved' | 'missed' | 'cancelled'
  created_at: string
  updated_at: string
}

export type IkHseGoalMeasurementRow = {
  id: string
  goal_id: string
  measured_at: string
  value: number
  note: string | null
  recorded_by: string | null
  created_at: string
}

// ── Pillar 5 ──────────────────────────────────────────────
export type IkActionPlanSource = 'manual' | 'ros' | 'avvik' | 'inspection' | 'annual_review'

export type IkActionPlanRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  source: IkActionPlanSource
  source_id: string | null
  law_pillar: IkLawCode | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  due_date: string | null
  assigned_to: string | null
  assigned_name: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

// ── Pillar summary (computed) ─────────────────────────────
export type IkPillarStatus = {
  pillar: number
  status: IkStatus
  label: string
  details: string
}
