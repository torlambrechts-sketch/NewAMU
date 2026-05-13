// VekstPatternGallery — design-system-skinne for Vekst-stilen.
// Viser hvordan den varme, illustrerte estetikken fra
// Arbeidsmiljøstrategi-siden kan brukes på tre vanlige content-typer:
// tabell, undersøkelse, og dashboard. Brukes som referanse-side for
// designere/PMs som vurderer å rulle ut samme estetikk på flere
// flater.
//
// Lever som platform-admin-flate i tråd med eksisterende
// PlatformPinpointLayoutsPage og PlatformLayoutTemplatesPage.

import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Eye, Heart, Pencil, Printer } from 'lucide-react'
import { TableVekst, TableVekstChip, type TableVekstColumn } from '../wellbeing/layouts/TableVekst'
import { SurveyVekst, type SurveyVekstSection } from '../wellbeing/layouts/SurveyVekst'
import {
  DashboardVekst,
  type DashboardVekstActivityRow,
  type DashboardVekstKpi,
  type DashboardVekstTrend,
} from '../wellbeing/layouts/DashboardVekst'
import { TimelineVekst, type TimelineVekstEntry } from '../wellbeing/layouts/TimelineVekst'
import { OnboardingVekst, type OnboardingVekstStep } from '../wellbeing/layouts/OnboardingVekst'
import { CardStackVekst, type CardStackVekstCard } from '../wellbeing/layouts/CardStackVekst'

const SERIF = "'Libre Baskerville', Georgia, serif"

// ── Seedet demo-data ──────────────────────────────────────────────────────

type FindingRow = {
  id: string
  title: string
  axis: 'Trygghet' | 'Trivsel' | 'Medvirkning' | 'Mestring'
  severity: 'Lav' | 'Medium' | 'Høy' | 'Kritisk'
  registered: string
  owner: string
  status: 'Åpen' | 'Under arbeid' | 'Lukket'
}

const FINDINGS_DEMO: FindingRow[] = [
  { id: '1', title: 'Mangelfull merking i kjølerom B', axis: 'Trygghet', severity: 'Høy', registered: '12. mai', owner: 'Mona V.', status: 'Under arbeid' },
  { id: '2', title: 'Lav svarprosent på psykososial Q1', axis: 'Trivsel', severity: 'Medium', registered: '08. mai', owner: 'AMU-leder', status: 'Åpen' },
  { id: '3', title: 'Verneombud ikke valgt i Bergen', axis: 'Medvirkning', severity: 'Høy', registered: '05. mai', owner: 'HR', status: 'Åpen' },
  { id: '4', title: 'HMS-grunnopplæring 40t — 3 nyansatte mangler', axis: 'Mestring', severity: 'Medium', registered: '02. mai', owner: 'Personalavd.', status: 'Under arbeid' },
  { id: '5', title: 'Trapp 3 mangler antiskli — observasjon', axis: 'Trygghet', severity: 'Lav', registered: '01. mai', owner: 'Vaktmester', status: 'Lukket' },
  { id: '6', title: 'Nestenulykke truck — søyle 14', axis: 'Trygghet', severity: 'Kritisk', registered: '28. apr', owner: 'Jens R.', status: 'Under arbeid' },
  { id: '7', title: 'Mobbing-flagg i NAQ-R+ Q2', axis: 'Trivsel', severity: 'Kritisk', registered: '25. apr', owner: 'Bedriftshelse', status: 'Under arbeid' },
  { id: '8', title: 'AMU Q2-møte savner ungdomsrepresentant', axis: 'Medvirkning', severity: 'Lav', registered: '22. apr', owner: 'AMU-leder', status: 'Lukket' },
]

const SEVERITY_TONE: Record<FindingRow['severity'], 'warm' | 'cool' | 'forest' | 'neutral'> = {
  Lav: 'forest',
  Medium: 'warm',
  Høy: 'cool',
  Kritisk: 'cool',
}

const STATUS_TONE: Record<FindingRow['status'], 'warm' | 'cool' | 'forest' | 'neutral'> = {
  Åpen: 'warm',
  'Under arbeid': 'neutral',
  Lukket: 'forest',
}

