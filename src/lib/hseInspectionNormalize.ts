import { buildDefaultInspectionConfig, DEFAULT_INSPECTION_CONFIG_VERSION } from '../data/hseInspectionDefaults'
import type {
  HseInspectionConfig,
  InspectionFieldAnswer,
  InspectionRun,
  InspectionTemplate,
  InspectionTemplateField,
} from '../types/inspectionModule'

const PHOTO_MAX = 2 * 1024 * 1024

export function normalizeTemplateField(raw: Partial<InspectionTemplateField> & { id: string }): InspectionTemplateField {
  return {
    id: raw.id,
    order: typeof raw.order === 'number' ? raw.order : 0,
    label: String(raw.label ?? ''),
    helpText: raw.helpText ? String(raw.helpText) : undefined,
    lawRef: raw.lawRef ? String(raw.lawRef) : undefined,
    fieldType: raw.fieldType ?? 'yes_no_na',
    required: Boolean(raw.required),
    min: raw.min != null ? Number(raw.min) : undefined,
    max: raw.max != null ? Number(raw.max) : undefined,
  }
}

export function normalizeTemplate(t: Partial<InspectionTemplate> & { id: string }): InspectionTemplate {
  const fields = Array.isArray(t.fields) ? t.fields.map((f) => normalizeTemplateField(f as InspectionTemplateField)) : []
  fields.sort((a, b) => a.order - b.order)
  return {
    id: t.id,
    name: String(t.name ?? 'Mal'),
    description: t.description ? String(t.description) : undefined,
    fields,
    createdAt: String(t.createdAt ?? new Date().toISOString()),
    updatedAt: String(t.updatedAt ?? new Date().toISOString()),
  }
}

export function normalizeInspectionConfig(raw: unknown): HseInspectionConfig {
  const base = buildDefaultInspectionConfig(new Date().toISOString())
  if (!raw || typeof raw !== 'object') {
    return base
  }
  const r = raw as Record<string, unknown>
  const templatesRaw = Array.isArray(r.templates) ? (r.templates as InspectionTemplate[]) : []
  const templates =
    templatesRaw.length > 0 ? templatesRaw.map((x) => normalizeTemplate(x)) : base.templates
  return {
    version: typeof r.version === 'number' ? r.version : DEFAULT_INSPECTION_CONFIG_VERSION,
    inspectionTypes: Array.isArray(r.inspectionTypes)
      ? (r.inspectionTypes as HseInspectionConfig['inspectionTypes'])
      : base.inspectionTypes,
    templates,
    locations: Array.isArray(r.locations) ? (r.locations as HseInspectionConfig['locations']) : base.locations,
    roleRules: Array.isArray(r.roleRules) ? (r.roleRules as HseInspectionConfig['roleRules']) : base.roleRules,
    statusFlow: Array.isArray(r.statusFlow) ? (r.statusFlow as HseInspectionConfig['statusFlow']) : base.statusFlow,
    schedules: Array.isArray(r.schedules) ? (r.schedules as HseInspectionConfig['schedules']) : base.schedules,
    deviationSeverities: Array.isArray(r.deviationSeverities)
      ? (r.deviationSeverities as HseInspectionConfig['deviationSeverities'])
      : base.deviationSeverities,
    configSourceNote: typeof r.configSourceNote === 'string' ? r.configSourceNote : base.configSourceNote,
  }
}

export function emptyAnswersForTemplate(tpl: InspectionTemplate): Record<string, InspectionFieldAnswer> {
  const out: Record<string, InspectionFieldAnswer> = {}
  for (const f of tpl.fields) {
    switch (f.fieldType) {
      case 'yes_no_na':
        out[f.id] = { type: 'yes_no_na', value: 'na' }
        break
      case 'text':
        out[f.id] = { type: 'text', value: '' }
        break
      case 'number':
        out[f.id] = { type: 'number', value: null }
        break
      case 'photo_required':
        out[f.id] = { type: 'photo_required', dataUrl: null }
        break
      case 'photo_optional':
        out[f.id] = { type: 'photo_optional', dataUrl: null }
        break
      default:
        out[f.id] = { type: 'text', value: '' }
    }
  }
  return out
}

export function validatePhotoDataUrl(dataUrl: string): { ok: true } | { ok: false; error: string } {
  if (!dataUrl.startsWith('data:')) return { ok: false, error: 'Ugyldig bilde' }
  const approx = (dataUrl.length * 3) / 4
  if (approx > PHOTO_MAX) return { ok: false, error: `Bilde for stort (maks ${PHOTO_MAX / 1024 / 1024} MB)` }
  return { ok: true }
}

export function normalizeRun(raw: InspectionRun): InspectionRun {
  return {
    ...raw,
    answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
    deviations: Array.isArray(raw.deviations) ? raw.deviations : [],
  }
}
