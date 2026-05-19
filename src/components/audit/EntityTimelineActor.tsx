// 28×28 square avatar (spec §2 — squares disambiguate from user avatars
// elsewhere in the product). Background tinted per role swatch; system
// + ekstern carry an inline glyph.

import { Cog, Link as LinkIcon } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { AuditActor, AuditActorRole } from '../../lib/audit/diffShape'

type Swatch = { bg: string; text: string }

const ROLE_SWATCH: Record<AuditActorRole, Swatch> = {
  verneombud: { bg: 'bg-amber-100', text: 'text-amber-900' },
  amu_medlem: { bg: 'bg-blue-100', text: 'text-blue-900' },
  leder: { bg: 'bg-indigo-100', text: 'text-indigo-900' },
  hms_radgiver: { bg: 'bg-green-100', text: 'text-green-900' },
  ansatt: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
  system: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
  ekstern: { bg: 'bg-red-100', text: 'text-red-900' },
}

const ROLE_LABEL: Record<AuditActorRole, string> = {
  verneombud: 'Verneombud',
  amu_medlem: 'AMU-medlem',
  leder: 'Leder',
  hms_radgiver: 'HMS-rådgiver',
  ansatt: 'Ansatt',
  system: 'System',
  ekstern: 'Ekstern',
}

export type EntityTimelineActorProps = {
  actor: AuditActor
  size?: 'sm' | 'md'
  className?: string
}

export function EntityTimelineActor({ actor, size = 'md', className }: EntityTimelineActorProps) {
  const swatch = ROLE_SWATCH[actor.role]
  const dim = size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs'
  const glyph = actor.role === 'system' ? <Cog className="h-3 w-3" aria-hidden /> : actor.role === 'ekstern' ? <LinkIcon className="h-3 w-3" aria-hidden /> : null

  return (
    <span
      className={twMerge(
        'relative inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
        swatch.bg,
        swatch.text,
        dim,
        className,
      )}
      role="img"
      aria-label={`${ROLE_LABEL[actor.role]}: ${actor.name}`}
      title={`${ROLE_LABEL[actor.role]}: ${actor.name}${actor.external_label ? ` — ${actor.external_label}` : ''}`}
    >
      {actor.initials}
      {glyph ? (
        <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-neutral-600 ring-1 ring-neutral-200">
          {glyph}
        </span>
      ) : null}
    </span>
  )
}

export { ROLE_LABEL as roleLabel }
