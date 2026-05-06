// Compliance Requirements — fetch the requirement taxonomy (system rows
// + this org's custom rows) for the active org.
//
// Read-only here. Write paths (org-defined custom requirements) land in
// the admin commit. System requirements are managed via migrations only;
// the RLS policy denies direct writes to system rows from the app.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { ComplianceRequirementRowSchema, parseRows } from './schema'
import type { ComplianceRequirementRow, CompliancePackSlug } from './types'

type UseRequirementsInput = {
  supabase: SupabaseClient | null
}

export type CreateRequirementInput = {
  pack: CompliancePackSlug
  slug: string
  code: string
  title: string
  description?: string
}

export type UpdateRequirementInput = {
  id: string
  code?: string
  title?: string
  description?: string | null
  is_active?: boolean
}

export type UseRequirementsReturn = {
  loading: boolean
  error: string | null
  requirements: ComplianceRequirementRow[]
  /** Indexed by slug for cheap lookups in tagging UIs. */
  bySlug: Record<string, ComplianceRequirementRow>
  /** Filter helper: requirements for one pack, system + this org. */
  forPack: (pack: CompliancePackSlug) => ComplianceRequirementRow[]
  refresh: () => Promise<void>

  // Org-scoped CRUD. System rows (organization_id IS NULL) are protected
  // by RLS — server rejects any attempt to write to them from the app.
  createRequirement: (input: CreateRequirementInput) => Promise<string | null>
  updateRequirement: (input: UpdateRequirementInput) => Promise<void>
  softDeleteRequirement: (id: string) => Promise<void>
}

export function useRequirements(
  input: UseRequirementsInput,
): UseRequirementsReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<ComplianceRequirementRow[]>(
    [],
  )

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      // RLS already constrains the result to (system rows) ∪ (this org's rows).
      const { data, error: respErr } = await supabase
        .from('compliance_requirements')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('pack', { ascending: true })
        .order('code', { ascending: true })
      if (respErr) throw respErr

      const parsed = parseRows(data ?? [], ComplianceRequirementRowSchema)
      setRequirements(parsed.ok)
      if (parsed.failed > 0) {
        setError(`Kunne ikke tolke ${parsed.failed} kravrader.`)
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
    const map: Record<string, ComplianceRequirementRow> = {}
    for (const r of requirements) map[r.slug] = r
    return map
  }, [requirements])

  const forPack = useCallback(
    (pack: CompliancePackSlug) => requirements.filter((r) => r.pack === pack),
    [requirements],
  )

  // ── Org-scoped CRUD ──────────────────────────────────────────────────────

  const createRequirement = useCallback(
    async (input: CreateRequirementInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('compliance_requirements')
          .insert({
            pack: input.pack,
            slug: input.slug,
            code: input.code,
            title: input.title,
            description: input.description ?? null,
            is_system: false,
            is_active: true,
          })
          .select('*')
          .single()
        if (insErr) throw insErr

        const parsed = ComplianceRequirementRowSchema.safeParse(data)
        if (parsed.success) {
          setRequirements((prev) => [...prev, parsed.data])
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

  const updateRequirement = useCallback(
    async (input: UpdateRequirementInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)

      const target = requirements.find((r) => r.id === input.id)
      if (target?.is_system) {
        setError('Systemkrav kan ikke endres fra appen.')
        return
      }

      const update: Record<string, unknown> = {}
      if (input.code !== undefined) update.code = input.code
      if (input.title !== undefined) update.title = input.title
      if (input.description !== undefined) update.description = input.description
      if (input.is_active !== undefined) update.is_active = input.is_active
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_requirements')
          .update(update)
          .eq('id', input.id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceRequirementRowSchema.safeParse(data)
        if (parsed.success) {
          setRequirements((prev) =>
            prev.map((r) => (r.id === input.id ? parsed.data : r)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, requirements],
  )

  const softDeleteRequirement = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)

      const target = requirements.find((r) => r.id === id)
      if (target?.is_system) {
        setError('Systemkrav kan ikke slettes.')
        return
      }

      try {
        const { error: upErr } = await supabase
          .from('compliance_requirements')
          .update({
            deleted_at: new Date().toISOString(),
            is_active: false,
          })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (upErr) throw upErr

        setRequirements((prev) => prev.filter((r) => r.id !== id))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, requirements],
  )

  return useMemo(
    () => ({
      loading,
      error,
      requirements,
      bySlug,
      forPack,
      refresh: load,
      createRequirement,
      updateRequirement,
      softDeleteRequirement,
    }),
    [
      loading,
      error,
      requirements,
      bySlug,
      forPack,
      load,
      createRequirement,
      updateRequirement,
      softDeleteRequirement,
    ],
  )
}