const FINDINGS_COLUMNS: TableVekstColumn<FindingRow>[] = [
  { key: 'title', label: 'Funn', render: (r) => <span className="font-semibold text-[#1a3d32]">{r.title}</span> },
  { key: 'axis', label: 'Akse', width: '140px', render: (r) => <span className="text-[#516760]">{r.axis}</span> },
  {
    key: 'severity',
    label: 'Alvorlighet',
    width: '120px',
    render: (r) => <TableVekstChip tone={SEVERITY_TONE[r.severity]}>{r.severity}</TableVekstChip>,
  },
  { key: 'registered', label: 'Registrert', width: '120px', render: (r) => <span className="text-[#516760]">{r.registered}</span> },
  { key: 'owner', label: 'Ansvarlig', width: '140px', render: (r) => <span className="text-[#1a3d32]">{r.owner}</span> },
  {
    key: 'status',
    label: 'Status',
    width: '130px',
    render: (r) => <TableVekstChip tone={STATUS_TONE[r.status]}>{r.status}</TableVekstChip>,
  },
]

const SURVEY_SECTIONS: SurveyVekstSection[] = [
  {
    id: 'trivsel',
    title: 'Hvordan har du det på jobb?',
    axisKey: 'trivsel',
    intro: 'Svarene dine kobles aldri til navnet ditt. Vi viser ingen resultat med mindre minst ti har svart innenfor samme enhet.',
    questions: [
      {
        id: 'energi',
        text: 'Jeg gleder meg til å gå på jobb om morgenen.',
        scale: { kind: 'likert5', min: 'Aldri', max: 'Daglig' },
      },
      {
        id: 'sett',
        text: 'Jeg kjenner at lederen min ser meg når jeg trenger det.',
        helper: 'Tenk på de siste fire ukene.',
        scale: { kind: 'likert5', min: 'Nesten aldri', max: 'Veldig ofte' },
      },
    ],
  },
  {
    id: 'medvirkning',
    title: 'Får stemmen din plass?',
    axisKey: 'medvirkning',
    intro: 'AMU-arbeid kan kun bære frukter når vi vet hva som faktisk skjer ute i teamene.',
    questions: [
      {
        id: 'horing',
        text: 'Jeg vet hvor jeg sier fra hvis noe er utrygt.',
        scale: { kind: 'binary', yes: 'Ja, jeg vet hvor', no: 'Nei, usikker' },
      },
      {
        id: 'fritekst',
        text: 'Er det noe du vil at AMU skal vite — som ikke fanges av spørsmålene over?',
        helper: 'Fritekst er valgfritt. Vi leser hver eneste linje.',
        scale: { kind: 'text' },
      },
    ],
  },
]

const KPIS_DEMO: DashboardVekstKpi[] = [
  { id: 'idx', label: 'Arbeidsmiljø-indeks', value: 72, sub: 'Vektet snitt av fire akser', delta: '+3', motif: 'trivsel' },
  { id: 'svar', label: 'Svarprosent siste pulsen', value: '64 %', sub: '231 av 360 ansatte', delta: '+8 %', motif: 'medvirkning' },
  { id: 'kurs', label: 'HMS-kurs fullført i år', value: 88, sub: 'av 102 tildelte', delta: '+12', motif: 'mestring' },
  { id: 'funn', label: 'Åpne vernerunde-funn', value: 9, sub: 'hvorav 2 kritiske', delta: '−3', motif: 'trygghet' },
]

const TREND_DEMO: DashboardVekstTrend = {
  title: 'Indeksen vår, måned for måned',
  description: 'Tolv måneder med våre månedlige snapshots. Lille dypp i januar, jevn vekst gjennom våren.',
  points: [
    { x: 'jun 25', y: 58, hasData: true },
    { x: 'jul 25', y: 60, hasData: true },
    { x: 'aug 25', y: 59, hasData: true },
    { x: 'sep 25', y: 63, hasData: true },
    { x: 'okt 25', y: 65, hasData: true },
    { x: 'nov 25', y: 64, hasData: true },
    { x: 'des 25', y: 61, hasData: true },
    { x: 'jan 26', y: 56, hasData: true },
    { x: 'feb 26', y: 62, hasData: true },
    { x: 'mar 26', y: 67, hasData: true },
    { x: 'apr 26', y: 69, hasData: true },
    { x: 'mai 26', y: 72, hasData: true },
  ],
}

