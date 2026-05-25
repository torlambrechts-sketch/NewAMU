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
    let cancelled = false
    void supabase
      .from('compliance_evidence_v')
      .select('occurred_at, source_kind, source_table, source_id, title, law_refs, signed_at')
      .contains('law_refs', [code])
      .order('occurred_at', { ascending: false })
      .limit(limit)
      .then(({ data, error: respErr }) => {
        if (cancelled) return
        if (respErr) {
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
      cancelled = true
    }
  }, [supabase, orgId, code, limit])

  return useMemo(() => {
    if (!code) return { loading: false, error: null, rows: [] }
    const isCurrent =
      loaded !== null && loaded.orgId === orgId && loaded.code === code
    if (!isCurrent) return { loading: true, error: null, rows: [] }
    return { loading: false, error: loaded.error, rows: loaded.rows }
  }, [code, orgId, loaded])
}
