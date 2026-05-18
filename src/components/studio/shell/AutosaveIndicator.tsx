// AutosaveIndicator — small inline chip showing the autosave state.
//
// Spec §4: "AutosaveIndicator". Phase 2a UI plumbing.
// Reads { state, lastSavedAt } from useStudioAutosave.

import { Check, Loader2, AlertCircle, Clock } from 'lucide-react'
import type { AutosaveState } from '../../../hooks/useStudioAutosave'

export type AutosaveIndicatorProps = {
  state: AutosaveState
  lastSavedAt: Date | null
}

function formatRelative(d: Date): string {
  const secs = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (secs < 60) return `${secs} s siden`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min siden`
  const hours = Math.round(mins / 60)
  return `${hours} t siden`
}

export function AutosaveIndicator({ state, lastSavedAt }: AutosaveIndicatorProps) {
  if (state === 'idle' && !lastSavedAt) return null

  let icon = <Clock className="h-3 w-3" aria-hidden />
  let label = 'Ingen lokale endringer'
  let tone = 'text-neutral-500'
  if (state === 'pending') {
    icon = <Clock className="h-3 w-3" aria-hidden />
    label = 'Lagrer snart…'
    tone = 'text-neutral-500'
  } else if (state === 'saving') {
    icon = <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
    label = 'Lagrer utkast…'
    tone = 'text-neutral-700'
  } else if (state === 'saved') {
    icon = <Check className="h-3 w-3" aria-hidden />
    label = lastSavedAt ? `Lagret ${formatRelative(lastSavedAt)}` : 'Lagret'
    tone = 'text-emerald-700'
  } else if (state === 'error') {
    icon = <AlertCircle className="h-3 w-3" aria-hidden />
    label = 'Kunne ikke lagre — prøver igjen ved neste endring'
    tone = 'text-red-700'
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${tone}`}
      role="status"
      aria-live="polite"
    >
      {icon}
      {label}
    </span>
  )
}
