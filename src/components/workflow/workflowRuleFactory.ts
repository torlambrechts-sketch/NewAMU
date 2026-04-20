import type { WorkflowRule } from '../../types/moduleTemplate'

/**
 * ROS-modulen: `trigger_event_name` for db_event-regler (`WorkflowRulesTab` med `triggerModule="ros"`).
 * Må samsvare med Postgres-triggere som kaller `workflow_dispatch_db_event(..., p_event, ...)`.
 */
export const ROS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_ROS_CREATED', label: 'ROS opprettet' },
  { value: 'ON_ROS_CRITICAL_RISK', label: 'Kritisk risiko i ROS' },
  { value: 'ON_ROS_APPROVED', label: 'ROS godkjent' },
] as const

function newRuleId() {
  return `wr-${Math.random().toString(36).slice(2, 10)}`
}

/** Default row for module template workflowRules (same defaults as platform-admin). */
export function createNewWorkflowRule(existingRuleCount: number): WorkflowRule {
  return {
    id: newRuleId(),
    name: 'Ny regel',
    active: false,
    priority: existingRuleCount * 10,
    trigger: { type: 'on_create' },
    actions: [
      {
        type: 'notify_role',
        role: 'admin',
        messageTemplate: '{{module.title}} ble opprettet.',
      },
    ],
  }
}
