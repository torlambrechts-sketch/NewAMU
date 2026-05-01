# Organisasjonsmodul — Forbedringsforslagene

**Kilde:** Gjennomgang av `OrganisationPage.tsx`, `useOrganisation.ts`, `src/types/organisation.ts`, `src/types/organization.ts`, `src/lib/brreg.ts`, `src/types/brreg.ts`, `src/data/representativeRules.ts`, `src/data/norwegianLabourCompliance.ts`, `src/lib/permissionKeys.ts`, `DESIGN_SYSTEM.md`, migrasjoner og Claude-dokumentasjonen.

---

## Overordnet vurdering av nåværende modul

Modulen dekker grunnleggende org-struktur (ansatte, enheter, grupper, innstillinger) og viser AML-terskler for verneombud (≥5) og AMU (≥30). Den har to parallelle datakjeder — en lokal/demo-modus og en Supabase-backend — og Brreg-integrasjon er implementert men brukes minimalt. Det mangler: GDPR-registre, formell rolle/representantkobling til ansattlisten, Brreg-berikkelse (NACE, antallAnsatte, underenheter), A-ordning-referanse, datasletting i tråd med oppbevaringskrav, og en dedikert personvernflate for ansatte.

---

## Runde 1 — Perspektiv: UI-designer

### 1.1 Informasjonsarkitektur — tabsrekkefølge og namngiving

**Problem:** «Innsikt» er første tab men viser lite handlingsbar informasjon. Ansatteregisteret, som er kjernen av modulen, kommer som tab 2. Innstillinger-fanen inneholder kritiske lovkrav-innstillinger (antall ansatte, tariffavtale) blandet med oppgavesignatur-konfigurasjon — to svært ulike bekymringsnivåer.

**Forslag:**
- Rekkefølge: `Oversikt` → `Ansatte` → `Enheter` → `Grupper` → `Roller & verv` → `GDPR & personvern` → `Innstillinger`
- «Innsikt» omdøpes til «Oversikt» og løftes til en ekte dashboard-tab med compliance-status, varslinger og snarveier
- Innstillinger splittes i to: «Virksomhetsdata» (orgNr, bransje, tariff) og «Systeminnstillinger» (signatur-konfig, API)
- Ny tab «Roller & verv» samler verneombud, tillitsvalgte, AMU-representanter i én oversikt koblet til ansattlisten

### 1.2 Insikt-fanen — visuell hierarki

**Problem:** Fire KPI-bokser (Innsikt-tab) bruker `OrgInsightTanStat` med hardkodet `AB_SCORECARD_CREAM_DEEP` — avviker fra design-systemets farge-toke­ner. Compliance-stolpene (Verneombud, AMU) er bare en liste med fargedotter og tall (0/1 — binær), ikke meningsfulle statusindikatorer.

**Forslag:**
- Erstatt rå binary-bars (0/1) med `<Badge variant="success|warning|neutral">` fra `src/components/ui/Badge.tsx`
- Legg til en «Compliance-status»-seksjon med fire tiles: AML-terskel ✓/✗, GDPR-register ✓/✗, Verneombud valgt ✓/✗, Brreg-data synkronisert ✓/✗
- Bruk `<ComplianceBanner>` fra `src/components/ui/ComplianceBanner.tsx` for lovhenvisninger i Innsikt-fanen
- KPI-boksene bør dele designspråk med resten av plattformen — bruk tokens fra `workplaceLayoutKit.ts`

### 1.3 Ansattskjema (SlidePanel) — feltstruktur og UX

**Problem:** Skjemaet har bare «Grunnleggende» og «Ansettelse» seksjoner. Det mangler:
- Startdato-validering (må ikke være frem i tid for aktive ansatte)
- Visuell indikasjon på hvilke felt som er personopplysninger
- Arbeidssted som fritekst men ikke koblet til `LocationRow`-strukturen i databasen
- `headEmployeeId` på OrgUnit er en streng (fritekst-navn), ikke en faktisk ansatt-referanse

