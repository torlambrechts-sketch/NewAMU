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
  organization_id: UuidSchema,
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
  photo_path: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  deviation_id: z.string().uuid().nullable(),
  workflow_processed_at: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
})

