import type { SafetyRound } from '../types/hse'

/** Dato brukt i kalender (planlagt eller gjennomført). */
export function safetyRoundCalendarDateIso(r: SafetyRound): string {
  if (r.scheduleKind === 'planned' && r.plannedAt?.trim()) {
    return r.plannedAt.slice(0, 10)
  }
  return r.conductedAt.slice(0, 10)
}

export function safetyRoundCalendarTimeLabel(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function isSafetyRoundUpcoming(r: SafetyRound, now = new Date()): boolean {
  const iso = r.scheduleKind === 'planned' && r.plannedAt ? r.plannedAt : r.conductedAt
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= now.getTime()
}

export function isSafetyRoundPastOrTodayConducted(r: SafetyRound, now = new Date()): boolean {
  if (r.scheduleKind === 'planned') return false
  const t = new Date(r.conductedAt).getTime()
  if (Number.isNaN(t)) return false
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return t < startOfToday
}
