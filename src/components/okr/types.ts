/**
 * Shared types + design tokens for the editable OKR dashboard.
 *
 * Lives in its own file so both the read-side renderer (`OKRDashboard.tsx`)
 * and the CRUD dialogs (`OKREditDialogs.tsx`) can import them without a
 * circular dependency.
 */

export type Confidence = 'on_track' | 'at_risk' | 'off_track'

export type OKROwner = {
  name: string
  /** Two-letter initials override; auto-derived from `name` if omitted. */
  initials?: string
  /** Optional avatar image URL. */
  avatarUrl?: string
}

export type KeyResult = {
  id: string
  title: string
  /** 0–100 */
  progress: number
  confidence: Confidence
  /** Optional human-readable target ("Q2 NPS ≥ 60"). */
  target?: string
  /** Optional current value ("54"). */
  current?: string
  /** How progress is maintained. 'task_rollup' = derived from linked tasks;
   *  the progress/current fields are then read-only in the editor. */
  progressMode?: 'manual' | 'task_rollup'
  /** Narrative shown under the bar in rollup mode ("3 av 5 oppgaver fullført"). */
  progressNote?: string
  /** When true, the rollup option is unavailable (e.g. invert KRs). */
  rollupDisabled?: boolean
  /** Check-in confidence history (0..1), oldest→newest, for the sparkline. */
  checkinSpark?: number[]
  /** Staleness hint ("Sist innsjekket for 24 dager siden") — shown muted. */
  checkinHint?: string
}

export type Objective = {
  id: string
  title: string
  description?: string
  owner: OKROwner
  keyResults: KeyResult[]
}

/** Tailwind class for the saturated fill colour per confidence tier. */
export const CONFIDENCE_BG: Record<Confidence, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-rose-500',
}

/** Soft ring colour matching each confidence tier. */
export const CONFIDENCE_RING: Record<Confidence, string> = {
  on_track: 'ring-emerald-200',
  at_risk: 'ring-amber-200',
  off_track: 'ring-rose-200',
}

/** Norwegian label for each confidence tier. */
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  on_track: 'På sporet',
  at_risk: 'Risiko',
  off_track: 'Bak skjema',
}