**Forslag:**
- Legg til en PII-advarselsbanner øverst i skjemaet: «Personopplysninger — behandles etter GDPR Art. 6 (1) (b) [arbeidskontrakt]»
- Del skjemaet i tre seksjoner: «Personalia», «Ansettelse & tilknytning», «Roller & verv»
- Erstatt fritekst for Leder/Enhetshode med `<SearchableSelect>` som peker til aktive ansatte
- Arbeidssted kobles til `OrgUnit` av typen `location` — dropp fritekst
- Legg til felt for `endDate`-årsak (frivillig avgang, oppsigelse, pensjon) — viktig for statistikk og GDPR-sletting

### 1.4 Enhetstre — visuell klarhet

**Problem:** Hierarkiet vises som flat liste med innrykk, uten klar visuell kobling mellom parent/child. «Klikk på rad for å redigere» er ikke tydelig for ukjente brukere — ingen visuell affordance.

**Forslag:**
- Legg til tynne vertikale tree-linjer mellom parent og child (SVG eller border-left)
- Redigerings-ikonet (pencil) bør vises konsistent på hover i alle tre layout-moduser
- Boks-visningen bør vise et lite «ark»-ikon for dype enheter (depth ≥ 2) for å markere at de er underordnet
- Fargedotten for enhetstype bør ha `title` (tooltip) med typenavn for tilgjengelighet

### 1.5 Mobile og touch

**Problem:** `min-w-[720px]` på tabeller gir horisontal scroll på mobil. SlidePanel bruker `fixed inset-0` uten dedikert close-gesture for touch.

**Forslag:**
- Under 640px: kollaps tabellene til liste-modus automatisk (bruk `empStdViewMode` default)
- SlidePanel: legg til swipe-to-close på mobil (touch events)
- «Ny ansatt»-knappen bør være sticky/FAB på mobil

---

## Runde 2 — Perspektiv: Sluttbruker (ansatt)

### 2.1 Selvbetjening — min egen profil

**Problem:** Ansatte har ingen vei til å se, rette eller eksportere sine egne opplysninger i organisasjonsregisteret. `ProfilePage.tsx` håndterer auth-profil, men ikke `OrgEmployee`-oppføringen. En ansatt kan ikke se om de er registrert feil (feil stilling, feil enhet), og de kan ikke utøve sine GDPR-rettigheter.

**Forslag:**
- Legg til en «Min profil i organisasjonen»-seksjon i `ProfilePage.tsx` (eller lenke dit fra `OrganisationPage`) der ansatte kan:
  - Se sine egne registrerte opplysninger (skrivebeskyttet)
  - Be om retting (innsendelse av endringsforslag til admin)
  - Laste ned sine data (JSON/CSV — GDPR Art. 20 dataportabilitet)
  - Be om sletting (sende sletteforespørsel til admin — GDPR Art. 17)
- Ansatte bør se hvilke «Brukergrupper» de er med i

### 2.2 Gjennomsiktighet — hvem ser mine opplysninger

**Problem:** Det er ikke kommunisert til ansatte hvilken informasjon som er synlig for hvem. E-post og telefon vises åpent i tabellen — uten noen tilgangsindikator.

**Forslag:**
- Legg til et lite «privacy shield»-ikon ved kontaktinformasjon med tooltip: «Synlig for andre ansatte / bare admin»
- Et «Personvernerklæring»-lenke-element i bunnen av Ansatte-fanen
- Vis tydelig hvilke felt som er synlige for alle i organisasjonen vs. bare admin

### 2.3 Org-kart og søk

**Problem:** Det finnes ingen grafisk org-kart-visning. En «Vis org-kart»-funksjon ble tidligere redirigert (`orgchart` → `insights`). Ansatte kan ikke finne kolleger raskt via avdeling eller verv.

**Forslag:**
- Legg til en enkel hierarkisk org-kart-visning (kan starte med nested liste-trær)
- Gjør ansattsøk tilgjengelig for alle innloggede, ikke bare admins
- Vis verv (verneombud, AMU-representant) som tagger/badges på ansattkortet

### 2.4 Kontekst for AML-terskler

**Problem:** «Verneombud lovpålagt» / «AMU lovpålagt» vises som info-tagger i headeren, men en vanlig ansatt forstår ikke hva dette betyr for dem.

