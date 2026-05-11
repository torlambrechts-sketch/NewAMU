// AgendaItemFormPanel — SlidePanel for add/edit of a manual agenda item.
//
// Fields: title, description, lawRef, durationMinutes, presenterMemberId.
// Attachments (wiki_pages) appear once the item has an id (i.e. after the
// first save) — we don't try to link attachments to a not-yet-created row.

import { useEffect, useState, type FormEvent } from 'react'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { MeetingAgendaItemRow } from '../types'

export type AgendaItemFormValue = {
  title: string
  description: string
  lawRef: string
  durationMinutes: string
  presenterMemberId: string
}

export type AgendaItemFormPanelProps = {
  open: boolean
  onClose: () => void
  /** When set, the panel edits this existing item; otherwise it adds a new one. */
  initial: MeetingAgendaItemRow | null
  memberOptions: Array<{ value: string; label: string }>
  onSubmit: (value: AgendaItemFormValue) => Promise<void>
}

function toValue(item: MeetingAgendaItemRow | null): AgendaItemFormValue {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    lawRef: item?.law_ref ?? '',
    durationMinutes:
      item?.duration_minutes != null ? String(item.duration_minutes) : '',
    presenterMemberId: item?.presenter_member_id ?? '',
  }
}

export function AgendaItemFormPanel({
  open,
  onClose,
  initial,
  memberOptions,
  onSubmit,
}: AgendaItemFormPanelProps) {
  const [value, setValue] = useState<AgendaItemFormValue>(toValue(initial))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setValue(toValue(initial))
  }, [open, initial])

  const isEdit = !!initial
  const canSubmit = !!value.title.trim() && !busy

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      await onSubmit(value)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meeting-agenda-item-form-title"
      title={isEdit ? `Rediger sak: ${initial?.title}` : 'Legg til ny sak'}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isEdit ? 'Lagre endringer' : 'Legg til sak'}
          </Button>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-item-title">
            Tittel
          </label>
          <StandardInput
            id="agenda-item-title"
            className="mt-1.5"
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
            placeholder="f.eks. Status fra forrige periode"
            autoFocus
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-item-description">
            Beskrivelse
          </label>
          <StandardTextarea
            id="agenda-item-description"
            className="mt-1.5"
            rows={3}
            value={value.description}
            onChange={(e) => setValue({ ...value, description: e.target.value })}
            placeholder="Bakgrunn eller pre-read for saken (valgfri)"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-item-duration">
              Varighet (min)
            </label>
            <StandardInput
              id="agenda-item-duration"
              type="number"
              min={0}
              className="mt-1.5"
              value={value.durationMinutes}
              onChange={(e) =>
                setValue({ ...value, durationMinutes: e.target.value })
              }
              placeholder="15"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-item-lawref">
              Lovreferanse (valgfri)
            </label>
            <StandardInput
              id="agenda-item-lawref"
              className="mt-1.5"
              value={value.lawRef}
              onChange={(e) => setValue({ ...value, lawRef: e.target.value })}
              placeholder="f.eks. AML § 7-2 (2) bokstav e"
            />
          </div>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-item-presenter">
            Innleder
          </label>
          <SearchableSelect
            value={value.presenterMemberId}
            options={[{ value: '', label: '— Ingen utpekt —' }, ...memberOptions]}
            onChange={(v) => setValue({ ...value, presenterMemberId: v })}
            placeholder="Velg medlem som innleder saken"
            className="mt-1.5"
          />
        </div>
      </form>
    </SlidePanel>
  )
}
