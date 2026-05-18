// Simple-mode card grid — aggregates SimplePresets across all kinds for
// the active scope. Phase 1 Task 1.2 acceptance: clicking a card mounts
// the WizardModal via PresetPicker.

import { useMemo } from 'react'
import { PresetPicker } from '../../../lib/studio/PresetPicker'
import { listStudioKinds } from '../../../lib/studio/studioRegistry'
import type { StudioTelemetryEvent } from '../../../lib/studio/studioTypes'

export type SimpleModeCardsProps = {
  scopeId: string
  emit: (event: StudioTelemetryEvent) => void
}

export function SimpleModeCards({ scopeId, emit }: SimpleModeCardsProps) {
  const kinds = useMemo(() => listStudioKinds(scopeId), [scopeId])

  if (kinds.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
        Ingen kinds registrert for scope <code>{scopeId}</code>. Sjekk at
        scope-filen kaller <code>registerStudioKind</code>.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {kinds.map((kind) => (
        <section key={kind.kindId}>
          {kinds.length > 1 ? (
            <h4 className="mb-3 text-xs uppercase tracking-wider text-neutral-500 font-medium">
              {kind.label}
            </h4>
          ) : null}
          <PresetPicker
            kind={kind}
            emit={emit}
            layout="grid"
            onComplete={(presetId) => {
              // PresetPicker already emits preset_started + preset_completed.
              // Nothing else to do at this layer in Phase 1.
              void presetId
            }}
          />
        </section>
      ))}
    </div>
  )
}
