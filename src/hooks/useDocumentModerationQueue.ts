// useDocumentModerationQueue — list of flagged comments awaiting moderation
// (org admin / documents.manage / whistleblowing.committee). Mirrors the
// shape of the avvik kanban: each flag joins the underlying comment + the
// page title so the reviewer has full context without another query.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type ModerationAction = 'pending_review' | 'released' | 'kept_hidden' | 'escalated_to_varsling'

export type ModerationFlag = {
  id: string
  commentId: string
  pageId: string
  pageTitle: string
  authorId: string
  authorName: string
  body: string
  reason: string
  matchedTerms: string[]
  flaggedAt: string
  action: ModerationAction
  reviewedAt: string | null
  reviewerNote: string | null
}

type FlagRow = {
  id: string
  comment_id: string
  reason: string
  matched_terms: string[] | null
  flagged_at: string
  reviewed_at: string | null
  reviewer_note: string | null
  action: string
  wiki_page_comments: {
    id: string
    page_id: string
    body: string
    author_id: string
    author_name: string
    hidden_until_reviewed: boolean | null
  } | null
}

const VALID_ACTIONS = new Set<ModerationAction>([
  'pending_review',
  'released',
  'kept_hidden',
  'escalated_to_varsling',
])

function coerceAction(raw: string): ModerationAction {
  return VALID_ACTIONS.has(raw as ModerationAction) ? (raw as ModerationAction) : 'pending_review'
}

export function useDocumentModerationQueue(filter: ModerationAction | 'all' = 'pending_review') {
  const { supabase, organization, user, isAdmin, permissionKeys } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canModerate =
    isAdmin || permissionKeys.has('documents.manage') || permissionKeys.has('whistleblowing.committee')

  const [flags, setFlags] = useState<ModerationFlag[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageTitles, setPageTitles] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !canModerate) {
      setFlags([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('wiki_comment_moderation_flags')
        .select(
          'id, comment_id, reason, matched_terms, flagged_at, reviewed_at, reviewer_note, action, wiki_page_comments:comment_id(id, page_id, body, author_id, author_name, hidden_until_reviewed)',
        )
        .eq('organization_id', orgId)
        .order('flagged_at', { ascending: false })
      if (filter !== 'all') {
        q = q.eq('action', filter)
      }
      const { data, error: e } = await q
      if (e) {
        if (!String(e.message).toLowerCase().includes('does not exist')) {
          setError(e.message)
        }
        setFlags([])
        return
      }
      const rows = (data ?? []) as unknown as FlagRow[]
      const pageIds = [...new Set(rows.map((r) => r.wiki_page_comments?.page_id).filter((id): id is string => Boolean(id)))]
      let titles: Record<string, string> = {}
      if (pageIds.length > 0) {
        const { data: pageRows } = await supabase
          .from('wiki_pages')
          .select('id, title')
          .eq('organization_id', orgId)
          .in('id', pageIds)
        titles = Object.fromEntries(
          (pageRows ?? []).map((r: { id: string; title: string }) => [r.id, r.title]),
        )
      }
      setPageTitles(titles)
      setFlags(
        rows
          .filter((r) => r.wiki_page_comments)
          .map((r) => ({
            id: r.id,
            commentId: r.comment_id,
            pageId: r.wiki_page_comments!.page_id,
            pageTitle: titles[r.wiki_page_comments!.page_id] ?? r.wiki_page_comments!.page_id,
            authorId: r.wiki_page_comments!.author_id,
            authorName: r.wiki_page_comments!.author_name,
            body: r.wiki_page_comments!.body,
            reason: r.reason,
            matchedTerms: r.matched_terms ?? [],
            flaggedAt: r.flagged_at,
            action: coerceAction(r.action),
            reviewedAt: r.reviewed_at,
            reviewerNote: r.reviewer_note,
          })),
      )
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, canModerate, filter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const decide = useCallback(
    async (flagId: string, action: Exclude<ModerationAction, 'pending_review'>, note?: string) => {
      if (!supabase || !orgId || !user?.id) return
      const flag = flags.find((f) => f.id === flagId)
      if (!flag) return
      const patch: Record<string, unknown> = {
        action,
        reviewed_at: new Date().toISOString(),
        reviewer_id: user.id,
        reviewer_note: note?.trim() || null,
      }
      const { error: e } = await supabase
        .from('wiki_comment_moderation_flags')
        .update(patch)
        .eq('id', flagId)
        .eq('organization_id', orgId)
      if (e) throw e

      if (action === 'released') {
        await supabase
          .from('wiki_page_comments')
          .update({ hidden_until_reviewed: false })
          .eq('id', flag.commentId)
          .eq('organization_id', orgId)
      }
      if (action === 'escalated_to_varsling') {
        // Convert the hidden comment into a confidential varsling row so it
        // moves from the harassment queue into the varsling channel (still
        // visible only to admin / whistleblowing.committee).
        await supabase
          .from('wiki_page_comments')
          .update({
            kind: 'varsling',
            severity: 'high',
            is_confidential: true,
            hidden_until_reviewed: false,
          })
          .eq('id', flag.commentId)
          .eq('organization_id', orgId)
      }
      await refresh()
    },
    [supabase, orgId, user?.id, flags, refresh],
  )

  const counts = useMemo(() => {
    const out = { pending_review: 0, released: 0, kept_hidden: 0, escalated_to_varsling: 0 }
    for (const f of flags) out[f.action] += 1
    return out
  }, [flags])

  return { flags, loading, error, refresh, decide, counts, canModerate, pageTitles }
}
