// useParagraphEvidence — read chronological evidence for one paragraph.
//
// Queries `compliance_evidence_v` (Tier 3 union view) filtered to the
// rows whose `law_refs[]` array contains the supplied code. The view
// unions seven module execution surfaces — compliance executions,
// meeting protocols, document acks, learning completions, task
// completions, register records, surveys — and is RLS-scoped to the
// caller's org via `security_invoker = true` on the underlying tables.
//
// Implements ROADMAP §5.4 ("Evidence ledger per §"): the answer to
// "Hva har vi gjort siste 12 mnd. på § 2A?" sorted descending by
// occurred_at. The hook tolerates `code` being null (no paragraph
// selected yet) by short-circuiting to an empty result.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'

export type ParagraphEvidenceRow = {
  occurred_at: string
  source_kind:
    | 'compliance_execution'
    | 'survey_response'
    | 'document_acknowledgement'
    | 'learning_completion'
    | 'task_completion'
    | 'meeting_protocol'
    | 'register_record'
    | 'manual_evidence'
  source_table: string
  source_id: string
  title: string
  law_refs: string[]
  signed_at: string | null
}

type LoadedState = {
  orgId: string
  code: string
  rows: ParagraphEvidenceRow[]
  error: string | null
}

export type UseParagraphEvidenceReturn = {
  loading: boolean
  error: string | null
  rows: ParagraphEvidenceRow[]
}

// Stable references for the two "no real data" return shapes so
// downstream `useEffect(..., [evidence.rows])` consumers don't re-fire
// every render just because the array identity churns.
const IDLE: UseParagraphEvidenceReturn = {
  loading: false,
  error: null,
  rows: [],
}
const PENDING: UseParagraphEvidenceReturn = {
  loading: true,
  error: null,
  rows: [],
}

export function useParagraphEvidence(
  code: string | null,
  /** Limit rows; default 50 (a 12-mnd. timeline rarely needs more). */
  limit: number = 50,
): UseParagraphEvidenceReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  // Single state slot keyed by (orgId, code) so an org switch or
  // paragraph switch doesn't leak the previous result.
  const [loaded, setLoaded] = useState<LoadedState | null>(null)

  useEffect(() => {
    if (!supabase || !orgId || !code) return
    // Normalise the lookup key so 'AML §4-3' (no space) matches rows
    // stored as 'AML § 4-3' — mirrors the same helper in
    // useLedelsesKpis + useInternkontrollDatasets.
    const lookupCode = normaliseLawRef(code)
    // Reset the slot whenever the (orgId, code) key changes so a
    // re-click of a paragraph that previously errored shows the
    // loading state again instead of the stuck error.
    setLoaded((prev) =>
      prev && prev.orgId === orgId && prev.code === code ? prev : null,
    )
    const controller = new AbortController()
    // Use the SECURITY INVOKER set-returning function rather than the
    // view: the function pushes `law_refs @> array[code]` into each
    // union branch so the per-table GIN indexes fire, and applies a
    // per-branch ORDER+LIMIT before the outer sort. Migration:
    // 20260929120200_compliance_evidence_for_law_ref_rpc.sql.
    void supabase
      .rpc('compliance_evidence_for_law_ref', { p_code: lookupCode, p_limit: limit })
      .abortSignal(controller.signal)
      .then(({ data, error: respErr }) => {
        if (controller.signal.aborted) return
        if (respErr) {
          // supabase-js surfaces an AbortError via the same channel
          // as real failures — guard against it before showing the
          // user a "noe gikk galt" banner that's actually our own
          // cleanup.
          if ((respErr as { name?: string }).name === 'AbortError') return
          setLoaded({
            orgId,
            code,
            rows: [],
            error: getSupabaseErrorMessage(respErr),
          })
          return
        }
        setLoaded({
          orgId,
          code,
          rows: (data ?? []) as ParagraphEvidenceRow[],
          error: null,
        })
      })
    return () => {
      controller.abort()
    }
  }, [supabase, orgId, code, limit])

  return useMemo(() => {
    if (!code) return IDLE
    const isCurrent =
      loaded !== null && loaded.orgId === orgId && loaded.code === code
    if (!isCurrent) return PENDING
    return { loading: false, error: loaded.error, rows: loaded.rows }
  }, [code, orgId, loaded])
}

/**
 * Normalise law-ref strings so 'AML §4-3' matches rows stored as
 * 'AML § 4-3'. Mirrors the helper in useLedelsesKpis +
 * useInternkontrollDatasets.
 */
function normaliseLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}
