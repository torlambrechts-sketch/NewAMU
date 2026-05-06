// Compliance Checklist primitive — TypeScript row types.
// Mirrors public.compliance_checklist_* tables. Definition jsonb is unknown
// here; parsed via Zod in schema.ts.

export type CompliancePackSlug = 'aml-amu' | 'iso-45001'

export type ComplianceChecklistStatus = 'draft' | 'active' | 'signed'

/** Reuses public.inspection_finding_severity in the database. */
export type ComplianceSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ChecklistItemType =
  | 'yes_no_na'
  | 'text'
  | 'number'
  | 'photo'
  | 'signature'

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
  deleted_at: string | null
  created_by: string | null
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
  summary: string | null
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

export type ComplianceAssignableUser = {
  id: string
  displayName: string
}

/** Org-wide aggregates fetched separately from the paginated list. */
export type ComplianceAggregates = {
  totalExecutions: number
  openCount: number
  criticalFindings: number
  ytdCompleted: number
}
