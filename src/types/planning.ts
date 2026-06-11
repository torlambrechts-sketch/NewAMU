// planning.ts — canonical type definitions for the Planning module.
//
// Covers OKR-laget (Ambisjon → Objectives → Key Results), RACI-matrise,
// og task-OKR-linker. Mirrors the okr_* tables in
// 20261025120000_planning_okr_and_recurring_tasks.sql.

import type { TaskPack } from './task'

export type OkrHealth = 'on_track' | 'at_risk' | 'off_track'
export type OkrPlanStatus = 'draft' | 'active' | 'archived'

/** OKR-plan (Ambisjon) — top-level container for objectives. */
export type OkrPlan = {
  id: string
  organizationId: string
  title: string
  description: string
  legalBasis?: string
  horizon?: string
  sponsorUserId?: string
  sponsorName?: string
  facilitatorUserId?: string
  facilitatorName?: string
  status: OkrPlanStatus
  pack: TaskPack
  /** Parent in the alignment tree (company → team). Undefined = root plan. */
  parentPlanId?: string
  activatedAt?: string
  archivedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** Objective — mål (typisk 3-5 per plan). */
export type OkrObjective = {
  id: string
  organizationId: string
  planId: string
  ordLabel: string
  position: number
  objective: string
  why: string
  lawRef?: string
  ownerUserId?: string
  ownerName?: string
  health: OkrHealth
  progress: number
  /** Objective in the PARENT plan this one supports («støtter: O2 …»). */
  supportsObjectiveId?: string
  createdAt: string
  updatedAt: string
}

/** Key result — målbart utfall under et objective. */
export type OkrKeyResult = {
  id: string
  organizationId: string
  objectiveId: string
  position: number
  kr: string
  unit: string
  target: number
  currentValue: number
  confidence: number
  invert: boolean
  /** manual = current_value edited by hand; task_rollup = derived from the
   *  share of linked tasks that are closed (see okr_kr_recompute_rollup). */
  progressMode: 'manual' | 'task_rollup'
  ownerUserId?: string
  ownerName?: string
  createdAt: string
  updatedAt: string
}

/** RACI — rolle-tildeling per plan. */
export type OkrRaciEntry = {
  id: string
  organizationId: string
  planId: string
  position: number
  roleLabel: string
  personLabel?: string
  isResponsible: boolean
  isAccountable: boolean
  isConsulted: boolean
  isInformed: boolean
  createdAt: string
  updatedAt: string
}

/** Link mellom KR og task_item. */
export type OkrTaskLink = {
  id: string
  organizationId: string
  keyResultId: string
  taskItemId: string
  createdBy?: string
  createdAt: string
}

// ── Composed types for UI ────────────────────────────────────────────────

export type OkrObjectiveWithKrs = OkrObjective & {
  keyResults: OkrKeyResult[]
}

export type OkrPlanFull = OkrPlan & {
  objectives: OkrObjectiveWithKrs[]
  raci: OkrRaciEntry[]
}

// ── Recurring task helpers ───────────────────────────────────────────────

/** UI-facing label for recurrence intervals (in days). */
export type RecurrencePresetId = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'custom'

export const RECURRENCE_PRESETS: Array<{ id: RecurrencePresetId; label: string; days: number | null }> = [
  { id: 'weekly', label: 'Ukentlig', days: 7 },
  { id: 'biweekly', label: 'Annenhver uke', days: 14 },
  { id: 'monthly', label: 'Månedlig', days: 30 },
  { id: 'quarterly', label: 'Kvartalsvis', days: 90 },
  { id: 'biannual', label: 'Halvårlig', days: 182 },
  { id: 'annual', label: 'Årlig', days: 365 },
  { id: 'custom', label: 'Tilpasset', days: null },
]

export function presetForDays(days: number | null | undefined): RecurrencePresetId {
  if (days == null) return 'custom'
  const exact = RECURRENCE_PRESETS.find((p) => p.days === days)
  return exact?.id ?? 'custom'
}
