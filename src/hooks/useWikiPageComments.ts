import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  WikiPageComment,
  WikiPageCommentEditEntry,
  WikiPageCommentKind,
  WikiPageCommentSeverity,
} from '../types/documents'

type DbRow = {
  id: string
  page_id: string
  block_index: number
  body: string
  author_id: string
  author_name: string
  resolved: boolean
  created_at: string
  parent_comment_id?: string | null
  kind?: string | null
  severity?: string | null
  is_anonymous?: boolean | null
  is_confidential?: boolean | null
  legal_basis?: string[] | null
  edited_history?: unknown
  resolved_at?: string | null
  resolved_by?: string | null
  deleted_at?: string | null
  updated_at?: string | null
  hidden_until_reviewed?: boolean | null
  linked_avvik_id?: string | null
}

const VALID_KINDS = new Set<WikiPageCommentKind>(['comment', 'suggestion', 'avvik_proposal', 'varsling'])

function coerceKind(raw: string | null | undefined): WikiPageCommentKind {
  if (raw && VALID_KINDS.has(raw as WikiPageCommentKind)) return raw as WikiPageCommentKind
  return 'comment'
}

function coerceSeverity(raw: string | null | undefined): WikiPageCommentSeverity | null {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'critical') return raw
  return null
}

function coerceEditHistory(raw: unknown): WikiPageCommentEditEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const o = entry as Record<string, unknown>
      if (typeof o.at !== 'string' || typeof o.by !== 'string' || typeof o.prev_body !== 'string') return null
      return { at: o.at, by: o.by, prevBody: o.prev_body }
    })
    .filter((e): e is WikiPageCommentEditEntry => e !== null)
}

function mapRow(row: DbRow): WikiPageComment {
  return {
    id: row.id,
    pageId: row.page_id,
    blockIndex: row.block_index,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    resolved: row.resolved,
    createdAt: row.created_at,
    parentCommentId: row.parent_comment_id ?? null,
    kind: coerceKind(row.kind),
    severity: coerceSeverity(row.severity),
    isAnonymous: row.is_anonymous === true,
    isConfidential: row.is_confidential === true,
    legalBasis: Array.isArray(row.legal_basis) ? row.legal_basis : [],
    editedHistory: coerceEditHistory(row.edited_history),
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    deletedAt: row.deleted_at ?? null,
    updatedAt: row.updated_at ?? null,
    hiddenUntilReviewed: row.hidden_until_reviewed === true,
    linkedAvvikId: row.linked_avvik_id ?? null,
  }
}

export type AddCommentInput = {
  blockIndex: number
  body: string
  authorName: string
  parentCommentId?: string | null
  kind?: WikiPageCommentKind
  severity?: WikiPageCommentSeverity | null
  isAnonymous?: boolean
  isConfidential?: boolean
  legalBasis?: string[]
}

export type EditCommentInput = {
  commentId: string
  body: string
}

/** Edits to own comments allowed within 15 minutes of creation. */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000

