// useControlBindings — CRUD on `internal_control_bindings`.
//
// Bindings are the declarative spec ("what counts as proof"). UI lets
// admins wire a control to module templates. Template validation
// (existence + same-org) is enforced server-side by the BEFORE INSERT
// trigger from M4 — the hook surfaces those errors as toast messages.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { ControlBindingRowSchema, parseRows } from './schema'
import type {
  ControlBindingRequirementKind,
  ControlBindingRow,
  ControlBindingSourceKind,
  ControlBindingSourceTemplateTable,
  ControlFrequencyHint,
} from './types'

type UseControlBindingsInput = {
  supabase: SupabaseClient | null
}

export type CreateBindingInput = {
  control_id: string
  source_kind: ControlBindingSourceKind
  source_template_table: ControlBindingSourceTemplateTable
  source_template_id: string
  source_template_slug?: string | null
  requirement_kind?: ControlBindingRequirementKind
  cadence_hint?: ControlFrequencyHint | null
  lead_time_days?: number
  required_count?: number
  period_months?: number
  is_required?: boolean
  notes?: string
}

export type UpdateBindingInput = {
  id: string
  requirement_kind?: ControlBindingRequirementKind
  cadence_hint?: ControlFrequencyHint | null
  lead_time_days?: number
  required_count?: number
  period_months?: number
  is_required?: boolean
  is_active?: boolean
  notes?: string
}

export type UseControlBindingsReturn = {
  loading: boolean
  error: string | null
  bindings: ControlBindingRow[]
  byControlId: Record<string, ControlBindingRow[]>
  refresh: () => Promise<void>
  createBinding: (input: CreateBindingInput) => Promise<string | null>
  updateBinding: (input: UpdateBindingInput) => Promise<void>
  softDeleteBinding: (id: string) => Promise<void>
}

export function useControlBindings(
  input: UseControlBindingsInput,
): UseControlBindingsReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bindings, setBindings] = useState<ControlBindingRow[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: respErr } = await supabase
        .from('internal_control_bindings')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (respErr) throw respErr
      const parsed = parseRows(data ?? [], ControlBindingRowSchema)
      setBindings(parsed.ok)
      if (parsed.failed > 0) {
        setError(`Kunne ikke tolke ${parsed.failed} binding-rader.`)
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

  const byControlId = useMemo(() => {
    const map: Record<string, ControlBindingRow[]> = {}
    for (const b of bindings) {
      if (!map[b.control_id]) map[b.control_id] = []
      map[b.control_id].push(b)
    }
    return map
  }, [bindings])

  const createBinding = useCallback(
    async (i: CreateBindingInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('internal_control_bindings')
          .insert({
            control_id: i.control_id,
            source_kind: i.source_kind,
            source_template_table: i.source_template_table,
            source_template_id: i.source_template_id,
            source_template_slug: i.source_template_slug ?? null,
            requirement_kind: i.requirement_kind ?? 'latest_within_cadence',
            cadence_hint: i.cadence_hint ?? null,
            lead_time_days: i.lead_time_days ?? 30,
            required_count: i.required_count ?? 1,
            period_months: i.period_months ?? 12,
            is_required: i.is_required ?? true,
            notes: i.notes ?? '',
            is_system: false,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = ControlBindingRowSchema.safeParse(data)
        if (parsed.success) {
          setBindings((prev) => [...prev, parsed.data])
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

  const updateBinding = useCallback(
    async (i: UpdateBindingInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      const target = bindings.find((b) => b.id === i.id)
      if (target?.is_system) {
        setError('Systembindinger kan ikke endres. Deaktiver i stedet.')
        return
      }
      const update: Record<string, unknown> = {}
      if (i.requirement_kind !== undefined)
        update.requirement_kind = i.requirement_kind
      if (i.cadence_hint !== undefined) update.cadence_hint = i.cadence_hint
      if (i.lead_time_days !== undefined)
        update.lead_time_days = i.lead_time_days
      if (i.required_count !== undefined)
        update.required_count = i.required_count
      if (i.period_months !== undefined) update.period_months = i.period_months
      if (i.is_required !== undefined) update.is_required = i.is_required
      if (i.is_active !== undefined) update.is_active = i.is_active
      if (i.notes !== undefined) update.notes = i.notes
      if (Object.keys(update).length === 0) return
      try {
        const { data, error: upErr } = await supabase
          .from('internal_control_bindings')
          .update(update)
          .eq('id', i.id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = ControlBindingRowSchema.safeParse(data)
        if (parsed.success) {
          setBindings((prev) =>
            prev.map((b) => (b.id === i.id ? parsed.data : b)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, bindings],
  )

  const softDeleteBinding = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      const target = bindings.find((b) => b.id === id)
      if (target?.is_system) {
        setError('Systembindinger kan ikke slettes. Sett is_active=false.')
        return
      }
      try {
        const { error: upErr } = await supabase
          .from('internal_control_bindings')
          .update({
            deleted_at: new Date().toISOString(),
            is_active: false,
          })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setBindings((prev) => prev.filter((b) => b.id !== id))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, bindings],
  )

  return useMemo(
    () => ({
      loading,
      error,
      bindings,
      byControlId,
      refresh: load,
      createBinding,
      updateBinding,
      softDeleteBinding,
    }),
    [
      loading,
      error,
      bindings,
      byControlId,
      load,
      createBinding,
      updateBinding,
      softDeleteBinding,
    ],
  )
}
