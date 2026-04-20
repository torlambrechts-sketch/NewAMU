import { z } from 'zod'
import type { ActionPlanItemRow, ActionPlanCategoryRow } from './types'

const Status = z
  .string()
  .transform((s) => (s === 'completed' ? 'resolved' : s))
  .pipe(
    z.enum(['draft', 'open', 'in_progress', 'resolved', 'verified', 'overdue']),
  )
const Priority = z.enum(['low', 'medium', 'high', 'critical'])
const Uuid = z.string().uuid()
const ZIso = z.union([z.string().datetime({ offset: true }), z.string()]).nullable()
const ZDue = z.union([z.string().datetime({ offset: true }), z.string()])

const PriorityIn = z.preprocess(
  (v) => (v == null || v === undefined ? 'medium' : v),
  Priority,
)

export const ActionPlanItemRowSchema = z
  .object({
    id: Uuid,
    organization_id: Uuid,
    source_table: z.string().min(1),
    source_id: Uuid,
    source_module: z.string().nullable().optional().default(null),
    title: z.string(),
    description: z.string().default(''),
    status: Status,
    priority: PriorityIn,
    category_id: Uuid.nullable().optional().default(null),
    due_at: ZDue,
    deadline: z.union([ZDue, z.null()]).optional().default(null),
    responsible_id: Uuid.nullable().optional().default(null),
    assigned_to: Uuid.nullable().optional().default(null),
    completed_at: ZIso.optional().default(null),
    completed_by: Uuid.nullable().optional().default(null),
    verified_at: ZIso.optional().default(null),
    verified_by: Uuid.nullable().optional().default(null),
    created_by: Uuid.nullable().optional().default(null),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform(
    (r): ActionPlanItemRow => {
      const aid = r.assigned_to ?? r.responsible_id
      const rid = r.responsible_id ?? r.assigned_to
      const dlin = (r.deadline ?? r.due_at) as string | null
      return {
        id: r.id,
        organization_id: r.organization_id,
        source_table: r.source_table,
        source_id: r.source_id,
        source_module: r.source_module ?? null,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        category_id: r.category_id ?? null,
        due_at: r.due_at,
        deadline: dlin,
        responsible_id: rid,
        assigned_to: aid,
        completed_at: r.completed_at,
        completed_by: r.completed_by,
        verified_at: r.verified_at,
        verified_by: r.verified_by,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    },
  )

export const ActionPlanCategoryRowSchema = z
  .object({
    id: Uuid,
    organization_id: Uuid,
    name: z.string().min(1),
    sort_order: z.number().int().optional().default(0),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform(
    (r): ActionPlanCategoryRow => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      sort_order: r.sort_order,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  )

export function parseActionPlanItemRow(raw: unknown) {
  return ActionPlanItemRowSchema.safeParse(raw)
}

export function parseActionPlanCategoryRow(raw: unknown) {
  return ActionPlanCategoryRowSchema.safeParse(raw)
}

export function collectParsedActionPlanItems(rows: unknown[] | null | undefined) {
  const out: ActionPlanItemRow[] = []
  for (const raw of rows ?? []) {
    const p = parseActionPlanItemRow(raw)
    if (p.success) out.push(p.data)
  }
  return out
}

export function collectParsedCategories(rows: unknown[] | null | undefined) {
  const out: ActionPlanCategoryRow[] = []
  for (const raw of rows ?? []) {
    const p = parseActionPlanCategoryRow(raw)
    if (p.success) out.push(p.data)
  }
  return out
}
