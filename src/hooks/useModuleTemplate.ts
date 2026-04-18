import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { defaultInspeksjonsrunderTemplate, type ModuleTemplate, type ModuleTemplateRow } from '../types/moduleTemplate'

const LS_PREFIX = 'klarert_module_template_v1'

function lsKey(moduleKey: string) {
  return `${LS_PREFIX}:${moduleKey}`
}

/** Map of moduleKey → factory for built-in defaults */
const DEFAULT_FACTORIES: Record<string, () => ModuleTemplate> = {
  'hse.inspections': defaultInspeksjonsrunderTemplate,
}

/** Stable default — must not be a new function each render (breaks useCallback([load]) → infinite fetch loop). */
function defaultTemplateForKey(moduleKey: string): ModuleTemplate {
  const f = DEFAULT_FACTORIES[moduleKey]
  if (f) return f()
  return {
    id: `local-${moduleKey}`,
    moduleKey,
    name: moduleKey,
    schemaVersion: 1,
    heading: { title: moduleKey, description: '' },
    tableColumns: [],
    statuses: [],
    caseTypes: [],
    fieldSchema: [],
    workflowRules: [],
    schedules: [],
    kpis: [],
    rolePermissions: [],
    published: false,
  } as ModuleTemplate
}

function rowToTemplate(row: ModuleTemplateRow): ModuleTemplate {
  return {
    id: row.id,
    moduleKey: row.module_key,
    name: row.name,
    schemaVersion: row.schema_version,
    published: row.published,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.config ?? {}),
  } as ModuleTemplate
}

function readLocalTemplate(moduleKey: string): ModuleTemplate | null {
  try {
    const raw = localStorage.getItem(lsKey(moduleKey))
    if (!raw) return null
    return JSON.parse(raw) as ModuleTemplate
  } catch {
    return null
  }
}

function writeLocalTemplate(t: ModuleTemplate) {
  try {
    localStorage.setItem(lsKey(t.moduleKey), JSON.stringify(t))
  } catch { /* quota */ }
}

export type UseModuleTemplateReturn = {
  template: ModuleTemplate
  loading: boolean
  error: string | null
  /** Persist config changes (Supabase if available, else localStorage) */
  save: (partial: Partial<ModuleTemplate>) => Promise<void>
  /** Publish the current DB row */
  publish: () => Promise<void>
  /** Unpublish */
  unpublish: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Loads and persists the module template config for a single module.
 *
 * Priority order:
 *  1. Published DB row (Supabase)
 *  2. Draft DB row (Supabase, for platform admins)
 *  3. localStorage (offline / no-DB fallback)
 *  4. Built-in code default (always safe)
 */
export function useModuleTemplate(moduleKey: string): UseModuleTemplateReturn {
  const { supabase, user } = useOrgSetupContext()

  const [template, setTemplate] = useState<ModuleTemplate>(() => {
    // Synchronous init: try localStorage first, then default
    return readLocalTemplate(moduleKey) ?? defaultTemplateForKey(moduleKey)
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dbRowIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (supabase) {
      try {
        // Prefer published row
        const { data: pub } = await supabase
          .from('module_templates')
          .select('*')
          .eq('module_key', moduleKey)
          .eq('published', true)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (pub && pub.length > 0) {
          const row = pub[0] as ModuleTemplateRow
          dbRowIdRef.current = row.id
          setTemplate(rowToTemplate(row))
          setLoading(false)
          return
        }

        // Fall back to draft
        const { data: draft } = await supabase
          .from('module_templates')
          .select('*')
          .eq('module_key', moduleKey)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (draft && draft.length > 0) {
          const row = draft[0] as ModuleTemplateRow
          dbRowIdRef.current = row.id
          setTemplate(rowToTemplate(row))
          setLoading(false)
          return
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message
          : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
          : String(e)
        setError(`DB-feil: ${msg}`)
      }
    }

    // Fallback: localStorage → code default
    const local = readLocalTemplate(moduleKey)
    if (local) setTemplate(local)
    else setTemplate(defaultTemplateForKey(moduleKey))
    setLoading(false)
  }, [supabase, moduleKey])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (partial: Partial<ModuleTemplate>) => {
    const next: ModuleTemplate = { ...template, ...partial, updatedAt: new Date().toISOString() }
    setTemplate(next)

    if (supabase && user) {
      try {
        const { heading, tableColumns, statuses, caseTypes, fieldSchema, workflowRules, schedules, kpis, rolePermissions } = next
        const config = { heading, tableColumns, statuses, caseTypes, fieldSchema, workflowRules, schedules, kpis, rolePermissions }

        if (dbRowIdRef.current) {
          const { error: upErr } = await supabase
            .from('module_templates')
            .update({ config, name: next.name, updated_at: next.updatedAt })
            .eq('id', dbRowIdRef.current)
          if (upErr) throw upErr
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('module_templates')
            .insert({ module_key: moduleKey, name: next.name, schema_version: next.schemaVersion, config, published: false, created_by: user.id })
            .select()
            .single()
          if (insErr) throw insErr
          if (ins) {
            dbRowIdRef.current = (ins as ModuleTemplateRow).id
            setTemplate(rowToTemplate(ins as ModuleTemplateRow))
          }
        }
        return
      } catch (e) {
        const msg = e instanceof Error ? e.message
          : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
          : String(e)
        setError(`Lagring feilet: ${msg} — lagrer lokalt.`)
      }
    }

    writeLocalTemplate(next)
  }, [supabase, user, moduleKey, template])

  const publish = useCallback(async () => {
    if (!supabase || !dbRowIdRef.current) return
    const { error: e } = await supabase
      .from('module_templates')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('id', dbRowIdRef.current)
    if (e) { setError(`Publisering feilet: ${e.message}`); return }
    setTemplate((prev) => ({ ...prev, published: true }))
  }, [supabase])

  const unpublish = useCallback(async () => {
    if (!supabase || !dbRowIdRef.current) return
    const { error: e } = await supabase
      .from('module_templates')
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq('id', dbRowIdRef.current)
    if (e) { setError(`Avpublisering feilet: ${e.message}`); return }
    setTemplate((prev) => ({ ...prev, published: false }))
  }, [supabase])

  const refresh = useCallback(() => load(), [load])

  return { template, loading, error, save, publish, unpublish, refresh }
}
