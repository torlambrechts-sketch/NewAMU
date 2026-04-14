import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { PageLayout, PageLayoutRow, PageLayoutSection } from '../types/pageLayout'

const LS_PREFIX = 'klarert_page_layout_v1'

function lsKey(pageKey: string) {
  return `${LS_PREFIX}:${pageKey}`
}

function rowToLayout(row: PageLayoutRow): PageLayout {
  return {
    id: row.id,
    pageKey: row.page_key,
    sections: row.sections ?? [],
    publishedAt: row.published ? row.updated_at : null,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
  }
}

function readLocalLayout(pageKey: string): PageLayout | null {
  try {
    const raw = localStorage.getItem(lsKey(pageKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PageLayout>
    if (!parsed.sections) return null
    return {
      id: parsed.id ?? 'local',
      pageKey,
      sections: parsed.sections,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

function writeLocalLayout(layout: PageLayout) {
  try {
    localStorage.setItem(lsKey(layout.pageKey), JSON.stringify(layout))
  } catch { /* quota */ }
}

function removeLocalLayout(pageKey: string) {
  try {
    localStorage.removeItem(lsKey(pageKey))
  } catch { /* ignore */ }
}

export type UsePageLayoutReturn = {
  layout: PageLayout | null
  loading: boolean
  error: string | null
  /** Replace the whole sections tree and persist. */
  save: (sections: PageLayoutSection[]) => Promise<void>
  /** Publish the current DB row (admin only). */
  publish: () => Promise<void>
  /** Unpublish. */
  unpublish: () => Promise<void>
  /** Reload from DB (or localStorage). */
  refresh: () => Promise<void>
}

/**
 * Loads and persists the layout for a single page.
 *
 * - When Supabase is configured, reads `page_layouts` where `page_key = pageKey`
 *   (published rows first, then the latest admin draft).
 * - Falls back to localStorage so the editor still works without a DB.
 * - `save()` writes to Supabase if available, else localStorage.
 */
export function usePageLayout(pageKey: string): UsePageLayoutReturn {
  const { supabase, user } = useOrgSetupContext()
  const [layout, setLayout] = useState<PageLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dbRowIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (supabase) {
      try {
        // Prefer the published row; fall back to the latest admin draft.
        const { data: pubRows } = await supabase
          .from('page_layouts')
          .select('*')
          .eq('page_key', pageKey)
          .eq('published', true)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (pubRows && pubRows.length > 0) {
          const row = pubRows[0] as PageLayoutRow
          dbRowIdRef.current = row.id
          setLayout(rowToLayout(row))
          setLoading(false)
          return
        }

        // Fall back to any row for this page_key (could be an unpublished draft).
        const { data: draftRows } = await supabase
          .from('page_layouts')
          .select('*')
          .eq('page_key', pageKey)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (draftRows && draftRows.length > 0) {
          const row = draftRows[0] as PageLayoutRow
          dbRowIdRef.current = row.id
          setLayout(rowToLayout(row))
          setLoading(false)
          return
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`DB-feil ved lasting av layout: ${msg}`)
      }
    }

    // No DB or no row — try localStorage.
    const local = readLocalLayout(pageKey)
    if (local) {
      setLayout(local)
    }
    setLoading(false)
  }, [supabase, pageKey])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (sections: PageLayoutSection[]) => {
    const now = new Date().toISOString()
    const next: PageLayout = {
      id: dbRowIdRef.current ?? 'local',
      pageKey,
      sections,
      updatedAt: now,
      createdBy: user?.id,
    }

    // Optimistic UI update.
    setLayout(next)

    if (supabase && user) {
      try {
        if (dbRowIdRef.current) {
          const { error: upErr } = await supabase
            .from('page_layouts')
            .update({ sections, updated_at: now })
            .eq('id', dbRowIdRef.current)
          if (upErr) throw upErr
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('page_layouts')
            .insert({
              page_key: pageKey,
              sections,
              published: false,
              created_by: user.id,
            })
            .select()
            .single()
          if (insErr) throw insErr
          if (ins) {
            dbRowIdRef.current = (ins as PageLayoutRow).id
            setLayout(rowToLayout(ins as PageLayoutRow))
          }
        }
        return
      } catch (e) {
        const msg =
          e instanceof Error ? e.message
          : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
          : String(e)
        setError(`Lagring feilet: ${msg} — lagrer lokalt.`)
      }
    }

    // Supabase not available or failed — persist in localStorage.
    writeLocalLayout(next)
  }, [supabase, user, pageKey])

  const publish = useCallback(async () => {
    if (!supabase || !dbRowIdRef.current) return
    const { error: e } = await supabase
      .from('page_layouts')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('id', dbRowIdRef.current)
    if (e) { setError(`Publisering feilet: ${e.message}`); return }
    setLayout((prev) => prev ? { ...prev, publishedAt: new Date().toISOString() } : prev)
  }, [supabase])

  const unpublish = useCallback(async () => {
    if (!supabase || !dbRowIdRef.current) return
    const { error: e } = await supabase
      .from('page_layouts')
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq('id', dbRowIdRef.current)
    if (e) { setError(`Avpublisering feilet: ${e.message}`); return }
    setLayout((prev) => prev ? { ...prev, publishedAt: null } : prev)
  }, [supabase])

  const refresh = useCallback(() => load(), [load])

  return { layout, loading, error, save, publish, unpublish, refresh }
}

export { removeLocalLayout }
