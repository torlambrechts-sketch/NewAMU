import { z } from 'zod'
import {
  CatalogTemplateBodySchema,
  type CatalogTemplateBody,
  type SurveyTemplateCatalogRow,
} from '../../modules/survey/surveyTemplateCatalogTypes'

/** Matches export format used elsewhere (`klarert-*-export-v1`). */
export const SURVEY_ORG_TEMPLATE_EXPORT_VERSION = 'klarert-survey-org-template-export-v1' as const

export type SurveyOrgTemplateExportPayload = {
  version: typeof SURVEY_ORG_TEMPLATE_EXPORT_VERSION
  exportedAt: string
  template: {
    name: string
    short_name: string | null
    description: string | null
    category: string
    audience: 'internal' | 'external' | 'both'
    estimated_minutes: number
    recommend_anonymous: boolean
    scoring_note: string | null
    law_ref: string | null
    body: CatalogTemplateBody
  }
}

const TemplateExportInnerSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().min(1),
  audience: z.enum(['internal', 'external', 'both']),
  estimated_minutes: z.number().int().min(1).optional(),
  recommend_anonymous: z.boolean().optional(),
  scoring_note: z.string().nullable().optional(),
  law_ref: z.string().nullable().optional(),
  body: CatalogTemplateBodySchema,
})

const PayloadSchema = z.object({
  version: z.literal(SURVEY_ORG_TEMPLATE_EXPORT_VERSION),
  exportedAt: z.string().optional(),
  template: TemplateExportInnerSchema,
})

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function newLocalId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Normaliserer `body.questions` (manglende `id` fylles inn) og validerer mot katalog-skjemaet.
 */
export function parseSurveyOrgTemplateExport(json: unknown): SurveyOrgTemplateExportPayload | null {
  if (!isRecord(json)) return null
  if (json.version !== SURVEY_ORG_TEMPLATE_EXPORT_VERSION) return null
  if (!isRecord(json.template)) return null
  const bodyRaw = json.template.body
  if (!isRecord(bodyRaw) || !Array.isArray(bodyRaw.questions)) return null

  const questions = (bodyRaw.questions as unknown[]).map((q) => {
    if (!isRecord(q)) return { id: newLocalId(), text: '', type: 'text' as const, required: true }
    const id = typeof q.id === 'string' && q.id.trim() ? q.id : newLocalId()
    return { ...q, id }
  })

  const candidate = {
    ...json,
    template: {
      ...json.template,
      body: { ...bodyRaw, version: typeof bodyRaw.version === 'number' ? bodyRaw.version : 1, questions },
    },
  }

  const r = PayloadSchema.safeParse(candidate)
  if (!r.success) return null

  const t = r.data.template
  return {
    version: SURVEY_ORG_TEMPLATE_EXPORT_VERSION,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : new Date().toISOString(),
    template: {
      name: t.name,
      short_name: t.short_name ?? null,
      description: t.description ?? null,
      category: t.category,
      audience: t.audience,
      estimated_minutes: t.estimated_minutes ?? 5,
      recommend_anonymous: t.recommend_anonymous ?? true,
      scoring_note: t.scoring_note ?? null,
      law_ref: t.law_ref ?? null,
      body: t.body,
    },
  }
}

export function buildSurveyOrgTemplateExport(tpl: SurveyTemplateCatalogRow): SurveyOrgTemplateExportPayload {
  return {
    version: SURVEY_ORG_TEMPLATE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    template: {
      name: tpl.name,
      short_name: tpl.short_name ?? null,
      description: tpl.description ?? null,
      category: tpl.category,
      audience: tpl.audience,
      estimated_minutes: tpl.estimated_minutes,
      recommend_anonymous: tpl.recommend_anonymous,
      scoring_note: tpl.scoring_note ?? null,
      law_ref: tpl.law_ref ?? null,
      body: tpl.body,
    },
  }
}
