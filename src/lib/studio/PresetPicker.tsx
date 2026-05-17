// Studio Builder — Simple-mode preset picker.
//
// Renders a kind's simplePresets[] as either:
//   - a card grid (home-page surface — outcome-named cards)
//   - a list (inline launcher inside an editor)
//
// On selection, the picker mounts the existing WizardModal with a wrapped
// WizardDef: the preset owns the submit semantics (its `wizard.onSubmit`
// runs the actual mutation), the picker wraps it to fire telemetry and
// call back into the studio shell.
//
// Spec: specs/studio-builder.md §4 + §5 Phase 0 Task 0.4 + Task 1.2.

import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { WizardModal } from '../../components/wizard/WizardModal'
import type { WizardDef } from '../../components/wizard/types'
import { freshId } from './freshId'
import type { SimplePreset, StudioKindRegistration, StudioTelemetryEvent } from './studioTypes'

export type PresetPickerProps = {
  /**
   * The kind whose presets we're picking from. Typed as a partial so a
   * test fixture can hand in just the data the picker reads.
   */
  kind: Pick<StudioKindRegistration, 'scopeId' | 'kindId' | 'simplePresets'>
  /** Fired after the wizard submits successfully. */
  onComplete?: (presetId: string, values: Record<string, string | boolean>) => void
  /** Optional telemetry sink. */
  emit?: (event: StudioTelemetryEvent) => void
  /** Layout: 'grid' (home cards) or 'list' (inline launcher). */
  layout?: 'grid' | 'list'
}

export function PresetPicker({
  kind,
  onComplete,
  emit,
  layout = 'grid',
}: PresetPickerProps): ReactNode {
  const [activePreset, setActivePreset] = useState<SimplePreset | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const handleStart = useCallback(
    (preset: SimplePreset) => {
      setActivePreset(preset)
      setStartedAt(Date.now())
      emit?.({ type: 'studio.preset_started', scopeId: kind.scopeId, presetId: preset.id })
    },
    [emit, kind.scopeId],
  )

  const handleClose = useCallback(() => {
    setActivePreset(null)
    setStartedAt(null)
  }, [])

  // Build a WizardDef that wraps the preset's onSubmit with telemetry +
  // onComplete. Stable reference per active-preset so the modal doesn't
  // remount on each parent re-render.
  const wizardDef: WizardDef | null = useMemo(() => {
    if (!activePreset) return null
    return {
      ...activePreset.wizard,
      id: `${kind.scopeId}-${activePreset.id}-${freshId('run')}`,
      onSubmit: (values) => {
        activePreset.wizard.onSubmit(values)
        if (startedAt != null) {
          emit?.({
            type: 'studio.preset_completed',
            scopeId: kind.scopeId,
            presetId: activePreset.id,
            durationMs: Date.now() - startedAt,
          })
        }
        onComplete?.(activePreset.id, values)
      },
    }
  }, [activePreset, emit, kind.scopeId, onComplete, startedAt])

  if (kind.simplePresets.length === 0) {
    // Prebuild assertion catches this at build time; runtime fallback for HMR.
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        Ingen Enkel-modus-veivisere er registrert for{' '}
        <code className="font-mono">
          {kind.scopeId}::{kind.kindId}
        </code>
        . Sjekk at scope-filen eksporterer minst ett SimplePreset.
      </div>
    )
  }

  const cards = (
    <div
      className={
        layout === 'grid'
          ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'space-y-2'
      }
    >
      {kind.simplePresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => handleStart(preset)}
          className={
            layout === 'grid'
              ? 'rounded-xl border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#1a3d32]/40'
              : 'flex w-full items-start gap-3 rounded-md p-3 text-left hover:bg-neutral-50'
          }
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 font-serif">{preset.title}</span>
            {preset.badge ? (
              <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0 text-[9.5px] font-bold text-amber-800 uppercase tracking-wider">
                {preset.badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-neutral-600 line-clamp-2">{preset.description}</p>
        </button>
      ))}
    </div>
  )

  return (
    <>
      {cards}
      {wizardDef ? <WizardModal def={wizardDef} onClose={handleClose} /> : null}
    </>
  )
}
