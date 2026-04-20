export type RosLawDomain = 'AML' | 'BVL' | 'ETL' | 'FL' | 'PKL'

export type RosType =
  | 'general' | 'org_change' | 'fire' | 'electrical' | 'chemical' | 'project'

export type RosStatus = 'draft' | 'in_review' | 'approved' | 'archived'

export type RosControlType =
  | 'eliminate' | 'substitute' | 'engineering' | 'administrative' | 'ppe'

export type RosMeasureStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

// ── Law domain display ────────────────────────────────────────────────────────
export const LAW_DOMAIN_LABEL: Record<RosLawDomain, string> = {
  AML: 'Arbeidsmiljøloven',
  BVL: 'Brann- og eksplosjonsvernloven',
  ETL: 'El-tilsynsloven',
  FL:  'Forurensningsloven',
  PKL: 'Produktkontrolloven',
}
export const LAW_DOMAIN_COLOR: Record<RosLawDomain, string> = {
  AML: '#1a3d32',
  BVL: '#c2410c',
  ETL: '#d97706',
  FL:  '#0891b2',
  PKL: '#6d28d9',
}
/** Tailwind `bg-[…]` — use for pills/dots; avoid inline `style={{ backgroundColor }}` (Design System). */
export const LAW_DOMAIN_BG: Record<RosLawDomain, string> = {
  AML: 'bg-[#1a3d32]',
  BVL: 'bg-[#c2410c]',
  ETL: 'bg-[#d97706]',
  FL:  'bg-[#0891b2]',
  PKL: 'bg-[#6d28d9]',
}
/** Filled law toggle (background + text + border). */
export const LAW_DOMAIN_CHIP_ACTIVE: Record<RosLawDomain, string> = {
  AML: 'border-[#1a3d32] bg-[#1a3d32] text-white',
  BVL: 'border-[#c2410c] bg-[#c2410c] text-white',
  ETL: 'border-[#d97706] bg-[#d97706] text-white',
  FL:  'border-[#0891b2] bg-[#0891b2] text-white',
  PKL: 'border-[#6d28d9] bg-[#6d28d9] text-white',
}
/** Border color for hollow ring dots (e.g. risk scatter). */
export const LAW_DOMAIN_BORDER: Record<RosLawDomain, string> = {
  AML: 'border-[#1a3d32]',
  BVL: 'border-[#c2410c]',
  ETL: 'border-[#d97706]',
  FL:  'border-[#0891b2]',
  PKL: 'border-[#6d28d9]',
}
export const ALL_LAW_DOMAINS: RosLawDomain[] = ['AML', 'BVL', 'ETL', 'FL', 'PKL']

// ── Control hierarchy ─────────────────────────────────────────────────────────
export const CONTROL_TYPE_LABEL: Record<RosControlType, string> = {
  eliminate:      'Eliminering',
  substitute:     'Substitusjon',
  engineering:    'Teknisk tiltak',
  administrative: 'Administrativt',
  ppe:            'Verneutstyr (PPE)',
}
export const CONTROL_TYPE_COLOR: Record<RosControlType, string> = {
  eliminate:      'bg-green-100 text-green-800',
  substitute:     'bg-emerald-100 text-emerald-800',
  engineering:    'bg-blue-100 text-blue-800',
  administrative: 'bg-amber-100 text-amber-800',
  ppe:            'bg-orange-100 text-orange-800',
}
export const CONTROL_TYPE_RANK: Record<RosControlType, number> = {
  eliminate: 1, substitute: 2, engineering: 3, administrative: 4, ppe: 5,
}

