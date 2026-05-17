// Marketing content for the 6 product modules.
// Single source of truth consumed by LandingPage.ModuleFeatureSection and FeaturePage.
// Edits here propagate to every marketing surface — no copy lives in components.

export type FeatureModuleSlug =
  | 'oppgaver'
  | 'sjekklister'
  | 'varslinger'
  | 'dokumenter'
  | 'laering'
  | 'undersokelser'

export type LawFamily =
  | 'AML'
  | 'IK-f'
  | 'GDPR'
  | 'ISO'
  | 'Åpenhetsloven'
  | 'LDL'

export type LawRef = {
  short: string
  full: string
  family: LawFamily
}

export type Capability = {
  title: string
  description: string
}

export type ModuleFeature = {
  slug: FeatureModuleSlug
  name: string
  number: number
  icon: string
  eyebrow: string
  headline: string
  lede: string
  longDescription: string
  capabilities: Capability[]
  standoutTitle: string
  standoutBody: string
  lawRefs: LawRef[]
  related: FeatureModuleSlug[]
  metaTitle: string
  metaDescription: string
}

export const FEATURES: ModuleFeature[] = [
  {
    slug: 'oppgaver',
    name: 'Oppgaver',
    number: 1,
    icon: 'tasks',
    eyebrow: 'Modul 1 av 6',
    headline: 'Én innboks for alt som må gjøres',
    lede: 'Tiltak fra alle moduler samles i én lovpålagt arbeidsflyt — fra observasjon til signert avslutning.',
    longDescription:
      'Oppgaver er den eneste innboksen i Klarert som ser alt. Funn fra sjekklister, tiltak fra varslingssaker, vedtak fra AMU-møter, anbefalinger fra risikovurderinger og krav fra sykefraværsoppfølging havner samme sted. Du ser hva som er forsinket, hvem som eier det, og hva som hindrer fremdrift — uten å lete i fem moduler.',
    capabilities: [
      {
        title: 'Kildedrevet samling',
        description:
          'Hvert tiltak bærer med seg hvor det kom fra (sjekkliste, varsling, AMU-vedtak, ROS-analyse, sykefraværsplan). Filtrer på kilde og se hva som har utløst hva.',
      },
      {
        title: 'Lovpålagt arbeidsflyt',
        description:
          'todo → pågår → ferdig, med valgfri ledergodkjenning før arkivering. Hver statusendring loggføres med tidsstempel og bruker.',
      },
      {
        title: 'Digital signering',
        description:
          'Tildelt person signerer fullføring; leder signerer kontroll. Audit-spor følger lovkravet om sporbarhet i internkontrollarbeidet.',
      },
      {
        title: 'Tverrgående analyse',
        description:
          'Dashbordet viser åpne tiltak per avdeling, kilde og prioritet — og hvor de hoper seg opp før et avvik blir en sak.',
      },
    ],
    standoutTitle: 'Den eneste innboksen som ser alt',
    standoutBody:
      'De fleste HMS-systemer har én oppgaveliste per modul. Klarert har én oppgaveliste — punktum. Det er det ene stedet verneombudet sjekker mandag morgen for å se hva som faktisk henger igjen i hele virksomheten.',
    lawRefs: [
      { short: 'AML §3-1', full: 'Systematisk HMS-arbeid', family: 'AML' },
      { short: 'IK-f §5 nr. 7', full: 'Systematisk overvåking og gjennomgang', family: 'IK-f' },
    ],
    related: ['sjekklister', 'varslinger', 'undersokelser'],
    metaTitle: 'Oppgaver — Klarert | Tverrgående tiltaksinnboks for HMS',
    metaDescription:
      'Samle alle åpne tiltak fra HMS, sjekklister, varsling og AMU i én lovpålagt arbeidsflyt med digital signering og full sporbarhet.',
  },
  {
    slug: 'sjekklister',
    name: 'Sjekklister',
    number: 2,
    icon: 'checklist',
    eyebrow: 'Modul 2 av 6',
    headline: 'Vernerunder og samsvarssjekker, bygget for arbeidsmiljøloven',
    lede: 'Maler for vernerunder, ROS-vurderinger og ISO-revisjoner — med risikoscore og lovreferanse på hvert spørsmål.',
    longDescription:
      'Sjekklister gjør det lovpålagte risikoarbeidet til en strukturert hverdag. Hver mal har felter for sannsynlighet × konsekvens (1–25), automatisk kategorisering (lav / middels / høy / kritisk) og direkte kobling fra funn til avvik og tiltak. AML-pakken dekker §§3-1, 4-1 og 4-4; ISO 45001-pakken dekker §§9.2, 9.3 og 10.2.',
    capabilities: [
      {
        title: 'Risikomatrise innebygd',
        description:
          'Hvert funn får sannsynlighet × konsekvens. Kritiske og høye funn oppretter automatisk avvik med foreslåtte tiltak.',
      },
      {
        title: 'Multi-signering',
        description:
          'Utfører signerer gjennomføring; leder signerer godkjenning; arkivering låser revisjonen. Endringer etterpå krever ny revisjon.',
      },
      {
        title: 'Mal-bibliotek',
        description:
          'AML-pakken (vernerunde, brann/evakuering, kjemikalie, ergonomi), ISO 45001-pakken (intern revisjon, samsvar) og egne maler per organisasjon.',
      },
      {
        title: 'Sted og deltakelse',
        description:
          'Knytt sjekklisten til lokasjon, avdeling og deltakere etter at den er låst. Audit-sporet beholdes; metadata holdes oppdatert.',
      },
    ],
    standoutTitle: 'Risiko som tall, ikke følelse',
    standoutBody:
      'Risikoscore på hvert funn betyr at HMS-leder kan følge utviklingen av risikotyper over tid og på tvers av steder. Det er forskjellen på «vi har det under kontroll» og «vi kan dokumentere at vi har det under kontroll».',
    lawRefs: [
      { short: 'AML §3-1', full: 'HMS-ansvar', family: 'AML' },
      { short: 'AML §4-1', full: 'Generelle krav til arbeidsmiljø', family: 'AML' },
      { short: 'AML §4-4', full: 'Fysisk arbeidsmiljø', family: 'AML' },
      { short: 'IK-f §5 nr. 2', full: 'Risikokartlegging', family: 'IK-f' },
      { short: 'ISO 45001 §9.2', full: 'Intern revisjon', family: 'ISO' },
    ],
    related: ['oppgaver', 'dokumenter', 'undersokelser'],
    metaTitle: 'Sjekklister — Klarert | Vernerunder med risikoscore',
    metaDescription:
      'Strukturerte vernerunder og samsvarssjekker med risikomatrise (1–25), multi-signering og automatisk avviksoppretting. AML- og ISO 45001-maler innebygd.',
  },
  {
    slug: 'varslinger',
    name: 'Varslinger',
    number: 3,
    icon: 'alert',
    eyebrow: 'Modul 3 av 6',
    headline: 'Ett varslingssystem for AML kap. 2A og GDPR Art. 33',
    lede: 'Anonyme meldinger, personvernbrudd, HMS-hendelser og etiske bekymringer — én pipeline, to lovverk dekket.',
    longDescription:
      'Klarerts varslingsmodul forener det som vanligvis er fire separate systemer: AML-varsling (kap. 2A), GDPR-brudd (Art. 33), HMS-hendelser og etiske bekymringer. Anonymitet og taushetsplikt er kodet i databasen — ikke lagt på i etterkant. Identitetsfelt blir uredigerbare etter at saken er lukket, og konfidensielle saker vises bare for autoriserte roller.',
    capabilities: [
      {
        title: 'Anonym innsending',
        description:
          'Offentlig URL per org. Bruker får tilgangsnøkkel og kan følge sak uten å gi fra seg identitet. Vi vet ikke hvem du er — av design.',
      },
      {
        title: 'Lovpålagte tidsfrister',
        description:
          'Bekreftelse innen 5 dager, undersøkelse innen 6 uker — kodet inn i arbeidsflyten, ikke skrevet i en prosedyre som noen leser én gang.',
      },
      {
        title: 'Konfidensialitetsnivåer',
        description:
          'Standard / begrenset / konfidensiell. En tilgangsliste per sak styrer hvem som kan lese, basert på AML §2A-7 (5) og Datatilsynets veiledning.',
      },
      {
        title: 'Oppbevaring etter loven',
        description:
          '5 år for AML-saker, minst 5 år for yrkesskade (folketrygdloven), 30 år for kjemikalieeksponering. Sletting håndheves på databasenivå.',
      },
    ],
    standoutTitle: 'Compliance i arkitekturen, ikke i prosedyren',
    standoutBody:
      'Anonymitet i de fleste systemer er en avkrysningsboks i et skjema. I Klarert er det en RLS-policy på tabellen som gjør identitetsfelt ulesbare etter at saken er lukket. Du kan ikke ved et uhell logge varsleren — koden tillater det ikke.',
    lawRefs: [
      { short: 'AML §§2A-1 til 2A-7', full: 'Varsling om kritikkverdige forhold', family: 'AML' },
      { short: 'GDPR Art. 33', full: 'Melding av brudd til tilsynsmyndigheten', family: 'GDPR' },
      { short: 'GDPR Art. 34', full: 'Underretning av registrerte', family: 'GDPR' },
    ],
    related: ['oppgaver', 'sjekklister', 'dokumenter'],
    metaTitle: 'Varslinger — Klarert | AML kap. 2A + GDPR Art. 33',
    metaDescription:
      'Anonym varsling og GDPR-brudd i ett system. Taushetsplikt og oppbevaring kodet på databasenivå. 5-dagers bekreftelse, 6-ukers undersøkelsesfrist.',
  },
  {
    slug: 'dokumenter',
    name: 'Dokumenter',
    number: 4,
    icon: 'documents',
    eyebrow: 'Modul 4 av 6',
    headline: 'Wiki, prosedyrer og maler — med revisjonshistorikk',
    lede: 'HMS-håndbok, internkontrolldokumentasjon og prosedyrer som lever videre — versjonert, gjennomgangsdrevet, søkbart.',
    longDescription:
      'Dokumenter er Klarerts varige kunnskapslag. Hver side hører til et rom (HMS-prosedyrer, Internkontroll, Onboarding) og kan ha juridisk grunnlag, neste gjennomgangsdato og målgruppe som strukturerte felter. Maler styrer hva som må fylles ut, men sidene forblir redigerbare — hver endring blir en ny revisjon, ikke et nytt dokument.',
    capabilities: [
      {
        title: 'Skjema-drevet forfatting',
        description:
          'Maler kan kreve felter som "neste gjennomgang" eller "juridisk grunnlag". Compliance blir en del av strukturen, ikke en sjekkliste etter at det er skrevet.',
      },
      {
        title: 'Revisjonshistorikk',
        description:
          'Hver publisering oppretter en revisjon. Du kan alltid se hva som sto i håndboken for tre måneder siden — viktig under tilsyn.',
      },
      {
        title: 'Romsbasert tilgang',
        description:
          'Tilgang per dokumentrom, ikke per side. Verneombudet ser HMS-prosedyrer; leder ser også Internkontroll; HR ser også Onboarding.',
      },
      {
        title: 'Frister på gjennomgang',
        description:
          'Sider får varsel når neste gjennomgang nærmer seg. Forsinket / 30d / 60d / 90d / fremtidig — synlig i dashboardet.',
      },
    ],
    standoutTitle: 'Levende dokumenter, varige revisjoner',
    standoutBody:
      'Andre systemer låser dokumenter når de signeres. Klarert lar dokumenter leve, men beholder hver tidligere versjon. Tilsynet får det de trenger; teamet får et system de faktisk vil bruke.',
    lawRefs: [
      { short: 'IK-f §5 nr. 8', full: 'Dokumentasjonskrav for internkontroll', family: 'IK-f' },
      { short: 'AML §6-2', full: 'Dokumentasjon av tiltak', family: 'AML' },
    ],
    related: ['sjekklister', 'laering', 'oppgaver'],
    metaTitle: 'Dokumenter — Klarert | Versjonert HMS-håndbok og prosedyrer',
    metaDescription:
      'Wiki-basert HMS-håndbok og internkontrolldokumentasjon med revisjonshistorikk, skjema-drevne maler og frister på gjennomgang.',
  },
  {
    slug: 'laering',
    name: 'E-læring',
    number: 5,
    icon: 'learning',
    eyebrow: 'Modul 5 av 6',
    headline: 'Kurs, sertifikater og kompetansebevis',
    lede: 'Den lovpålagte HMS-grunnopplæringen (40 timer), brann, førstehjelp, verneombud og dine egne kurs — med utløpssporing.',
    longDescription:
      'E-læring i Klarert dekker både den lovpålagte HMS-grunnopplæringen for ledere og verneombud (AML §§3-5 og 6-5) og din egen interne kompetanseplan. Kursbygger med tekst, video, quiz og flashcards. Sertifikater utstedes med utløpsdato; deltakere får varsel før sertifikatet går ut.',
    capabilities: [
      {
        title: 'Lovpålagt 40-timers kurs',
        description:
          'Forhåndsbygget HMS-grunnopplæring for verneombud og medlemmer av arbeidsmiljøutvalg, modulbasert og med sertifikatsporing.',
      },
      {
        title: 'Sertifikatutløp som førsteklasses filter',
        description:
          'Filtrer på «utløper innen 30 dager» på dashbordet. Eksterne sertifikater (truckfører, varme arbeider) kan også registreres.',
      },
      {
        title: 'Bevart organisasjonskontekst',
        description:
          'Avdeling og lokasjon på fullføringstidspunktet låses i sertifikatet. Ansattoverføringer endrer ikke historiske attester — viktig for revisjon.',
      },
      {
        title: 'Kursbygger med versjonering',
        description:
          'Publisering oppretter et fast øyeblikksbilde for nye deltakere. Du kan endre kurset uten å ugyldiggjøre allerede utstedte sertifikater.',
      },
    ],
    standoutTitle: 'Sertifikater som husker hvor du var',
    standoutBody:
      'Da Frida fullførte førstehjelpskurset, jobbet hun i avdeling Drift. Tre år senere er hun i HR. Klarerts sertifikat husker fortsatt at det ble utstedt mens hun var i Drift — fordi det er det tilsynet vil se.',
    lawRefs: [
      { short: 'AML §3-5', full: 'Plikt for arbeidsgiver til opplæring', family: 'AML' },
      { short: 'AML §6-5', full: 'Opplæring av verneombud', family: 'AML' },
    ],
    related: ['dokumenter', 'oppgaver', 'sjekklister'],
    metaTitle: 'E-læring — Klarert | HMS-grunnopplæring og sertifikatsporing',
    metaDescription:
      'Lovpålagt HMS-kurs (40 timer) for ledere og verneombud, samt brann, førstehjelp og egne kurs. Sertifikatutløp som førsteklasses filter.',
  },
  {
    slug: 'undersokelser',
    name: 'Undersøkelser',
    number: 6,
    icon: 'survey',
    eyebrow: 'Modul 6 av 6',
    headline: 'Pulsundersøkelser, egenerklæringer og exit-intervjuer',
    lede: 'AMU-puls, egenerklæringer fra leverandører, exit-undersøkelser og kartlegginger — anonyme eller identifiserte.',
    longDescription:
      'Undersøkelser dekker både den jevnlige AMU-pulsen (kartlegging av psykososialt og fysisk arbeidsmiljø etter AML §4-2) og egenerklæringer fra leverandører under Åpenhetsloven. Anonyme undersøkelser kan fortsatt aggregeres på avdeling — vi henter respondentens avdeling fra invitasjonen uten å lagre individuelle svar mot identitet.',
    capabilities: [
      {
        title: 'Malpakker',
        description:
          'AMU-puls, egenerklæringer fra leverandører (Åpenhetsloven §5), exit-intervjuer, egenkontroller for compliance og kundefokuserte engasjementsmålinger.',
      },
      {
        title: 'Anonym eller identifisert',
        description:
          'Bytt mellom modusene per kampanje. Anonym skjuler både identitet og deltakerteller; identifisert sporer respondenten for oppfølging.',
      },
      {
        title: 'Anonym-vennlig aggregering',
        description:
          'Selv anonyme undersøkelser kan filtreres på avdeling — avdelingstilhørighet utledes fra invitasjonen, ikke fra svaret.',
      },
      {
        title: 'E-postutsending med påminnelser',
        description:
          'Innebygd invitasjon, påminnelse og lukketid. Resend-integrasjon for utsending; svarsporing per kampanje.',
      },
    ],
    standoutTitle: 'Anonymitet uten å miste innsikt',
    standoutBody:
      'Vi henter respondentens avdeling fra invitasjonen, ikke fra svaret. Du kan fortsatt si «Drift skårer 6,2 på psykososialt arbeidsmiljø denne måneden» uten å vite hvem som svarte hva.',
    lawRefs: [
      { short: 'AML §4-2', full: 'Krav til tilrettelegging og medvirkning', family: 'AML' },
      { short: 'IK-f §5 nr. 6', full: 'Systematisk overvåking', family: 'IK-f' },
      { short: 'GDPR Art. 5 (1)', full: 'Lovlighet og formålsbegrensning', family: 'GDPR' },
      { short: 'Åpenhetsloven §5', full: 'Aktsomhetsvurdering hos leverandører', family: 'Åpenhetsloven' },
    ],
    related: ['varslinger', 'oppgaver', 'dokumenter'],
    metaTitle: 'Undersøkelser — Klarert | AMU-puls og egenerklæringer fra leverandører',
    metaDescription:
      'Pulsundersøkelser, AML §4-2-kartlegging, exit-intervjuer og egenerklæringer etter Åpenhetsloven. Anonyme svar, aggregerbar innsikt.',
  },
]

export function featureBySlug(slug: string): ModuleFeature | undefined {
  return FEATURES.find((f) => f.slug === slug)
}
