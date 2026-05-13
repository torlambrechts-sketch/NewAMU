// "Tilbakestill til standard" button for a scope.
//
// Renders ONLY when `scope.resetToDefaults` is declared. Half-implementing
// (button present but no-op) would mislead the admin — the registry
// contract is "declared = real, undeclared = button hidden". Confirms
// via `window.confirm` to match the existing pattern in
// `LearningSettings.tsx` and the admin/* pages.

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { WarningBox } from '../../ui/AlertBox'
import type { SettingsScope } from '../../../lib/settings/settingsRegistry'

interface SettingsResetToDefaultsButtonProps {
  scope: SettingsScope
}

export function SettingsResetToDefaultsButton({ scope }: SettingsResetToDefaultsButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!scope.resetToDefaults) return null

  const onClick = async () => {
    if (
      !window.confirm(
        `Tilbakestille «${scope.label}» til standardverdier? Dette kan ikke angres.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await scope.resetToDefaults!()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke tilbakestille')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        disabled={busy}
        icon={
          busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )
        }
      >
        Tilbakestill til standard
      </Button>
      {error ? <WarningBox>{error}</WarningBox> : null}
    </div>
  )
}
