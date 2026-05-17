// DashboardEditLayoutPanel — slide-panel UX for arranging widgets in
// a dashboard layout. Three interactions:
//
//   1. Drag a row by its grip handle to reorder (desktop). Native HTML5
//      drag-and-drop (no library).
//   2. Up/down arrow buttons reorder one slot at a time — the touch
//      equivalent (HTML5 DnD doesn't fire on touch devices).
//   3. Click the toggle to enable/disable a widget; disabled widgets
//      are kept in the order list but stripped at save time.
//
// Saves on "Lagre" by calling onSave with the new ReportModule[].

import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
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
  const [draft, setDraft] = useState<ReportModule[]>(layout)
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

  // Drag state: index of the row being dragged + index it's hovering
  // over. Drop reorders; cancel resets.
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const reorder = (from: number, to: number) => {
    if (from === to) return
    const copy = [...draft]
    const [picked] = copy.splice(from, 1)
    if (!picked) return
    copy.splice(to, 0, picked)
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
          ) : (
            <span />
          )}
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
          Dra widgetene for å endre rekkefølge — eller bruk pilene på små skjermer.
          Slå av/på, eller fjern fra oppsettet. Endringer lagres som standardoppsett
          for hele organisasjonen.
        </p>

        {draft.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Ingen widgets i oppsettet. Lukk og bruk «Legg til widget».
          </p>
        ) : (
          <ul className="space-y-2">
            {draft.map((m, idx) => {
              const on = enabled[m.id] !== false
              const isOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
              return (
                <li
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(idx)
                    e.dataTransfer.effectAllowed = 'move'
                    // Required for Firefox to actually start the drag.
                    e.dataTransfer.setData('text/plain', m.id)
                  }}
                  onDragOver={(e) => {
                    if (dragIdx === null) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverIdx !== idx) setDragOverIdx(idx)
                  }}
                  onDragLeave={() => {
                    if (dragOverIdx === idx) setDragOverIdx(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIdx !== null) reorder(dragIdx, idx)
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  onDragEnd={() => {
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  className={`flex items-center gap-3 rounded-lg border bg-white p-3 transition-colors ${
                    isOver
                      ? 'border-[#1a3d32] ring-2 ring-[#1a3d32]/20'
                      : dragIdx === idx
                      ? 'border-neutral-300 opacity-60'
                      : 'border-neutral-200/80'
                  }`}
                >
                  <span
                    className="hidden cursor-grab text-neutral-400 hover:text-neutral-700 active:cursor-grabbing sm:inline-flex"
                    aria-hidden
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <div className="flex shrink-0 flex-col gap-0.5 sm:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reorder(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label={`Flytt ${m.title} opp`}
                      className="h-6 w-6 rounded-sm p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reorder(idx, idx + 1)}
                      disabled={idx === draft.length - 1}
                      aria-label={`Flytt ${m.title} ned`}
                      className="h-6 w-6 rounded-sm p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <ToggleSwitch
                    checked={on}
                    onChange={(v) => toggle(m.id, v)}
                    label={`Vis ${m.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{m.title}</p>
                    <p className="text-xs text-neutral-500">
                      <Badge variant="neutral">{m.kind}</Badge>{' '}
                      <span className="ml-1 font-mono">{m.datasetKey}</span>
                      {m.colSpan ? <span className="ml-2">· {m.colSpan}</span> : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => remove(m.id)}
                    aria-label={`Fjern ${m.title}`}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SlidePanel>
  )
}
