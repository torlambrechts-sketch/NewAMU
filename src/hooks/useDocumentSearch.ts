import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PageStatus, WikiDocumentSearchResult } from '../types/documents'

function mapSearchRow(r: Record<string, unknown>): WikiDocumentSearchResult {
  const st = r.status
  const status: PageStatus =
    st === 'published' || st === 'draft' || st === 'archived' ? st : 'draft'
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    summary: r.summary == null ? null : String(r.summary),
    status,
    spaceId: String(r.space_id),
    updatedAt: String(r.updated_at),
    rank: typeof r.rank === 'number' ? r.rank : Number(r.rank) || 0,
  }
}

export function useDocumentSearch(supabase: SupabaseClient | null | undefined, orgId: string | undefined) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WikiDocumentSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!supabase || !orgId || trimmed.length < 2) {
        setResults([])
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcErr } = await supabase.rpc('search_wiki_pages', {
          p_organization_id: orgId,
          p_query: trimmed,
          p_limit: 20,
        })
        if (rpcErr) throw rpcErr
        const rows = Array.isArray(data) ? data : []
        setResults(rows.map((row) => mapSearchRow(row as Record<string, unknown>)))
      } catch (e) {
        setResults([])
        setError(e instanceof Error ? e.message : 'Søket feilet.')
      } finally {
        setLoading(false)
      }
    },
    [supabase, orgId],
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      void search(query)
    }, 250)
    return () => window.clearTimeout(id)
  }, [query, search])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  return { query, setQuery, results, loading, error, clear }
}
