// Studio mode toggle — Enkel / Avansert.
//
// Sized for visibility per the design-review followup (issue #4). Two
// labelled segments that read as toggle pills rather than tiny chip
// buttons; the disabled state for Avansert is explicit via dimmed text
// plus an aria-disabled tooltip.

import { Button } from '../../ui/Button'
import type { StudioMode } from '../../../hooks/useStudioMode'

export type ModeToggleProps = {
  mode: StudioMode
  canUseAdvanced: boolean
  onChange: (next: StudioMode) => void
}

export function ModeToggle({ mode, canUseAdvanced, onChange }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Studio-modus"
      className="inline-flex items-center rounded-full overflow-hidden border border-neutral-200 bg-white shadow-sm"
    >
      <Button
        variant={mode === 'simple' ? 'primary' : 'secondary'}
        size="sm"
        className="rounded-r-none rounded-l-full border-0 px-4 py-1.5"
        onClick={() => onChange('simple')}
        aria-checked={mode === 'simple'}
        role="radio"
      >
        Enkel
      </Button>
      <Button
        variant={mode === 'advanced' ? 'primary' : 'secondary'}
        size="sm"
        className="rounded-l-none rounded-r-full border-0 px-4 py-1.5"
        disabled={!canUseAdvanced}
        title={canUseAdvanced ? 'Avansert kanvas + inspektør' : 'Krever permission studio.advanced'}
        onClick={() => canUseAdvanced && onChange('advanced')}
        aria-checked={mode === 'advanced'}
        aria-disabled={!canUseAdvanced}
        role="radio"
      >
        Avansert
      </Button>
    </div>
  )
}
