/** Matches DB workflow_rules.condition_json */
export type WorkflowCondition =
  | { match: 'always' }
  | { match: 'array_any'; path: string; where: Record<string, unknown> }
  | { match: 'field_equals'; path: string; value: string }
  | { match: 'and'; conditions: WorkflowCondition[] }
  | { match: 'or'; conditions: WorkflowCondition[] }
  /** Eksakt én under-betingelse må være sann (for grenvis handlinger) */
  | { match: 'xor'; conditions: WorkflowCondition[] }

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

/** Logges i workflow_runs — faktisk e-post krever server/Edge Function (se roadmap). */
export type WorkflowActionSendEmail = {
  type: 'send_email'
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  contentType?: 'text/plain' | 'text/html'
}

/** Logges som planlagt in-app / kategorisert varsel (klientvarsler bruker egne prefs). */
export type WorkflowActionSendNotification = {
  type: 'send_notification'
  title: string
  body: string
  category?: string
  channels?: string[]
}

/** Logges med URL — HTTP-kall krever server (ikke fra Postgres). */
export type WorkflowActionCallWebhook = {
  type: 'call_webhook'
  url: string
  method?: 'POST' | 'PUT' | 'GET'
  /** JSON-streng for ekstra headers, f.eks. {"Authorization":"Bearer …"} */
  headersJson?: string
  body?: string
}

export type WorkflowAction =
  | WorkflowActionCreateTask
  | WorkflowActionSendEmail
  | WorkflowActionSendNotification
  | WorkflowActionCallWebhook
  | { type: 'log_only'; note?: string }

/** actions_json når XOR-grener har hver sine handlinger */
export type WorkflowXorActionsEnvelope = {
  mode: 'xor_branches'
  branches: { actions: WorkflowAction[] }[]
}

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
  actions_json: WorkflowAction[] | WorkflowXorActionsEnvelope
  flow_graph_json?: Record<string, unknown> | null
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
