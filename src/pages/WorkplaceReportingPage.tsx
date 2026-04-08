import { Link, NavLink } from 'react-router-dom'
import { AlertTriangle, BarChart3, ClipboardList, FileText, HardHat, HeartPulse, LayoutList, ShieldAlert } from 'lucide-react'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD =
  'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300'
const HERO_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'

const primaryMenu = [
  {
    to: '/hse?tab=incidents',
    label: 'Hendelser (HSE)',
    desc: 'Ulykker, nestenulykker og avvik.',
    icon: HardHat,
  },
  {
    to: '/org-health?tab=reporting',
    label: 'Anonym rapportering',
    desc: 'AML-kategorier uten lagring av fritekst.',
    icon: ShieldAlert,
  },
  {
    to: '/tasks?view=whistle',
    label: 'Varslingssaker',
    desc: 'Oppfølging i oppgaver (komité / admin).',
    icon: AlertTriangle,
  },
] as const

const moreLinks = [
  {
    to: '/reports',
    label: 'Rapporteringsmotor',
    desc: 'Standardrapporter, egendefinerte rapporter og verktøy (AMU, IK, ARP, personvern).',
    icon: BarChart3,
  },
  {
    to: '/hse?tab=inspections',
    label: 'Inspeksjoner',
    desc: 'Interne og eksterne inspeksjoner med sporbar dokumentasjon.',
    icon: ClipboardList,
  },
  {
    to: '/org-health?tab=metrics',
    label: 'AML-indikatorer',
    desc: 'Indikatorer knyttet til arbeidsmiljøloven og internkontroll.',
    icon: HeartPulse,
  },
  {
    to: '/documents/compliance',
    label: 'Samsvar (dokumenter)',
    desc: 'Oversikt over dokumenter, revisjoner og «lest og forstått».',
    icon: FileText,
  },
] as const

function menuLinkClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-none border px-4 py-2.5 text-sm font-medium transition ${
    active
      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400'
  }`
}

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
          Meldinger fra arbeidsplassen: hendelser, anonym kanal og varslingssaker — pluss snarveier til rapporter og
          samsvar. Alt er organisasjonsavgrenset.
        </p>
      </header>

      <nav
        className="mt-6 flex flex-col gap-3 border-b border-neutral-200/80 pb-6 sm:flex-row sm:flex-wrap sm:items-center"
        aria-label="Arbeidsplassrapportering"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <LayoutList className="size-4" aria-hidden />
          Meny
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-2">
          <NavLink to="/workplace-reporting" end className={({ isActive }) => menuLinkClass(isActive)}>
            Oversikt
          </NavLink>
          {primaryMenu.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => menuLinkClass(isActive)}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <section id="oversikt" className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Hovedinnganger</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {primaryMenu.map(({ to, label, desc, icon: Icon }) => (
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

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Flere verktøy</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {moreLinks.map(({ to, label, desc, icon: Icon }) => (
            <Link key={to} to={to} className={CARD}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-none bg-neutral-100 text-neutral-700">
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
        <strong>Tips:</strong> Undermenyen speiler hovedpunktene i navigasjonen til venstre / under gruppen
        «Arbeidsplassrapportering». For full rapportmotor, bruk også{' '}
        <Link to="/reports" className="underline">
          Rapporter
        </Link>{' '}
        under Workspace.
      </div>
    </div>
  )
}
