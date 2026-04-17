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
import type { CustomReportTemplate, ReportBuilderPayload, ReportModule } from '../types/reportBuilder'

const LEGACY_MODULE_KEY: OrgModulePayloadKey = 'report_builder'
const PERSIST_DEBOUNCE_MS = 500
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

type DefRow = {
  id: string
  organization_id: string
  name: string
  definition: { modules?: ReportModule[] }
  version: number
  created_at: string
  updated_at: string
}

function rowToTemplate(row: DefRow): CustomReportTemplate {
  const modules = Array.isArray(row.definition?.modules) ? row.definition.modules : []
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modules: modules as CustomReportTemplate['modules'],
    rowVersion: row.version,
  }
}

export function useReportBuilder() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const useRemote = !!(supabase && orgId)

  const initialSnap = useRemote && orgId ? readOrgModuleSnap<ReportBuilderPayload>(LEGACY_MODULE_KEY, orgId, SNAP_USER) : null
  const payloadRef = useRef<ReportBuilderPayload>(
    normalize(initialSnap ?? (useRemote ? null : { templates: readLocalTemplates(orgId) })),
  )

  const [templates, setTemplates] = useState<CustomReportTemplate[]>(() => payloadRef.current.templates)
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const migrateLegacyIfNeeded = useCallback(
    async (currentRows: DefRow[]) => {
      if (!supabase || !orgId || currentRows.length > 0) return
      let legacy: ReportBuilderPayload | null = null
      try {
        legacy = normalize(await fetchOrgModulePayload<ReportBuilderPayload>(supabase, orgId, LEGACY_MODULE_KEY))
      } catch {
        legacy = null
      }
      if (!legacy?.templates?.length) return
      for (const t of legacy.templates) {
        const { error: ie } = await supabase.from('report_definitions').insert({
          organization_id: orgId,
          name: t.name,
          definition: { modules: t.modules },
        })
        if (ie) {
          setError(getSupabaseErrorMessage(ie))
          return
        }
      }
    },
    [supabase, orgId],
  )

  const refresh = useCallback(async (): Promise<CustomReportTemplate[]> => {
    if (!supabase || !orgId) return []
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      const rows = (data ?? []) as DefRow[]
      await migrateLegacyIfNeeded(rows)
      const { data: data2, error: e2 } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })
      if (e2) throw e2
      const list = ((data2 ?? []) as DefRow[]).map(rowToTemplate)
      payloadRef.current = { templates: list }
      setTemplates(list)
      writeOrgModuleSnap(LEGACY_MODULE_KEY, orgId, SNAP_USER, { templates: list })
      return list
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      clearOrgModuleSnap(LEGACY_MODULE_KEY, orgId, SNAP_USER)
      payloadRef.current = emptyPayload()
      setTemplates([])
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, migrateLegacyIfNeeded])

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

  const persistLegacyMirror = useCallback(
    (next: ReportBuilderPayload) => {
      if (!useRemote || !supabase || !orgId) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void (async () => {
          try {
            await upsertOrgModulePayload(supabase, orgId, LEGACY_MODULE_KEY, next)
            writeOrgModuleSnap(LEGACY_MODULE_KEY, orgId, SNAP_USER, next)
          } catch {
            /* best-effort mirror */
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
        payloadRef.current = payload
        if (!useRemote) {
          writeLocalTemplates(orgId, nextList)
          return nextList
        }
        persistLegacyMirror(payload)
        return nextList
      })
    },
    [useRemote, orgId, persistLegacyMirror],
  )

  const saveTemplate = useCallback(
    async (tpl: CustomReportTemplate): Promise<CustomReportTemplate | null> => {
      if (!tpl.name.trim()) return null
      if (!useRemote || !supabase || !orgId) {
        setTemplatesAndPersist((list) => {
          const i = list.findIndex((t) => t.id === tpl.id)
          if (i < 0) return [...list, tpl]
          const copy = [...list]
          copy[i] = tpl
          return copy
        })
        return tpl
      }

      setError(null)
      const definition = { modules: tpl.modules }

      try {
        if (tpl.rowVersion == null) {
          const { data, error: ie } = await supabase
            .from('report_definitions')
            .insert({
              organization_id: orgId,
              name: tpl.name.trim(),
              definition,
              created_by: user?.id ?? null,
            })
            .select('*')
            .single()
          if (ie) throw ie
          const inserted = rowToTemplate(data as DefRow)
          setTemplates((prev) => {
            const next = [inserted, ...prev.filter((t) => t.id !== tpl.id)]
            queueMicrotask(() => persistLegacyMirror({ templates: next }))
            return next
          })
          return inserted
        }

        const { data: rpcData, error: re } = await supabase.rpc('report_definition_save', {
          p_id: tpl.id,
          p_org_id: orgId,
          p_name: tpl.name.trim(),
          p_definition: definition,
          p_expected_version: tpl.rowVersion,
        })
        if (re) throw re
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
        const ok = row && typeof row === 'object' && (row as { ok?: boolean }).ok === true
        const err = row && typeof row === 'object' ? (row as { err?: string }).err : undefined
        if (!ok) {
          if (err === 'stale_version') {
            setError('Malen ble oppdatert av noen andre. Last siden på nytt og prøv igjen.')
          } else {
            setError(err ?? 'Kunne ikke lagre mal.')
          }
          return null
        }
        const newVersion = (row as { new_version?: number }).new_version
        const nowIso = new Date().toISOString()
        const updated: CustomReportTemplate = {
          ...tpl,
          updatedAt: nowIso,
          rowVersion: typeof newVersion === 'number' ? newVersion : (tpl.rowVersion ?? 1) + 1,
        }
        setTemplates((prev) => {
          const next = prev.map((t) => (t.id === tpl.id ? updated : t))
          queueMicrotask(() => persistLegacyMirror({ templates: next }))
          return next
        })
        return updated
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [useRemote, supabase, orgId, user?.id, setTemplatesAndPersist, persistLegacyMirror],
  )

  const clearError = useCallback(() => setError(null), [])

  const duplicateTemplate = useCallback(
    async (source: CustomReportTemplate): Promise<CustomReportTemplate | null> => {
      if (!useRemote || !supabase || !orgId) return null
      const baseName = `${source.name.trim()} (kopi)`
      let name = baseName
      let n = 2
      while (templates.some((t) => t.name.trim() === name.trim())) {
        name = `${source.name.trim()} (kopi ${n})`
        n += 1
      }
      setError(null)
      try {
        const { data, error: ie } = await supabase
          .from('report_definitions')
          .insert({
            organization_id: orgId,
            name: name.trim(),
            definition: { modules: source.modules },
            created_by: user?.id ?? null,
          })
          .select('*')
          .single()
        if (ie) throw ie
        const inserted = rowToTemplate(data as DefRow)
        setTemplates((prev) => {
          const next = [inserted, ...prev]
          queueMicrotask(() => persistLegacyMirror({ templates: next }))
          return next
        })
        return inserted
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [useRemote, supabase, orgId, user?.id, templates, persistLegacyMirror],
  )

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      if (!useRemote || !supabase || !orgId) {
        setTemplatesAndPersist((list) => list.filter((t) => t.id !== id))
        return true
      }
      setError(null)
      try {
        const { error: de } = await supabase.from('report_definitions').delete().eq('id', id).eq('organization_id', orgId)
        if (de) throw de
        setTemplates((prev) => {
          const next = prev.filter((t) => t.id !== id)
          queueMicrotask(() => persistLegacyMirror({ templates: next }))
          return next
        })
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [useRemote, supabase, orgId, setTemplatesAndPersist, persistLegacyMirror],
  )

  return useMemo(
    () => ({
      templates,
      loading: useRemote ? loading : false,
      error: useRemote ? error : null,
      clearError,
      refresh,
      saveTemplate,
      duplicateTemplate,
      deleteTemplate,
      definitionsAvailable: useRemote,
    }),
    [templates, loading, error, clearError, refresh, saveTemplate, duplicateTemplate, deleteTemplate, useRemote],
  )
}
