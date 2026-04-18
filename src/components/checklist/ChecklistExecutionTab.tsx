import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChecklistExecutionTabProps, ChecklistItem, ChecklistResponse } from './types'

const INPUT_CLASS =
  'mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'

type ChecklistItemExecutionRowProps = {
  item: ChecklistItem
  position: number
  response: ChecklistResponse | undefined
  readOnly: boolean
  onSaveResponse: ChecklistExecutionTabProps['onSaveResponse']
  onReportIssue?: (itemKey: string, itemLabel: string) => void
}

function ChecklistItemExecutionRow({
  item,
  position,
  response,
  readOnly,
  onSaveResponse,
  onReportIssue,
}: ChecklistItemExecutionRowProps) {
  const fieldType = item.fieldType ?? 'yes_no_na'
  const currentValue = response?.value ?? ''
  const hasExistingNotes = (response?.notes ?? '').trim().length > 0

  const [optimisticValue, setOptimisticValue] = useState<string | null>(null)
  const [notes, setNotes] = useState(response?.notes ?? '')
  const [showNotes, setShowNotes] = useState(hasExistingNotes)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const displayedValue = optimisticValue ?? currentValue
  const isAnswered = displayedValue.length > 0

  useEffect(() => { setNotes(response?.notes ?? '') }, [response?.notes])
  useEffect(() => { if (hasExistingNotes) setShowNotes(true) }, [hasExistingNotes])
  useEffect(() => {
    if (!justSaved) return
    const id = window.setTimeout(() => setJustSaved(false), 1200)
    return () => window.clearTimeout(id)
  }, [justSaved])

  const save = useCallback(
    async (value: string, noteValue: string | null, isOptimistic = false) => {
      setSaving(true)
      try {
        await onSaveResponse(item.key, value, noteValue)
        if (isOptimistic) setOptimisticValue(null)
        setJustSaved(true)
      } catch {
        if (isOptimistic) setOptimisticValue(null)
      } finally {
        setSaving(false)
      }
    },
    [onSaveResponse, item.key],
  )

  const saveNotes = useCallback(async () => {
    if (notes === (response?.notes ?? '')) return
    await save(currentValue, notes.trim().length > 0 ? notes : null)
  }, [notes, response?.notes, currentValue, save])

  // Left border colour — answered=green, unanswered+required=amber, unanswered optional=transparent
  const borderAccent = isAnswered
    ? displayedValue === 'no'
      ? 'border-l-red-400'
      : 'border-l-green-400'
    : item.required
      ? 'border-l-amber-300'
      : 'border-l-transparent'

  return (
    <div
      className={`border-b border-neutral-100 border-l-4 bg-white px-4 py-3.5 transition-colors last:border-b-0 md:px-5 ${borderAccent} ${
        justSaved ? 'bg-green-50/40' : ''
      }`}
    >
      {/* Horizontal split on md+: info left, answer right */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">

        {/* ── LEFT: number + label + meta + help ── */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="shrink-0 text-sm font-bold text-neutral-400">{position + 1}.</span>
            <span className="text-base font-semibold text-neutral-900 leading-snug">{item.label}</span>
            {item.required && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                Påkrevd
              </span>
            )}
            {item.lawRef && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                {item.lawRef}
              </span>
            )}
          </div>
          {item.helpText && (
            <p className="mt-1 text-sm text-neutral-500 leading-relaxed">{item.helpText}</p>
          )}
        </div>

        {/* ── RIGHT: answer controls ── */}
        <div className="shrink-0 md:w-64">
          {/* Yes / No / N/A */}
          {!readOnly && fieldType === 'yes_no_na' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(['yes', 'no', 'na'] as const).map((v) => {
                  const labels = { yes: 'Ja', no: 'Nei', na: 'N/A' }
                  const activeClass =
                    v === 'yes'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : v === 'no'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-neutral-600 text-white border-neutral-600 shadow-sm'
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        const next = displayedValue === v ? '' : v
                        setOptimisticValue(next)
                        void save(next, notes.trim().length > 0 ? notes : null, true)
                      }}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${
                        displayedValue === v
                          ? activeClass
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-400 hover:bg-white'
                      }`}
                    >
                      {labels[v]}
                    </button>
                  )
                })}
              </div>

              {/* Avvik button — appears below answer row when Nei */}
              {displayedValue === 'no' && onReportIssue && (
                <button
                  type="button"
                  onClick={() => onReportIssue(item.key, item.label)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  ⚠ Registrer avvik
                </button>
              )}

              {/* Notes */}
              {!showNotes && !hasExistingNotes ? (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
                >
                  + Legg til merknad
                </button>
              ) : (
                <textarea
                  rows={1}
                  value={notes}
                  autoFocus={!hasExistingNotes && showNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void saveNotes()}
                  placeholder="Merknad…"
                  className={`${INPUT_CLASS} resize-none text-xs`}
                />
              )}

              {saving && (
                <span className="block text-right text-[10px] text-neutral-400">Lagrer…</span>
              )}
            </div>
          )}

          {/* Read-only yes/no/na */}
          {readOnly && fieldType === 'yes_no_na' && (
            <div className="space-y-1">
              {displayedValue ? (
                <span
                  className={`inline-block rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    displayedValue === 'yes'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : displayedValue === 'no'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                  }`}
                >
                  {displayedValue === 'yes' ? 'Ja' : displayedValue === 'no' ? 'Nei' : 'N/A'}
                </span>
              ) : (
                <span className="text-xs text-neutral-400 italic">Ikke besvart</span>
              )}
              {response?.notes && (
                <p className="text-xs text-neutral-500 italic mt-1">{response.notes}</p>
              )}
            </div>
          )}

          {/* Text field */}
          {fieldType === 'text' && (
            <textarea
              rows={2}
              value={displayedValue}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const next = e.target.value
                setOptimisticValue(next)
                void save(next, notes.trim().length > 0 ? notes : null, true)
              }}
              placeholder="Skriv svar…"
              className={`${INPUT_CLASS} resize-none`}
            />
          )}

          {/* Number field */}
          {fieldType === 'number' && (
            <input
              type="number"
              value={displayedValue}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const next = e.target.value
                setOptimisticValue(next)
                void save(next, notes.trim().length > 0 ? notes : null, true)
              }}
              className={INPUT_CLASS}
            />
          )}

          {(fieldType === 'photo' || fieldType === 'signature') && (
            <p className="text-xs text-neutral-400 italic">
              {fieldType === 'signature' ? 'Signatur' : 'Foto'} registreres ikke her.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

type ChecklistCategoryGroup = {
  key: string
  label: string
  lawRef?: string
  items: ChecklistItem[]
}

export function ChecklistExecutionTab({
  items,
  responses,
  readOnly = false,
  onSaveResponse,
  activationBanner,
  onReportIssue,
}: ChecklistExecutionTabProps) {
  const responseByKey = useMemo(() => {
    const map = new Map<string, ChecklistResponse>()
    for (const r of responses) map.set(r.key, r)
    return map
  }, [responses])

  const grouped = useMemo(() => {
    const groups = new Map<string, ChecklistCategoryGroup>()
    for (const item of items) {
      const key = item.category ?? '__default__'
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: item.categoryLabel ?? (key === '__default__' ? 'Generelt' : key),
          lawRef: item.categoryLawRef,
          items: [],
        })
      }
      const g = groups.get(key)!
      if (!g.lawRef && item.categoryLawRef) g.lawRef = item.categoryLawRef
      g.items.push(item)
    }
    return Array.from(groups.values())
  }, [items])

  const answered = useMemo(
    () =>
      items.filter((item) => {
        const r = responseByKey.get(item.key)
        return r?.status === 'completed' || (r?.value ?? '').length > 0
      }).length,
    [items, responseByKey],
  )

  const total = items.length
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0

  return (
    <div className="bg-neutral-50/60 min-h-full">
      {activationBanner}

      {/* ── Progress header ── */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-base font-semibold text-neutral-900">{answered}</span>
            <span className="text-sm text-neutral-500"> / {total} besvart</span>
          </div>
          <span
            className={`text-lg font-bold tabular-nums ${
              pct === 100 ? 'text-green-600' : pct > 50 ? 'text-[#1a3d32]' : 'text-neutral-500'
            }`}
          >
            {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct === 100 ? 'bg-green-500' : 'bg-[#1a3d32]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Category groups ── */}
      {grouped.map((group) => {
        const groupAnswered = group.items.filter((item) => {
          const r = responseByKey.get(item.key)
          return (r?.value ?? '').length > 0
        }).length

        return (
          <div key={group.key} className="mb-3">
            {/* Category header */}
            <div className="sticky top-[72px] z-10 flex items-center justify-between border-y border-neutral-200 bg-[#f0ede8] px-5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#1a3d32]">
                  {group.label}
                </span>
                {group.lawRef && (
                  <span className="rounded bg-[#1a3d32]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1a3d32]">
                    {group.lawRef}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-neutral-500">
                {groupAnswered}/{group.items.length}
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-b border-x border-b border-neutral-200 bg-white mx-0">
              {group.items.map((item, idx) => (
                <ChecklistItemExecutionRow
                  key={item.key}
                  item={item}
                  position={idx}
                  response={responseByKey.get(item.key)}
                  readOnly={readOnly}
                  onSaveResponse={onSaveResponse}
                  onReportIssue={onReportIssue}
                />
              ))}
            </div>
          </div>
        )
      })}

      {items.length === 0 && (
        <p className="px-5 py-16 text-center text-sm text-neutral-400">
          Ingen sjekklistepunkter.
        </p>
      )}
    </div>
  )
}
