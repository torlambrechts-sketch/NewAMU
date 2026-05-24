import { z } from 'zod'

/** How a question is presented and stored (aligns with `org_survey_questions`). */
export const CatalogScaleTypeSchema = z.enum(['1-5', '1-7', '0-10', '1-10'])
export type CatalogScaleType = z.infer<typeof CatalogScaleTypeSchema>

export const CatalogQuestionTypeSchema = z.enum([
  'text',
  'short_text',
  'long_text',
  'email',
  'number',
  'likert_5',
  'likert_7',
  'scale_10',
  'yes_no',
  'single_select',
  'multi_select',
  'multiple_choice',
  'dropdown',
  'image_choice',
  'rating_visual',
  'slider',
  'likert_scale',
  'matrix',
  'ranking',
  'nps',
  'file_upload',
  'datetime',
  'signature',
  'photo',
  'respondent_signature',
  // Compliance-driven additions (specs/aml-survey-content.md §2):
  'voting',         // For/Mot/Avhold with role-tagged tally (AMU paritetisk)
  'consent',        // Explicit GDPR Art. 7 consent gate before demographic items
  'traffic_light',  // Green/yellow/red semantic with dashboard color render
  'priority_top3',  // Pick + rank top three from option list
])
export type CatalogQuestionType = z.infer<typeof CatalogQuestionTypeSchema>

export const CatalogTemplateQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: CatalogQuestionTypeSchema,
  required: z.boolean().default(true),
  /** Lovkrav — eksplisitt fra mal; erstatter tekstanalyse */
  is_mandatory: z.boolean().optional(),
  /**
   * @deprecated Use law_ref (free text). Retained for backward compat with
   * existing catalog rows that carry one of the original three enum values.
   */
  mandatory_law: z
    .enum(['AML_4_3', 'AML_4_3_3', 'AML_4_4', 'AML_4_1_3', 'AML_6_2', 'LDL_26'])
    .optional(),
  /** Free-text legal reference per question — same shape as compliance items. */
  law_ref: z.string().optional(),
  subscale: z.string().optional(),
  anchors: z.object({ low: z.string(), high: z.string() }).optional(),
  options: z.array(z.string()).optional(),
  scale: CatalogScaleTypeSchema.optional(),
  rows: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  items: z.array(z.string()).optional(),
})
export type CatalogTemplateQuestion = z.infer<typeof CatalogTemplateQuestionSchema>

export const CatalogTemplateBodySchema = z.object({
  version: z.number().int().min(1).default(1),
  questions: z.array(CatalogTemplateQuestionSchema).default([]),
})
export type CatalogTemplateBody = z.infer<typeof CatalogTemplateBodySchema>

export const CatalogRowForListSchema = z.object({
  id: z.string(),
  organization_id: z.string().uuid().nullable().optional(),
  is_system: z.boolean(),
  name: z.string(),
  short_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  use_case: z.string().nullable().optional(),
  category: z.string(),
  audience: z.enum(['internal', 'external', 'both']),
  estimated_minutes: z.number().int().min(1).default(5),
  recommend_anonymous: z.boolean().default(true),
  scoring_note: z.string().nullable().optional(),
  law_ref: z.string().nullable().optional(),
  law_refs: z.array(z.string()).nullable().optional(),
  body: CatalogTemplateBodySchema,
  is_active: z.boolean().default(true),
  pack: z.enum(['vendor', 'arbeidsmiljo', 'compliance', 'engagement', 'exit']).default('engagement'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type SurveyTemplateCatalogRow = z.infer<typeof CatalogRowForListSchema>

export function parseCatalogRow(
  raw: unknown,
): { success: true; data: SurveyTemplateCatalogRow } | { success: false } {
  const r = CatalogRowForListSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export const TEMPLATE_CATEGORIES: { id: string; label: string; description: string }[] = [
  { id: 'wellbeing', label: 'Trivsel og velvære', description: 'Burnout, arbeidsengasjement' },
  { id: 'engagement', label: 'Engasjement', description: 'eNPS, lojalitet' },
  { id: 'safety', label: 'Trygghet / HMS', description: 'HMS-klima, psykologisk trygghet' },
  { id: 'performance', label: 'Team og ytelse', description: 'Samarbeid, klarhet' },
  { id: 'custom', label: 'Egendefinert', description: 'Egenbygde maler' },
  { id: 'vendor', label: 'Leverandør', description: 'Egenerklæring, underleverandør' },
  { id: 'compliance', label: 'Samsvar', description: 'Etikk, åpenhetsloven' },
]