const ACTIVITY_DEMO: DashboardVekstActivityRow[] = [
  { id: '1', when: '13. mai · i dag', what: 'AMU Q2-møte gjennomført — vedtok tre tiltak knyttet til psykososial pulsmåling.', who: 'AMU', motif: 'medvirkning', tone: 'warm' },
  { id: '2', when: '11. mai', what: '88 HMS-kurs fullført denne måneden. Tre kurs står til resertifisering før juli.', who: 'Personalavd.', motif: 'mestring', tone: 'forest' },
  { id: '3', when: '07. mai', what: 'Vernerunde gjennomført i Bergen-avdelingen — to nye funn registrert, ett lukket umiddelbart.', who: 'Verneombud Bergen', motif: 'trygghet', tone: 'warm' },
  { id: '4', when: '02. mai', what: 'Pulsmåling sendt til alle 360 ansatte — første svar registrert samme ettermiddag.', who: 'HR', motif: 'trivsel', tone: 'forest' },
]

// ── Timeline demo ────────────────────────────────────────────────────────

const TIMELINE_DEMO: TimelineVekstEntry[] = [
  {
    id: '1',
    date: 'Mai 2026 · i dag',
    title: 'AMU Q2-møtet — tre tiltak vedtatt',
    body: 'Lederne forplikter seg til to ekstra 1:1-er per måned, og psykososial pulsmåling utvides til Bergen-kontoret.',
    motif: 'medvirkning',
    tone: 'warm',
    chips: [
      { label: 'AMU', tone: 'warm' },
      { label: 'Psykososial', tone: 'forest' },
    ],
    cta: { label: 'Se protokoll', to: '/meetings' },
  },
  {
    id: '2',
    date: 'April 2026',
    title: 'Pulsmåling lukket — 64% svarprosent',
    body: 'NAQ-R+ avdekket et mobbing-flagg i én avdeling. Bedriftshelsetjenesten er involvert; tiltak ligger nå i handlingskøen.',
    motif: 'trivsel',
    tone: 'cool',
    chips: [{ label: '64 % svar', tone: 'forest' }, { label: 'Flagg', tone: 'cool' }],
  },
  {
    id: '3',
    date: 'Mars 2026',
    title: 'Verneombud-valg fullført i syv av åtte avdelinger',
    body: 'Bergen-avdelingen mangler fortsatt valgt verneombud — er reist som fokusområde til Q3.',
    motif: 'medvirkning',
    tone: 'warm',
  },
  {
    id: '4',
    date: 'Februar 2026',
    title: '40-timers HMS-grunnopplæring oppfrisket',
    body: 'Ny modul om psykososialt arbeidsmiljø innført. 18 ledere har fullført, 4 i prosess.',
    motif: 'mestring',
    tone: 'forest',
    chips: [{ label: '22 deltakere', tone: 'neutral' }],
  },
  {
    id: '5',
    date: 'Januar 2026',
    title: 'Arbeidsmiljøstrategi 2026 formulert',
    body: 'Styret og AMU vedtok året mål: heve trivsels-skåren fra 58 til 70, holde Trygghet-skåren over 80.',
    motif: 'trygghet',
    tone: 'warm',
  },
  {
    id: '6',
    date: 'November 2025',
    title: 'Vernerunde-runde 4/4 gjennomført',
    body: 'Året endte med 23 åpne funn — alle bortsett fra to lukket eller i prosess før jul.',
    motif: 'trygghet',
    tone: 'forest',
  },
]

// ── Onboarding demo ──────────────────────────────────────────────────────

