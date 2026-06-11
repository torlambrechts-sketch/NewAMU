// useOkrCheckins — check-in history + record-mutation for the OKR plan.
//
// Fetches the org's recent check-ins in one select and groups them per KR
// (newest first, capped client-side) so the strategy page can render
// sparklines + staleness hints without N+1 queries. recordCheckin() goes
// through the okr_record_checkin RPC which appends the log row and syncs
// the KR's live confidence/value atomically.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type OkrCheckin = {
  id: string
  keyResultId: string
  value: number | null
  confidence: number
  note: string | null
  meetingId: string | null
  createdBy: string | null
  createdAt: string
}

export type RecordCheckinInput = {
  keyResultId: string
  confidence: number
  value?: number | null
  note?: string
  meetingId?: string | null
}

const PER_KR_CAP = 8

export type UseOkrCheckinsReturn = {
  /** Newest-first check-ins per KR id (max PER_KR_CAP each). */
  byKr: Map<string, OkrCheckin[]>
  loading: boolean
  error: string | null
  reload: () => void
  recordCheckin: (input: RecordCheckinInput) => Promise<boolean>
}

export function useOkrCheckins(): UseOkrCheckinsReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<OkrCheckin[]>([])
  // Starts true; flipped false after the first fetch settles. reload() (an
  // event handler) re-arms it — keeps setState out of the effect body.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => {
    setLoading(true)
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void supabase
      .from('okr_checkins')
      .select('id, key_result_id, value, confidence, note, meeting_id, created_by, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(400)
      .then(({ data, error: qErr }) => {
        if (cancelled) return
        setLoading(false)
        if (qErr) {
          setError(qErr.message)
          return
        }
        setError(null)
        setRows(
          (data ?? []).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id),
              keyResultId: String(row.key_result_id),
              value: row.value != null ? Number(row.value) : null,
              confidence: Number(row.confidence ?? 0),
              note: row.note ? String(row.note) : null,
              meetingId: row.meeting_id ? String(row.meeting_id) : null,
              createdBy: row.created_by ? String(row.created_by) : null,
              createdAt: String(row.created_at),
            }
          }),
        )
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, version])

  const byKr = useMemo(() => {
    const m = new Map<string, OkrCheckin[]>()
    for (const c of rows) {
      const list = m.get(c.keyResultId)
      if (!list) m.set(c.keyResultId, [c])
      else if (list.length < PER_KR_CAP) list.push(c)
    }
    return m
  }, [rows])

  const recordCheckin = useCallback(
    async (input: RecordCheckinInput): Promise<boolean> => {
      if (!supabase) return false
      const { error: rpcErr } = await supabase.rpc('okr_record_checkin', {
        p_kr_id: input.keyResultId,
        p_confidence: input.confidence,
        p_value: input.value ?? null,
        p_note: input.note ?? null,
        p_meeting_id: input.meetingId ?? null,
      })
      if (rpcErr) {
        setError(rpcErr.message)
        return false
      }
      reload()
      return true
    },
    [supabase, reload],
  )

  return { byKr, loading, error, reload, recordCheckin }
}
