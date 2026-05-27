// Alerts v1.1 — state machine (TS source of truth).
//
// Mirrors the workflow transitions seeded in
// 20261020120100_alerts_v11_status_machine_extension.sql. The UI consults
// this to gate transition menus + render SLA chips. The RPC
// alerts_execute_transition is the authoritative gate; this module just
// matches it for client-side UX.

export const ALERT_STATE_VALUES = [
  'received',
  'triage',
  'assigned',
  'under_investigation',
  'awaiting_reporter_response',
  'on_hold',
  'decision',
  'closed',
  'rejected',
  'escalated',
  'reopened',
  'withdrawn',
  // Legacy v1.0 aliases — kept so existing rows continue to validate.
  'investigation',
  'internal_review',
  'dismissed',
] as const
export type AlertState = (typeof ALERT_STATE_VALUES)[number]

export const ALERT_STATE_CANONICAL: Record<AlertState, AlertState> = {
  received: 'received',
  triage: 'triage',
  assigned: 'assigned',
  under_investigation: 'under_investigation',
  awaiting_reporter_response: 'awaiting_reporter_response',
  on_hold: 'on_hold',
  decision: 'decision',
  closed: 'closed',
  rejected: 'rejected',
  escalated: 'escalated',
  reopened: 'reopened',
  withdrawn: 'withdrawn',
  // Legacy → canonical mapping per status_machine_extension.sql view.
  investigation: 'under_investigation',
  internal_review: 'decision',
  dismissed: 'rejected',
}

export const ALERT_STATE_LABELS_NB: Record<AlertState, string> = {
  received: 'Mottatt',
  triage: 'Triage',
  assigned: 'Tildelt',
  under_investigation: 'Under undersøkelse',
  awaiting_reporter_response: 'Venter på varsler',
  on_hold: 'Satt på vent',
  decision: 'Vedtak',
  closed: 'Lukket',
  rejected: 'Avvist',
  escalated: 'Eskalert',
  reopened: 'Gjenåpnet',
  withdrawn: 'Trukket',
  // Legacy labels — render same as canonical.
  investigation: 'Under undersøkelse',
  internal_review: 'Vedtak',
  dismissed: 'Avvist',
}

export const ALERT_STATE_LABELS_EN: Record<AlertState, string> = {
  received: 'Received',
  triage: 'Triage',
  assigned: 'Assigned',
  under_investigation: 'Under investigation',
  awaiting_reporter_response: 'Awaiting reporter response',
  on_hold: 'On hold',
  decision: 'Decision',
  closed: 'Closed',
  rejected: 'Rejected',
  escalated: 'Escalated',
  reopened: 'Reopened',
  withdrawn: 'Withdrawn',
  investigation: 'Under investigation',
  internal_review: 'Decision',
  dismissed: 'Rejected',
}

export type SlaClock = 'ack' | 'feedback' | 'interim'
export type SlaClockState = 'running' | 'paused' | 'stopped'

/** SLA clock state per (current state, clock kind). Source: v1.1 spec §3. */
export const ALERT_SLA_CLOCKS: Record<AlertState, Record<SlaClock, SlaClockState>> = {
  received:                     { ack: 'running', feedback: 'running', interim: 'stopped' },
  triage:                       { ack: 'running', feedback: 'running', interim: 'running' },
  assigned:                     { ack: 'stopped', feedback: 'running', interim: 'running' },
  under_investigation:          { ack: 'stopped', feedback: 'running', interim: 'running' },
  awaiting_reporter_response:   { ack: 'stopped', feedback: 'paused',  interim: 'running' },
  on_hold:                      { ack: 'stopped', feedback: 'paused',  interim: 'paused'  },
  decision:                     { ack: 'stopped', feedback: 'running', interim: 'running' },
  closed:                       { ack: 'stopped', feedback: 'stopped', interim: 'stopped' },
  rejected:                     { ack: 'stopped', feedback: 'stopped', interim: 'stopped' },
  escalated:                    { ack: 'stopped', feedback: 'running', interim: 'running' },
  reopened:                     { ack: 'stopped', feedback: 'running', interim: 'running' },
  withdrawn:                    { ack: 'stopped', feedback: 'stopped', interim: 'stopped' },
  // Legacy aliases follow canonical clocks.
  investigation:                { ack: 'stopped', feedback: 'running', interim: 'running' },
  internal_review:              { ack: 'stopped', feedback: 'running', interim: 'running' },
  dismissed:                    { ack: 'stopped', feedback: 'stopped', interim: 'stopped' },
}

export function canonicaliseState(s: AlertState): AlertState {
  return ALERT_STATE_CANONICAL[s] ?? s
}

export function stateLabel(s: AlertState, lang: 'nb' | 'en' = 'nb'): string {
  return (lang === 'nb' ? ALERT_STATE_LABELS_NB : ALERT_STATE_LABELS_EN)[s] ?? s
}

