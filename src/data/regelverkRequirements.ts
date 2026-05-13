// regelverkRequirements.ts
//
// Statisk registry over alle lovkrav per regelverk. Brukes av
// useRegelverkCoverage til å bygge en regelverk-dekning-oversikt.
//
// Hver requirement har:
//   - lawRef (kanonisk streng — matcher law_refs[]/legal_refs[] på moduler)
//   - title (kort beskrivelse)
//   - obligation (mandatory | recommended | conditional)
//   - applies (når er kravet aktuelt — eks: "≥ 10 ansatte")
//   - category (gruppering for visning)
//   - description (lovtekst-utdrag / autoritativ oppsummering)
//
// Synkronisert manuelt med specs/aml-requirements-inventory.md.

export type Regelverk = {
  id: string
  label: string
  fullName: string
  description: string
}

export type Requirement = {
  regelverkId: string
  lawRef: string                    // matcher law_refs/legal_refs på moduler
  title: string
  obligation: 'mandatory' | 'recommended' | 'conditional'
  applies?: string                  // når aktuelt (eks: "≥ 10 ansatte")
  category: string
  description?: string
  alternateRefs?: string[]          // alternative skrivemåter (eks: 'AML §3-1', 'AML § 3-1 (2c)')
}

export const REGELVERK: Regelverk[] = [
  { id: 'aml', label: 'AML', fullName: 'Arbeidsmiljøloven', description: 'Lov om arbeidsmiljø, arbeidstid og stillingsvern (2005)' },
  { id: 'ik-f', label: 'IK-f', fullName: 'Internkontroll­forskriften', description: 'Forskrift om systematisk HMS-arbeid (1996)' },
  { id: 'ldl', label: 'LDL', fullName: 'Likestillings- og diskriminerings­loven', description: 'Lov om likestilling og forbud mot diskriminering (2017)' },
  { id: 'gdpr', label: 'GDPR', fullName: 'GDPR / Personopplysningsloven', description: 'EUs personvern­forordning + norsk lov (2018)' },
  { id: 'folm', label: 'FOLM', fullName: 'Forskrift om organisering, ledelse og medvirkning', description: 'Verneombud, AMU, vernerunder (2011)' },
  { id: 'brannvern', label: 'Brannvern', fullName: 'Brann- og eksplosjons­vernloven', description: 'Lov om vern mot brann (2002)' },
  { id: 'apenhet', label: 'Åpenhet', fullName: 'Åpenhets­loven', description: 'Lov om virksomheters åpenhet og arbeid med menneske­rettigheter (2021)' },
  { id: 'bht', label: 'BHT-f', fullName: 'BHT-forskriften', description: 'Forskrift om bedriftshelse­tjeneste (2011)' },
  { id: 'utf-arb', label: 'Utf.arb', fullName: 'Forskrift om utførelse av arbeid', description: 'Kjemikalier, asbest, støy, vibrasjon, ergonomi (2011)' },
]

