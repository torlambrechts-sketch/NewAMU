// Framework rail rendered on the left side of the /registers hub.
// Lets the user narrow the directory to one regulatory framework
// (AML, ISO 45001, GDPR, …). Empty buckets are hidden — the rail
// only lists frameworks the org actually has registers for.
//
// The active framework is purely a client-side filter (component-
// local state); it does not touch the cross-module regelverk filter
// in the top bar (which has different semantics — "show all
// registers but only count records tagged for these regelverk").

import { LayoutGrid } from 'lucide-react'
import { REGISTER_FRAMEWORKS } from '../../lib/registers/registerFrameworks'
import { lucideByName } from './lucideByName'

type Props = {
  /** Currently active framework id or 'all'. */
  active: string | 'all'
  /** Count of types per framework id. */
  counts: Record<string, number>
  /** Total across all types. */
  totalAll: number
  onChange: (frameworkId: string | 'all') => void
}

export function RegisterFrameworkRail({ active, counts, totalAll, onChange }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Rammeverk
        </h2>
      </div>
      <ul className="py-1.5">
        <li>
          <button
            type="button"
            onClick={() => onChange('all')}
            className={[
              'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
              active === 'all' ? 'bg-[#e7efe9] text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50',
            ].join(' ')}
            style={active === 'all' ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
          >
            <LayoutGrid
              className={[
                'h-3.5 w-3.5 shrink-0',
                active === 'all' ? 'text-[#1a3d32]' : 'text-neutral-500',
              ].join(' ')}
            />
            <span
              className={[
                'min-w-0 flex-1 truncate',
                active === 'all' ? 'font-semibold' : 'font-medium',
              ].join(' ')}
            >
              Alle
            </span>
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                active === 'all' ? 'bg-white text-[#14312a]' : 'bg-neutral-100 text-neutral-500',
              ].join(' ')}
            >
              {totalAll}
            </span>
          </button>
        </li>
        {REGISTER_FRAMEWORKS.map((f) => {
          const isActive = f.id === active
          const count = counts[f.id] ?? 0
          if (count === 0) return null
          const Icon = lucideByName(f.icon)
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onChange(f.id)}
                className={[
                  'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-[#e7efe9] text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
                style={isActive ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
              >
                <Icon
                  className={[
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'text-[#1a3d32]' : 'text-neutral-500',
                  ].join(' ')}
                  style={{ color: isActive ? f.color : undefined }}
                />
                <span
                  className={[
                    'min-w-0 flex-1 truncate',
                    isActive ? 'font-semibold' : 'font-medium',
                  ].join(' ')}
                >
                  {f.short}
                </span>
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isActive ? 'bg-white text-[#14312a]' : 'bg-neutral-100 text-neutral-500',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
