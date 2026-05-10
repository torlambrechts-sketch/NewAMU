// Inline review banner for a wiki page.
//
// One panel that adapts to viewer + page state:
//   • Author with reviewRequired + no pending request → "Send til godkjenning"
//   • Reviewer with pending request → "Godkjenn" / "Be om endringer"
//   • Anyone else → status badge + latest reviewer comment
//
// Calls into the existing useDocuments() actions (submitForReview /
// approveReviewRequest / requestReviewChanges). Audit and notifications
// flow through useDocuments → wiki_audit_ledger.

import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardEdit, ShieldAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { StandardTextarea } from '../ui/Textarea'
import { WarningBox } from '../ui/AlertBox'
import type { WikiPage, WikiReviewRequest } from '../../types/documents'

type Props = {
  page: WikiPage
  requests: WikiReviewRequest[]
  currentUserId: string | undefined
  reviewerName?: string
  onSubmitForReview?: (pageId: string) => Promise<void>
  onApprove: (requestId: string) => Promise<void>
  onRequestChanges: (requestId: string, comment: string) => Promise<void>
}

const STATUS_LABEL: Record<WikiReviewRequest['status'], string> = {
  pending: 'Venter på godkjenning',
  approved: 'Godkjent og publisert',
  changes_requested: 'Endringer ønsket',
}

const STATUS_VARIANT: Record<WikiReviewRequest['status'], 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  changes_requested: 'danger',
}

export function DocumentReviewRequestPanel({
  page,
  requests,
  currentUserId,
  reviewerName,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
}: Props) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const forPage = useMemo(
    () =>
      requests
        .filter((r) => r.pageId === page.id)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [requests, page.id],
  )
  const pending = forPage.find((r) => r.status === 'pending') ?? null
  const latest = forPage[0] ?? null

  const isAuthor = currentUserId === page.authorId
  const isReviewer = pending && currentUserId === pending.reviewerId

  if (!page.reviewRequired && !latest) return null

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#e6f4ef] text-[#0f766e]">
          <ClipboardEdit className="size-4" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">Godkjenning</h3>
        {latest ? <Badge variant={STATUS_VARIANT[latest.status]}>{STATUS_LABEL[latest.status]}</Badge> : null}
        {reviewerName ? (
          <span className="ml-auto text-[11px] text-neutral-500">Godkjenner: {reviewerName}</span>
        ) : null}
      </div>

      {latest?.reviewerComment ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="font-medium">Tilbakemelding fra godkjenner</p>
          <p className="mt-1 whitespace-pre-wrap">{latest.reviewerComment}</p>
        </div>
      ) : null}

      {err ? (
        <div className="mt-3">
          <WarningBox>{err}</WarningBox>
        </div>
      ) : null}

      {/* Author actions */}
      {isAuthor && page.reviewRequired && !pending && page.status !== 'archived' && onSubmitForReview ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                await onSubmitForReview(page.id)
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Kunne ikke sende til godkjenning.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
            Send til godkjenning
          </Button>
          <span className="text-[11px] text-neutral-500">
            Godkjenner får varsel og kan godkjenne eller be om endringer.
          </span>
        </div>
      ) : null}

      {/* Reviewer actions */}
      {pending && isReviewer ? (
        <div className="mt-3 space-y-2">
          <StandardTextarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Tilbakemelding ved avslag — frivillig ved godkjenning."
            className="text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setErr(null)
                try {
                  await onApprove(pending.id)
                  setComment('')
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Kunne ikke godkjenne.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
              Godkjenn og publiser
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setErr(null)
                try {
                  await onRequestChanges(pending.id, comment.trim() || 'Trenger endringer.')
                  setComment('')
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Kunne ikke sende tilbake.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <ShieldAlert className="mr-1 size-3.5" aria-hidden />
              Be om endringer
            </Button>
          </div>
        </div>
      ) : null}

      {pending && !isReviewer && !isAuthor ? (
        <p className="mt-3 text-xs text-neutral-500">
          Dokumentet venter på at godkjenner skal ta stilling.
        </p>
      ) : null}

      {!latest && page.reviewRequired ? (
        <p className="mt-3 text-xs text-neutral-500">
          Godkjenning er aktivert. Når forfatter sender til godkjenning, vises forespørselen her.
        </p>
      ) : null}
    </div>
  )
}
