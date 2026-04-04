import { Link } from 'react-router-dom'
import { Globe, ListTree, Shield } from 'lucide-react'
import { ModulePageIcon } from '../components/ModulePageIcon'

const roadmap = [
  {
    title: 'Bedriftsomtale (company site)',
    body:
      'Egen informasjonsside for hele selskapet: åpen tilgang til anonym rapportering, valg og informasjon om arbeidsmiljøråd/HMS — uten innlogging i admin.',
    status: 'Planlagt',
  },
  {
    title: 'Internkontroll (nå: demo)',
    body:
      'Varslingssaker med status, ROS-mal og årsgjennomgang finnes under «Internkontroll» i appen — videreutvikles med roller, eksport og integrasjon mot BHT.',
    status: 'Pågår',
  },
  {
    title: 'E-post / SMS-varsler til HR',
    body: 'Automatiserte varsler ved nye anonyme henvendelser og terskel for oppfølging.',
    status: 'Planlagt',
  },
  {
    title: 'Integrasjon med ekstern varsling',
    body: 'API eller eksport til godkjente varslingskanaler der det kreves.',
    status: 'Utforskning',
  },
  {
    title: 'Roller og tilgangsstyring',
    body: 'Skille mellom medarbeider, verneombud, HR og leder i samme løsning.',
    status: 'Planlagt',
  },
]

export function OrgHealthSettings() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <Link to="/org-health" className="text-neutral-500 hover:text-[#1a3d32]">
          Organisasjonshelse
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Innstillinger</span>
      </nav>

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <ModulePageIcon className="bg-[#1a3d32] text-[#c9a227]">
            <ListTree className="size-9 md:size-10" strokeWidth={1.5} aria-hidden />
          </ModulePageIcon>
          <div>
            <h1
              className="text-2xl font-semibold text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Veikart (produkt)
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Planlagte og fremtidige funksjoner for organisasjonshelse og relaterte moduler. Dette er en intern
              oversikt — prioriteringer kan endres.
            </p>
          </div>
        </div>

        <ul className="mt-8 space-y-4">
          {roadmap.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-neutral-200/90 bg-[#faf8f4]/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-[#1a3d32]">{item.title}</h2>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <Globe className="size-5 shrink-0" />
            Bedriftsomtale — kort mål
          </div>
          <p className="mt-2 text-sm text-emerald-950/90">
            Én offentlig side der ansatte kan sende{' '}
            <strong>anonyme meldinger</strong>, lese om <strong>valg</strong> og{' '}
            <strong>arbeidsmiljøinformasjon</strong>, uten å se hele admin-fløyen. Kobles til eksisterende rapportering
            og representasjonsmoduler når teknisk klart.
          </p>
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
          <Shield className="size-4 shrink-0 mt-0.5" />
          Ikke juridisk rådgivning — tilpass rutiner og personvern mot egen DPA og internkontroll.
        </p>
      </div>
    </div>
  )
}
