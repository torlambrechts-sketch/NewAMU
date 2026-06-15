/* Data hook for Strategy v2 — workspace settings + nudge preferences. Reads the
   two singleton rows seeded in Wave 0 (strategy_workspace_settings,
   strategy_nudge_prefs) and persists edits (debounced). Mirrors the established
   optimistic + snake_case pattern. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { CustomField, NudgePrefs, WorkspaceSettings } from '../types/strategyTools'

type DbSettings = {
  active_framework: string | null
  enforce_framework: boolean | null
  allow_mixed: boolean | null
  accent_color: string | null
  logo_path: string | null
  modules_enabled: Record<string, boolean> | null
  custom_fields: CustomField[] | null
}
type DbNudge = {
  cap_per_week: number | null
  quiet_hours: boolean | null
  quiet_from: string | null
  quiet_to: string | null
  timezone: string | null
  muted: string[] | null
  channels_on: string[] | null
}

const EMPTY_SETTINGS: WorkspaceSettings = {
  activeFramework: 'okr', enforceFramework: false, allowMixed: true,
  accentColor: '#1a3d32', logoPath: null,
  modulesEnabled: { strategy: true, reviews: true, checkins: true, reporting: true, frameworks: true, assessments: true },
  customFields: [],
}
const EMPTY_NUDGE: NudgePrefs = {
  capPerWeek: 5, quietHours: true, quietFrom: '18:00', quietTo: '08:00',
  timezone: 'Europe/Oslo', muted: [], channelsOn: ['IN_APP', 'EMAIL'],
}

function mapSettings(r: DbSettings | null): WorkspaceSettings {
  if (!r) return { ...EMPTY_SETTINGS }
  return {
    activeFramework: r.active_framework ?? 'okr',
    enforceFramework: r.enforce_framework ?? false,
    allowMixed: r.allow_mixed ?? true,
    accentColor: r.accent_color ?? '#1a3d32',
    logoPath: r.logo_path ?? null,
    modulesEnabled: r.modules_enabled ?? EMPTY_SETTINGS.modulesEnabled,
    customFields: r.custom_fields ?? [],
  }
}
function mapNudge(r: DbNudge | null): NudgePrefs {
  if (!r) return { ...EMPTY_NUDGE }
  return {
    capPerWeek: r.cap_per_week ?? 5,
    quietHours: r.quiet_hours ?? true,
    quietFrom: (r.quiet_from ?? '18:00').slice(0, 5),
    quietTo: (r.quiet_to ?? '08:00').slice(0, 5),
    timezone: r.timezone ?? 'Europe/Oslo',
    muted: r.muted ?? [],
    channelsOn: r.channels_on ?? ['IN_APP', 'EMAIL'],
  }
}

export type UseStrategyWorkspaceSettingsReturn = {
  loading: boolean
  error: string | null
  settings: WorkspaceSettings
  nudgePrefs: NudgePrefs
  reload: () => void
  updateSettings: (patch: Partial<WorkspaceSettings>) => void
  updateNudgePrefs: (patch: Partial<NudgePrefs>) => void
}

export function useStrategyWorkspaceSettings(): UseStrategyWorkspaceSettingsReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [settings, setSettings] = useState<WorkspaceSettings>({ ...EMPTY_SETTINGS })
  const [nudgePrefs, setNudgePrefs] = useState<NudgePrefs>({ ...EMPTY_NUDGE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const sTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true); setError(null)
      try {
        await supabase.rpc('provision_strategy_baseline_for_org', { p_org_id: orgId })
        const [sRes, nRes] = await Promise.all([
          supabase.from('strategy_workspace_settings').select('*').eq('organization_id', orgId).maybeSingle(),
          supabase.from('strategy_nudge_prefs').select('*').eq('organization_id', orgId).maybeSingle(),
        ])
        if (cancelled) return
        if (sRes.error) throw sRes.error
        if (nRes.error) throw nRes.error
        setSettings(mapSettings(sRes.data as DbSettings | null))
        setNudgePrefs(mapNudge(nRes.data as DbNudge | null))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste innstillinger.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const updateSettings = useCallback<UseStrategyWorkspaceSettingsReturn['updateSettings']>(
    (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }))
      if (!supabase || !orgId) return
      const db: Record<string, unknown> = {}
      if (patch.activeFramework !== undefined) db.active_framework = patch.activeFramework
      if (patch.enforceFramework !== undefined) db.enforce_framework = patch.enforceFramework
      if (patch.allowMixed !== undefined) db.allow_mixed = patch.allowMixed
      if (patch.accentColor !== undefined) db.accent_color = patch.accentColor
      if (patch.logoPath !== undefined) db.logo_path = patch.logoPath
      if (patch.modulesEnabled !== undefined) db.modules_enabled = patch.modulesEnabled
      if (patch.customFields !== undefined) db.custom_fields = patch.customFields
      if (sTimer.current) clearTimeout(sTimer.current)
      sTimer.current = setTimeout(() => {
        void supabase.from('strategy_workspace_settings').update(db).eq('organization_id', orgId)
          .then(({ error: upErr }) => { if (upErr) setError(upErr.message) })
      }, 500)
    },
    [supabase, orgId],
  )

  const updateNudgePrefs = useCallback<UseStrategyWorkspaceSettingsReturn['updateNudgePrefs']>(
    (patch) => {
      setNudgePrefs((prev) => ({ ...prev, ...patch }))
      if (!supabase || !orgId) return
      const db: Record<string, unknown> = {}
      if (patch.capPerWeek !== undefined) db.cap_per_week = patch.capPerWeek
      if (patch.quietHours !== undefined) db.quiet_hours = patch.quietHours
      if (patch.quietFrom !== undefined) db.quiet_from = patch.quietFrom
      if (patch.quietTo !== undefined) db.quiet_to = patch.quietTo
      if (patch.timezone !== undefined) db.timezone = patch.timezone
      if (patch.muted !== undefined) db.muted = patch.muted
      if (patch.channelsOn !== undefined) db.channels_on = patch.channelsOn
      if (nTimer.current) clearTimeout(nTimer.current)
      nTimer.current = setTimeout(() => {
        void supabase.from('strategy_nudge_prefs').update(db).eq('organization_id', orgId)
          .then(({ error: upErr }) => { if (upErr) setError(upErr.message) })
      }, 500)
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({ loading, error, settings, nudgePrefs, reload, updateSettings, updateNudgePrefs }),
    [loading, error, settings, nudgePrefs, reload, updateSettings, updateNudgePrefs],
  )
}
