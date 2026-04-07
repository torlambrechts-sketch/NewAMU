import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { WhistleblowingCaseRow, WhistleblowingCaseStatus, WhistleblowingNoteRow } from '../types/whistleblowing'

export type CreateWhistleCaseInput = {
  category: string
  title: string
  description: string
  whoWhatWhere: string
  occurredAtText: string
  isAnonymous: boolean
  reporterContact: string
  /** Filenames only — upload pipeline can map to storage later */
  attachmentHints: string[]
}

function daysUntil(iso: string): number {
  try {
    const d = new Date(iso).getTime()
    return Math.ceil((d - Date.now()) / (24 * 60 * 60 * 1000))
  } catch {
    return 0
  }
}

export function acknowledgementUrgency(dueAt: string): 'ok' | 'soon' | 'overdue' {
  const d = daysUntil(dueAt)
  if (d < 0) return 'overdue'
  if (d <= 2) return 'soon'
  return 'ok'
}

export function useWhistleblowing() {
  const { supabase, organization, user, permissionKeys, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const useRemote = !!(supabase && orgId && user)
  const canAccessVault = isAdmin || permissionKeys.has('whistleblowing.committee')

  const [cases, setCases] = useState<WhistleblowingCaseRow[]>([])
  const [notesByCase, setNotesByCase] = useState<Record<string, WhistleblowingNoteRow[]>>({})
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: re } = await supabase
        .from('whistleblowing_cases')
        .select('*')
        .eq('organization_id', orgId)
        .order('received_at', { ascending: false })

      if (re) {
        if (re.code === 'PGRST116' || re.message?.includes('permission') || re.message?.includes('RLS')) {
          setCases([])
          setNotesByCase({})
          return
        }
        throw re
      }
      setCases((rows ?? []) as WhistleblowingCaseRow[])

      if (canAccessVault && rows?.length) {
        const ids = rows.map((r) => r.id)
        const { data: noteRows, error: ne } = await supabase
          .from('whistleblowing_case_notes')
          .select('*')
          .in('case_id', ids)
          .order('created_at', { ascending: true })
        if (ne) throw ne
        const map: Record<string, WhistleblowingNoteRow[]> = {}
        for (const n of (noteRows ?? []) as WhistleblowingNoteRow[]) {
          map[n.case_id] = [...(map[n.case_id] ?? []), n]
        }
        setNotesByCase(map)
      } else {
        setNotesByCase({})
      }
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      setCases([])
      setNotesByCase({})
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, canAccessVault])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      setCases([])
      return
    }
    void refresh()
  }, [useRemote, refresh])

  const createCase = useCallback(
    async (input: CreateWhistleCaseInput): Promise<{ id: string; accessKey: string } | null> => {
      if (!supabase || !orgId || !user) {
        setError('Mangler innlogging.')
        return null
      }
      setError(null)
      const row = {
        organization_id: orgId,
        category: input.category.trim(),
        title: input.title.trim(),
        description: input.description.trim(),
        who_what_where: input.whoWhatWhere.trim(),
        occurred_at_text: input.occurredAtText.trim() || null,
        is_anonymous: input.isAnonymous,
        reporter_contact: input.isAnonymous ? null : input.reporterContact.trim() || null,
        reporter_user_id: input.isAnonymous ? null : user.id,
        attachment_paths: input.attachmentHints.filter(Boolean),
        status: 'received' as const,
      }
      const { data, error: insErr } = await supabase.from('whistleblowing_cases').insert(row).select('id, access_key').single()
      if (insErr) {
        setError(getSupabaseErrorMessage(insErr))
        return null
      }
      await refresh()
      return { id: data.id as string, accessKey: data.access_key as string }
    },
    [supabase, orgId, user, refresh],
  )

  const updateStatus = useCallback(
    async (caseId: string, status: WhistleblowingCaseStatus) => {
      if (!supabase) return
      setError(null)
      const { error: u } = await supabase.from('whistleblowing_cases').update({ status }).eq('id', caseId)
      if (u) setError(getSupabaseErrorMessage(u))
      else await refresh()
    },
    [supabase, refresh],
  )

  const closeCase = useCallback(
    async (caseId: string, closingSummary: string) => {
      if (!supabase) return
      setError(null)
      const { error: u } = await supabase
        .from('whistleblowing_cases')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closing_summary: closingSummary.trim(),
        })
        .eq('id', caseId)
      if (u) setError(getSupabaseErrorMessage(u))
      else await refresh()
    },
    [supabase, refresh],
  )

  const appendNote = useCallback(
    async (caseId: string, body: string) => {
      if (!supabase || !orgId || !user) return
      setError(null)
      const { error: n } = await supabase.from('whistleblowing_case_notes').insert({
        case_id: caseId,
        organization_id: orgId,
        author_id: user.id,
        body: body.trim(),
      })
      if (n) setError(getSupabaseErrorMessage(n))
      else await refresh()
    },
    [supabase, orgId, user, refresh],
  )

  return useMemo(
    () => ({
      cases,
      notesByCase,
      loading: useRemote ? loading : false,
      error,
      canAccessVault,
      refresh,
      createCase,
      updateStatus,
      closeCase,
      appendNote,
    }),
    [cases, notesByCase, loading, error, canAccessVault, refresh, createCase, updateStatus, closeCase, appendNote, useRemote],
  )
}
