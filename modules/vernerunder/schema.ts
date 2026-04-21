import { z } from 'zod'
import type {
  VernerunderRow,
  VernerundeCategoryRow,
  VernerundeCheckpointRow,
  VernerundeFindingRow,
  VernerundeParticipantRow,
  VernerundeTemplateItemRow,
  VernerundeTemplateRow,
  VernerunderWorkflowDispatchPayload,
} from './types'

const UuidSchema = z.string().uuid()
const TimestamptzSchema = z.string()

const VernerunderStatusEnum = z.enum(['draft', 'active', 'completed', 'signed'])
const VernerundeCheckpointStatusEnum = z.enum(['ok', 'deviation', 'not_applicable'])
const VernerundeParticipantRoleEnum = z.enum(['manager', 'safety_deputy', 'employee'])
const VernerundeFindingSeverityEnum = z.enum(['low', 'medium', 'high', 'critical'])

const VernerunderRowBaseSchema = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  title: z.string(),
  status: VernerunderStatusEnum,
  planned_date: z.string().nullish().transform((v) => (v == null || v === '' ? null : v)),
  template_id: UuidSchema.nullable().default(null),
  created_at: TimestamptzSchema,
  updated_at: TimestamptzSchema,
})

export const VernerunderRowSchema: z.ZodType<VernerunderRow> = VernerunderRowBaseSchema

/** RLS-lås-sjekk: tilstrekkelig å hente disse tre feltene. */
export const VernerunderParentStatusSchema = VernerunderRowBaseSchema.pick({
  id: true,
  status: true,
  organization_id: true,
})

export const VernerundeCheckpointRowSchema: z.ZodType<VernerundeCheckpointRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  vernerunde_id: UuidSchema,
  original_template_item_id: UuidSchema.nullable().default(null),
  question_text: z.string(),
  status: VernerundeCheckpointStatusEnum,
  created_at: TimestamptzSchema,
  updated_at: TimestamptzSchema,
})

export const VernerundeParticipantRowSchema: z.ZodType<VernerundeParticipantRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  vernerunde_id: UuidSchema,
  user_id: UuidSchema,
  role: VernerundeParticipantRoleEnum,
  signed_at: TimestamptzSchema.nullable().default(null),
  created_at: TimestamptzSchema,
})

export const VernerundeFindingRowSchema: z.ZodType<VernerundeFindingRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  vernerunde_id: UuidSchema,
  checkpoint_id: UuidSchema.nullable().default(null),
  category_id: UuidSchema.nullable().default(null),
  description: z.string(),
  severity: VernerundeFindingSeverityEnum,
  created_at: TimestamptzSchema,
  updated_at: TimestamptzSchema,
})

export const VernerundeCategoryRowSchema: z.ZodType<VernerundeCategoryRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  name: z.string(),
})

export const VernerundeTemplateRowSchema: z.ZodType<VernerundeTemplateRow> = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  name: z.string(),
  description: z.string().nullable().default(null),
})

export const VernerundeTemplateItemRowSchema: z.ZodType<VernerundeTemplateItemRow> = z.object({
  id: UuidSchema,
  template_id: UuidSchema,
  organization_id: UuidSchema,
  question_text: z.string(),
  category_id: UuidSchema.nullable().default(null),
  position: z.number().int(),
})

function parseList<T>(rows: unknown[], schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  const out: T[] = []
  for (const r of rows) {
    const p = schema.safeParse(r)
    if (p.success && p.data) out.push(p.data)
  }
  return out
}

export function parseVernerunderRow(row: unknown) {
  return VernerunderRowSchema.safeParse(row)
}

export function parseParentStatusRow(row: unknown) {
  return VernerunderParentStatusSchema.safeParse(row)
}

export function parseVernerunderList(rows: unknown[]) {
  return parseList(rows, VernerunderRowSchema)
}

export function parseCheckpointList(rows: unknown[]) {
  return parseList(rows, VernerundeCheckpointRowSchema)
}

export function parseParticipantList(rows: unknown[]) {
  return parseList(rows, VernerundeParticipantRowSchema)
}

export function parseFindingList(rows: unknown[]) {
  return parseList(rows, VernerundeFindingRowSchema)
}

export function parseCategoryList(rows: unknown[]) {
  return parseList(rows, VernerundeCategoryRowSchema)
}

export function parseTemplateList(rows: unknown[]) {
  return parseList(rows, VernerundeTemplateRowSchema)
}

export function parseTemplateItemList(rows: unknown[]) {
  return parseList(rows, VernerundeTemplateItemRowSchema)
}

export const VernerunderWorkflowDispatchPayloadSchema: z.ZodType<VernerunderWorkflowDispatchPayload> = z.object({
  source_module: z.literal('vernerunder'),
  source_id: UuidSchema,
  row: z.record(z.string(), z.unknown()),
  meta: z.record(z.string(), z.unknown()).optional(),
})
