// StatusChip — RAG (red/amber/green) status indicator used by both the
// Endringslogg timeline and any downstream surface that needs the same
// semantic-coloured chip. The chip carries a dot glyph in addition to
// colour, so colour is never the sole signal (a11y bar in spec §9).

import type { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export type StatusChipStatus =
  | 'open'              // Åpen
  | 'in_progress'       // I arbeid
  | 'overdue'           // Forfalt
  | 'closed'            // Lukket
  | 'rejected'          // Avvist
  | 'approved'          // Godkjent
  | 'unknown'           // Fallback

const TONE: Record<StatusChipStatus, { dot: string; chip: string; label: string }> = {
  open: { dot: 'bg-green-500', chip: 'bg-green-50 text-green-800 border-green-200', label: 'Åpen' },
  in_progress: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    label: 'I arbeid',
  },
  overdue: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200', label: 'Forfalt' },
  closed: { dot: 'bg-neutral-400', chip: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: 'Lukket' },
  rejected: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200', label: 'Avvist' },
  approved: { dot: 'bg-green-500', chip: 'bg-green-50 text-green-800 border-green-200', label: 'Godkjent' },
  unknown: { dot: 'bg-neutral-300', chip: 'bg-neutral-50 text-neutral-700 border-neutral-200', label: '' },
}

// Map free-form Norwegian status text → StatusChipStatus. Used by the
// semantic value renderer when a diff value carries semantic='status'.
export function statusFromLabel(label: string): StatusChipStatus {
  const t = label.trim().toLowerCase()
  if (!t) return 'unknown'
  if (t === 'åpen' || t === 'apen' || t === 'open') return 'open'
  if (t === 'i arbeid' || t === 'pågår' || t === 'pagar' || t === 'in_progress') return 'in_progress'
  if (t === 'forfalt' || t === 'overdue') return 'overdue'
  if (t === 'lukket' || t === 'closed') return 'closed'
  if (t === 'avvist' || t === 'rejected') return 'rejected'
  if (t === 'godkjent' || t === 'approved') return 'approved'
  return 'unknown'
}

export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  status: StatusChipStatus
  /** Override the default Norwegian label. */
  label?: string
}

export function StatusChip({ status, label, className, ...props }: StatusChipProps) {
  const tone = TONE[status]
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone.chip,
        className,
      )}
      {...props}
    >
      <span className={twMerge('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
      <span>{label ?? tone.label}</span>
    </span>
  )
}