**Forslag:**
- Legg til «Hva betyr dette for deg?»-lenker (InfoBox) som forklarer verneombudsrollen og AMU
- Koble direkte til lovhenvisninger (lovdata.no) og intern dokumentasjon

---

## Runde 3 — Perspektiv: Administrator

### 3.1 Brreg-integrasjon — underutnyttet

**Problem:** `fetchEnhetByOrgnr()` henter data og `brreg_snapshot` lagres i `organizations`-tabellen, men:
- `antallAnsatte` fra Brreg brukes ikke til å kalibrere AML-terskler
- `naeringskode1` (NACE-kode) brukes ikke til automatisk å sette `industrySector`
- `organisasjonsform.kode` (AS, ANS, SA, etc.) vises ikke
- `underenheter` (filialer, avdelingsregistreringer) hentes ikke
- Brreg-snapshotet vises ikke i UI — admin ser ikke hva som er hentet

**Forslag (data-modell):**
```typescript
// Legg til BrregEnhet-type-felter:
export type BrregEnhet = {
  // eksisterende felter...
  antallAnsatte?: number
  naeringskode1?: { kode: string; beskrivelse: string }
  naeringskode2?: { kode: string; beskrivelse: string }
  institusjonellSektorkode?: { kode: string; beskrivelse: string }
  registrertIForetaksregisteret?: boolean
  registrertIMvaRegisteret?: boolean
  stiftelsesdato?: string
  registreringsdatoEnhetsregisteret?: string
}
```

**Forslag (UI — Innstillinger-tab):**
- Legg til «Brreg-status»-seksjon som viser: sist synkronisert, antallAnsatte (offisiell), NACE-kode, selskapsform
- Legg til «Synkroniser fra Brønnøysund»-knapp som oppdaterer snapshotet
- Vis advarsel hvis `antallAnsatte` fra Brreg avviker >20% fra antall ansatte i systemet
- Bruk `antallAnsatte` som primær kilde for AML-terskler (med manuell overstyring som fallback)

### 3.2 Rollestruktur — verneombud og tillitsvalgte mangler

**Problem:** `ROLE_OPTIONS` er en enkel array med generelle rolle-kategorier. Det finnes ingen kobling mellom rollen «Verneombud» i organisasjonslisten og AMU/verneombud-funksjonene i systemet. En ansatt kan merkes som «Verneombud» men dette har ingen effekt på tilganger eller compliance-tracking.

**Forslag — ny datastruktur:**
```typescript
// Nytt felt på OrgEmployee:
export type OrgEmployeeMandate = {
  mandateType: 'verneombud' | 'tillitsvalgt' | 'amu_arbeidstaker' | 'amu_arbeidsgiver' | 'hms_ansvarlig' | 'bht_kontakt'
  scope?: string     // f.eks. «IT-avdelingen» eller «Hele virksomheten»
  startDate: string  // ISO
  endDate?: string   // ISO — valgt for periode
  electedAt?: string // dato for valg
  lawRef: string     // f.eks. «AML § 6-1»
}

// Legg til på OrgEmployee:
mandates?: OrgEmployeeMandate[]
```

**Forslag — ny «Roller & verv»-tab:**
- Tabelloversikt over alle formelle verv med gyldighetsperiode
- Varsel om utløpende valgperioder (30 dager før)
- Automatisk oppdatering av `amu_members`-tabellen ved endring av AMU-verv
- Kobling til valg (AMU-valgmodulen) for sporbarhet

### 3.3 Datasletting og oppbevaring

**Problem:** `deactivateEmployee()` setter `active: false` og `endDate` — men data slettes aldri. Dette er problematisk under GDPR Art. 5(1)(e) (lagringsbegrensning). `org_module_payloads`-tabellen lagrer JSON-blob uten noen TTL-mekanisme.

**Forslag:**
- Legg til et felt `scheduledDeletionAt` på `OrgEmployee` som settes automatisk N måneder etter `endDate` (konfigurerbar per org)
- Vis «planlagt sletting»-dato på inaktive ansatte i tabellen
- Admin-funksjon: «Anonimiser ansatt» (erstatter navn/e-post/telefon med pseudonym, beholder statistikk-data)
- Legg til en «Dataoppbevaring»-seksjon i Innstillinger med slikt oppsett:
  - Inaktive ansatte: oppbevar i [X måneder] etter sluttdato
  - Auditlogg: oppbevar i [X år]
  - Eksporter og slett: knapp for å laste ned og permanent slette en ansatt