const ONBOARDING_DEMO: OnboardingVekstStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Velkommen',
    title: 'La oss bygge arbeidsmiljøstrategien sammen',
    body: 'Fire korte steg, og dere har et fundament som AMU, ledere og ansatte kan kjenne igjen. Ingen paragrafer her — vi snakker om hva slags arbeidsmiljø dere ønsker å skape.',
    illustration: 'vekst',
  },
  {
    id: 'vision',
    eyebrow: 'Steg 1 · Visjon',
    title: 'Hva slags arbeidsmiljø ønsker dere?',
    body: 'Skriv det som ville stått øverst i et brev til de ansatte. Ingen overordnet selvfølgelighet — det dere virkelig mener.',
    illustration: 'trivsel',
    content: (
      <textarea
        rows={4}
        placeholder="Eks: «Hos oss skal alle bli sett, hørt, og våge å si fra når noe er utrygt.»"
        className="w-full rounded-2xl border-2 border-[#1a3d32]/15 bg-amber-50/30 px-4 py-3 text-sm text-[#1a3d32] placeholder-[#516760]/60 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
    ),
  },
  {
    id: 'focus',
    eyebrow: 'Steg 2 · Fokus',
    title: 'Hvilke akser har dere mest å hente på?',
    body: 'Velg én eller to. Det er bedre å virkelig flytte to akser enn å snuble litt over fire.',
    illustration: 'medvirkning',
    content: (
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { id: 'trygghet', label: 'Trygghet', sub: 'AML § 4-1, § 4-4' },
          { id: 'trivsel', label: 'Trivsel', sub: 'AML § 4-3' },
          { id: 'medvirkning', label: 'Medvirkning', sub: 'AML kap. 6, 7' },
          { id: 'mestring', label: 'Mestring & utvikling', sub: 'AML § 3-2' },
        ].map((axis) => (
          <label
            key={axis.id}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#1a3d32]/15 bg-white px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50/40"
          >
            <input type="checkbox" className="mt-1 h-4 w-4 accent-amber-600" />
            <div>
              <div className="text-sm font-semibold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                {axis.label}
              </div>
              <div className="text-[11px] text-[#516760]">{axis.sub}</div>
            </div>
          </label>
        ))}
      </div>
    ),
  },
  {
    id: 'roles',
    eyebrow: 'Steg 3 · Roller',
    title: 'Hvem skal være med å eie dette?',
    body: 'En strategi som ikke har eiere lever bare på pdf. Velg HMS-leder og AMU-leder først — de andre kan dere koble på senere.',
    illustration: 'trygghet',
    content: (
      <div className="space-y-3">
        {['HMS-leder', 'AMU-leder', 'Hovedverneombud'].map((role) => (
          <div
            key={role}
            className="flex items-center justify-between rounded-2xl border-2 border-[#1a3d32]/15 bg-white px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                {role}
              </div>
              <div className="text-[11px] text-[#516760]">Ikke valgt ennå</div>
            </div>
            <button
              type="button"
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              Velg person
            </button>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'done',
    eyebrow: 'Ferdig',
    title: 'Klar — strategi-rammen er på plass',
    body: 'Vi har en visjon, et par akser å begynne med, og noen eiere. Neste steg er den første pulsmålingen — den bygger på rammen dere akkurat satte.',
    illustration: 'mestring',
  },
]

// ── Card-stack demo ──────────────────────────────────────────────────────

const STACK_DEMO: CardStackVekstCard[] = [
  {
    id: '1',
    eyebrow: 'Story · Trygghet',
    title: 'Bergen-truck-saken — en nestenulykke som ble til en politikk',
    body: 'En nestenulykke i februar ble grunnen til at vi nå har permanent merking på alle lager-soner. Verneombudet Jens fortalte oss hva som faktisk skjedde.',
    motif: 'trygghet',
    tone: 'warm',
    footer: 'Lest 234 · Lagret 18',
  },
  {
    id: '2',
    eyebrow: 'Story · Trivsel',
    title: 'Mobbing-flagget vi tok på alvor',
    body: 'NAQ-R+ Q2 viste et mobbing-flagg i én avdeling. Bedriftshelse, AMU og ledelsen samordnet en respons innen tre dager. Slik gjorde vi det.',
    motif: 'trivsel',
    tone: 'cool',
    footer: 'Lest 412 · Lagret 47',
  },
  {
    id: '3',
    eyebrow: 'Story · Medvirkning',
    title: 'Hvordan vi fikk 64 % svarprosent på pulsmålingen',
    body: 'Det handlet ikke om ny teknologi. Det handlet om at lederne snakket om hvorfor svarene faktisk betyr noe — og hva som har endret seg fordi noen svarte.',
    motif: 'medvirkning',
    tone: 'forest',
    footer: 'Lest 198 · Lagret 32',
  },
  {
    id: '4',
    eyebrow: 'Story · Mestring',
    title: 'En 40-timers HMS-modul mange faktisk gleder seg til',
    body: 'Vi byttet ut compliance-tonen med menneskelige historier fra egen organisasjon. Resultat: kurset fullføres på under tre uker — ikke tre måneder.',
    motif: 'mestring',
    tone: 'warm',
    footer: 'Lest 156 · Lagret 24',
  },
]

export function VekstPatternGallery() {
  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-[#F2EBDA] p-0">
      {/* Cream wrapper — same canvas as LayoutVekst so the patterns
          read against their intended background. */}
      <div className="bg-[#FAF6EE] px-4 py-10 sm:px-6 sm:py-12 md:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* ── Intro ─────────────────────────────────────────────── */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/platform-admin"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3d32] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Platform-admin
              </Link>
              <Link
                to="/overview/arbeidsmiljostrategi"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden /> Se Vekst i bruk
              </Link>
            </div>
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
              Mønsterbibliotek · Vekst-stilen
            </span>
            <h1
              className="text-4xl font-bold leading-tight text-[#1a3d32] sm:text-5xl"
              style={{ fontFamily: SERIF }}
            >
              Slik leser Vekst-stilen tre vanlige flater
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-[#516760]">
              Den varme, illustrerte estetikken fra Arbeidsmiljøstrategi er ikke en
              engangsdesign — den er en visuell grammatikk som kan løftes inn på flere
              flater når mennesker, ikke paragrafer, skal være protagonisten. Her er
              tabellen, undersøkelsen og dashbordet — alle bygd som gjenbrukbare
              komponenter.
            </p>
          </header>

          {/* ── Section: Table ─────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 1 · Tabell"
              title="Når lista skal være varm, ikke regneark-kald"
              body="Cream-bordede header-celler, serif-overskrifter, mild amber-aksent under header, og organiske skille-linjer mellom rader. Bruk for funn-tabeller, fokusområde-lister, eller hvor som helst hvor radene representerer mennesker eller hendelser."
            />
            <TableVekst<FindingRow>
              eyebrow="Demo · Trygghetsfunn"
              title="Funn fra siste vernerunde-syklus"
              description="Et utvalg åpne, pågående og lukkede funn på tvers av alle fire utfallsakser."
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Legg til nytt funn
                </button>
              }
              columns={FINDINGS_COLUMNS}
              rows={FINDINGS_DEMO}
              footnote="Tonen i severity-chips og status-chips kan tones (forest = god, warm = bemerkning, cool = krever oppmerksomhet)."
            />
          </section>

          {/* ── Section: Survey ───────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 2 · Undersøkelse"
              title="Når skjemaet skal føles som en samtale"
              body="Hver seksjon får sitt motiv fra akse-illustrasjonene. Spørsmålene rendres som store serif-overskrifter, og Likert-svar er rundeknapper som varmes opp med amber-fyll ved valg. Ment for psykososial pulsmåling, AMU-spørsmål, eller hvor som helst hvor folk skal bli bedt om å si noe ærlig."
            />
            <div className="rounded-3xl border border-[#1a3d32]/10 bg-[#FAF6EE] p-6 sm:p-10">
              <SurveyVekst
                eyebrow="Demo · Trivselspuls"
                title="Hvordan har du det denne måneden?"
                subtitle="Fire korte spørsmål, alle anonyme. Vi bruker svarene som råstoff til AMU-saken om psykososialt arbeidsmiljø."
                sections={SURVEY_SECTIONS}
                submitLabel="Send svarene"
                footnote="Personvern: ingen svar kan kobles til navnet ditt. Anonymitets-grensen er minst 10 svar per enhet."
              />
            </div>
          </section>

          {/* ── Section: Dashboard ────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 3 · Dashboard"
              title="Når oversikten skal lese som en gladmelding"
              body="Fire-fem KPI-tiler med serif-tall, en stille amber-skygget trend-graf med organisk gradient, og en aktivitetslogg med små motifs som markerer hvilken akse hver hendelse hører til. Ment som alternativ til den kompakte Puls-terminalen — for flater hvor narrativet er like viktig som tallet."
            />
            <div className="rounded-3xl border border-[#1a3d32]/10 bg-[#1a3d32]/5 p-2 sm:p-3">
              <div className="overflow-hidden rounded-2xl bg-[#FAF6EE]">
                <DashboardVekst
                  eyebrow="Demo · HMS-puls i Vekst-stilen"
                  title="Slik har vi det denne måneden"
                  subtitle="Et øyeblikksbilde fra vår arbeidsmiljø-praksis — bygd for å være varm uten å miste presisjonen."
                  headerActions={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                    >
                      <Printer className="h-3.5 w-3.5" aria-hidden /> Lag rapport
                    </button>
                  }
                  kpis={KPIS_DEMO}
                  trend={TREND_DEMO}
                  activity={ACTIVITY_DEMO}
                  footnote="Bygd med DashboardVekst — bytt ut data-prop-ene og du har samme stil på en hvilken som helst flate."
                />
              </div>
            </div>
          </section>

          {/* ── Section: Timeline ─────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 4 · Tidslinje"
              title="Når året skal leses som en historie, ikke en logg"
              body="Vertikal tidslinje med en organisk linje, store amber-prikker og en mindre motif-sirkel under hver milepæl. Hver oppføring kan ha datoetikett, serif-tittel, fritekst, tone-fargede chips og en CTA. Bygd for HMS-årsrapporten, AMU-historikk eller individuelle utviklingsløp."
            />
            <TimelineVekst
              eyebrow="Demo · Vårt arbeidsmiljø-år"
              title="Slik ser HMS-året vårt ut"
              description="Et utvalg milepæler fra de siste tolv månedene — med motiv, sjanger-tone og lenker videre."
              entries={TIMELINE_DEMO}
              footnote="Tone-farger fortelles sammen med motivet: warm = noe pågående, forest = noe gjort, cool = krever oppmerksomhet, neutral = informativt."
            />
          </section>

          {/* ── Section: Onboarding ───────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 5 · Onboarding-flyt"
              title="Når veiviseren skal være en samtale"
              body="Multi-steg-form med fremdrifts-prikkrekke, stor illustrasjon i en cream-pute på venstre side, og serif-overskrifter + content-slot på høyre. Lyse «Tilbake / Neste / Fullfør»-knapper i serif. Bruk for førstegangs-oppsett av Arbeidsmiljøstrategi, AMU-medlems-onboarding, eller leder-introduksjon."
            />
            <OnboardingVekst steps={ONBOARDING_DEMO} doneLabel="Sett strategien i gang" />
          </section>

          {/* ── Section: Card stack ────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Mønster 6 · Kortstokk"
              title="Når noen få rike historier skal serveres bevisst"
              body="Tre-fire kort stables vertikalt med subtle rotasjon og skygge — som en håndholdt bunke postkort. Klikk topp-kortet for å sende det bakerst. Pile-knapper og prikkrekke under for tastatur-navigasjon. Bygd for «Stories», «Highlights» eller andre flater hvor flat-grid mister magien."
            />
            <CardStackVekst
              eyebrow="Demo · Stories denne måneden"
              title="Tre historier vi vil at hele organisasjonen skal lese"
              description="Klikk topp-kortet for å bla videre. Hver historie er knyttet til en av de fire utfallsaksene."
              cards={STACK_DEMO}
            />
          </section>

          {/* ── Foot — bruke-anvisning ─────────────────────────────── */}
          <footer className="rounded-3xl border-2 border-amber-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <Heart className="mt-1 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <h2
                  className="text-lg font-bold text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  Når bruke Vekst-stilen?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#516760]">
                  Stilen er bygd for flater hvor leseren skal kjenne seg invitert
                  inn, ikke pålagt noe. Pulsundersøkelser, AMU-rapporter, intern-
                  kultur-sider, onboarding av nye ledere — alt som handler om
                  mennesker som tar valg sammen. For tilsynsmateriale eller
                  strikt-lovstyrte registre er Styringssatser eller Puls
                  riktigere tone.
                </p>
                <Link
                  to="/overview/arbeidsmiljostrategi"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
                >
                  Se den i full bruk på Arbeidsmiljøstrategi-siden{' '}
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">{eyebrow}</div>
      <h2
        className="mt-1 text-2xl font-bold leading-tight text-[#1a3d32] sm:text-3xl"
        style={{ fontFamily: SERIF }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#516760]">{body}</p>
    </div>
  )
}
