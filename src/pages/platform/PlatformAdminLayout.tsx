import { NavLink, Outlet, Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Box, Layers, LayoutGrid, Loader2, LogOut, Map, PanelsTopLeft, Rows3, Shield, Sparkles } from 'lucide-react'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'

const nav: {
  to: string
  label: string
  end?: boolean
  icon: LucideIcon
}[] = [
  { to: '/platform-admin', label: 'Oversikt', end: true, icon: Shield },
  { to: '/platform-admin/roadmap', label: 'Veikart', icon: Map },
  { to: '/platform-admin/layout-lab', label: 'Layout-lab', icon: LayoutGrid },
  { to: '/platform-admin/ui-advanced', label: 'Avansert UI', icon: PanelsTopLeft },
  { to: '/platform-admin/box-designer', label: 'Komponentdesigner', icon: Box },
  { to: '/platform-admin/layout-builder', label: 'Layout-designer', icon: Rows3 },
  { to: '/platform-admin/layout-reference', label: 'Layout-referanse', icon: Sparkles },
  { to: '/platform-admin/layout-composer', label: 'Layout-komponer', icon: Layers },
]

export function PlatformAdminLayout() {
  const { supabase, loading, isAdmin, signOut } = usePlatformAdmin()

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-neutral-300">
        Supabase er ikke konfigurert.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 text-neutral-300">
        <Loader2 className="size-6 animate-spin" />
        Laster plattform…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-neutral-100">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-500/90">Global</p>
              <p className="font-semibold text-white">Plattformadmin</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map(({ to, label, end, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-50 ring-1 ring-amber-400/50'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-white/5"
          >
            <LogOut className="size-4" />
            Logg ut
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        {!isAdmin ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
            <h1 className="text-lg font-semibold">Ingen plattformtilgang</h1>
            <p className="mt-2 text-sm text-amber-200/90">
              Innlogget bruker er ikke registrert i <code className="rounded bg-black/20 px-1">platform_admins</code>. Be
              administrator om å legge inn din bruker-ID i databasen, eller bytt konto.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm font-medium text-amber-300 underline hover:text-amber-200"
            >
              Tilbake til appen
            </Link>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
