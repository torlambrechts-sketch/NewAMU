import { Suspense, lazy, useMemo } from 'react'
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
import { WorkplacePageHeading1 } from '../layout/WorkplacePageHeading1'

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
function learningPageMeta(pathname: string): { section: string; description: string } {
  if (pathname === '/learning' || pathname === '/learning/') {
    return {
      section: 'Oversikt',
      description: 'Publisering, påmelding, sertifikater og mikromoduler — samlet i én arbeidsflate.',
    }
  }
  if (pathname.startsWith('/learning/play/')) {
    return {
      section: 'Kursvisning',
      description: 'Fullfør moduler i ditt eget tempo. Fremdrift lagres automatisk.',
    }
  }
  if (pathname.startsWith('/learning/flow')) {
    return {
      section: 'Påmelding',
      description: 'Åpne kurset fra lenke eller QR-kode og start der du skal.',
    }
  }
  if (pathname.startsWith('/learning/courses/')) {
    return {
      section: 'Kursbygger',
      description: 'Struktur, moduler, publisering og versjonering for dette kurset.',
    }
  }
  if (pathname.startsWith('/learning/courses')) {
    return {
      section: 'Kurs',
      description: 'Opprett og administrer kurs, tagger og publiseringsstatus.',
    }
  }
  if (pathname.startsWith('/learning/certifications')) {
    return {
      section: 'Sertifiseringer',
      description: 'Utstedte og fornybare sertifikater knyttet til fullførte kurs.',
    }
  }
  if (pathname.startsWith('/learning/insights')) {
    return {
      section: 'Innsikt',
      description: 'Aggregerte tall om gjennomføring og fullføring i organisasjonen.',
    }
  }
  if (pathname.startsWith('/learning/participants')) {
    return {
      section: 'Deltakere',
      description: 'Hvem som er påmeldt og hvor langt de har kommet.',
    }
  }
  if (pathname.startsWith('/learning/compliance')) {
    return {
      section: 'Team heatmap',
      description: 'Oversikt over opplæringsdekning per team eller avdeling.',
    }
  }
  if (pathname.startsWith('/learning/paths')) {
    return {
      section: 'Læringsstier',
      description: 'Koble kurs i rekkefølge for roller eller onboarding.',
    }
  }
  if (pathname.startsWith('/learning/external')) {
    return {
      section: 'Ekstern opplæring',
      description: 'Registrer opplæring utenfor plattformen for samsvar og oversikt.',
    }
  }
  if (pathname.startsWith('/learning/settings')) {
    return {
      section: 'Innstillinger',
      description: 'Preferanser og konfigurasjon for e-læringsmodulen.',
    }
  }
  return {
    section: 'E-læring',
    description: 'Kurs, sertifiseringer og rapportering.',
  }
}

export function LearningLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { section, description } = learningPageMeta(pathname)

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
    <div className="min-h-screen w-full" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <WorkplacePageHeading1
          breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'E-læring' }, { label: section }]}
          title="E-læring"
          description={description}
          menu={<HubMenu1Bar ariaLabel="E-læring — faner" items={learningHubItems} />}
        />
        <div className="mt-8">
          <Suspense
            fallback={
              <div className="flex min-h-[30vh] items-center justify-center text-sm text-neutral-400">
                Laster…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
