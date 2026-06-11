// OKRCheckinDialog — the H2.1 check-in form: confidence + (manual-mode) value
// + note, submitted through the okr_record_checkin RPC by the caller. Shared
// between the planning page and the meeting OKR-review block (H2.2), which is
// why it lives next to OKRDashboard instead of under pages/planning.

import { useId, useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { ConfidencePicker, OKRModal } from './OKREditDialogs'
import type { Confidence } from './types'

export type CheckinDialogTarget = {
  krId: string
  krTitle: string
  objectiveTitle: string
  /** Current numeric value — prefill for manual mode. */
  currentValue: number
  unit: string
  confidence: Confidence
  /** Rollup mode: value is derived from tasks, so the input is hidden. */
  isRollup: boolean
}

export type CheckinFormPayload = {
  krId: string
  confidence: Confidence
  /** Undefined in rollup mode or when left unchanged-blank. */
  value?: number
  note?: string
}

export function OKRCheckinDialog({
  open,
  target,
  onClose,
  onSubmit,
}: {
  open: boolean
  target: CheckinDialogTarget | null
  onClose: () => void
  onSubmit: (payload: CheckinFormPayload) => void | Promise<void>
}) {
  if (!open || !target) return null
  return <CheckinDialogInner key={target.krId} target={target} onClose={onClose} onSubmit={onSubmit} />
}

function CheckinDialogInner({
  target,
  onClose,
  onSubmit,
}: {
  target: CheckinDialogTarget
  onClose: () => void
  onSubmit: (payload: CheckinFormPayload) => void | Promise<void>
}) {
  const titleId = useId()
  const [confidence, setConfidence] = useState<Confidence>(target.confidence)
  const [valueRaw, setValueRaw] = useState(String(target.currentValue))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const parsed = Number(valueRaw.replace(',', '.'))
      await onSubmit({
        krId: target.krId,
        confidence,
        value: target.isRollup || valueRaw.trim() === '' || Number.isNaN(parsed) ? undefined : parsed,
        note: note.trim() || undefined,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <OKRModal
      open
      onClose={onClose}
      labelledById={titleId}
      title={<span id={titleId}>Sjekk inn</span>}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Lagrer…' : 'Lagre innsjekk'}
          </Button>
        </>
      }
    >
      <p className="mb-1 text-sm font-medium text-neutral-900">{target.krTitle}</p>
      <p className="mb-4 text-xs text-neutral-500">
        Under <span className="font-medium text-neutral-700">{target.objectiveTitle}</span>
      </p>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-600">
            Tillit
          </span>
          <ConfidencePicker value={confidence} onChange={setConfidence} />
        </div>

        {!target.isRollup ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-600">
              Nå-verdi{target.unit ? ` (${target.unit})` : ''}
            </span>
            <StandardInput
              value={valueRaw}
              onChange={(e) => setValueRaw(e.target.value)}
              inputMode="decimal"
              placeholder={String(target.currentValue)}
              className="font-mono tabular-nums"
            />
          </label>
        ) : (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Verdien beregnes fra koblede oppgaver — innsjekken oppdaterer tillit og notat.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-600">
            Notat
          </span>
          <StandardTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Hvorfor står det slik? Hva er neste steg?"
          />
        </label>
      </form>
    </OKRModal>
  )
}
