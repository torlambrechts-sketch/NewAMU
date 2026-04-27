import { z } from 'zod'

/** How a question is presented and stored (aligns with `org_survey_questions`). */
export const CatalogScaleTypeSchema = z.enum(['1-5', '1-7', '0-10', '1-10'])
export type CatalogScaleType = z.infer<typeof CatalogScaleTypeSchema>

export const CatalogQuestionTypeSchema = z.enum([
  'text',
  'likert_5',
  'likert_7',
  'scale_10',
  'yes_no',
  'single_select',
  'multi_select',
  'multiple_choice',
])
export type CatalogQuestionType = z.infer<typeof CatalogQuestionTypeSchema>

export const CatalogTemplateQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: CatalogQuestionTypeSchema,
  required: z.boolean().default(true),
  subscale: z.string().optional(),
  anchors: z.object({ low: z.string(), high: z.string() }).optional(),
  options: z.array(z.string()).optional(),
  scale: CatalogScaleTypeSchema.optional(),
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
  body: CatalogTemplateBodySchema,
  is_active: z.boolean().default(true),
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
