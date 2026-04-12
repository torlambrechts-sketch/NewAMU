import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import {
  deleteComposerTemplate,
  fetchMyComposerTemplates,
  type ComposerTemplateRow,
  stackPayloadFromPreset,
  type StackTemplatePayload,
  upsertComposerTemplate,
} from '../lib/platformComposerTemplatesApi'
import type { LayoutComposerPreset } from '../lib/platformLayoutComposerStorage'
import { loadComposerPresets, saveComposerPresets } from '../lib/platformLayoutComposerStorage'
import {
  loadSavedGridLayouts,
  saveSavedGridLayouts,
  type SavedGridLayout,
} from '../lib/layoutGridComposerStorage'
import { type GridTemplatePayload } from '../lib/platformComposerTemplatesApi'

export type StackPresetUI = LayoutComposerPreset & {
  dbId?: string
  published?: boolean
  source: 'database' | 'local'
}

function rowToStackPreset(row: ComposerTemplateRow): StackPresetUI | null {
  if (row.kind !== 'stack') return null
  const p = row.payload as StackTemplatePayload
  if (!p || typeof p !== 'object' || !p.visible || !Array.isArray(p.order)) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    visible: p.visible as Record<string, boolean>,
    order: p.order as string[],
    dbId: row.id,
    published: row.published,
    source: 'database',
  }
}

export function usePlatformStackComposerTemplates(enabled: boolean, userId: string | null, isAdmin: boolean | null) {
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbRows, setDbRows] = useState<ComposerTemplateRow[]>([])
  const [localBump, setLocalBump] = useState(0)

  const refresh = useCallback((): Promise<void> => {
    return (async () => {
      if (!enabled || !supabase || !userId || !isAdmin) {
        setDbRows([])
        return
      }
      setLoading(true)
      setError(null)
      const { data, error: err } = await fetchMyComposerTemplates(supabase)
      if (err) setError(err)
      setDbRows(data.filter((r) => r.kind === 'stack'))
      setLoading(false)
    })()
  }, [enabled, supabase, userId, isAdmin])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh, localBump])

  const mergedPresets = useCallback((): StackPresetUI[] => {
    const fromDb = dbRows.map(rowToStackPreset).filter(Boolean) as StackPresetUI[]
    const locals = loadComposerPresets()
    const dbNames = new Set(fromDb.map((p) => p.name.trim().toLowerCase()))
    const localOnly: StackPresetUI[] = locals
      .filter((p) => !dbNames.has(p.name.trim().toLowerCase()))
      .map((p) => ({ ...p, source: 'local' as const }))
    return [...fromDb, ...localOnly].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [dbRows])

  const saveStackToDatabase = useCallback(
    async (input: {
      dbId?: string | null
      name: string
      visible: Record<string, boolean>
      order: string[]
      published?: boolean
    }) => {
      if (!supabase || !userId || !isAdmin) return { error: 'Ikke innlogget som plattformadmin' }
      const payload = stackPayloadFromPreset({
        id: input.dbId ?? 'temp',
        name: input.name,
        createdAt: new Date().toISOString(),
        visible: input.visible,
        order: input.order,
      })
      const { id, error } = await upsertComposerTemplate(supabase, userId, {
        id: input.dbId ?? undefined,
        name: input.name,
        kind: 'stack',
        payload: payload as unknown as Record<string, unknown>,
        published: input.published ?? false,
      })
      if (error) return { error }
      await refresh()
      const locals = loadComposerPresets().filter((p) => p.name.trim().toLowerCase() !== input.name.trim().toLowerCase())
      locals.push({
        id: id ?? crypto.randomUUID(),
        name: input.name,
        createdAt: new Date().toISOString(),
        visible: { ...input.visible },
        order: [...input.order],
      })
      saveComposerPresets(locals)
      setLocalBump((n) => n + 1)
      return { error: null as string | null, id }
    },
    [supabase, userId, isAdmin, refresh],
  )

  const removeStackTemplate = useCallback(
    async (preset: StackPresetUI) => {
      const locals = loadComposerPresets().filter((p) => p.id !== preset.id && p.name !== preset.name)
      saveComposerPresets(locals)
      if (preset.dbId && supabase && userId && isAdmin) {
        const { error } = await deleteComposerTemplate(supabase, userId, preset.dbId)
        if (error) return error
      }
      await refresh()
      setLocalBump((n) => n + 1)
      return null
    },
    [supabase, userId, isAdmin, refresh],
  )

  const setStackPublished = useCallback(
    async (dbId: string, published: boolean) => {
      if (!supabase || !userId || !isAdmin) return 'Ikke tilgang'
      const row = dbRows.find((r) => r.id === dbId)
      if (!row || row.kind !== 'stack') return 'Fant ikke mal'
      const payload = row.payload as StackTemplatePayload
      const { error } = await upsertComposerTemplate(supabase, userId, {
        id: dbId,
        name: row.name,
        kind: 'stack',
        payload: payload as unknown as Record<string, unknown>,
        published,
      })
      if (error) return error
      await refresh()
      return null
    },
    [supabase, userId, isAdmin, dbRows, refresh],
  )

  const bumpLocal = useCallback(() => setLocalBump((n) => n + 1), [])

  return {
    loading,
    error,
    mergedPresets,
    refresh,
    bumpLocal,
    saveStackToDatabase,
    removeStackTemplate,
    setStackPublished,
  }
}

