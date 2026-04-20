/**
 * Db_event `trigger_event_name` values per `source_module` / `triggerModule`.
 * Keep in sync with Postgres triggers that call `workflow_dispatch_db_event`.
 */
export const INSPECTION_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'round_created', label: 'Runde opprettet' },
  { value: 'round_activated', label: 'Runde aktivert' },
  { value: 'round_signed', label: 'Runde signert' },
  { value: 'finding_critical', label: 'Kritisk funn registrert' },
  { value: 'finding_high', label: 'Høy-alvorlighet funn' },
  { value: 'finding_medium', label: 'Middels-alvorlighet funn' },
  { value: 'finding_low', label: 'Lav-alvorlighet funn' },
] as const

export const ROS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_ROS_CREATED', label: 'ROS opprettet' },
  { value: 'ON_ROS_CRITICAL_RISK', label: 'Kritisk risiko i ROS' },
  { value: 'ON_ROS_APPROVED', label: 'ROS godkjent' },
] as const

export const INTERNKONTROLL_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_ANNUAL_REVIEW_SIGNED', label: 'Årlig gjennomgang signert' },
] as const

const REGISTRY: Record<string, readonly { value: string; label: string }[]> = {
  inspection: INSPECTION_WORKFLOW_TRIGGER_EVENTS,
  ros: ROS_WORKFLOW_TRIGGER_EVENTS,
  internkontroll: INTERNKONTROLL_WORKFLOW_TRIGGER_EVENTS,
}

export function getWorkflowTriggerEventsForModule(triggerModule: string): { value: string; label: string }[] {
  const list = REGISTRY[triggerModule]
  if (!list) return []
  return list.map((e) => ({ value: e.value, label: e.label }))
}
