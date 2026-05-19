// Action chip variants — spec §3. Each AuditAction has a fixed Norwegian
// label and colour. Label never wraps; on narrow viewports the row
// container handles the icon-only fallback.

import { useTranslation } from 'react-i18next'
import { twMerge } from 'tailwind-merge'
import type { AuditAction } from '../../lib/audit/diffShape'

type Tone = { bg: string; text: string }

const TONE: Record<AuditAction, Tone> = {
  opprettet: { bg: 'bg-green-100', text: 'text-green-800' },
  endret: { bg: 'bg-amber-100', text: 'text-amber-900' },
  lukket: { bg: 'bg-green-100', text: 'text-green-800' },
  gjenapnet: { bg: 'bg-red-100', text: 'text-red-800' },
  tildelt: { bg: 'bg-blue-100', text: 'text-blue-800' },
  omfordelt: { bg: 'bg-amber-100', text: 'text-amber-900' },
  kommentert: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
  signert: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  attestert: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  godkjent: { bg: 'bg-green-100', text: 'text-green-800' },
  avvist: { bg: 'bg-red-100', text: 'text-red-800' },
  lastet_opp_vedlegg: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
  slettet_vedlegg: { bg: 'bg-red-100', text: 'text-red-800' },
  versjon_bumpet: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  eskalert: { bg: 'bg-red-100', text: 'text-red-800' },
  eksportert: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
  delt: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
  arkivert: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
}

// Spec rail-dot colour categories (§2). Separate from chip palette so a
// category can stretch across multiple actions (close + approve both green).
const RAIL_TONE: Record<AuditAction, 'green' | 'amber' | 'red' | 'grey' | 'blue' | 'indigo' | 'cyan'> = {
  opprettet: 'green',
  endret: 'amber',
  lukket: 'green',
  gjenapnet: 'red',
  tildelt: 'blue',
  omfordelt: 'amber',
  kommentert: 'grey',
  signert: 'indigo',
  attestert: 'indigo',
  godkjent: 'green',
  avvist: 'red',
  lastet_opp_vedlegg: 'grey',
  slettet_vedlegg: 'red',
  versjon_bumpet: 'cyan',
  eskalert: 'red',
  eksportert: 'grey',
  delt: 'grey',
  arkivert: 'grey',
}

type RailTone = (typeof RAIL_TONE)[keyof typeof RAIL_TONE]

const RAIL_BG: Record<RailTone, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  grey: 'bg-neutral-400',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
}

export function railDotClass(action: AuditAction): string {
  return RAIL_BG[RAIL_TONE[action]]
}

export type EntityTimelineActionChipProps = {
  action: AuditAction
  className?: string
}

export function EntityTimelineActionChip({ action, className }: EntityTimelineActionChipProps) {
  const { t } = useTranslation()
  const tone = TONE[action]
  const label = t(`endringslogg.chips.${action}`, action.toUpperCase().replace(/_/g, ' '))
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap',
        tone.bg,
        tone.text,
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  )
}
