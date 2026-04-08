import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkplaceCase, WorkplaceReportingStore } from '../types/workplaceReportingCase'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
  type OrgModulePayloadKey,
} from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'

const MODULE_KEY: OrgModulePayloadKey = 'workplace_reporting'
const LOCAL_KEY = 'atics-workplace-reporting-cases-v1'
const PERSIST_DEBOUNCE_MS = 450

function normalizeCase(raw: Record<string, unknown>): WorkplaceCase | null {
  const id = String(raw.id ?? '')
  if (!id) return null
  const cat = raw.category as WorkplaceCase['category']
  const allowedCat = [
    'work_environment',
    'coworkers',
    'health_safety',
    'management',
    'ethics',
    'policy_violation',
    'other',
  ]
  const category = allowedCat.includes(cat) ? cat : 'other'
  const st = raw.status as WorkplaceCase['status']
  const status =
    st === 'triage' || st === 'in_progress' || st === 'closed' || st === 'received' ? st : 'received'
  const details = raw.details && typeof raw.details === 'object' ? (raw.details as WorkplaceCase['details']) : {}
  return {
    id,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
    category,
    status,
    title: String(raw.title ?? 'Uten tittel'),
    description: String(raw.description ?? ''),
    details,
    confidential: Boolean(raw.confidential),
    createdByUserId: String(raw.createdByUserId ?? ''),
  }
}

function normalizeStore(p: unknown): WorkplaceReportingStore {
  if (!p || typeof p !== 'object') return { cases: [] }
  const o = p as { cases?: unknown[] }
  const cases = Array.isArray(o.cases)
    ? (o.cases.map((x) => normalizeCase(x as Record<string, unknown>)).filter(Boolean) as WorkplaceCase[])
    : []
  return { cases }
}

function emptyStore(): WorkplaceReportingStore {
  return { cases: [] }
}

function loadLocal(): WorkplaceReportingStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyStore()
    return normalizeStore(JSON.parse(raw))
  } catch {
    return emptyStore()
  }
}

function saveLocal(s: WorkplaceReportingStore) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export type AddWorkplaceCaseInput = Omit<WorkplaceCase, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'status'> &
  Partial<Pick<WorkplaceCase, 'status'>>

export function useWorkplaceReportingCases() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<WorkplaceReportingStore>(MODULE_KEY, orgId, userId) : null
  const [localStore, setLocalStore] = useState<WorkplaceReportingStore>(() => loadLocal())
  const [remoteStore, setRemoteStore] = useState<WorkplaceReportingStore>(() => initialRemote ?? emptyStore())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const store = useRemote ? remoteStore : localStore
  const setStore = useRemote ? setRemoteStore : setLocalStore

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<WorkplaceReportingStore>(supabase, orgId, MODULE_KEY)
      const next = payload ? normalizeStore(payload) : emptyStore()
      setRemoteStore(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      setRemoteStore(emptyStore())
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refresh()
  }, [useRemote, refresh])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localStore)
    }
  }, [useRemote, localStore])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, remoteStore)
          if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, remoteStore)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, remoteStore])

  const addCase = useCallback(
    (input: AddWorkplaceCaseInput): WorkplaceCase | null => {
      if (!userId) return null
      const now = new Date().toISOString()
      const c: WorkplaceCase = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        category: input.category,
        status: input.status ?? 'received',
        title: input.title.trim(),
        description: input.description.trim(),
        details: input.details ?? {},
        confidential: input.confidential,
        createdByUserId: userId,
      }
      setStore((s) => ({ ...s, cases: [c, ...s.cases] }))
      return c
    },
    [setStore, userId],
  )

  const updateCase = useCallback(
    (id: string, patch: Partial<Pick<WorkplaceCase, 'status' | 'title' | 'description' | 'details' | 'confidential'>>) => {
      setStore((s) => ({
        ...s,
        cases: s.cases.map((x) =>
          x.id === id
            ? {
                ...x,
                ...patch,
                details: patch.details ? { ...x.details, ...patch.details } : x.details,
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
      }))
    },
    [setStore],
  )

  const cases = store.cases

  const value = useMemo(
    () => ({
      cases,
      loading,
      error,
      refresh,
      addCase,
      updateCase,
      useRemote,
    }),
    [cases, loading, error, refresh, addCase, updateCase, useRemote],
  )

  return value
}
