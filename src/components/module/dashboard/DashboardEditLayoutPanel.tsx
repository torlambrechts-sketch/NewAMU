// DashboardEditLayoutPanel — slide-panel UX for arranging widgets in a
// dashboard layout. Mirrors the "Edit Dashboard" panel from the
// reference design: every widget is a row with a checkbox and an
// up/down reorder control. Drag-and-drop ordering would be nicer but is
// out of scope for v1 — the up/down buttons cover the main use case
// (move the most-important KPIs to the top).
//
// Saves on "Lagre" by calling the supplied onSave with the new
// ReportModule[]. Cancel discards in-panel state.

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { ToggleSwitch } from '../../ui/FormToggles'
import type { ReportModule } from '../../../types/reportBuilder'

type Props = {
  open: boolean
  onClose: () => void
  layout: ReportModule[]
  onSave: (next: ReportModule[]) => Promise<boolean> | boolean
  onResetToDefault?: () => Promise<boolean> | boolean
}

export function DashboardEditLayoutPanel({
  open,
  onClose,
  layout,
  onSave,
  onResetToDefault,
}: Props) {
  // Local working copy. Reset whenever the panel reopens or the source
  // layout changes underneath. Keying the state on `open` would re-mount
  // and lose changes mid-edit, so we store both the source signature
  // and the editable copy.
  const [draft, setDraft] = useState<ReportModule[]>(layout)
  // Track presence of each widget id in the current layout via an
  // enabled flag — disabled widgets are kept in the order list but
  // stripped at save time.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(layout.map((m) => [m.id, true])),
  )
  const [lastSig, setLastSig] = useState<string>(() =>
    layout.map((m) => m.id).join('|'),
  )
  const [submitting, setSubmitting] = useState(false)

  const sig = layout.map((m) => m.id).join('|')
  if (sig !== lastSig) {
    setLastSig(sig)
    setDraft(layout)
    setEnabled(Object.fromEntries(layout.map((m) => [m.id, true])))
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= draft.length) return
    const copy = [...draft]
    const [picked] = copy.splice(idx, 1)
    if (!picked) return
    copy.splice(next, 0, picked)
    setDraft(copy)
  }

  const remove = (id: string) => {
    setDraft((d) => d.filter((m) => m.id !== id))
    setEnabled((e) => {
      const c = { ...e }
      delete c[id]
      return c
    })
  }

  const toggle = (id: string, value: boolean) => {
    setEnabled((e) => ({ ...e, [id]: value }))
  }

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const next = draft.filter((m) => enabled[m.id] !== false)
      const ok = await onSave(next)
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = async () => {
    if (!onResetToDefault) return
    if (!window.confirm('Tilbakestille til standardoppsettet? Endringene dine går tapt.')) return
    setSubmitting(true)
    try {
      const ok = await onResetToDefault()
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="dashboard-edit-layout"
      title="Rediger oppsett"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {onResetToDefault ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleReset()}
              disabled={submitting}
            >
              Tilbakestill
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? 'Lagrer …' : 'Lagre'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Slå widgets av/på, endre rekkefølge eller fjern fra oppsettet. Endringer
          lagres som standardoppsett for hele organisasjonen.
        </p>

        {draft.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Ingen widgets i oppsettet ennå. Lukk og bruk «Legg til widget» for å legge til.
          </p>
        ) : (
          <ul className="space-y-2">
            {draft.map((m, idx) => {
              const on = enabled[m.id] !== false
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-white p-3"
                >
                  <ToggleSwitch
                    checked={on}
                    onChange={(v) => toggle(m.id, v)}
                    label={`Vis ${m.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {m.title}
                    </p>
                    <p className="text-xs text-neutral-500">
                      <Badge variant="neutral">{m.kind}</Badge>{' '}
                      <span className="ml-1 font-mono">{m.datasetKey}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronUp className="h-4 w-4" />}
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Flytt opp"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronDown className="h-4 w-4" />}
                      onClick={() => move(idx, 1)}
                      disabled={idx === draft.length - 1}
                      aria-label="Flytt ned"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => remove(m.id)}
                      aria-label={`Fjern ${m.title}`}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SlidePanel>
  )
}
