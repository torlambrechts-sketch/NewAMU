// Studio Builder — hook for attaching context to studio-mediated mutations.
//
// The actual studio_revisions rows are written automatically by the
// per-table BEFORE INSERT/UPDATE/DELETE trigger (studio_capture_revision)
// shipped in Task 0.1. This hook is the Studio UI's write boundary —
// callers use it when they want to attach a `change_reason` to the
// revision (e.g. "Updated AML § 4-3 wording per Q2 review") or fetch
// recent revisions for a row.
//
// Why a hook rather than a one-off util:
// 1. Studio writes need org + user context, which lives in useOrgSetupContext
// 2. Phase 1+ will add telemetry / autosave coordination here
// 3. Centralising the boundary makes Phase 2 review-status workflow
//    (compliance_review_status transitions) easier to wire
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.8.

import { useCallback } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'

export type StudioRevisionRow = {
  id: string
  scope_id: string
  kind_id: string
  row_id: string
  row_table: string
  organization_id: string | null
  prev_payload: unknown
  next_payload: unknown
  changed_by: string | null
  changed_at: string
  change_reason: string | null
  review_status: 'draft' | 'reviewed' | 'approved'
}

export type StudioWriteMeta = {
  /** The DB table the mutator wrote to. */
  rowTable: string
  /** The row's id (uuid). */
  rowId: string
  /** Optional human-readable rationale attached to the revision. */
  changeReason?: string
}

export function useStudioRevision() {
  const { supabase, organization } = useOrgSetupContext()

  /**
   * Update the most recent revision row for (rowTable, rowId) with a
   * change_reason. Idempotent — re-running with the same reason is a no-op.
   * The revision row itself was written by the DB trigger; we just stamp
   * the reason after the fact since the trigger has no access to it.
   *
   * Returns true when a reason was attached, false when no row matched
   * (e.g. the table doesn't yet have a studio_capture_revision trigger
   * wired) or no reason was provided.
   */
  const attachChangeReason = useCallback(
    async (rowTable: string, rowId: string, reason: string): Promise<boolean> => {
      if (!supabase || !reason.trim()) return false
      const { data, error: selectErr } = await supabase
        .from('studio_revisions')
        .select('id')
        .eq('row_table', rowTable)
        .eq('row_id', rowId)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (selectErr || !data?.id) return false
      const { error: updateErr } = await supabase
        .from('studio_revisions')
        .update({ change_reason: reason.trim() })
        .eq('id', data.id)
      if (updateErr) {
        // Don't throw — the underlying mutation already succeeded.
        // eslint-disable-next-line no-console
        console.warn('[studio] attachChangeReason failed:', getSupabaseErrorMessage(updateErr))
        return false
      }
      return true
    },
    [supabase],
  )

  /**
   * The studio write boundary. Calls `mutator`, then optionally attaches
   * `changeReason` to the revision the DB trigger captured. Returns the
   * mutator's result.
   *
   * Use this in the studio shell's publish path. Outside the studio shell
   * (e.g. existing per-module editors that haven't migrated), keep using
   * the direct mutator — the DB trigger still captures revisions, just
   * without a change_reason.
   */
  const writeStudio = useCallback(
    async <T,>(meta: StudioWriteMeta, mutator: () => Promise<T>): Promise<T> => {
      const result = await mutator()
      if (meta.changeReason && meta.rowId) {
        // Fire-and-forget; the row write already succeeded.
        void attachChangeReason(meta.rowTable, meta.rowId, meta.changeReason)
      }
      return result
    },
    [attachChangeReason],
  )

  /**
   * Fetch recent revisions for a row. Phase 2a wires this into the
   * Studio shell's VersionTimeline panel; Phase 0 just exposes the
   * helper for testability + early consumers.
   */
  const fetchRevisions = useCallback(
    async (rowTable: string, rowId: string, limit = 20): Promise<StudioRevisionRow[]> => {
      if (!supabase || !organization) return []
      const { data, error: e } = await supabase
        .from('studio_revisions')
        .select('*')
        .eq('row_table', rowTable)
        .eq('row_id', rowId)
        .order('changed_at', { ascending: false })
        .limit(limit)
      if (e || !data) return []
      return data as StudioRevisionRow[]
    },
    [supabase, organization],
  )

  return { writeStudio, attachChangeReason, fetchRevisions }
}
