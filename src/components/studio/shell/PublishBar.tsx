// PublishBar — review_status transition surface.
//
// Phase 3.1 acceptance: editing transitions to 'draft'; submit-for-
// review transitions to 'reviewed' (+ emits compliance_notifications
// studio_review_requested); approve transitions to 'approved'.
//
// This is the visible counterpart of the studio_review_status column
// shipped on every studio-aware table in 20260914120900. Mounted in
// AdvancedShell above the embedder. Per-row state because review is
// per-row, not per-scope.
//
// Spec: specs/studio-builder.md §5 Phase 3 Task 3.1.

import { useCallback, useState } from 'react'
import { Send, ShieldCheck, FileEdit } from 'lucide-react'
import { Button } from '../../ui/Button'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { freshId } from '../../../lib/studio/freshId'

export type ReviewStatus = 'draft' | 'reviewed' | 'approved'

export type PublishBarProps = {
  rowTable: string
  rowId: string
  scopeId: string
  kindId: string
  currentStatus: ReviewStatus
  onStatusChange?: (next: ReviewStatus) => void
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Utkast',
  reviewed: 'Til godkjenning',
  approved: 'Godkjent',
}

const STATUS_CLASS: Record<ReviewStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  reviewed: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export function PublishBar({
  rowTable,
  rowId,
  scopeId,
  kindId,
  currentStatus,
  onStatusChange,
}: PublishBarProps) {
  const { supabase, organization, user } = useOrgSetupContext()
  const [status, setStatus] = useState<ReviewStatus>(currentStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transition = useCallback(
    async (next: ReviewStatus, category: string) => {
      if (!supabase || !organization || !user) return
      setBusy(true)
      setError(null)
      const { error: updateErr } = await supabase
        .from(rowTable)
        .update({ review_status: next })
        .eq('id', rowId)
      if (updateErr) {
        setError(updateErr.message)
        setBusy(false)
        return
      }
      // Best-effort notification — failures are non-fatal (the
      // status transition is the canonical state; the notification
      // is just the inbox surface). recipient_user_id + notification_key
      // are NOT NULL on the table; severity must be one of
      // low/medium/high/critical.
      try {
        await supabase
          .from('compliance_notifications')
          .insert({
            organization_id: organization.id,
            recipient_user_id: user.id,
            category,
            payload: { row_id: rowId, scope_id: scopeId, kind_id: kindId, row_table: rowTable },
            title:
              category === 'studio_review_requested'
                ? 'Innhold sendt til gjennomgang'
                : category === 'studio_review_approved'
                  ? 'Innhold godkjent'
                  : 'Innhold returnert til utkast',
            body: `${scopeId}::${kindId}`,
            severity: category === 'studio_review_approved' ? 'low' : 'medium',
            notification_key: freshId(`studio:${category}:${rowTable}:${rowId}`),
          })
      } catch {
        /* non-fatal — the underlying status transition already landed */
      }
      setStatus(next)
      setBusy(false)
      onStatusChange?.(next)
    },
    [supabase, organization, user, rowTable, rowId, scopeId, kindId, onStatusChange],
  )

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CLASS[status]}`}
        >
          {status === 'draft' ? <FileEdit className="h-3 w-3" aria-hidden /> : null}
          {status === 'reviewed' ? <Send className="h-3 w-3" aria-hidden /> : null}
          {status === 'approved' ? <ShieldCheck className="h-3 w-3" aria-hidden /> : null}
          {STATUS_LABEL[status]}
        </span>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {status === 'draft' ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void transition('reviewed', 'studio_review_requested')}
          >
            Send til gjennomgang
          </Button>
        ) : null}
        {status === 'reviewed' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void transition('draft', 'studio_review_rejected')}
            >
              Returner til utkast
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void transition('approved', 'studio_review_approved')}
            >
              Godkjenn
            </Button>
          </>
        ) : null}
        {status === 'approved' ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void transition('draft', 'studio_review_rejected')}
          >
            Åpne for endring
          </Button>
        ) : null}
      </div>
    </div>
  )
}