// ── Status ────────────────────────────────────────────────────────────────────
export const ROS_STATUS_LABEL: Record<RosStatus, string> = {
  draft:     'Utkast',
  in_review: 'Til gjennomgang',
  approved:  'Godkjent',
  archived:  'Arkivert',
}
export const ROS_STATUS_COLOR: Record<RosStatus, string> = {
  draft:     'border border-neutral-200 bg-neutral-100 text-neutral-700',
  in_review: 'border border-amber-200 bg-amber-100 text-amber-800',
  approved:  'border border-green-200 bg-green-100 text-green-800',
  archived:  'border border-neutral-200 bg-neutral-50 text-neutral-500',
}
export const ROS_TYPE_LABEL: Record<RosType, string> = {
  general:     'Generell',
  org_change:  'Organisatorisk endring',
  fire:        'Brann/eksplosjon',
  electrical:  'Elektrisk',
  chemical:    'Kjemikalier',
  project:     'Prosjekt',
}

// ── Row types (mirror DB schema) ──────────────────────────────────────────────
export type RosAnalysisRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  scope: string | null
  location_id: string | null
  location_text: string | null
  law_domains: RosLawDomain[]
  ros_type: RosType
  status: RosStatus
  version: number
  parent_id: string | null
  assessor_id: string | null
  assessor_name: string | null
  assessed_at: string | null
  next_review_date: string | null
  conclusion: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RosParticipantRow = {
  id: string
  ros_id: string
  user_id: string | null
  name: string
  role: 'responsible' | 'verneombud' | 'participant' | 'observer'
  created_at: string
}

export type RosHazardRow = {
  id: string
  ros_id: string
  organization_id: string
  description: string
  category: string | null
  law_domain: RosLawDomain
  existing_controls: string | null
  initial_probability: number | null
  initial_consequence: number | null
  residual_probability: number | null
  residual_consequence: number | null
  chemical_ref: string | null
  action_plan_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export type RosMeasureRow = {
  id: string
  ros_id: string
  hazard_id: string
  organization_id: string
  description: string
  control_type: RosControlType
  assigned_to_id: string | null
  assigned_to_name: string | null
  due_date: string | null
  status: RosMeasureStatus
  completed_at: string | null
  is_from_template: boolean
  position: number
  created_at: string
  updated_at: string
}

export type RosSignatureRow = {
  id: string
  ros_id: string
  role: 'responsible' | 'verneombud' | 'manager'
  signer_id: string | null
  signer_name: string
  signed_at: string
}

// ── Organization settings (Supabase) ─────────────────────────────────────────
export type RosProbabilityScaleLevelRow = {
  id: string
  organization_id: string
  level: number
  label: string
  description: string | null
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type RosConsequenceCategoryRow = {
  id: string
  organization_id: string
  code: string
  label: string
  description: string | null
  matrix_column: number
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type RosHazardCategoryRow = {
  id: string
  organization_id: string
  code: string
  label: string
  description: string | null
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type RosTemplateRow = {
  id: string
  organization_id: string
  name: string
  /** Parsed with RosTemplateDefinitionSchema in schema.ts */
  definition: RosTemplateDefinition
  is_active: boolean
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Én rad per organisasjon — grunnleggende ROS-modulflagg */
export type RosModuleSettingsRow = {
  organization_id: string
  require_dual_signature: boolean
  default_matrix_size: 3 | 5
  updated_at: string
}

/** JSONB payload for ros_templates.definition */
export type RosTemplateDefinition = {
  version: 1
  /** Optional checklist of hazard stubs applied when creating from template */
  hazard_stubs?: {
    description: string
    category_code: string | null
    law_domain: RosLawDomain
    existing_controls?: string | null
  }[]
}

// ── Computed helpers ──────────────────────────────────────────────────────────
export function riskScore(p: number | null, c: number | null): number | null {
  if (p == null || c == null) return null
  return p * c
}

export function riskBand(score: number | null): 'low' | 'medium' | 'high' | 'critical' {
  if (score == null || score <= 4) return 'low'
  if (score <= 9) return 'medium'
  if (score <= 14) return 'high'
  return 'critical'
}

export const RISK_BAND_COLOR = {
  low:      'bg-green-100 text-green-800',
  medium:   'bg-yellow-100 text-yellow-800',
  high:     'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export const RISK_BAND_LABEL = {
  low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
}
