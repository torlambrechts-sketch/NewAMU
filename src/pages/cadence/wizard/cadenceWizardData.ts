// Cadence-veiviser — statisk kuratert data.
//
// Innholdet her er fasiten veiviseren bygger på: lov-katalog (AML
// kapittel + paragraf), modulkatalog (M01..M23), frekvens-alternativer,
// godkjenningskjeder, eskaleringsstiger og rolle-katalog. Snapshottes
// inn i cadence_plan_*-tabellene ved iverksettelse — endringer her
// påvirker bare nye planer.
//
// Lov-referansene må matche `law_refs[]`-formatet som brukes ellers
// i systemet ('AML § 4-3', 'IK-f § 5 nr. 7', osv.) — disse joines
// mot template_surfaces og compliance-planner.

export type CadenceRegelverkId = 'aml' | 'ik-f' | 'bht' | 'psyk' | 'iso-45001' | 'gdpr'

export type CadenceRegelverkDef = {
  id: CadenceRegelverkId
  name: string
  shortCode: string
  fullCode: string
  iconChar: string
  body: string
  status: 'lovpaalagt' | 'frivillig' | 'ny' | 'annen-modul'
  chapters: number
  requirements: number
  modules: number
  disabled?: boolean
  /** Hvilken `public.regulations.id` denne tilsvarer (når mapping eksisterer). */
  regulationId?: string
}

export const REGELVERK: CadenceRegelverkDef[] = [
  {
    id: 'aml',
    name: 'Arbeidsmiljøloven',
    shortCode: 'AML',
    fullCode: 'LOV-2005-06-17-62 · AML',
    iconChar: '⚖',
    body: 'Hovedlov for HMS. Dekker arbeidsmiljø, vern, arbeidstid, AMU, og verneombud. Bindende for alle virksomheter med ansatte.',
    status: 'lovpaalagt',
    chapters: 10,
    requirements: 81,
    modules: 23,
    regulationId: 'aml',
  },
  {
    id: 'ik-f',
    name: 'Internkontrollforskriften',
    shortCode: 'IK-f',
    fullCode: 'FOR-1996-12-06-1127 · IK-f',
    iconChar: '📖',
    body: 'Krav til systematisk HMS-arbeid. § 5 lister de åtte minimumskravene som danner grunnstammen i internkontrollen.',
    status: 'lovpaalagt',
    chapters: 1,
    requirements: 16,
    modules: 8,
    regulationId: 'ik-f',
  },
  {
    id: 'bht',
    name: 'BHT-forskriften',
    shortCode: 'BHT',
    fullCode: 'FOR-2009-09-10-1173',
    iconChar: '⚕',
    body: 'Plikt til bedriftshelsetjeneste for virksomheter i risikoutsatte bransjer. NACE-koder definerer plikt.',
    status: 'lovpaalagt',
    chapters: 4,
    requirements: 12,
    modules: 5,
  },
  {
    id: 'psyk',
    name: 'Psykososial forskrift',
    shortCode: 'Psyk',
    fullCode: 'FOR-1357 kap. 1A',
    iconChar: '🧠',
    body: 'Trådte i kraft 1. januar 2026. Krever kartlegging av psykososialt arbeidsmiljø minst to ganger årlig.',
    status: 'ny',
    chapters: 1,
    requirements: 8,
    modules: 3,
  },
  {
    id: 'iso-45001',
    name: 'ISO 45001',
    shortCode: 'ISO 45001',
    fullCode: 'NS-EN ISO 45001:2018',
    iconChar: '✓',
    body: 'Internasjonal standard for arbeidsmiljøledelse. Sertifiseringsverdig. Bygger på AML, men setter høyere krav.',
    status: 'frivillig',
    chapters: 10,
    requirements: 13,
    modules: 7,
    regulationId: 'iso-45001',
  },
  {
    id: 'gdpr',
    name: 'GDPR / Personopplysningsloven',
    shortCode: 'GDPR',
    fullCode: 'LOV-2018-06-15-38',
    iconChar: '🔒',
    body: 'Hører til personvern-modulen i Klarert, ikke HMS-cadence.',
    status: 'annen-modul',
    chapters: 0,
    requirements: 0,
    modules: 0,
    disabled: true,
    regulationId: 'gdpr',
  },
]

export const REGELVERK_BY_ID: Record<CadenceRegelverkId, CadenceRegelverkDef> = REGELVERK.reduce(
  (acc, rv) => {
    acc[rv.id] = rv
    return acc
  },
  {} as Record<CadenceRegelverkId, CadenceRegelverkDef>,
)

// ── Paragrafer per regelverk ────────────────────────────────────────────────

export type CadenceParagraph = {
  /** Lovreferanse — matcher law_refs[]-strenger andre steder. */
  code: string
  title: string
  /** Tilleggsinfo (vises som hjelpetekst). */
  note?: string
  /** Lovpålagt for alle med ansatte, ellers frivillig. */
  required: boolean
  /** Terskel-tekst ('≥5 ans.', '≥30 ans.'). */
  threshold?: string
}

export type CadenceChapter = {
  /** Hvilket regelverk denne kapitlet tilhører — gjør oppslag entydig
   *  selv om to regelverk har samme `num` ("Kap. 1" etc.). */
  regelverk: CadenceRegelverkId
  /** Kortform ('Kap. 2'). */
  num: string
  title: string
  paragraphs: CadenceParagraph[]
}

