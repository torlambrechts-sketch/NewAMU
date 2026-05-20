// Shared server-side i18n for Supabase edge functions.
//
// Before this, every edge function hardcoded Norwegian email/notification
// copy and copy-pasted its own `escapeHtml` + `nb-NO` date formatting. This
// module is the single source of truth: a locale catalog, message lookup,
// and the shared HTML/ICS/date helpers.
//
// Locale resolution mirrors the SQL `resolve_locale()` contract: requested
// locale -> fallback -> 'nb'. Recipient locale comes from `profiles.locale`;
// functions that send per-recipient email resolve it per address.
//
// Government submissions (Arbeidstilsynet / Datatilsynet / Helsetilsynet) and
// Norwegian statutory invoices are intentionally NOT routed through here —
// they are legally locked to Norwegian.

export type ServerLocale = 'nb' | 'en'

const SUPPORTED: ServerLocale[] = ['nb', 'en']
const DEFAULT_LOCALE: ServerLocale = 'nb'

const BCP47: Record<ServerLocale, string> = { nb: 'nb-NO', en: 'en-GB' }

/** Narrow any string (a `profiles.locale` value, an `Accept-Language`, …) to
 *  a supported locale. Matches the SQL resolver: unknown -> fallback -> nb. */
export function resolveLocale(
  requested: string | null | undefined,
  fallback: string | null | undefined = DEFAULT_LOCALE,
): ServerLocale {
  const short = requested?.slice(0, 2)
  if (short && SUPPORTED.includes(short as ServerLocale)) return short as ServerLocale
  const fb = fallback?.slice(0, 2)
  if (fb && SUPPORTED.includes(fb as ServerLocale)) return fb as ServerLocale
  return DEFAULT_LOCALE
}

// ── Shared escaping / formatting (was copy-pasted across ~5 functions) ──────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

/** RFC 5545 text escaping for ICS calendar fields. */
export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Locale-aware date+time formatting. Replaces hardcoded `toLocaleString('nb-NO')`. */
export function formatDateTime(iso: string, locale: ServerLocale): string {
  try {
    return new Date(iso).toLocaleString(BCP47[locale], {
      dateStyle: 'full',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

// ── Message catalog ─────────────────────────────────────────────────────────
//
// Keys are dotted and grouped by domain. `{name}` placeholders are filled by
// `t()`. Add a domain here rather than hardcoding strings in a function.

type Catalog = Record<string, string>

const NB: Catalog = {
  'meeting.invite.subject': 'Innkalling: {title}',
  'meeting.reminder.subject': 'Påminnelse: {title}',
  'meeting.invite.heading': 'Innkalling: {title}',
  'meeting.reminder.heading': 'Påminnelse: {title}',
  'meeting.field.when': 'Tidspunkt',
  'meeting.field.location': 'Sted',
  'meeting.whenUnset': 'Tidspunkt ikke fastsatt',
  'meeting.openButton': 'Åpne møtet',
  'meeting.linkFallback': 'Hvis knappen ikke virker, lim inn denne lenken i nettleseren:',
  'meeting.icsHint': 'Kalenderfilen (.ics) er vedlagt — åpne den for å legge møtet til i kalenderen din.',
  'meeting.ics.linkLabel': 'Lenke',

  'survey.invite.subject': 'Invitasjon: {title}',
  'survey.reminder.subject': 'Påminnelse: {title}',
  'survey.invite.greeting': 'Hei,',
  'survey.invite.body': 'Du er invitert til å svare på undersøkelsen «{title}».',
  'survey.reminder.body': 'Påminnelse: undersøkelsen «{title}» venter på svaret ditt.',
  'survey.openButton': 'Åpne undersøkelsen',

  'digest.subject': 'Sammendrag fra Klarert',
  'digest.greeting': 'Hei,',
  'digest.mentioned': 'Du ble nevnt i et dokument.',
  'digest.awaitingApproval': 'Venter på din godkjenning.',
  'digest.moderationWaiting': 'Moderering venter.',

  'doc.ackReminder.snippet': 'Påminnelse: dokumentet «{title}» krever signatur før {date}.',

  'common.footer': 'Sendt fra Klarert.',
}

const EN: Catalog = {
  'meeting.invite.subject': 'Invitation: {title}',
  'meeting.reminder.subject': 'Reminder: {title}',
  'meeting.invite.heading': 'Invitation: {title}',
  'meeting.reminder.heading': 'Reminder: {title}',
  'meeting.field.when': 'Time',
  'meeting.field.location': 'Location',
  'meeting.whenUnset': 'Time not yet set',
  'meeting.openButton': 'Open the meeting',
  'meeting.linkFallback': 'If the button does not work, paste this link into your browser:',
  'meeting.icsHint': 'A calendar file (.ics) is attached — open it to add the meeting to your calendar.',
  'meeting.ics.linkLabel': 'Link',

  'survey.invite.subject': 'Invitation: {title}',
  'survey.reminder.subject': 'Reminder: {title}',
  'survey.invite.greeting': 'Hello,',
  'survey.invite.body': 'You are invited to respond to the survey "{title}".',
  'survey.reminder.body': 'Reminder: the survey "{title}" is waiting for your response.',
  'survey.openButton': 'Open the survey',

  'digest.subject': 'Summary from Klarert',
  'digest.greeting': 'Hello,',
  'digest.mentioned': 'You were mentioned in a document.',
  'digest.awaitingApproval': 'Waiting for your approval.',
  'digest.moderationWaiting': 'Moderation pending.',

  'doc.ackReminder.snippet': 'Reminder: the document "{title}" requires a signature before {date}.',

  'common.footer': 'Sent from Klarert.',
}

const CATALOG: Record<ServerLocale, Catalog> = { nb: NB, en: EN }

/** Translate `key` for `locale`, filling `{name}` placeholders from `params`.
 *  Falls back to the nb string, then the raw key. */
export function t(
  locale: ServerLocale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const raw = CATALOG[locale]?.[key] ?? CATALOG.nb[key] ?? key
  return raw.replace(/\{(\w+)\}/g, (_m, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
