// Compliance Checklist primitive — TypeScript row types.
// Mirrors public.compliance_checklist_* tables. Definition jsonb is unknown
// here; parsed via Zod in schema.ts.

export type CompliancePackSlug = 'aml-amu' | 'iso-45001' | 'iso-9001' | 'iso-14001' | 'iso-27001'

export type ComplianceChecklistStatus = 'draft' | 'active' | 'signed'

/** Reuses public.inspection_finding_severity in the database. */
export type ComplianceSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ChecklistItemType =
  | 'yes_no_na'
  | 'text'
  | 'number'
  | 'photo'
  | 'signature'
  | 'date'

export type ChecklistItem = {
  key: string
  prompt: string
  type: ChecklistItemType
  required?: boolean
  /** Norwegian law reference, e.g. "AML §4-1, §4-4" — AML pack only */
  law_ref?: string
  /** ISO 45001 clause, e.g. "9.2" — ISO pack only */
  iso_clause?: string
  /** Default severity when this item is flagged as a finding */
  severity_default?: ComplianceSeverity
  /** Inspector-facing help text */
  help?: string
  /**
   * Compliance requirement slugs this item satisfies. References
   * compliance_requirements.slug — system slugs (e.g. "aml-3-1") or
   * org-defined slugs. Optional; primary tagging is template-level via
   * compliance_template_requirements.
   */
  requirement_slugs?: string[]
  /** Optional section/group label for UI grouping within the fill-in canvas. */
  section?: string
}

export type ChecklistDefinition = {
  items: ChecklistItem[]
}

