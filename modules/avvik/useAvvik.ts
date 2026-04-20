import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
import type { AvvikRow, AvvikSeverity, AvvikStatus, AvvikCreatePayload, AvvikUpdatePayload } from './types'

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

const VALID_SEVERITIES: AvvikSeverity[] = ['low', 'medium', 'high', 'critical']
const VALID_STATUSES: AvvikStatus[] = [
  'open', 'in_progress', 'closed',
  'rapportert', 'under_behandling', 'tiltak_iverksatt', 'lukket',
]

function parseRow(row: unknown): AvvikRow | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (!r.id || !r.organization_id) return null
  const sev = VALID_SEVERITIES.includes(r.severity as AvvikSeverity) ? (r.severity as AvvikSeverity) : null
  const sts = VALID_STATUSES.includes(r.status as AvvikStatus) ? (r.status as AvvikStatus) : null
  if (!sev || !sts) return null
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    source: r.source == null ? '' : String(r.source),
    source_id: r.source_id == null ? null : String(r.source_id),
    title: r.title == null ? '' : String(r.title),
    description: r.description == null ? '' : String(r.description),
    severity: sev,
    status: sts,
    due_at: r.due_at == null ? null : String(r.due_at),
    assigned_to: r.assigned_to == null ? null : String(r.assigned_to),
    root_cause_analysis: r.root_cause_analysis == null ? null : String(r.root_cause_analysis),
    closed_at: r.closed_at == null ? null : String(r.closed_at),
    closed_by: r.closed_by == null ? null : String(r.closed_by),
    created_by: r.created_by == null ? null : String(r.created_by),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

function extractErrorMessage(e: unknown): string {
  if (!e) return 'Ukjent feil'
  if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  if (e instanceof Error) return e.message
  return String(e)
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
      setError(extractErrorMessage(e))
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
      if (!parsed) { setError('Kunne ikke lese opprettet avvik fra databasen.'); return null }
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
      if (!parsed) { setError('Kunne ikke lese oppdatert avvik fra databasen.'); return }
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
        .delete()
        .eq('id', avvikId)
      if (err) { setError(err.message); return }
      setAvvik((prev) => prev.filter((a) => a.id !== avvikId))
    },
    [supabase],
  )

  const clearError = useCallback(() => setError(null), [])

  return { loading, error, avvik, assignableUsers, load, createAvvik, updateAvvik, deleteAvvik, clearError }
}
