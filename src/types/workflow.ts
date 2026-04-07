/** Matches DB workflow_rules.condition_json */
export type WorkflowCondition =
  | { match: 'always' }
  | { match: 'array_any'; path: string; where: Record<string, unknown> }
  | { match: 'field_equals'; path: string; value: string }

export type WorkflowActionCreateTask = {
  type: 'create_task'
  title: string
  description?: string
  assignee?: string
  ownerRole?: string
  dueInDays?: number
  module?: string
  sourceType?: string
  sourceLabel?: string
  requiresManagementSignOff?: boolean
}

export type WorkflowAction = WorkflowActionCreateTask | { type: 'log_only'; note?: string }

export type WorkflowRuleRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string
  source_module: string
  trigger_on: 'insert' | 'update' | 'both'
  is_active: boolean
  condition_json: WorkflowCondition
  actions_json: WorkflowAction[]
  priority: number
  is_template: boolean
  created_at: string
  updated_at: string
}

export type WorkflowRunRow = {
  id: string
  organization_id: string
  rule_id: string | null
  source_module: string
  event: string
  status: string
  detail: Record<string, unknown>
  created_at: string
}

export const WORKFLOW_SOURCE_MODULES = [
  { value: 'hse', label: 'HSE (hendelser, sykefravær, …)' },
  { value: 'internal_control', label: 'Internkontroll (ROS, årsgjennomgang, …)' },
  { value: 'org_health', label: 'Organisasjonshelse' },
  { value: 'tasks', label: 'Oppgaver (JSON)' },
  { value: 'wiki_published', label: 'Wiki — side publisert' },
] as const
