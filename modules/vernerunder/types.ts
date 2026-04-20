/** Gjelder feltet `vernerunder.status` */
export type VernerunderStatus = 'draft' | 'active' | 'completed' | 'signed'

export type VernerundeCheckpointStatus = 'ok' | 'deviation' | 'not_applicable'

export type VernerundeParticipantRole = 'manager' | 'safety_deputy' | 'employee'

export type VernerundeFindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export type VernerunderRow = {
  id: string
  organization_id: string
  title: string
  status: VernerunderStatus
  planned_date: string | null
  template_id: string | null
  created_at: string
  updated_at: string
}

export type VernerundeCheckpointRow = {
  id: string
  organization_id: string
  vernerunde_id: string
  original_template_item_id: string | null
  question_text: string
  status: VernerundeCheckpointStatus
  created_at: string
  updated_at: string
}

export type VernerundeParticipantRow = {
  id: string
  organization_id: string
  vernerunde_id: string
  user_id: string
  role: VernerundeParticipantRole
  signed_at: string | null
  created_at: string
}

export type VernerundeFindingRow = {
  id: string
  organization_id: string
  vernerunde_id: string
  checkpoint_id: string | null
  category_id: string | null
  description: string
  severity: VernerundeFindingSeverity
  created_at: string
  updated_at: string
}

export type VernerundeCategoryRow = {
  id: string
  organization_id: string
  name: string
}

export type VernerundeTemplateRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
}

export type VernerundeTemplateItemRow = {
  id: string
  template_id: string
  organization_id: string
  question_text: string
  category_id: string | null
  position: number
}

export type VernerunderWorkflowEventName =
  | 'ON_VERNERUNDE_CREATED'
  | 'ON_STATUS_CHANGED'
  | 'ON_FINDING_REGISTERED'
  | 'ON_FINDING_UPDATED'

export type VernerunderWorkflowDispatchPayload = {
  source_module: 'vernerunder'
  source_id: string
  row: Record<string, unknown>
  meta?: Record<string, unknown>
}
