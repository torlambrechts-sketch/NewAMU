import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { WikiPageComment } from '../types/documents'

function mapRow(row: {
  id: string
  page_id: string
  block_index: number
  body: string
  author_id: string
  author_name: string
  resolved: boolean
  created_at: string
}): WikiPageComment {
  return {
    id: row.id,
    pageId: row.page_id,
    blockIndex: row.block_index,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    resolved: row.resolved,
    createdAt: row.created_at,
  }
}

export function useWikiPageComments(pageId: string | undefined) {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const [comments, setComments] = useState<WikiPageComment[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !pageId) {
      setComments([])
      return
    }
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('wiki_page_comments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
        .order('created_at', { ascending: true })
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) {
          setComments([])
          return
        }
        throw e
      }
      setComments((data ?? []).map((r) => mapRow(r as Parameters<typeof mapRow>[0])))
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, pageId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addComment = useCallback(
    async (input: { blockIndex: number; body: string; authorName: string }) => {
      if (!supabase || !orgId || !pageId || !user?.id) throw new Error('Ikke tilkoblet.')
      const { data, error: e } = await supabase
        .from('wiki_page_comments')
        .insert({
          organization_id: orgId,
          page_id: pageId,
          block_index: input.blockIndex,
          body: input.body.trim(),
          author_id: user.id,
          author_name: input.authorName.trim() || 'Bruker',
          resolved: false,
        })
        .select('*')
        .single()
      if (e) throw e
      const row = mapRow(data as Parameters<typeof mapRow>[0])
      setComments((prev) => [...prev, row])
      return row
    },
    [supabase, orgId, pageId, user?.id],
  )

  const setResolved = useCallback(
    async (commentId: string, resolved: boolean) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase.from('wiki_page_comments').update({ resolved }).eq('id', commentId).eq('organization_id', orgId)
      if (e) throw e
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)))
    },
    [supabase, orgId],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase.from('wiki_page_comments').delete().eq('id', commentId).eq('organization_id', orgId)
      if (e) throw e
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
    [supabase, orgId],
  )

  return { comments, loading, refresh, addComment, setResolved, removeComment }
}

export async function fetchWikiMentionRecipientsFromHtml(
  supabase: SupabaseClient | null | undefined,
  html: string,
): Promise<{ id: string; label: string }[]> {
  if (!supabase) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const ids = new Set<string>()
  doc.querySelectorAll('[data-user-id]').forEach((el) => {
    const id = el.getAttribute('data-user-id')
    if (id) ids.add(id)
  })
  if (ids.size === 0) return []
  const { data, error } = await supabase.from('profiles').select('id, display_name').in('id', [...ids])
  if (error || !data) return [...ids].map((id) => ({ id, label: id }))
  const map = new Map(data.map((r: { id: string; display_name: string }) => [r.id, r.display_name]))
  return [...ids].map((id) => ({ id, label: map.get(id) ?? id }))
}
