import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Award,
  BarChart3,
  BookOpen,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Users,
} from 'lucide-react'
import { WORKPLACE_CREAM } from '../layout/WorkplaceChrome'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'

/** Workplace content canvas (aligned with Action Board). */
export const SHELL_PAGE_BG = WORKPLACE_CREAM
/** Primary brand green from shell header */
export const SHELL_PRIMARY = '#1a3d32'
/** Gold accent from shell logo */
export const SHELL_ACCENT = '#c9a227'

/** @deprecated Use SHELL_PRIMARY for new code — kept for minimal churn in imports */
export const PIN_GREEN = SHELL_PRIMARY
export const CREAM = SHELL_PAGE_BG

/**
 * Wrapper for e-learning routes (content only). Primary + section navigation lives in AticsShell.
 */
export function LearningLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const learningHubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'dash',
        label: 'Oversikt',
        icon: LayoutDashboard,
        active: pathname === '/learning' || pathname === '/learning/',
        onClick: () => navigate('/learning'),
      },
      {
        key: 'courses',
        label: 'Kurs',
        icon: BookOpen,
        active: pathname.startsWith('/learning/courses'),
        onClick: () => navigate('/learning/courses'),
      },
      {
        key: 'cert',
        label: 'Sertifiseringer',
        icon: Award,
        active: pathname === '/learning/certifications',
        onClick: () => navigate('/learning/certifications'),
      },
      {
        key: 'insights',
        label: 'Innsikt',
        icon: BarChart3,
        active: pathname === '/learning/insights',
        onClick: () => navigate('/learning/insights'),
      },
      {
        key: 'participants',
        label: 'Deltakere',
        icon: Users,
        active: pathname === '/learning/participants',
        onClick: () => navigate('/learning/participants'),
      },
      {
        key: 'compliance',
        label: 'Team heatmap',
        icon: LayoutGrid,
        active: pathname === '/learning/compliance',
        onClick: () => navigate('/learning/compliance'),
      },
      {
        key: 'paths',
        label: 'Læringsstier',
        icon: GitBranch,
        active: pathname === '/learning/paths',
        onClick: () => navigate('/learning/paths'),
      },
      {
        key: 'external',
        label: 'Ekstern opplæring',
        icon: ExternalLink,
        active: pathname === '/learning/external',
        onClick: () => navigate('/learning/external'),
      },
      {
        key: 'settings',
        label: 'Innstillinger',
        icon: Settings,
        active: pathname === '/learning/settings',
        onClick: () => navigate('/learning/settings'),
      },
    ],
    [navigate, pathname],
  )

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: SHELL_PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <div className="mb-6">
          <HubMenu1Bar ariaLabel="E-læring — faner" items={learningHubItems} />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
