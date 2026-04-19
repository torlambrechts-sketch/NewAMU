export type RecurrenceFreq = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export const RECURRENCE_FREQ_LABELS: Record<RecurrenceFreq, string> = {
  none: 'Ingen repetisjon',
  weekly: 'Ukentlig',
  biweekly: 'Annenhver uke',
  monthly: 'Månedlig (1. hver måned)',
  quarterly: 'Kvartalsvis (hvert kvartal)',
}

const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

export type RecurrenceState = { freq: RecurrenceFreq; weekday: number; hour: number; minute: number }

/** Build a five-field cron string from picker state (`freq === 'none'` → empty string). */
export function buildRecurrenceCron(r: RecurrenceState): string {
  const mm = String(r.minute).padStart(2, '0')
  const hh = String(r.hour).padStart(2, '0')
  const wd = r.weekday + 1
  if (r.freq === 'weekly') return `${mm} ${hh} * * ${wd}`
  if (r.freq === 'biweekly') return `${mm} ${hh} 1,15 * ${wd}`
  if (r.freq === 'monthly') return `${mm} ${hh} 1 * *`
  if (r.freq === 'quarterly') return `${mm} ${hh} 1 */3 *`
  return ''
}

/** Parse a five-field cron string into picker state (invalid / empty → sensible defaults). */
export function parseRecurrenceCron(cron: string): RecurrenceState {
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
  const r = parseRecurrenceCron(cron)
  if (r.freq === 'none') return RECURRENCE_FREQ_LABELS.none
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
  const day = WEEKDAYS[r.weekday] ?? ''
  if (r.freq === 'weekly') return `Ukentlig — ${day} kl. ${time}`
  if (r.freq === 'biweekly') return `Annenhver uke — ${day} kl. ${time}`
  if (r.freq === 'monthly') return `Månedlig — 1. i måneden kl. ${time}`
  if (r.freq === 'quarterly') return `Kvartalsvis — 1. i kvartalet kl. ${time}`
  return cron
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