### 3.4 Import og synkronisering

**Problem:** Ingen import-funksjonalitet. Store organisasjoner (50+ ansatte) kan ikke masselaste ansattedata. Det er ingen webhook/API for HR-systemer (Visma, Tripletex, SAP).

**Forslag:**
- CSV-import av ansatte med feltmapping og validering mot eksisterende poster (match på e-post)
- Webhook-endepunkt for synkronisering fra HR-system
- Supabase-funksjon for bulk-oppdatering med konflikt-håndtering

### 3.5 Organisasjonsnummer-validering og Brreg-oppslag

**Problem:** `orgNumber`-feltet i innstillinger er fritekst uten validering. `fetchEnhetByOrgnr()` finnes men kalles ikke fra Innstillinger-fanen.

**Forslag:**
- Legg til «Sjekk mot Brønnøysund»-knapp direkte ved orgnr-feltet
- Automatisk populer: virksomhetsnavn, bransje, selskapsform fra Brreg ved verifisering
- Vis `konkurs: true` eller `underAvvikling: true` som kritisk advarsel

---

## Runde 4 — Perspektiv: Compliance Officer / Personvernombud

### 4.1 Behandlingsgrunnlag (GDPR Art. 6) mangler fullstendig

**Problem:** Systemet lagrer sensitive personopplysninger (navn, e-post, telefon, stillingsdata, ansettelsestype, startdato) uten noe dokumentert behandlingsgrunnlag. Dette er et brudd på GDPR Art. 5(1)(a) (lovlighet) og Art. 30 (protokoll over behandlingsaktiviteter).

**Forslag — ny datamodell:**
```typescript
export type DataProcessingBasis = {
  id: string
  category: 'employee_directory' | 'hr_management' | 'hse_compliance' | 'payroll_integration'
  legalBasis: 'contract' | 'legal_obligation' | 'legitimate_interest' | 'consent'
  legalRef: string           // «GDPR Art. 6(1)(b)» / «AML § 3-1»
  purpose: string
  dataCategories: string[]   // «navn», «e-post», «stillingstittel» etc.
  retentionPeriod: string    // «5 år etter ansettelsesslutt»
  recipient?: string         // «Arbeidstilsynet ved tilsyn»
  thirdCountryTransfer?: boolean
  createdAt: string
  updatedAt: string
}
```

**Forslag — ny «GDPR & personvern»-tab:**
- Behandlingsprotokoll (Art. 30-register) med alle behandlingsaktiviteter i modulen
- Dokumentér at ansatt-registeret er behandlet etter Art. 6(1)(b) (nødvendig for oppfyllelse av arbeidskontrakt)
- Dokumentér at HMS-data (AML §§ 3-1, 6-1, 7-1) behandles etter Art. 6(1)(c) (rettslig forpliktelse)
- Eksport av protokollen som PDF for tilsynsformål

### 4.2 Registrerte personers rettigheter (GDPR Art. 15–21)

**Problem:** Ingen mekanisme for innsyn (Art. 15), retting (Art. 16), sletting (Art. 17), dataportabilitet (Art. 20) eller begrensning (Art. 18). Systemet har `deactivateEmployee()` men ingen `deleteEmployee()` med faktisk datarensing.

**Forslag:**
- Legg til en «Rettighetsforespørsler»-seksjon i GDPR-fanen
- Inneholde et enkelt skjema for: innsyn, retting, sletting, dataportabilitet
- Forespørsler loggføres med timestamp og hvem som behandlet dem
- Svarfrist (30 dager per GDPR Art. 12(3)) vises som nedtelling
- Export-funksjon: genererer JSON/PDF med alle data om én ansatt (Art. 20)
- Hard sletting (anonymisering): erstatter PII med hash, beholder aggregert statistikk

### 4.3 Brukergrupper og overvåkningsrisiko

