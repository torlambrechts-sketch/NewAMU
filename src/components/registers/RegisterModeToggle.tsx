// "Enkel / Avansert" toggle on the registers page header.
//
// Persisted via useRegisterUiPreference — the choice lives on
// profiles.ui_preferences (database-first per task spec). Switching
// modes optimistically updates local state; the supabase write fires
// in the background.

import { CircleDot, SlidersHorizontal } from 'lucide-react'
import type { RegisterUiMode } from '../../hooks/useUserUiPreferences'

type Props = {
  mode: RegisterUiMode
  onChange: (next: RegisterUiMode) => void
  compact?: boolean
}

const ITEMS: { id: RegisterUiMode; label: string; sub: string }[] = [
  { id: 'easy', label: 'Enkel', sub: 'For alle i felt' },
  { id: 'advanced', label: 'Avansert', sub: 'HMS-ansvarlig' },
]

export function RegisterModeToggle({ mode, onChange, compact = false }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Visningsmodus"
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1 shadow-sm"
    >
      {ITEMS.map((it) => {
        const active = it.id === mode
        const Icon = it.id === 'easy' ? CircleDot : SlidersHorizontal
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={[
              'flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
              active ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{it.label}</span>
            {!compact ? (
              <span
                className={[
                  'hidden text-[10px] font-medium md:inline',
                  active ? 'text-white/70' : 'text-neutral-400',
                ].join(' ')}
              >
                · {it.sub}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
