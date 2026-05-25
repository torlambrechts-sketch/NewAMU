// useInternalControls — load + CRUD on `internal_controls` and the
// associated `internal_control_status_v` view.
//
// Mirrors the structure of `modules/compliance/useRequirements.ts`:
//   - One load() that runs both queries in parallel
//   - Org-scoped writes (RLS protects system rows)
//   - parseRows resilience drops malformed rows without crashing the UI

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  ControlStatusViewRowSchema,
  InternalControlRowSchema,
  parseRows,
} from './schema'
import type {
  ControlFamily,
  ControlFrequencyHint,
  ControlStatus,
  ControlStatusViewRow,
  InternalControlRow,
} from './types'

type UseInternalControlsInput = {
  supabase: SupabaseClient | null
}

export type CreateControlInput = {
  slug: string
  name: string
  purpose?: string
  control_family?: ControlFamily
  frequency_hint?: ControlFrequencyHint | null
  owner_role?: string | null
  owner_user_id?: string | null
  status?: ControlStatus
  metadata?: Record<string, unknown>
}

export type UpdateControlInput = {
  id: string
  name?: string
  purpose?: string
  control_family?: ControlFamily
  frequency_hint?: ControlFrequencyHint | null
  owner_role?: string | null
  owner_user_id?: string | null
  status?: ControlStatus
  is_active?: boolean
  nav_pinned?: boolean
  metadata?: Record<string, unknown>
}

export type UseInternalControlsReturn = {
  loading: boolean
  error: string | null
  controls: InternalControlRow[]
  status: ControlStatusViewRow[]
  /** Indexed by slug for cheap lookups. */
  bySlug: Record<string, InternalControlRow>
  /** Indexed by id. */
  byId: Record<string, InternalControlRow>
  /** Status view row keyed by control_id. */
  statusByControlId: Record<string, ControlStatusViewRow>
  refresh: () => Promise<void>
  createControl: (input: CreateControlInput) => Promise<string | null>
  updateControl: (input: UpdateControlInput) => Promise<void>
  softDeleteControl: (id: string) => Promise<void>
  togglePinned: (id: string, pinned: boolean) => Promise<void>
}

export function useInternalControls(
  input: UseInternalControlsInput,
): UseInternalControlsReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controls, setControls] = useState<InternalControlRow[]>([])
  const [status, setStatus] = useState<ControlStatusViewRow[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [controlsResp, statusResp] = await Promise.all([
        supabase
          .from('internal_controls')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('internal_control_status_v')
          .select('*'),
      ])

      if (controlsResp.error) throw controlsResp.error
      if (statusResp.error) throw statusResp.error

      const parsedControls = parseRows(
        controlsResp.data ?? [],
        InternalControlRowSchema,
      )
      const parsedStatus = parseRows(
        statusResp.data ?? [],
        ControlStatusViewRowSchema,
      )
      setControls(parsedControls.ok)
      setStatus(parsedStatus.ok)
      const failedTotal = parsedControls.failed + parsedStatus.failed
      if (failedTotal > 0) {
        setError(`Kunne ikke tolke ${failedTotal} kontrollrader.`)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const bySlug = useMemo(() => {
    const map: Record<string, InternalControlRow> = {}
    for (const c of controls) map[c.slug] = c
    return map
  }, [controls])

  const byId = useMemo(() => {
    const map: Record<string, InternalControlRow> = {}
    for (const c of controls) map[c.id] = c
    return map
  }, [controls])

  const statusByControlId = useMemo(() => {
    const map: Record<string, ControlStatusViewRow> = {}
    for (const s of status) map[s.control_id] = s
    return map
  }, [status])

  const createControl = useCallback(
    async (i: CreateControlInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('internal_controls')
          .insert({
            slug: i.slug,
            name: i.name,
            purpose: i.purpose ?? '',
            control_family: i.control_family ?? 'preventive',
            frequency_hint: i.frequency_hint ?? null,
            owner_role: i.owner_role ?? null,
            owner_user_id: i.owner_user_id ?? null,
            status: i.status ?? 'draft',
            is_system: false,
            is_active: true,
            metadata: i.metadata ?? {},
          })
          .select('*')
          .single()
        if (insErr) throw insErr

        const parsed = InternalControlRowSchema.safeParse(data)
        if (parsed.success) {
          setControls((prev) => [...prev, parsed.data])
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId],
  )

  const updateControl = useCallback(
    async (i: UpdateControlInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)

      const target = controls.find((c) => c.id === i.id)
      if (target?.is_system) {
        setError('Systemkontroller kan ikke endres fra appen. Klone først.')
        return
      }

      const update: Record<string, unknown> = {}
      if (i.name !== undefined) update.name = i.name
      if (i.purpose !== undefined) update.purpose = i.purpose
      if (i.control_family !== undefined) update.control_family = i.control_family
      if (i.frequency_hint !== undefined)
        update.frequency_hint = i.frequency_hint
      if (i.owner_role !== undefined) update.owner_role = i.owner_role
      if (i.owner_user_id !== undefined) update.owner_user_id = i.owner_user_id
      if (i.status !== undefined) update.status = i.status
      if (i.is_active !== undefined) update.is_active = i.is_active
      if (i.nav_pinned !== undefined) update.nav_pinned = i.nav_pinned
      if (i.metadata !== undefined) update.metadata = i.metadata
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('internal_controls')
          .update(update)
          .eq('id', i.id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = InternalControlRowSchema.safeParse(data)
        if (parsed.success) {
          setControls((prev) =>
            prev.map((c) => (c.id === i.id ? parsed.data : c)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, controls],
  )

  const softDeleteControl = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      const target = controls.find((c) => c.id === id)
      if (target?.is_system) {
        setError('Systemkontroller kan ikke slettes.')
        return
      }
      try {
        const { error: upErr } = await supabase
          .from('internal_controls')
          .update({
            deleted_at: new Date().toISOString(),
            is_active: false,
            status: 'retired',
          })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setControls((prev) => prev.filter((c) => c.id !== id))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, controls],
  )

  const togglePinned = useCallback(
    async (id: string, pinned: boolean): Promise<void> => {
      if (!supabase || !orgId) return
      try {
        const { error: upErr } = await supabase
          .from('internal_controls')
          .update({ nav_pinned: pinned })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setControls((prev) =>
          prev.map((c) => (c.id === id ? { ...c, nav_pinned: pinned } : c)),
        )
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      controls,
      status,
      bySlug,
      byId,
      statusByControlId,
      refresh: load,
      createControl,
      updateControl,
      softDeleteControl,
      togglePinned,
    }),
    [
      loading,
      error,
      controls,
      status,
      bySlug,
      byId,
      statusByControlId,
      load,
      createControl,
      updateControl,
      softDeleteControl,
      togglePinned,
    ],
  )
}
