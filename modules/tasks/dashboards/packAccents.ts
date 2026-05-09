// Per-pack accent colours for task dashboards.
//
// Kanban amber is the existing tasks scope accent for AML.
// ISO blue separates the two frameworks visually — same logic as
// compliance/dashboards/packAccents.ts.

import type { TaskPack } from '../../../src/types/task'

export const TASK_PACK_ACCENTS: Record<TaskPack, string> = {
  'aml-amu': '#c2410c',   // kanban amber — existing tasks scope accent
  'iso-45001': '#0369a1', // ISO blue
}

export function taskPackAccentFor(slug: TaskPack | string | null | undefined): string | null {
  if (!slug) return null
  return TASK_PACK_ACCENTS[slug as TaskPack] ?? null
}
