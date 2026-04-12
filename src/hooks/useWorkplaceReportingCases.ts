import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnonymousAmlPageSettings,
  WorkplaceCase,
  WorkplaceReportingStore,
} from '../types/workplaceReportingCase'
import { DEFAULT_ANONYMOUS_AML_PAGE } from '../types/workplaceReportingCase'
import type { AmlReportKind, AnonymousAmlReport } from '../types/orgHealth'
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
const ORG_HEALTH_MODULE_KEY: OrgModulePayloadKey = 'org_health'
const ORG_HEALTH_LOCAL_KEY = 'atics-org-health-v2'
const LOCAL_KEY = 'atics-workplace-reporting-cases-v1'
const PERSIST_DEBOUNCE_MS = 450

const AML_KINDS: AmlReportKind[] = [
  'work_injury_illness',
  'near_miss',
  'harassment_discrimination',
  'violence_threat',
  'psychosocial',
  'whistleblowing',
  'other',
]
const URG: AnonymousAmlReport['urgency'][] = ['low', 'medium', 'high']

function normalizeAnonymousReport(raw: unknown): AnonymousAmlReport | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = String(o.id ?? '')
  if (!id) return null
  const kind = o.kind as AmlReportKind
  if (!AML_KINDS.includes(kind)) return null
  const urgency = o.urgency as AnonymousAmlReport['urgency']
  if (!URG.includes(urgency)) return null
  const submittedAt = String(o.submittedAt ?? '')
  if (!submittedAt) return null
  return {
    id,
    kind,
    submittedAt,
    detailsIndicated: Boolean(o.detailsIndicated),
    urgency,
    ...(typeof o.hrNote === 'string' && o.hrNote.trim() ? { hrNote: o.hrNote.trim() } : {}),
  }
}

function normalizeAnonymousAmlPageSettings(raw: unknown): AnonymousAmlPageSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ANONYMOUS_AML_PAGE }
  const o = raw as Record<string, unknown>
  return {
    pageTitle:
      typeof o.pageTitle === 'string' && o.pageTitle.trim()
        ? o.pageTitle.trim()
        : DEFAULT_ANONYMOUS_AML_PAGE.pageTitle,
    leadParagraph:
      typeof o.leadParagraph === 'string' ? o.leadParagraph : DEFAULT_ANONYMOUS_AML_PAGE.leadParagraph,
    footerNote: typeof o.footerNote === 'string' ? o.footerNote : DEFAULT_ANONYMOUS_AML_PAGE.footerNote,
  }
}

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
  if (!p || typeof p !== 'object') {
    return { cases: [], anonymousAmlReports: [], anonymousAmlPage: { ...DEFAULT_ANONYMOUS_AML_PAGE } }
  }
  const o = p as { cases?: unknown[]; anonymousAmlReports?: unknown[]; anonymousAmlPage?: unknown }
  const cases = Array.isArray(o.cases)
    ? (o.cases.map((x) => normalizeCase(x as Record<string, unknown>)).filter(Boolean) as WorkplaceCase[])
    : []
  const anonymousAmlReports = Array.isArray(o.anonymousAmlReports)
    ? (o.anonymousAmlReports.map((x) => normalizeAnonymousReport(x)).filter(Boolean) as AnonymousAmlReport[])
    : []
  return {
    cases,
    anonymousAmlReports,
    anonymousAmlPage: normalizeAnonymousAmlPageSettings(o.anonymousAmlPage),
  }
}

function emptyStore(): WorkplaceReportingStore {
  return { cases: [], anonymousAmlReports: [], anonymousAmlPage: { ...DEFAULT_ANONYMOUS_AML_PAGE } }
}

