/**
 * ModuleSlugPage — Phase 2: Dynamic Route Loader.
 *
 * Route: /modules/:module_slug  (wired in App.tsx)
 *
 * Load sequence:
 *   1. Resolve slug against the frontend registry — 404 if unregistered.
 *   2. Wait for permissions to finish loading (avoids false-forbidden flash).
 *   3. Query `modules` table in Supabase — 404 if missing or inactive.
 *   4. Check `required_permissions` against user's effective permission keys.
 *   5. Validate `config` JSONB through the registry's Zod schema (failures
 *      fall back to the raw value so a bad config never blocks access).
 *   6. Render the lazy component inside `<Suspense>`.
 *
 * Graceful degradation:
 *   - No Supabase configured (dev/demo) → skip DB check, render directly.
 *   - `modules` table not yet created (Phase 1 migration pending) → same.
 *   - Permission rows missing (migration pending) → `can()` is permissive.
 */

import { Suspense, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AlertCircle, Loader2, ShieldOff } from 'lucide-react'

import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { resolveModule } from '../modules/registry'
import type { ModuleRegistryEntry } from '../modules/registry'

// ── DB row shape ───────────────────────────────────────────────────────────

type ModuleRow = {
  id: string
  slug: string
  display_name: string
  is_active: boolean
  required_permissions: string[] | null
  config: Record<string, unknown> | null
}

// ── State machine ──────────────────────────────────────────────────────────

type PageState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entry: ModuleRegistryEntry; config: Record<string, unknown> }

// ── Component ──────────────────────────────────────────────────────────────

export function ModuleSlugPage() {
  const { module_slug } = useParams<{ module_slug: string }>()
  const { supabase, can, permissionsLoading, permissionKeys } = useOrgSetupContext()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    if (!module_slug) {
      setState({ status: 'not_found' })
      return
    }

    // Registry check — fail fast before any async work
    const entry = resolveModule(module_slug)
    if (!entry) {
      setState({ status: 'not_found' })
      return
    }

    // Wait until permissions have resolved so we never show a false-forbidden
    if (permissionsLoading) return

    async function load() {
      const currentEntry = resolveModule(module_slug!)!

      // No DB — render directly (demo / local dev)
      if (!supabase) {
        setState({ status: 'ready', entry: currentEntry, config: {} })
        return
      }

      const { data, error } = await supabase
        .from('modules')
        .select('id, slug, display_name, is_active, required_permissions, config')
        .eq('slug', module_slug)
        .maybeSingle()

      if (error) {
        // Phase 1 migration not yet run → gracefully skip the DB check
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setState({ status: 'ready', entry: currentEntry, config: {} })
        } else {
          setState({ status: 'error', message: error.message })
        }
        return
      }

      if (!data) {
        setState({ status: 'not_found' })
        return
      }

      const row = data as ModuleRow

      if (!row.is_active) {
        setState({ status: 'not_found' })
        return
      }

      // Permission check. `permissionKeys.size === 0` means the RPC returned
      // nothing (migration not run) — treat as open per the PermissionGate pattern.
      const required = Array.isArray(row.required_permissions)
        ? row.required_permissions
        : []

      if (required.length > 0 && permissionKeys.size > 0) {
        const forbidden = required.some(
          (p) => !can(p as Parameters<typeof can>[0]),
        )
        if (forbidden) {
          setState({ status: 'forbidden' })
          return
        }
      }

      // Validate config — fall back to raw value on parse failure
      let parsedConfig: Record<string, unknown> = {}
      if (row.config) {
        const result = currentEntry.configSchema.safeParse(row.config)
        parsedConfig = result.success
          ? (result.data as Record<string, unknown>)
          : row.config
      }

      setState({ status: 'ready', entry: currentEntry, config: parsedConfig })
    }

    void load()
    // Re-run when permissions finish loading (permissionKeys.size: 0 → N)
  }, [module_slug, supabase, can, permissionsLoading, permissionKeys.size])

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'not_found') return <Navigate to="/404" replace />
  if (state.status === 'forbidden') return <ForbiddenState />
  if (state.status === 'error') return <ErrorState message={state.message} />

  const Component = state.entry.component

  return (
    <Suspense fallback={<LoadingState />}>
      <Component config={state.config} />
    </Suspense>
  )
}

// ── Feedback states ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24 text-neutral-500">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="ml-2.5 text-sm">Laster modul…</span>
    </div>
  )
}

function ForbiddenState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <ShieldOff className="size-8 text-neutral-300" aria-hidden />
      <p className="text-sm font-medium text-neutral-600">
        Du har ikke tilgang til denne modulen.
      </p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <AlertCircle className="size-8 text-red-300" aria-hidden />
      <p className="text-sm font-medium text-red-600">{message}</p>
    </div>
  )
}
