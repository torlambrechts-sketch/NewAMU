import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import { buildComplianceHubItems } from '../components/compliance/complianceHubMenu'
import { ModuleLegalBanner, ModuleSectionCard } from '../components/module'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { useHse } from '../hooks/useHse'
import { useInternalControl } from '../hooks/useInternalControl'
import { useHrCompliance } from '../hooks/useHrCompliance'

type AmlChapterTopic = {
  paragraf: string
  topic: string
  /** Where this requirement is operationalised in the product. */
  modules: { label: string; to: string }[]
}

type AmlChapter = {
  number: number
  title: string
  topics: AmlChapterTopic[]
}

/**
 * Map of arbeidsmiljølovens kapitler 1–20 to the modules that implement
 * each duty. Used as the cross-reference matrix on /compliance/aml.
 *
 * Refs are to the chapter / paragraph numbering in arbeidsmiljøloven (2005-06-17 nr. 62).
 */
const AML_CHAPTERS: AmlChapter[] = [
  {
    number: 1,
    title: 'Innledende bestemmelser',
    topics: [
      { paragraf: '§ 1-1', topic: 'Lovens formål', modules: [] },
      { paragraf: '§ 1-2', topic: 'Hvem loven gjelder', modules: [{ label: 'Organisasjon', to: '/organisation' }] },
    ],
  },
  {
    number: 2,
    title: 'Arbeidsgivers og arbeidstakers plikter',
    topics: [
      { paragraf: '§ 2-1', topic: 'Arbeidsgivers plikter', modules: [{ label: 'Internkontroll', to: '/internkontroll' }] },
      { paragraf: '§ 2-3', topic: 'Arbeidstakers medvirkning', modules: [{ label: 'Medvirkning', to: '/internkontroll/medvirkning' }] },
      { paragraf: '§ 2-4 / 2-5', topic: 'Varsling og vern mot gjengjeldelse', modules: [{ label: 'Varslingssaker', to: '/workplace-reporting' }] },
      { paragraf: '§ 2 A', topic: 'Anonyme henvendelser', modules: [{ label: 'Anonym AML', to: '/workplace-reporting/anonymous-aml' }] },
    ],
  },
  {
    number: 3,
    title: 'Virkemidler i arbeidsmiljøarbeidet',
    topics: [
      { paragraf: '§ 3-1', topic: 'Krav til systematisk HMS-arbeid', modules: [{ label: 'Internkontroll', to: '/internkontroll' }, { label: 'ROS', to: '/internal-control?tab=ros' }] },
      { paragraf: '§ 3-2', topic: 'Opplæring av arbeidstakere', modules: [{ label: 'Kompetanse', to: '/internkontroll/kompetanse' }] },
      { paragraf: '§ 3-3', topic: 'Bedriftshelsetjeneste', modules: [{ label: 'Medvirkning', to: '/internkontroll/medvirkning' }] },
      { paragraf: '§ 3-4', topic: 'Vurdering av tiltak for fysisk aktivitet (godkjent BHT)', modules: [{ label: 'Medvirkning', to: '/internkontroll/medvirkning' }] },
      { paragraf: '§ 3-5', topic: '40 t HMS-kurs for arbeidsgiver', modules: [{ label: 'Kompetanse', to: '/internkontroll/kompetanse' }] },
      { paragraf: '§ 3-6', topic: 'Plikt til å legge forholdene til rette for varsling', modules: [{ label: 'Varslingssaker', to: '/workplace-reporting' }] },
    ],
  },
  {
    number: 4,
    title: 'Krav til arbeidsmiljøet',
    topics: [
      { paragraf: '§ 4-1', topic: 'Generelle krav til arbeidsmiljøet', modules: [{ label: 'HSE', to: '/hse' }] },
      { paragraf: '§ 4-2', topic: 'Tilrettelegging og medvirkning', modules: [{ label: 'Medvirkning', to: '/internkontroll/medvirkning' }] },
      { paragraf: '§ 4-3', topic: 'Psykososialt arbeidsmiljø', modules: [{ label: 'Organisasjonshelse', to: '/org-health' }] },
      { paragraf: '§ 4-4', topic: 'Fysisk arbeidsmiljø', modules: [{ label: 'Vernerunder', to: '/hse' }] },
      { paragraf: '§ 4-5', topic: 'Kjemisk og biologisk helsefare', modules: [{ label: 'SJA', to: '/hse' }] },
      { paragraf: '§ 4-6', topic: 'Tilrettelegging ved sykdom (NAV-frister)', modules: [{ label: 'HSE — sykefravær', to: '/hse' }] },
    ],
  },
  {
    number: 5,
    title: 'Registrering og melding',
    topics: [
      { paragraf: '§ 5-1', topic: 'Registrering av skader og sykdom', modules: [{ label: 'Avvik', to: '/workplace-reporting/incidents' }] },
      { paragraf: '§ 5-2', topic: 'Melding til Arbeidstilsynet ved alvorlig skade', modules: [{ label: 'Avvik', to: '/workplace-reporting/incidents' }] },
    ],
  },
  {
    number: 6,
    title: 'Verneombud',
    topics: [
      { paragraf: '§ 6-1', topic: 'Plikt til å velge verneombud', modules: [{ label: 'Verneombud', to: '/internkontroll/medvirkning' }] },
      { paragraf: '§ 6-2', topic: 'Verneombudets oppgaver', modules: [{ label: 'AMU/VO', to: '/meetings' }] },
      { paragraf: '§ 6-3', topic: 'Stansingsrett', modules: [{ label: 'Avvik', to: '/workplace-reporting/incidents' }] },
      { paragraf: '§ 6-4', topic: 'Verneombud velges av arbeidstakerne', modules: [{ label: 'AMU-valg', to: '/internkontroll/amu-valg' }] },
      { paragraf: '§ 6-5', topic: 'Opplæring av verneombud', modules: [{ label: 'Kompetanse', to: '/internkontroll/kompetanse' }] },
    ],
  },
  {
    number: 7,
    title: 'Arbeidsmiljøutvalg',
    topics: [
      { paragraf: '§ 7-1', topic: 'Plikt til å opprette AMU', modules: [{ label: 'AMU', to: '/meetings' }] },
      { paragraf: '§ 7-2', topic: 'AMUs oppgaver', modules: [{ label: 'AMU', to: '/meetings' }] },
      { paragraf: '§ 7-3', topic: 'Særskilte lokale forhold', modules: [{ label: 'AMU', to: '/meetings' }] },
    ],
  },
  {
    number: 8,
    title: 'Informasjon og drøfting',
    topics: [
      { paragraf: '§ 8-1 til 8-3', topic: 'Plikt til informasjon og drøfting i virksomheter > 50 ansatte', modules: [{ label: 'HR — drøfting', to: '/hr/consultation' }] },
    ],
  },
  {
    number: 9,
    title: 'Kontrolltiltak i virksomheten',
    topics: [
      { paragraf: '§ 9-1 til 9-5', topic: 'Vilkår for og drøfting av kontrolltiltak', modules: [{ label: 'HR — drøfting', to: '/hr/consultation' }, { label: 'Dokumenter', to: '/documents' }] },
    ],
  },
  {
    number: 10,
    title: 'Arbeidstid',
    topics: [
      { paragraf: '§ 10-1 til 10-12', topic: 'Alminnelig arbeidstid, overtid, hvile, søn-/helgedager', modules: [{ label: 'HRM', to: '/hrm/employees' }] },
    ],
  },
  {
    number: 11,
    title: 'Arbeid av barn og ungdom',
    topics: [{ paragraf: '§ 11-1 til 11-5', topic: 'Aldersgrenser og særskilte verneregler', modules: [{ label: 'HRM', to: '/hrm/employees' }] }],
  },
  {
    number: 12,
    title: 'Rett til permisjon',
    topics: [{ paragraf: '§ 12-1 til 12-15', topic: 'Foreldrepermisjon, omsorgs-/utdanningspermisjon', modules: [{ label: 'HRM', to: '/hrm/employees' }] }],
  },
  {
    number: 13,
    title: 'Vern mot diskriminering',
    topics: [
      { paragraf: '§ 13-1 til 13-10', topic: 'Diskriminering, trakassering og likebehandling', modules: [{ label: 'HR — drøfting', to: '/hr/consultation' }, { label: 'Organisasjonshelse', to: '/org-health' }] },
    ],
  },
  {
    number: 14,
    title: 'Ansettelse mv.',
    topics: [
      { paragraf: '§ 14-5', topic: 'Krav til skriftlig arbeidsavtale', modules: [{ label: 'Dokumenter', to: '/documents' }] },
      { paragraf: '§ 14-6', topic: 'Minimumskrav til innholdet i arbeidsavtalen', modules: [{ label: 'Dokumenter', to: '/documents' }] },
      { paragraf: '§ 14-9', topic: 'Midlertidig ansettelse', modules: [{ label: 'HRM', to: '/hrm/employees' }] },
      { paragraf: '§ 14-12', topic: 'Innleie fra bemanningsbyrå', modules: [{ label: 'HRM', to: '/hrm/employees' }] },
    ],
  },
  {
    number: 15,
    title: 'Opphør av arbeidsforhold',
    topics: [
      { paragraf: '§ 15-1', topic: 'Drøftelsessamtale før oppsigelse', modules: [{ label: 'HR — drøftelse', to: '/hr/discussion' }] },
      { paragraf: '§ 15-2', topic: 'Drøfting ved masseoppsigelse', modules: [{ label: 'HR — drøfting', to: '/hr/consultation' }] },
      { paragraf: '§ 15-7 til 15-13', topic: 'Saklig grunn, formkrav og rettighetsfrister', modules: [{ label: 'HR — drøftelse', to: '/hr/discussion' }] },
    ],
  },
  {
    number: 16,
    title: 'Virksomhetsoverdragelse',
    topics: [{ paragraf: '§ 16-1 til 16-7', topic: 'Lønns- og arbeidsvilkår, drøftingsplikt', modules: [{ label: 'HR — drøfting', to: '/hr/consultation' }] }],
  },
  {
    number: 17,
    title: 'Tvister om arbeidsforhold',
    topics: [{ paragraf: '§ 17-1 til 17-6', topic: 'Behandlingsregler', modules: [] }],
  },
  {
    number: 18,
    title: 'Tilsyn og tvangsmidler',
    topics: [{ paragraf: '§ 18-1 til 18-11', topic: 'Arbeidstilsynets myndighet og pålegg', modules: [{ label: 'Avvik', to: '/workplace-reporting/incidents' }] }],
  },
  {
    number: 19,
    title: 'Straff',
    topics: [{ paragraf: '§ 19-1 til 19-7', topic: 'Straffeansvar', modules: [] }],
  },
  {
    number: 20,
    title: 'Avsluttende bestemmelser',
    topics: [{ paragraf: '§ 20-1 til 20-3', topic: 'Ikrafttredelse og overgang', modules: [] }],
  },
]

