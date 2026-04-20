import { z } from 'zod'

const LAW_DOMAINS = ['AML', 'BVL', 'ETL', 'FL', 'PKL'] as const
const ROS_TYPES = ['general', 'org_change', 'fire', 'electrical', 'chemical', 'project'] as const
export const ROS_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const
const CONTROL_TYPES = ['eliminate', 'substitute', 'engineering', 'administrative', 'ppe'] as const

export const RosAnalysisUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Tittel er påkrevd'),
  description: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  location_text: z.string().nullable().optional(),
  law_domains: z.array(z.enum(LAW_DOMAINS)).min(1, 'Velg minst ett lovverk'),
  ros_type: z.enum(ROS_TYPES).default('general'),
  assessor_name: z.string().nullable().optional(),
  assessed_at: z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  conclusion: z.string().nullable().optional(),
})

export const RosHazardUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Beskrivelse er påkrevd'),
  category: z.string().nullable().optional(),
  law_domain: z.enum(LAW_DOMAINS).default('AML'),
  existing_controls: z.string().nullable().optional(),
  initial_probability: z.number().int().min(1).max(5).nullable().optional(),
  initial_consequence: z.number().int().min(1).max(5).nullable().optional(),
  residual_probability: z.number().int().min(1).max(5).nullable().optional(),
  residual_consequence: z.number().int().min(1).max(5).nullable().optional(),
  chemical_ref: z.string().nullable().optional(),
})

export const RosMeasureUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Beskrivelse er påkrevd'),
  control_type: z.enum(CONTROL_TYPES).default('administrative'),
  assigned_to_name: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
})

export type RosAnalysisUpsert = z.infer<typeof RosAnalysisUpsertSchema>
export type RosHazardUpsert = z.infer<typeof RosHazardUpsertSchema>
export type RosMeasureUpsert = z.infer<typeof RosMeasureUpsertSchema>

// ── DB row shapes (strict parse from Supabase) ────────────────────────────────

export const RosAnalysisRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  scope: z.string().nullable(),
  location_id: z.string().uuid().nullable(),
  location_text: z.string().nullable(),
  law_domains: z.array(z.enum(LAW_DOMAINS)),
  ros_type: z.enum(ROS_TYPES),
  status: z.enum(ROS_STATUSES),
  version: z.number().int(),
  parent_id: z.string().uuid().nullable(),
  assessor_id: z.string().uuid().nullable(),
  assessor_name: z.string().nullable(),
  assessed_at: z.string().nullable(),
  next_review_date: z.string().nullable(),
  conclusion: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
})

export const RosHazardRowSchema = z.object({
  id: z.string().uuid(),
  ros_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  description: z.string(),
  category: z.string().nullable(),
  law_domain: z.enum(LAW_DOMAINS),
  existing_controls: z.string().nullable(),
  initial_probability: z.number().int().min(1).max(5).nullable(),
  initial_consequence: z.number().int().min(1).max(5).nullable(),
  residual_probability: z.number().int().min(1).max(5).nullable(),
  residual_consequence: z.number().int().min(1).max(5).nullable(),
  chemical_ref: z.string().nullable(),
  action_plan_id: z.string().uuid().nullable(),
  position: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const RosMeasureRowSchema = z.object({
  id: z.string().uuid(),
  ros_id: z.string().uuid(),
  hazard_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  description: z.string(),
  control_type: z.enum(CONTROL_TYPES),
  assigned_to_id: z.string().uuid().nullable(),
  assigned_to_name: z.string().nullable(),
  due_date: z.string().nullable(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  completed_at: z.string().nullable(),
  is_from_template: z.boolean(),
  position: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const RosParticipantRowSchema = z.object({
  id: z.string().uuid(),
  ros_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  role: z.enum(['responsible', 'verneombud', 'participant', 'observer']),
  created_at: z.string(),
})

export const RosSignatureRowSchema = z.object({
  id: z.string().uuid(),
  ros_id: z.string().uuid(),
  role: z.enum(['responsible', 'verneombud', 'manager']),
  signer_id: z.string().uuid().nullable(),
  signer_name: z.string(),
  signed_at: z.string(),
})

export const RosProbabilityScaleLevelRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  level: z.number().int().min(1).max(5),
  label: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const RosConsequenceCategoryRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  matrix_column: z.number().int().min(1).max(5),
  sort_order: z.number().int(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const RosHazardCategoryRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const RosTemplateHazardStubSchema = z.object({
  description: z.string(),
  category_code: z.string().nullable().optional(),
  law_domain: z.enum(LAW_DOMAINS),
  existing_controls: z.string().nullable().optional(),
})

export const RosTemplateDefinitionSchema = z.object({
  version: z.literal(1).default(1),
  hazard_stubs: z.array(RosTemplateHazardStubSchema).optional(),
})

export const RosTemplateRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  definition: z.unknown(),
  is_active: z.boolean(),
  deleted_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ParsedRosTemplateRow = z.infer<typeof RosTemplateRowSchema> & {
  definition: z.infer<typeof RosTemplateDefinitionSchema>
}

export function parseRosTemplateRow(raw: unknown): ParsedRosTemplateRow | null {
  const base = RosTemplateRowSchema.safeParse(raw)
  if (!base.success) return null
  const def = RosTemplateDefinitionSchema.safeParse(base.data.definition ?? { version: 1 })
  if (!def.success) return null
  return { ...base.data, definition: def.data }
}

export function parseRosAnalysisRow(raw: unknown) {
  return RosAnalysisRowSchema.safeParse(raw)
}

export function parseRosHazardRow(raw: unknown) {
  return RosHazardRowSchema.safeParse(raw)
}

export function parseRosMeasureRow(raw: unknown) {
  return RosMeasureRowSchema.safeParse(raw)
}

export function parseRosParticipantRow(raw: unknown) {
  return RosParticipantRowSchema.safeParse(raw)
}

export function parseRosSignatureRow(raw: unknown) {
  return RosSignatureRowSchema.safeParse(raw)
}

export function parseRosProbabilityScaleLevelRow(raw: unknown) {
  return RosProbabilityScaleLevelRowSchema.safeParse(raw)
}

export function parseRosConsequenceCategoryRow(raw: unknown) {
  return RosConsequenceCategoryRowSchema.safeParse(raw)
}

export function parseRosHazardCategoryRow(raw: unknown) {
  return RosHazardCategoryRowSchema.safeParse(raw)
}
