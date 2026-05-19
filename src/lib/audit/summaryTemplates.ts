// Preset Norwegian sentence templates for emit_audit_event.
//
// The server-side RPC ultimately accepts summary_nb as plain text — we
// render the Norwegian sentence here on the client *before* calling so
// the call site reads naturally. A small preset library keeps grammar
// consistent across modules; mutation code that needs custom wording
// can always pass a literal string.

import type { AuditAction } from './diffShape'

export type SummaryTemplate =
  | { kind: 'literal'; nb: string }
  | { kind: 'preset'; preset: SummaryPreset; subject?: string; target?: string }

export type SummaryPreset =
  // Generic
  | 'opprettet_subject'              // "<actor> opprettet <subject>"
  | 'endret_subject'                 // "<actor> oppdaterte <subject>"
  | 'kommentert_subject'             // "<actor> kommenterte <subject>"
  // Checklist
  | 'sjekkliste_opprettet'           // "<actor> opprettet sjekklisten"
  | 'sjekkliste_signert'             // "<actor> signerte sjekklisten"
  | 'sjekkliste_arkivert'            // "<actor> arkiverte sjekklisten"
  | 'sjekkliste_metadata_endret'     // "<actor> oppdaterte sjekklisten"
  | 'sjekklistepunkt_besvart'        // "<actor> besvarte <subject>"
  | 'sjekklistepunkt_funn'           // "<actor> registrerte funn på <subject>"
  | 'sjekkliste_kommentar'           // "<actor> kommenterte sjekklisten"

const PRESET_BODY: Record<SummaryPreset, string> = {
  opprettet_subject: 'opprettet {subject}',
  endret_subject: 'oppdaterte {subject}',
  kommentert_subject: 'kommenterte {subject}',
  sjekkliste_opprettet: 'opprettet sjekklisten',
  sjekkliste_signert: 'signerte sjekklisten',
  sjekkliste_arkivert: 'arkiverte sjekklisten',
  sjekkliste_metadata_endret: 'oppdaterte sjekklisten',
  sjekklistepunkt_besvart: 'besvarte punktet "{subject}"',
  sjekklistepunkt_funn: 'registrerte funn på "{subject}"',
  sjekkliste_kommentar: 'kommenterte sjekklisten',
}

const PRESET_TO_ACTION: Record<SummaryPreset, AuditAction> = {
  opprettet_subject: 'opprettet',
  endret_subject: 'endret',
  kommentert_subject: 'kommentert',
  sjekkliste_opprettet: 'opprettet',
  sjekkliste_signert: 'signert',
  sjekkliste_arkivert: 'arkivert',
  sjekkliste_metadata_endret: 'endret',
  sjekklistepunkt_besvart: 'endret',
  sjekklistepunkt_funn: 'endret',
  sjekkliste_kommentar: 'kommentert',
}

export function actionForPreset(preset: SummaryPreset): AuditAction {
  return PRESET_TO_ACTION[preset]
}

/**
 * Render the Norwegian sentence for a mutation.
 *
 * Always prefixes the actor's display name. Mutation sites that need
 * different wording (e.g. external actor logging) can fall back to a
 * literal template.
 */
export function renderSummary(input: {
  actorName: string
  template: SummaryTemplate
}): string {
  const { actorName, template } = input
  if (template.kind === 'literal') return template.nb
  // Drop the entire {subject ...} clause when the slot is empty rather
  // than leaving the leading verb dangling (B11 from external review).
  const subject = (template.subject ?? '').trim()
  const raw = PRESET_BODY[template.preset]
  const body = subject
    ? raw.replace('{subject}', subject)
    : raw.replace(/\s*"?\{subject\}"?\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return `${actorName} ${body}`.replace(/\s+/g, ' ').trim()
}
