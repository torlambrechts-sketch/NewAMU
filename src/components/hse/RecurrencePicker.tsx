import { useEffect, useState } from 'react'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_INPUT } from '../layout/WorkplaceStandardFormPanel'
import {
  buildRecurrenceCron,
  parseRecurrenceCron,
  RECURRENCE_FREQ_LABELS,
  type RecurrenceFreq,
  type RecurrenceState,
  recurrenceLabel,
} from './recurrenceCron'

export function RecurrencePicker({
  value,
  onChange,
  inputClassName = WPSTD_FORM_INPUT,
  hideFrequencySelect = false,
}: {
  value: string
  onChange: (cron: string) => void
  /** Applied to every native select and the time input (inspection module standard). */
  inputClassName?: string
  /** When true, only weekday / time controls are rendered (frekvens is edited elsewhere). */
  hideFrequencySelect?: boolean
}) {
  const [state, setState] = useState<RecurrenceState>(() => parseRecurrenceCron(value))

  useEffect(() => {
    setState(parseRecurrenceCron(value))
  }, [value])

  function update(next: RecurrenceState) {
    setState(next)
    onChange(next.freq === 'none' ? '' : buildRecurrenceCron(next))
  }

  const needsDay = state.freq === 'weekly' || state.freq === 'biweekly'
  const preview = state.freq === 'none' ? '' : recurrenceLabel(buildRecurrenceCron(state))

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {!hideFrequencySelect && (
          <label className="flex flex-col gap-1">
            <span className={WPSTD_FORM_FIELD_LABEL}>Frekvens</span>
            <select
              value={state.freq}
              onChange={(e) => update({ ...state, freq: e.target.value as RecurrenceFreq })}
              className={inputClassName}
            >
              {(Object.keys(RECURRENCE_FREQ_LABELS) as RecurrenceFreq[]).map((f) => (
                <option key={f} value={f}>
                  {RECURRENCE_FREQ_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
        )}

        {needsDay && (
          <label className="flex flex-col gap-1">
            <span className={WPSTD_FORM_FIELD_LABEL}>Ukedag</span>
            <select
              value={state.weekday}
              onChange={(e) => update({ ...state, weekday: Number(e.target.value) })}
              className={inputClassName}
            >
              {['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'].map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        {state.freq !== 'none' && (
          <label className="flex flex-col gap-1">
            <span className={WPSTD_FORM_FIELD_LABEL}>Klokkeslett</span>
            <input
              type="time"
              value={`${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                update({ ...state, hour: h ?? 7, minute: m ?? 0 })
              }}
              className={inputClassName}
            />
          </label>
        )}
      </div>
      {preview && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{preview}</p>
      )}
    </div>
  )
}
