import type { WorkflowRule } from '../../types/moduleTemplate'

export {
  ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS,
  INSPECTION_WORKFLOW_TRIGGER_EVENTS,
  ROS_WORKFLOW_TRIGGER_EVENTS,
  getWorkflowTriggerEventsForModule,
} from './workflowTriggerRegistry'

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
