import { AlertTriangle } from 'lucide-react'
import { legalDisclaimerBody } from './legalDisclaimerCopy'

export function LegalDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-amber-300/90 bg-amber-50 text-amber-950 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
      role="note"
    >
      <div className="flex gap-2">
        <AlertTriangle className={`shrink-0 text-amber-700 ${compact ? 'size-4' : 'size-5'}`} aria-hidden />
        <div>{legalDisclaimerBody({ compact })}</div>
      </div>
    </div>
  )
}
