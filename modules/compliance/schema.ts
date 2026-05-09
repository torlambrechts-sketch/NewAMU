// Compliance Checklist primitive — Zod schemas for runtime validation of
// rows fetched from Supabase. Failed rows are filtered out by the hook;
// definition jsonb is parsed lazily by parseChecklistDefinition.

import { z } from 'zod'
import type {
  ChecklistCommentRow,
  ChecklistDefinition,
  ChecklistItem,
  ComplianceCategoryRow,
  ComplianceExecutionRow,
  ComplianceRequirementRow,
  ComplianceResponseRow,
  ComplianceTemplateRequirementRow,
  ComplianceTemplateRow,
  TemplateMetadataField,
  TemplateMetadataSchema,
} from './types'

// ── Definition (jsonb) ──────────────────────────────────────────────────────

const ChecklistItemSchema: z.ZodType<ChecklistItem> = z.object({
  key: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(['yes_no_na', 'text', 'number', 'photo', 'signature', 'date']),
  required: z.boolean().optional(),
  law_ref: z.string().optional(),
  iso_clause: z.string().optional(),
  severity_default: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  help: z.string().optional(),
  requirement_slugs: z.array(z.string()).optional(),
})

const ChecklistDefinitionSchema: z.ZodType<ChecklistDefinition> = z.object({
  items: z.array(ChecklistItemSchema).default([]),
})

export function parseChecklistDefinition(input: unknown): ChecklistDefinition {
  const parsed = ChecklistDefinitionSchema.safeParse(input)
  return parsed.success ? parsed.data : { items: [] }
}

// ── Template metadata schema ───────────────────────────────────────────────
// Forgiving: unknown kinds are dropped, missing fields[] returns []. This
// keeps ChecklistsAnalysePage / TemplateEditor robust to older rows.

const METADATA_KINDS = new Set([
  'location',
  'department',
  'team',
  'participants',
  'text',
  'number',
  'select',
])

const TemplateMetadataFieldSchema: z.ZodType<TemplateMetadataField> = z.object({
  key: z.string().min(1),
  kind: z.enum(['location', 'department', 'team', 'participants', 'text', 'number', 'select']),
  label: z.string().optional(),
  help: z.string().optional(),
  required: z.boolean().optional(),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional(),
})

const TemplateMetadataSchemaSchema: z.ZodType<TemplateMetadataSchema> = z.object({
  fields: z.array(TemplateMetadataFieldSchema).default([]),
})

export function parseMetadataSchema(input: unknown): TemplateMetadataSchema {
  if (input == null || typeof input !== 'object') return { fields: [] }
  // First try strict — happy path.
  const strict = TemplateMetadataSchemaSchema.safeParse(input)
  if (strict.success) return strict.data
  // Fall back: walk the array and keep only the rows that parse, so a
  // single corrupt field doesn't lose the whole template.
  const obj = input as { fields?: unknown }
  if (!Array.isArray(obj.fields)) return { fields: [] }
  const ok: TemplateMetadataField[] = []
  for (const row of obj.fields) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.key !== 'string' || typeof r.kind !== 'string') continue
    if (!METADATA_KINDS.has(r.kind)) continue
    const parsed = TemplateMetadataFieldSchema.safeParse(r)
    if (parsed.success) ok.push(parsed.data)
  }
  return { fields: ok }
}

// ── Rows ────────────────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid()
const TimestampSchema = z.string()

const PackSchema = z.enum(['aml-amu', 'iso-45001'])
const StatusSchema = z.enum(['draft', 'active', 'signed'])
const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

export const ComplianceTemplateRowSchema: z.ZodType<ComplianceTemplateRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  pack: PackSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  definition: z.unknown(),
  is_active: z.boolean(),
  // Default false / 'draft' so older DB instances (without the migration) still parse.
  nav_pinned: z.boolean().default(false),
  is_system: z.boolean().default(false),
  review_status: z.enum(['draft', 'reviewed', 'approved']).default('draft'),
  cadence_hint: z.string().nullable().default(null),
  category_id: z.string().uuid().nullable().default(null),
  metadata_schema: z
    .unknown()
    .transform((u) => parseMetadataSchema(u))
    .default({ fields: [] }),
  deleted_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const ComplianceCategoryRowSchema: z.ZodType<ComplianceCategoryRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  pack: PackSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false),
  deleted_at: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const ComplianceExecutionRowSchema: z.ZodType<ComplianceExecutionRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  template_id: UuidSchema,
  pack: PackSchema,
  title: z.string(),
  status: StatusSchema,
  assigned_to: z.string().uuid().nullable(),
  scheduled_for: z.string().nullable(),
  signed_at: z.string().nullable(),
  signed_by: z.string().uuid().nullable(),
  definition_snapshot: z.unknown(),
  sign_checksum: z.string().nullable().default(null),
  archived_at: z.string().nullable().default(null),
  archived_by: z.string().uuid().nullable().default(null),
  summary: z.string().nullable(),
  attendees: z.array(z.string()).default([]),
  location_id: z.string().uuid().nullable().default(null),
  department_id: z.string().uuid().nullable().default(null),
  team_id: z.string().uuid().nullable().default(null),
  participant_member_ids: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  scope_type: z.enum(['location', 'catalogue_item', 'other']).nullable().default(null),
  scope_catalogue_item_label: z.string().nullable().default(null),
  scope_other_label: z.string().nullable().default(null),
  deleted_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const ComplianceResponseRowSchema: z.ZodType<ComplianceResponseRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  execution_id: UuidSchema,
  item_key: z.string(),
  value: z.unknown(),
  comment: z.string().nullable(),
  severity: SeveritySchema.nullable(),
  is_finding: z.boolean(),
  deviation_id: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

// ── Requirements taxonomy ──────────────────────────────────────────────────

export const ComplianceRequirementRowSchema: z.ZodType<ComplianceRequirementRow> =
  z.object({
    id: UuidSchema,
    organization_id: z.string().uuid().nullable(),
    pack: PackSchema,
    slug: z.string(),
    code: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    is_system: z.boolean(),
    is_active: z.boolean(),
    deleted_at: z.string().nullable(),
    created_by: z.string().uuid().nullable(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })

export const ComplianceTemplateRequirementRowSchema: z.ZodType<ComplianceTemplateRequirementRow> =
  z.object({
    template_id: UuidSchema,
    requirement_id: UuidSchema,
    organization_id: UuidSchema,
    created_by: z.string().uuid().nullable(),
    created_at: TimestampSchema,
  })

export const ChecklistCommentRowSchema: z.ZodType<ChecklistCommentRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  execution_id: UuidSchema,
  item_key: z.string().nullable(),
  body: z.string(),
  author_id: UuidSchema,
  author_name: z.string(),
  mentions: z.array(UuidSchema).default([]),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse + filter an array of unknown rows. Failed rows are dropped silently;
 * the hook surfaces the count via a single error string if any failed.
 */
export function parseRows<T>(
  rows: unknown[],
  schema: z.ZodType<T>,
): { ok: T[]; failed: number } {
  const ok: T[] = []
  let failed = 0
  for (const row of rows) {
    const parsed = schema.safeParse(row)
    if (parsed.success) ok.push(parsed.data)
    else failed += 1
  }
  return { ok, failed }
}
