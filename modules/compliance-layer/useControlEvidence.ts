// useControlEvidence — read `internal_control_executions` (per-control
// ledger) + `compliance_evidence_v` (cross-module union).
//
// The executions table is append-only; mutations are denied at the DB
// trigger layer. The view inherits RLS from its source tables — users
// only see rows they're allowed to read in the underlying modules.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  ComplianceEvidenceViewRowSchema,
  ControlExecutionRowSchema,
  parseRows,
} from './schema'
import { DEFAULT_CONTROL_EVIDENCE_LIMIT } from './limits'
import type {
  ComplianceEvidenceViewRow,
  ControlBindingSourceKind,
  ControlExecutionRow,
} from './types'

/** Mirrors the helper in useParagraphEvidence / useLedelsesKpis. */
function normaliseLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

type UseControlEvidenceInput = {
  supabase: SupabaseClient | null
  /** When set, scope executions to a single control. */
  controlId?: string | null
  /** When set, scope evidence by paragraph code (exact string match into law_refs[]). */
  lawRef?: string | null
  /** Max rows to load (default DEFAULT_CONTROL_EVIDENCE_LIMIT). */
  limit?: number
}

export type ManualEvidenceInput = {
  control_id: string
  occurred_at: string
  summary: string
  evidence_url?: string | null
  period_label?: string | null
  payload?: Record<string, unknown>
}

export type UseControlEvidenceReturn = {
  loading: boolean
  error: string | null
  executions: ControlExecutionRow[]
  evidence: ComplianceEvidenceViewRow[]
  /** Executions grouped by control_id (when not scoped). */
  byControlId: Record<string, ControlExecutionRow[]>
  refresh: () => Promise<void>
  /** Record a manual evidence row (e.g. external audit certificate). */
  recordManualEvidence: (
    input: ManualEvidenceInput,
  ) => Promise<string | null>
}

export function useControlEvidence(
  input: UseControlEvidenceInput,
): UseControlEvidenceReturn {
  const { supabase, controlId, lawRef, limit } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const effectiveLimit = limit ?? DEFAULT_CONTROL_EVIDENCE_LIMIT

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executions, setExecutions] = useState<ControlExecutionRow[]>([])
  const [evidence, setEvidence] = useState<ComplianceEvidenceViewRow[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      let execQuery = supabase
        .from('internal_control_executions')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(effectiveLimit)
      if (controlId) execQuery = execQuery.eq('control_id', controlId)

      // Filtered evidence queries go through the SECURITY INVOKER
      // RPC that pushes the law_refs predicate into each union branch
      // (GIN-friendly) and applies per-branch ORDER+LIMIT. Unfiltered
      // queries — the cross-control ledger — keep using the view
      // because the function only handles the filtered case.
      // Normalise the law-ref so 'AML §4-3' (no space) matches rows
      // stored as 'AML § 4-3' — same helper as useParagraphEvidence
      // + useLedelsesKpis.
      const evidencePromise = lawRef
        ? supabase.rpc('compliance_evidence_for_law_ref', {
            p_code: normaliseLawRef(lawRef),
            p_limit: effectiveLimit,
          })
        : supabase
            .from('compliance_evidence_v')
            .select('*')
            .order('occurred_at', { ascending: false })
            .limit(effectiveLimit)

      const [execResp, evidenceResp] = await Promise.all([
        execQuery,
        evidencePromise,
      ])
      if (execResp.error) throw execResp.error
      if (evidenceResp.error) throw evidenceResp.error

      const pe = parseRows(execResp.data ?? [], ControlExecutionRowSchema)
      const pv = parseRows(
        evidenceResp.data ?? [],
        ComplianceEvidenceViewRowSchema,
      )
      setExecutions(pe.ok)
      setEvidence(pv.ok)
      const failed = pe.failed + pv.failed
      if (failed > 0) setError(`Kunne ikke tolke ${failed} bevisrader.`)
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, controlId, lawRef, effectiveLimit])

  useEffect(() => {
    void load()
  }, [load])

  const byControlId = useMemo(() => {
    const map: Record<string, ControlExecutionRow[]> = {}
    for (const e of executions) {
      if (!map[e.control_id]) map[e.control_id] = []
      map[e.control_id].push(e)
    }
    return map
  }, [executions])

  const recordManualEvidence = useCallback(
    async (i: ManualEvidenceInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const sourceKind: ControlBindingSourceKind = 'manual_evidence'
        // Generate a synthetic source_id so the idempotency index doesn't
        // collide if multiple manual entries are uploaded for the same
        // control. Use crypto.randomUUID() if available; fallback below.
        let syntheticId: string
        try {
          syntheticId = crypto.randomUUID()
        } catch {
          syntheticId =
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 10)
        }
        const { data, error: insErr } = await supabase
          .from('internal_control_executions')
          .insert({
            control_id: i.control_id,
            organization_id: orgId,
            source_kind: sourceKind,
            source_table: 'manual',
            source_id: `manual:${syntheticId}`,
            occurred_at: i.occurred_at,
            summary: i.summary,
            evidence_url: i.evidence_url ?? null,
            period_label: i.period_label ?? null,
            payload: i.payload ?? {},
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = ControlExecutionRowSchema.safeParse(data)
        if (parsed.success) {
          setExecutions((prev) => [parsed.data, ...prev])
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      executions,
      evidence,
      byControlId,
      refresh: load,
      recordManualEvidence,
    }),
    [loading, error, executions, evidence, byControlId, load, recordManualEvidence],
  )
}