**Problem:** `UserGroup` med `kind: 'employees'` (navngitte enkeltpersoner) kan brukes til målrettet overvåkning av spesifikke ansatte. Det finnes ingen dokumentasjon av formål, ingen tidsbegrensning og ingen kontroll på hvem som oppretter slike grupper.

**Forslag:**
- Legg til obligatorisk `purpose: string` og `legalBasis: string` på `UserGroup`
- Grupper av typen `employees` (navngitte enkeltpersoner) skal kreve godkjenning av admin + personvernombud
- Grupper bør ha utløpsdato (`expiresAt`) — automatisk deaktivering etter periode
- Auditlogg: hvem brukte gruppen til hva, og når
- Advarsel i UI: «Denne gruppen inneholder navngitte enkeltpersoner. Kontroller at formål er dokumentert.»

### 4.4 Særlige kategorier av personopplysninger (GDPR Art. 9)

**Problem:** «Rollekategori: Verneombud» kan avdekke fagforeningsmedlemskap (særlig kategori etter Art. 9(1)). «Inaktiv» + `endDate` kombinert med årsak vil kunne avdekke sykdom. Det er ingen ekstra beskyttelse for disse opplysningene.

**Forslag:**
- `endDate`-årsak-feltet bør IKKE inkludere «Sykepermisjon» eller «Uføre» — bruk «Annet» med intern notat
- Fagforenings-tilknytning (tillitsvalgt-rolle) skal beskyttes med egne tilgangspolicyer
- Legg til en «sensitiv»-markering på mandater av typen `tillitsvalgt`
- RLS-policy: tillitsvalgt-data synlig bare for admin og vedkommende selv

### 4.5 Dataoverføring til tredjeparter

**Problem:** Brreg-integrasjonen sender bare organisasjonsnummer til Brreg-API (ikke persondata). Men en fremtidig HR-system-integrasjon vil sende personopplysninger — dette må dokumenteres.

**Forslag:**
- Legg til en «Dataflyt»-oversikt i GDPR-fanen som viser: hvilke data flyter til hvilke systemer
- Brreg: «organisasjonsnummer sendes til Brønnøysundregistrene — ingen persondata»
- HR-integrasjoner: skal listes med databehandleravtale (DPA) referanse
- Legg til felt for `dpaReference` i integrasjonsinnstillinger

### 4.6 Oppbevaringspolicyer (GDPR Art. 5(1)(e))

**Problem:** Inaktive ansatte beholder all data på ubestemt tid. Det er ingen automatikk for sletting eller anonymisering.

**Forslag — oppbevaringsregler (lovgrunnlag):**
| Kategori | Oppbevaringstid | Grunnlag |
|---|---|---|
| Ansattregister (aktiv) | Hele ansettelsesperioden | AML, GDPR Art. 6(1)(b) |
| Ansattregister (inaktiv) | 3 år etter sluttdato | Reklamasjonsfrist, AML kap. 17 |
| Lønnsdata | 10 år | Regnskapslovens § 13 |
| HMS-registre | 10 år (yrkesskade: 30 år) | Arbeidsskadetrygdloven |
| Auditlogg | 5 år | Datatilsynets praksis |

- Implementer automatisk varsel til admin 30 dager før slettegrense
- «Slettekø»-oversikt i GDPR-fanen

---

## Runde 5 — Perspektiv: Myndigheter

### Arbeidstilsynet (Arbeidsmiljøetaten)

#### 5.1 AML-terskel-beregning er ufullstendig

**Problem:** Koden beregner `requiresVerneombud: n >= 5` og `requiresAmu: n >= 30`, men AML § 6-1 og § 7-1 har viktige nyanser som ikke er implementert:

- **Innleide arbeidstakere** teller med (AML § 1-7 og Bemanningsdirektivet) — ikke bare egne ansatte
- **AMU-terskel**: 30 ansatte er grensen for automatisk krav; 10–29 er «kan kreves av flertallet» — implementert, men «flertallet» er ikke definerbart i systemet
- **Verneombudsområder** (§ 6-1 tredje ledd): ved ≥10 ansatte kreves verneombudsområder — ikke implementert
- **Særskilte arbeidsplasser**: §§ 6-1(2) og 1-2 unntar visse arbeidsgivere (shipping, oljeplattformer) — ikke håndtert
- **Midlertidige arbeidsplasser** (bygge- og anleggsvirksomhet): verneombud fra 10 ansatte § 6-1(2)

