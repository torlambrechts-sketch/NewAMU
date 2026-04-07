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
import type { CustomReportTemplate, ReportBuilderPayload } from '../types/reportBuilder'

const MODULE_KEY: OrgModulePayloadKey = 'report_builder'
const PERSIST_DEBOUNCE_MS = 500
/** Session cache segment — templates are org-wide, not per-user */
const SNAP_USER = '__report_builder__'

function emptyPayload(): ReportBuilderPayload {
  return { templates: [] }
}

function normalize(p: unknown): ReportBuilderPayload {
  if (!p || typeof p !== 'object') return emptyPayload()
  const t = (p as ReportBuilderPayload).templates
  if (!Array.isArray(t)) return emptyPayload()
  return { templates: t as CustomReportTemplate[] }
}

function localStorageKey(orgId: string | undefined) {
  return `atics-report-builder:${orgId ?? 'no-org'}`
}

function readLocalTemplates(orgId: string | undefined): CustomReportTemplate[] {
  try {
    const raw = sessionStorage.getItem(localStorageKey(orgId))
    if (!raw) return []
    return normalize(JSON.parse(raw)).templates
  } catch {
    return []
  }
}

function writeLocalTemplates(orgId: string | undefined, templates: CustomReportTemplate[]) {
  try {
    sessionStorage.setItem(localStorageKey(orgId), JSON.stringify({ templates }))
  } catch {
    /* ignore */
  }
}

export function useReportBuilder() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const useRemote = !!(supabase && orgId)

  const initialSnap = useRemote && orgId ? readOrgModuleSnap<ReportBuilderPayload>(MODULE_KEY, orgId, SNAP_USER) : null
  const payloadRef = useRef<ReportBuilderPayload>(
    normalize(initialSnap ?? (useRemote ? null : { templates: readLocalTemplates(orgId) })),
  )

  const [templates, setTemplates] = useState<CustomReportTemplate[]>(() => payloadRef.current.templates)
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchOrgModulePayload<ReportBuilderPayload>(supabase, orgId, MODULE_KEY)
      const next = normalize(raw)
      payloadRef.current = next
      setTemplates(next.templates)
      writeOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, SNAP_USER)
      payloadRef.current = emptyPayload()
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      const local = readLocalTemplates(orgId)
      if (local.length) {
        payloadRef.current = { templates: local }
        setTemplates(local)
      }
      return
    }
    void refresh()
  }, [useRemote, refresh, orgId])

  const persist = useCallback(
    (next: ReportBuilderPayload) => {
      payloadRef.current = next
      if (!useRemote) {
        writeLocalTemplates(orgId, next.templates)
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

  const setTemplatesAndPersist = useCallback(
    (updater: (prev: CustomReportTemplate[]) => CustomReportTemplate[]) => {
      setTemplates((prev) => {
        const nextList = updater(prev)
        const payload: ReportBuilderPayload = { templates: nextList }
        persist(payload)
        return nextList
      })
    },
    [persist],
  )

  const saveTemplate = useCallback(
    (tpl: CustomReportTemplate) => {
      setTemplatesAndPersist((list) => {
        const i = list.findIndex((t) => t.id === tpl.id)
        if (i < 0) return [...list, tpl]
        const copy = [...list]
        copy[i] = tpl
        return copy
      })
    },
    [setTemplatesAndPersist],
  )

  const deleteTemplate = useCallback(
    (id: string) => {
      setTemplatesAndPersist((list) => list.filter((t) => t.id !== id))
    },
    [setTemplatesAndPersist],
  )

  return useMemo(
    () => ({
      templates,
      loading: useRemote ? loading : false,
      error: useRemote ? error : null,
      refresh,
      saveTemplate,
      deleteTemplate,
    }),
    [templates, loading, error, refresh, saveTemplate, deleteTemplate, useRemote],
  )
}
