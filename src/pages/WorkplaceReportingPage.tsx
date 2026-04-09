import { Link } from 'react-router-dom'
import { WORKPLACE_REPORTING_NAV } from '../data/workplaceReportingNav'
import { WorkplaceReportingCasesSection } from '../components/workplace/WorkplaceReportingCasesSection'
import { WorkplaceReportingHubMenu } from '../components/workplace/WorkplaceReportingHubMenu'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD =
  'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300'
const HERO_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'

export function WorkplaceReportingPage() {
  return (
    <div className={PAGE}>
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Arbeidsplassrapportering</span>
      </nav>

      <header className="border-b border-neutral-200/80 pb-6">
        <h1
          className="text-2xl font-semibold text-neutral-900 md:text-3xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Arbeidsplassrapportering
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
          Meldinger fra arbeidsplassen: hendelser, anonym kanal og varslingssaker — pluss rapporter, inspeksjoner og
          samsvar. Samme undermeny som i navigasjonen (som under HSE).
        </p>
      </header>

      <div className="mt-6">
        <WorkplaceReportingHubMenu />
      </div>

      <WorkplaceReportingCasesSection />

      <section id="oversikt" className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Innganger og verktøy</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKPLACE_REPORTING_NAV.map(({ to, label, desc, icon: Icon }) => (
            <Link key={to} to={to} className={CARD}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-none bg-[#1a3d32]/10 text-[#1a3d32]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-900">{label}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{desc}</p>
                  <span className={`${HERO_BTN} mt-4`}>Åpne →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-none border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
        <strong>Tips:</strong> Hendelsesregisteret ligger nå her (ikke lenger som egen fane under HSE). Gamle lenker til{' '}
        <code className="rounded-none bg-white/80 px-1 text-xs">/hse?tab=incidents</code> omdirigeres automatisk.
      </div>
    </div>
  )
}
