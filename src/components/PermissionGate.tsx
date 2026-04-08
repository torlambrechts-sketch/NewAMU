import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { permissionForPath } from '../lib/permissionKeys'

/** Enforces module.view.* from roles when Supabase + user session exist. */
export function PermissionGate() {
  const { supabaseConfigured, user, can, permissionsLoading, permissionKeys } = useOrgSetupContext()
  const location = useLocation()

  if (!supabaseConfigured || !user) {
    return <Outlet />
  }

  /* DB migration ikke kjørt: ingen nøkler — ikke lås brukeren ute */
  if (!permissionsLoading && permissionKeys.size === 0) {
    return <Outlet />
  }

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Laster tilganger…
      </div>
    )
  }

  const required = permissionForPath(location.pathname)
  const allowed = Array.isArray(required) ? required.some((k) => can(k)) : can(required)
  if (!allowed) {
    return <Navigate to="/" replace state={{ accessDenied: required }} />
  }

  return <Outlet />
}