export type GridLayoutUI = SavedGridLayout & {
  dbId?: string
  published?: boolean
  source: 'database' | 'local'
}

function rowToGridLayout(row: ComposerTemplateRow): GridLayoutUI | null {
  if (row.kind !== 'grid') return null
  const p = row.payload as GridTemplatePayload
  if (!p || typeof p !== 'object' || !Array.isArray(p.rows)) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rows: p.rows,
    dbId: row.id,
    published: row.published,
    source: 'database',
  }
}

export function usePlatformGridComposerTemplates(enabled: boolean, userId: string | null, isAdmin: boolean | null) {
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbRows, setDbRows] = useState<ComposerTemplateRow[]>([])
  const [localBump, setLocalBump] = useState(0)

  const refresh = useCallback((): Promise<void> => {
    return (async () => {
      if (!enabled || !supabase || !userId || !isAdmin) {
        setDbRows([])
        return
      }
      setLoading(true)
      setError(null)
      const { data, error: err } = await fetchMyComposerTemplates(supabase)
      if (err) setError(err)
      setDbRows(data.filter((r) => r.kind === 'grid'))
      setLoading(false)
    })()
  }, [enabled, supabase, userId, isAdmin])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh, localBump])

  const mergedLayouts = useCallback((): GridLayoutUI[] => {
    const fromDb = dbRows.map(rowToGridLayout).filter(Boolean) as GridLayoutUI[]
    const locals = loadSavedGridLayouts()
    const dbNames = new Set(fromDb.map((p) => p.name.trim().toLowerCase()))
    const localOnly: GridLayoutUI[] = locals
      .filter((p) => !dbNames.has(p.name.trim().toLowerCase()))
      .map((p) => ({ ...p, source: 'local' as const }))
    return [...fromDb, ...localOnly].sort((a, b) =>
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
    )
  }, [dbRows])

  const saveGridToDatabase = useCallback(
    async (input: { dbId?: string | null; name: string; rows: SavedGridLayout['rows']; published?: boolean }) => {
      if (!supabase || !userId || !isAdmin) return { error: 'Ikke innlogget som plattformadmin' }
      const payload = { rows: input.rows } satisfies GridTemplatePayload
      const { id, error } = await upsertComposerTemplate(supabase, userId, {
        id: input.dbId ?? undefined,
        name: input.name,
        kind: 'grid',
        payload: payload as unknown as Record<string, unknown>,
        published: input.published ?? false,
      })
      if (error) return { error }
      const locals = loadSavedGridLayouts().filter((p) => p.name.trim().toLowerCase() !== input.name.trim().toLowerCase())
      locals.push({
        id: id ?? crypto.randomUUID(),
        name: input.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rows: input.rows.map((r) => ({ id: r.id, columns: r.columns.map((c) => ({ ...c })) })),
      })
      saveSavedGridLayouts(locals)
      setLocalBump((n) => n + 1)
      await refresh()
      return { error: null as string | null, id }
    },
    [supabase, userId, isAdmin, refresh],
  )

  const removeGridTemplate = useCallback(
    async (layout: GridLayoutUI) => {
      const locals = loadSavedGridLayouts().filter((p) => p.id !== layout.id && p.name !== layout.name)
      saveSavedGridLayouts(locals)
      if (layout.dbId && supabase && userId && isAdmin) {
        const { error } = await deleteComposerTemplate(supabase, userId, layout.dbId)
        if (error) return error
      }
      await refresh()
      setLocalBump((n) => n + 1)
      return null
    },
    [supabase, userId, isAdmin, refresh],
  )

  const setGridPublished = useCallback(
    async (dbId: string, published: boolean) => {
      if (!supabase || !userId || !isAdmin) return 'Ikke tilgang'
      const row = dbRows.find((r) => r.id === dbId)
      if (!row || row.kind !== 'grid') return 'Fant ikke mal'
      const payload = row.payload as GridTemplatePayload
      const { error } = await upsertComposerTemplate(supabase, userId, {
        id: dbId,
        name: row.name,
        kind: 'grid',
        payload: payload as unknown as Record<string, unknown>,
        published,
      })
      if (error) return error
      await refresh()
      return null
    },
    [supabase, userId, isAdmin, dbRows, refresh],
  )

  const bumpLocal = useCallback(() => setLocalBump((n) => n + 1), [])

  return {
    loading,
    error,
    mergedLayouts,
    refresh,
    bumpLocal,
    saveGridToDatabase,
    removeGridTemplate,
    setGridPublished,
  }
}
