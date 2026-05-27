// Label maps for the alerts module — Norwegian (nb) only.

import type {
  AlertAnonymityTier,
  AlertBreachType,
  AlertClosingOutcome,
  AlertConfidentialityLevel,
  AlertKind,
  AlertNoteKind,
  AlertSeverity,
  AlertStatus,
  AlertTimelineEventKind,
} from './types'

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  whistleblowing: 'Varsel (AML kap. 2A)',
  gdpr_breach: 'GDPR-brudd',
  hms_incident: 'HMS-avvik',
  security_incident: 'Sikkerhetshendelse',
  ethical_concern: 'Etisk bekymring',
}

export const ALERT_KIND_SHORT_LABEL: Record<AlertKind, string> = {
  whistleblowing: 'Varsel',
  gdpr_breach: 'GDPR',
  hms_incident: 'HMS',
  security_incident: 'Sikkerhet',
  ethical_concern: 'Etisk',
}

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  received: 'Mottatt',
  triage: 'Triage',
  investigation: 'Undersøkelse',
  internal_review: 'Intern gjennomgang',
  closed: 'Lukket',
  dismissed: 'Avvist',
  // v1.1 additions
  assigned: 'Tildelt',
  under_investigation: 'Under undersøkelse',
  awaiting_reporter_response: 'Venter på varsler',
  on_hold: 'Satt på vent',
  decision: 'Vedtak',
  rejected: 'Avvist',
  escalated: 'Eskalert',
  reopened: 'Gjenåpnet',
  withdrawn: 'Trukket',
}

export const ALERT_CONFIDENTIALITY_LABEL: Record<AlertConfidentialityLevel, string> = {
  standard: 'Standard',
  restricted: 'Begrenset',
  confidential: 'Konfidensielt',
}

export const ALERT_SEVERITY_LABEL: Record<AlertSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

export const ALERT_BREACH_TYPE_LABEL: Record<AlertBreachType, string> = {
  confidentiality: 'Konfidensialitet',
  integrity: 'Integritet',
  availability: 'Tilgjengelighet',
  combined: 'Kombinert',
}

export const ALERT_CLOSING_OUTCOME_LABEL: Record<AlertClosingOutcome, string> = {
  substantiated: 'Bekreftet',
  unsubstantiated: 'Ikke bekreftet',
  inconclusive: 'Ufullstendig',
  referred: 'Henvist videre',
}

export const ALERT_NOTE_KIND_LABEL: Record<AlertNoteKind, string> = {
  internal: 'Internt notat',
  communication_to_reporter: 'Til varsler',
  communication_from_reporter: 'Fra varsler',
  system: 'System',
}

export const ALERT_TIMELINE_EVENT_LABEL: Record<AlertTimelineEventKind, string> = {
  submitted: 'Innsendt',
  acknowledged: 'Bekreftet mottatt',
  assigned: 'Tildelt',
  escalated: 'Eskalert',
  status_changed: 'Status endret',
  severity_set: 'Alvorlighet satt',
  attachment_added: 'Vedlegg lagt til',
  note_added_public: 'Notat til varsler',
  note_added_internal: 'Internt notat',
  closed: 'Lukket',
  reopened: 'Gjenåpnet',
  retention_purged: 'Slettet etter oppbevaringsfrist',
  erased: 'Slettet etter Art. 17',
}

export const ALERT_ANONYMITY_LABEL: Record<AlertAnonymityTier, string> = {
  full_anonymous: 'Anonym',
  pseudonymous: 'Pseudonymt (med kontaktkanal)',
  identified_public: 'Identifisert (offentlig skjema)',
  identified_auth: 'Identifisert (innlogget)',
}

/** Accent palette for the alerts dashboard scope. Rød = "alarm". */
export const ALERTS_ACCENT = '#b91c1c'
