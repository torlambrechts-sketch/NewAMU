// Compliance Layer — 3-Tier Architecture row types.
//
// Mirrors the seven Tier-1/2/3 tables + two views introduced in
// migrations 20260926120000…20260926120600. The types live here (and not
// inside `modules/compliance-layer/`) so other surfaces — gap planner,
// HMS overview composite, auditor view — can import without pulling the
// module's runtime deps.
//
// Conventions:
//   - All enums declared as `as const` arrays + derived union type so
//     `parseRows` Zod schemas in the module can lean on the same source.
//   - Row types are nominal (one shape per DB table). View rows are
//     suffixed with `…ViewRow`.
//   - `text` columns surface as `string`; `text[]` as `string[]`; `jsonb`
//     as `Record<string, unknown>` unless the column has a stable shape.

import type { CompliancePackSlug } from '../../modules/compliance/types'

// ── Enums ─────────────────────────────────────────────────────────────────

export const CONTROL_FAMILIES = [
  'preventive',
  'detective',
  'corrective',
  'directive',
] as const
export type ControlFamily = (typeof CONTROL_FAMILIES)[number]

export const CONTROL_STATUSES = ['draft', 'active', 'retired'] as const
export type ControlStatus = (typeof CONTROL_STATUSES)[number]

export const CONTROL_COVERAGE_LEVELS = [
  'primary',
  'supporting',
  'partial',
] as const
export type ControlCoverageLevel = (typeof CONTROL_COVERAGE_LEVELS)[number]

export const CONTROL_BINDING_SOURCE_KINDS = [
  'compliance_execution',
  'survey_response',
  'document_acknowledgement',
  'learning_completion',
  'task_completion',
  'meeting_protocol',
  'register_record',
  'manual_evidence',
] as const
export type ControlBindingSourceKind =
  (typeof CONTROL_BINDING_SOURCE_KINDS)[number]

export const CONTROL_BINDING_REQUIREMENT_KINDS = [
  'latest_within_cadence',
  'count_within_period',
  'exists',
  'signed',
] as const
export type ControlBindingRequirementKind =
  (typeof CONTROL_BINDING_REQUIREMENT_KINDS)[number]

export const CONTROL_BINDING_SOURCE_TEMPLATE_TABLES = [
  'compliance_checklist_templates',
  'survey_template_catalog',
  'surveys',
  'survey_campaigns',
  'document_system_templates',
  'document_org_templates',
  'learning_courses',
  'task_template_catalog',
  'task_org_templates',
  'meeting_system_templates',
  'meeting_org_templates',
  'register_types',
  '',
] as const
export type ControlBindingSourceTemplateTable =
  (typeof CONTROL_BINDING_SOURCE_TEMPLATE_TABLES)[number]

export const CONTROL_FREQUENCY_HINTS = [
  'arlig',
  'halvarlig',
  'kvartalsvis',
  'manedlig',
  'ukentlig',
  'daglig',
  'ad_hoc',
] as const
export type ControlFrequencyHint = (typeof CONTROL_FREQUENCY_HINTS)[number]

export const CONTROL_STATUS_LABELS = [
  'on_track',
  'due_soon',
  'overdue',
  'never_executed',
  'retired',
] as const
export type ControlStatusLabel = (typeof CONTROL_STATUS_LABELS)[number]

// ── Tier 1 · regulation_clauses ──────────────────────────────────────────

/**
 * Paragraph-level clause. Composite-PK `(organization_id, id)` mirrors
 * the `regulations` table. `code` carries the exact display string
 * (`'AML § 3-1'`) that matches `law_refs[]` entries on every existing
 * template surface.
 */
