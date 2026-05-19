// Client-side helper for the emit_audit_event RPC.
//
// Mutation code calls this after a successful DB write. The RPC resolves
// the actor identity server-side (initials + display name from profiles)
// so the client never spoofs identity. Diff payload is opaque jsonb on
// the DB side; we type it via Diff (specs §1) on the client.
//
// Failure mode: emit_audit_event errors are *logged but not thrown*.
// A missed audit row is a P1 bug, but it must not regress the mutation
// itself — losing the change-log entry is worse than the change being
// invisible to one user. Pair with the nightly recon SQL (spec §11).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditAction, AuditActorRole, Diff } from './diffShape'
import { renderSummary, type SummaryTemplate, actionForPreset } from './summaryTemplates'

export type EmitAuditEventInput = {
  scopeId: string
  entityKind: string
  entityId: string
  /** Defaults to action implied by `summary.preset`. Required when summary is literal. */
  action?: AuditAction
  /** The actor's display name. Used to render the Norwegian sentence locally; server still re-resolves actor identity. */
  actorName: string
  /** Optional role hint. Server validates against the enum; falls back to leder/ansatt if invalid. */
  actorRole?: AuditActorRole | null
  summary: SummaryTemplate
  diff?: Diff | null
  location?: string | null
  privileged?: boolean
  hseAuditLogId?: string | null
}

export async function emitAuditEvent(
  supabase: SupabaseClient,
  input: EmitAuditEventInput,
): Promise<string | null> {
  if (input.summary.kind === 'literal' && !input.action) {
    console.warn('[emitAuditEvent] literal summary requires explicit action')
    return null
  }

  const action: AuditAction =
    input.action ??
    (input.summary.kind === 'preset' ? actionForPreset(input.summary.preset) : 'endret')

  const summaryNb = renderSummary({
    actorName: input.actorName,
    template: input.summary,
  })

  try {
    const { data, error } = await supabase.rpc('emit_audit_event', {
      p_scope_id: input.scopeId,
      p_entity_kind: input.entityKind,
      p_entity_id: input.entityId,
      p_action: action,
      p_summary_nb: summaryNb,
      p_diff: input.diff ?? null,
      p_location: input.location ?? null,
      p_privileged: input.privileged ?? false,
      p_actor_role: input.actorRole ?? null,
      p_hse_audit_log_id: input.hseAuditLogId ?? null,
    })
    if (error) {
      console.warn('[emitAuditEvent] RPC error', error.message)
      return null
    }
    return typeof data === 'string' ? data : null
  } catch (unknownError) {
    console.warn('[emitAuditEvent] threw', unknownError)
    return null
  }
}
