import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

/** Redirects to /onboarding when Supabase is configured but org setup is incomplete. */
export function OrgGate() {
  const { supabaseConfigured, loadState, needsOnboarding } = useOrgSetupContext()
  const location = useLocation()

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-[#f5f0e8] text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Laster organisasjon…
      </div>
    )
  }

  if (supabaseConfigured && needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
