// Compliance Layer module · Zod parsers for runtime validation.
//
// Mirrors `modules/compliance/schema.ts` shape (parseRows helper,
// per-row schema, lenient defaults). All seven tables + two views get
// a schema so the hooks can drop unparseable rows without crashing the
// UI on legacy data.

import { z } from 'zod'
import type {
  ComplianceEvidenceViewRow,
  ControlBindingRow,
  ControlClauseRow,
  ControlExecutionRow,
  ControlStatusViewRow,
  InternalControlRow,
  RegulationClauseRow,
} from './types'
import {
  CONTROL_BINDING_REQUIREMENT_KINDS,
  CONTROL_BINDING_SOURCE_KINDS,
  CONTROL_BINDING_SOURCE_TEMPLATE_TABLES,
  CONTROL_COVERAGE_LEVELS,
  CONTROL_FAMILIES,
  CONTROL_FREQUENCY_HINTS,
  CONTROL_STATUSES,
  CONTROL_STATUS_LABELS,
} from './types'

// ── Shared atoms ──────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid()
const TimestampSchema = z.string()
const JsonObjectSchema = z.record(z.string(), z.unknown()).default({})
const StringMapSchema = z.record(z.string(), z.string()).default({})

const ControlFamilySchema = z.enum(CONTROL_FAMILIES)
const ControlStatusSchema = z.enum(CONTROL_STATUSES)
const ControlCoverageLevelSchema = z.enum(CONTROL_COVERAGE_LEVELS)
const ControlBindingSourceKindSchema = z.enum(CONTROL_BINDING_SOURCE_KINDS)
const ControlBindingRequirementKindSchema = z.enum(
  CONTROL_BINDING_REQUIREMENT_KINDS,
)
const ControlBindingSourceTemplateTableSchema = z.enum(
  CONTROL_BINDING_SOURCE_TEMPLATE_TABLES,
)
const ControlFrequencyHintSchema = z.enum(CONTROL_FREQUENCY_HINTS)
const ControlStatusLabelSchema = z.enum(CONTROL_STATUS_LABELS)

// ── Tier 1 · regulation_clauses ──────────────────────────────────────────

export const RegulationClauseRowSchema: z.ZodType<RegulationClauseRow> =
  z.object({
    id: z.string().min(1),
    organization_id: UuidSchema,
    regulation_id: z.string().min(1),
    parent_clause_id: z.string().nullable().default(null),
    code: z.string().min(1),
    title: z.string().min(1),
    description: z.string().default(''),
    name_i18n: StringMapSchema,
    description_i18n: StringMapSchema,
    position: z.number().int().default(100),
    is_active: z.boolean().default(true),
    is_system: z.boolean().default(false),
    deleted_at: z.string().nullable().default(null),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })

// ── Tier 2 · internal_controls ────────────────────────────────────────────

export const InternalControlRowSchema: z.ZodType<InternalControlRow> = z.object(
  {
    id: UuidSchema,
    organization_id: UuidSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    name_i18n: StringMapSchema,
    purpose: z.string().default(''),
    purpose_i18n: StringMapSchema,
    control_family: ControlFamilySchema.default('preventive'),
    frequency_hint: ControlFrequencyHintSchema.nullable().default(null),
    owner_role: z.string().nullable().default(null),
    owner_user_id: UuidSchema.nullable().default(null),
    status: ControlStatusSchema.default('draft'),
    is_system: z.boolean().default(false),
    is_active: z.boolean().default(true),
    nav_pinned: z.boolean().default(false),
    metadata: JsonObjectSchema,
    deleted_at: z.string().nullable().default(null),
    created_by: UuidSchema.nullable().default(null),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  },
)

// ── Tier 2 · junction ────────────────────────────────────────────────────

export const ControlClauseRowSchema: z.ZodType<ControlClauseRow> = z.object({
  control_id: UuidSchema,
  clause_id: z.string().min(1),
  organization_id: UuidSchema,
  coverage_level: ControlCoverageLevelSchema.default('primary'),
  notes: z.string().default(''),
  created_by: UuidSchema.nullable().default(null),
  created_at: TimestampSchema,
})

// ── Tier 2 · bindings ────────────────────────────────────────────────────

export const ControlBindingRowSchema: z.ZodType<ControlBindingRow> = z.object({
  id: UuidSchema,
  control_id: UuidSchema,
  organization_id: UuidSchema,
  source_kind: ControlBindingSourceKindSchema,
  source_template_table: ControlBindingSourceTemplateTableSchema,
  source_template_id: z.string().default(''),
  source_template_slug: z.string().nullable().default(null),
  requirement_kind: ControlBindingRequirementKindSchema.default(
    'latest_within_cadence',
  ),
  cadence_hint: ControlFrequencyHintSchema.nullable().default(null),
  lead_time_days: z.number().int().nonnegative().default(30),
  required_count: z.number().int().positive().default(1),
  period_months: z.number().int().positive().default(12),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
  notes: z.string().default(''),
  metadata: JsonObjectSchema,
  is_system: z.boolean().default(false),
  deleted_at: z.string().nullable().default(null),
  created_by: UuidSchema.nullable().default(null),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

// ── Tier 2 · executions ──────────────────────────────────────────────────

export const ControlExecutionRowSchema: z.ZodType<ControlExecutionRow> =
  z.object({
    id: UuidSchema,
    control_id: UuidSchema,
    binding_id: UuidSchema.nullable().default(null),
    organization_id: UuidSchema,
    source_kind: ControlBindingSourceKindSchema,
    source_table: z.string().min(1),
    source_id: z.string().min(1),
    occurred_at: TimestampSchema,
    period_label: z.string().nullable().default(null),
    summary: z.string().nullable().default(null),
    evidence_url: z.string().nullable().default(null),
    signed_by: UuidSchema.nullable().default(null),
    signed_at: z.string().nullable().default(null),
    sha256_checksum: z.string().nullable().default(null),
    payload: JsonObjectSchema,
    created_by: UuidSchema.nullable().default(null),
    created_at: TimestampSchema,
  })

// ── Views ────────────────────────────────────────────────────────────────

export const ControlStatusViewRowSchema: z.ZodType<ControlStatusViewRow> =
  z.object({
    control_id: UuidSchema,
    organization_id: UuidSchema,
    slug: z.string(),
    name: z.string(),
    status: ControlStatusSchema,
    is_active: z.boolean(),
    frequency_hint: ControlFrequencyHintSchema.nullable().default(null),
    owner_role: z.string().nullable().default(null),
    owner_user_id: UuidSchema.nullable().default(null),
    last_occurred_at: z.string().nullable().default(null),
    total_executions: z.number().int().nonnegative().default(0),
    last12m_executions: z.number().int().nonnegative().default(0),
    next_due_at: z.string().nullable().default(null),
    status_label: ControlStatusLabelSchema,
  })

export const ComplianceEvidenceViewRowSchema: z.ZodType<ComplianceEvidenceViewRow> =
  z.object({
    organization_id: UuidSchema,
    occurred_at: TimestampSchema,
    source_kind: ControlBindingSourceKindSchema,
    source_table: z.string(),
    source_id: z.string(),
    title: z.string().default(''),
    law_refs: z.array(z.string()).default([]),
    signed_at: z.string().nullable().default(null),
  })

// ── parseRows helper (same shape as modules/compliance/schema.ts) ─────────

/**
 * Parse + filter an array of unknown rows. Failed rows are dropped
 * silently; the hook surfaces the count via a single error string if
 * any failed.
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
