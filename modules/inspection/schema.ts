import { z } from 'zod'
import type {
  InspectionChecklistItem,
  InspectionFindingRow,
  InspectionItemRow,
  InspectionLocationRow,
  InspectionRoundRow,
  InspectionTemplateRow,
} from './types'

const ChecklistItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  fieldType: z
    .enum(['yes_no_na', 'text', 'number', 'photo', 'photo_required', 'signature'])
    .optional(),
  hmsCategory: z
    .enum(['fysisk', 'ergonomi', 'kjemikalier', 'psykososialt', 'brann', 'maskiner', 'annet'])
    .optional(),
  helpText: z.string().optional(),
  lawRef: z.string().optional(),
})

const ChecklistDefinitionSchema = z.object({
  title: z.string().optional(),
  items: z.array(ChecklistItemSchema).default([]),
})

export function parseChecklistItems(input: unknown): InspectionChecklistItem[] {
  const parsed = ChecklistDefinitionSchema.safeParse(input)
  if (parsed.success) return parsed.data.items
  return []
}

const UuidSchema = z.string().uuid()
const TimestampSchema = z.string()

export const InspectionTemplateRowSchema: z.ZodType<InspectionTemplateRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema.nullable(),
  name: z.string(),
  checklist_definition: z.unknown(),
  is_active: z.boolean(),
  created_by: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const InspectionLocationRowSchema: z.ZodType<InspectionLocationRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  location_code: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean(),
  parent_id: z.string().uuid().nullable(),
  kind: z.string(),
  manager_id: z.string().uuid().nullable(),
  safety_deputy_id: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const InspectionRoundRowSchema: z.ZodType<InspectionRoundRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  template_id: UuidSchema,
  location_id: z.string().uuid().nullable(),
  title: z.string(),
  scheduled_for: z.string().nullable(),
  cron_expression: z.string().nullable(),
  assigned_to: z.string().uuid().nullable(),
  status: z.enum(['draft', 'active', 'signed']),
  completed_at: z.string().nullable(),
  signed_off_by: z.string().uuid().nullable(),
  // Added by migration 20260617140000 — use .default(null) so older DB instances
  // (where the migration hasn't been applied yet) don't cause parse failures.
  manager_signed_at: z.string().nullable().default(null),
  manager_signed_by: z.string().uuid().nullable().default(null),
  deputy_signed_at: z.string().nullable().default(null),
  deputy_signed_by: z.string().uuid().nullable().default(null),
  summary: z.string().nullable().default(null),
  conducted_by: z.string().uuid().nullable().default(null),
  conducted_at: z.string().nullable().default(null),
  gps_lat: z.number().nullable().default(null),
  gps_lon: z.number().nullable().default(null),
  gps_accuracy_m: z.number().nullable().default(null),
  gps_stamped_at: z.string().nullable().default(null),
  created_by: z.string().uuid().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const InspectionItemRowSchema: z.ZodType<InspectionItemRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  round_id: UuidSchema,
  checklist_item_key: z.string(),
  checklist_item_label: z.string(),
  position: z.number().int(),
  response: z.record(z.string(), z.unknown()).default({}),
  status: z.string(),
  notes: z.string().nullable(),
  photo_path: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

export const InspectionFindingRowSchema: z.ZodType<InspectionFindingRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  round_id: UuidSchema,
  item_id: z.string().uuid().nullable(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  risk_probability: z.number().int().min(1).max(5).nullable().default(null),
  risk_consequence: z.number().int().min(1).max(5).nullable().default(null),
  risk_score: z.number().int().nullable().default(null),
  photo_path: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  deviation_id: z.string().uuid().nullable(),
  workflow_processed_at: z.string().nullable(),
  deleted_at: z.string().nullable().optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

