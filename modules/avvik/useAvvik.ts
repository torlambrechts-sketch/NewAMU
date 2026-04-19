import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
import type { AvvikRow, AvvikCreatePayload, AvvikUpdatePayload } from './types'
import { AvvikRowSchema } from './schema'

type Input = { supabase: SupabaseClient | null }

export type AvvikAssignableUser = { id: string; displayName: string }

export type AvvikModuleState = {
  loading: boolean
  error: string | null
  avvik: AvvikRow[]
  assignableUsers: AvvikAssignableUser[]
  load: () => Promise<void>
  createAvvik: (payload: AvvikCreatePayload) => Promise<AvvikRow | null>
  updateAvvik: (payload: AvvikUpdatePayload) => Promise<void>
  deleteAvvik: (avvikId: string) => Promise<void>
  clearError: () => void
}

function parseRow(row: unknown): AvvikRow | null {
  const parsed = AvvikRowSchema.safeParse(row)
  return parsed.success ? parsed.data : null
}

function normalizeDate(input: string | undefined | null): string | null {
  if (!input || !input.trim()) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function useAvvik({ supabase }: Input): AvvikModuleState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avvik, setAvvik] = useState<AvvikRow[]>([])
  const [assignableUsers, setAssignableUsers] = useState<AvvikAssignableUser[]>([])

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase er ikke konfigurert.'); return }
    setLoading(true)
    setError(null)
    try {
      const [avvikRes, assignableUsersList] = await Promise.all([
        supabase
          .from('deviations')
          .select('*')
          .is('deleted_at', null)
          .order('severity', { ascending: false })
          .order('created_at', { ascending: false }),
        fetchAssignableUsers(supabase),
      ])
      if (avvikRes.error) throw avvikRes.error

      setAvvik(
        (avvikRes.data ?? [])
          .map(parseRow)
          .filter((r): r is AvvikRow => r !== null),
      )
      setAssignableUsers(assignableUsersList)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste avvik.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const createAvvik = useCallback(
    async (payload: AvvikCreatePayload): Promise<AvvikRow | null> => {
      if (!supabase) { setError('Supabase er ikke konfigurert.'); return null }
      setError(null)
      const row = {
        title: payload.title.trim(),
        description: payload.description.trim(),
        severity: payload.severity,
        status: 'rapportert',
        source: payload.source ?? 'manual',
        source_id: payload.sourceId ?? null,
        due_at: normalizeDate(payload.dueAt),
        assigned_to: payload.assignedTo ?? null,
      }
      const { data, error: err } = await supabase
        .from('deviations')
        .insert(row)
        .select('*')
        .single()
      if (err) { setError(err.message); return null }
      const parsed = parseRow(data)
      if (!parsed) { setError('Kunne ikke parse opprettet avvik.'); return null }
      setAvvik((prev) => [parsed, ...prev])
      return parsed
    },
    [supabase],
  )

  const updateAvvik = useCallback(
    async (payload: AvvikUpdatePayload) => {
      if (!supabase) { setError('Supabase er ikke konfigurert.'); return }
      setError(null)
      const row: Record<string, unknown> = {}
      if (payload.title !== undefined) row.title = payload.title.trim()
      if (payload.description !== undefined) row.description = payload.description.trim()
      if (payload.severity !== undefined) row.severity = payload.severity
      if (payload.status !== undefined) row.status = payload.status
      if (payload.dueAt !== undefined) row.due_at = normalizeDate(payload.dueAt)
      if (payload.assignedTo !== undefined) row.assigned_to = payload.assignedTo || null
      if (payload.rootCauseAnalysis !== undefined) row.root_cause_analysis = payload.rootCauseAnalysis || null

      const { data, error: err } = await supabase
        .from('deviations')
        .update(row)
        .eq('id', payload.avvikId)
        .select('*')
        .single()
      if (err) { setError(err.message); return }
      const parsed = parseRow(data)
      if (!parsed) { setError('Kunne ikke parse oppdatert avvik.'); return }
      setAvvik((prev) => prev.map((a) => (a.id === payload.avvikId ? parsed : a)))
    },
    [supabase],
  )

  const deleteAvvik = useCallback(
    async (avvikId: string) => {
      if (!supabase) { setError('Supabase er ikke konfigurert.'); return }
      setError(null)
      const { error: err } = await supabase
        .from('deviations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', avvikId)
      if (err) { setError(err.message); return }
      setAvvik((prev) => prev.filter((a) => a.id !== avvikId))
    },
    [supabase],
  )

  const clearError = useCallback(() => setError(null), [])

  return { loading, error, avvik, assignableUsers, load, createAvvik, updateAvvik, deleteAvvik, clearError }
}