export type RegulationClauseRow = {
  id: string
  organization_id: string
  regulation_id: string
  parent_clause_id: string | null
  code: string
  title: string
  description: string
  name_i18n: Record<string, string>
  description_i18n: Record<string, string>
  position: number
  is_active: boolean
  is_system: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ── Tier 2 · internal_controls ────────────────────────────────────────────

/**
 * Named per-org control. The first-class entity decoupling rules from
 * proof. Cross-pack reuse via `internal_control_clauses` junction.
 */
export type InternalControlRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  name_i18n: Record<string, string>
  purpose: string
  purpose_i18n: Record<string, string>
  control_family: ControlFamily
  /** `arlig` / `halvarlig` / `kvartalsvis` / `manedlig` / `ukentlig` / `daglig` / `ad_hoc` — or null for cadence-free controls. */
  frequency_hint: ControlFrequencyHint | null
  owner_role: string | null
  owner_user_id: string | null
  status: ControlStatus
  is_system: boolean
  is_active: boolean
  nav_pinned: boolean
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Tier 2 · internal_control_clauses (junction) ─────────────────────────

/**
 * Junction: one control satisfies many clauses (cross-framework).
 * `coverage_level` distinguishes the main mechanism (`primary`) from
 * contributing controls (`supporting`/`partial`).
 */
export type ControlClauseRow = {
  control_id: string
  clause_id: string
  organization_id: string
  coverage_level: ControlCoverageLevel
  notes: string
  created_by: string | null
  created_at: string
}

// ── Tier 2 · internal_control_bindings ────────────────────────────────────

/**
 * Declarative spec: which module artefact counts as proof for a control.
 * Polymorphic over the seven module template surfaces. Resolver in
 * M5 (`_compliance_layer_record_execution`) reads these to auto-stamp
 * executions on sign events.
 */
export type ControlBindingRow = {
  id: string
  control_id: string
  organization_id: string
  source_kind: ControlBindingSourceKind
  source_template_table: ControlBindingSourceTemplateTable
  source_template_id: string
  source_template_slug: string | null
  requirement_kind: ControlBindingRequirementKind
  cadence_hint: ControlFrequencyHint | null
  lead_time_days: number
  required_count: number
  period_months: number
  is_required: boolean
  is_active: boolean
  notes: string
  metadata: Record<string, unknown>
  is_system: boolean
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Tier 2 · internal_control_executions ─────────────────────────────────

/**
 * Append-only proof row. Inserted by auto-bind triggers on module sign
 * events. Unique partial index on (control_id, source_table, source_id)
 * enforces idempotency. BEFORE UPDATE/DELETE trigger denies mutation.
 */
export type ControlExecutionRow = {
  id: string
  control_id: string
  binding_id: string | null
  organization_id: string
  source_kind: ControlBindingSourceKind
  source_table: string
  source_id: string
  occurred_at: string
  period_label: string | null
  summary: string | null
  evidence_url: string | null
  signed_by: string | null
  signed_at: string | null
  sha256_checksum: string | null
  payload: Record<string, unknown>
  created_by: string | null
  created_at: string
}

// ── Tier 2 · internal_control_status_v (view) ────────────────────────────

/**
 * Live computed status per control. Drives the controls list page,
 * hub tile colours and the KPI widget. `next_due_at` is null for
 * cadence-less (`ad_hoc`) controls.
 */
export type ControlStatusViewRow = {
  control_id: string
  organization_id: string
  slug: string
  name: string
  status: ControlStatus
  is_active: boolean
  frequency_hint: ControlFrequencyHint | null
  owner_role: string | null
  owner_user_id: string | null
  last_occurred_at: string | null
  total_executions: number
  last12m_executions: number
  next_due_at: string | null
  status_label: ControlStatusLabel
}

// ── Tier 3 · compliance_evidence_v (view) ────────────────────────────────

/**
 * Read-only union over module execution surfaces. Powers "Bevisjournal"
 * tabs and the compliance-planner evidence ledger. RLS inherits from
 * base tables.
 */
export type ComplianceEvidenceViewRow = {
  organization_id: string
  occurred_at: string
  source_kind: ControlBindingSourceKind
  source_table: string
  source_id: string
  title: string
  law_refs: string[]
  signed_at: string | null
}

// ── Re-exported compliance pack type for convenience ─────────────────────

export type { CompliancePackSlug }

// ── KPI aggregate (matches the analyse-page dataset shape) ───────────────

export type ComplianceLayerKpiSummary = {
  total: number
  active: number
  overdue: number
  due_soon: number
  on_track: number
  never_executed: number
}
