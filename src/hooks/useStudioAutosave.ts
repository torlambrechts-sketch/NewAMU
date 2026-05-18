// useStudioAutosave — 10-second debounced autosave into
// studio_draft_payload + studio_draft_at columns shipped in
// 20260914122100_studio_draft_payload.sql.
//
// Lifecycle:
//   - The embedder reports its current row state via setValue(payload).
//   - 10 s after the last setValue (or on blur if onBlur() called),
//     the hook writes the payload into the row's studio_draft_payload
//     column with studio_draft_at = now().
//   - State: 'idle' → 'pending' → 'saving' → 'saved' | 'error'.
//   - On unmount: if pending, fires one final save synchronously.
//   - On explicit publish: caller must clear the draft via clear().
//
// 24h-stale drafts are reaped by purge_stale_studio_drafts() pg_cron.
//
// Spec: specs/studio-builder.md §3 (autosave decision) + §4
// (AutosaveIndicator).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export type UseStudioAutosaveOptions = {
  /** Which DB table owns the row we autosave into. */
  rowTable: string
  /** Row id to update. Skip the autosave when null (e.g. before create). */
  rowId: string | null
  /** Debounce window in ms. Defaults to 10s per spec. */
  debounceMs?: number
}

export function useStudioAutosave({ rowTable, rowId, debounceMs = 10_000 }: UseStudioAutosaveOptions) {
  const { supabase } = useOrgSetupContext()
  const [state, setState] = useState<AutosaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const pendingPayloadRef = useRef<Record<string, unknown> | null>(null)
  const timerRef = useRef<number | null>(null)

  const persist = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!supabase || !rowId) return
      setState('saving')
      const { error } = await supabase
        .from(rowTable)
        .update({ studio_draft_payload: payload, studio_draft_at: new Date().toISOString() })
        .eq('id', rowId)
      if (error) {
        setState('error')
        return
      }
      setState('saved')
      setLastSavedAt(new Date())
    },
    [supabase, rowTable, rowId],
  )

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const payload = pendingPayloadRef.current
    if (!payload) return
    pendingPayloadRef.current = null
    await persist(payload)
  }, [persist])

  /** Schedule an autosave; idempotent — repeated calls debounce. */
  const setValue = useCallback(
    (payload: Record<string, unknown>) => {
      pendingPayloadRef.current = payload
      setState('pending')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void flush()
      }, debounceMs)
    },
    [flush, debounceMs],
  )

  /** Caller signals a blur — flush immediately. */
  const onBlur = useCallback(() => {
    void flush()
  }, [flush])

  /** Caller publishes — clear the draft column. */
  const clear = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingPayloadRef.current = null
    if (!supabase || !rowId) return
    await supabase
      .from(rowTable)
      .update({ studio_draft_payload: null, studio_draft_at: null })
      .eq('id', rowId)
    setState('idle')
  }, [supabase, rowTable, rowId])

  // On unmount, flush any pending write so abandoned tabs still persist
  // the last 10s of edits.
  useEffect(() => {
    return () => {
      if (pendingPayloadRef.current) {
        void persist(pendingPayloadRef.current)
      }
    }
  }, [persist])

  return { state, lastSavedAt, setValue, onBlur, flush, clear }
}
