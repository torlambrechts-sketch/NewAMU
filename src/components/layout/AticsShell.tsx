import { NavLink, Outlet } from 'react-router-dom'
import {
  Clock,
  ExternalLink,
  Search,
  Settings,
  Star,
} from 'lucide-react'

const navMain = [
  { to: '/', label: 'Home', end: true },
  { to: '/clients', label: 'Clients' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/marketing', label: 'Marketing' },
  { to: '/reports', label: 'Reports' },
]

const navSub = [
  { to: '/', label: 'Projects', end: true },
  { to: '/council', label: 'Council' },
  { to: '/members', label: 'Members' },
  { to: '/org-health', label: 'Org health' },
  { to: '/hse', label: 'HSE' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/teams', label: 'Teams' },
  { to: '/workspaces', label: 'Workspaces' },
]

export function AticsShell() {
  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <header className="bg-[#1a3d32] text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <Star className="size-7 shrink-0 fill-white text-white" strokeWidth={1.2} />
            <span
              className="font-serif text-xl tracking-wide text-[#c9a227] md:text-2xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              atics
            </span>
          </div>
          <nav className="hidden flex-1 justify-center gap-6 md:flex">
            {navMain.map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-b-2 border-[#c9a227] pb-0.5 text-white'
                      : 'text-white/80 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] sm:flex"
            >
              <Clock className="size-3.5" />
              Upgrade
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Settings">
              <Settings className="size-5" />
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Open external">
              <ExternalLink className="size-5" />
            </button>
            <div
              className="size-9 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-white/30"
              role="img"
              aria-label="User profile"
            />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-8">
            <nav className="flex gap-5">
              {navSub.map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-b-2 border-[#c9a227] pb-0.5 text-white'
                        : 'text-white/75 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="relative min-w-[200px] flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
              <input
                type="search"
                placeholder="Find anything"
                className="w-full rounded-full border border-white/20 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/45 focus:border-[#c9a227] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
              />
            </div>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
