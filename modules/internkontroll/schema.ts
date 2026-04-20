import { z } from 'zod'

export const IkLegalRegisterUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  law_code: z.enum(['AML', 'BVL', 'ETL', 'FL', 'PKL']),
  paragraph: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  applicable: z.boolean().default(true),
  deviation_note: z.string().nullable().optional(),
})

export const IkOrgRoleUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  role_key: z.string().min(1),
  display_name: z.string().min(1),
  law_basis: z.string().min(1),
  is_mandatory: z.boolean().default(true),
  assigned_to: z.string().uuid().nullable().optional(),
  assigned_name: z.string().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const IkCompetenceRequirementSchema = z.object({
  id: z.string().uuid().optional(),
  role_key: z.string().min(1),
  display_name: z.string().min(1),
  cert_name: z.string().min(1),
  law_basis: z.string().nullable().optional(),
  is_hard_gate: z.boolean().default(false),
  validity_months: z.number().int().positive().nullable().optional(),
})

export const IkCompetenceRecordSchema = z.object({
  id: z.string().uuid().optional(),
  requirement_id: z.string().uuid(),
  user_id: z.string().uuid().nullable().optional(),
  user_name: z.string().min(1),
  issued_at: z.string(),
  expires_at: z.string().nullable().optional(),
  issuer: z.string().nullable().optional(),
  document_url: z.string().url().nullable().optional(),
  is_verified: z.boolean().default(false),
})

export const IkHseGoalSchema = z.object({
  id: z.string().uuid().optional(),
  year: z.number().int().min(2020).max(2099),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  goal_type: z.enum(['lagging', 'leading']),
  target_value: z.number().nullable().optional(),
  target_unit: z.string().nullable().optional(),
  law_pillar: z.enum(['AML', 'BVL', 'ETL', 'FL', 'PKL']).nullable().optional(),
  owner_name: z.string().nullable().optional(),
  status: z.enum(['active', 'achieved', 'missed', 'cancelled']).default('active'),
})

export const IkActionPlanSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  source: z.enum(['manual', 'ros', 'avvik', 'inspection', 'annual_review']).default('manual'),
  source_id: z.string().uuid().nullable().optional(),
  law_pillar: z.enum(['AML', 'BVL', 'ETL', 'FL', 'PKL']).nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
  due_date: z.string().nullable().optional(),
  assigned_name: z.string().nullable().optional(),
})

export type IkLegalRegisterUpsert = z.infer<typeof IkLegalRegisterUpsertSchema>
export type IkOrgRoleUpsert = z.infer<typeof IkOrgRoleUpsertSchema>
export type IkCompetenceRequirement = z.infer<typeof IkCompetenceRequirementSchema>
export type IkCompetenceRecord = z.infer<typeof IkCompetenceRecordSchema>
export type IkHseGoal = z.infer<typeof IkHseGoalSchema>
export type IkActionPlan = z.infer<typeof IkActionPlanSchema>

/** § 5.8 — evaluering av fjorårets mål, avvik og inspeksjoner */
export const IkAnnualReviewEvaluationSchema = z.object({
  goals_review: z.string().default(''),
  incidents_review: z.string().default(''),
  /** Fritekst om resultat av gjennomgang av systemet */
  system_effectiveness: z.string().default(''),
})

/** Mål og tiltak for kommende år (strukturert JSONB) */
export const IkAnnualReviewNewGoalsSchema = z.object({
  goals_text: z.string().default(''),
  improvement_notes: z.string().default(''),
})

export const IkAnnualReviewStatusSchema = z.enum(['draft', 'signed', 'archived'])

/** Validering av kjernefeltene ved lagring (kladd) */
export const AnnualReviewSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  summary: z.string().nullable().optional(),
  evaluation: IkAnnualReviewEvaluationSchema,
  newGoals: IkAnnualReviewNewGoalsSchema,
  conducted_by: z.string().uuid().nullable().optional(),
})

export type IkAnnualReviewEvaluation = z.infer<typeof IkAnnualReviewEvaluationSchema>
export type IkAnnualReviewNewGoals = z.infer<typeof IkAnnualReviewNewGoalsSchema>
export type AnnualReviewDraft = z.infer<typeof AnnualReviewSchema>

/** Admin: hvem som må signere årlig gjennomgang */
export const IkAnnualReviewModuleSettingsSchema = z.object({
  require_manager_signature: z.boolean().default(true),
  require_deputy_signature: z.boolean().default(true),
})

export type IkAnnualReviewModuleSettings = z.infer<typeof IkAnnualReviewModuleSettingsSchema>