export type ComplianceTemplateRow = {
  id: string
  organization_id: string
  pack: CompliancePackSlug
  slug: string
  name: string
  description: string | null
  /** Raw jsonb — parse with parseChecklistDefinition */
  definition: unknown
  is_active: boolean
  /** Pinned to the "Sjekklister" sidebar group when true. */
  nav_pinned: boolean
  /** Platform-shipped baseline template. Cannot be hard-deleted (DB trigger). */
  is_system: boolean
  /** Legal-review provenance flag — admin badge surfaces this so customers
   *  can see whether a template has been independently verified. */
  review_status: 'draft' | 'reviewed' | 'approved'
  /** Non-binding cadence suggestion (e.g. "kvartalsvis", "årlig"). */
  cadence_hint: string | null
  /** Optional grouping inside a pack (admin-defined). Null = "Uten kategori". */
  category_id: string | null
  /** Field declarations that drive the execution metadata editor — see TemplateMetadataSchema. */
  metadata_schema: TemplateMetadataSchema
  /** Legal/regulatory references this template addresses, e.g. ["AML § 3-1", "IK § 5"]. */
  law_refs: string[]
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Per-template metadata field declarations. Drives ExecutionMetadataPanel
 * + the create form. See migration 20260828120024 for the rationale.
 */
export type TemplateMetadataFieldKind =
  | 'location'      // bound to executions.location_id
  | 'department'    // bound to executions.department_id
  | 'team'          // bound to executions.team_id
  | 'participants'  // bound to executions.participant_member_ids
  | 'text'          // free-form, lands in executions.metadata[key]
  | 'number'        // free-form numeric, lands in executions.metadata[key]
  | 'select'        // single-choice, lands in executions.metadata[key]

export type TemplateMetadataFieldOption = {
  id: string
  label: string
}

export type TemplateMetadataField = {
  /** Stable key used in executions.metadata (or the typed-FK column). */
  key: string
  kind: TemplateMetadataFieldKind
  /** Optional override label. Falls back to a sensible default per kind. */
  label?: string
  /** Optional help text rendered under the field. */
  help?: string
  required?: boolean
  /** For kind='select' only: choosable options. */
  options?: TemplateMetadataFieldOption[]
}

export type TemplateMetadataSchema = {
  fields: TemplateMetadataField[]
}

/**
 * Per-org, per-pack template grouping admins curate from
 * Innstillinger → Kategorier. Drives the expandable groups in the
 * sidebar and the section headings in the hub tile grid.
 */
export type ComplianceCategoryRow = {
  id: string
  organization_id: string
  pack: CompliancePackSlug
  slug: string
  name: string
  description: string | null
  position: number
  is_active: boolean
  is_system: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type ComplianceExecutionRow = {
  id: string
  organization_id: string
  template_id: string
  pack: CompliancePackSlug
  title: string
  status: ComplianceChecklistStatus
  assigned_to: string | null
  scheduled_for: string | null
  signed_at: string | null
  signed_by: string | null
  /** Frozen template definition at sign time. Null until signed. */
  definition_snapshot: unknown
  /** SHA-256 of the canonical signed state, populated by trigger on sign. */
  sign_checksum: string | null
  /** Soft-archive flag (one-way). Only signed rows can be archived. */
  archived_at: string | null
  archived_by: string | null
  summary: string | null
  /** Free-form attendee names. Amendable post-sign (not part of the digest). */
  attendees: string[]
  /** Optional org-context FKs surfaced on the execution. */
  location_id: string | null
  department_id: string | null
  team_id: string | null
  /** Tracked org-member participants. References organization_members.id. */
  participant_member_ids: string[]
  /** Free-form per-template metadata (driven by template.metadata_schema). */
  metadata: Record<string, unknown>
  /**
   * Subject of the execution.
   * 'location'       → resolved via location_id
   * 'catalogue_item' → resolved via scope_catalogue_item_label
   * 'other'          → resolved via scope_other_label
   */
  scope_type: ChecklistScopeType | null
  /** Free-text label when scope_type='catalogue_item'. */
  scope_catalogue_item_label: string | null
  /** Free-text description when scope_type='other'. */
  scope_other_label: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ChecklistResponseValue =
  | { ok: boolean | null }
  | { text: string }
  | { number: number }
  | { dataUrl: string }
  | Record<string, unknown>

export type ComplianceResponseRow = {
  id: string
  organization_id: string
  execution_id: string
  item_key: string
  /** Shape depends on item type — see ChecklistResponseValue */
  value: unknown
  comment: string | null
  /** Set non-null to flag this response as a finding */
  severity: ComplianceSeverity | null
  is_finding: boolean
  /** Linked deviation, populated by workflow trigger when severity='critical' */
  deviation_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** What a checklist execution is *about* — its subject. */
export type ChecklistScopeType = 'location' | 'catalogue_item' | 'other'

export type ComplianceAssignableUser = {
  id: string
  displayName: string
}

/**
 * Compliance requirement (legal clause / standard section).
 * organization_id NULL = system-defined (read-only from app). NOT NULL =
 * org-authored custom requirement.
 */
export type ComplianceRequirementRow = {
  id: string
  organization_id: string | null
  pack: CompliancePackSlug
  slug: string
  code: string
  title: string
  description: string | null
  is_system: boolean
  is_active: boolean
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Junction row linking a template to a requirement it satisfies. */
export type ComplianceTemplateRequirementRow = {
  template_id: string
  requirement_id: string
  organization_id: string
  created_by: string | null
  created_at: string
}

/**
 * A timestamped comment on a checklist execution (or a specific item within it).
 * item_key null = execution-level; non-null = item-level discussion.
 * author_name is denormalized for display stability.
 * mentions carries the UUIDs of @-mentioned organization members.
 */
export type ChecklistCommentRow = {
  id: string
  organization_id: string
  execution_id: string
  item_key: string | null
  body: string
  author_id: string
  author_name: string
  mentions: string[]
  created_at: string
  updated_at: string
}

/** Org-wide aggregates fetched separately from the paginated list. */
export type ComplianceAggregates = {
  totalExecutions: number
  openCount: number
  criticalFindings: number
  ytdCompleted: number
}