const LEGAL = [
  {
    code: 'Arbeidsmiljøloven (2005-06-17 nr. 62)',
    text: 'Loven skal sikre et arbeidsmiljø som gir grunnlag for en helsefremmende og meningsfylt arbeidssituasjon (§ 1-1).',
  },
]

export function ComplianceAmlPage() {
  const ic = useInternalControl()
  const ik = useInternkontroll()
  const hse = useHse()
  const hr = useHrCompliance()
  const hub = buildComplianceHubItems('aml')

  const [query, setQuery] = useState('')

  /** Coverage signals — chapter is "covered" if at least one operative artefact exists. */
  const coverage = useMemo(() => {
    const m: Record<number, { covered: boolean; signal: string }> = {}
    const rosCount = ic.rosAssessments.length
    const annualReady = ic.annualReviews.length > 0
    const apOpen = ik.actionPlans.filter((p) => p.status === 'open' || p.status === 'in_progress').length
    const insp = hse.stats.openInspections + hse.stats.runsOpen

    m[2] = { covered: ik.orgRoles.length > 0, signal: `${ik.orgRoles.length} roller` }
    m[3] = { covered: rosCount > 0 || annualReady, signal: `${rosCount} ROS · ${annualReady ? 'årsgj. aktiv' : 'ingen årsgj.'}` }
    m[4] = { covered: insp > 0 || hse.stats.rounds > 0, signal: `${insp} åpne tilsyn · ${hse.stats.rounds} runder` }
    m[5] = { covered: hse.stats.incidents > 0, signal: `${hse.stats.incidents} hendelser` }
    m[6] = { covered: ik.orgRoles.some((r) => r.role_key.startsWith('verne')), signal: 'verneombud-roller' }
    m[7] = { covered: ik.orgRoles.some((r) => r.role_key.startsWith('amu')), signal: 'AMU-roller' }
    m[8] = { covered: hr.cases.length > 0, signal: `${hr.cases.length} drøftingssaker` }
    m[15] = { covered: hr.meetings.length > 0, signal: `${hr.meetings.length} drøftelser` }
    m[18] = { covered: apOpen > 0, signal: `${apOpen} aktive tiltak` }
    return m
  }, [ic, ik, hse.stats, hr])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return AML_CHAPTERS
    return AML_CHAPTERS.map((c) => ({
      ...c,
      topics: c.topics.filter((t) =>
        `${c.title} ${t.paragraf} ${t.topic}`.toLowerCase().includes(q),
      ),
    })).filter((c) => c.topics.length > 0)
  }, [query])

  return (
    <ComplianceModuleChrome
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar', to: '/compliance' }, { label: 'AML — kapitler' }]}
      title="AML — kapitler 1–20"
      description={
        <>
          Krysstabell over arbeidsmiljølovens kapitler og hvilke moduler i Atics som operasjonaliserer hvert
          krav. Kolonnen «Dekning» viser om vi har data i tilhørende modul i dag.
        </>
      }
      hubAriaLabel="Samsvar — moduler"
      hubItems={hub}
      contentCard={false}
    >
      <ModuleLegalBanner
        title="Arbeidsmiljøloven"
        intro="Hvert kapittel viser de mest sentrale plikter og hvor de håndteres i plattformen."
        references={LEGAL}
      />

      <div className="mt-4">
        <label htmlFor="aml-search" className="sr-only">
          Søk
        </label>
        <input
          id="aml-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk i kapittel, paragraf eller tema…"
          className="w-full max-w-md rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {filtered.map((ch) => {
          const cov = coverage[ch.number]
          return (
            <ModuleSectionCard key={ch.number} className="p-4 md:p-5">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Kapittel {ch.number}
                  </p>
                  <h3 className="text-base font-semibold text-neutral-900">{ch.title}</h3>
                </div>
                {cov ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      cov.covered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${cov.covered ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {cov.covered ? cov.signal : 'Dekning mangler data'}
                  </span>
                ) : null}
              </header>
              <ul className="divide-y divide-neutral-100 text-sm">
                {ch.topics.map((t) => (
                  <li key={t.paragraf} className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">
                        <span className="text-neutral-500">{t.paragraf}</span> {t.topic}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.modules.length === 0 ? (
                        <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                          Ikke automatisert
                        </span>
                      ) : (
                        t.modules.map((m) => (
                          <Link
                            key={m.to}
                            to={m.to}
                            className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            {m.label}
                            <ChevronRight className="size-3" />
                          </Link>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ModuleSectionCard>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-500">Ingen treff på søket.</p>
      ) : null}
    </ComplianceModuleChrome>
  )
}
