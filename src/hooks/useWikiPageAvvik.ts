// useWikiPageAvvik — lists deviations linked to a wiki page via the bridge
// table (wiki_page_avvik_links) and exposes a `promoteComment` helper for
// manually escalating a regular comment to an avvik. High/critical
// avvik_proposal comments are auto-promoted by a DB trigger; this hook
// covers the manual flow for medium/low severities and for plain comments.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { WikiPageCommentSeverity } from '../types/documents'

export type LinkedAvvik = {
  linkId: string
  deviationId: string
  pageId: string
  sourceCommentId: string | null
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: string
  createdAt: string
  closedAt: string | null
}

type DbLinkRow = {
  id: string
  page_id: string
  deviation_id: string
  source_comment_id: string | null
  deviations: {
    id: string
    title: string
    description: string
    severity: string
    status: string
    created_at: string
    closed_at: string | null
  } | null
}

const VALID_SEVS = new Set(['low', 'medium', 'high', 'critical'])

function mapRow(row: DbLinkRow): LinkedAvvik | null {
  if (!row.deviations) return null
  const sev = VALID_SEVS.has(row.deviations.severity)
    ? (row.deviations.severity as LinkedAvvik['severity'])
    : 'medium'
  return {
    linkId: row.id,
    deviationId: row.deviation_id,
    pageId: row.page_id,
    sourceCommentId: row.source_comment_id,
    title: row.deviations.title,
    description: row.deviations.description,
    severity: sev,
    status: row.deviations.status,
    createdAt: row.deviations.created_at,
    closedAt: row.deviations.closed_at,
  }
}

export function useWikiPageAvvik(pageId: string | undefined) {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [linked, setLinked] = useState<LinkedAvvik[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !pageId) {
      setLinked([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wiki_page_avvik_links')
        .select(
          'id, page_id, deviation_id, source_comment_id, deviations:deviation_id(id, title, description, severity, status, created_at, closed_at)',
        )
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
      if (error) {
        if (!String(error.message).toLowerCase().includes('does not exist')) {
          console.warn('wiki_page_avvik_links:', error.message)
        }
        setLinked([])
        return
      }
      setLinked(
        (data ?? [])
          .map((r) => mapRow(r as unknown as DbLinkRow))
          .filter((r): r is LinkedAvvik => r !== null),
      )
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, pageId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /**
   * Manually promote a comment to an avvik. Used when the user clicks
   * "Meld som avvik" on a comment that wouldn't otherwise auto-promote.
   * Returns the new deviation id, or null on failure.
   */
  const promoteCommentToAvvik = useCallback(
    async (input: {
      commentId: string
      body: string
      severity: WikiPageCommentSeverity
      pageTitle: string
    }): Promise<string | null> => {
      if (!supabase || !orgId || !pageId || !user?.id) return null
      // Insert deviation first.
      const { data: dev, error: devErr } = await supabase
        .from('deviations')
        .insert({
          organization_id: orgId,
          source: 'wiki_page',
          title: `Avvik foreslått: ${input.pageTitle.slice(0, 80)}`,
          description: input.body,
          severity: input.severity,
          status: 'rapportert',
          created_by: user.id,
        })
        .select('id')
        .single()
      if (devErr || !dev) {
        if (devErr) console.warn('promoteCommentToAvvik:', devErr.message)
        return null
      }
      const deviationId = (dev as { id: string }).id
      // Bridge row.
      await supabase.from('wiki_page_avvik_links').insert({
        organization_id: orgId,
        page_id: pageId,
        deviation_id: deviationId,
        source_comment_id: input.commentId,
      })
      // Back-pointer on the comment.
      await supabase
        .from('wiki_page_comments')
        .update({ linked_avvik_id: deviationId })
        .eq('id', input.commentId)
        .eq('organization_id', orgId)
      await refresh()
      return deviationId
    },
    [supabase, orgId, pageId, user?.id, refresh],
  )

  return { linked, loading, refresh, promoteCommentToAvvik }
}
