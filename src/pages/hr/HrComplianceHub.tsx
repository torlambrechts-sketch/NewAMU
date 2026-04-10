import { Link, useLocation } from 'react-router-dom'
import { FileWarning, GitBranch, Scale } from 'lucide-react'
import { ComplianceModuleChrome } from '../../components/compliance/ComplianceModuleChrome'
import { PostingsStyleSurface } from '../../components/tasks/tasksPostingsLayout'
import { hrComplianceHubItems } from './hrComplianceHubNav'

const TILE =
  'group flex flex-col rounded-md border border-neutral-200/90 bg-white p-6 shadow-sm transition hover:border-[#1a3d32]/35'

const LINKS = [
  {
    to: '/hr/discussion',
    title: 'Drøftelsessamtale (AML § 15-1)',
    desc: 'Sjekkliste, referat uten oppsigelseskonklusjon, signatur og tidslås (SHA-256).',
    icon: FileWarning,
  },
  {
    to: '/hr/consultation',
    title: 'Informasjon og drøfting (AML kap. 8)',
    desc: 'Drøftingssaker med tillitsvalgte — protokoll og kommentarer (50+ ansatte).',
    icon: Scale,
  },
  {
    to: '/hr/o-ros',
    title: 'Organisatorisk ROS (O-ROS)',
    desc: 'Mal for omstrukturering; tvungen AMU/VO-signatur før godkjenning (kobles til internkontroll).',
    icon: GitBranch,
  },
] as const

export function HrComplianceHub() {
  const { pathname } = useLocation()

  return (
    <ComplianceModuleChrome
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Samsvar', to: '/compliance' },
        { label: 'HR & rettssikkerhet' },
      ]}
      title="HR & rettssikkerhet"
      description={
        <p className="max-w-3xl">
          Skjemaer og sporbarhet for de tyngste AML-prosessene. Tilgang styres strengt i databasen (RLS) — verneombud ser ikke
          drøftelsessamtaler med mindre de er innkalt som tillitsvalgt.
        </p>
      }
      hubAriaLabel="HR & rettssikkerhet — faner"
      hubItems={hrComplianceHubItems(pathname)}
    >
      <PostingsStyleSurface className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Moduler</p>
          <p className="mt-1 text-sm text-neutral-600">Velg et spor under — samme funksjonalitet som tidligere.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          {LINKS.map(({ to, title, desc, icon: Icon }) => (
            <Link key={to} to={to} className={TILE}>
              <Icon className="mb-3 size-8 text-[#1a3d32]" />
              <h2 className="font-semibold text-neutral-900">{title}</h2>
              <p className="mt-2 text-sm text-neutral-600">{desc}</p>
              <span className="mt-4 text-sm font-semibold text-[#1a3d32] group-hover:underline">Åpne →</span>
            </Link>
          ))}
        </div>
      </PostingsStyleSurface>
    </ComplianceModuleChrome>
  )
}