export function isSlaClockRunning(s: AlertState, clock: SlaClock): boolean {
  return ALERT_SLA_CLOCKS[canonicaliseState(s)]?.[clock] === 'running'
}

export function isSlaClockPaused(s: AlertState, clock: SlaClock): boolean {
  return ALERT_SLA_CLOCKS[canonicaliseState(s)]?.[clock] === 'paused'
}

/**
 * Default transitions (mirror the seed in the SQL migration). Org overrides
 * are loaded at runtime via useAlerts.workflowTransitions().
 */
export type WorkflowTransitionRule = {
  fromState: AlertState
  toState: AlertState
  allowedRoles: string[]
  preconditions: Record<string, unknown>
  sideEffects: Record<string, unknown>
  slaAction: 'noop' | 'start_feedback' | 'start_interim' | 'pause_feedback' | 'stop_all'
}

export const DEFAULT_TRANSITIONS: WorkflowTransitionRule[] = [
  { fromState: 'received', toState: 'triage',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'noop' },
  { fromState: 'received', toState: 'rejected',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresJustification: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'triage', toState: 'assigned',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresAssignedHandler: true, requiresCoiDeclaration: true },
    sideEffects: { emitTimeline: 'assigned' }, slaAction: 'start_feedback' },
  { fromState: 'triage', toState: 'rejected',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresJustification: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'assigned', toState: 'under_investigation',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  { fromState: 'under_investigation', toState: 'awaiting_reporter_response',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'pause_feedback' },
  { fromState: 'awaiting_reporter_response', toState: 'under_investigation',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  { fromState: 'under_investigation', toState: 'on_hold',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresJustification: true },
    sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'stop_all' },
  { fromState: 'on_hold', toState: 'under_investigation',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  { fromState: 'under_investigation', toState: 'decision',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresSeverity: true },
    sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  { fromState: 'under_investigation', toState: 'escalated',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.board_escalation'],
    preconditions: { requiresJustification: true },
    sideEffects: { emitTimeline: 'escalated' }, slaAction: 'noop' },
  { fromState: 'escalated', toState: 'decision',
    allowedRoles: ['alerts.committee_escalated','alerts.board_escalation'],
    preconditions: { requiresSeverity: true },
    sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  { fromState: 'decision', toState: 'closed',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: { requiresClosingSummary: true, requiresClosingOutcome: true, requiresDecisionMemoFinalised: true },
    sideEffects: { emitTimeline: 'closed', stopClocks: true, setClosedAt: true }, slaAction: 'stop_all' },
  { fromState: 'closed', toState: 'reopened',
    allowedRoles: ['alerts.committee_confidential','alerts.dpo','alerts.board_escalation'],
    preconditions: { requiresJustification: true },
    sideEffects: { emitTimeline: 'reopened', clearClosedAt: true }, slaAction: 'start_interim' },
  { fromState: 'reopened', toState: 'under_investigation',
    allowedRoles: ['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    preconditions: {}, sideEffects: { emitTimeline: 'state_changed' }, slaAction: 'start_interim' },
  // Withdrawal pairs — reporter-initiated.
  { fromState: 'received', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'triage', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'assigned', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'under_investigation', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'awaiting_reporter_response', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
  { fromState: 'on_hold', toState: 'withdrawn',
    allowedRoles: ['reporter','alerts.dpo'],
    preconditions: { requiresReporterConfirmation: true },
    sideEffects: { emitTimeline: 'state_changed', stopClocks: true }, slaAction: 'stop_all' },
]

export function canTransition(
  fromState: AlertState,
  toState: AlertState,
  callerRoles: string[],
  customRules?: WorkflowTransitionRule[],
): boolean {
  const rules = (customRules && customRules.length > 0 ? customRules : DEFAULT_TRANSITIONS)
  const canonicalFrom = canonicaliseState(fromState)
  const canonicalTo = canonicaliseState(toState)
  const match = rules.find(
    (r) => canonicaliseState(r.fromState) === canonicalFrom && canonicaliseState(r.toState) === canonicalTo,
  )
  if (!match) return false
  return match.allowedRoles.some((role) => callerRoles.includes(role))
}

export function allowedTransitions(
  fromState: AlertState,
  callerRoles: string[],
  customRules?: WorkflowTransitionRule[],
): WorkflowTransitionRule[] {
  const rules = (customRules && customRules.length > 0 ? customRules : DEFAULT_TRANSITIONS)
  const canonicalFrom = canonicaliseState(fromState)
  return rules.filter(
    (r) =>
      canonicaliseState(r.fromState) === canonicalFrom &&
      r.allowedRoles.some((role) => callerRoles.includes(role)),
  )
}
