import { WORKPLACE_LIST_LAYOUT_CTA } from './WorkplaceStandardListLayout'

/** Samme grønn CTA som Oppgaver / WorkplaceListToolbar */
export const WORKPLACE_TASKS_ACTION_CTA = WORKPLACE_LIST_LAYOUT_CTA

/** Tailwind-klasser som matcher primærknappen på Tasks (WorkplaceListToolbar) */
export const WORKPLACE_TASKS_PRIMARY_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm'

export function workplaceTasksPrimaryButtonStyle(): { backgroundColor: string } {
  return { backgroundColor: WORKPLACE_TASKS_ACTION_CTA }
}