**Forslag:**
```typescript
export type ComplianceThresholds = {
  // eksisterende
  requiresVerneombud: boolean          // ≥5 egne + innleide
  mayRequestAmu: boolean               // 10–29
  requiresAmu: boolean                 // ≥30
  totalEmployeeCount: number
  // NYE:
  requiresVerneombudsOmraader: boolean // ≥10 — verneombudsområder
  includedContractors: number          // innleide teller med
  exemptedByLaw: boolean               // særskilte arbeidsplasser
  sectorSpecificRules?: string         // f.eks. «bygge- og anlegg»
}
```

#### 5.2 Mangler dokumentasjon for Arbeidstilsynet-tilsyn

**Problem:** Arbeidstilsynet kan kreve dokumentasjon på:
- Verneombuds-valg og valgperiode (§ 6-1)
- AMU-sammensetning og møteprotokoll (§§ 7-1, 7-2)
- HMS-opplæring for verneombud (40 timer — § 6-5)
- Systematisk HMS-arbeid (§ 3-1)
- IA-samarbeid der relevant

**Forslag:**
- Legg til en «Tilsynsrapport»-eksportfunksjon i Organisasjonsmodulen som samler:
  - Org-nr, navn, bransje, antall ansatte (fra Brreg og system)
  - Liste over verneombud med valgdatoer og opplæringsstatus
  - AMU-sammensetning og møtefrekvens (link til AMU-modulen)
  - HMS-handlingsplan-status
- Formater som PDF med org-logo og dato

#### 5.3 Innleide arbeidstakere (bemanningsbyrå)

**Problem:** `EmploymentType: 'contractor'` skiller ikke mellom:
- Konsulent (selvstendig oppdragstaker — ikke AML-beskyttet som «arbeidstaker»)
- Innleid fra bemanningsbyrå (AML § 14-12 — har ALLE AML-rettigheter)

**Forslag:**
```typescript
export type EmploymentType = 
  | 'permanent'           // fast ansatt
  | 'temporary'           // midlertidig (AML § 14-9)
  | 'intern'              // lærling/intern
  | 'agency_worker'       // innleid fra bemanningsbyrå (AML § 14-12) — TELLER I AML-TERSKLER
  | 'independent_contractor' // selvstendig (utenfor AML) — teller IKKE
```

- Vis tydelig i UI hvilke typer som teller i AML-beregninger
- `agency_worker` inkluderes i `totalEmployeeCount` for AMU/verneombud
- `independent_contractor` ekskluderes

#### 5.4 A-ordningen og offisielt ansattetall

**Problem:** Det er ingen kobling til A-ordningen (månedlig rapportering av ansatte til Skatteetaten/NAV/SSB). `antallAnsatte` fra Brreg er et snapshot, ikke sanntid.

**Forslag:**
- Legg til et felt `aOrdningAntallAnsatte` i `OrgSettings` — admin fyller inn manuelt fra siste A-melding
- Vis dato for sist oppdatert A-ordning-tall
- Beregn AML-terskler primært fra: A-ordningen → Brreg → manuelt oppgitt → ansatteliste
- Legg til lenke til Altinn / A-ordningen i Innstillinger

#### 5.5 Tilsynshistorikk fra Arbeidstilsynet

**Problem:** Ingen registrering av om virksomheten har hatt tilsyn, pålegg eller merknader fra Arbeidstilsynet.

**Forslag:**
- Legg til en «Tilsynshistorikk»-seksjon i GDPR/Compliance-fanen:
  - Dato, type tilsyn, funn, pålegg, frist
  - Status: åpent/lukket
  - Kobling til tiltaksplan for lukking av pålegg
- Fremtidig: integrasjon med Arbeidstilsynets API for automatisk henting av tilsynsdata

---

### Datatilsynet

#### 5.6 Internkontroll etter personopplysningsloven

**Problem:** `IkHubView.tsx` og `IkLovregisterView.tsx` dekker delvis internkontroll, men organisasjonsmodulen mangler en komplett Art. 30-protokoll som Datatilsynet vil forvente ved tilsyn.

