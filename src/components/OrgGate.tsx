import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { DEMO_QUERY_PARAM, isDemoRouteSearch } from '../lib/demoOrg'

/** Auth required when Supabase is on; onboarding until org is complete. */
export function OrgGate() {
  const { supabaseConfigured, loadState, needsOnboarding, user } = useOrgSetupContext()
  const location = useLocation()

  /** Block protected routes until session is read from storage (avoids false redirect to /login on refresh) */
  if (supabaseConfigured && (loadState === 'loading' || loadState === 'idle')) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-[#f5f0e8] text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Laster sesjon…
      </div>
    )
  }

  const path = location.pathname
  const isPublicWhistle = path.startsWith('/varsle')
  const isPublicAuth = path === '/login' || path === '/signup' || path === '/platform-admin/login'
  const isInvite = path.startsWith('/invite/')
  if (supabaseConfigured && !user && !isPublicAuth && !isInvite && !isPublicWhistle) {
    const isPlatformAdminArea = path.startsWith('/platform-admin')
    const wantsDemo = isDemoRouteSearch(location.search)
    const loginTarget = isPlatformAdminArea
      ? `/platform-admin/login?redirect=${encodeURIComponent(path + location.search)}`
      : `/login?redirect=${encodeURIComponent(path + location.search)}&reason=no_session${wantsDemo ? `&${DEMO_QUERY_PARAM}=1` : ''}`
    return <Navigate to={loginTarget} replace />
  }

  const skipOnboardingForPlatformAdmin = path.startsWith('/platform-admin') && path !== '/platform-admin/login'

  if (supabaseConfigured && user && needsOnboarding && path !== '/onboarding' && !skipOnboardingForPlatformAdmin) {
    return <Navigate to="/onboarding" replace state={{ from: path }} />
  }

  return <Outlet />
}
