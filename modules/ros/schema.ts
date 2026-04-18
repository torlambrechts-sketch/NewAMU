import { z } from 'zod'

const LAW_DOMAINS = ['AML', 'BVL', 'ETL', 'FL', 'PKL'] as const
const ROS_TYPES   = ['general','org_change','fire','electrical','chemical','project'] as const
export const ROS_STATUSES = ['draft','in_review','approved','archived'] as const
const CONTROL_TYPES = ['eliminate','substitute','engineering','administrative','ppe'] as const

export const RosAnalysisUpsertSchema = z.object({
  id:               z.string().uuid().optional(),
  title:            z.string().min(1, 'Tittel er påkrevd'),
  description:      z.string().nullable().optional(),
  scope:            z.string().nullable().optional(),
  location_id:      z.string().uuid().nullable().optional(),
  location_text:    z.string().nullable().optional(),
  law_domains:      z.array(z.enum(LAW_DOMAINS)).min(1, 'Velg minst ett lovverk'),
  ros_type:         z.enum(ROS_TYPES).default('general'),
  assessor_name:    z.string().nullable().optional(),
  assessed_at:      z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  conclusion:       z.string().nullable().optional(),
})

export const RosHazardUpsertSchema = z.object({
  id:                   z.string().uuid().optional(),
  description:          z.string().min(1, 'Beskrivelse er påkrevd'),
  category:             z.string().nullable().optional(),
  law_domain:           z.enum(LAW_DOMAINS).default('AML'),
  existing_controls:    z.string().nullable().optional(),
  initial_probability:  z.number().int().min(1).max(5).nullable().optional(),
  initial_consequence:  z.number().int().min(1).max(5).nullable().optional(),
  residual_probability: z.number().int().min(1).max(5).nullable().optional(),
  residual_consequence: z.number().int().min(1).max(5).nullable().optional(),
  chemical_ref:         z.string().nullable().optional(),
})

export const RosMeasureUpsertSchema = z.object({
  id:               z.string().uuid().optional(),
  description:      z.string().min(1, 'Beskrivelse er påkrevd'),
  control_type:     z.enum(CONTROL_TYPES).default('administrative'),
  assigned_to_name: z.string().nullable().optional(),
  due_date:         z.string().nullable().optional(),
  status:           z.enum(['open','in_progress','completed','cancelled']).default('open'),
})

export type RosAnalysisUpsert = z.infer<typeof RosAnalysisUpsertSchema>
export type RosHazardUpsert   = z.infer<typeof RosHazardUpsertSchema>
export type RosMeasureUpsert  = z.infer<typeof RosMeasureUpsertSchema>
