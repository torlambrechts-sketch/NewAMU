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

export const ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_MEASURE_CREATED', label: 'Tiltak opprettet' },
  { value: 'ON_MEASURE_RESOLVED', label: 'Tiltak løst eller verifisert' },
  { value: 'ON_MEASURE_OVERDUE', label: 'Tiltak forfalt' },
] as const

export const INTERNKONTROLL_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_ANNUAL_REVIEW_SIGNED', label: 'Årlig gjennomgang signert' },
] as const

export const VERNERUNDER_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_VERNERUNDE_CREATED', label: 'Vernerunde opprettet' },
  { value: 'ON_VERNERUNDE_PLANNED', label: 'Vernerunde planlagt' },
  { value: 'ON_VERNERUNDE_COMPLETED', label: 'Vernerunde fullført' },
  { value: 'ON_STATUS_CHANGED', label: 'Statusendring vernerunde' },
  { value: 'ON_FINDING_REGISTERED', label: 'Funn registrert' },
  { value: 'ON_FINDING_UPDATED', label: 'Funn oppdatert' },
] as const

/** Møter — hendelser fra meetings_module. */
export const MEETINGS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_MEETING_SCHEDULED', label: 'Møte planlagt' },
  { value: 'ON_MEETING_SIGNED', label: 'Protokoll signert' },
  { value: 'ON_MEETING_DECISION_LOGGED', label: 'Vedtak registrert' },
] as const

/** Documents module — revision, acknowledgement and annual-review lifecycle events. */
export const DOCUMENTS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_DOCUMENT_PUBLISHED', label: 'Dokument publisert' },
  { value: 'ON_DOCUMENT_REVISION_DUE', label: 'Revisjonsfrist nådd' },
  { value: 'ON_DOCUMENT_REVISION_OVERDUE', label: 'Revisjon forfalt' },
  { value: 'ON_DOCUMENT_ACK_COMPLETE', label: 'Alle kvitteringer mottatt' },
  { value: 'ON_DOCUMENT_ACCESS_REQUESTED', label: 'Tilgangssøknad mottatt' },
  { value: 'ON_ANNUAL_REVIEW_STARTED', label: 'Årsgjennomgang startet' },
  { value: 'ON_ANNUAL_REVIEW_COMPLETED', label: 'Årsgjennomgang fullført' },
] as const

/** Match `workflow_dispatch_db_event` in survey enterprise migration (module `survey`). */
export const SURVEY_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_SURVEY_PUBLISHED', label: 'Undersøkelse publisert' },
  { value: 'ON_SURVEY_CLOSED', label: 'Undersøkelse lukket' },
  { value: 'ON_SURVEY_RESPONSE_SUBMITTED', label: 'Svar innsendt' },
  { value: 'ON_SURVEY_ALL_INVITATIONS_COMPLETED', label: 'Alle invitasjoner besvart (ingen ventende)' },
  { value: 'ON_SURVEY_RESPONSE_RATE_THRESHOLD', label: 'Svarandel nådd (terskel)' },
] as const

/** Match `process_compliance_checklist_response_workflow` trigger in
 *  20260806120100_compliance_checklist_workflow.sql. The trigger fires
 *  AFTER INSERT on compliance_checklist_responses where severity is set
 *  (is_finding=true); rules are evaluated against the response payload
 *  and dispatch via execute_compliance_checklist_rule_actions. */
export const COMPLIANCE_CHECKLIST_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'response_finding_critical', label: 'Kritisk svar registrert' },
  { value: 'response_finding_high',     label: 'Høy-alvor svar registrert' },
  { value: 'response_finding_medium',   label: 'Middels-alvor svar registrert' },
  { value: 'response_finding_low',      label: 'Lav-alvor svar registrert' },
  { value: 'execution_signed',          label: 'Sjekkliste signert' },
] as const

export const TASKS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_TASK_CREATED',        label: 'Oppgave opprettet' },
  { value: 'ON_TASK_STATUS_CHANGED', label: 'Status endret' },
  { value: 'ON_TASK_OVERDUE_MARKED', label: 'Oppgave forfalt' },
  { value: 'ON_TASK_SIGNED',         label: 'Utfører signert' },
] as const

export const LEARNING_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_COURSE_STARTED',     label: 'Kurs startet' },
  { value: 'ON_COURSE_COMPLETED',   label: 'Kurs fullført' },
  { value: 'ON_CERTIFICATE_ISSUED', label: 'Sertifikat utstedt' },
] as const

export const REGISTERS_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'ON_REGISTER_RECORD_CREATED', label: 'Registerrad opprettet' },
  { value: 'ON_REGISTER_RECORD_UPDATED', label: 'Registerrad oppdatert' },
] as const

const REGISTRY: Record<string, readonly { value: string; label: string }[]> = {
  inspection: INSPECTION_WORKFLOW_TRIGGER_EVENTS,
  ros: ROS_WORKFLOW_TRIGGER_EVENTS,
  action_plan: ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS,
  internkontroll: INTERNKONTROLL_WORKFLOW_TRIGGER_EVENTS,
  vernerunder: VERNERUNDER_WORKFLOW_TRIGGER_EVENTS,
  meetings: MEETINGS_WORKFLOW_TRIGGER_EVENTS,
  survey: SURVEY_WORKFLOW_TRIGGER_EVENTS,
  documents: DOCUMENTS_WORKFLOW_TRIGGER_EVENTS,
  compliance_checklist: COMPLIANCE_CHECKLIST_WORKFLOW_TRIGGER_EVENTS,
  tasks: TASKS_WORKFLOW_TRIGGER_EVENTS,
  learning: LEARNING_WORKFLOW_TRIGGER_EVENTS,
  registers: REGISTERS_WORKFLOW_TRIGGER_EVENTS,
}

export function getWorkflowTriggerEventsForModule(triggerModule: string): { value: string; label: string }[] {
  const list = REGISTRY[triggerModule]
  if (!list) return []
  return list.map((e) => ({ value: e.value, label: e.label }))
}
