// Branded confirm dialog — replaces window.confirm for destructive
// actions on /admin/templates. Esc closes; click outside closes; the
// primary button gets focus on mount so Enter confirms.

import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

type Props = {
  title: string
  body: string
  /** Primary action label (e.g. "Slett"). */
  confirmLabel: string
  /** Cancel action label (default "Avbryt"). */
  cancelLabel?: string
  /** Visual tone for the primary button. */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Avbryt',
  tone = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-[#1a3d32] text-white hover:bg-[#16382e]'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          {tone === 'danger' ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 id="confirm-title" className="text-lg font-semibold text-neutral-900">
              {title}
            </h3>
            <p id="confirm-body" className="mt-2 whitespace-pre-line text-sm text-neutral-700">
              {body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Avbryt"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