export function canEditComment(c: WikiPageComment, currentUserId: string | undefined, now: number): boolean {
  if (!currentUserId || c.authorId !== currentUserId) return false
  if (c.isConfidential) return false
  if (c.deletedAt) return false
  return now - new Date(c.createdAt).getTime() <= COMMENT_EDIT_WINDOW_MS
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
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) {
          setComments([])
          return
        }
        // Fallback for environments still on the pre-soft-delete schema (deleted_at column missing).
        if (String(e.message).toLowerCase().includes('deleted_at')) {
          const { data: legacy } = await supabase
            .from('wiki_page_comments')
            .select('*')
            .eq('organization_id', orgId)
            .eq('page_id', pageId)
            .order('created_at', { ascending: true })
          setComments((legacy ?? []).map((r) => mapRow(r as DbRow)))
          return
        }
        throw e
      }
      setComments((data ?? []).map((r) => mapRow(r as DbRow)))
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
    async (input: AddCommentInput) => {
      if (!supabase || !orgId || !pageId || !user?.id) throw new Error('Ikke tilkoblet.')
      const kind: WikiPageCommentKind = input.kind ?? 'comment'
      const severity =
        kind === 'avvik_proposal' || kind === 'varsling' ? input.severity ?? 'medium' : null
      const isAnonymous = input.isAnonymous === true
      const isConfidential = input.isConfidential === true || kind === 'varsling'
      const displayName = isAnonymous ? 'Anonym ansatt' : input.authorName.trim() || 'Bruker'
      const payload = {
        organization_id: orgId,
        page_id: pageId,
        block_index: input.blockIndex,
        body: input.body.trim(),
        author_id: user.id,
        author_name: displayName,
        resolved: false,
        parent_comment_id: input.parentCommentId ?? null,
        kind,
        severity,
        is_anonymous: isAnonymous,
        is_confidential: isConfidential,
        legal_basis: input.legalBasis ?? [],
      }
      const { data, error: e } = await supabase
        .from('wiki_page_comments')
        .insert(payload)
        .select('*')
        .single()
      if (e) throw e
      const row = mapRow(data as DbRow)
      setComments((prev) => [...prev, row])
      return row
    },
    [supabase, orgId, pageId, user?.id],
  )

  const editComment = useCallback(
    async ({ commentId, body }: EditCommentInput) => {
      if (!supabase || !orgId || !user?.id) throw new Error('Ikke tilkoblet.')
      const existing = comments.find((c) => c.id === commentId)
      if (!existing) throw new Error('Kommentaren finnes ikke.')
      if (!canEditComment(existing, user.id, Date.now())) {
        throw new Error('Du kan kun redigere egne kommentarer innen 15 minutter.')
      }
      const newHistoryEntry = {
        at: new Date().toISOString(),
        by: user.id,
        prev_body: existing.body,
      }
      const historyForDb = [
        ...existing.editedHistory.map((h) => ({ at: h.at, by: h.by, prev_body: h.prevBody })),
        newHistoryEntry,
      ]
      const trimmed = body.trim()
      if (!trimmed) throw new Error('Kommentaren kan ikke være tom.')
      const { data, error: e } = await supabase
        .from('wiki_page_comments')
        .update({
          body: trimmed,
          edited_history: historyForDb,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (e) throw e
      const row = mapRow(data as DbRow)
      setComments((prev) => prev.map((c) => (c.id === commentId ? row : c)))
      return row
    },
    [supabase, orgId, user?.id, comments],
  )

  const setResolved = useCallback(
    async (commentId: string, resolved: boolean) => {
      if (!supabase || !orgId) return
      const patch: Record<string, unknown> = { resolved }
      if (resolved) {
        patch.resolved_at = new Date().toISOString()
        patch.resolved_by = user?.id ?? null
      } else {
        patch.resolved_at = null
        patch.resolved_by = null
      }
      const { error: e } = await supabase
        .from('wiki_page_comments')
        .update(patch)
        .eq('id', commentId)
        .eq('organization_id', orgId)
      if (e) throw e
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                resolved,
                resolvedAt: resolved ? (patch.resolved_at as string) : null,
                resolvedBy: resolved ? (user?.id ?? null) : null,
              }
            : c,
        ),
      )
    },
    [supabase, orgId, user?.id],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!supabase || !orgId) return
      const existing = comments.find((c) => c.id === commentId)
      if (existing?.isConfidential) {
        throw new Error('Konfidensielle kommentarer kan ikke slettes.')
      }
      // Soft delete first; fall back to hard delete on legacy schema.
      const { error: softErr } = await supabase
        .from('wiki_page_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('organization_id', orgId)
      if (softErr && String(softErr.message).toLowerCase().includes('deleted_at')) {
        const { error: hardErr } = await supabase
          .from('wiki_page_comments')
          .delete()
          .eq('id', commentId)
          .eq('organization_id', orgId)
        if (hardErr) throw hardErr
      } else if (softErr) {
        throw softErr
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
    [supabase, orgId, comments],
  )

  /** Build a tree: top-level comments and their replies in insertion order. */
  const threadsByBlock = useMemo(() => {
    const byBlock = new Map<number, WikiPageComment[]>()
    for (const c of comments) {
      if (!byBlock.has(c.blockIndex)) byBlock.set(c.blockIndex, [])
      byBlock.get(c.blockIndex)!.push(c)
    }
    return byBlock
  }, [comments])

  return {
    comments,
    threadsByBlock,
    loading,
    refresh,
    addComment,
    editComment,
    setResolved,
    removeComment,
  }
}
