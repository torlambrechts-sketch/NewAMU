import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

/** Auth required when Supabase is on; onboarding until org is complete. */
export function OrgGate() {
  const { supabaseConfigured, loadState, needsOnboarding, user } = useOrgSetupContext()
  const location = useLocation()

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-[#f5f0e8] text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Laster organisasjon…
      </div>
    )
  }

  const path = location.pathname
  const isPublicAuth = path === '/login' || path === '/signup' || path === '/platform-admin/login'
  const isInvite = path.startsWith('/invite/')
  if (supabaseConfigured && !user && !isPublicAuth && !isInvite) {
    const isPlatformAdminArea = path.startsWith('/platform-admin')
    const loginTarget = isPlatformAdminArea
      ? `/platform-admin/login?redirect=${encodeURIComponent(path + location.search)}`
      : `/login?redirect=${encodeURIComponent(path + location.search)}&reason=no_session`
    return <Navigate to={loginTarget} replace />
  }

  const skipOnboardingForPlatformAdmin = path.startsWith('/platform-admin') && path !== '/platform-admin/login'

  if (supabaseConfigured && user && needsOnboarding && path !== '/onboarding' && !skipOnboardingForPlatformAdmin) {
    return <Navigate to="/onboarding" replace state={{ from: path }} />
  }

  return <Outlet />
}