function migrateFromOrgHealthLocal(): AnonymousAmlReport[] {
  try {
    const raw = localStorage.getItem(ORG_HEALTH_LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const arr = parsed.anonymousAmlReports
    if (!Array.isArray(arr)) return []
    return arr.map((x) => normalizeAnonymousReport(x)).filter(Boolean) as AnonymousAmlReport[]
  } catch {
    return []
  }
}

function loadLocal(): WorkplaceReportingStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    let base = raw ? normalizeStore(JSON.parse(raw)) : emptyStore()
    if (base.anonymousAmlReports.length === 0) {
      const migrated = migrateFromOrgHealthLocal()
      if (migrated.length) {
        base = { ...base, anonymousAmlReports: migrated }
        saveLocal(base)
      }
    }
    return base
  } catch {
    const migrated = migrateFromOrgHealthLocal()
    if (migrated.length) {
      const s = { ...emptyStore(), anonymousAmlReports: migrated }
      saveLocal(s)
      return s
    }
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
      let next = payload ? normalizeStore(payload) : emptyStore()
      if (next.anonymousAmlReports.length === 0) {
        try {
          const oh = await fetchOrgModulePayload<{ anonymousAmlReports?: unknown[] }>(
            supabase,
            orgId,
            ORG_HEALTH_MODULE_KEY,
          )
          const fromOh = Array.isArray(oh?.anonymousAmlReports)
            ? (oh!.anonymousAmlReports!.map((x) => normalizeAnonymousReport(x)).filter(Boolean) as AnonymousAmlReport[])
            : []
          if (fromOh.length) {
            next = { ...next, anonymousAmlReports: fromOh }
          }
        } catch {
          /* ignore migration read */
        }
      }
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

  const submitAnonymousAmlReport = useCallback(
    (kind: AmlReportKind, options: { detailsIndicated: boolean; urgency: AnonymousAmlReport['urgency'] }): boolean => {
      const r: AnonymousAmlReport = {
        id: crypto.randomUUID(),
        kind,
        submittedAt: new Date().toISOString(),
        detailsIndicated: options.detailsIndicated,
        urgency: options.urgency,
      }
      setStore((s) => ({
        ...s,
        anonymousAmlReports: [r, ...s.anonymousAmlReports],
      }))
      return true
    },
    [setStore],
  )

  const addAnonymousAmlReport = useCallback(
    (input: {
      kind: AmlReportKind
      urgency: AnonymousAmlReport['urgency']
      detailsIndicated: boolean
      hrNote?: string
    }) => {
      const r: AnonymousAmlReport = {
        id: crypto.randomUUID(),
        kind: input.kind,
        submittedAt: new Date().toISOString(),
        detailsIndicated: input.detailsIndicated,
        urgency: input.urgency,
        ...(input.hrNote?.trim() ? { hrNote: input.hrNote.trim() } : {}),
      }
      setStore((s) => ({ ...s, anonymousAmlReports: [r, ...s.anonymousAmlReports] }))
      return r
    },
    [setStore],
  )

  const updateAnonymousAmlPageSettings = useCallback(
    (patch: Partial<AnonymousAmlPageSettings>) => {
      setStore((s) => ({
        ...s,
        anonymousAmlPage: {
          ...s.anonymousAmlPage,
          ...patch,
        },
      }))
    },
    [setStore],
  )

  const updateAnonymousAmlReport = useCallback(
    (id: string, patch: Partial<Pick<AnonymousAmlReport, 'hrNote'>>) => {
      setStore((s) => ({
        ...s,
        anonymousAmlReports: s.anonymousAmlReports.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }))
    },
    [setStore],
  )

  const amlReportStats = useMemo(() => {
    const byKind: Partial<Record<AmlReportKind, number>> = {}
    for (const r of store.anonymousAmlReports) {
      byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    }
    return {
      total: store.anonymousAmlReports.length,
      byKind,
      lastAt: store.anonymousAmlReports[0]?.submittedAt ?? null,
    }
  }, [store.anonymousAmlReports])

  const cases = store.cases

  const value = useMemo(
    () => ({
      cases,
      anonymousAmlReports: store.anonymousAmlReports,
      anonymousAmlPage: store.anonymousAmlPage,
      amlReportStats,
      loading,
      error,
      refresh,
      addCase,
      updateCase,
      submitAnonymousAmlReport,
      addAnonymousAmlReport,
      updateAnonymousAmlPageSettings,
      updateAnonymousAmlReport,
      useRemote,
    }),
    [
      cases,
      store.anonymousAmlReports,
      store.anonymousAmlPage,
      amlReportStats,
      loading,
      error,
      refresh,
      addCase,
      updateCase,
      submitAnonymousAmlReport,
      addAnonymousAmlReport,
      updateAnonymousAmlPageSettings,
      updateAnonymousAmlReport,
      useRemote,
    ],
  )

  return value
}
