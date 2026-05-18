// ISO gap analysis hook — manages sessions and clause responses for the
// clause-by-clause gap assessment tool.
//
// A session has a status (in_progress / completed) and a score_pct
// computed when the user marks the session complete. Responses map each
// ISO clause to a rating (0–3) with optional notes and linked task IDs.
//
// One hook instance covers both the hub (session list) and the session
// runner (clause responses). Pass sessionId=null for the hub view.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { IsoGapSession, IsoGapResponse, IsoStandard, IsoClause, GapRating } from '../types/iso'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const GapSessionRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  standard: z.enum(['iso-9001', 'iso-14001', 'iso-45001', 'iso-27001']),
  title: z.string(),
  status: z.enum(['in_progress', 'completed']),
  score_pct: z.number().nullable(),
  completed_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const GapResponseRowSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  clause_id: z.string(),
  rating: z.number().int().min(0).max(3),
  notes: z.string().nullable(),
  task_ids: z.array(z.string().uuid()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
})

const IsoClauseRowSchema = z.object({
  id: z.string(),
  standard: z.enum(['iso-9001', 'iso-14001', 'iso-45001', 'iso-27001']),
  clause_id: z.string(),
  title: z.string(),
  parent_id: z.string().nullable(),
  is_leaf: z.boolean(),
  position: z.number().int(),
})

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapSession(row: z.infer<typeof GapSessionRowSchema>): IsoGapSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    standard: row.standard,
    status: row.status,
    scorePct: row.score_pct,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapResponse(row: z.infer<typeof GapResponseRowSchema>): IsoGapResponse {
  return {
    id: row.id,
    sessionId: row.session_id,
    clauseId: row.clause_id,
    rating: row.rating as GapRating,
    notes: row.notes,
    taskIds: row.task_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapClause(row: z.infer<typeof IsoClauseRowSchema>): IsoClause {
  return {
    id: row.id,
    standard: row.standard,
    clauseId: row.clause_id,
    title: row.title,
    parentId: row.parent_id,
    isLeaf: row.is_leaf,
    position: row.position,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export type UseIsoGapAnalysisReturn = {
  loading: boolean
  error: string | null
  // Session list (hub view)
  sessions: IsoGapSession[]
  // Active session (runner view)
  session: IsoGapSession | null
  clauses: IsoClause[]
  responses: IsoGapResponse[]
  responseByClauseId: Map<string, IsoGapResponse>
  // Actions
  createSession: (standard: IsoStandard) => Promise<IsoGapSession | null>
  upsertResponse: (clauseId: string, rating: GapRating, notes?: string) => Promise<void>
  completeSession: () => Promise<void>
  refresh: () => Promise<void>
}

export function useIsoGapAnalysis(sessionId: string | null): UseIsoGapAnalysisReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<IsoGapSession[]>([])
  const [session, setSession] = useState<IsoGapSession | null>(null)
  const [clauses, setClauses] = useState<IsoClause[]>([])
  const [responses, setResponses] = useState<IsoGapResponse[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      // Always load the session list.
      const { data: sessionRows, error: sErr } = await supabase
        .from('iso_gap_analysis_sessions')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      if (sErr) throw sErr

      const parsedSessions: IsoGapSession[] = []
      for (const row of sessionRows ?? []) {
        const p = GapSessionRowSchema.safeParse(row)
        if (p.success) parsedSessions.push(mapSession(p.data))
      }
      setSessions(parsedSessions)

      if (sessionId) {
        const activeSession = parsedSessions.find((s) => s.id === sessionId) ?? null
        setSession(activeSession)

        if (activeSession) {
          // Load clauses for this standard.
          const { data: clauseRows, error: cErr } = await supabase
            .from('iso_standard_clauses')
            .select('*')
            .eq('standard', activeSession.standard)
            .order('position', { ascending: true })
          if (cErr) throw cErr

          const parsedClauses: IsoClause[] = []
          for (const row of clauseRows ?? []) {
            const p = IsoClauseRowSchema.safeParse(row)
            if (p.success) parsedClauses.push(mapClause(p.data))
          }
          setClauses(parsedClauses)

          // Load responses for this session.
          const { data: responseRows, error: rErr } = await supabase
            .from('iso_gap_analysis_responses')
            .select('*')
            .eq('session_id', sessionId)
          if (rErr) throw rErr

          const parsedResponses: IsoGapResponse[] = []
          for (const row of responseRows ?? []) {
            const p = GapResponseRowSchema.safeParse(row)
            if (p.success) parsedResponses.push(mapResponse(p.data))
          }
          setResponses(parsedResponses)
        }
      } else {
        setSession(null)
        setClauses([])
        setResponses([])
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, sessionId])

  useEffect(() => { void load() }, [load])

  const responseByClauseId = useMemo(
    () => new Map(responses.map((r) => [r.clauseId, r])),
    [responses],
  )

  const createSession = useCallback(
    async (standard: IsoStandard): Promise<IsoGapSession | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const dateStr = new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
        const title = `Gap-analyse ${standard.toUpperCase().replace('-', ' ')} — ${dateStr}`
        const { data, error: insErr } = await supabase
          .from('iso_gap_analysis_sessions')
          .insert({ organization_id: orgId, standard, status: 'in_progress', title })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = GapSessionRowSchema.safeParse(data)
        if (!parsed.success) return null
        const newSession = mapSession(parsed.data)
        setSessions((prev) => [newSession, ...prev])
        return newSession
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId],
  )

  const upsertResponse = useCallback(
    async (clauseId: string, rating: GapRating, notes?: string): Promise<void> => {
      if (!supabase || !orgId || !sessionId) return
      setError(null)
      try {
        const { data, error: upsertErr } = await supabase
          .from('iso_gap_analysis_responses')
          .upsert(
            { session_id: sessionId, clause_id: clauseId, rating, notes: notes ?? null },
            { onConflict: 'session_id,clause_id' },
          )
          .select('*')
          .single()
        if (upsertErr) throw upsertErr
        const parsed = GapResponseRowSchema.safeParse(data)
        if (parsed.success) {
          const next = mapResponse(parsed.data)
          setResponses((prev) => {
            const idx = prev.findIndex((r) => r.clauseId === clauseId)
            return idx >= 0 ? prev.map((r, i) => (i === idx ? next : r)) : [...prev, next]
          })
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, sessionId],
  )

  const completeSession = useCallback(async (): Promise<void> => {
    if (!supabase || !orgId || !sessionId || !session) return
    setError(null)
    try {
      const leafClauses = clauses.filter((c) => c.isLeaf)
      const answered = responses.filter((r) => r.rating >= 2).length
      const total = leafClauses.length || 1
      const scorePct = Math.round((answered / total) * 100)

      const { data, error: upErr } = await supabase
        .from('iso_gap_analysis_sessions')
        .update({ status: 'completed', score_pct: scorePct, completed_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (upErr) throw upErr

      const parsed = GapSessionRowSchema.safeParse(data)
      if (parsed.success) {
        const updated = mapSession(parsed.data)
        setSession(updated)
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    }
  }, [supabase, orgId, sessionId, session, clauses, responses])

  return useMemo(
    () => ({
      loading,
      error,
      sessions,
      session,
      clauses,
      responses,
      responseByClauseId,
      createSession,
      upsertResponse,
      completeSession,
      refresh: load,
    }),
    [loading, error, sessions, session, clauses, responses, responseByClauseId, createSession, upsertResponse, completeSession, load],
  )
}
