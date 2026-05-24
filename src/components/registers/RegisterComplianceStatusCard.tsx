// Compliance-status card on the framework rail — summarises mandatory
// / sensitive / due-soon / overdue counts across every enabled type
// in the org. Hidden in "easy" mode.
//
// All numbers feed from `computeComplianceSummary` so this is purely
// presentational; the maths lives in `lib/registers/registerStats.ts`.

import { Lock, ShieldCheck } from 'lucide-react'
import type { RegisterComplianceSummary } from '../../lib/registers/registerStats'

type Props = {
  summary: RegisterComplianceSummary
}

export function RegisterComplianceStatusCard({ summary }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        Compliance-status
      </h3>
      <ul className="mt-2 space-y-1.5 text-xs">
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-neutral-700">
            <ShieldCheck className="h-3 w-3 text-[#1a3d32]" />
            Lovpålagte
          </span>
          <span className="tabular-nums font-semibold text-neutral-900">
            {summary.mandatoryRegisters}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-neutral-700">
            <Lock className="h-3 w-3 text-purple-700" />
            Sensitive (GDPR)
          </span>
          <span className="tabular-nums font-semibold text-neutral-900">
            {summary.sensitiveRegisters}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-neutral-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            Utløper snart
          </span>
          <span
            className={[
              'tabular-nums font-semibold',
              summary.expiringSoon > 0 ? 'text-amber-700' : 'text-neutral-700',
            ].join(' ')}
          >
            {summary.expiringSoon}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-neutral-700">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
            Utgått / forfalt
          </span>
          <span
            className={[
              'tabular-nums font-semibold',
              summary.overdue > 0 ? 'text-red-700' : 'text-neutral-700',
            ].join(' ')}
          >
            {summary.overdue}
          </span>
        </li>
      </ul>
    </div>
  )
}
