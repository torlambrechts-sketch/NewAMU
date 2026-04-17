export type InspectionRoundStatus = 'draft' | 'active' | 'signed'

export type InspectionFindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export type InspectionFieldType =
  | 'yes_no_na'
  | 'text'
  | 'number'
  | 'photo'
  | 'photo_required'
  | 'signature'

/** Norwegian HMS category tags (Internkontrollforskriften / AML references) */
export type HmsCategory =
  | 'fysisk'       // Fysisk arbeidsmiljø — AML § 4-4
  | 'ergonomi'     // Ergonomi og tilrettelegging — AML § 4-4
  | 'kjemikalier'  // Kjemikalier og farlige stoffer — Stoffkartotekforskriften
  | 'psykososialt' // Psykososialt arbeidsmiljø — AML § 4-3
  | 'brann'        // Brann og rømning — IK-forskriften
  | 'maskiner'     // Maskiner og teknisk utstyr — Arbeidsutstyrsforskriften
  | 'annet'

export type InspectionChecklistItem = {
  key: string
  label: string
  required?: boolean
  /** Response type for this item */
  fieldType?: InspectionFieldType
  /** Norwegian HMS category for reporting / filtering */
  hmsCategory?: HmsCategory
  /** Explanatory text shown to inspector during execution */
  helpText?: string
  /** Legal reference, e.g. "AML § 4-4" */
  lawRef?: string
}

export type InspectionTemplateRow = {
  id: string
  organization_id: string | null
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
  /** Hierarchical parent (e.g. Building → Floor → Room) */
  parent_id: string | null
  /** Location kind: building | floor | room | department | equipment | site | other */
  kind: string
  /** Responsible manager (Arbeidsgiver/Leder) for this location */
  manager_id: string | null
  /** Safety deputy (Verneombud) for this location */
  safety_deputy_id: string | null
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
  /** Dual sign-off — Internkontrollforskriften § 5 */
  manager_signed_at: string | null
  manager_signed_by: string | null
  deputy_signed_at: string | null
  deputy_signed_by: string | null
  /** Written protocol — Internkontrollforskriften § 5 */
  summary: string | null
  conducted_by: string | null
  conducted_at: string | null
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
  risk_probability: number | null
  risk_consequence: number | null
  /** Generated column — read-only from DB */
  risk_score: number | null
  photo_path: string | null
  created_by: string | null
  deviation_id: string | null
  workflow_processed_at: string | null
  created_at: string
  updated_at: string
}

