import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import { buildComplianceHubItems } from '../components/compliance/complianceHubMenu'
import { ModuleLegalBanner, ModuleSectionCard } from '../components/module'
import { IkHubView } from '../../modules/internkontroll/IkHubView'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'

const LEGAL = [
  {
    code: 'Internkontrollforskriften (FOR-1996-12-06-1127) § 5',
    text: 'Internkontroll innebærer at virksomheten skal kartlegge farer og problemer, vurdere risiko, og iverksette tiltak. § 5 nr. 1–8 angir åtte punktene for systematisk HMS-arbeid.',
  },
  {
    code: 'AML § 3-1',
    text: 'Arbeidsgiver skal sørge for systematisk arbeid med forebygging, oppfølging og dokumentasjon av HMS — internkontrollforskriften gir innholdet i kravet.',
  },
]

const PILLAR_DESCRIPTIONS: { nr: number; title: string; text: string; to: string }[] = [
  {
    nr: 1,
    title: 'HMS-mål og lovregister',
    text: 'Sørge for at virksomheten følger HMS-lovgivningen — lovregister og samsvarsvurdering.',
    to: '/internkontroll/lovregister',
  },
  {
    nr: 2,
    title: 'Kompetanse og opplæring',
    text: 'Arbeidstakere har tilstrekkelig kunnskap og ferdigheter, inkludert opplæring i HMS-arbeid.',
    to: '/internkontroll/kompetanse',
  },
  {
    nr: 3,
    title: 'Medvirkning',
    text: 'Arbeidstakere skal medvirke i HMS-arbeidet via verneombud, AMU og BHT.',
    to: '/internkontroll/medvirkning',
  },
  {
    nr: 4,
    title: 'HMS-mål',
    text: 'Fastsette mål for helse, miljø og sikkerhet — leading- og lagging-indikatorer.',
    to: '/internkontroll/mal',
  },
  {
    nr: 5,
    title: 'Organisering og ansvar',
    text: 'Skriftlig oversikt over hvordan virksomheten er organisert og fordeling av HMS-ansvar.',
    to: '/organisation',
  },
  {
    nr: 6,
    title: 'Kartlegging og risikovurdering',
    text: 'Kartlegge farer og problemer, vurdere risiko og utarbeide tilhørende planer.',
    to: '/internal-control?tab=ros',
  },
  {
    nr: 7,
    title: 'Avvikshåndtering',
    text: 'Forebygge brudd på HMS-lovgivningen — registrer, behandle og lukk avvik.',
    to: '/workplace-reporting/incidents',
  },
  {
    nr: 8,
    title: 'Systematisk overvåkning og gjennomgang',
    text: 'Årlig gjennomgang av internkontrollen og kontinuerlig forbedring (PDCA Check/Act).',
    to: '/internkontroll/arsgjenomgang',
  },
]

export function ComplianceInternforskriftenPage() {
  const { pillarStatuses, overallIkStatus, loading } = useInternkontroll()
  const hub = buildComplianceHubItems('internforskriften')

  return (
    <ComplianceModuleChrome
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar', to: '/compliance' }, { label: 'Internforskriften' }]}
      title="Internkontrollforskriften § 5"
      description={
        <>
          Operasjonell modenhet for de åtte punktene i § 5. Statusfargene gjenbrukes fra IK-modulen så
          tilstanden er synkron mellom HMS- og samsvarsperspektivet.
        </>
      }
      hubAriaLabel="Samsvar — moduler"
      hubItems={hub}
      contentCard={false}
    >
      <ModuleLegalBanner
        title="Internkontrollforskriften"
        intro="De åtte punktene som operasjonaliserer arbeidsgivers plikt til systematisk HMS-arbeid (AML § 3-1)."
        references={LEGAL}
      />

      <div className="mt-6 rounded-xl border border-neutral-200/80 bg-white p-5 md:p-6">
        <IkHubView pillarStatuses={pillarStatuses} overallIkStatus={overallIkStatus} loading={loading} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PILLAR_DESCRIPTIONS.map((p) => (
          <ModuleSectionCard key={p.nr} className="p-4 md:p-5">
            <header className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  § 5 nr. {p.nr}
                </p>
                <h3 className="text-base font-semibold text-neutral-900">{p.title}</h3>
              </div>
              <Link
                to={p.to}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200"
              >
                Åpne <ChevronRight className="size-3.5" />
              </Link>
            </header>
            <p className="text-sm text-neutral-600">{p.text}</p>
          </ModuleSectionCard>
        ))}
      </div>
    </ComplianceModuleChrome>
  )
}
