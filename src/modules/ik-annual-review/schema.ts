import { z } from 'zod'

/** § 5.8 — evaluering av fjorårets mål, avvik og inspeksjoner */
export const IkAnnualReviewEvaluationSchema = z.object({
  goals_review: z.string().default(''),
  incidents_review: z.string().default(''),
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
