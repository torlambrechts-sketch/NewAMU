import { DocumentAccessRequestForm } from './DocumentAccessRequestForm'
import { Button } from '../ui/Button'
import type { WikiAccessRequestDuration, WikiAccessRequestScope } from '../../types/wikiAccessRequest'

type SubmitInput = {
  justification: string
  accessScope: WikiAccessRequestScope
  duration: WikiAccessRequestDuration
}

type Props = {
  open: boolean
  title: string
  documentLabel: string
  subLabel?: string
  busy: boolean
  error: string | null
  done: boolean
  onClose: () => void
  onSubmit: (input: SubmitInput) => void | Promise<void>
}

/**
 * Modal wrapper for {@link DocumentAccessRequestForm} (e.g. user tapped Edit without folder write).
 */
export function DocumentAccessRequestDialog({
  open,
  title,
  documentLabel,
  subLabel,
  busy,
  error,
  done,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-req-dialog-title"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-xl md:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="access-req-dialog-title" className="text-sm font-semibold text-neutral-900">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" disabled={busy} onClick={onClose}>
            Lukk
          </Button>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          Du kan fortsatt be om tilgang. En administrator behandler forespørselen under Dokumenter → Innstillinger.
        </p>
        <div className="mt-4">
          {done ? (
            <p className="text-sm text-neutral-700">Søknaden er sendt.</p>
          ) : (
            <DocumentAccessRequestForm
              documentLabel={documentLabel}
              subLabel={subLabel}
              busy={busy}
              error={error}
              onSubmit={onSubmit}
              embedded
            />
          )}
        </div>
      </div>
    </div>
  )
}
