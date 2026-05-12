// ConfidentialityMarker — banner for konfidensielle dokumenter.
//
// Brukes på person­dokumenter (sykefravær, drøftings­møte § 15-1, DPIA)
// for å markere tilgangs­begrensning visuelt + i utskrift.

import { Lock } from 'lucide-react'

type Classification = 'aapen' | 'fortrolig' | 'strengt_fortrolig'

type Props = {
  classification?: Classification
  accessList?: string[]
}

const STYLES: Record<Classification, { bg: string; border: string; text: string; label: string }> = {
  aapen: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    label: 'Åpen',
  },
  fortrolig: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-950',
    label: 'Fortrolig',
  },
  strengt_fortrolig: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    label: 'Strengt fortrolig',
  },
}

export function ConfidentialityMarker({
  classification = 'fortrolig',
  accessList,
}: Props) {
  const style = STYLES[classification]
  return (
    <div
      className={`not-prose my-4 rounded-lg border ${style.border} ${style.bg} px-4 py-3 ${style.text}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4" />
        <span className="uppercase tracking-wide">{style.label}</span>
      </div>
      {accessList && accessList.length > 0 ? (
        <div className="mt-1 text-xs">
          <strong>Tilgang:</strong> {accessList.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}