**Forslag — Art. 30 Register (behandlingsprotokoll):**

Minimumskrav per behandling:
```
Navn:           «Ansattregister»
Formål:         Administrasjon av arbeidsforhold
Behandlingsansvarlig: [org navn + org.nr]
Behandlingsgrunnlag: GDPR Art. 6(1)(b) + AML §§ 3-1, 6-1, 7-1
Kategorier av registrerte: Ansatte, tidligere ansatte, konsulenter
Kategorier av data: Navn, kontakt, stilling, enhet, ansettelsestype, start/sluttdato
Mottakere: Arbeidstilsynet (ved tilsyn), intern HMS
Tredjelandsoverføring: Nei / [Ja — grunnlag X]
Slettefrist: 3 år etter ansettelsesslutt (HMS-data: 10 år)
Tekniske tiltak: RLS i Supabase, kryptert transport, tilgangslogg
```

#### 5.7 DPIA (Data Protection Impact Assessment) — risikovurdering av behandling

**Problem:** Brukergrupper med navngitte ansatte, kombinert med undersøkelsesresultater og HR-data, kan utgjøre en «høy risiko»-behandling som krever DPIA (GDPR Art. 35).

**Forslag:**
- Implementer en enkel DPIA-checkliste i GDPR-fanen:
  - Systematisk overvåkning av ansatte? → Ja/Nei
  - Profilering? → Ja/Nei
  - Sensitive kategorier? → Ja/Nei
- Dersom ≥2 «Ja»: varsle om DPIA-plikt og tilby dokumentasjonsmal
- Koble til `IkRosView.tsx` (risikovurdering) for å dokumentere DPIA-funn

#### 5.8 Automatiserte beslutninger (GDPR Art. 22)

**Problem:** Systemets AML-terskler beregner automatisk om verneombud/AMU er «lovpålagt» basert på antall ansatte. Dersom dette brukes som grunnlag for faktiske beslutninger (f.eks. avslag på å opprette AMU), kan det tolkes som automatisert beslutning.

**Forslag:**
- Tydeliggjør i UI at AML-terskel-indikatoren er et «veiledende beregningsresultat» — ikke en rettsgyldig avgjørelse
- Legg til en disclamer: «Beregningene er veiledende. Kontakt arbeidsrettsadvokat for bindende tolkning.»
- Loggfør ikke automatiske beslutninger — hold dem som informasjon kun

#### 5.9 Grensesnitt for Datatilsynet ved tilsyn

**Problem:** Datatilsynet kan anmode om dokumentasjon ved tilsyn. Det finnes ingen enkel eksport av GDPR-relatert informasjon.

**Forslag:**
- «Compliance-rapport»-eksport-funksjon:
  - Art. 30-register (alle behandlinger)
  - Liste over databehandlere og DPA-referanser
  - Oversikt over rettighetsforespørsler siste 12 måneder
  - Logg over datatilgang (hvem så hva, når)
  - Sikkerhetstiltak oppsummert
- Eksport som strukturert PDF med Datatilsynets forventede format

---

## Sammendrag — Prioritert tiltaksliste

### Kritisk (Lovpålagt / High Risk)

| # | Tiltak | Lovgrunnlag | Kompleksitet |
|---|---|---|---|
| C1 | Dokumenter behandlingsgrunnlag (Art. 30-register) | GDPR Art. 30 | Middels |
| C2 | Implementer datasletting / anonymisering ved sluttdato | GDPR Art. 5(1)(e) | Høy |
| C3 | Skille `agency_worker` fra `independent_contractor` i ansettelsestype | AML § 14-12, § 1-7 | Lav |
| C4 | Legge til formell mandat-struktur (verneombud, tillitsvalgt) med valgperiode | AML § 6-1, § 6-2 | Middels |
| C5 | GDPR-rettighetsforespørsel-mekanisme (Art. 15–21) | GDPR Art. 12–21 | Høy |

### Viktig (Forbedrer etterlevelse vesentlig)

