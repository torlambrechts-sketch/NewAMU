// ISO IMS settings hook — reads and writes organization_iso_settings.
//
// active_standards[] drives which ISO packs are enabled for this org.
// Toggling a standard here calls activatePack/deactivatePack so the
// compliance hub and pack switcher update automatically (Model C shortcut).
//
// Returns null settings when no row exists yet — the settings page shows
// an "empty state" prompt and creates the row on first toggle.

import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useOrgSetupContext } from './useOrgSetupContext'
import { usePacks } from '../../modules/compliance/usePacks'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { IsoSettings, IsoStandard } from '../types/iso'
import { ISO_STANDARDS } from '../types/iso'

const IsoSettingsRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  active_standards: z.array(z.enum(['iso-9001', 'iso-14001', 'iso-45001', 'iso-27001'])),
  certification_targets: z.record(z.string(), z.string().nullable()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
})

function mapRow(row: z.infer<typeof IsoSettingsRowSchema>): IsoSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    activeStandards: row.active_standards,
    certificationTargets: row.certification_targets,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type UseIsoSettingsReturn = {
  loading: boolean
  error: string | null
  settings: IsoSettings | null
  isStandardActive: (standard: IsoStandard) => boolean
  toggleStandard: (standard: IsoStandard, active: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export function useIsoSettings(): UseIsoSettingsReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<IsoSettings | null>(null)

  const { activatePack, deactivatePack } = usePacks({ supabase, includeInactive: true })

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('organization_iso_settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle()
      if (err) throw err
      if (data) {
        const parsed = IsoSettingsRowSchema.safeParse(data)
        if (parsed.success) setSettings(mapRow(parsed.data))
      } else {
        setSettings(null)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const isStandardActive = useCallback(
    (standard: IsoStandard): boolean =>
      settings?.activeStandards.includes(standard) ?? false,
    [settings],
  )

  const toggleStandard = useCallback(
    async (standard: IsoStandard, active: boolean): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const current = settings?.activeStandards ?? []
        const next = active
          ? [...new Set([...current, standard])]
          : current.filter((s) => s !== standard)

        const { data, error: upsertErr } = await supabase
          .from('organization_iso_settings')
          .upsert(
            { organization_id: orgId, active_standards: next },
            { onConflict: 'organization_id' },
          )
          .select('*')
          .single()
        if (upsertErr) throw upsertErr

        const parsed = IsoSettingsRowSchema.safeParse(data)
        if (parsed.success) setSettings(mapRow(parsed.data))

        // Model C shortcut: keep compliance pack activation in sync.
        // Only applies to the 3 new ISO packs (iso-45001 is always-on).
        const syncablePacks: IsoStandard[] = ['iso-9001', 'iso-14001', 'iso-27001']
        if (syncablePacks.includes(standard)) {
          if (active) {
            await activatePack(standard)
          } else {
            await deactivatePack(standard)
          }
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, settings, activatePack, deactivatePack],
  )

  return { loading, error, settings, isStandardActive, toggleStandard, refresh: load }
}
