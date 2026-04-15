export type InspectionRoundStatus = 'draft' | 'active' | 'signed'

export type InspectionFindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export type InspectionChecklistItem = {
  key: string
  label: string
  required?: boolean
}

export type InspectionTemplateRow = {
  id: string
  organization_id: string
  name: string
  checklist_definition: unknown
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type InspectionLocationRow = {
  id: string
  organization_id: string
  location_code: string | null
  name: string
  description: string | null
  metadata: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InspectionRoundRow = {
  id: string
  organization_id: string
  template_id: string
  location_id: string | null
  title: string
  scheduled_for: string | null
  cron_expression: string | null
  assigned_to: string | null
  status: InspectionRoundStatus
  completed_at: string | null
  signed_off_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type InspectionItemRow = {
  id: string
  organization_id: string
  round_id: string
  checklist_item_key: string
  checklist_item_label: string
  position: number
  response: Record<string, unknown>
  status: string
  notes: string | null
  photo_path: string | null
  created_at: string
  updated_at: string
}

export type InspectionFindingRow = {
  id: string
  organization_id: string
  round_id: string
  item_id: string | null
  description: string
  severity: InspectionFindingSeverity
  photo_path: string | null
  created_by: string | null
  deviation_id: string | null
  workflow_processed_at: string | null
  created_at: string
  updated_at: string
}
