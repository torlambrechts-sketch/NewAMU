// Label maps for the meetings module — keep alongside types so callers
// import once. Norwegian (nb) only — these strings drive the UI.

import type {
  MeetingActionStatus,
  MeetingAttendeeRole,
  MeetingCadence,
  MeetingConfidentialityLevel,
  MeetingDecisionStatus,
  MeetingFramework,
  MeetingSignerRole,
  MeetingStatus,
} from './types'

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  completed: 'Gjennomført',
  cancelled: 'Avlyst',
}

export const MEETING_CONFIDENTIALITY_LABEL: Record<MeetingConfidentialityLevel, string> = {
  standard: 'Standard',
  restricted: 'Begrenset',
  confidential: 'Konfidensielt',
}

export const MEETING_DECISION_STATUS_LABEL: Record<MeetingDecisionStatus, string> = {
  open: 'Åpent',
  implemented: 'Iverksatt',
  dropped: 'Avvist',
}

export const MEETING_ACTION_STATUS_LABEL: Record<MeetingActionStatus, string> = {
  open: 'Åpen',
  in_progress: 'Pågår',
  done: 'Utført',
  dropped: 'Avvist',
}

export const MEETING_ATTENDEE_ROLE_LABEL: Record<MeetingAttendeeRole, string> = {
  chair: 'Møteleder',
  secretary: 'Sekretær',
  member: 'Medlem',
  observer: 'Observatør',
  guest: 'Gjest',
  verneombud: 'Verneombud',
  hovedverneombud: 'Hovedverneombud',
  employer_rep: 'Arbeidsgiverrepr.',
  employee_rep: 'Ansattrepr.',
  tillitsvalgt: 'Tillitsvalgt',
}

export const MEETING_SIGNER_ROLE_LABEL: Record<MeetingSignerRole, string> = {
  chair: 'Møteleder',
  secretary: 'Sekretær',
  management: 'Ledelse',
  member: 'Medlem',
  other: 'Annet',
}

export const MEETING_CADENCE_LABEL: Record<MeetingCadence, string> = {
  monthly: 'Månedlig',
  quarterly: 'Kvartalsvis',
  semiannual: 'Halvårlig',
  annual: 'Årlig',
  ad_hoc: 'Ved behov',
}

export const MEETING_FRAMEWORK_LABEL: Record<MeetingFramework, string> = {
  INTERNAL: 'Internt',
  AML: 'AML',
  'IK-f': 'IK-forskriften',
  Hovedavtalen: 'Hovedavtalen',
  Likestillingsloven: 'Likestillingsloven',
  ISO_9001: 'ISO 9001',
  ISO_14001: 'ISO 14001',
  ISO_27001: 'ISO 27001',
  ISO_45001: 'ISO 45001',
  GDPR: 'GDPR',
}

export function frameworkLabel(framework: string): string {
  return MEETING_FRAMEWORK_LABEL[framework as MeetingFramework] ?? framework
}
