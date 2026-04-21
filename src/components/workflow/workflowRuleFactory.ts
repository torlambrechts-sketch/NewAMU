import type { WorkflowRule } from '../../types/moduleTemplate'

export {
  ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS,
  AMU_ELECTION_WORKFLOW_TRIGGER_EVENTS,
  AMU_WORKFLOW_TRIGGER_EVENTS,
  INSPECTION_WORKFLOW_TRIGGER_EVENTS,
  INTERNKONTROLL_WORKFLOW_TRIGGER_EVENTS,
  ROS_WORKFLOW_TRIGGER_EVENTS,
  SURVEY_WORKFLOW_TRIGGER_EVENTS,
  VERNERUNDER_WORKFLOW_TRIGGER_EVENTS,
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

/**
 * Kritiske `db_event`-navn for vernerunder (Postgres: `workflow_dispatch_db_event(…, 'vernerunder', '<navn>', …)`).
 * Full liste for UI: `VERNERUNDER_WORKFLOW_TRIGGER_EVENTS` (eksportert over).
 * Fase 3 database-triggere: `ON_VERNERUNDE_PLANNED`, `ON_VERNERUNDE_COMPLETED`, `ON_FINDING_REGISTERED`.
 */
export const VERNERUNDER_DB_EVENT_CORE = [
  'ON_VERNERUNDE_PLANNED',
  'ON_VERNERUNDE_COMPLETED',
  'ON_FINDING_REGISTERED',
] as const
