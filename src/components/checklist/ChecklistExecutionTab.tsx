import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChecklistExecutionTabProps, ChecklistItem, ChecklistResponse } from './types'

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-700'
const INPUT_CLASS =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'

type ChecklistItemExecutionRowProps = {
  item: ChecklistItem
  position: number
  response: ChecklistResponse | undefined
  readOnly: boolean
  onSaveResponse: ChecklistExecutionTabProps['onSaveResponse']
}

function ChecklistItemExecutionRow({
  item,
  position,
  response,
  readOnly,
  onSaveResponse,
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

  useEffect(() => {
    setNotes(response?.notes ?? '')
  }, [response?.notes])

  useEffect(() => {
    if (hasExistingNotes) setShowNotes(true)
  }, [hasExistingNotes])

  useEffect(() => {
    if (!justSaved) return
    const timeoutId = window.setTimeout(() => setJustSaved(false), 1200)
    return () => window.clearTimeout(timeoutId)
  }, [justSaved])

  const save = useCallback(
    async (value: string, noteValue: string | null, isOptimisticWrite = false) => {
      setSaving(true)
      try {
        await onSaveResponse(item.key, value, noteValue)
        if (isOptimisticWrite) setOptimisticValue(null)
        setJustSaved(true)
      } catch {
        if (isOptimisticWrite) setOptimisticValue(null)
      } finally {
        setSaving(false)
      }
    },
    [onSaveResponse, item.key],
  )

  const saveNotes = useCallback(async () => {
    const existingNotes = response?.notes ?? ''
    if (notes === existingNotes) return
    await save(currentValue, notes.trim().length > 0 ? notes : null)
  }, [notes, response?.notes, currentValue, save])

  return (
    <div
      className={`border-b border-neutral-100 px-5 py-4 transition-shadow last:border-b-0 ${
        justSaved ? 'ring-1 ring-green-400' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-xs text-neutral-400">{position + 1}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{item.label}</span>
            {item.required && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Required</span>
            )}
            {item.lawRef && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{item.lawRef}</span>
            )}
            {saving && <span className="text-[10px] text-neutral-400">Saving…</span>}
          </div>

          {item.helpText && <p className="text-xs text-neutral-500">{item.helpText}</p>}

          {!readOnly && fieldType === 'yes_no_na' && (
            <div className="flex gap-1.5">
              {(['yes', 'no', 'na'] as const).map((v) => {
                const labels = { yes: 'Yes', no: 'No', na: 'N/A' }
                const activeClass =
                  v === 'yes'
                    ? 'bg-green-600 text-white border-green-600'
                    : v === 'no'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-neutral-500 text-white border-neutral-500'

                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      const nextValue = displayedValue === v ? '' : v
                      setOptimisticValue(nextValue)
                      void save(nextValue, notes.trim().length > 0 ? notes : null, true)
                    }}
                    className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                      displayedValue === v ? activeClass : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {labels[v]}
                  </button>
                )
              })}
            </div>
          )}

          {readOnly && fieldType === 'yes_no_na' && displayedValue && (
            <span className="inline-block rounded border border-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
              {displayedValue === 'yes' ? 'Yes' : displayedValue === 'no' ? 'No' : 'N/A'}
            </span>
          )}

          {fieldType === 'text' && (
            <textarea
              rows={2}
              value={displayedValue}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const nextValue = e.target.value
                setOptimisticValue(nextValue)
                void save(nextValue, notes.trim().length > 0 ? notes : null, true)
              }}
              placeholder="Enter response…"
              className={`${INPUT_CLASS} resize-none`}
            />
          )}

          {fieldType === 'number' && (
            <input
              type="number"
              value={displayedValue}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const nextValue = e.target.value
                setOptimisticValue(nextValue)
                void save(nextValue, notes.trim().length > 0 ? notes : null, true)
              }}
              className={INPUT_CLASS}
            />
          )}

          {(fieldType === 'photo' || fieldType === 'signature') && (
            <p className="text-xs text-neutral-400 italic">
              {fieldType === 'signature' ? 'Signature' : 'Photo'} capture is not available here.
            </p>
          )}

          {!readOnly && !showNotes && !hasExistingNotes && (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:underline"
            >
              + Add note
            </button>
          )}

          {!readOnly && (showNotes || hasExistingNotes) && (
            <div>
              <label className={FIELD_LABEL} htmlFor={`notes-${item.key}`}>Notes</label>
              <textarea
                id={`notes-${item.key}`}
                rows={1}
                value={notes}
                autoFocus={!hasExistingNotes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => void saveNotes()}
                placeholder="Optional note…"
                className={`${INPUT_CLASS} resize-none text-xs`}
              />
            </div>
          )}

          {readOnly && response?.notes && (
            <p className="text-xs text-neutral-500 italic">{response.notes}</p>
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
}: ChecklistExecutionTabProps) {
  const responseByKey = useMemo(() => {
    const map = new Map<string, ChecklistResponse>()
    for (const response of responses) map.set(response.key, response)
    return map
  }, [responses])

  const grouped = useMemo(() => {
    const groups = new Map<string, ChecklistCategoryGroup>()
    for (const item of items) {
      const categoryKey = item.category ?? '__default__'
      if (!groups.has(categoryKey)) {
        groups.set(categoryKey, {
          key: categoryKey,
          label: item.categoryLabel ?? (categoryKey === '__default__' ? 'General' : categoryKey),
          lawRef: item.categoryLawRef,
          items: [],
        })
      }
      const group = groups.get(categoryKey)!
      if (!group.lawRef && item.categoryLawRef) group.lawRef = item.categoryLawRef
      group.items.push(item)
    }
    return Array.from(groups.values())
  }, [items])

  const answered = useMemo(
    () => items.filter((item) => {
      const response = responseByKey.get(item.key)
      return response?.status === 'completed' || (response?.value ?? '').length > 0
    }).length,
    [items, responseByKey],
  )

  const total = items.length

  return (
    <div>
      {activationBanner}

      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">
            {answered} / {total} items completed
          </span>
          <span className="text-sm font-semibold text-[#1a3d32]">
            {total > 0 ? Math.round((answered / total) * 100) : 0}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-[#1a3d32] transition-all duration-300"
            style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.key}>
          <div className="sticky top-14 z-10 border-b border-neutral-200 bg-neutral-50 px-5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">{group.label}</span>
              {group.lawRef && (
                <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">{group.lawRef}</span>
              )}
            </div>
          </div>
          {group.items.map((item, idx) => (
            <ChecklistItemExecutionRow
              key={item.key}
              item={item}
              position={idx}
              response={responseByKey.get(item.key)}
              readOnly={readOnly}
              onSaveResponse={onSaveResponse}
            />
          ))}
        </div>
      ))}

      {items.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">
          No checklist items.
        </p>
      )}
    </div>
  )
}
