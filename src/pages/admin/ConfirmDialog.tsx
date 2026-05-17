// Branded confirm dialog — replaces window.confirm for destructive
// actions on /admin/templates. Esc closes; click outside closes; the
// primary button gets focus on mount so Enter confirms.
//
// Type-the-phrase guard (P0 UX Run 2): when `confirmPhrase` is set,
// a StandardInput is rendered below the body and the danger button is
// disabled until the user types the exact phrase (case-sensitive).
// Used for high-risk destructive ops (rule deletion, prod deactivation,
// invoice cancellation, gov outbox cancel, cert rotation).

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { StandardInput } from '../../components/ui/Input'

type Props = {
  title: string
  body: string
  /** Primary action label (e.g. "Slett"). */
  confirmLabel: string
  /** Cancel action label (default "Avbryt"). */
  cancelLabel?: string
  /** Visual tone for the primary button. */
  tone?: 'danger' | 'primary'
  /**
   * When set, the dialog renders a type-to-confirm input below the body.
   * The danger button stays disabled until `input === confirmPhrase`
   * (case-sensitive). Used for the highest-risk destructive ops where
   * a single mis-click would be hard to recover from (rule delete, prod
   * gov-rule deactivation, invoice cancel, outbox cancel, cert rotation).
   */
  confirmPhrase?: string
  /**
   * Label rendered above the input. `{phrase}` is replaced by
   * `confirmPhrase`. Default: 'Skriv "{phrase}" for å bekrefte:'.
   */
  confirmPhraseLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Avbryt',
  tone = 'danger',
  confirmPhrase,
  confirmPhraseLabel,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    // When type-to-confirm is on, focus the input first — the danger
    // button starts disabled so focusing it would be misleading.
    if (confirmPhrase) {
      inputRef.current?.focus()
    } else {
      confirmRef.current?.focus()
    }
  }, [confirmPhrase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const phraseMatches = !confirmPhrase || typed === confirmPhrase
  const confirmDisabled = !!confirmPhrase && !phraseMatches

  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-[#1a3d32] text-white hover:bg-[#16382e]'

  const renderedPhraseLabel = (() => {
    if (!confirmPhrase) return null
    const template = confirmPhraseLabel ?? 'Skriv "{phrase}" for å bekrefte:'
    return template.replace('{phrase}', confirmPhrase)
  })()

  const handleConfirm = () => {
    if (confirmDisabled) return
    setTyped('')
    onConfirm()
  }

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
        {confirmPhrase ? (
          <label className="mt-4 block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              {renderedPhraseLabel}
            </span>
            <StandardInput
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !confirmDisabled) {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
              placeholder={confirmPhrase}
              className="mt-1.5 font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={confirmDisabled}
            />
            {!phraseMatches && typed.length > 0 ? (
              <span className="mt-1 block text-[11px] text-rose-700">
                Frase må stemme nøyaktig (skiller mellom store og små bokstaver).
              </span>
            ) : null}
          </label>
        ) : null}
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
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`rounded-md px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
