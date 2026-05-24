// useUserUiPreferences — read + write profiles.ui_preferences jsonb.
//
// Database-first per task spec: the user's mode / view choices follow
// them across browsers and devices rather than living in localStorage.
// Returns a typed scope helper so callers don't poke directly at the
// jsonb path:
//
//   const { mode, setMode, view, setView } = useRegisterUiPreference()
//
// All writes are optimistic (local state updates immediately, supabase
// upsert fires in the background). If the write fails the local value
// stays; we surface the error via `error` for the caller to display
// in a toast if it cares.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'

type UiScopeRecord = Record<string, unknown>

function readScope(prefs: unknown, scope: string): UiScopeRecord {
  if (!prefs || typeof prefs !== 'object') return {}
  const v = (prefs as Record<string, unknown>)[scope]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return v as UiScopeRecord
}

/**
 * Generic scoped accessor. Pass a scope key ('registers', 'survey', …)
 * and you get a typed bag back. Writes patch into that scope only —
 * other scopes are preserved.
 */
export function useUserUiPreferenceScope<T extends UiScopeRecord>(
  scope: string,
  defaults: T,
): {
  value: T
  patch: (next: Partial<T>) => Promise<void>
  error: string | null
  loading: boolean
} {
  const { supabase, user, profile } = useOrgSetupContext()
  const [local, setLocal] = useState<T>(defaults)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Mirror profile.ui_preferences into local state. Defaults fill any
  // missing keys so consumers can rely on a fully-shaped object.
  useEffect(() => {
    if (!profile) return
    const scoped = readScope(profile.ui_preferences, scope)
    setLocal({ ...defaults, ...(scoped as T) })
    setHydrated(true)
    // We intentionally exclude `defaults` from deps — it's expected to
    // be a stable literal at the call site. Including it would cause a
    // re-run every render and overwrite local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, scope])

  const patch = useCallback(
    async (next: Partial<T>) => {
      const merged = { ...local, ...next }
      setLocal(merged)
      if (!supabase || !user) return
      try {
        // Merge into the full prefs object preserving other scopes.
        const allPrefs = (profile?.ui_preferences ?? {}) as Record<string, unknown>
        const nextAll = { ...allPrefs, [scope]: merged }
        const { error: e } = await supabase
          .from('profiles')
          .update({ ui_preferences: nextAll })
          .eq('id', user.id)
        if (e) setError(getSupabaseErrorMessage(e))
        else setError(null)
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      }
    },
    [supabase, user, profile, local, scope],
  )

  return {
    value: local,
    patch,
    error,
    loading: !hydrated && profile == null,
  }
}

// ── Convenience: register-specific scope ────────────────────────────────

export type RegisterUiMode = 'easy' | 'advanced'
export type RegisterUiView = 'bokser' | 'tabell'

const REGISTER_DEFAULTS = {
  mode: 'advanced' as RegisterUiMode,
  view: 'bokser' as RegisterUiView,
}

export function useRegisterUiPreference() {
  const { value, patch, error, loading } = useUserUiPreferenceScope(
    'registers',
    REGISTER_DEFAULTS,
  )
  const mode: RegisterUiMode =
    value.mode === 'easy' || value.mode === 'advanced' ? value.mode : 'advanced'
  const view: RegisterUiView =
    value.view === 'bokser' || value.view === 'tabell' ? value.view : 'bokser'
  return useMemo(
    () => ({
      mode,
      view,
      setMode: (next: RegisterUiMode) => patch({ mode: next }),
      setView: (next: RegisterUiView) => patch({ view: next }),
      error,
      loading,
    }),
    [mode, view, patch, error, loading],
  )
}
