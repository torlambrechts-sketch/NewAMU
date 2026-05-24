// useControlClauses — read + manage the control ↔ clause junction.
//
// Returns both: (a) the junction rows for the active org, plus (b) the
// `regulation_clauses` rows used as the picker source. Same-org
// coherence is enforced by the DB trigger; the hook just pre-filters
// to active rows to keep the picker compact.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  ControlClauseRowSchema,
  RegulationClauseRowSchema,
  parseRows,
} from './schema'
import type {
  ControlClauseRow,
  ControlCoverageLevel,
  RegulationClauseRow,
} from './types'

type UseControlClausesInput = {
  supabase: SupabaseClient | null
}

export type AssignClauseInput = {
  control_id: string
  clause_id: string
  coverage_level?: ControlCoverageLevel
  notes?: string
}

export type UseControlClausesReturn = {
  loading: boolean
  error: string | null
  /** Junction rows for this org. */
  junctions: ControlClauseRow[]
  /** All active regulation_clauses for this org (system + org-custom). */
  clauses: RegulationClauseRow[]
  /** Clauses grouped by regulation_id (e.g. {'aml': [...], 'iso-45001': [...]}) */
  clausesByRegulation: Record<string, RegulationClauseRow[]>
  /** Junction rows grouped by control_id. */
  junctionsByControlId: Record<string, ControlClauseRow[]>
  /** Junction rows grouped by clause_id. */
  junctionsByClauseId: Record<string, ControlClauseRow[]>
  /** Clauses indexed by id. */
  clausesById: Record<string, RegulationClauseRow>
  refresh: () => Promise<void>
  assignClause: (input: AssignClauseInput) => Promise<void>
  unassignClause: (controlId: string, clauseId: string) => Promise<void>
  setCoverageLevel: (
    controlId: string,
    clauseId: string,
    level: ControlCoverageLevel,
  ) => Promise<void>
}

export function useControlClauses(
  input: UseControlClausesInput,
): UseControlClausesReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [junctions, setJunctions] = useState<ControlClauseRow[]>([])
  const [clauses, setClauses] = useState<RegulationClauseRow[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [jResp, cResp] = await Promise.all([
        supabase.from('internal_control_clauses').select('*'),
        supabase
          .from('regulation_clauses')
          .select('*')
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('regulation_id', { ascending: true })
          .order('position', { ascending: true }),
      ])
      if (jResp.error) throw jResp.error
      if (cResp.error) throw cResp.error

      const pj = parseRows(jResp.data ?? [], ControlClauseRowSchema)
      const pc = parseRows(cResp.data ?? [], RegulationClauseRowSchema)
      setJunctions(pj.ok)
      setClauses(pc.ok)
      const failed = pj.failed + pc.failed
      if (failed > 0) {
        setError(`Kunne ikke tolke ${failed} klausul-rader.`)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const clausesByRegulation = useMemo(() => {
    const map: Record<string, RegulationClauseRow[]> = {}
    for (const c of clauses) {
      if (!map[c.regulation_id]) map[c.regulation_id] = []
      map[c.regulation_id].push(c)
    }
    return map
  }, [clauses])

  const clausesById = useMemo(() => {
    const map: Record<string, RegulationClauseRow> = {}
    for (const c of clauses) map[c.id] = c
    return map
  }, [clauses])

  const junctionsByControlId = useMemo(() => {
    const map: Record<string, ControlClauseRow[]> = {}
    for (const j of junctions) {
      if (!map[j.control_id]) map[j.control_id] = []
      map[j.control_id].push(j)
    }
    return map
  }, [junctions])

  const junctionsByClauseId = useMemo(() => {
    const map: Record<string, ControlClauseRow[]> = {}
    for (const j of junctions) {
      if (!map[j.clause_id]) map[j.clause_id] = []
      map[j.clause_id].push(j)
    }
    return map
  }, [junctions])

  const assignClause = useCallback(
    async (i: AssignClauseInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('internal_control_clauses')
          .insert({
            control_id: i.control_id,
            clause_id: i.clause_id,
            coverage_level: i.coverage_level ?? 'primary',
            notes: i.notes ?? '',
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = ControlClauseRowSchema.safeParse(data)
        if (parsed.success) {
          setJunctions((prev) => [...prev, parsed.data])
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const unassignClause = useCallback(
    async (controlId: string, clauseId: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { error: delErr } = await supabase
          .from('internal_control_clauses')
          .delete()
          .eq('control_id', controlId)
          .eq('clause_id', clauseId)
        if (delErr) throw delErr
        setJunctions((prev) =>
          prev.filter(
            (j) => !(j.control_id === controlId && j.clause_id === clauseId),
          ),
        )
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const setCoverageLevel = useCallback(
    async (
      controlId: string,
      clauseId: string,
      level: ControlCoverageLevel,
    ): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { data, error: upErr } = await supabase
          .from('internal_control_clauses')
          .update({ coverage_level: level })
          .eq('control_id', controlId)
          .eq('clause_id', clauseId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = ControlClauseRowSchema.safeParse(data)
        if (parsed.success) {
          setJunctions((prev) =>
            prev.map((j) =>
              j.control_id === controlId && j.clause_id === clauseId
                ? parsed.data
                : j,
            ),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      junctions,
      clauses,
      clausesByRegulation,
      junctionsByControlId,
      junctionsByClauseId,
      clausesById,
      refresh: load,
      assignClause,
      unassignClause,
      setCoverageLevel,
    }),
    [
      loading,
      error,
      junctions,
      clauses,
      clausesByRegulation,
      junctionsByControlId,
      junctionsByClauseId,
      clausesById,
      load,
      assignClause,
      unassignClause,
      setCoverageLevel,
    ],
  )
}
