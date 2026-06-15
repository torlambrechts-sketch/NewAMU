/* Strategy v2 — pure derive helpers (the design's data.js/data2.js lookups &
   scoring, minus the in-memory data). Views compute identically on top of DB
   rows. Stage/health meta, month/quarter scaffolding, age + progress maths. */

import type { InitiativeHealth, InitiativeStage, StrategyInitiative } from '../../types/strategyTools'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const QUARTERS = [
  { id: 'q1', label: 'Q1', months: 'Jan – Mar', s: 0, e: 2 },
  { id: 'q2', label: 'Q2', months: 'Apr – Jun', s: 3, e: 5 },
  { id: 'q3', label: 'Q3', months: 'Jul – Sep', s: 6, e: 8 },
  { id: 'q4', label: 'Q4', months: 'Oct – Dec', s: 9, e: 11 },
]
export function quarterOf(month: number): number {
  return Math.min(3, Math.max(0, Math.floor(month / 3)))
}

export type StageMeta = { label: string; fg: string }
export const STAGE_META: Record<InitiativeStage, StageMeta> = {
  backlog: { label: 'Backlog', fg: '#737373' },
  planned: { label: 'Planned', fg: '#2f5d8a' },
  active: { label: 'Active', fg: '#2f7757' },
  review: { label: 'Review', fg: '#b8862f' },
  done: { label: 'Done', fg: '#525252' },
}
export const STAGE_ORDER: InitiativeStage[] = ['backlog', 'planned', 'active', 'review', 'done']

export type HealthMeta = { label: string; cls: 'success' | 'warn' | 'danger' | 'neutral' }
export const HEALTH_META: Record<InitiativeHealth, HealthMeta> = {
  on: { label: 'On track', cls: 'success' },
  risk: { label: 'At risk', cls: 'warn' },
  off: { label: 'Off track', cls: 'danger' },
  done: { label: 'Completed', cls: 'neutral' },
}
export const HEALTH_DOT: Record<InitiativeHealth, string> = {
  on: 'var(--ok)', risk: 'var(--warn)', off: 'var(--critical)', done: 'var(--n-400)',
}

export function ageLabel(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return days + 'd ago'
  if (days < 365) return Math.round(days / 30) + ' months ago'
  return Math.round(days / 365) + 'y ago'
}

/** KR/measure progress 0..1 from start→target→current (direction-aware via invert). */
export function krPct(from: number, to: number, now: number, invert = false): number {
  if (to === from) return now >= to ? 1 : 0
  const raw = (now - from) / (to - from)
  const p = invert ? 1 - raw : raw
  return Math.max(0, Math.min(1, invert ? raw : p < 0 ? 0 : p))
}

/** A coarse 0..10 initiative score from progress + health (for roll-ups). */
export function iniScore(i: Pick<StrategyInitiative, 'progress' | 'health'>): number {
  const base = i.progress / 10
  const penalty = i.health === 'off' ? 2.5 : i.health === 'risk' ? 1 : 0
  return Math.max(0, Math.min(10, Math.round((base - penalty) * 10) / 10))
}

export function scoreColor(score0to10: number): string {
  if (score0to10 >= 7) return '#2f7757'
  if (score0to10 >= 4) return '#b8862f'
  return '#b3382a'
}
