// FocusAreasGrid — viser aktive fokusområder som fargekodede kort
// (per akse) og lar admin opprette, redigere og arkivere dem i et
// kompakt modal. V1 maks 6 kort på rad; reverse-akronymisk render
// (nyere først) håndtert av useWellbeingStrategy ved sortering.

import { useState } from 'react'
import { Plus, Pencil, Archive, X } from 'lucide-react'
import {
  WELLBEING_AXIS_LABELS,
  type WellbeingAxisKey,
} from '../dashboards/useWorkerWellbeingDatasets'
import type { WellbeingFocusAreaRow } from '../hooks/useWellbeingStrategy'

const AXIS_CHIP_COLOR: Record<WellbeingAxisKey, string> = {
  trygghet: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  trivsel: 'bg-purple-100 text-purple-900 border-purple-300',
  medvirkning: 'bg-blue-100 text-blue-900 border-blue-300',
  mestring: 'bg-teal-100 text-teal-900 border-teal-300',
}

export type FocusAreasGridProps = {
  areas: WellbeingFocusAreaRow[]
  canManage: boolean
  onCreate: (input: {
    axis_key: WellbeingAxisKey
    title: string
    body_md?: string | null
    target_metric?: string | null
    sort_order?: number
  }) => Promise<WellbeingFocusAreaRow | null> | void
  onUpdate: (id: string, patch: Partial<WellbeingFocusAreaRow>) => Promise<void> | void
  onArchive: (id: string) => Promise<void> | void
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; area: WellbeingFocusAreaRow }
  | null

export function FocusAreasGrid({
  areas,
  canManage,
  onCreate,
  onUpdate,
  onArchive,
}: FocusAreasGridProps) {
  const [editor, setEditor] = useState<EditorState>(null)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Fokusområder</h2>
          <p className="text-xs text-neutral-600">Konkrete mål dere har valgt å jobbe mot dette året.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditor({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Nytt fokusområde
          </button>
        )}
      </div>

      {areas.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-center text-sm text-neutral-600">
          Ingen fokusområder ennå. Legg til 2–3 for året — for eksempel «redusere psykososial risiko i prosjektavdeling»
          eller «hev HMS-kompetanse for nye ledere».
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <li
              key={area.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${AXIS_CHIP_COLOR[area.axis_key]}`}
                >
                  {WELLBEING_AXIS_LABELS[area.axis_key]}
                </span>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Rediger"
                      onClick={() => setEditor({ mode: 'edit', area })}
                      className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Arkiver"
                      onClick={() => {
                        if (window.confirm(`Arkivere fokusområdet «${area.title}»?`)) {
                          void onArchive(area.id)
                        }
                      }}
                      className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-rose-700"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug text-neutral-900">{area.title}</h3>
              {area.body_md && (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-600">{area.body_md}</p>
              )}
              {area.target_metric && (
                <div className="mt-auto rounded-md bg-neutral-50 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700">
                  Mål: {area.target_metric}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <FocusAreaEditorModal
          initial={editor.mode === 'edit' ? editor.area : null}
          onClose={() => setEditor(null)}
          onSubmit={async (input) => {
            if (editor.mode === 'create') {
              await onCreate(input)
            } else {
              await onUpdate(editor.area.id, input)
            }
            setEditor(null)
          }}
        />
      )}
    </section>
  )
}

type FocusAreaInput = {
  axis_key: WellbeingAxisKey
  title: string
  body_md: string | null
  target_metric: string | null
  sort_order: number
}

function FocusAreaEditorModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: WellbeingFocusAreaRow | null
  onClose: () => void
  onSubmit: (input: FocusAreaInput) => Promise<void> | void
}) {
  const [axisKey, setAxisKey] = useState<WellbeingAxisKey>(initial?.axis_key ?? 'trivsel')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body_md ?? '')
  const [metric, setMetric] = useState(initial?.target_metric ?? '')
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 0)
  const [saving, setSaving] = useState(false)

  const canSubmit = title.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      await onSubmit({
        axis_key: axisKey,
        title: title.trim(),
        body_md: body.trim() ? body.trim() : null,
        target_metric: metric.trim() ? metric.trim() : null,
        sort_order: sortOrder,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            {initial ? 'Rediger fokusområde' : 'Nytt fokusområde'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-700">Akse</span>
            <select
              value={axisKey}
              onChange={(e) => setAxisKey(e.target.value as WellbeingAxisKey)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              {(Object.keys(WELLBEING_AXIS_LABELS) as WellbeingAxisKey[]).map((k) => (
                <option key={k} value={k}>
                  {WELLBEING_AXIS_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-700">Tittel</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Redusere psykososial risiko i prosjektavd."
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-700">Beskrivelse</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Hva trenger dere å oppnå? Hvilke verktøy skal brukes?"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-700">Måltall</span>
            <input
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="F.eks. 80% svarprosent på QPS Nordic"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block w-32">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-700">Sortering</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  )
}
