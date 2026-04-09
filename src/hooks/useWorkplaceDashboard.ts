import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { WorkplaceDashboardPayload, WorkplaceDashboardTab } from '../types/dashboardLayout'
import { emptyDashboardPayload } from '../types/dashboardLayout'

const MODULE_KEY: OrgModulePayloadKey = 'workplace_dashboard'
const PERSIST_DEBOUNCE_MS = 500
const SNAP_USER = '__workplace_dashboard__'

function normalize(p: unknown): WorkplaceDashboardPayload {
  if (!p || typeof p !== 'object') return emptyDashboardPayload()
  const raw = p as WorkplaceDashboardPayload
  const tabs = Array.isArray(raw.tabs) ? raw.tabs : []
  const activeTabId = typeof raw.activeTabId === 'string' || raw.activeTabId === null ? raw.activeTabId : null
  return { tabs: tabs as WorkplaceDashboardTab[], activeTabId }
}

function localKey(orgId: string | undefined) {
  return `atics-workplace-dashboard:${orgId ?? 'no-org'}`
}

function readLocal(orgId: string | undefined): WorkplaceDashboardPayload {
  try {
    const raw = sessionStorage.getItem(localKey(orgId))
    if (!raw) return emptyDashboardPayload()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyDashboardPayload()
  }
}

function writeLocal(orgId: string | undefined, payload: WorkplaceDashboardPayload) {
  try {
    sessionStorage.setItem(localKey(orgId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function useWorkplaceDashboard() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const useRemote = !!(supabase && orgId)

  const initialSnap = useRemote && orgId ? readOrgModuleSnap<WorkplaceDashboardPayload>(MODULE_KEY, orgId, SNAP_USER) : null
  const payloadRef = useRef<WorkplaceDashboardPayload>(
    normalize(initialSnap ?? (useRemote ? null : readLocal(orgId))),
  )

  const [payload, setPayload] = useState<WorkplaceDashboardPayload>(() => payloadRef.current)
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchOrgModulePayload<WorkplaceDashboardPayload>(supabase, orgId, MODULE_KEY)
      const next = normalize(raw)
      payloadRef.current = next
      setPayload(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER)
      const empty = emptyDashboardPayload()
      payloadRef.current = empty
      setPayload(empty)
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      const local = readLocal(orgId)
      if (local.tabs.length) {
        payloadRef.current = local
        setPayload(local)
      }
      return
    }
    void refresh()
  }, [useRemote, refresh, orgId])

  const persist = useCallback(
    (next: WorkplaceDashboardPayload) => {
      payloadRef.current = next
      if (!useRemote) {
        writeLocal(orgId, next)
        return
      }
      if (!supabase || !orgId) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void (async () => {
          try {
            await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
            writeOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER, next)
          } catch (e) {
            setError(getSupabaseErrorMessage(e))
          }
        })()
      }, PERSIST_DEBOUNCE_MS)
    },
    [useRemote, supabase, orgId],
  )

  /** Write current payload immediately (for explicit «Lagre»; also clears pending debounced save). */
  const flushSave = useCallback(async (): Promise<void> => {
    const next = payloadRef.current
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
    if (!useRemote) {
      writeLocal(orgId, next)
      return
    }
    if (!supabase || !orgId) return
    try {
      await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
      writeOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER, next)
      setError(null)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      throw e
    }
  }, [useRemote, supabase, orgId])

  const setPayloadAndPersist = useCallback(
    (updater: (prev: WorkplaceDashboardPayload) => WorkplaceDashboardPayload) => {
      setPayload((prev) => {
        const next = updater(prev)
        persist(next)
        return next
      })
    },
    [persist],
  )

  return useMemo(
    () => ({
      payload,
      setPayloadAndPersist,
      flushSave,
      loading: useRemote ? loading : false,
      error: useRemote ? error : null,
      refresh,
    }),
    [payload, setPayloadAndPersist, flushSave, loading, error, refresh, useRemote],
  )
}