| # | Tiltak | Grunnlag | Kompleksitet |
|---|---|---|---|
| I1 | Brreg-berikkelse: antallAnsatte, NACE, organisasjonsform, underenheter | AML terskler | Middels |
| I2 | Oppbevaringsregler med automatisk varsel og slettefrist | GDPR Art. 5 | Middels |
| I3 | Ansatters selvbetjenings-visning (se, be om retting, eksporter) | GDPR Art. 15, 16, 20 | Middels |
| I4 | Brukergrupper: krev formål og utløpsdato | GDPR Art. 5(1)(b) | Lav |
| I5 | Tilsynsrapport-eksport for Arbeidstilsynet | AML § 3-1, § 6-1, § 7-2 | Middels |

### Ønsket (UX og datakvalitet)

| # | Tiltak | Begrunnelse | Kompleksitet |
|---|---|---|---|
| U1 | Ny «Roller & verv»-tab med grafisk oversikt | Sporbarhet, compliance | Middels |
| U2 | Org-kart-visning (hierarkisk) | Brukervennlighet | Høy |
| U3 | CSV-import av ansatte | Onboarding-effektivitet | Middels |
| U4 | A-ordning-referansefelt | AML-terskel-presisjon | Lav |
| U5 | DPIA-checkliste i GDPR-fanen | Datatilsynet best practice | Lav |

---

## Tekniske implementeringsnotes

### Nye felt i `OrgEmployee`-typen

```typescript
export type OrgEmployee = {
  // eksisterende felt...
  
  // Ansettelsestype (nytt)
  employmentType: 'permanent' | 'temporary' | 'intern' | 'agency_worker' | 'independent_contractor'
  agencyName?: string          // navn på bemanningsbyrå (agency_worker)
  
  // GDPR
  scheduledDeletionAt?: string // ISO — sett N måneder etter endDate
  anonymizedAt?: string        // ISO — satt ved anonymisering
  
  // Verv
  mandates?: OrgEmployeeMandate[]
}
```

### Nye felt i `OrgSettings`

```typescript
export type OrgSettings = {
  // eksisterende...
  
  // Brreg-beriket
  brregAntallAnsatte?: number    // fra brreg_snapshot.antallAnsatte
  brregNaceKode?: string         // f.eks. «62.010»
  brregNaceBeskrivelse?: string  // f.eks. «Utvikling og produksjon av programvare»
  brregOrgForm?: string          // «AS», «ENK» etc.
  brregSyncedAt?: string         // ISO — sist synkronisert
  
  // A-ordningen
  aOrdningAntallAnsatte?: number
  aOrdningUpdatedAt?: string
  
  // GDPR
  dataRetentionInactiveMonths: number    // default: 36
  dataRetentionAuditYears: number        // default: 5
  privacyOfficerEmail?: string
  dpaDocumentRef?: string                // referanse til databehandleravtaler
}
```

### Ny tab-struktur

```typescript
type Tab = 'overview' | 'employees' | 'units' | 'groups' | 'mandates' | 'gdpr' | 'settings'

const TABS = [
  { id: 'overview',   label: 'Oversikt',         icon: PieChart },
  { id: 'employees',  label: 'Ansatte',           icon: Users,   badge: activeCount },
  { id: 'units',      label: 'Enheter',           icon: Building2 },
  { id: 'groups',     label: 'Grupper',           icon: UserCheck },
  { id: 'mandates',   label: 'Roller & verv',     icon: Shield },
  { id: 'gdpr',       label: 'GDPR & personvern', icon: Lock },
  { id: 'settings',   label: 'Innstillinger',     icon: Settings2 },
]
```

### Migrasjoner som kreves

1. `20260802_org_employee_mandates.sql` — ny `org_employee_mandates`-tabell med RLS
2. `20260802_org_data_retention_policy.sql` — oppbevaringsfelt og slettefunksjon
3. `20260802_org_processing_register.sql` — Art. 30-behandlingsprotokoll-tabell
4. `20260802_org_rights_requests.sql` — GDPR-rettighetsforespørsler-tabell
5. Oppdater `20260401120000_org_structure.sql` → legg til `agency_worker` i constraint

---

*Sist oppdatert: 2026-05-01. Ikke rettslig rådgivning — verifiser mot gjeldende lovdata.no og tariffavtale.*
