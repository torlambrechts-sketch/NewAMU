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

export type UseRequirementsReturn = {
  loading: boolean
  error: string | null
  requirements: ComplianceRequirementRow[]
  /** Indexed by slug for cheap lookups in tagging UIs. */
  bySlug: Record<string, ComplianceRequirementRow>
  /** Filter helper: requirements for one pack, system + this org. */
  forPack: (pack: CompliancePackSlug) => ComplianceRequirementRow[]
  refresh: () => Promise<void>
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

  return useMemo(
    () => ({ loading, error, requirements, bySlug, forPack, refresh: load }),
    [loading, error, requirements, bySlug, forPack, load],
  )
}