export const REQUIREMENTS: Requirement[] = [
  // ─── AML kap. 2 — Plikter ──────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 2-1', title: 'Arbeidsgivers ansvar',
    obligation: 'mandatory', category: 'Kap. 2 — Plikter',
    description: 'Arbeidsgiver skal sørge for at bestemmelsene gitt i og i medhold av denne loven blir overholdt. Plikten gjelder enhver virksomhet der det sysselsettes arbeidstakere, uavhengig av antall ansatte og bransje. Arbeidsgiver kan ikke fraskrive seg dette ansvaret ved å delegere oppgaver til andre.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2-2', title: 'Konsulent og oppdragstaker',
    obligation: 'mandatory', category: 'Kap. 2 — Plikter',
    description: 'Arbeidsgiver skal sørge for at bestemmelsene gitt i og i medhold av denne loven er oppfylt også for innleide arbeidstakere og selvstendige som utfører arbeid i tilknytning til dennes aktivitet og som ikke er selvstendig næringsvirksomhet. Plikten gjelder i den utstrekning arbeidsgiver direkte styrer arbeidet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2-3', title: 'Arbeidstakers plikter',
    obligation: 'mandatory', category: 'Kap. 2 — Plikter',
    description: 'Arbeidstaker skal medvirke ved gjennomføringen av de tiltak som blir iverksatt for å skape et godt og sikkert arbeidsmiljø. Arbeidstaker skal bruke påbudt verneutstyr, stanse maskin eller annet arbeidsutstyr dersom det oppstår feil som kan medføre fare, og melde fra om uheldige eller farlige forhold til verneombudet, arbeidsmiljøutvalget eller arbeidsgiver.',
  },

  // ─── AML kap. 2A — Varsling ────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 2A-1', title: 'Rett til å varsle',
    obligation: 'mandatory', category: 'Kap. 2A — Varsling',
    description: 'Arbeidstaker har rett til å varsle om kritikkverdige forhold i arbeidsgivers virksomhet. Innleid arbeidstaker har tilsvarende rett til å varsle om kritikkverdige forhold i virksomheten til innleier. Med kritikkverdige forhold menes forhold som er i strid med rettsregler, skriftlige etiske retningslinjer i virksomheten, eller etiske normer som det er bred tilslutning til i samfunnet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2A-2', title: 'Skriftlig varslings­rutine',
    obligation: 'mandatory', applies: '≥ 5 ansatte', category: 'Kap. 2A — Varsling',
    description: 'Arbeidsgiver med minst fem arbeidstakere skal ha skriftlige rutiner for intern varsling. Rutinene skal inneholde: oppfordring til å varsle om kritikkverdige forhold, fremgangsmåte for varsling, fremgangsmåte for mottak, behandling og oppfølging av varsling, og opplysninger om at varslerens identitet er vernet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2A-3', title: 'Ekstern varsling',
    obligation: 'mandatory', category: 'Kap. 2A — Varsling',
    description: 'Arbeidstaker kan varsle eksternt til offentlig tilsynsmyndighet eller andre offentlige myndigheter. Ekstern varsling er alltid lovlig dersom arbeidstaker er i aktsom god tro om innholdet i varselet, varselet gjelder kritikkverdige forhold, og arbeidstaker har tatt opp saken internt eller har grunn til å tro at intern varsling ikke vil føre frem.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2A-4', title: 'Vern mot gjengjeldelse',
    obligation: 'mandatory', category: 'Kap. 2A — Varsling',
    description: 'Gjengjeldelse mot arbeidstaker som varsler i samsvar med § 2A-1 er forbudt. Som gjengjeldelse regnes enhver ugunstig handling, praksis eller unnlatelse som er en følge av eller en reaksjon på at arbeidstaker har varslet, f.eks. oppsigelse, omplassering, endring av arbeidsoppgaver, endring av lønn eller negative sosiale sanksjoner.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 2A-6', title: 'Behandling av varslers identitet',
    obligation: 'mandatory', category: 'Kap. 2A — Varsling',
    description: 'Varslerens identitet skal ikke videreformidles uten varslerens samtykke med mindre dette er nødvendig for å følge opp varselet. Identiteten til den det varsles om skal heller ikke videreformidles unødvendig. Begge parter har krav på å bli informert om at varsling har funnet sted.',
  },

  // ─── AML kap. 3 — Virkemidler ──────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 3-1', title: 'Systematisk HMS-arbeid',
    obligation: 'mandatory', category: 'Kap. 3 — Virkemidler',
    description: 'Arbeidsgiver skal iverksette tiltak for å sørge for at systematisk arbeid med helse, miljø og sikkerhet skjer på alle plan i virksomheten. Dette skal gjøres i samarbeid med arbeidstakerne og deres tillitsvalgte. Systematisk HMS-arbeid innebærer å: kartlegge farer og problemer, vurdere risiko, utarbeide tilhørende planer og iverksette tiltak for å redusere risikoforholdene, samt ha kontinuerlig oppfølging.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 3-2', title: 'Opplæring og instruksjon for arbeidstakere',
    obligation: 'mandatory', category: 'Kap. 3 — Virkemidler',
    description: 'Arbeidsgiver skal sørge for at arbeidstaker gjøres kjent med ulykkes- og helsefarer som kan være forbundet med arbeidet, og at arbeidstaker får den opplæring, øvelse og instruksjon som er nødvendig. Arbeidsgiver skal sørge for at arbeidstaker som har til oppgave å lede eller kontrollere andre arbeidstakere, har nødvendig kompetanse til å ivareta helse, miljø og sikkerhet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 3-3', title: 'BHT-tilknytning',
    obligation: 'conditional', applies: 'Bransje-spesifikk', category: 'Kap. 3 — Virkemidler',
    description: 'Virksomheter i særlig risikoutsatte bransjer, som oppført i BHT-forskriften, skal knytte til seg en bedriftshelsetjeneste (BHT) godkjent av Arbeidstilsynet. BHT skal bistå arbeidsgiver, arbeidstakere, arbeidsmiljøutvalget og verneombudet med å skape sunne og trygge arbeidsforhold, og har en selvstendig og uavhengig faglig stilling.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 3-4', title: 'Sykefraværs­oppfølging',
    obligation: 'mandatory', category: 'Kap. 3 — Virkemidler',
    description: 'Arbeidsgiver skal i samråd med arbeidstaker utarbeide oppfølgingsplan for tilbakeføring til arbeid i forbindelse med sykefravær senest innen fire uker. Planen skal inneholde en vurdering av arbeidstakers arbeidsoppgaver og arbeidsevne. Arbeidsgiver skal innkalle til dialogmøte innen sju uker ved langvarig sykefravær.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 3-5', title: 'Arbeidsgivers HMS-opplæring',
    obligation: 'mandatory', category: 'Kap. 3 — Virkemidler',
    description: 'Arbeidsgiver skal gjennomgå opplæring i helse-, miljø- og sikkerhetsarbeid. Øverste leder og andre i lederrollen med personalansvar plikter å ha tilstrekkelig kunnskap om systematisk HMS-arbeid til å kunne ivareta sine forpliktelser etter loven og internkontrollforskriften.',
  },

  // ─── AML kap. 4 — Krav til arbeidsmiljø ────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 4-1', title: 'Generelt forsvarlig arbeidsmiljø',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Arbeidsmiljøet i virksomheten skal være fullt forsvarlig ut fra en enkeltvis og samlet vurdering av faktorer i arbeidsmiljøet som kan innvirke på arbeidstakernes fysiske og psykiske helse og velferd. Standarden for fullt forsvarlig arbeidsmiljø utvikles løpende med utviklingen i samfunnet og tar hensyn til den tekniske og sosiale utvikling.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 4-2', title: 'Medvirkning + endrings­kartlegging',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Arbeidstaker og arbeidsgivers representanter skal, med sikte på å sikre fullt forsvarlig arbeidsmiljø, delta aktivt i organiserte vernetiltak. Arbeidstaker skal involveres i planleggingen og gjennomføringen av endringer som kan ha innvirkning på arbeidsmiljøet. Endringer i teknologi, arbeidsorganisasjon eller arbeidsstokkens sammensetning skal kartlegges og risikovurderes i samarbeid med arbeidstakerne.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 4-3', title: 'Psykososialt arbeidsmiljø',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Arbeidet skal legges til rette slik at arbeidstakers integritet og verdighet ivaretas. Arbeidstaker skal ikke utsettes for trakassering eller annen utilbørlig adferd. Arbeidstaker skal, så langt det er mulig, beskyttes mot vold, trusler og uheldige belastninger som følge av kontakt med andre. Arbeidsplanen skal utformes slik at uheldige psykiske belastninger unngås.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 4-4', title: 'Fysisk arbeidsmiljø',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Fysiske arbeidsmiljøfaktorer som bygninger, tekniske innretninger og utstyr skal være fullt forsvarlig utformet. Arbeidsplassen skal innrettes for ulike arbeidstakeres behov. Støy, stråling, temperatur, belysning og andre faktorer skal ikke utsette arbeidstaker for helseskadelige belastninger. Innendørs klima og luftkvalitet skal være tilfredsstillende.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 4-5', title: 'Kjemikalier og biologisk materiale',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Ved håndtering av kjemikalier eller biologisk materiale skal arbeidsgiver sørge for at arbeidstaker ikke utsettes for helse- og miljøfarlige kjemikalier i større utstrekning enn nødvendig. Arbeidsgiver skal sørge for at det foreligger et stoffkartotek over kjemikalier som brukes i virksomheten, og at arbeidstakerne er opplært i forsvarlig bruk.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 4-6', title: 'Tilretteleggings­plikt',
    obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø',
    description: 'Hvis en arbeidstaker har fått redusert arbeidsevne som følge av ulykke, sykdom, slitasje eller lignende, skal arbeidsgiver, så langt det er mulig, iverksette nødvendige tiltak for at arbeidstaker skal kunne beholde eller få et passende arbeid. Arbeidstaker skal fortrinnsvis gis anledning til å fortsette i sitt vanlige arbeid, eventuelt etter særskilt tilrettelegging.',
  },

  // ─── AML kap. 5 — Skade ────────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 5-1', title: 'Registrering av skade og sykdom',
    obligation: 'mandatory', category: 'Kap. 5 — Skade',
    description: 'Arbeidsgiver skal registrere alle personskader som oppstår under utførelse av arbeid. Sykdom som antas å ha sin grunn i arbeidet skal også registreres. Registeret skal oppbevares og stilles til rådighet for Arbeidstilsynet og representanter for arbeidstakerne.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 5-2', title: 'Arbeidsgivers melding (NAV)',
    obligation: 'mandatory', applies: 'Ved skade', category: 'Kap. 5 — Skade',
    description: 'Arbeidsgiver skal snarest og senest innen tre dager etter at arbeidsgiver fikk kunnskap om en yrkesskade melde fra til NAV om skader som skyldes arbeidsulykke eller yrkessykdom. Meldeplikten gjelder også ved alvorlige ulykker til Arbeidstilsynet og politiet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 5-3', title: 'Arbeidstakers melding',
    obligation: 'mandatory', category: 'Kap. 5 — Skade',
    description: 'Arbeidstaker skal melde fra til arbeidsgiver om arbeidsulykker og yrkessykdommer snarest mulig. Arbeidstaker har plikt til å opplyse om alle relevante omstendigheter ved skaden eller sykdommen, slik at arbeidsgiver kan oppfylle sin meldeplikt til NAV og Arbeidstilsynet.',
  },

  // ─── AML kap. 6 — Verneombud ───────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 6-1', title: 'Verneombud pliktig',
    obligation: 'mandatory', applies: '≥ 10 ansatte', category: 'Kap. 6 — Verneombud',
    description: 'I virksomhet der det jevnlig sysselsettes minst 10 arbeidstakere, skal det velges verneombud. I virksomhet med under 10 arbeidstakere kan arbeidstaker og arbeidsgiver skriftlig avtale en annen ordning, herunder at en av arbeidstakerne ivaretar verneombudsfunksjonen. Arbeidstilsynet kan pålegge enkeltvirksomheter å velge verneombud.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 6-2', title: 'Verneombudets oppgaver',
    obligation: 'mandatory', category: 'Kap. 6 — Verneombud',
    description: 'Verneombudet skal ivareta arbeidstakernes interesser i saker som angår arbeidsmiljøet. Verneombudet skal se til at virksomheten er innrettet og vedlikeholdt, og at arbeidet blir utført på en slik måte at hensynet til arbeidstakernes sikkerhet, helse og velferd er ivaretatt i samsvar med denne lov. Verneombudet skal delta ved planlegging av tiltak og ha tilgang til alle relevante HMS-dokumenter.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 6-3', title: 'Stansingsretten',
    obligation: 'mandatory', category: 'Kap. 6 — Verneombud',
    description: 'Finner verneombudet at det foreligger overhengende fare for arbeidstakernes liv eller helse, og faren ikke straks kan avverges på annen måte, kan arbeidet stanses inntil Arbeidstilsynet har tatt stilling til om arbeidet kan gjenopptas. Verneombudet skal straks underrette arbeidsgiver om stansingen.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 6-4', title: 'Kommunikasjon med Tilsynet',
    obligation: 'mandatory', category: 'Kap. 6 — Verneombud',
    description: 'Verneombudet har rett til å ta kontakt med Arbeidstilsynet uten hinder av den taushetsplikt som ellers gjelder i virksomheten. Arbeidsgiver kan ikke instruere verneombudet til å unnlate å ta kontakt med Arbeidstilsynet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 6-5', title: '40-timers opplæring (verneombud)',
    obligation: 'mandatory', category: 'Kap. 6 — Verneombud',
    description: 'Verneombud og medlemmer av arbeidsmiljøutvalget skal få den opplæring som er nødvendig for å kunne utføre vervet på forsvarlig måte. Opplæringen skal minst tilsvare den opplæring som er gitt i et godkjent kurs på 40 timer. Arbeidsgiver skal sørge for at opplæringen gjennomføres og bekoster dette.',
  },

  // ─── AML kap. 7 — AMU ──────────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 7-1', title: 'AMU pliktig',
    obligation: 'mandatory', applies: '≥ 30 ansatte', category: 'Kap. 7 — AMU',
    description: 'I virksomhet hvor det jevnlig sysselsettes minst 30 arbeidstakere, skal det opprettes et arbeidsmiljøutvalg (AMU). AMU skal bestå av representanter for henholdsvis arbeidsgiver og arbeidstakere. Bedriftshelsetjenestens representant deltar i AMU dersom slik tjeneste er knyttet til virksomheten.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 7-2', title: 'AMUs oppgaver og vedtaks­rett',
    obligation: 'mandatory', category: 'Kap. 7 — AMU',
    description: 'Arbeidsmiljøutvalget skal virke for gjennomføringen av et fullt forsvarlig arbeidsmiljø i virksomheten. Utvalget skal delta i planleggingen av verne- og miljøarbeidet, og nøye følge utviklingen i spørsmål som angår arbeidstakernes sikkerhet, helse og velferd. AMU kan med bindende virkning bestemme at arbeidsgiver skal gjennomføre konkrete tiltak til utbedring av arbeidsmiljøet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 7-3', title: 'Habilitet i AMU',
    obligation: 'mandatory', category: 'Kap. 7 — AMU',
    description: 'Vedkommende arbeidsgiver, leder av virksomheten, eller den som i arbeidsgivers sted leder virksomheten, er inhabil i saker som gjelder kontrolltiltak rettet mot dem selv, eller der de har en personlig interesse som er egnet til å svekke tilliten til deres upartiskhet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 7-4', title: 'AMU årsrapport',
    obligation: 'mandatory', category: 'Kap. 7 — AMU',
    description: 'Arbeidsmiljøutvalget skal hvert år gi rapport om sin virksomhet til de organer som etter lov eller vedtekter har ansvar for virksomhetens ledelse. Årsrapporten skal blant annet inneholde oversikt over saker behandlet av utvalget, vedtak fattet og tiltak iverksatt.',
  },

  // ─── AML kap. 8 — Drøfting ─────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 8-1', title: 'Drøftings­plikt',
    obligation: 'mandatory', applies: '≥ 50 ansatte', category: 'Kap. 8 — Drøfting',
    description: 'I virksomhet som jevnlig sysselsetter minst 50 arbeidstakere, skal arbeidsgiver informere om og drøfte spørsmål av betydning for arbeidstakernes arbeidsforhold med de tillitsvalgte. Drøftingsplikten gjelder blant annet ved planlagte endringer i virksomheten, herunder endringer i bemanningssituasjonen og i arbeidsorganiseringen.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 8-2', title: 'Form og fremgangsmåte',
    obligation: 'mandatory', category: 'Kap. 8 — Drøfting',
    description: 'Informasjon og drøfting skal skje på det nivå i virksomheten der beslutningene fattes, og på et tidspunkt og i en form som gjør det mulig for de tillitsvalgte å foreta en adekvat vurdering og forberede drøftingene. Arbeidsgiver skal gi representantene tilgang til nødvendig informasjon i god tid.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 8-3', title: 'Konfidensialitet',
    obligation: 'mandatory', category: 'Kap. 8 — Drøfting',
    description: 'Arbeidsgiver kan pålegge de tillitsvalgte og eksperter som bistår dem, taushetsplikt om mottatt informasjon som er av en slik art at det ville skade virksomheten om den ble kjent. Taushetspliktpålegget skal ha en begrenset varighet og en saklig begrunnelse.',
  },

  // ─── AML kap. 9 — Kontrolltiltak ───────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 9-1', title: 'Vilkår for kontrolltiltak',
    obligation: 'conditional', applies: 'Ved overvåking', category: 'Kap. 9 — Kontrolltiltak',
    description: 'Arbeidsgiver kan iverksette kontrolltiltak overfor arbeidstaker dersom tiltaket har saklig grunn i virksomhetens forhold og det ikke innebærer en uforholdsmessig belastning for arbeidstakeren. Proporsjonalitetsvurderingen skal avveie virksomhetens behov for kontroll mot den inngripende karakter for den enkelte arbeidstaker.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 9-2', title: 'Drøfting før kontrolltiltak',
    obligation: 'mandatory', category: 'Kap. 9 — Kontrolltiltak',
    description: 'Arbeidsgiver plikter å drøfte behov, utforming, gjennomføring og vesentlig endring av kontrolltiltak i virksomheten med arbeidstakernes tillitsvalgte så tidlig som mulig. Arbeidstakerne skal ha skriftlig informasjon om formålet med kontrollen, praktiske konsekvenser og antatt varighet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 9-3', title: 'Innsyn i e-post',
    obligation: 'conditional', category: 'Kap. 9 — Kontrolltiltak',
    description: 'Arbeidsgiver kan kun gjennomsøke arbeidstakers e-postkasse dersom det er nødvendig for å ivareta den daglige driften, ved begrunnet mistanke om at arbeidstaker bruker e-postkassen i strid med arbeidsavtalen, eller ved begrunnet mistanke om straffbare handlinger. Arbeidstaker skal varsles i forkant og har rett til å være til stede.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 9-4', title: 'Helse­opplysninger',
    obligation: 'mandatory', category: 'Kap. 9 — Kontrolltiltak',
    description: 'Arbeidsgiver har ikke rett til å innhente helseopplysninger om en arbeidssøker med mindre opplysningene er nødvendige for å utføre de arbeidsoppgaver som knytter seg til stillingen. Det er kun tillatt å be om helseopplysninger der stillingens art tilsier det, og opplysningene er relevante og nødvendige for stillingsutøvelsen.',
  },

  // ─── AML kap. 10 — Arbeidstid ──────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 10-2', title: 'Krav til arbeidstidsordninger',
    obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid',
    description: 'Arbeidstidsordninger skal være slik at arbeidstakerne ikke utsettes for uheldige fysiske eller psykiske belastninger, og slik at det er mulig å ivareta sikkerhetshensyn. Ordningene skal gi mulighet for tilstrekkelig hvile og fritid, samt hensyn til arbeidstakernes familiesituasjon og behov for tilrettelegging.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 10-4', title: 'Alminnelig arbeidstid',
    obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid',
    description: 'Den alminnelige arbeidstid må ikke overstige ni timer i løpet av 24 timer og 40 timer i løpet av sju dager. For skiftarbeid og annet turnusarbeid gjelder særskilte regler som gir redusert normal arbeidstid ned til 33,6 timer per uke for særlig belastende arbeid.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 10-5', title: 'Gjennomsnitts­beregning',
    obligation: 'conditional', category: 'Kap. 10 — Arbeidstid',
    description: 'Arbeidsgiver og arbeidstaker kan skriftlig avtale at den alminnelige arbeidstiden i løpet av en periode på høyst 52 uker gjennomsnittlig ikke overstiger lovens grenser. Arbeidstiden i den enkelte uke kan ikke overstige 10 timer uten slik avtale, eller 12,5 timer med avtale med tillitsvalgte.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 10-6', title: 'Overtid',
    obligation: 'conditional', category: 'Kap. 10 — Arbeidstid',
    description: 'Arbeid utover lovens grenser for alminnelig arbeidstid er overtidsarbeid. Samlet overtid skal ikke overstige 10 timer i løpet av sju dager, 25 timer i løpet av fire sammenhengende uker og 200 timer i løpet av 52 uker. Overtidsarbeid skal godtgjøres med et tillegg til ordinær lønn på minst 40 prosent.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 10-8', title: 'Daglig og ukentlig hvile',
    obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid',
    description: 'Arbeidstaker skal ha minst 11 timer sammenhengende arbeidsfri i løpet av 24 timer og minst 35 timer sammenhengende arbeidsfri i løpet av sju dager. Hviletiden skal fortrinnsvis legges til nattestid. Reduksjon av hvileperiodene krever tariffavtale eller avtale med tillitsvalgte.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 10-9', title: 'Pauser',
    obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid',
    description: 'Arbeidstaker skal ha minst én pause dersom den daglige arbeidstid overstiger fem og en halv time. Er arbeidstiden minst åtte timer, skal pausene til sammen utgjøre minst en halv time. Arbeidstaker som ikke kan forlate arbeidsstedet under pausen, skal ha pausetid godtgjort som arbeidstid.',
  },

  // ─── AML kap. 11 — Barn og ungdom ──────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 11-1', title: 'Forbud mot arbeid av barn',
    obligation: 'conditional', applies: 'Ved < 18 år', category: 'Kap. 11 — Barn og ungdom',
    description: 'Barn under 15 år eller barn som er skolepliktige, kan ikke utføre industriarbeid eller annet arbeid som Kongen har forbudt ved forskrift. Barn mellom 13 og 15 år kan utføre lett arbeid som ikke skader helse, utvikling eller skolegang, når det foreligger samtykke fra foresatte.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 11-2', title: 'Samtykke fra foresatte',
    obligation: 'conditional', category: 'Kap. 11 — Barn og ungdom',
    description: 'Barn mellom 13 og 15 år kan utføre lett arbeid som ikke skader helse, utvikling eller skolegang. Slikt arbeid krever skriftlig samtykke fra foreldre eller foresatte. Arbeidsgiver skal kontrollere at samtykke er innhentet, og at arbeidet er av slik art at det er lovlig for aldersgruppen.',
  },

  // ─── AML kap. 13 — Diskriminering ──────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 13-1', title: 'Forbud mot diskriminering',
    obligation: 'mandatory', category: 'Kap. 13 — Diskriminering',
    description: 'Direkte og indirekte diskriminering på grunn av politisk syn, medlemskap i arbeidstakerorganisasjon, alder, seksuell orientering, funksjonshemming eller kombinasjoner av disse grunnlag er forbudt. Forbudet gjelder alle sider ved arbeidsforholdet, fra utlysning og ansettelse til opphør.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 13-2', title: 'Anvendelses­område',
    obligation: 'mandatory', category: 'Kap. 13 — Diskriminering',
    description: 'Diskrimineringsforbudet gjelder alle sider ved arbeidsforholdet, herunder utlysning av stilling, ansettelse, omplassering, forfremmelse, opplæring og annen kompetanseutvikling, lønns- og arbeidsvilkår og opphør av arbeidsforhold. Det gjelder også for selvstendig næringsdrivende og innleide arbeidstakere.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 13-4', title: 'Innhenting av opplysninger',
    obligation: 'mandatory', category: 'Kap. 13 — Diskriminering',
    description: 'Arbeidsgiver må ikke i utlysning etter nye arbeidstakere eller på annen måte be om at søkerne skal gi opplysninger om seksuell orientering, etnisk bakgrunn, religion, livssyn eller nedsatt funksjonsevne. Unntak gjelder dersom slike opplysninger er nødvendige for utøvelse av stillingen.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 13-7', title: 'Trakassering',
    obligation: 'mandatory', category: 'Kap. 13 — Diskriminering',
    description: 'Trakassering og instruks om å trakassere noen på grunnlag av de diskrimineringsvernede egenskapene er forbudt. Med trakassering menes handlinger, unnlatelser eller ytringer som har som formål eller virkning å være krenkende, skremmende, fiendtlige, nedverdigende eller ydmykende. Arbeidsgiver plikter å forebygge og håndtere trakassering aktivt.',
  },

  // ─── AML kap. 14 — Ansettelse ──────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 14-5', title: 'Skriftlig arbeidsavtale',
    obligation: 'mandatory', category: 'Kap. 14 — Ansettelse',
    description: 'Det skal inngås skriftlig arbeidsavtale i alle arbeidsforhold. I arbeidsforhold med en samlet varighet på mer enn en måned skal skriftlig arbeidsavtale foreligge snarest mulig og senest en måned etter at arbeidsforholdet begynte. For kortere ansettelsesforhold skal arbeidsavtalen inngås umiddelbart.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 14-6', title: 'Innholds­krav (14 punkter)',
    obligation: 'mandatory', category: 'Kap. 14 — Ansettelse',
    description: 'Arbeidsavtalen skal inneholde opplysninger om: partenes identitet, arbeidsplassen, stillingstittel og en kort stillingsbeskrivelse, tiltredelsestidspunkt, eventuelle prøvetid, rett til ferie og feriepenger, lønn og andre godtgjørelser, arbeidstid, oppsigelsesfrister, og eventuelle tariffavtaler som regulerer arbeidsforholdet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 14-7', title: 'Endring i arbeidsforhold',
    obligation: 'mandatory', category: 'Kap. 14 — Ansettelse',
    description: 'Endringer i arbeidsforholdet som er av vesentlig betydning, skal nedfelles i arbeidsavtalen eller inntas i særskilt tillegg til denne, så snart som mulig og senest en måned etter at endringen trådte i kraft. Dette gjelder for eksempel endringer i stillingstittel, arbeidssted eller vesentlige lønnsendringer.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 14-9', title: 'Midlertidig ansettelse',
    obligation: 'conditional', category: 'Kap. 14 — Ansettelse',
    description: 'Arbeidstaker skal ansettes fast som hovedregel. Avtale om midlertidig ansettelse kan likevel inngås når arbeidets karakter tilsier det og arbeidet atskiller seg fra det som ordinært utføres i virksomheten, ved vikariat, praksisarbeid og deltakere i arbeidsmarkedstiltak. Midlertidig ansatt som har vært sammenhengende i virksomheten i mer enn tre år, anses som fast ansatt.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 14-10', title: 'Åremål',
    obligation: 'conditional', category: 'Kap. 14 — Ansettelse',
    description: 'Det kan inngås avtale om åremålsansettelse for øverste leder i virksomheten dersom dette er fastsatt i vedtektene. Åremålsperioden skal være på minst tre år. Ved utløp av åremålsperioden kan ny åremålsperiode avtales, men kun dersom lederstillingen er utlyst på nytt.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 14-12', title: 'Innleide og likebehandling',
    obligation: 'mandatory', category: 'Kap. 14 — Ansettelse',
    description: 'Arbeidsgiver som leier inn arbeidstakere fra bemanningsforetak, skal sørge for at disse lønnes og innrømmes arbeidsvilkår på minst like gunstige vilkår som det som ville gjeldt dersom arbeidstaker hadde vært ansatt direkte hos innleier for å utføre det samme arbeidet. Innleier har solidaransvar for utbetaling av lønn.',
  },

  // ─── AML kap. 15 — Opphør ──────────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 15-1', title: 'Drøfting før oppsigelse',
    obligation: 'mandatory', category: 'Kap. 15 — Opphør',
    description: 'Før arbeidsgiver fatter beslutning om oppsigelse, skal spørsmålet så langt det er praktisk mulig drøftes med arbeidstaker og med arbeidstakers tillitsvalgte, med mindre arbeidstaker selv ikke ønsker det. Drøftingen skal finne sted i et møte der begge parter er til stede og har mulighet til å fremlegge sin sak.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-2', title: 'Masseoppsigelser',
    obligation: 'conditional', applies: '≥ 10 oppsigelser i 30 dgr', category: 'Kap. 15 — Opphør',
    description: 'Arbeidsgiver som vurderer å gå til masseoppsigelser av minst 10 arbeidstakere i løpet av 30 dager, skal innlede drøftinger med arbeidstakernes tillitsvalgte snarest mulig. Arbeidsgiver skal gi Nav skriftlig melding om planlagte masseoppsigelser. Oppsigelsene trer tidligst i kraft 30 dager etter at Nav har mottatt meldingen.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-3', title: 'Oppsigelses­frister',
    obligation: 'mandatory', category: 'Kap. 15 — Opphør',
    description: 'Den gjensidige oppsigelsesfrist er én måned dersom ikke annet er skriftlig avtalt eller fastsatt i tariffavtale. Fristen øker med ansettelsestid: to måneder etter to år, tre måneder etter fem år, fire måneder etter ti år, fem måneder etter tolv år, og seks måneder etter 15 år.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-4', title: 'Skriftlig oppsigelse',
    obligation: 'mandatory', category: 'Kap. 15 — Opphør',
    description: 'Oppsigelse fra arbeidsgiver skal skje skriftlig og leveres til arbeidstaker personlig eller sendes rekommandert til arbeidstakers oppgitte adresse. Oppsigelsen skal inneholde opplysninger om arbeidstakers rett til å kreve forhandling og reise søksmål, om de frister som gjelder for dette, og om hvem som er arbeidsgiver og rett saksøkt.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-7', title: 'Vern mot usaklig oppsigelse',
    obligation: 'mandatory', category: 'Kap. 15 — Opphør',
    description: 'Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens, arbeidsgivers eller arbeidstakers forhold. Oppsigelse begrunnet i driftsinnskrenkninger eller rasjonaliseringstiltak er ikke saklig begrunnet dersom arbeidsgiver har et annet passende arbeid å tilby arbeidstaker i virksomheten.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-10', title: 'Vern ved verneplikt',
    obligation: 'conditional', category: 'Kap. 15 — Opphør',
    description: 'Arbeidstaker som er fraværende fra arbeidet på grunn av lovbestemt militærtjeneste eller annen verneplikt, kan ikke av den grunn sies opp. Oppsigelse som finner sted i slik periode, antas å ha denne årsak med mindre noe annet gjøres overveiende sannsynlig.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-13', title: 'Suspensjon',
    obligation: 'conditional', category: 'Kap. 15 — Opphør',
    description: 'Arbeidsgiver kan suspendere arbeidstaker fra stillingen dersom det foreligger grunn til å undersøke om arbeidstakeren er skyldig i forhold som kan medføre avskjed, og virksomhetens behov tilsier det. Arbeidstaker beholder lønn under suspensjonen. Suspensjonen skal opphøre snarest mulig og senest tre måneder etter at den ble iverksatt.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-14', title: 'Avskjed',
    obligation: 'conditional', category: 'Kap. 15 — Opphør',
    description: 'Arbeidsgiver kan avskjedige en arbeidstaker med påbud om øyeblikkelig fratreden dersom denne har gjort seg skyldig i grovt pliktbrudd eller annet vesentlig mislighold av arbeidsavtalen. Terskelen for avskjed er høy — det kreves klart klanderverdig atferd. Avskjed skal skje skriftlig og kan bringes inn for domstolene.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 15-15', title: 'Sluttattest',
    obligation: 'mandatory', category: 'Kap. 15 — Opphør',
    description: 'Arbeidstaker som fratrer sin stilling etter lovlig oppsigelse eller der arbeidsforholdet ellers avsluttes, har krav på skriftlig sluttattest fra arbeidsgiver. Attesten skal minst inneholde opplysninger om arbeidstakers navn, fødselsdato, hva arbeidet har bestått i, og om arbeidsforholdets varighet.',
  },

  // ─── AML kap. 16 — Overdragelse ────────────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 16-1', title: 'Virksomhets­overdragelse — virkeområde',
    obligation: 'conditional', category: 'Kap. 16 — Overdragelse',
    description: 'Reglene i kapittel 16 gjelder for overdragelse av en virksomhet eller del av virksomhet til en annen arbeidsgiver. Med overdragelse menes overføring av en selvstendig enhet som beholder sin identitet, forstått som en samling ressurser som er organisert med det formål å drive en økonomisk virksomhet, enten denne er hoved- eller bivirksomhet.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 16-2', title: 'Overført lønn og vilkår',
    obligation: 'mandatory', category: 'Kap. 16 — Overdragelse',
    description: 'Tidligere arbeidsgivers rettigheter og plikter som følger av arbeidsavtale eller arbeidsforhold som bestod på det tidspunkt overdragelsen finner sted, overføres til den nye arbeidsgiver. Den nye arbeidsgiver er bundet av tariffavtale som den tidligere arbeidsgiver var bundet av, med mindre den nye arbeidsgiver senest innen tre uker etter overdragelsen gir skriftlig varsel om det motsatte.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 16-5', title: 'Drøftings­plikt ved overdragelse',
    obligation: 'mandatory', category: 'Kap. 16 — Overdragelse',
    description: 'Så tidlig som mulig, og normalt senest tre uker før det fattes endelig vedtak om overdragelse, skal arbeidsgiver gi representanter for de berørte arbeidstakere informasjon om overdragelsen. Partene skal deretter drøfte overdragelsen med sikte på å oppnå en avtale om mulige tiltak for å unngå eller begrense negative konsekvenser for arbeidstakerne.',
  },

  // ─── AML kap. 18-19 — Tilsyn og straff ─────────────────────────────────
  {
    regelverkId: 'aml', lawRef: 'AML § 18-10', title: 'Overtredelses­gebyr (15 G)',
    obligation: 'mandatory', category: 'Kap. 18-19 — Sanksjoner',
    description: 'Arbeidstilsynet kan ilegge arbeidsgiver et overtredelsesgebyr ved overtredelse av bestemmelsene i loven eller pålegg gitt med hjemmel i loven. Gebyret kan utgjøre inntil 15 ganger grunnbeløpet i Folketrygden. Ved fastsettelse av gebyrets størrelse skal det særlig legges vekt på overtredelsens art og omfang.',
  },
  {
    regelverkId: 'aml', lawRef: 'AML § 19-1', title: 'Straffeansvar',
    obligation: 'mandatory', category: 'Kap. 18-19 — Sanksjoner',
    description: 'Den som forsettlig eller uaktsomt overtrer bestemmelser eller pålegg gitt i eller i medhold av denne loven, straffes med bøter eller fengsel inntil tre måneder. Under særlig skjerpende omstendigheter kan fengsel inntil to år anvendes. Foretak kan straffes etter reglene i straffeloven §§ 27 og 28.',
  },

  // ─── IK-f § 5 ──────────────────────────────────────────────────────────
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1a', title: 'HMS-mål skriftlig',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha dokumenterte HMS-mål som er kjent for alle ansatte. Målene skal være konkrete, målbare og tilpasset virksomhetens risikoforhold. Internkontrollen skal inneholde planer og tiltak for å nå målene, og det skal fremgå hvem som er ansvarlig for gjennomføringen.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1b', title: 'Organisasjon og ansvar',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha en dokumentert oversikt over organisasjon, herunder hvordan ansvar, oppgaver og myndighet for HMS er fordelt. Det skal fremgå hvem som er ansvarlig for de ulike HMS-aktivitetene, og den dokumenterte ansvarsfordelingen skal holdes oppdatert.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1c', title: 'Kunnskap og opplæring',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha oversikt over de krav i helse-, miljø- og sikkerhetslovgivningen som til enhver tid gjelder for virksomheten. Det skal sørges for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter innenfor det systematiske HMS-arbeidet, herunder hva som gjelder for egne arbeidsoperasjoner.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1d', title: 'Arbeidstaker­medvirkning',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal sørge for at arbeidstakerne medvirker slik at samlet kunnskap og erfaring utnyttes. Systematisk medvirkning er et sentralt prinsipp i internkontrollforskriften — arbeidstakerne skal involveres i kartlegging, risikovurdering og utforming av tiltak.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 2', title: 'Kartlegging av farer',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal kartlegge farer og problemer og på denne bakgrunn vurdere risiko, samt utarbeide tilhørende planer og tiltak for å redusere risikoforholdene. Kartleggingen skal dekke alle relevante helse-, miljø- og sikkerhetsforhold, og gjennomføres systematisk og med deltakelse fra arbeidstakerne.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 3', title: 'Risikovurdering',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal iverksette rutiner for å avdekke, rette opp og forebygge overtredelser av krav fastsatt i eller i medhold av helse-, miljø- og sikkerhetslovgivningen. Risikovurderingen skal dokumenteres, og tiltakene for å redusere risikoen skal prioriteres etter alvorlighetsgrad.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 4', title: 'Avviks-rutine',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha rutiner for registrering, behandling og oppfølging av avvik fra krav i HMS-lovgivningen. Avviksrutinen skal klargjøre hvem som melder, hvem som behandler, og hvem som beslutter tiltak. Avvikene og de korrigerende tiltakene skal dokumenteres og følges opp.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 5', title: 'Systematisk overvåking',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha rutiner for systematisk overvåking og gjennomgang av internkontrollen for å sikre at den fungerer som forutsatt. Overvåkingen kan skje gjennom internrevisjoner, målinger, vernerunder, sykefraværsstatistikk og regelmessige ledelsesgjennomganger.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 6', title: 'Tiltak basert på risiko',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal iverksette tiltak og rutiner basert på risikovurderingen for å avverge at helse- og arbeidsmiljøskader oppstår. Tiltakene skal prioriteres etter risikobilde og dokumenteres. Effekten av gjennomførte tiltak skal evalueres og justeres ved behov.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 7', title: 'Tilsyn med systemet',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal ha et system for å sikre at Arbeidstilsynet og andre tilsynsmyndigheter kan utføre sin virksomhet. HMS-dokumentasjonen skal holdes tilgjengelig og oppdatert, og virksomheten skal sørge for at internkontrollen til enhver tid er i samsvar med gjeldende lovkrav.',
  },
  {
    regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 8', title: 'Årlig gjennomgang',
    obligation: 'mandatory', category: '§ 5 — Internkontroll',
    description: 'Virksomheten skal gjennomgå internkontrollen regelmessig for å sikre at den fungerer og bidrar til kontinuerlig forbedring av HMS-arbeidet. Den årlige gjennomgangen bør inkludere vurdering av avvik, sykefravær, vernerunderapporter og oppnåelse av HMS-mål, og resultere i justeringer av mål og tiltak.',
  },

  // ─── LDL ───────────────────────────────────────────────────────────────
  {
    regelverkId: 'ldl', lawRef: 'LDL § 6', title: 'Forbud mot diskriminering',
    obligation: 'mandatory', category: 'Diskriminering',
    description: 'Diskriminering på grunn av kjønn, graviditet, permisjon ved fødsel eller adopsjon, omsorgsoppgaver, etnisitet, religion, livssyn, funksjonsnedsettelse, seksuell orientering, kjønnsidentitet, kjønnsuttrykk eller alder er forbudt. Forbudet gjelder alle sider av arbeidslivet.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 13', title: 'Forbud mot trakassering',
    obligation: 'mandatory', category: 'Diskriminering',
    description: 'Trakassering på grunn av de diskrimineringsvernede egenskapene i loven er forbudt. Med trakassering menes handlinger, unnlatelser eller ytringer som virker eller har til formål å virke krenkende, skremmende, fiendtlige, nedverdigende eller ydmykende. Arbeidsgiver plikter å forebygge og søke å hindre trakassering.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 19', title: 'Innhenting av opplysninger ved rekruttering',
    obligation: 'mandatory', category: 'Rekruttering',
    description: 'Arbeidsgiver kan ikke ved ansettelse eller forfremmelse innhente opplysninger om søkernes graviditet, adopsjon, planer om å få barn, eller om søkerne er homofil samboende eller gift. Unntak gjelder dersom slike opplysninger er nødvendige for utøvelse av stillingen.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 26', title: 'Aktivitets- og redegjørelses­plikt',
    obligation: 'mandatory', applies: '≥ 50 ansatte (≥ 20 hvis krav)', category: 'ARP',
    description: 'Arbeidsgivere med mer enn 50 ansatte (20 ansatte dersom en av arbeidslivets parter krever det) skal arbeide aktivt, målrettet og planmessig for å fremme likestilling og hindre diskriminering. Virksomheten skal redegjøre for arbeidet i årsberetningen eller i annet offentlig tilgjengelig dokument.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 26 a', title: 'Lønns­kartlegging',
    obligation: 'mandatory', applies: 'Hvert 2. år, ≥ 50', category: 'ARP',
    description: 'Arbeidsgivere med mer enn 50 ansatte skal kartlegge og analysere lønnsforskjeller mellom kvinner og menn hvert annet år. Kartleggingen skal gjennomføres på stillings- og stillingsnivå, og resultatene skal fremlegges for tillitsvalgte og redegjøres for i årsberetning eller tilsvarende dokument.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 28', title: 'Universell utforming',
    obligation: 'mandatory', category: 'Tilrettelegging',
    description: 'Virksomheter rettet mot allmennheten har plikt til å sikre universell utforming av virksomhetens alminnelige funksjoner. Med universell utforming menes utforming eller tilrettelegging av virksomhetens hovedløsning slik at den kan brukes av flest mulig, uavhengig av funksjonsevne.',
  },
  {
    regelverkId: 'ldl', lawRef: 'LDL § 12-5', title: 'Rimelig individuell tilrettelegging',
    obligation: 'mandatory', category: 'Tilrettelegging',
    description: 'Arbeidsgiver skal foreta rimelig individuell tilrettelegging av arbeidsplass og arbeidsoppgaver for å sikre at en arbeidstaker eller arbeidssøker med nedsatt funksjonsevne kan få eller beholde arbeid. Plikten gjelder så langt tilretteleggingen ikke innebærer en uforholdsmessig stor byrde for arbeidsgiver.',
  },

  // ─── GDPR ──────────────────────────────────────────────────────────────
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 5', title: 'Behandlings­prinsipper',
    obligation: 'mandatory', category: 'Prinsipper',
    description: 'Personopplysninger skal behandles på en lovlig, rettferdig og åpen måte overfor den registrerte. De skal samles inn for spesifikke, uttrykkelig angitte og berettigede formål, og ikke behandles videre på en måte som er uforenlig med disse formålene. Opplysningene skal være adekvate, relevante og begrenset til det som er nødvendig.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 6', title: 'Lovlighet av behandling',
    obligation: 'mandatory', category: 'Prinsipper',
    description: 'Behandling er lovlig dersom minst ett av følgende vilkår er oppfylt: (a) samtykke fra den registrerte, (b) nødvendig for å oppfylle en avtale, (c) nødvendig for å overholde en rettslig forpliktelse, (d) nødvendig for å verne den registrertes vitale interesser, (e) nødvendig for å utføre en oppgave i allmennhetens interesse, (f) nødvendig for formål knyttet til legitime interesser.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 7', title: 'Vilkår for samtykke',
    obligation: 'conditional', category: 'Prinsipper',
    description: 'Der behandlingen er basert på samtykke, skal den behandlingsansvarlige kunne påvise at den registrerte har samtykket. Samtykket skal gis ved en klar bekreftende handling, være spesifikt, informert og entydig. Den registrerte har rett til å trekke samtykket tilbake når som helst.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 9', title: 'Sensitive data',
    obligation: 'conditional', category: 'Prinsipper',
    description: 'Behandling av særlige kategorier av personopplysninger (helse, genetikk, biometri, rase, politisk oppfatning, fagforeningstilhørighet, seksuelle forhold) er som utgangspunkt forbudt. Unntak gjelder blant annet med eksplisitt samtykke, av hensyn til arbeidsrettlige forpliktelser, eller av vitenskapelige og statistiske formål.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 13', title: 'Informasjon ved direkte innhenting',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Når personopplysninger samles inn direkte fra den registrerte, skal den behandlingsansvarlige på innsamlingstidspunktet gi den registrerte informasjon om behandlingsansvarlig, behandlingens formål og rettslige grunnlag, eventuelle mottakere, og om den registrertes rettigheter.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 14', title: 'Informasjon ved indirekte innhenting',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Når personopplysninger er innhentet fra andre enn den registrerte, skal den behandlingsansvarlige gi tilsvarende informasjon som etter Art. 13 innen rimelig tid — senest én måned. Denne plikten gjelder ikke dersom det er umulig eller ville kreve uforholdsmessig store anstrengelser.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 15', title: 'Innsynsrett',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å få bekreftet av den behandlingsansvarlige om personopplysninger om vedkommende behandles, og i så fall å få innsyn i opplysningene og informasjon om bl.a. formål, kategorier og mottakere. Innsyn skal gis kostnadsfritt og uten ugrunnet opphold, og senest innen én måned.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 16', title: 'Retting',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å kreve at den behandlingsansvarlige uten ugrunnet opphold retter uriktige personopplysninger om vedkommende. Tatt i betraktning formålene med behandlingen har den registrerte rett til å få ufullstendige personopplysninger utfylt.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 17', title: 'Sletting (rett til å bli glemt)',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å kreve at den behandlingsansvarlige uten ugrunnet opphold sletter personopplysninger om vedkommende, bl.a. dersom opplysningene ikke lenger er nødvendige for formålet, samtykket er trukket tilbake, eller opplysningene er behandlet ulovlig.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 18', title: 'Begrensning av behandling',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å kreve at behandlingen av personopplysninger begrenses dersom opplysningenes riktighet bestrides, behandlingen er ulovlig, den behandlingsansvarlige ikke lenger trenger opplysningene, eller den registrerte har gjort innsigelse mot behandlingen.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 20', title: 'Dataportabilitet',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å motta personopplysninger om seg selv i et strukturert, alminnelig anvendt og maskinlesbart format, og til å overføre disse til en annen behandlingsansvarlig. Retten gjelder der behandlingen er basert på samtykke eller avtale og skjer ved hjelp av automatiserte midler.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 21', title: 'Innsigelse',
    obligation: 'mandatory', category: 'Den registrertes rettigheter',
    description: 'Den registrerte har rett til å gjøre innsigelse mot behandling av personopplysninger basert på legitime interesser eller offentlig interesse. Dersom innsigelse fremsettes, skal den behandlingsansvarlige stanse behandlingen med mindre det foreligger tvingende berettigede grunner.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 25', title: 'Innebygd personvern',
    obligation: 'mandatory', category: 'Sikkerhet og brudd',
    description: 'Den behandlingsansvarlige skal både på tidspunktet for fastsettelsen av midlene for behandlingen og på selve behandlingstidspunktet gjennomføre egnede tekniske og organisatoriske tiltak (privacy by design og privacy by default) for å sikre at personvernprinsippene oppfylles.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 28', title: 'Databehandler-avtale',
    obligation: 'mandatory', category: 'Sikkerhet og brudd',
    description: 'Behandling som utføres av en databehandler, skal reguleres av en kontrakt eller et annet rettslig dokument som er bindende for databehandleren med hensyn til den behandlingsansvarlige. Avtalen skal bl.a. angi behandlingens gjenstand, varighet, art og formål, samt databehandlerens forpliktelser og rettigheter.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 30', title: 'Behandlings­protokoll',
    obligation: 'mandatory', category: 'Sikkerhet og brudd',
    description: 'Den behandlingsansvarlige skal føre en protokoll over behandlingsaktiviteter. Protokollen skal inneholde: navn og kontaktopplysninger for behandlingsansvarlig, formålene med behandlingen, kategorier av registrerte og personopplysninger, eventuelle mottakere, og planlagte tidsfrister for sletting.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 32', title: 'Sikkerhets­tiltak',
    obligation: 'mandatory', category: 'Sikkerhet og brudd',
    description: 'Den behandlingsansvarlige og databehandleren skal gjennomføre egnede tekniske og organisatoriske tiltak for å oppnå et sikkerhetsnivå som er egnet med hensyn til risikoen. Dette inkluderer pseudonymisering og kryptering, evne til å sikre konfidensialitet, integritet, tilgjengelighet og robusthet.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 33', title: 'Brudd­varsling Datatilsynet (72 t)',
    obligation: 'mandatory', category: 'Sikkerhet og brudd',
    description: 'Ved et brudd på personopplysningssikkerheten skal den behandlingsansvarlige uten ugrunnet opphold og om mulig senest 72 timer etter å ha fått kjennskap til bruddet, melde dette til tilsynsmyndigheten (Datatilsynet). Meldingen skal inneholde en beskrivelse av bruddet og de sannsynlige konsekvenser.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 34', title: 'Brudd­varsling registrerte',
    obligation: 'conditional', category: 'Sikkerhet og brudd',
    description: 'Dersom bruddet på personopplysningssikkerheten sannsynligvis vil medføre høy risiko for fysiske personers rettigheter og friheter, skal den behandlingsansvarlige uten ugrunnet opphold underrette den registrerte om bruddet. Underretningen skal beskrive bruddet på et klart og enkelt språk.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 35', title: 'DPIA — personvern­konsekvens­vurdering',
    obligation: 'conditional', category: 'Sikkerhet og brudd',
    description: 'Dersom en type behandling, særlig ved bruk av ny teknologi, sannsynligvis vil medføre høy risiko for fysiske personers rettigheter og friheter, skal den behandlingsansvarlige utføre en vurdering av konsekvensene for personvernet (DPIA) før behandlingen igangsettes.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 37', title: 'DPO — utpekning',
    obligation: 'conditional', category: 'DPO',
    description: 'Den behandlingsansvarlige og databehandleren skal utpeke et personvernombud (DPO) der behandlingen utføres av en offentlig myndighet, der kjerneopgavene består i behandling av særlige kategorier av personopplysninger i stor skala, eller der behandlingen i stor skala omfatter regelmessig og systematisk overvåking.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 38', title: 'DPOs stilling',
    obligation: 'conditional', category: 'DPO',
    description: 'Den behandlingsansvarlige og databehandleren skal sikre at personvernombudet (DPO) involveres på riktig måte og i tide i alle spørsmål som gjelder beskyttelse av personopplysninger. DPO skal ikke motta instrukser med hensyn til utøvelsen av sine oppgaver og kan ikke avskjediges eller straffes.',
  },
  {
    regelverkId: 'gdpr', lawRef: 'GDPR Art. 39', title: 'DPOs oppgaver',
    obligation: 'conditional', category: 'DPO',
    description: 'Personvernombudet (DPO) skal: informere og rådgi den behandlingsansvarlige om forpliktelsene etter GDPR, føre tilsyn med etterlevelsen, gi råd om DPIA-er, samarbeide med tilsynsmyndigheten og fungere som kontaktpunkt for Datatilsynet og de registrerte.',
  },

  // ─── FOLM (Forskrift om organisering, ledelse og medvirkning) ─────────
  {
    regelverkId: 'folm', lawRef: 'FOLM § 2-1', title: 'Innleiers ansvar',
    obligation: 'mandatory', category: 'Verneorganisasjon',
    description: 'Innleier av arbeidskraft har ansvar for at det psykososiale og fysiske arbeidsmiljøet i virksomheten er fullt forsvarlig for innleide arbeidstakere. Innleier skal inkludere innleide arbeidstakere i vernetiltak, vernerunder og opplæring knyttet til arbeidsstedet og arbeidet som utføres.',
  },
  {
    regelverkId: 'folm', lawRef: 'FOLM § 3-2', title: 'Hovedverneombud',
    obligation: 'conditional', applies: '≥ 30 ansatte', category: 'Verneorganisasjon',
    description: 'I virksomheter med mer enn 30 ansatte fordelt på flere avdelinger, og der det er valgt mer enn ett verneombud, skal det velges et hovedverneombud. Hovedverneombudet skal koordinere verneombudenes virksomhet og ivareta arbeidstakernes interesser i saker som angår hele virksomheten.',
  },
  {
    regelverkId: 'folm', lawRef: 'FOLM § 3-7', title: 'Vernerunder',
    obligation: 'mandatory', category: 'Verneorganisasjon',
    description: 'Arbeidsgiver skal gjennomføre vernerunder med deltakelse fra verneombudet. Vernerundene skal dekke alle deler av virksomheten og ha tilstrekkelig hyppighet ut fra virksomhetens art og risiko. Funn fra vernerundene skal dokumenteres, og avvik skal følges opp med tiltak og tidsfrister.',
  },
  {
    regelverkId: 'folm', lawRef: 'FOLM § 3-18', title: '40-timers verneombud-opplæring',
    obligation: 'mandatory', category: 'Opplæring',
    description: 'Verneombud og AMU-representanter skal ha gjennomgått opplæring som minst svarer til et godkjent kurs på 40 timer. Opplæringen skal gi nødvendig kunnskap om HMS-lovgivning, verneombudets rolle og rettigheter, risikovurdering og praktisk HMS-arbeid. Arbeidsgiver bekoster opplæringen.',
  },

  // ─── Brannvern ─────────────────────────────────────────────────────────
  {
    regelverkId: 'brannvern', lawRef: 'Brannvern § 6', title: 'Forebyggende plikter',
    obligation: 'mandatory', category: 'Forebygging',
    description: 'Enhver som bruker bygg, anlegg eller andre innretninger, plikter å opptre aktsomt for å hindre brann, eksplosjon eller annen ulykke. Eier og bruker av virksomheten er ansvarlig for at nødvendige brannforebyggende tiltak er iverksatt, og at brannvarsling og slokningsutstyr er kontrollert og i forskriftsmessig stand.',
  },
  {
    regelverkId: 'brannvern', lawRef: 'Brannvern § 11', title: 'Beredskap',
    obligation: 'mandatory', category: 'Beredskap',
    description: 'Virksomheter med særlig fare for brann skal ha en dokumentert brann- og redningstjeneste tilpasset risikoen i virksomheten. Dette inkluderer skriftlige beredskapsplaner, jevnlige øvelser, opplæring av ansatte i brannvern og evakuering, samt sikkerhetssystem og sprinkleranlegg der påkrevd.',
  },

  // ─── Åpenhets­loven ─────────────────────────────────────────────────────
  {
    regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 4', title: 'Aktsomhets­vurderinger',
    obligation: 'mandatory', applies: '≥ 50 ansatte + størrelses­krav', category: 'Aktsomhet',
    description: 'Virksomheter som er omfattet av loven, skal gjennomføre aktsomhetsvurderinger i samsvar med OECDs retningslinjer for flernasjonale selskaper. Dette innebærer å kartlegge, forebygge og begrense negative konsekvenser for grunnleggende menneskerettigheter og anstendige arbeidsforhold i forbindelse med produksjon av varer og tjenester.',
  },
  {
    regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 5', title: 'Årlig redegjørelse',
    obligation: 'mandatory', category: 'Rapportering',
    description: 'Virksomheten skal offentliggjøre en redegjørelse for sine aktsomhetsvurderinger. Redegjørelsen skal minst inneholde en beskrivelse av virksomhetens organisering og forretningsområde, retningslinjer for arbeid med aktsomhetsvurderinger, faktiske negative konsekvenser og vesentlig risiko, og tiltak som er iverksatt.',
  },
  {
    regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 6', title: 'Informasjons­plikt',
    obligation: 'mandatory', category: 'Rapportering',
    description: 'Enhver har rett til å be virksomheter som er omfattet av loven om informasjon om hvordan virksomheten håndterer faktiske og potensielle negative konsekvenser. Virksomheten skal svare skriftlig innen rimelig tid og senest innen tre uker fra forespørselen ble mottatt.',
  },

  // ─── BHT-forskriften ───────────────────────────────────────────────────
  {
    regelverkId: 'bht', lawRef: 'BHT-f § 4', title: 'BHT-årsplan',
    obligation: 'mandatory', category: 'BHT',
    description: 'Bedriftshelsetjenesten (BHT) og virksomheten skal i fellesskap utarbeide en årsplan for BHTs arbeid i virksomheten. Årsplanen skal beskrive hvilke BHT-tjenester som skal leveres, prioriteringer, ressursinnsats og frekvens. Planen skal forankres i virksomhetens HMS-mål og risikoforhold.',
  },
  {
    regelverkId: 'bht', lawRef: 'BHT-f § 6', title: 'BHT-rapportering',
    obligation: 'mandatory', category: 'BHT',
    description: 'Bedriftshelsetjenesten skal rapportere til virksomheten om utført arbeid. Rapporten skal gi grunnlag for at virksomheten kan vurdere om BHTs bistand er tilfredsstillende, og om HMS-arbeidet i virksomheten er i samsvar med krav i lovgivningen. Rapportene er viktige dokumentasjon i forbindelse med tilsyn.',
  },

  // ─── Forskrift om utførelse av arbeid ──────────────────────────────────
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. § 1-7', title: 'Stoff-kartotek',
    obligation: 'mandatory', applies: 'Ved kjemikalier', category: 'Kjemikalier',
    description: 'Arbeidsgiver skal ha stoffkartotek over alle kjemikalier som brukes eller fremstilles på arbeidsplassen. Hvert stoff skal ha et sikkerhetsdatablad som er oppdatert og tilgjengelig for arbeidstakerne. Stoffkartoteket skal inneholde informasjon om fareegenskaper, verneutstyr og tiltak ved uhell.',
  },
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 3', title: 'Kjemikalie-eksponering',
    obligation: 'mandatory', category: 'Kjemikalier',
    description: 'Arbeidsgiver skal forebygge og begrense eksponering for kjemikalier på arbeidsplassen. Dette inkluderer substitusjon av farlige kjemikalier, tekniske tiltak som ventilasjon og innkapsling, organisatoriske tiltak og bruk av personlig verneutstyr. Eksponering skal måles og vurderes mot grenseverdier.',
  },
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 4', title: 'Asbest, kreft­fremkallende',
    obligation: 'conditional', category: 'Asbest/kreft',
    description: 'Særskilte krav gjelder ved arbeid med asbest og kreftfremkallende stoffer. Arbeidsgiver skal kartlegge forekomst av asbest, utarbeide plan for sanering, og sørge for at arbeidstakerne ikke utsettes for konsentrasjoner over grenseverdiene. Slikt arbeid krever tillatelse fra Arbeidstilsynet.',
  },
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 10', title: 'Sertifisert opplæring',
    obligation: 'conditional', category: 'Sertifisering',
    description: 'For visse typer arbeid kreves sertifisert opplæring og bevis, bl.a. for trucker, kran, stillas og sprengningsarbeid. Arbeidsgiver skal sørge for at arbeidstakerne har de nødvendige sertifikater og kompetansebevis, og at disse holdes oppdatert.',
  },
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 17', title: 'Fall fra høyde',
    obligation: 'conditional', applies: 'Bygg/anlegg', category: 'Fysisk',
    description: 'Arbeid i høyden skal planlegges, organiseres og utføres sikkert med tanke på å hindre at arbeidstakere utsettes for skader ved fall. Kollektive vernetiltak (rekkverk, stillas, fallnett) skal prioriteres over individuelle tiltak (fallsikring). Arbeidstakere skal ha opplæring og nødvendig utstyr.',
  },
  {
    regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 23', title: 'Ergonomi',
    obligation: 'mandatory', category: 'Fysisk',
    description: 'Arbeid skal tilrettelegges slik at arbeidstakerne ikke utsettes for uheldige ergonomiske belastninger. Dette inkluderer krav til arbeidsplassutforming, løfteteknikk, bruk av hjelpemidler og pauser. Arbeidsgiver skal kartlegge ergonomiske risikoer og iverksette tiltak for å redusere muskel- og skjelettbelastninger.',
  },
]

export function getRequirementsByRegelverk(regelverkId: string): Requirement[] {
  return REQUIREMENTS.filter((r) => r.regelverkId === regelverkId)
}
