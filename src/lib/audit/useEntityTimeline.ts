// Read hook for the Endringslogg side panel.
//
// Reads from audit_events_read (the privilege-aware view) — so privileged
// rows arrive with diff=null + redacted summary_nb when the viewer lacks
// audit.read.privileged. Returns events newest-first, grouped by day on
// the consumer side (EntityTimeline handles the grouping).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEvent, AuditActor, AuditAction, Diff } from './diffShape'

type Row = {
  id: string
  occurred_at: string
  actor_user_id: string | null
  actor_name: string
  actor_initials: string
  actor_role: string
  actor_is_external: boolean
  actor_external_label: string | null
  action: string
  entity_kind: string
  entity_id: string
  scope_id: string
  location: string | null
  summary_nb: string
  diff: Diff | null
  privileged: boolean
}

function rowToEvent(row: Row): AuditEvent {
  const actor: AuditActor = {
    id: row.actor_user_id,
    name: row.actor_name,
    initials: row.actor_initials,
    role: row.actor_role as AuditActor['role'],
    is_external: row.actor_is_external,
    external_label: row.actor_external_label,
  }
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    actor,
    action: row.action as AuditAction,
    entity_kind: row.entity_kind,
    entity_id: row.entity_id,
    scope_id: row.scope_id,
    location: row.location,
    summary_nb: row.summary_nb,
    diff: row.diff,
    privileged: row.privileged,
  }
}

export type UseEntityTimelineInput = {
  supabase: SupabaseClient | null
  entityKind: string
  entityId: string
  /** Page size; default 100, hard ceiling 500. */
  limit?: number
}

export type UseEntityTimelineState = {
  events: AuditEvent[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useEntityTimeline({
  supabase,
  entityKind,
  entityId,
  limit = 100,
}: UseEntityTimelineInput): UseEntityTimelineState {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const cap = useMemo(() => Math.min(limit, 500), [limit])

  const reload = useCallback(async () => {
    if (!supabase || !entityId) return
    setLoading(true)
    setError(null)
    try {
      // Filter on the room columns so child events (comments, responses)
      // belonging to this execution surface here too.
      const { data, error: qErr } = await supabase
        .from('audit_events_read')
        .select(
          'id, occurred_at, actor_user_id, actor_name, actor_initials, actor_role, ' +
            'actor_is_external, actor_external_label, action, entity_kind, entity_id, ' +
            'room_entity_kind, room_entity_id, scope_id, location, summary_nb, diff, privileged',
        )
        .eq('room_entity_kind', entityKind)
        .eq('room_entity_id', entityId)
        .order('occurred_at', { ascending: false })
        .limit(cap)
      if (qErr) throw qErr
      const rows = (data ?? []) as unknown as Row[]
      setEvents(rows.map(rowToEvent))
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'Klarte ikke laste endringsloggen.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [supabase, entityKind, entityId, cap])

  useEffect(() => {
    void reload()
  }, [reload])

  return { events, loading, error, reload }
}

// Group events by Norwegian short-date for the day-header rows in the
// timeline. Stable order preserved (input newest-first → groups newest-first
// with newest-first events inside each group).
export function groupEventsByDay(events: AuditEvent[]): Array<{
  dayKey: string
  dayLabel: string
  events: AuditEvent[]
}> {
  const groups = new Map<string, AuditEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.occurred_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    const arr = groups.get(key) ?? []
    arr.push(ev)
    groups.set(key, arr)
  }
  return Array.from(groups.entries()).map(([key, list]) => {
    const d = new Date(list[0].occurred_at)
    const label = d.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return { dayKey: key, dayLabel: label, events: list }
  })
}
