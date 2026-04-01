import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Award,
  BarChart3,
  BookOpen,
  ChevronLeft,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'

const PIN_GREEN = '#2D403A'
const CREAM = '#FCF8F0'

const nav = [
  { to: '/learning', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/learning/courses', label: 'Courses', icon: BookOpen },
  { to: '/learning/certifications', label: 'Certifications', icon: Award },
  { to: '/learning/insights', label: 'Insights', icon: BarChart3 },
]

const bottomNav = [
  { to: '/learning/participants', label: 'Participants', icon: Users },
  { to: '/learning/settings', label: 'Settings', icon: Settings },
]

export function LearningLayout() {
  const location = useLocation()
  const isCourseDetail = /^\/learning\/courses\/[^/]+/.test(location.pathname)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: CREAM }}>
      <aside
        className="flex w-56 shrink-0 flex-col text-white md:w-64"
        style={{ backgroundColor: PIN_GREEN }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10"
            aria-label="Collapse"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-7 text-emerald-300" />
            <span className="font-serif text-lg font-semibold tracking-tight">Learn</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/25 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="size-5 shrink-0 opacity-90" />
                {item.label}
              </NavLink>
            )
          })}
          <div className="my-3 border-t border-white/10" />
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            More
          </p>
          {bottomNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white ${
                    isActive ? 'bg-white/10 text-white' : ''
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          Micro-learning · SCORM-ready structure
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-8"
          style={{ borderColor: `${PIN_GREEN}20`, backgroundColor: CREAM }}
        >
          <div className="min-w-0 text-sm text-neutral-600">
            {isCourseDetail ? (
              <span className="font-medium text-[#2D403A]">
                Courses <span className="text-neutral-400">›</span> Builder
              </span>
            ) : (
              <span className="font-medium text-[#2D403A]">Learning</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <div
              className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: PIN_GREEN }}
            >
              U
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export { PIN_GREEN, CREAM }
