// Table view for /registers — alternative density when the org has
// many register types or the user prefers a compact list.

import { AlertTriangle, Check, Lock, ShieldCheck } from 'lucide-react'
import { RegisterFrameworkPill } from './RegisterFrameworkPill'
import { lucideByName } from './lucideByName'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../module/moduleTableKit'
import type { ResolvedRegisterType } from '../../hooks/useRegisters'
import type { RegisterStats } from '../../lib/registers/registerStats'

type Props = {
  types: ResolvedRegisterType[]
  statsByType: Map<string, RegisterStats>
  easy: boolean
  onOpen: (type: ResolvedRegisterType) => void
}

export function RegisterHubTable({ types, statsByType, easy, onOpen }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={MODULE_TABLE_TH}>Register</th>
            <th className={MODULE_TABLE_TH}>Rammeverk</th>
            <th className={MODULE_TABLE_TH}>Oppføringer</th>
            {!easy ? <th className={MODULE_TABLE_TH}>Lovverk</th> : null}
            {!easy ? <th className={MODULE_TABLE_TH}>Eier</th> : null}
            {!easy ? <th className={MODULE_TABLE_TH}>Sjekk</th> : null}
            <th className={`${MODULE_TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {types.map((t) => {
            const display = t.displayMetadata
            const stats = statsByType.get(t.id) ?? { totalAll: 0, reviewsOverdue: 0, reviewsDueSoon: 0 }
            const issues = (stats.reviewsOverdue ?? 0) + (stats.reviewsDueSoon ?? 0)
            const Icon = lucideByName(display.icon)
            return (
              <tr
                key={t.id}
                className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                onClick={() => onOpen(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(t)
                  }
                }}
                tabIndex={0}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-neutral-900">
                          {t.resolvedName}
                        </span>
                        {display.mandatory ? (
                          <span
                            title="Lovpålagt"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e7efe9] text-[#1a3d32]"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                        {display.gdpr ? (
                          <span
                            title="GDPR"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-purple-100 text-purple-800"
                          >
                            <Lock className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {t.isSystem ? 'Systemtype' : 'Egen registertype'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <RegisterFrameworkPill regulationIds={t.regulationIds} />
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">
                  {stats.totalAll}
                </td>
                {!easy ? (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(display.legalLabels ?? []).slice(0, 2).map((l) => (
                        <span
                          key={l}
                          className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
                        >
                          {l}
                        </span>
                      ))}
                      {(display.legalLabels ?? []).length > 2 ? (
                        <span className="text-[10px] text-neutral-400">
                          +{(display.legalLabels ?? []).length - 2}
                        </span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
                {!easy ? (
                  <td className="px-5 py-3 text-neutral-700">{display.ownerRole ?? '—'}</td>
                ) : null}
                {!easy ? (
                  <td className="px-5 py-3">
                    {issues === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                        <Check className="h-3 w-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {issues} sak{issues === 1 ? '' : 'er'}
                      </span>
                    )}
                  </td>
                ) : null}
                <td className="px-5 py-3 text-right text-neutral-300">›</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
