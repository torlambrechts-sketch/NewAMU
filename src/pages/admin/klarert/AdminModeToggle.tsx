// Enkel ↔ Avansert toggle shared across admin sections. Drives which
// metadata columns and inline guidance render in each section.

import { twMerge } from 'tailwind-merge'
import { Button } from '../../../components/ui/Button'
import type { AdminMode } from './types'

interface AdminModeToggleProps {
  mode: AdminMode
  onChange: (mode: AdminMode) => void
}

const baseClass =
  'rounded-full px-3 py-1 text-xs font-semibold transition-colors'

export function AdminModeToggle({ mode, onChange }: AdminModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Visningsmodus"
      className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5 text-xs"
    >
      <Button
        variant="ghost"
        onClick={() => onChange('easy')}
        aria-pressed={mode === 'easy'}
        className={twMerge(
          baseClass,
          mode === 'easy'
            ? 'bg-[#1a3d32] text-white hover:bg-[#143028] hover:text-white'
            : 'text-neutral-600 hover:bg-transparent hover:text-neutral-900',
        )}
      >
        Enkel
      </Button>
      <Button
        variant="ghost"
        onClick={() => onChange('advanced')}
        aria-pressed={mode === 'advanced'}
        className={twMerge(
          baseClass,
          mode === 'advanced'
            ? 'bg-[#1a3d32] text-white hover:bg-[#143028] hover:text-white'
            : 'text-neutral-600 hover:bg-transparent hover:text-neutral-900',
        )}
      >
        Avansert
      </Button>
    </div>
  )
}
