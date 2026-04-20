/**
 * action_plan_items — matcher DB (inkl. bakoverkompatible kolonner: source_table, due_at, responsible_id).
 * Nye domene-felter: source_module, deadline, category_id, priority, assigned_to, verified_*
 */
export type ActionPlanItemStatus = 'draft' | 'open' | 'in_progress' | 'resolved' | 'verified' | 'overdue'

export type ActionPlanItemPriority = 'low' | 'medium' | 'high' | 'critical'

export type ActionPlanItemRow = {
  id: string
  organization_id: string
  source_table: string
  source_id: string
  source_module: string | null
  title: string
  description: string
  status: ActionPlanItemStatus
  priority: ActionPlanItemPriority
  category_id: string | null
  due_at: string
  deadline: string | null
  responsible_id: string | null
  assigned_to: string | null
  completed_at: string | null
  completed_by: string | null
  verified_at: string | null
  verified_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ActionPlanCategoryRow = {
  id: string
  organization_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type CreateActionPlanItemInput = {
  title: string
  description: string
  status: ActionPlanItemStatus
  priority: ActionPlanItemPriority
  categoryId: string | null
  deadline: string
  /** Brukes som kilde-UUID; for manuelt opprettede brukes tilfeldig UUID. */
  sourceId?: string
  sourceModule: string
  sourceTable: string
  assignedTo: string | null
}

export type UpdateActionPlanItemInput = {
  id: string
  title?: string
  description?: string
  status?: ActionPlanItemStatus
  priority?: ActionPlanItemPriority
  categoryId?: string | null
  deadline?: string | null
  sourceModule?: string | null
  sourceId?: string | null
  sourceTable?: string | null
  assignedTo?: string | null
}
