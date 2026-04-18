export type SjaStatus =
  | 'draft'
  | 'active'
  | 'approved'
  | 'in_execution'
  | 'completed'
  | 'archived'
  | 'stopped'

export type SjaJobType =
  | 'hot_work'
  | 'confined_space'
  | 'work_at_height'
  | 'electrical'
  | 'lifting'
  | 'excavation'
  | 'custom'

export type SjaControlType = 'eliminate' | 'substitute' | 'engineering' | 'administrative' | 'ppe'

export type SjaParticipantRole = 'responsible' | 'worker' | 'contractor' | 'observer'

export type SjaHazardCategory =
  | 'fall'
  | 'chemical'
  | 'electrical'
  | 'mechanical'
  | 'fire'
  | 'ergonomic'
  | 'dropped_object'
  | 'other'

export const SJA_PPE_OPTIONS = [
  { key: 'helmet', label: 'Hjelm' },
  { key: 'safety_glasses', label: 'Vernebriller' },
  { key: 'hearing', label: 'Hørselvern' },
  { key: 'gloves', label: 'Vernehansker' },
  { key: 'hi_vis', label: 'Refleksvest' },
  { key: 'safety_shoes', label: 'Vernesko' },
  { key: 'fall_arrest', label: 'Fallsikring' },
  { key: 'respirator', label: 'Åndedrettsvern' },
  { key: 'face_shield', label: 'Ansiktsskjerm' },
] as const

export type SjaPpeKey = (typeof SJA_PPE_OPTIONS)[number]['key']

export type SjaTemplateMeasure = {
  description: string
  control_type: SjaControlType
  is_mandatory: boolean
}

export type SjaTemplateHazard = {
  description: string
  category?: string
  measures: SjaTemplateMeasure[]
}

export type SjaTemplateTask = {
  title: string
  description?: string
  position: number
  hazards: SjaTemplateHazard[]
}

/** @deprecated Prefer SjaTemplateTask — kept as an alias for existing imports */
export type PrefillTask = SjaTemplateTask

export type SjaTemplate = {
  id: string
  organization_id: string
  name: string
  job_type: SjaJobType
  description: string | null
  required_certs: string[] | null
  required_ppe: SjaPpeKey[]
  prefill_tasks: SjaTemplateTask[] | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Row shape aligned with DB + JSONB (alias of SjaTemplate) */
export type SjaTemplateRow = SjaTemplate

export type SjaAnalysis = {
  id: string
  organization_id: string
  template_id: string | null
  location_id: string | null
  location_text: string | null
  title: string
  job_description: string
  job_type: SjaJobType
  trigger_reason: string
  responsible_id: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  status: SjaStatus
  stop_reason: string | null
  debrief_notes: string | null
  unexpected_hazards: boolean | null
  debrief_completed_by: string | null
  debrief_completed_at: string | null
  avvik_created: boolean
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SjaParticipant = {
  id: string
  sja_id: string
  user_id: string | null
  name: string
  role: SjaParticipantRole
  company: string | null
  certs_verified: boolean
  certs_notes: string | null
  signed_at: string | null
  created_at: string
}

export type SjaTask = {
  id: string
  sja_id: string
  title: string
  description: string | null
  position: number
  created_at: string
}

export type SjaHazard = {
  id: string
  sja_id: string
  task_id: string
  description: string
  category: SjaHazardCategory | null
  initial_probability: number | null
  initial_consequence: number | null
  residual_probability: number | null
  residual_consequence: number | null
  chemical_ref: string | null
  created_at: string
}

export type SjaMeasure = {
  id: string
  sja_id: string
  hazard_id: string
  description: string
  control_type: SjaControlType
  assigned_to_id: string | null
  assigned_to_name: string | null
  completed: boolean
  completed_at: string | null
  is_from_template: boolean
  is_mandatory: boolean
  deletion_justification: string | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
}

/** Live measure row (alias of SjaMeasure) */
export type SjaMeasureRow = SjaMeasure

export type SjaCreatePayload = {
  title: string
  jobDescription: string
  jobType: SjaJobType
  triggerReason: string
  templateId?: string
  locationId?: string
  locationText?: string
  responsibleId?: string
  scheduledStart?: string
  scheduledEnd?: string
}

export type SjaDetail = {
  analysis: SjaAnalysis
  participants: SjaParticipant[]
  tasks: SjaTask[]
  hazards: SjaHazard[]
  measures: SjaMeasure[]
}
