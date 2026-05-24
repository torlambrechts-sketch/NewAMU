// Registers — generic record-list module across compliance packs.
// See specs/registers-engine.md.
//
// This file declares the user-facing types. The DB row shapes that the
// supabase client returns are mapped into these via the per-table
// `mapRegisterType` / `mapRegisterRecord` helpers in `useRegisters`.

import { z } from 'zod'

// ── Field kinds the schema-builder UX supports ───────────────────────────

export type RegisterFieldKind =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'select_multi'
  | 'doc_ref'
  | 'location_ref'

export const REGISTER_FIELD_KIND_LABELS: Record<RegisterFieldKind, string> = {
  text: 'Tekst',
  number: 'Tall',
  date: 'Dato',
  boolean: 'Ja/nei',
  select: 'Velg en',
  select_multi: 'Velg flere',
  doc_ref: 'Dokumentlenke',
  location_ref: 'Lokasjon',
}

// One entry in a register_type's metadata_schema.fields[].
export type RegisterField = {
  /** Stable identifier; used as the JSON key in record.values. */
  key: string
  /** Human label shown above the input. */
  label: string
  kind: RegisterFieldKind
  /** When true, the form rejects blank values. */
  required?: boolean
  /** Optional one-liner shown beside the label. */
  hint?: string
  /** select / select_multi only: option list. */
  options?: { value: string; label: string }[]
}

export type RegisterMetadataSchema = {
  fields: RegisterField[]
}

// ── Display metadata (presentation-only attributes on a type) ────────────
//
// Held in register_types.display_metadata jsonb. Optional / null-tolerant
// — the page falls back to defaults for any missing key.

export type RegisterDisplayMetadata = {
  /** Lucide icon name (e.g. 'FlaskConical', 'Database'). */
  icon?: string | null
  /** Lovpålagt — drives the "Lovpålagt" pill + compliance status. */
  mandatory?: boolean
  /** Sensitive content flag — shows lock icon and access banners. */
  sensitive?: boolean
  /** Holds personal data — drives the purple GDPR pill + banner. */
  gdpr?: boolean
  /** Canonical owner role label, e.g. "HMS-leder". */
  ownerRole?: string | null
  /** Free-text lagringstid description. */
  retentionLabel?: string | null
  /** Free-text access rules; one bullet per line. */
  accessRules?: string[]
  /** Render-ready legal-reference labels for the badge row (e.g. "AML § 4-5"). */
  legalLabels?: string[]
  /** Chemicals special: which boolean field flags a CMR record. */
  cmrField?: string | null
}

// ── Register type (catalogue row) ────────────────────────────────────────

export type RegisterType = {
  id: string
  /** Null for platform-shipped types; the org id for admin-authored ones. */
  organizationId: string | null
  name: string
  description: string | null
  metadataSchema: RegisterMetadataSchema
  /** Multi: which regulations this type satisfies. */
  regulationIds: string[]
  /** Multi: which compliance packs auto-enable this type on licensing. */
  packSlugs: string[]
  defaultReviewCadenceMonths: number | null
  isActive: boolean
  isSystem: boolean
  position: number
  /** Presentation-layer attributes — icon, mandatory, ownerRole, … */
  displayMetadata: RegisterDisplayMetadata
  createdAt: string
  updatedAt: string
}

// ── Register category (per-org grouping) ─────────────────────────────────

export type RegisterCategory = {
  id: string
  organizationId: string
  slug: string
  name: string
  description: string | null
  /** Cat 1 of the cross-module taxonomy — null = uncategorised. */
  regulationId: string | null
  position: number
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

// ── Per-org settings on a (org, type) pair ───────────────────────────────

export type RegisterOrgSettings = {
  organizationId: string
  registerTypeId: string
  enabled: boolean
  /** Override the type.name for this org; falls through to type.name when null. */
  nameOverride: string | null
  /** Optional category assignment; null = sidebar bucket "Uten kategori". */
  categoryId: string | null
  navPinned: boolean
  position: number
}

// ── Register record (the actual row authored against a type) ─────────────

export type RegisterRecordStatus = 'draft' | 'active' | 'archived'

export type RegisterRecord = {
  id: string
  organizationId: string
  registerTypeId: string
  /** Free-form bag keyed by the type's metadata_schema field keys. */
  values: Record<string, unknown>
  status: RegisterRecordStatus
  reviewDueAt: string | null
  ownerUserId: string | null
  evidenceDocRefs: string[]
  createdAt: string
  updatedAt: string
}

// ── Audit trail ──────────────────────────────────────────────────────────

export type RegisterRecordRevision = {
  id: string
  recordId: string
  valuesBefore: Record<string, unknown>
  valuesAfter: Record<string, unknown>
  statusBefore: RegisterRecordStatus | null
  statusAfter: RegisterRecordStatus | null
  changedBy: string | null
  changedAt: string
}

// ── Zod schemas — validation at the supabase response boundary ───────────

const RegisterFieldSchema: z.ZodType<RegisterField> = z.object({
  key: z.string().min(1),
  label: z.string(),
  kind: z.enum([
    'text',
    'number',
    'date',
    'boolean',
    'select',
    'select_multi',
    'doc_ref',
    'location_ref',
  ]),
  required: z.boolean().optional(),
  hint: z.string().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
})

export const RegisterMetadataSchemaSchema: z.ZodType<RegisterMetadataSchema> = z.object({
  fields: z.array(RegisterFieldSchema).default([]),
})

export const RegisterRecordStatusSchema = z.enum(['draft', 'active', 'archived'])

export const RegisterDisplayMetadataSchema: z.ZodType<RegisterDisplayMetadata> = z.object({
  icon: z.string().nullable().optional(),
  mandatory: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  gdpr: z.boolean().optional(),
  ownerRole: z.string().nullable().optional(),
  retentionLabel: z.string().nullable().optional(),
  accessRules: z.array(z.string()).optional(),
  legalLabels: z.array(z.string()).optional(),
  cmrField: z.string().nullable().optional(),
})
