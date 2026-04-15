'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  coerceRequiredPermissions,
  extractModuleConfig,
  parseModuleConfig,
  resolveRegistryEntryForModule,
  type ModuleRegistryEntry,
  type RegisteredModuleRow,
} from '../../modules/registry'
import { PageShell } from '../../template'
import { getSupabaseBrowserClient } from '../../src/lib/supabaseClient'

type ModulePageProps = {
  params: {
    module_slug: string
  }
}

type LoadStatus = 'loading' | 'ready' | 'not_found' | 'forbidden' | 'error'

type PageState = {
  status: LoadStatus
  resolvedSlug: string
  message?: string
  module?: RegisteredModuleRow
  registryEntry?: ModuleRegistryEntry
  parsedConfig?: unknown
}

const MODULE_SELECT_COLUMNS = [
  'id',
  'slug',
  'display_name',
  'is_active',
  'required_permissions',
  'config',
  'module_config',
  'settings',
].join(', ')

function getRegistryConfigCandidate(module: RegisteredModuleRow): unknown {
  const inlineConfig = extractModuleConfig(module)
  if (inlineConfig && typeof inlineConfig === 'object' && Object.keys(inlineConfig as object).length > 0) {
    return inlineConfig
  }
  return {}
}

export default function ModuleSlugPage({ params }: ModulePageProps) {
  const moduleSlug = decodeURIComponent(params.module_slug ?? '').trim().toLowerCase()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [state, setState] = useState<PageState>({ status: 'loading', resolvedSlug: moduleSlug })

  useEffect(() => {
    let cancelled = false

    async function loadModule() {
      if (!moduleSlug) {
        if (!cancelled) {
          setState({
            status: 'not_found',
            resolvedSlug: moduleSlug,
            message: 'Missing module slug.',
          })
        }
        return
      }
      if (!supabase) {
        if (!cancelled) {
          setState({
            status: 'error',
            resolvedSlug: moduleSlug,
            message: 'Supabase is not configured in this environment.',
          })
        }
        return
      }

      const moduleResult = await supabase
        .from('modules')
        .select(MODULE_SELECT_COLUMNS)
        .eq('slug', moduleSlug)
        .eq('is_active', true)
        .maybeSingle()

      if (moduleResult.error) {
        if (!cancelled) {
          setState({
            status: 'error',
            resolvedSlug: moduleSlug,
            message: `Failed loading module '${moduleSlug}': ${moduleResult.error.message}`,
          })
        }
        return
      }

      const moduleRow = moduleResult.data as RegisteredModuleRow | null
      if (!moduleRow) {
        if (!cancelled) {
          setState({
            status: 'not_found',
            resolvedSlug: moduleSlug,
            message: `No active module registered for slug '${moduleSlug}'.`,
          })
        }
        return
      }

      const registryEntry = resolveRegistryEntryForModule(moduleRow)
      if (!registryEntry) {
        if (!cancelled) {
          setState({
            status: 'error',
            resolvedSlug: moduleSlug,
            message: `No frontend registry entry was found for module '${moduleRow.slug}'.`,
          })
        }
        return
      }

      const requiredPermissions = coerceRequiredPermissions(moduleRow.required_permissions)
      if (requiredPermissions.length > 0) {
        const permissionResult = await supabase.rpc('get_my_effective_permissions')
        if (permissionResult.error) {
          if (!cancelled) {
            setState({
              status: 'forbidden',
              resolvedSlug: moduleSlug,
              message: `Unable to validate permissions: ${permissionResult.error.message}`,
            })
          }
          return
        }

        const rows = (permissionResult.data ?? []) as Array<{ permission_key?: string }>
        const effectivePermissions = new Set(
          rows.map((row) => row.permission_key).filter((key): key is string => typeof key === 'string'),
        )
        const missing = requiredPermissions.filter((permission) => !effectivePermissions.has(permission))

        if (missing.length > 0) {
          if (!cancelled) {
            setState({
              status: 'forbidden',
              resolvedSlug: moduleSlug,
              message: `Missing required permissions: ${missing.join(', ')}`,
            })
          }
          return
        }
      }

      const configCandidate = getRegistryConfigCandidate(moduleRow)
      const parsedConfig = parseModuleConfig(registryEntry, configCandidate)

      if (!cancelled) {
        setState({
          status: 'ready',
          resolvedSlug: moduleSlug,
          module: moduleRow,
          registryEntry,
          parsedConfig,
        })
      }
    }

    void loadModule()

    return () => {
      cancelled = true
    }
  }, [moduleSlug, supabase])

  const isLoading = state.status === 'loading' || state.resolvedSlug !== moduleSlug

  if (isLoading) {
    return (
      <PageShell
        title="Loading module"
        description={`Resolving route '/${moduleSlug}' from database module registration...`}
      >
        <p className="text-sm text-neutral-600">Please wait while module metadata is loaded.</p>
      </PageShell>
    )
  }

  if (state.status === 'not_found') {
    return (
      <PageShell title="Module not found" description={state.message}>
        <p className="text-sm text-neutral-600">
          Confirm the module exists in the <code>modules</code> table and is marked as active.
        </p>
      </PageShell>
    )
  }

  if (state.status === 'forbidden') {
    return (
      <PageShell title="Access denied" description="You do not have access to this module.">
        <p className="text-sm text-neutral-600">{state.message}</p>
      </PageShell>
    )
  }

  if (state.status === 'error' || !state.module || !state.registryEntry) {
    return (
      <PageShell title="Module route error" description="The dynamic route could not be rendered.">
        <p className="text-sm text-neutral-600">{state.message ?? 'Unknown error.'}</p>
      </PageShell>
    )
  }

  const Component = state.registryEntry.Component
  return (
    <PageShell title={state.module.display_name} description={state.registryEntry.description}>
      <Component module={state.module} config={state.parsedConfig} supabase={supabase} />
    </PageShell>
  )
}