/** Stabil nøkkel for kapitler på tvers av regelverk.
 *  «aml::Kap. 2» kolliderer aldri med «psyk::Kap. 2». Brukes som key i
 *  expanded-state-sett, sortering, og UI-handlere. */
export function chapterKey(ch: { regelverk: CadenceRegelverkId; num: string }): string {
  return `${ch.regelverk}::${ch.num}`
}

// AML — Arbeidsmiljøloven (10 kapitler, 42 paragrafer).
export const AML_CHAPTERS: CadenceChapter[] = [
  {
    regelverk: 'aml',
    num: 'Kap. 2',
    title: 'Arbeidsgivers og arbeidstakers plikter',
    paragraphs: [
      { code: 'AML § 2-1', title: 'Arbeidsgivers plikter', note: 'Hovedansvar for HMS-arbeidet', required: true },
      { code: 'AML § 2-2', title: 'Arbeidsgivers plikter overfor andre enn egne arbeidstakere', required: false },
      { code: 'AML § 2-3', title: 'Arbeidstakers medvirkningsplikt', required: true },
      { code: 'AML § 2-4', title: 'Varsling om kritikkverdige forhold', note: 'Varslingsrutine obligatorisk fra 5 ansatte', threshold: '≥5 ans.', required: true },
      { code: 'AML § 2-5', title: 'Vern mot gjengjeldelse ved varsling', required: true },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 3',
    title: 'Virkemidler i arbeidsmiljøarbeidet',
    paragraphs: [
      { code: 'AML § 3-1', title: 'Krav til systematisk helse-, miljø- og sikkerhetsarbeid', note: 'Internkontroll — koblet til IK-forskriften § 5', required: true },
      { code: 'AML § 3-2', title: 'Særskilte forholdsregler for å ivareta sikkerheten', required: true },
      { code: 'AML § 3-3', title: 'Bedriftshelsetjeneste', note: 'Plikt avhenger av NACE-kode', required: true },
      { code: 'AML § 3-4', title: 'Vurdering av tiltak for fysisk aktivitet', required: false },
      { code: 'AML § 3-5', title: 'Plikt for arbeidsgiver til å gjennomgå opplæring i HMS', required: true },
      { code: 'AML § 3-6', title: 'Plikt til å legge forholdene til rette for varsling', threshold: '≥5 ans.', required: true },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 4',
    title: 'Krav til arbeidsmiljøet',
    paragraphs: [
      { code: 'AML § 4-1', title: 'Generelle krav til arbeidsmiljøet', required: true },
      { code: 'AML § 4-2', title: 'Krav om tilrettelegging, medvirkning og utvikling', required: true },
      { code: 'AML § 4-3', title: 'Krav til det psykososiale arbeidsmiljøet', note: 'Ny forskrift FOR-1357 kap. 1A trådte i kraft 1. jan 2026', required: true },
      { code: 'AML § 4-4', title: 'Krav til det fysiske arbeidsmiljøet', required: true },
      { code: 'AML § 4-5', title: 'Særlig om kjemisk og biologisk helsefare', note: 'Stoffkartotek påkrevd', required: true },
      { code: 'AML § 4-6', title: 'Særlig om tilrettelegging for arbeidstakere med redusert arbeidsevne', required: true },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 6',
    title: 'Verneombud',
    paragraphs: [
      { code: 'AML § 6-1', title: 'Plikt til å velge verneombud', note: 'Påkrevd fra første ansatte', required: true },
      { code: 'AML § 6-2', title: 'Verneombudets oppgaver', required: true },
      { code: 'AML § 6-3', title: 'Særlige rettigheter for verneombudet', required: true },
      { code: 'AML § 6-4', title: 'Hovedverneombud', threshold: 'Ved flere VO', required: true },
      { code: 'AML § 6-5', title: 'Utgifter, opplæring m.m.', required: true },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 7',
    title: 'Arbeidsmiljøutvalg (AMU)',
    paragraphs: [
      { code: 'AML § 7-1', title: 'Plikt til å opprette arbeidsmiljøutvalg', note: 'Påkrevd fra 30 ansatte (frivillig 10-29)', threshold: '≥30 ans.', required: true },
      { code: 'AML § 7-2', title: 'Arbeidsmiljøutvalgets oppgaver', note: 'Minst 4 møter/år. Vernerunder, årsrapport', required: true },
      { code: 'AML § 7-3', title: 'Særskilte lokale arbeidsmiljøutvalg', required: false },
      { code: 'AML § 7-4', title: 'Andre rådgivende organer', required: false },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 8',
    title: 'Informasjon og drøfting',
    paragraphs: [
      { code: 'AML § 8-1', title: 'Plikt til informasjon og drøfting', threshold: '≥50 ans.', required: true },
      { code: 'AML § 8-2', title: 'Gjennomføring av plikten til informasjon og drøfting', threshold: '≥50 ans.', required: true },
      { code: 'AML § 8-3', title: 'Fortrolige opplysninger', threshold: '≥50 ans.', required: false },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 9',
    title: 'Kontrolltiltak i virksomheten',
    paragraphs: [
      { code: 'AML § 9-1', title: 'Vilkår for kontrolltiltak i virksomheten', required: true },
      { code: 'AML § 9-2', title: 'Drøfting, informasjon og evaluering av kontrolltiltak', required: true },
      { code: 'AML § 9-3', title: 'Innhenting av helseopplysninger ved ansettelse', required: false },
      { code: 'AML § 9-4', title: 'Medisinske undersøkelser av arbeidssøkere og arbeidstakere', required: false },
      { code: 'AML § 9-5', title: 'Kontrolltiltak knyttet til rusmidler', required: false },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 10',
    title: 'Arbeidstid',
    paragraphs: [
      { code: 'AML § 10-1', title: 'Definisjoner', required: false },
      { code: 'AML § 10-2', title: 'Arbeidstidsordninger', required: false },
      { code: 'AML § 10-4', title: 'Alminnelig arbeidstid', required: false },
      { code: 'AML § 10-6', title: 'Overtid', required: false },
      { code: 'AML § 10-8', title: 'Daglig og ukentlig arbeidsfri', required: false },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 13',
    title: 'Vern mot diskriminering',
    paragraphs: [
      { code: 'AML § 13-1', title: 'Forbud mot diskriminering', required: true },
      { code: 'AML § 13-2', title: 'Hva kapitlet omfatter', required: true },
      { code: 'AML § 13-3', title: 'Unntak fra forbudet mot forskjellsbehandling', required: false },
    ],
  },
  {
    regelverk: 'aml',
    num: 'Kap. 14',
    title: 'Ansettelse mv.',
    paragraphs: [
      { code: 'AML § 14-5', title: 'Krav om skriftlig arbeidsavtale', required: true },
      { code: 'AML § 14-6', title: 'Minimumskrav til innholdet i den skriftlige avtalen', required: true },
      { code: 'AML § 14-9', title: 'Fast og midlertidig ansettelse', required: false },
    ],
  },
]

// IK-f — Internkontrollforskriften (FOR-1996-12-06-1127). Lite forskrift,
// ett samlende «kapittel». § 5 er kjernen («Innholdet i internkontrollen»)
// med 8 nummererte punkter som strukturerer hele HMS-arbeidet.
export const IKF_CHAPTERS: CadenceChapter[] = [
  {
    regelverk: 'ik-f',
    num: 'IK-f',
    title: 'Internkontroll — krav til systematisk HMS-arbeid',
    paragraphs: [
      { code: 'IK-f § 1', title: 'Formål', required: true },
      { code: 'IK-f § 2', title: 'Definisjoner', required: false },
      { code: 'IK-f § 3', title: 'Hvem forskriften gjelder for', required: true },
      { code: 'IK-f § 4', title: 'Plikt til internkontroll', note: 'Arbeidsgiver er ansvarlig — uavhengig av størrelse', required: true },
      { code: 'IK-f § 5 nr. 1', title: 'Sørge for at lover og forskrifter er tilgjengelig', required: true },
      { code: 'IK-f § 5 nr. 2', title: 'Sørge for at arbeidstakere har tilstrekkelig kunnskap', required: true },
      { code: 'IK-f § 5 nr. 3', title: 'Sørge for at arbeidstakere medvirker', required: true },
      { code: 'IK-f § 5 nr. 4', title: 'Fastsette mål for HMS', required: true },
      { code: 'IK-f § 5 nr. 5', title: 'Ha oversikt over virksomhetens organisasjon', required: true },
      { code: 'IK-f § 5 nr. 6', title: 'Kartlegge farer og problemer — risikovurdering', note: 'Kjernen i HMS-arbeidet', required: true },
      { code: 'IK-f § 5 nr. 7', title: 'Iverksette rutiner for å avdekke, rette opp og forebygge', required: true },
      { code: 'IK-f § 5 nr. 8', title: 'Foreta systematisk overvåking og gjennomgang', note: 'Årlig systemrevisjon', required: true },
      { code: 'IK-f § 6', title: 'Tilsyn', required: false },
      { code: 'IK-f § 7', title: 'Reaksjoner ved overtredelse', required: false },
      { code: 'IK-f § 8', title: 'Dispensasjon', required: false },
    ],
  },
]

// BHT-forskriften (FOR-2009-09-10-1173) — plikt til bedriftshelsetjeneste
// for risikoutsatte næringer.
export const BHT_CHAPTERS: CadenceChapter[] = [
  {
    regelverk: 'bht',
    num: 'Kap. 1',
    title: 'Innledende bestemmelser',
    paragraphs: [
      { code: 'BHT § 1', title: 'Formål', required: true },
      { code: 'BHT § 2', title: 'Virkeområde', note: 'Næringer angitt i forskriften (NACE-koder)', required: true },
      { code: 'BHT § 3', title: 'Plikt til å knytte BHT', note: 'Industri 28.xxx er pliktig', required: true },
    ],
  },
  {
    regelverk: 'bht',
    num: 'Kap. 2',
    title: 'BHT-tjenestens oppgaver',
    paragraphs: [
      { code: 'BHT § 4', title: 'BHT skal bistå arbeidsgiver', required: true },
      { code: 'BHT § 5', title: 'BHT skal være fri og uavhengig', required: true },
      { code: 'BHT § 6', title: 'Plan for BHT-arbeidet (årlig)', note: 'Vedtas av AMU. Konkrete oppgaver per år.', required: true },
      { code: 'BHT § 7', title: 'Rapportering fra BHT', note: 'Årsrapport til AMU + arbeidsgiver', required: true },
    ],
  },
  {
    regelverk: 'bht',
    num: 'Kap. 3',
    title: 'Godkjenning og kompetanse',
    paragraphs: [
      { code: 'BHT § 8', title: 'Krav til godkjenning', required: true },
      { code: 'BHT § 9', title: 'Kompetansekrav til BHT-personell', required: true },
      { code: 'BHT § 10', title: 'Søknad om godkjenning', required: false },
      { code: 'BHT § 11', title: 'Tilbakekall av godkjenning', required: false },
    ],
  },
  {
    regelverk: 'bht',
    num: 'Kap. 4',
    title: 'Avsluttende bestemmelser',
    paragraphs: [
      { code: 'BHT § 12', title: 'Tilsyn', required: false },
      { code: 'BHT § 13', title: 'Reaksjoner', required: false },
      { code: 'BHT § 14', title: 'Ikrafttredelse', required: false },
      { code: 'BHT § 15', title: 'Overgangsbestemmelser', required: false },
    ],
  },
]

// Psykososial-forskrift (FOR-1357 kap. 1A — trådte i kraft 1.1.2026).
// Nytt regelverk om psykososialt arbeidsmiljø under Forskrift om
// utførelse av arbeid; krever halvårlig kartlegging.
export const PSYK_CHAPTERS: CadenceChapter[] = [
  {
    regelverk: 'psyk',
    num: 'Kap. 1A',
    title: 'Psykososialt arbeidsmiljø',
    paragraphs: [
      { code: 'Psyk § 1A-1', title: 'Virkeområde og formål', note: 'Ny 2026 — supplerer AML § 4-3', required: true },
      { code: 'Psyk § 1A-2', title: 'Definisjoner — psykososialt arbeidsmiljø', required: true },
      { code: 'Psyk § 1A-3', title: 'Arbeidsgivers plikt til kartlegging', note: 'Minst 2× pr år', required: true },
      { code: 'Psyk § 1A-4', title: 'Krav til kartleggingsverktøy', note: 'STAMI-validert el. tilsvarende', required: true },
      { code: 'Psyk § 1A-5', title: 'Tiltaksplan etter kartlegging', note: 'Innen 3 mnd — vedtas av AMU', required: true },
      { code: 'Psyk § 1A-6', title: 'Trakassering og vold/trusler — egen oppfølging', required: true },
      { code: 'Psyk § 1A-7', title: 'Konflikthåndtering — krav til prosedyre', required: false },
      { code: 'Psyk § 1A-8', title: 'Tilsyn og dokumentasjon', required: true },
    ],
  },
]

// ISO 45001 — Internasjonal standard for arbeidsmiljøledelse.
// 10 hovedpunkter (1-3 er innledning, 4-10 er reviderbare krav).
export const ISO_45001_CHAPTERS: CadenceChapter[] = [
  {
    regelverk: 'iso-45001',
    num: 'Punkt 4',
    title: 'Organisasjonens kontekst',
    paragraphs: [
      { code: 'ISO 45001 § 4.1', title: 'Forstå organisasjonen og dens kontekst', required: true },
      { code: 'ISO 45001 § 4.2', title: 'Forstå interessenters behov og forventninger', required: true },
      { code: 'ISO 45001 § 4.3', title: 'Bestemme styringssystemets omfang', required: true },
      { code: 'ISO 45001 § 4.4', title: 'Arbeidsmiljøstyringssystem og prosesser', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 5',
    title: 'Lederskap og medvirkning',
    paragraphs: [
      { code: 'ISO 45001 § 5.1', title: 'Lederskap og forpliktelse', required: true },
      { code: 'ISO 45001 § 5.2', title: 'AM-policy', required: true },
      { code: 'ISO 45001 § 5.3', title: 'Roller, ansvar og myndighet', required: true },
      { code: 'ISO 45001 § 5.4', title: 'Konsultasjon og medvirkning', note: 'Krav om arbeidstakerinvolvering', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 6',
    title: 'Planlegging',
    paragraphs: [
      { code: 'ISO 45001 § 6.1', title: 'Tiltak for å håndtere risiko og muligheter', required: true },
      { code: 'ISO 45001 § 6.2', title: 'AM-mål og planlegging for å nå dem', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 7',
    title: 'Støtte',
    paragraphs: [
      { code: 'ISO 45001 § 7.1', title: 'Ressurser', required: true },
      { code: 'ISO 45001 § 7.2', title: 'Kompetanse', required: true },
      { code: 'ISO 45001 § 7.3', title: 'Bevissthet', required: false },
      { code: 'ISO 45001 § 7.4', title: 'Kommunikasjon', required: true },
      { code: 'ISO 45001 § 7.5', title: 'Dokumentert informasjon', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 8',
    title: 'Drift',
    paragraphs: [
      { code: 'ISO 45001 § 8.1', title: 'Driftsplanlegging og styring', required: true },
      { code: 'ISO 45001 § 8.2', title: 'Beredskap og respons ved nødssituasjoner', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 9',
    title: 'Ytelsesvurdering',
    paragraphs: [
      { code: 'ISO 45001 § 9.1', title: 'Overvåking, måling, analyse og evaluering', required: true },
      { code: 'ISO 45001 § 9.2', title: 'Internrevisjon', note: 'Minst årlig', required: true },
      { code: 'ISO 45001 § 9.3', title: 'Ledelsens gjennomgang', note: 'Minst årlig', required: true },
    ],
  },
  {
    regelverk: 'iso-45001',
    num: 'Punkt 10',
    title: 'Forbedring',
    paragraphs: [
      { code: 'ISO 45001 § 10.1', title: 'Generelt', required: false },
      { code: 'ISO 45001 § 10.2', title: 'Hendelser, avvik og korrigerende tiltak', required: true },
      { code: 'ISO 45001 § 10.3', title: 'Kontinuerlig forbedring', required: true },
    ],
  },
]

// ── Regelverk-til-chapters-oppslag ─────────────────────────────────────────

export const CHAPTERS_BY_REGELVERK: Record<CadenceRegelverkId, CadenceChapter[]> = {
  'aml': AML_CHAPTERS,
  'ik-f': IKF_CHAPTERS,
  'bht': BHT_CHAPTERS,
  'psyk': PSYK_CHAPTERS,
  'iso-45001': ISO_45001_CHAPTERS,
  'gdpr': [], // GDPR har egen modul utenfor cadence-veiviseren.
}

/** Returner alle kapitler for de valgte regelverk, i samme rekkefølge
 *  som regelverk-IDene ble valgt — slik at UI viser AML først hvis det
 *  ble huket av først, deretter IK-f, osv. */
export function chaptersForRegelverk(regelverk: readonly CadenceRegelverkId[]): CadenceChapter[] {
  return regelverk.flatMap((rv) => CHAPTERS_BY_REGELVERK[rv] ?? [])
}

/** Total antall paragrafer i de valgte regelverk. Brukes for KPI-pillen
 *  «X/Y paragrafer» i Step 2. */
export function totalParagraphsForRegelverk(regelverk: readonly CadenceRegelverkId[]): number {
  return chaptersForRegelverk(regelverk).reduce((sum, ch) => sum + ch.paragraphs.length, 0)
}

// Legacy export — beholdt for bakoverkompatibilitet i tester / verktøy.
// Bruker chaptersForRegelverk(['aml']) når mulig.
export const TOTAL_PARAGRAPHS = AML_CHAPTERS.reduce((sum, ch) => sum + ch.paragraphs.length, 0)

// ── Moduler (oppgavemaler) ─────────────────────────────────────────────────

export type CadenceModuleTier = 'required' | 'recommended' | 'optional'

export type CadenceModule = {
  id: string
  name: string
  group: string
  tier: CadenceModuleTier
  /** Hvilke paragrafer modulen dekker. */
  maps: string[]
  description: string
  /** Forventet volum (oppgaver per år). */
  volume: number
  /** Default cadence-hint (matcher arlig / halvarlig / kvartalsvis / ad_hoc). */
  cadenceHint: 'arlig' | 'halvarlig' | 'kvartalsvis' | 'manedlig' | 'ukentlig' | 'ad_hoc'
  /** Foreslåtte frekvens-strenger UI viser i steg 5. */
  frequencyOptions: string[]
}

// Hver modul lister law_refs på TVERS av regelverk — slik at en bruker som
// velger kun IK-f / Psyk / BHT / ISO 45001 fortsatt får relevante moduler.
// Eks: M01 «Mål & policy» kryss-refererer AML § 2-1 + IK-f § 5 nr. 4 +
// ISO 45001 § 5.2.
export const MODULES: CadenceModule[] = [
  // Forankring
  { id: 'M01', name: 'Mål, policy & ledelsens forankring', group: 'Forankring', tier: 'required', maps: ['AML § 2-1', 'AML § 3-1', 'IK-f § 5 nr. 4', 'ISO 45001 § 5.1', 'ISO 45001 § 5.2'], description: 'Årlig vedtak fra styret om HMS-mål og policy. Forplikter ledelsen til arbeidet.', volume: 2, cadenceHint: 'halvarlig', frequencyOptions: ['Årlig (jan)', 'Halvårlig'] },
  { id: 'M02', name: 'Risikoanalyse — årlig', group: 'Forankring', tier: 'required', maps: ['AML § 3-1', 'AML § 4-1', 'IK-f § 5 nr. 6', 'ISO 45001 § 6.1'], description: 'Bedriftsomfattende risikokartlegging med BHT. Grunnlag for hele cadencen.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (feb)', 'Hver 18. mnd'] },
  { id: 'M03', name: 'Lederopplæring HMS', group: 'Forankring', tier: 'required', maps: ['AML § 3-5', 'IK-f § 5 nr. 2', 'ISO 45001 § 7.2'], description: 'Obligatorisk opplæring for arbeidsgiver. Min. 16 timer dokumentert.', volume: 2, cadenceHint: 'arlig', frequencyOptions: ['1 ny leder/år', 'Refresher hver 3. år', 'Engangs'] },

  // Daglig drift / vernerunder
  { id: 'M04', name: 'Vernerunder — produksjon', group: 'Vernerunder', tier: 'required', maps: ['AML § 4-1', 'AML § 4-4', 'AML § 6-2', 'IK-f § 5 nr. 6', 'ISO 45001 § 9.1'], description: 'Systematisk gjennomgang av arbeidsplasser. Funn → avvik → tiltak.', volume: 4, cadenceHint: 'kvartalsvis', frequencyOptions: ['Kvartalsvis (anbefalt)', 'Månedlig', 'Halvårlig'] },
  { id: 'M05', name: 'Vernerunder — kontor/administrasjon', group: 'Vernerunder', tier: 'recommended', maps: ['AML § 4-1', 'IK-f § 5 nr. 6', 'ISO 45001 § 9.1'], description: 'Halvårlig variant for lavrisiko-områder.', volume: 2, cadenceHint: 'halvarlig', frequencyOptions: ['Halvårlig', 'Kvartalsvis'] },

  // Varsling
  { id: 'M06', name: 'Varslingsrutine — gjennomgang', group: 'Varsling', tier: 'required', maps: ['AML § 2-4', 'AML § 3-6', 'IK-f § 5 nr. 7'], description: 'Årlig vurdering om varslingskanaler fungerer. Inkluderer anonyme tester.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig', 'Halvårlig'] },
  { id: 'M07', name: 'Varslingssaker — håndtering', group: 'Varsling', tier: 'required', maps: ['AML § 2-4', 'AML § 2-5', 'IK-f § 5 nr. 7'], description: 'Mottak, undersøkelse, oppfølging. Triggers ad hoc.', volume: 6, cadenceHint: 'ad_hoc', frequencyOptions: ['Per sak (ad hoc)'] },

  // Psykososialt — Psyk-kapittelet er kjernen, AML § 4-3 + ISO 45001 § 5.4
  // er parallelle krav.
  { id: 'M08', name: 'STAMI-kartlegging vår', group: 'Psykososialt', tier: 'required', maps: ['AML § 4-3', 'Psyk § 1A-3', 'Psyk § 1A-4', 'ISO 45001 § 9.1'], description: 'Halvårlig psykososialundersøkelse. STAMI-validert instrument.', volume: 1, cadenceHint: 'halvarlig', frequencyOptions: ['Vår (mars-apr)'] },
  { id: 'M09', name: 'STAMI-kartlegging høst', group: 'Psykososialt', tier: 'required', maps: ['AML § 4-3', 'Psyk § 1A-3', 'Psyk § 1A-4'], description: 'Andre runde, samme år. Sammenlignbar med vår-runden.', volume: 1, cadenceHint: 'halvarlig', frequencyOptions: ['Høst (sep-okt)'] },
  { id: 'M10', name: 'Tiltaksplan etter kartlegging', group: 'Psykososialt', tier: 'required', maps: ['AML § 4-3', 'AML § 7-2', 'Psyk § 1A-5', 'ISO 45001 § 10.3'], description: 'Innen 31. des: konkret tiltaksplan basert på funn.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (innen 31.12)'] },
  { id: 'M11', name: 'Konfliktmegling — protokoll', group: 'Psykososialt', tier: 'optional', maps: ['AML § 4-3', 'Psyk § 1A-6', 'Psyk § 1A-7'], description: 'Standard prosess for konflikthåndtering. Triggers ad hoc.', volume: 3, cadenceHint: 'ad_hoc', frequencyOptions: ['Per sak (ad hoc)'] },

  // Fysisk
  { id: 'M12', name: 'Kjemisk eksponering — vurdering', group: 'Fysisk', tier: 'required', maps: ['AML § 4-5', 'IK-f § 5 nr. 6'], description: 'Årlig gjennomgang av stoffkartotek og eksponeringsnivåer.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig', 'Halvårlig'] },
  { id: 'M13', name: 'Verneutstyr — inspeksjon', group: 'Fysisk', tier: 'required', maps: ['AML § 4-4', 'IK-f § 5 nr. 7'], description: 'Halvårlig kontroll av CE-merking, slitasje, utskifting.', volume: 2, cadenceHint: 'halvarlig', frequencyOptions: ['Halvårlig (anbefalt)', 'Kvartalsvis'] },
  { id: 'M14', name: 'Stoffkartotek — oppdatering', group: 'Fysisk', tier: 'required', maps: ['AML § 4-5', 'IK-f § 5 nr. 1'], description: 'Kvartalsvis: nye stoffer registreres, gamle fjernes, datablader oppdateres.', volume: 4, cadenceHint: 'kvartalsvis', frequencyOptions: ['Kvartalsvis', 'Halvårlig'] },

  // Sykefravær
  { id: 'M15', name: 'Oppfølgingsplan ved sykefravær', group: 'Sykefravær', tier: 'required', maps: ['AML § 4-6'], description: 'Lovkrav innen 4 ukers fravær. Klarert genererer per sak.', volume: 12, cadenceHint: 'ad_hoc', frequencyOptions: ['Per sak (≤4 uker fravær)'] },
  { id: 'M16', name: 'Dialogmøte 1 (innen 7 uker)', group: 'Sykefravær', tier: 'required', maps: ['AML § 4-6'], description: 'Lovbestemt møtepunkt. Arbeidstaker + arbeidsgiver + (BHT/NAV).', volume: 8, cadenceHint: 'ad_hoc', frequencyOptions: ['Per sak (≤7 uker fravær)'] },

  // BHT — koblet både til AML § 3-3 og BHT-forskriften.
  { id: 'M17', name: 'BHT-plan vedtatt', group: 'BHT', tier: 'required', maps: ['AML § 3-3', 'BHT § 3', 'BHT § 6'], description: 'Årlig avtale med BHT om omfang og tema for året.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (jan)'] },
  { id: 'M18', name: 'BHT-konsultasjoner — kvartalsvis', group: 'BHT', tier: 'required', maps: ['AML § 3-3', 'BHT § 4'], description: 'Faste konsultasjonsmøter med BHT-rådgiver.', volume: 4, cadenceHint: 'kvartalsvis', frequencyOptions: ['Kvartalsvis (anbefalt)', 'Månedlig'] },
  { id: 'M19', name: 'BHT-årsrapport', group: 'BHT', tier: 'required', maps: ['AML § 3-3', 'BHT § 7'], description: 'Skriftlig rapport om årets BHT-bidrag, levert AMU og daglig leder.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (nov)'] },

  // AMU
  { id: 'M20', name: 'AMU-møter — 4 per år', group: 'AMU', tier: 'required', maps: ['AML § 7-1', 'AML § 7-2', 'IK-f § 5 nr. 3'], description: 'Kvartalsvise møter. Agenda, protokoll, vedtak. Lovbestemt fra 30 ansatte.', volume: 4, cadenceHint: 'kvartalsvis', frequencyOptions: ['Kvartalsvis (min. 4)', 'Månedlig'] },
  { id: 'M21', name: 'AMU-årsrapport → styret', group: 'AMU', tier: 'required', maps: ['AML § 7-2'], description: 'Årlig oppsummering av AMU-arbeidet. Vedtas av AMU, signeres av daglig leder.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (des)'] },

  // Drøfting
  { id: 'M22', name: 'Drøftingsmøter tillitsvalgte', group: 'Drøfting', tier: 'optional', maps: ['AML § 8-1', 'AML § 8-2'], description: 'Lovpålagt fra 50 ansatte. Under terskel er drøfting frivillig.', volume: 2, cadenceHint: 'halvarlig', frequencyOptions: ['Halvårlig', 'Etter behov'] },

  // Revisjon — Internrevisjon dekker både IK-f § 5 nr. 8, AML § 3-1 og
  // ISO 45001 § 9.2 / § 9.3.
  { id: 'M23', name: 'Systemrevisjon HMS — årlig', group: 'Revisjon', tier: 'required', maps: ['AML § 3-1', 'IK-f § 5 nr. 8', 'ISO 45001 § 9.2', 'ISO 45001 § 9.3'], description: 'Internrevisjon av hele HMS-systemet. Sjekker etterlevelse, foreslår forbedringer.', volume: 1, cadenceHint: 'arlig', frequencyOptions: ['Årlig (nov)', 'Halvårlig'] },
]

// ── Roller ──────────────────────────────────────────────────────────────────

export type CadenceRoleDef = {
  key: string
  label: string
  sub: string
  /** Lov-referansen som forankrer rollen. */
  lawRef?: string
  /** Lovpålagt rolle vs frivillig. */
  mandatory: boolean
  /** Erstatter person-feltet med leverandør-felt for BHT/eksterne. */
  isExternal?: boolean
}

export const ROLES: CadenceRoleDef[] = [
  { key: 'daglig_leder', label: 'Daglig leder', sub: 'Øverste ansvarlige for HMS-arbeidet', lawRef: 'AML § 2-1', mandatory: true },
  { key: 'hms_ansvarlig', label: 'HMS-ansvarlig', sub: 'Operativ koordinering, dokumentasjon', lawRef: 'AML § 3-1', mandatory: true },
  { key: 'hovedverneombud', label: 'Hovedverneombud (HVO)', sub: 'Velges av verneombudene, leder AMU', lawRef: 'AML § 6-4', mandatory: true },
  { key: 'verneombud_produksjon', label: 'Verneombud (produksjon)', sub: 'Vernerunder, avviksoppfølging i avdeling', lawRef: 'AML § 6-1', mandatory: true },
  { key: 'amu_leder', label: 'AMU-leder', sub: 'Roterer årlig mellom arbeidsgiver og arbeidstaker', lawRef: 'AML § 7-1', mandatory: true },
  { key: 'bht', label: 'Bedriftshelsetjeneste (BHT)', sub: 'Ekstern leverandør', lawRef: 'AML § 3-3', mandatory: true, isExternal: true },
  { key: 'tillitsvalgt', label: 'Tillitsvalgt (hovedavtale)', sub: 'Drøftingspart ved virksomhetsendring', lawRef: 'AML § 8-2', mandatory: true },
  { key: 'hse_koordinator', label: 'HSE-koordinator', sub: 'Avlaster HMS-ansvarlig på operative oppg.', mandatory: false },
  { key: 'brannvernleder', label: 'Brannvernleder', sub: 'Plan, øvelser, samarbeid med brannvesen', mandatory: false },
]

// ── Godkjenningskjeder ──────────────────────────────────────────────────────

export type CadenceApprovalStep = {
  title: string
  meta: string
  kind: 'utforer' | 'qa' | 'sluttsignering' | 'kollegialt' | 'informeres'
  slaDays?: number
}

export type CadenceApprovalChain = {
  code: string
  label: string
  steps: CadenceApprovalStep[]
}

export const APPROVAL_CHAINS: CadenceApprovalChain[] = [
  {
    code: 'G01',
    label: 'Vernerunderapporter',
    steps: [
      { title: 'Verneombud utfører og signerer', meta: 'Verneombud · ved fravær: fallback (24 t)', kind: 'utforer' },
      { title: 'HMS-ansvarlig kvalitetssikrer', meta: 'HMS-ansvarlig · 3 dagers SLA', kind: 'qa', slaDays: 3 },
      { title: 'Daglig leder signerer', meta: 'Daglig leder · 7 dagers SLA', kind: 'sluttsignering', slaDays: 7 },
    ],
  },
  {
    code: 'G02',
    label: 'AMU-protokoller',
    steps: [
      { title: 'HVO utarbeider utkast', meta: 'Hovedverneombud · innen 5 dager etter møte', kind: 'utforer', slaDays: 5 },
      { title: 'Alle AMU-medlemmer godkjenner', meta: 'Krever 3 av 5 stemmer · digital signering', kind: 'kollegialt' },
      { title: 'Daglig leder bekrefter mottatt', meta: 'Daglig leder · ingen vedtaksrett', kind: 'informeres' },
    ],
  },
  {
    code: 'G03',
    label: 'Årsrapport AMU → styret',
    steps: [
      { title: 'HMS-ansvarlig utarbeider utkast', meta: 'HMS-ansvarlig · senest 15. nov', kind: 'utforer' },
      { title: 'HVO leser og kommenterer', meta: 'Hovedverneombud · 5 dagers SLA', kind: 'qa', slaDays: 5 },
      { title: 'AMU-vedtak', meta: 'Møte i desember · 3 av 5 stemmer', kind: 'kollegialt' },
      { title: 'Daglig leder signerer & oversender styret', meta: 'Daglig leder · innen 31. desember', kind: 'sluttsignering' },
    ],
  },
  {
    code: 'G04',
    label: 'Risikoanalyse — årlig',
    steps: [
      { title: 'HMS-ansvarlig + BHT utarbeider', meta: 'HMS-ansvarlig + BHT · 4-ukers prosess', kind: 'utforer' },
      { title: 'AMU drøfter og vedtar', meta: 'På AMU-møte 1/4 · 3 av 5 stemmer', kind: 'kollegialt' },
      { title: 'Daglig leder signerer', meta: 'Daglig leder · 7 dagers SLA', kind: 'sluttsignering', slaDays: 7 },
    ],
  },
]

// ── Eskaleringsstiger ───────────────────────────────────────────────────────

export type CadenceEscalationStep = {
  relativeDay: number
  triggerLabel: string
  triggerNote?: string
  actionLabel: string
  actionNote?: string
  severity: 'mild' | 'standard' | 'streng' | 'kritisk' | 'stille'
}

export type CadenceEscalationLadder = {
  code: string
  label: string
  steps: CadenceEscalationStep[]
}

export const ESCALATION_LADDERS: CadenceEscalationLadder[] = [
  {
    code: 'E01',
    label: 'Standard for lovbestemte oppgaver',
    steps: [
      { relativeDay: -14, triggerLabel: 'Første påminnelse til oppgaveeier', triggerNote: 'Mild · ingen kopi til andre', actionLabel: 'E-post + push-varsel', actionNote: '«Frist nærmer seg — 2 uker»', severity: 'mild' },
      { relativeDay: -7, triggerLabel: 'Andre påminnelse + kopi til linjeleder', triggerNote: 'Mild · linjeleder informeres', actionLabel: 'E-post + Slack-DM', actionNote: '«1 uke igjen — bekreft fremdrift»', severity: 'mild' },
      { relativeDay: -1, triggerLabel: 'Siste påminnelse — kritisk', triggerNote: 'Standard · HMS-ansvarlig informeres', actionLabel: 'E-post + Slack-DM + SMS', actionNote: '«Frist i morgen — siste mulighet»', severity: 'standard' },
      { relativeDay: 0, triggerLabel: 'Frist passert — fallback aktiveres', triggerNote: 'Streng · fallback-kjeden tar over', actionLabel: 'Oppgave reassignet automatisk', actionNote: 'Original eier varslet om reassignment', severity: 'streng' },
      { relativeDay: 3, triggerLabel: 'Varsel til daglig leder', triggerNote: 'Streng · compliance-risiko', actionLabel: 'E-post med full kontekst', actionNote: 'Lovreferanse + risikovurdering inkludert', severity: 'streng' },
      { relativeDay: 14, triggerLabel: 'Styrevarsel + AMU-orientering', triggerNote: 'Kritisk · oppført i AMU-protokoll', actionLabel: 'Tilsynsfare flagget', actionNote: 'Ved gjentagelse: drøftingsmøte påkrevd', severity: 'kritisk' },
    ],
  },
  {
    code: 'E02',
    label: 'Mild — for frivillige oppgaver',
    steps: [
      { relativeDay: -3, triggerLabel: 'Påminnelse til eier', triggerNote: 'Kun e-post · ingen videre eskalering automatisk', actionLabel: 'E-post', severity: 'mild' },
      { relativeDay: 0, triggerLabel: 'Frist passert', triggerNote: 'Oppgaven markeres som forfalt, men ingen varsel', actionLabel: 'Logg-oppføring', severity: 'stille' },
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returnerer hvilke moduler som mappes mot minst én av de valgte paragrafene. */
export function relevantModules(selectedParagraphs: ReadonlySet<string>): CadenceModule[] {
  return MODULES.filter((m) => m.maps.some((code) => selectedParagraphs.has(code)))
}

/** Telles per kapittel for status-pille i steg 2. */
export function chapterSelectionState(
  ch: CadenceChapter,
  selected: ReadonlySet<string>,
): { selected: number; total: number; required: number } {
  return {
    selected: ch.paragraphs.filter((p) => selected.has(p.code)).length,
    total: ch.paragraphs.length,
    required: ch.paragraphs.filter((p) => p.required).length,
  }
}
