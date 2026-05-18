// Studio mode toggle — Enkel / Avansert.
//
// Visible to all studio users; the Avansert option is disabled (with a
// tooltip) for users without `studio.advanced`. Sticky per-user via
// profiles.studio_mode_default (Task 0.2 column).

import { Button } from '../../ui/Button'
import type { StudioMode } from '../../../hooks/useStudioMode'

export type ModeToggleProps = {
  mode: StudioMode
  canUseAdvanced: boolean
  onChange: (next: StudioMode) => void
}

export function ModeToggle({ mode, canUseAdvanced, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-full overflow-hidden border border-neutral-200 bg-white shadow-sm">
      <Button
        variant={mode === 'simple' ? 'primary' : 'secondary'}
        size="sm"
        className="rounded-r-none rounded-l-full border-0"
        onClick={() => onChange('simple')}
      >
        Enkel
      </Button>
      <Button
        variant={mode === 'advanced' ? 'primary' : 'secondary'}
        size="sm"
        className="rounded-l-none rounded-r-full border-0"
        disabled={!canUseAdvanced}
        title={canUseAdvanced ? 'Bytt til avansert (kanvas + inspektør)' : 'Krever permission studio.advanced'}
        onClick={() => canUseAdvanced && onChange('advanced')}
      >
        Avansert
      </Button>
    </div>
  )
}
