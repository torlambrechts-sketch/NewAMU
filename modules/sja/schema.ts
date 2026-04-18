import { z } from 'zod'
import type {
  SjaAnalysis,
  SjaHazard,
  SjaMeasure,
  SjaParticipant,
  SjaTask,
  SjaTemplate,
} from './types'

const UuidSchema = z.string().uuid()
const TimestampSchema = z.string()

const SjaStatusEnum = z.enum([
  'draft',
  'active',
  'approved',
  'in_execution',
  'completed',
  'archived',
  'stopped',
])

const SjaJobTypeEnum = z.enum([
  'hot_work',
  'confined_space',
  'work_at_height',
  'electrical',
  'lifting',
  'excavation',
  'custom',
])

const SjaControlTypeEnum = z.enum(['eliminate', 'substitute', 'engineering', 'administrative', 'ppe'])

const SjaParticipantRoleEnum = z.enum(['responsible', 'worker', 'contractor', 'observer'])

const SjaHazardCategoryEnum = z.enum([
  'fall',
  'chemical',
  'electrical',
  'mechanical',
  'fire',
  'ergonomic',
  'dropped_object',
  'other',
])

const PrefillHazardSchema = z.object({
  description: z.string(),
  category: SjaHazardCategoryEnum,
})

const PrefillTaskSchema = z.object({
  title: z.string(),
  hazards: z.array(PrefillHazardSchema),
})

export const SjaTemplateSchema: z.ZodType<SjaTemplate> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  name: z.string(),
  job_type: SjaJobTypeEnum,
  description: z.string().nullable().default(null),
  required_certs: z.array(z.string()).nullable().default(null),
  prefill_tasks: z.array(PrefillTaskSchema).nullable().default(null),
  is_active: z.boolean(),
  created_by: UuidSchema.nullable().default(null),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const SjaAnalysisSchema: z.ZodType<SjaAnalysis> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  template_id: UuidSchema.nullable().default(null),
  location_id: UuidSchema.nullable().default(null),
  location_text: z.string().nullable().default(null),
  title: z.string(),
  job_description: z.string(),
  job_type: SjaJobTypeEnum,
  trigger_reason: z.string(),
  responsible_id: UuidSchema.nullable().default(null),
  scheduled_start: TimestampSchema.nullable().default(null),
  scheduled_end: TimestampSchema.nullable().default(null),
  actual_start: TimestampSchema.nullable().default(null),
  actual_end: TimestampSchema.nullable().default(null),
  status: SjaStatusEnum,
  stop_reason: z.string().nullable().default(null),
  debrief_notes: z.string().nullable().default(null),
  unexpected_hazards: z.boolean().nullable().default(null),
  debrief_completed_by: UuidSchema.nullable().default(null),
  debrief_completed_at: TimestampSchema.nullable().default(null),
  avvik_created: z.boolean(),
  deleted_at: TimestampSchema.nullable().default(null),
  created_by: UuidSchema.nullable().default(null),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const SjaParticipantSchema: z.ZodType<SjaParticipant> = z.object({
  id: UuidSchema,
  sja_id: UuidSchema,
  user_id: UuidSchema.nullable().default(null),
  name: z.string(),
  role: SjaParticipantRoleEnum,
  company: z.string().nullable().default(null),
  certs_verified: z.boolean(),
  certs_notes: z.string().nullable().default(null),
  signed_at: TimestampSchema.nullable().default(null),
  created_at: TimestampSchema,
})

export const SjaTaskSchema: z.ZodType<SjaTask> = z.object({
  id: UuidSchema,
  sja_id: UuidSchema,
  title: z.string(),
  description: z.string().nullable().default(null),
  position: z.number().int(),
  created_at: TimestampSchema,
})

export const SjaHazardSchema: z.ZodType<SjaHazard> = z.object({
  id: UuidSchema,
  sja_id: UuidSchema,
  task_id: UuidSchema,
  description: z.string(),
  category: SjaHazardCategoryEnum.nullable().default(null),
  initial_probability: z.number().int().min(1).max(5).nullable().default(null),
  initial_consequence: z.number().int().min(1).max(5).nullable().default(null),
  residual_probability: z.number().int().min(1).max(5).nullable().default(null),
  residual_consequence: z.number().int().min(1).max(5).nullable().default(null),
  chemical_ref: z.string().nullable().default(null),
  created_at: TimestampSchema,
})

export const SjaMeasureSchema: z.ZodType<SjaMeasure> = z.object({
  id: UuidSchema,
  sja_id: UuidSchema,
  hazard_id: UuidSchema,
  description: z.string(),
  control_type: SjaControlTypeEnum,
  assigned_to_id: UuidSchema.nullable().default(null),
  assigned_to_name: z.string().nullable().default(null),
  completed: z.boolean(),
  completed_at: TimestampSchema.nullable().default(null),
  created_at: TimestampSchema,
})
