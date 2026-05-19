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
  // Survey
  | 'undersokelse_opprettet'         // "<actor> opprettet undersøkelsen"
  | 'undersokelse_publisert'         // "<actor> publiserte undersøkelsen"
  | 'undersokelse_lukket'            // "<actor> lukket undersøkelsen"
  | 'undersokelse_endret'            // "<actor> oppdaterte undersøkelsen"
  // Meetings
  | 'mote_opprettet'                 // "<actor> opprettet møtet"
  | 'mote_endret'                    // "<actor> oppdaterte møtet"
  | 'mote_innkalt'                   // "<actor> sendte innkallinger"
  | 'mote_protokollert'              // "<actor> signerte protokollen"
  | 'mote_votert'                    // "<actor> avga stemme i {subject}"
  | 'mote_delt'                      // "<actor> delte møtesammendraget"
  // Tasks
  | 'oppgave_opprettet'              // "<actor> opprettet oppgaven"
  | 'oppgave_status_endret'          // "<actor> endret status til {subject}"
  | 'oppgave_pdca_endret'            // "<actor> flyttet til {subject}-fasen"
  | 'oppgave_lukket'                 // "<actor> lukket oppgaven"
  // Documents
  | 'dokument_opprettet'             // "<actor> opprettet siden"
  | 'dokument_publisert'             // "<actor> publiserte siden"
  | 'dokument_endret'                // "<actor> oppdaterte siden"
  | 'dokument_arkivert'              // "<actor> arkiverte siden"
  // Alerts
  | 'varsling_mottatt'               // "<actor> registrerte en varslingssak"
  | 'varsling_status'                // "<actor> endret status til {subject}"
  | 'varsling_tildelt'               // "<actor> tildelte saken til komiteen"
  | 'varsling_lukket'                // "<actor> lukket saken"
  | 'varsling_kommentar'             // "<actor> la til et notat"
  | 'varsling_vedlegg'               // "<actor> lastet opp et vedlegg"

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
  undersokelse_opprettet: 'opprettet undersøkelsen',
  undersokelse_publisert: 'publiserte undersøkelsen',
  undersokelse_lukket: 'lukket undersøkelsen',
  undersokelse_endret: 'oppdaterte undersøkelsen',
  mote_opprettet: 'opprettet møtet',
  mote_endret: 'oppdaterte møtet',
  mote_innkalt: 'sendte innkallinger',
  mote_protokollert: 'signerte protokollen',
  mote_votert: 'avga stemme i "{subject}"',
  mote_delt: 'delte møtesammendraget',
  oppgave_opprettet: 'opprettet oppgaven',
  oppgave_status_endret: 'endret status til {subject}',
  oppgave_pdca_endret: 'flyttet til {subject}-fasen',
  oppgave_lukket: 'lukket oppgaven',
  dokument_opprettet: 'opprettet siden',
  dokument_publisert: 'publiserte siden',
  dokument_endret: 'oppdaterte siden',
  dokument_arkivert: 'arkiverte siden',
  varsling_mottatt: 'registrerte en varslingssak',
  varsling_status: 'endret status til {subject}',
  varsling_tildelt: 'tildelte saken til komiteen',
  varsling_lukket: 'lukket saken',
  varsling_kommentar: 'la til et notat',
  varsling_vedlegg: 'lastet opp et vedlegg',
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
  undersokelse_opprettet: 'opprettet',
  undersokelse_publisert: 'publisert',
  undersokelse_lukket: 'lukket',
  undersokelse_endret: 'endret',
  mote_opprettet: 'opprettet',
  mote_endret: 'endret',
  mote_innkalt: 'innkalt',
  mote_protokollert: 'protokollert',
  mote_votert: 'votert',
  mote_delt: 'delt',
  oppgave_opprettet: 'opprettet',
  oppgave_status_endret: 'endret',
  oppgave_pdca_endret: 'endret',
  oppgave_lukket: 'lukket',
  dokument_opprettet: 'opprettet',
  dokument_publisert: 'publisert',
  dokument_endret: 'endret',
  dokument_arkivert: 'arkivert',
  varsling_mottatt: 'mottatt',
  varsling_status: 'endret',
  varsling_tildelt: 'tildelt',
  varsling_lukket: 'lukket',
  varsling_kommentar: 'kommentert',
  varsling_vedlegg: 'lastet_opp_vedlegg',
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
