// Studio Builder — sticky per-user mode preference + Open-in-Advanced
// escape-hatch tracking.
//
// Mode is a per-user setting persisted on profiles.studio_mode_default
// (Task 0.2 migration). The hook owns:
//   - Reading the initial value from the profile
//   - Permission-gating advanced (requires studio.advanced OR platform admin)
//   - Persisting flips to the DB
//   - Tracking "Open in Advanced" escape-hatch usage so the shell can
//     surface a "promote to Advanced by default?" prompt at threshold
//   - Emitting telemetry stubs (Phase 1 wires a real sink)
//
// Why a hook rather than the orgSetupContext:
//   - The mode preference is studio-specific. updateProfileFields() in
//     useOrgSetup has a closed-shape patch type and adding studio_mode_default
//     there would couple it to UI state that not every consumer cares about.
//   - The Open-in-Advanced counter is in-session state, not persisted.
//   - Telemetry emission belongs at the studio boundary.
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.8 + Task 1.3 telemetry.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { emitStudioTelemetry } from '../lib/studio/telemetry'
import type { StudioTelemetryEvent } from '../lib/studio/studioTypes'

export type StudioMode = 'simple' | 'advanced'

/** Threshold for prompting the user to promote to Advanced by default. */
const OPEN_IN_ADVANCED_PROMPT_THRESHOLD = 3

/**
 * The studio mode hook. Returns the current mode, a setter that's gated
 * on studio.advanced permission, the open-in-advanced counter, and a
 * telemetry-emit callback the shell uses for the other telemetry events
 * (preset_started, preset_completed, etc.).
 */
export function useStudioMode() {
  const { supabase, user, profile, can, isAdmin } = useOrgSetupContext()

  const initialMode: StudioMode = (() => {
    const stored = (profile as { studio_mode_default?: string } | null)?.studio_mode_default
    return stored === 'advanced' ? 'advanced' : 'simple'
  })()

  const [mode, setModeState] = useState<StudioMode>(initialMode)
  const [openInAdvancedCount, setOpenInAdvancedCount] = useState(0)
  const [shouldPromptPromotion, setShouldPromptPromotion] = useState(false)

  // Sync if the profile loads after the hook mounted.
  const lastInitialRef = useRef(initialMode)
  useEffect(() => {
    const stored = (profile as { studio_mode_default?: string } | null)?.studio_mode_default
    const next: StudioMode = stored === 'advanced' ? 'advanced' : 'simple'
    if (next !== lastInitialRef.current) {
      lastInitialRef.current = next
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state to a late-arriving profile value
      setModeState(next)
    }
  }, [profile])

  const canUseAdvanced = isAdmin || can('studio.advanced')

  /**
   * Emit a telemetry event through the canonical Studio sink (console
   * in dev + Vercel Analytics in prod). Identity-stable callback so
   * consumers can memoise on it.
   */
  const emit = useCallback((event: StudioTelemetryEvent) => {
    emitStudioTelemetry(event)
  }, [])

  /**
   * Flip mode. Persists to profile + emits telemetry. Advanced is
   * permission-gated; calling setStudioMode('advanced') without
   * studio.advanced is a silent no-op (the toggle UI should be
   * disabled, but server-side enforcement happens here too).
   */
  const setStudioMode = useCallback(
    async (next: StudioMode, trigger = 'user_toggle'): Promise<boolean> => {
      if (next === 'advanced' && !canUseAdvanced) return false
      if (next === mode) return true
      const previous = mode
      setModeState(next)
      emit({ type: 'studio.mode_promoted', from: previous, to: next, trigger })
      if (!supabase || !user) return true
      const { error: e } = await supabase
        .from('profiles')
        .update({ studio_mode_default: next })
        .eq('id', user.id)
      if (e) {
        // Roll back the local mode change so the UI reflects the persisted state.
        console.warn('[studio] mode persist failed; rolling back', e.message)
        setModeState(previous)
        return false
      }
      return true
    },
    [canUseAdvanced, mode, supabase, user, emit],
  )

  /**
   * Track an "Open in Advanced" escape-hatch click. At the threshold,
   * sets shouldPromptPromotion so the shell can render a "Want to
   * switch to Advanced by default?" prompt. Resets after the user
   * accepts or dismisses.
   */
  const recordOpenInAdvanced = useCallback(
    (scopeId: string, kindId?: string, fromPresetId?: string) => {
      emit({ type: 'studio.open_in_advanced_clicked', scopeId, kindId, fromPresetId })
      setOpenInAdvancedCount((c) => {
        const next = c + 1
        if (next >= OPEN_IN_ADVANCED_PROMPT_THRESHOLD && !canUseAdvanced) {
          // Don't prompt users who can't be promoted (no permission).
          return next
        }
        if (next >= OPEN_IN_ADVANCED_PROMPT_THRESHOLD && mode === 'simple') {
          setShouldPromptPromotion(true)
        }
        return next
      })
    },
    [canUseAdvanced, mode, emit],
  )

  const dismissPromotionPrompt = useCallback(() => {
    setShouldPromptPromotion(false)
    setOpenInAdvancedCount(0)
  }, [])

  const acceptPromotionPrompt = useCallback(async () => {
    setShouldPromptPromotion(false)
    setOpenInAdvancedCount(0)
    await setStudioMode('advanced', 'open_in_advanced_threshold')
  }, [setStudioMode])

  return {
    mode,
    setStudioMode,
    canUseAdvanced,
    /** Pass-through telemetry emitter for the shell's other events. */
    emit,
    /** Count of "Open in Advanced" escape-hatch clicks this session. */
    openInAdvancedCount,
    /** Call when the user clicks "Open in Advanced" on a Simple-mode form. */
    recordOpenInAdvanced,
    /** True when openInAdvancedCount hit the threshold and we should prompt. */
    shouldPromptPromotion,
    /** Call when the user accepts the promotion prompt. */
    acceptPromotionPrompt,
    /** Call when the user dismisses the promotion prompt. */
    dismissPromotionPrompt,
  }
}
