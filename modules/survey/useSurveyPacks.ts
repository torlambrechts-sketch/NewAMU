// Survey packs — read the org's licensed survey_packs rows. Mirrors the
// compliance modules/compliance/usePacks.ts shape. Pack content drives the
// terminology + KPI labels + behaviour defaults consumed by the survey UI.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  SurveyPackRow,
  SurveyPackSlug,
} from './types'
import { SurveyPackRowSchema } from './types'

type UseSurveyPacksInput = {
  supabase: SupabaseClient | null
}

export type UseSurveyPacksReturn = {
  loading: boolean
  error: string | null
  packs: SurveyPackRow[]
  getPack: (slug: string | null | undefined) => SurveyPackRow | null
  refresh: () => Promise<void>
}

export function useSurveyPacks(input: UseSurveyPacksInput): UseSurveyPacksReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [packs, setPacks] = useState<SurveyPackRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: respErr } = await supabase
        .from('survey_packs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('slug', { ascending: true })
      if (respErr) throw respErr

      const ok: SurveyPackRow[] = []
      let failed = 0
      for (const row of data ?? []) {
        const parsed = SurveyPackRowSchema.safeParse(row)
        if (parsed.success) ok.push(parsed.data)
        else failed += 1
      }
      setPacks(ok)
      setFetchedFor(orgId)
      if (failed > 0) {
        setError(`Kunne ikke tolke ${failed} pakkerader.`)
      } else {
        setError(null)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
      setFetchedFor(orgId)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!supabase || !orgId) return
    void load()
  }, [load, supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const getPack = useCallback(
    (slug: string | null | undefined): SurveyPackRow | null => {
      if (!slug) return null
      return packs.find((p) => p.slug === slug) ?? null
    },
    [packs],
  )

  return useMemo(
    () => ({ loading, error, packs, getPack, refresh: load }),
    [loading, error, packs, getPack, load],
  )
}

/** Filter helper for consumers — returns the licensed pack matching slug,
 *  or null if not licensed for this org. */
export function findLicensedPack(
  packs: SurveyPackRow[],
  slug: SurveyPackSlug | null,
): SurveyPackRow | null {
  if (!slug) return packs[0] ?? null
  return packs.find((p) => p.slug === slug) ?? null
}
