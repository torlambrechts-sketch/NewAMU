import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
  type OrgModulePayloadKey,
} from '../lib/orgModulePayload'
import { useOrgSetupContext } from './useOrgSetupContext'

const STORAGE_KEY = 'atics-cost-settings-v1'
const MODULE_KEY: OrgModulePayloadKey = 'cost_settings'
const PERSIST_DEBOUNCE_MS = 450

export type CostSettings = {
  hourlyRateNok: number
  hoursPerDay: number
  enabled: boolean
}

const DEFAULTS: CostSettings = {
  hourlyRateNok: 650,
  hoursPerDay: 7.5,
  enabled: true,
}

function normalize(p: Partial<CostSettings> | null | undefined): CostSettings {
  return { ...DEFAULTS, ...p }
}

function loadLocal(): CostSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return normalize(JSON.parse(raw) as Partial<CostSettings>)
  } catch {
    return DEFAULTS
  }
}

function saveLocal(s: CostSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useCostSettings() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<CostSettings>(MODULE_KEY, orgId, userId) : null
  const [localSettings, setLocalSettings] = useState<CostSettings>(() => loadLocal())
  const [remoteSettings, setRemoteSettings] = useState<CostSettings>(() => initialRemote ?? DEFAULTS)
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const settings = useRemote ? remoteSettings : localSettings
  const setSettingsState = useRemote ? setRemoteSettings : setLocalSettings

  const refreshCost = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<Partial<CostSettings>>(supabase, orgId, MODULE_KEY)
      const next = normalize(payload ?? undefined)
      setRemoteSettings(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      setRemoteSettings(DEFAULTS)
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshCost()
  }, [useRemote, refreshCost])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localSettings)
    }
  }, [useRemote, localSettings])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, remoteSettings)
          if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, remoteSettings)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, remoteSettings])

  const update = useCallback(
    (patch: Partial<CostSettings>) => {
      setSettingsState((s) => normalize({ ...s, ...patch }))
    },
    [setSettingsState],
  )

  function sickLeaveCost(days: number): number {
    return Math.round(days * settings.hoursPerDay * settings.hourlyRateNok)
  }

  function incidentCost(hours: number): number {
    return Math.round(hours * settings.hourlyRateNok)
  }

  return {
    settings,
    update,
    sickLeaveCost,
    incidentCost,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
  }
}
