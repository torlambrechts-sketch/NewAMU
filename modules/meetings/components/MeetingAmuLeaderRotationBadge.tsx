// MeetingAmuLeaderRotationBadge — surfaces forskriftens § 3-15 rotation state.
//
// AMU-leder roterer årlig mellom arbeidsgiver- og arbeidstakerrep. (Forskrift
// om org. ledelse § 3-15). Ved stemmelikhet i partssammensatt voting har
// gjeldende leder dobbeltstemme. UI-badge gjør perioden synlig så møtelederen
// og deltakerne vet hvilken side som har avgjørende stemme ved tie.

import { Crown } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { MEETING_AMU_LEADER_PARTY_LABEL } from '../meetingsLabels'
import type { MeetingAmuLeaderParty } from '../types'

export type MeetingAmuLeaderRotationBadgeProps = {
  party: MeetingAmuLeaderParty | null
  /** When true, show a muted "ikke registrert" state instead of hiding. */
  showEmpty?: boolean
  className?: string
}

export function MeetingAmuLeaderRotationBadge({
  party,
  showEmpty = false,
  className,
}: MeetingAmuLeaderRotationBadgeProps) {
  if (!party) {
    if (!showEmpty) return null
    return (
      <span
        className={twMerge(
          'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600',
          className,
        )}
        title="Forskriftens § 3-15 — AMU-leder roterer årlig. Ikke registrert for dette møtet."
      >
        <Crown className="size-3" aria-hidden />
        Leder-rotasjon ikke registrert
      </span>
    )
  }

  const sideLabel = MEETING_AMU_LEADER_PARTY_LABEL[party]
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-900',
        className,
      )}
      title={`Forskriftens § 3-15: AMU-leder fra ${sideLabel.toLowerCase()} i denne perioden. Har dobbeltstemme ved stemmelikhet i partssammensatt voting.`}
    >
      <Crown className="size-3" aria-hidden />
      AMU-leder: {sideLabel} — dobbeltstemme aktiv
    </span>
  )
}
