import { useState } from 'react'

export type RecurrenceFreq = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  none: 'Ingen repetisjon',
  weekly: 'Ukentlig',
  biweekly: 'Annenhver uke',
  monthly: 'Månedlig (1. hver måned)',
  quarterly: 'Kvartalsvis (hvert kvartal)',
}

const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

type RecurrenceState = { freq: RecurrenceFreq; weekday: number; hour: number; minute: number }

function toCron(r: RecurrenceState): string {
  const mm = String(r.minute).padStart(2, '0')
  const hh = String(r.hour).padStart(2, '0')
  const wd = r.weekday + 1
  if (r.freq === 'weekly') return `${mm} ${hh} * * ${wd}`
  if (r.freq === 'biweekly') return `${mm} ${hh} 1,15 * ${wd}`
  if (r.freq === 'monthly') return `${mm} ${hh} 1 * *`
  if (r.freq === 'quarterly') return `${mm} ${hh} 1 */3 *`
  return ''
}

function parseCron(cron: string): RecurrenceState {
  const defaultState: RecurrenceState = { freq: 'none', weekday: 0, hour: 7, minute: 0 }
  if (!cron || !cron.trim()) return defaultState
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return { ...defaultState, freq: 'none' }
  const [mm, hh, dom, mon, wd] = parts
  const hour = parseInt(hh, 10)
  const minute = parseInt(mm, 10)
  const weekday = Math.max(0, (parseInt(wd, 10) || 1) - 1)
  if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
    if (dom === '1' && mon === '*/3') return { freq: 'quarterly', weekday, hour, minute }
    if (dom === '1' && mon === '*') return { freq: 'monthly', weekday, hour, minute }
    if (dom === '1,15') return { freq: 'biweekly', weekday, hour, minute }
    if (dom === '*') return { freq: 'weekly', weekday, hour, minute }
  }
  return defaultState
}

export function recurrenceLabel(cron: string): string {
  const r = parseCron(cron)
  if (r.freq === 'none') return 'Ingen repetisjon'
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
  const day = WEEKDAYS[r.weekday] ?? ''
  if (r.freq === 'weekly') return `Ukentlig — ${day} kl. ${time}`
  if (r.freq === 'biweekly') return `Annenhver uke — ${day} kl. ${time}`
  if (r.freq === 'monthly') return `Månedlig — 1. i måneden kl. ${time}`
  if (r.freq === 'quarterly') return `Kvartalsvis — 1. i kvartalet kl. ${time}`
  return cron
}

export function RecurrencePicker({ value, onChange }: { value: string; onChange: (cron: string) => void }) {
  const [state, setState] = useState<RecurrenceState>(() => parseCron(value))

  function update(next: RecurrenceState) {
    setState(next)
    onChange(next.freq === 'none' ? '' : toCron(next))
  }

  const needsDay = state.freq === 'weekly' || state.freq === 'biweekly'
  const preview = state.freq === 'none' ? '' : recurrenceLabel(toCron(state))

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-neutral-500">Frekvens</span>
          <select
            value={state.freq}
            onChange={(e) => update({ ...state, freq: e.target.value as RecurrenceFreq })}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
          >
            {(Object.keys(FREQ_LABELS) as RecurrenceFreq[]).map((f) => (
              <option key={f} value={f}>
                {FREQ_LABELS[f]}
              </option>
            ))}
          </select>
        </label>

        {needsDay && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Ukedag</span>
            <select
              value={state.weekday}
              onChange={(e) => update({ ...state, weekday: Number(e.target.value) })}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        {state.freq !== 'none' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Klokkeslett</span>
            <input
              type="time"
              value={`${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                update({ ...state, hour: h ?? 7, minute: m ?? 0 })
              }}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
            />
          </label>
        )}
      </div>
      {preview && (
        <p className="bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{preview}</p>
      )}
    </div>
  )
}

export function toDateTimeLocalValue(input: string | null): string {
  if (!input) return ''
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
