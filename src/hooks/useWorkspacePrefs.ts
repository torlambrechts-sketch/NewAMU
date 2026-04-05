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

const MODULE_KEY: OrgModulePayloadKey = 'workspace'
const PERSIST_DEBOUNCE_MS = 450

export type WorkspacePrefs = {
  tableCompact: boolean
  setupOpen: boolean
}

const DEFAULT_PREFS: WorkspacePrefs = {
  tableCompact: false,
  setupOpen: false,
}

type WorkspacePayload = {
  users: Record<string, WorkspacePrefs>
}

function emptyPayload(): WorkspacePayload {
  return { users: {} }
}

function normalize(p: Partial<WorkspacePrefs> | null | undefined): WorkspacePrefs {
  return {
    tableCompact: p?.tableCompact ?? DEFAULT_PREFS.tableCompact,
    setupOpen: p?.setupOpen ?? DEFAULT_PREFS.setupOpen,
  }
}

function sessionSetupKey(orgId: string | undefined, userId: string | undefined) {
  return orgId && userId ? `atics-dashboard-setup-open:${orgId}:${userId}` : 'atics-dashboard-setup-open'
}

function sessionCompactKey(orgId: string | undefined, userId: string | undefined) {
  return orgId && userId ? `atics-dashboard-table-compact:${orgId}:${userId}` : 'atics-dashboard-table-compact'
}

function readSessionPrefs(orgId: string | undefined, userId: string | undefined): WorkspacePrefs {
  try {
    const setup = sessionStorage.getItem(sessionSetupKey(orgId, userId))
    const compact = sessionStorage.getItem(sessionCompactKey(orgId, userId))
    return normalize({
      setupOpen: setup === '1' ? true : setup === '0' ? false : undefined,
      tableCompact: compact === '1' ? true : compact === '0' ? false : undefined,
    })
  } catch {
    return DEFAULT_PREFS
  }
}

export function useWorkspacePrefs() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialSnap =
    useRemote && orgId && userId ? readOrgModuleSnap<WorkspacePayload>(MODULE_KEY, orgId, userId) : null
  const payloadRef = useRef<WorkspacePayload>(initialSnap ?? emptyPayload())

  const [prefs, setPrefs] = useState<WorkspacePrefs>(() =>
    normalize({
      ...initialSnap?.users?.[userId ?? ''],
      ...readSessionPrefs(orgId, userId),
    }),
  )

  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPrefs = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchOrgModulePayload<WorkspacePayload>(supabase, orgId, MODULE_KEY)
      const base = raw?.users && typeof raw.users === 'object' ? raw : emptyPayload()
      payloadRef.current = base
      const merged = normalize({
        ...base.users[userId],
        ...readSessionPrefs(orgId, userId),
      })
      payloadRef.current = {
        ...base,
        users: { ...base.users, [userId]: merged },
      }
      setPrefs(merged)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, payloadRef.current)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      payloadRef.current = emptyPayload()
      setPrefs(readSessionPrefs(orgId, userId))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshPrefs()
  }, [useRemote, refreshPrefs])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId || !userId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const next: WorkspacePayload = {
            ...payloadRef.current,
            users: { ...payloadRef.current.users, [userId]: prefs },
          }
          payloadRef.current = next
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
          writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, prefs])

  const setTableCompact = useCallback(
    (compact: boolean) => {
      setPrefs((p) => ({ ...p, tableCompact: compact }))
      try {
        sessionStorage.setItem(sessionCompactKey(orgId, userId), compact ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [orgId, userId],
  )

  const setSetupOpen = useCallback(
    (open: boolean) => {
      setPrefs((p) => ({ ...p, setupOpen: open }))
      try {
        sessionStorage.setItem(sessionSetupKey(orgId, userId), open ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [orgId, userId],
  )

  return {
    prefs,
    setTableCompact,
    setSetupOpen,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
  }
}
