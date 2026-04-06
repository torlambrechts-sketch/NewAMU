import { Link } from 'react-router-dom'
import { FileWarning, GitBranch, Scale } from 'lucide-react'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TILE = 'rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition hover:border-[#1a3d32]/30'

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
  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">HR & rettssikkerhet</span>
      </nav>

      <div className="flex flex-wrap items-start gap-6 border-b border-neutral-200/80 pb-8">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#1a3d32] text-[#c9a227]">
          <Scale className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            HR & rettssikkerhet
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Skjemaer og sporbarhet for de tyngste AML-prosessene. Tilgang styres strengt i databasen (RLS) — verneombud ser
            ikke drøftelsessamtaler med mindre de er innkalt som tillitsvalgt.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(({ to, title, desc, icon: Icon }) => (
          <Link key={to} to={to} className={TILE}>
            <Icon className="mb-3 size-8 text-[#1a3d32]" />
            <h2 className="font-semibold text-neutral-900">{title}</h2>
            <p className="mt-2 text-sm text-neutral-600">{desc}</p>
            <span className="mt-4 inline-block text-sm font-medium text-[#1a3d32]">Åpne →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
