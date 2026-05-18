// Studio block model shared by the palette, canvas, and property panel.
//
// Kept separate from surveyTemplateCatalogTypes so the same block
// primitives can later be reused for documents, learning, and checklist
// templates without pulling in survey-specific Zod schemas.

import { z } from 'zod'
import { CatalogQuestionTypeSchema, CatalogScaleTypeSchema } from '../survey/surveyTemplateCatalogTypes'

// ─── Block schemas ────────────────────────────────────────────────────────────

export const StudioSectionBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('section'),
  title: z.string().default(''),
  description: z.string().optional(),
})

export const StudioQuestionBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('question'),
  questionType: CatalogQuestionTypeSchema,
  text: z.string().default(''),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  scale: CatalogScaleTypeSchema.optional(),
  anchors: z.object({ low: z.string(), high: z.string() }).optional(),
  law_ref: z.string().optional(),
  subscale: z.string().optional(),
})

export const StudioBranchConditionSchema = z.object({
  sourceBlockId: z.string(),
  operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq', 'answered']),
  value: z.union([z.string(), z.number()]).optional(),
  targetBlockId: z.string().optional(),
})

export const StudioBranchBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('branch'),
  label: z.string().default(''),
  condition: StudioBranchConditionSchema,
})

export const StudioBlockSchema = z.discriminatedUnion('kind', [
  StudioSectionBlockSchema,
  StudioQuestionBlockSchema,
  StudioBranchBlockSchema,
])

export type StudioSectionBlock = z.infer<typeof StudioSectionBlockSchema>
export type StudioQuestionBlock = z.infer<typeof StudioQuestionBlockSchema>
export type StudioBranchBlock = z.infer<typeof StudioBranchBlockSchema>
export type StudioBlock = z.infer<typeof StudioBlockSchema>
export type StudioBlockKind = StudioBlock['kind']

// ─── Palette item (for left panel) ───────────────────────────────────────────

export type PaletteItem = {
  kind: StudioBlockKind
  /** Question type when kind === 'question'; undefined otherwise */
  questionType?: StudioQuestionBlock['questionType']
  label: string
  hint: string
  advancedOnly?: boolean
}

export const SURVEY_PALETTE: PaletteItem[] = [
  { kind: 'section', label: 'Seksjon', hint: 'Kapitteloverskrift' },
  { kind: 'question', questionType: 'single_select', label: 'Enkeltvalg', hint: 'Velg ett svar' },
  { kind: 'question', questionType: 'multi_select', label: 'Flervalg', hint: 'Velg flere svar' },
  { kind: 'question', questionType: 'likert_5', label: 'Skala', hint: 'Likert 1–5' },
  { kind: 'question', questionType: 'text', label: 'Fritekst', hint: 'Åpent svar' },
  // Advanced only
  { kind: 'branch', label: 'Forgrening', hint: 'Betinget flyt', advancedOnly: true },
  { kind: 'question', questionType: 'yes_no', label: 'Ja / Nei', hint: 'To alternativ', advancedOnly: true },
  { kind: 'question', questionType: 'likert_7', label: 'Skala 1–7', hint: 'Utvidet Likert', advancedOnly: true },
  { kind: 'question', questionType: 'scale_10', label: 'Skala 0–10', hint: 'NPS-stil', advancedOnly: true },
  { kind: 'question', questionType: 'matrix', label: 'Matrise', hint: 'Rader × kolonner', advancedOnly: true },
  { kind: 'question', questionType: 'ranking', label: 'Rangering', hint: 'Sorter alternativ', advancedOnly: true },
  { kind: 'question', questionType: 'voting', label: 'Votering', hint: 'For / Mot / Avhold', advancedOnly: true },
]

// ─── Save state ───────────────────────────────────────────────────────────────

// Distributive Omit — strips 'id' from each member of the union individually.
// Plain Omit<StudioBlock, 'id'> collapses to the intersection of all members,
// losing the discriminant and making object literals unsound.
export type NewStudioBlock = StudioBlock extends infer T
  ? T extends StudioBlock
    ? Omit<T, 'id'>
    : never
  : never

export type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error'
