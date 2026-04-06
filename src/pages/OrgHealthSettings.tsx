import { Link } from 'react-router-dom'
import { Globe, ListTree, Shield } from 'lucide-react'

const roadmap = [
  {
    title: 'Arbeidstid og hviletid — bruddvarsling (AML kap. 10)',
    body:
      'Compliance-lag (ikke fullt vaktplan): API/webhook der kunder (f.eks. Tripletex/Visma) pusher timeaggregater til Supabase; nattlig jobb (pg_cron) sjekker bl.a. 11 t sammenhengende hvile og overtidsterskler (f.eks. 200 t/år uten tariffavtale). Ved brudd: automatisk rødt avvik på Kanban til HR.',
    status: 'Planlagt',
  },
  {
    title: 'Beredskapsøvelser og krisehåndtering (IK-f § 5 nr. 6)',
    body:
      'Egen modul for planlagte øvelser (brann, dataangrep, trussel m.m.), evaluering etterpå og låst arkiv som revisjonsbevis. Kritiske funn (f.eks. blokkert rømningsvei) kan trigge arbeidsflyt → oppfølgingsavvik.',
    status: 'Planlagt',
  },
  {
    title: 'Eksterne entreprenører og påseplikt (AML § 2-2 / § 6-3)',
    body:
      'Rolle external_contractor, tidsbegrenset magic link til underleverandørportal: HMS-erklæring, kjemikalieliste, HMS-kort — lagret org-spesifikt. Hovedbedrift ser samsvarsstatus (grønt merke) per leverandør på arbeidsplassen.',
    status: 'Planlagt',
  },
  {
    title: 'Bedriftshelsetjenesten (BHT) — integrasjon (AML § 3-3)',
    body:
      'Konsulent-innlogging med streng RLS: BHT ser kun avdelinger og planer bedriften eksplisitt deler. Årsplan for BHT i dokument-senter, signatur på deltakelse i ROS/vernerunder — dokumentert i internkontroll.',
    status: 'Planlagt',
  },
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
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#1a3d32] text-[#c9a227]">
            <ListTree className="size-7" />
          </div>
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

        <div className="mt-8 rounded-xl border border-sky-200/80 bg-sky-50/50 p-4">
          <h2 className="text-sm font-semibold text-sky-950">Forslag til implementasjon og hvordan vi starter</h2>
          <p className="mt-2 text-sm text-sky-950/85">
            Felles mønster: nye tabeller org-scoped + RLS, tillatelsesnøkler i{' '}
            <code className="rounded bg-white/80 px-1 text-xs">permissionKeys</code>, tynn UI-fane eller side som leser/skriver
            via eksisterende hooks-mønster. Start med én vertikal «spike» som beviser hele kjeden (DB → policy → én skjerm).
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-sky-950/85">
            <li>
              <strong>Fase 1 — datagrunnlag og revisjonsspor:</strong> migrasjon med tabeller (
              <em>work_time_daily_facts</em> eller tilsvarende for webhook-inndata;{' '}
              <em>emergency_drills</em> med evaluering JSON; <em>contractor_invites</em> + <em>contractor_submissions</em>;{' '}
              <em>bht_org_access</em> + kobling til mapper/dokumenter). Ingen tredjeparts-API ennå — manuell CSV/API-test fra
              Postman.
            </li>
            <li>
              <strong>Fase 2 — automatisering:</strong> koble arbeidsflyt-motoren (allerede i plattformen) og Kanban for
              varsler; <code className="rounded bg-white/80 px-1 text-xs">pg_cron</code> for nattlig AML kap. 10-sjekk når
              faktatabell fylles.
            </li>
            <li>
              <strong>Fase 3 — integrasjoner:</strong> signert webhook (HMAC) fra lønn/HR-system; BHT-portal med invitasjonslenke
              (samme mønster som underleverandør); eventuelt Edge Function for e-postkvittering.
            </li>
          </ol>
          <p className="mt-3 text-sm text-sky-950/85">
            <strong>Anbefalt første steg denne uken:</strong> skisser datamodell + RLS for{' '}
            <em>beredskapsøvelser</em> (minst friksjon, tydelig IK-f § 5 nr. 6-bevis) og én enkel liste «Planlagt /
            gjennomført» under internkontroll — deretter gjenbruk mønsteret på BHT og entreprenører.
          </p>
        </div>

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
