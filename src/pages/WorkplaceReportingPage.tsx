import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, ClipboardList, FileText, HardHat, HeartPulse, ShieldAlert } from 'lucide-react'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD =
  'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300'
const HERO_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'

const links = [
  {
    to: '/reports',
    label: 'Rapporteringsmotor',
    desc: 'Standardrapporter, egendefinerte rapporter og verktøy (AMU, IK, ARP, personvern).',
    icon: BarChart3,
  },
  {
    to: '/hse?tab=incidents',
    label: 'Hendelser (HSE)',
    desc: 'Registrering og oppfølging av ulykker, nestenulykker og avvik.',
    icon: HardHat,
  },
  {
    to: '/hse?tab=inspections',
    label: 'Inspeksjoner',
    desc: 'Interne og eksterne inspeksjoner med sporbar dokumentasjon.',
    icon: ClipboardList,
  },
  {
    to: '/org-health?tab=reporting',
    label: 'Anonym rapportering (org.health)',
    desc: 'AML-relaterte kategorier uten lagring av fritekst — for strukturert varsling.',
    icon: ShieldAlert,
  },
  {
    to: '/tasks?view=whistle',
    label: 'Varslingssaker',
    desc: 'Oppfølging av varslingssaker i oppgaver (komité / admin).',
    icon: AlertTriangle,
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

      <header className="border-b border-neutral-200/80 pb-8">
        <h1
          className="text-2xl font-semibold text-neutral-900 md:text-3xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Arbeidsplassrapportering
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
          Samlet inngang til rapportering fra arbeidsplassen: hendelser, inspeksjoner, anonyme kanaler, samsvar og
          lovpålagte utdata. Koblingene under peker til eksisterende moduler — alt er fortsatt organisasjonsavgrenset.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to} className={CARD}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-none bg-[#1a3d32]/10 text-[#1a3d32]">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-900">{label}</h2>
                <p className="mt-1 text-sm text-neutral-600">{desc}</p>
                <span className={`${HERO_BTN} mt-4`}>Åpne →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-none border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
        <strong>Tips:</strong> For full rapportmotor og datasett, bruk <Link to="/reports" className="underline">Rapporter</Link>{' '}
        under Workspace. Denne siden er et hurtigknutepunkt for HMS- og compliance-rapportering i bred forstand.
      </div>
    </div>
  )
}
