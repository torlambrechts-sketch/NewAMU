// Endringslogg event shape. Source of truth: specs/endringslogg-spec.md §1.
// The DB stores the same shape in audit_events.diff (jsonb). Norwegian
// summaries are pre-rendered server-side by emit_audit_event and arrive
// in summary_nb verbatim — never compose them client-side.

export type AuditActorRole =
  | 'verneombud'
  | 'amu_medlem'
  | 'leder'
  | 'hms_radgiver'
  | 'ansatt'
  | 'system'
  | 'ekstern'

export type AuditAction =
  | 'opprettet'
  | 'endret'
  | 'lukket'
  | 'gjenapnet'
  | 'tildelt'
  | 'omfordelt'
  | 'kommentert'
  | 'signert'
  | 'attestert'
  | 'avvist'
  | 'godkjent'
  | 'lastet_opp_vedlegg'
  | 'slettet_vedlegg'
  | 'versjon_bumpet'
  | 'eskalert'
  | 'eksportert'
  | 'delt'
  | 'arkivert'
  // W0 — added for cross-module rollout
  | 'besvart'
  | 'publisert'
  | 'protokollert'
  | 'votert'
  | 'innkalt'
  | 'mottatt'
  | 'fullfort'
  | 'slettet_kommentar'

export type AuditActor = {
  id: string | null
  name: string
  initials: string
  role: AuditActorRole
  is_external: boolean
  external_label?: string | null
}

export type DiffValue = {
  display: string
  raw?: string
  semantic?: 'status' | 'severity' | 'date' | 'user' | 'plain'
}

export type Diff =
  | {
      kind: 'single_field'
      field_label_nb: string
      before: DiffValue
      after: DiffValue
    }
  | {
      kind: 'multi_field'
      changes: Array<{
        field_label_nb: string
        before: DiffValue
        after: DiffValue
      }>
    }
  | {
      kind: 'list_change'
      field_label_nb: string
      added: DiffValue[]
      removed: DiffValue[]
    }
  | {
      kind: 'text_block'
      field_label_nb: string
      before: string
      after: string
    }

export type AuditEvent = {
  id: string
  occurred_at: string
  actor: AuditActor
  action: AuditAction
  entity_kind: string
  entity_id: string
  scope_id: string
  location: string | null
  summary_nb: string
  diff: Diff | null
  privileged: boolean
}

// Helper: derive initials from a Norwegian display name (server agrees on
// the same shape, but UI may need it for optimistic rows). Two-letter,
// first letters of the first and last whitespace-separated token.
export function deriveInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'BR'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? 'B').toUpperCase() + (parts[0]?.[1] ?? '').toUpperCase()
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return (first + last).toUpperCase() || 'BR'
}
