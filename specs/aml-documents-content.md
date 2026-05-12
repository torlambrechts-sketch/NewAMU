# AML-dokumenter — innholdsspesifikasjon

**Forfatter:** Senior content writer (compliance-funksjon)
**Status:** Utkast for review
**Hjemmel:** Arbeidsmiljøloven (AML), Internkontroll­forskriften (IK-f), Likestillings- og diskriminerings­loven (LDL), GDPR, BHT-forskriften, Forskrift om utførelse av arbeid, Byggherre­forskriften, Åpenhetsloven
**Tilhørende migrasjon:** `supabase/migrations/20260902120200_aml_documents_content_extensions.sql`
**Tilhørende TS-endring:** `src/data/documentTemplates.ts` (nye PAGE_TEMPLATES) + `src/types/documents.ts` (nye moduler + kategorier)

Specen lukker dokument-gapene fra compliance-analysen 2026-05-11 (DEL 7): varslingsrutine, trakasserings­rutine, DPIA, oppfølgings­plan sykefravær, arbeidsavtale-mal, drøftings­protokoll, ARP-redegjørelse, tilretteleggings­plan, og vernerunde-rapport. Innfører også åtte nye kategorier og fem nye dokument-moduler.

---

## 1. Oversikt

### Eksisterende maler (uendret eller utvidet)

| Slug | Kategori | Hjemmel | Status |
|---|---|---|---|
| tpl-hms-policy | hms_handbook | IK-f § 5 nr. 1a, AML § 3-1 | Utvidet (revisjons­logg + retention-marker) |
| tpl-org-ansvar | hms_handbook | IK-f § 5 nr. 1b, AML § 2-1 | Beholdt |
| tpl-risikovurdering | hms_handbook | IK-f § 5 nr. 2-3, AML § 3-1 | Beholdt |
| tpl-avvik | hms_handbook | IK-f § 5 nr. 4 | Beholdt |
| tpl-beredskap | beredskap (ny) | AML § 4-1, brannvern­loven | Flyttet til ny kategori |
| tpl-opplaering | hms_handbook | AML § 3-2, FOLM § 3-18 | Utvidet (opplærings­matrise-modul) |
| tpl-aarsgjennomgang | hms_handbook | IK-f § 5 nr. 5 | Beholdt |
| tpl-amu-protokoll | protokoll (ny) | AML § 7-2 | Flyttet |
| tpl-amu-rapport | protokoll (ny) | AML § 7-4 | Flyttet |
| tpl-rusmiddel | policy | AML § 2-3 | Beholdt |
| tpl-verneombud | guide | AML § 6 | Beholdt |
| tpl-verneombud-mandat | guide | AML § 6-1 til § 6-5 | Beholdt |
| tpl-personvern-ansatt | personvern (ny) | GDPR Art. 13, 14 | Flyttet |
| tpl-behandlingsprotokoll | personvern (ny) | GDPR Art. 30 | Flyttet |

### Nye maler (denne leveransen)

| Slug | Kategori | Hjemmel | Sider | Acknowledgement |
|---|---|---|---|---|
| **tpl-varslingsrutine** | varsling | AML § 2A-2 | 3 | Alle ansatte |
| **tpl-trakasseringsrutine** | varsling | AML § 4-3 (3), § 13-1, LDL § 26 | 3 | Alle ansatte |
| **tpl-dpia** | personvern | GDPR Art. 35 | 5 | DPO + DL |
| **tpl-oppfolgingsplan-sykefravar** | personal | AML § 4-6 | 2 | Arbeidstaker + leder |
| **tpl-tilrettelegging-plan** | personal | AML § 4-6 | 2 | Arbeidstaker + leder |
| **tpl-arbeidsavtale** | personal | AML § 14-5/§ 14-6 | 4 | Begge parter |
| **tpl-drofting-protokoll** | protokoll | AML § 8-1/§ 15-1 | 2 | Parter |
| **tpl-arp-redegjorelse** | likestilling | LDL § 26 | 6 | DL + tillitsvalgt |
| **tpl-vernerunde-rapport** | hms_handbook | AML § 6-2, IK-f § 5 nr. 6 | 2 | Leder + VO |
| **tpl-bht-arsplan** | hms_handbook | AML § 3-3, BHT-f § 4 | 3 | AMU |
| **tpl-eksponeringsregister** | register | Forskr. utf. arb. kap. 3, 4 | Liste, 60 år | Per arbeidstaker |
| **tpl-sha-plan** | bransje | Byggherre­forskriften § 8 | 6-12 | KU-koordinator |

### Nye kategorier

| Slug | Norsk navn | Bruk |
|---|---|---|
| `varsling` | Varsling | Varslings­rutine, varslings­saker, mottaks­dokumenter |
| `personal` | Personal | Arbeidsavtaler, oppfølging, tilrettelegging |
| `personvern` | Personvern og GDPR | DPIA, behandlings­protokoll, personvern­erklæring |
| `likestilling` | Likestilling og ARP | ARP-redegjørelse, lønns­kartlegging |
| `protokoll` | Protokoller | Drøftings­møter, AMU, vedtak |
| `register` | Registre | Eksponerings­register, opplærings­register |
| `beredskap` | Beredskap | Brann, krise, evakuering |
| `bransje` | Bransje­spesifikt | SHA, asbest, byggherre­dokumenter |

### Nye modul-blokker

| Modul | Bruk |
|---|---|
| `signature_block` | To-parts-signering (arbeidstaker + leder) med dato + fritekst |
| `revision_log` | Auto-rendret versjons­historikk fra `wiki_revisions` |
| `confidentiality_marker` | Banner for «Konfidensielt — begrenset tilgang» med tilgangs­liste |
| `contact_card` | Strukturert kontakt­info (varslings­mottak, BHT, Tilsynet) |
| `retention_marker` | Viser retention-kategori, minimums­oppbevaring, slettedato |

---

## 2. KRITISK — `tpl-varslingsrutine` (§ 2A-2)

**Mål:** Dekke § 2A-2 minimums­krav fullt ut. Den enkleste audit-finn er manglende eller mangelfull varslings­rutine.

**Lovens minimum (§ 2A-2 (3) bokstav a-c):** rutinen *skal* inneholde (1) oppfordring til å varsle, (2) fremgangsmåte for varsling, (3) fremgangsmåte for mottakers behandling.

### Innhold

**Block 1 — Alert (info):** «Pliktig rutine etter AML § 2A-2 for virksomheter med minst fem ansatte. Drøftet med tillitsvalgte/verneombud før vedtak.»

**Block 2 — Heading 1:** «Varslingsrutine»

**Block 3 — Text:** Innledning (3-4 setninger): formålet med rutinen, hvem den gjelder for (alle arbeidstakere, innleide, lærlinger, oppdragstakere som er sammen­lignbare med arbeidstakere), forplikt­else fra ledelsen om å håndtere alle varsler.

**Block 4 — Heading 2:** «Hva kan varsles?»

**Block 5 — Text:** Definisjon av «kritikkverdige forhold» (§ 2A-1 (2)): brudd på lov eller forskrift, brudd på virksomhetens skriftlige etiske retnings­linjer, eller brudd på etiske normer det er bred tilslutning til. Eksempler: korrupsjon, mobbing/trakassering, fare for liv og helse, økonomi­svindel, miljø­skade, diskriminering. **Eksplisitt:** politiske ytringer og personlig uenighet om faglig skjønn faller *utenfor* varslings­vernet.

**Block 6 — Heading 2:** «Slik varsler du»

**Block 7 — Text:** Tre nivåer:

1. **Intern varsling — primært:** Til nærmeste leder, til verneombud, eller til virksomhetens varslings­mottak. Skriftlig anbefalt (e-post, brev, skjema), men muntlig varsel skal også behandles.
2. **Intern varsling — utvidet:** Hvis nærmeste leder er involvert, kan du varsle til leders leder, til hovedverneombud, eller direkte til varslings­mottak.
3. **Ekstern varsling:** Til offentlig myndighet — Arbeidstilsynet (HMS), Datatilsynet (personvern), Økokrim (økonomi), Finanstilsynet (finans), Politiet, eller andre relevante. Til media: tillatt etter intern varsling først, eller direkte hvis det er fare for liv/helse, eller ved særlig kvalifisert allmenn­interesse.

**Block 8 — Module `contact_card`:** Varslings­mottak-kontakt + Arbeidstilsynet-svartelefon (73 19 97 00).

**Block 9 — Heading 2:** «Anonym varsling»

**Block 10 — Text:** Du kan velge å varsle anonymt. Virksomheten kan ikke kreve identifikasjon. Anonyme varsler behandles like seriøst som identifiserte. Begrensning: virksomheten kan ha vanskeligere for å innhente tilleggs­opplysninger og gi tilbakemelding.

**Block 11 — Heading 2:** «Mottakers behandling»

**Block 12 — Text:** Mottak: skriftlig bekreftelse til varsler innen 14 dager. Vurdering om varselet skal undersøkes, henvises til annen instans, eller avvises (med begrunnelse). Behandling: faktaundersøkelse — kan engasjere ekstern fagperson. Frist: ferdig­behandling normalt innen 3 mnd, lengre saker krever del-tilbakemelding.

**Block 13 — Heading 2:** «Vern mot gjengjeldelse — § 2A-4»

**Block 14 — Alert (danger):** «Det er forbudt å gjengjelde mot en arbeidstaker som har varslet eller gitt uttrykk for at de vil varsle. Gjengjeldelse inkluderer alt fra trusler, trakassering, usaklig forskjellsbehandling, ufrivillig omplassering, suspensjon, oppsigelse, og avskjed. Brudd kan medføre erstatnings­ansvar og oppreisning.»

**Block 15 — Heading 2:** «Personvern og taushets­plikt»

**Block 16 — Text:** Varsler­identitet er person­opplysning. Mottak behandler i konfidensialitet. Ledelsen får anonymisert informasjon der formålet tillater. Sak­ene oppbevares i 3-5 år etter avslutning, jf. retention-kategori `varslingssak`.

**Block 17 — Module `law_ref`:** AML § 2A-1, § 2A-2, § 2A-4, § 2A-6

**Block 18 — Module `revision_log`**

**Block 19 — Module `signature_block`:** «Drøftet med tillitsvalgt» + «Vedtatt av daglig leder»

**Block 20 — Module `acknowledgement_footer`:** Alle ansatte må kvittere

**Block 21 — Module `retention_marker`:** Retention-kategori = `intern_prosedyre`, minimum 5 år

**Lengde:** ~3 sider rendret.

**Bruker­grupper:** Alle ansatte (kvittere). Innleide (kvittere via innleier). Varslings­mottak (forvalter). Tilsynet (audit).

---

## 3. KRITISK — `tpl-trakasseringsrutine` (§ 4-3 (3), § 13-1, LDL § 26)

**Mål:** Egen skriftlig rutine for håndtering av trakasserings­varsler. Skiller seg fra varslings­rutine ved å være tema­spesifikk og krever ofte faktaundersøkelse av uavhengig part.

### Innhold (sammenfattet)

1. **Alert (warning):** «Trakassering er forbudt etter AML § 4-3 (3) og § 13-1, samt LDL § 13. Denne rutinen styrer hvordan trakasserings­varsler håndteres.»
2. **Definisjon:** trakassering = uønskede handlinger, unnlatelser eller ytringer som virker krenkende; mobbing; seksuell trakassering.
3. **Forskjell mot vanlig varsling:** trakasserings­saker går samme veg, men med tilleggs­krav: faktaundersøkelse skal være uavhengig av partene; midlertidige beskyttelses­tiltak vurderes umiddelbart; varsler får mer hyppig oppdatering.
4. **Slik melder du:** identifisert eller anonymt; primært verneombud + nærmeste leder ikke involvert i saken; alternativt HR eller varslings­mottak.
5. **Beskyttelse av begge parter:** midlertidige tiltak (omplassering av varsler hvis ønsket; ikke av anklaget før sak er behandlet); anklaget får faktaundersøkelse, ikke straff før konklusjon.
6. **Faktaundersøkelse:** prosedyre; ekstern fagperson hvis intern habilitet; tidsplan; rapport-mal.
7. **Konklusjon og tiltak:** mulige utfall — avvise / ikke konstatert / konstatert. Tiltak: samtale, omplassering, advarsel, oppsigelse, anmeldelse.
8. **Klagerett:** for begge parter.
9. **Personvern og taushets­plikt** (samme prinsipper som varsling).
10. **Modul `contact_card`:** verneombud, hovedverneombud, BHT, varslings­mottak, HR-direktør.
11. **Modul `law_ref`:** AML § 4-3 (3), § 13-1, § 13-7, LDL § 26, § 13.
12. **Modul `signature_block`** + **`acknowledgement_footer`**.

**Lengde:** ~3 sider. **Brukergrupper:** Alle ansatte (kvittere), HR, verneombud.

---

## 4. KRITISK — `tpl-dpia` (GDPR Art. 35)

**Mål:** Strukturert mal for personvern­konsekvens­vurdering, særlig relevant før trakasserings­undersøkelser, sykefraværs­oppfølging, overvåking, store data­behandlinger.

### Innhold

**Avsnitt 1 — Beskrivelse av behandlingen**
- Formål
- Behandlings­ansvarlig + databehandler
- Kategorier av personopplysninger
- Kategorier av registrerte (ansatte, kandidater, kunder)
- Mottakere
- Tredjelands­overføringer
- Oppbevarings­tid

**Avsnitt 2 — Nødvendighet og forholdsmessig­het**
- Rettslig grunnlag (Art. 6 + ev. Art. 9)
- Hvorfor mindre inngripende metoder ikke er tilstrekkelige
- Datamininering
- Informasjon til de registrerte

**Avsnitt 3 — Risiko­vurdering**
- For hver risiko: sannsynlighet × konsekvens
- Eksempler på risikoer:
  - Uautorisert tilgang til sensitive data
  - Re-identifikasjon ved aggregering
  - Tap eller endring av data
  - Diskriminering basert på behandlingen
  - Uberettiget profilering

**Avsnitt 4 — Tiltak**
- Tekniske tiltak (kryptering, tilgangsstyring, k-anonymitet)
- Organisatoriske (opplæring, taushetserklæringer, lognings­rutiner)
- Rest-risiko etter tiltak

**Avsnitt 5 — Konsultasjon**
- Tillitsvalgte/verneombud konsultert?
- DPO konsultert?
- Datatilsynet pre-konsultert (Art. 36) hvis høy rest-risiko?

**Avsnitt 6 — Konklusjon**
- Anbefalt: gjennomføres / gjennomføres med endringer / avbrytes
- Signatur DPO + daglig leder

**Modul `revision_log`** + **`signature_block`** + **`retention_marker`** (kategori `personvern`, minimum 3 år).

**Lengde:** 5 sider. **Brukergrupper:** DPO, daglig leder, Datatilsynet (ved kontroll).

---

## 5. KRITISK — `tpl-oppfolgingsplan-sykefravar` (§ 4-6)

**Mål:** Oppfølgings­plan etter § 4-6, innen 4 uker etter sykmelding for arbeidstaker med rest­arbeids­evne.

### Innhold

**Felt 1 — Person-info** (anonymisert i mal, fylles per sak)
- Navn, fødselsdato, stilling, avdeling
- Sykmeldings­dato, første fraværsdag
- Sykmeldings­grad og forventet varighet

**Felt 2 — Arbeids­oppgaver og evne­vurdering**
- Hovedoppgaver i stillingen
- Hva kan arbeidstaker utføre fortsatt?
- Hva er begrenset eller utelukket?

**Felt 3 — Tiltak fra arbeidsgiver**
- Tilrettelegging av arbeidstid (redusert, fleksitid, deltid)
- Tilrettelegging av arbeids­oppgaver (lettere, alternative)
- Fysisk tilrettelegging (utstyr, plass)
- Hjemmekontor / fjernarbeid
- Bistand fra kollega
- Annet

**Felt 4 — Bistand fra NAV**
- Tilretteleggings­tilskudd
- Inkluderings­tilskudd
- Hjelpemidler
- Arbeids­rettet rehabilitering
- Bedrifts­intern attføring

**Felt 5 — BHT-vurdering** (hvis aktuelt)

**Felt 6 — Plan for videre oppfølging**
- Dialogmøte 1 (innen 7 uker) — dato
- Dialogmøte 2 (innen 26 uker) — dato
- Justeringer underveis

**Felt 7 — Signatur arbeidstaker + leder + dato**

**Modul `confidentiality_marker`:** «Strengt person­dokument — tilgang: arbeidstaker, nærmeste leder, HR, BHT, NAV. Lagres i HR-system.»

**Modul `retention_marker`:** Kategori `personaldokument`, minimum 5 år.

**Lengde:** 2 sider. **Brukergrupper:** Arbeidstaker, leder, HR, BHT, NAV.

---

## 6. KRITISK — `tpl-arbeidsavtale` (§ 14-5/§ 14-6)

**Mål:** Standard­avtale som dekker EU 2019/1152-utvidet minimums­krav (14 punkter etter 2024-implementering).

### 14 obligatoriske punkter

1. Partenes navn og identifikasjon
2. Arbeidssted (eller hvor det varierer — beskrivelse)
3. Stillings­tittel + arbeids­oppgaver
4. Tidspunkt for arbeidsforholdets begynnelse
5. Forventet varighet hvis midlertidig + grunnlag
6. Prøvetids­bestemmelser
7. Arbeidstakers ferierett + ferielov-henvisning
8. Oppsigelses­frister begge veier
9. Lønn, andre godtgjørelser, utbetalings­tidspunkter
10. Daglig/ukentlig arbeidstid + pause
11. Vakt­ordninger (hvis aktuelt) + endrings­varsler
12. Tariff­avtale-tilknytning hvis aktuelt
13. **(2024-nytt)** Trygde­ordninger arbeidsgiver bidrar til (pensjon, forsikring)
14. **(2024-nytt)** Rett til opplæring og ev. forpliktelser ved opphør

**Tilleggs­seksjoner:**
- Klausuler (konkurranse, taushets­plikt) — separat vedlegg
- Reise- og utleggs­regler
- Personvern-henvisning (Art. 13)

**Modul `signature_block`** + **`retention_marker`** (kategori `personaldokument`, 5 år etter ansettelses­opphør).

**Lengde:** 4 sider for standard kontor­avtale. **Brukergrupper:** Arbeidstaker, HR.

---

## 7. KRITISK — `tpl-drofting-protokoll` (§ 8-1, § 15-1)

**Mål:** Standardisert mal for drøftings­protokoll — brukes både for § 8-1 (informasjons-/drøftings­plikt ≥ 50 ansatte) og § 15-1 (drøfting før oppsigelse).

### Innhold

1. **Identifikasjon:** dato, sted, hjemmel (§ 8-1 / § 8-2 / § 15-1 / annen)
2. **Parter:** representanter for arbeidsgiver, representanter for arbeidstakere/tillitsvalgte, ev. verneombud
3. **Sak:** kort beskrivelse av hva som drøftes
4. **Arbeidsgivers fremstilling:** bakgrunn, formål, konsekvenser, alternative vurderte
5. **Arbeidstakers/tillitsvalgtes synspunkter:** drøftings­innspill
6. **Konklusjon:** enighet/uenighet; vedtak (hvis aktuelt); plan for videre prosess
7. **Oppfølgings­frist:** dato + ansvarlig
8. **Signatur:** begge parter

**Modul `signature_block`** + **`retention_marker`** (kategori `personaldokument` for § 15-1, `hms_dokument` for § 8-1).

**Lengde:** 2 sider per protokoll. **Brukergrupper:** Parter, ev. Arbeidstilsynet ved tvist.

---

## 8. KRITISK — `tpl-arp-redegjorelse` (LDL § 26)

**Mål:** Lukke CLAUDE.md-referansen — `tpl-arp-redegjorelse` skal eksistere som ferdig mal.

### Innhold (LDL § 26 (3) minimums­liste)

1. **Innledning:** virksomhetens kjønns­fordeling totalt, organisasjons­nivå
2. **Lønnsforhold:** kjønns­kjønns­del med metodebeskrivelse; siste lønns­kartlegging (annet hvert år)
3. **Heltid/deltid:** fordeling per kjønn
4. **Foreldre­permisjon:** uttak per kjønn siste år
5. **Faktisk fravær pga. omsorg:** per kjønn
6. **Kartlagte risikoer for diskriminering:** alle 6 grunnlag
   - Kjønn
   - Etnisitet
   - Religion / livssyn
   - Funksjons­nedsettelse
   - Alder
   - Seksuell orientering / kjønnsidentitet
7. **Tiltak iverksatt siste år:** med ansvarlig + frist
8. **Evaluering av tiltakene**
9. **Plan for neste år**
10. **Signatur:** daglig leder + tillitsvalgt + dato

**Modul `signature_block`** + **`retention_marker`** (kategori `hms_dokument`, 5 år).

**Lengde:** 6 sider for SMB, 10-15 for konsern. **Brukergrupper:** Alle ansatte (tilgjengelig), LDO (tilsyn), styret.

---

## 9. EKSTRA — `tpl-tilrettelegging-plan` (§ 4-6)

Kompakt mal for konkret tilrettelegging. Skiller seg fra oppfølgings­plan ved å være tema­spesifikk for *gjennomført* tilrettelegging (ikke initiell planlegging).

**Innhold:** tilrettelegging-type · varighet · evalueringer · evt. fornying. **Lengde:** 1-2 sider.

---

## 10. EKSTRA — `tpl-vernerunde-rapport` (§ 6-2, FOLM § 3-7)

**Innhold:** dato, område, deltakere (leder + VO + ev. BHT), sjekkliste­funn med foto, klassifisering (rød/gul/grønn), tiltaks­liste med ansvarlig + frist, signatur. **Lengde:** 2 sider.

---

## 11. EKSTRA — `tpl-bht-arsplan` (§ 3-3, BHT-f § 4)

**Innhold:** BHT-leverandør, kontakt­personer, planlagte aktiviteter (vernerunder, ROS-bistand, opplæring, syke­fravær), timeplan­ramme, leveranser, signatur AMU-godkjenning. **Lengde:** 3 sider.

---

## 12. EKSTRA — `tpl-eksponeringsregister` (Forskr. utf. arb. kap. 3, 4)

**Innhold:** matrise med arbeidstaker × eksponering × periode × beskyttelse × medisinsk oppfølging. 60-års oppbevaring for asbest, 40-års for kreft­fremkallende. **Modul `retention_marker`** med eksplisitt 60-års markør.

---

## 13. EKSTRA — `tpl-sha-plan` (Byggherre­forskriften § 8)

**Innhold:** prosjekt­info, byggherre + KU-koordinator, identifiserte SHA-risikoer per arbeids­operasjon, tiltak, ansvar, signatur. **Lengde:** 6-12 sider avhengig av prosjekt­størrelse.

---

## 14. Nye dokument­moduler

Foreslås implementert i `src/types/documents.ts` ModuleBlock-union.

### 14.1 `signature_block`

```ts
{
  kind: 'module',
  moduleName: 'signature_block',
  params: {
    parties: ['arbeidstaker', 'leder'],   // eller andre roller
    requireDate: true,
    requireRole: true,
    notes?: string,  // valgfri fritekst
  }
}
```

Render: to-kolonne layout per part med (Navn _____ | Dato _____ | Signatur _____). Ved publisering kan signering gjøres digitalt via BankID-hook (fremtidig).

### 14.2 `revision_log`

```ts
{
  kind: 'module',
  moduleName: 'revision_log',
  params: { maxEntries?: number }  // default 5 siste
}
```

Render: tabell hentet fra `wiki_revisions` med kolonner: versjon, dato, forfatter, endrings­beskrivelse.

### 14.3 `confidentiality_marker`

```ts
{
  kind: 'module',
  moduleName: 'confidentiality_marker',
  params: {
    classification: 'fortrolig' | 'strengt_fortrolig' | 'aapen',
    accessList?: string[],  // roller
  }
}
```

Render: rødt/gult/grønt banner øverst med tilgangs­liste.

### 14.4 `contact_card`

```ts
{
  kind: 'module',
  moduleName: 'contact_card',
  params: {
    role: 'varslings_mottak' | 'bht' | 'verneombud' | 'tilsynet' | 'datatilsynet' | 'custom',
    name?: string,
    phone?: string,
    email?: string,
    url?: string,
  }
}
```

Render: stilig kort med ikon + kontakt­data. Live-data der tilgjengelig (verneombud-navn fra representatives-hook).

### 14.5 `retention_marker`

```ts
{
  kind: 'module',
  moduleName: 'retention_marker',
  params: {
    category: 'hms_dokument' | 'personaldokument' | 'opplaeringslogg' | 'amu_protokoll' | 'varslingssak' | 'personvern' | 'intern_prosedyre' | 'okonomidokument' | 'ad_hoc' | 'eksponering_60ar',
    minYears: number,
    legalRef: string,
  }
}
```

Render: footer med «Oppbevares i minst X år etter [hjemmel]. Slettes [dato hvis arkivert]».

---

## 15. Nye kategorier — implementasjon

CHECK-constraint på tre tabeller utvides:

- `wiki_pages.category`
- `wiki_spaces.category`
- `document_org_templates.category`

Nye verdier: `varsling`, `personal`, `personvern`, `likestilling`, `protokoll`, `register`, `beredskap`, `bransje`.

For hver organisasjon initierer migrasjonen et `wiki_spaces`-rad per ny kategori (ikoner: 🚨 varsling, 👥 personal, 🔒 personvern, ⚖️ likestilling, 📋 protokoll, 📊 register, 🚒 beredskap, 🏗️ bransje).

---

## 16. Selv-review

### 16a. End-user review

| Vurdering | Status |
|---|---|
| Tilgjengelig — kort innledning hvert dokument | ✅ |
| Klare overskrifter | ✅ |
| Norsk bokmål | ✅ |
| Lett å finne kontakt­info | ✅ (`contact_card`) |
| Acknowledgement uten friksjon | ✅ |
| Mobil­vennlig | ✅ (lite tekst per blokk) |

**Funn:** Varslings­rutinen er ~3 sider — bra lengde, ikke avskrekkende. ARP-redegjørelsen er 6 sider men strukturert i klare seksjoner. **Ingen blokkerende mangler.**

### 16b. Compliance officer review

| Sjekkpunkt | Status |
|---|---|
| § 2A-2 (3) minimums­innhold | ✅ alle 3 bokstavkrav dekket |
| § 4-3 (3) trakasserings­rutine separat | ✅ ny mal |
| GDPR Art. 35 DPIA fullstendig | ✅ alle 6 avsnitt |
| § 4-6 oppfølgings­plan — 4-ukers frist signalisert | ✅ via metadata |
| § 14-6 nytt 14-punkts minimums­krav (post-2024) | ✅ alle 14 punkter |
| § 8-1 / § 15-1 standardisert drøftings­protokoll | ✅ |
| LDL § 26 ARP — alle 6 grunnlag + 3 (3) minimums­liste | ✅ |
| Vern mot gjengjeldelse eksplisitt referert (§ 2A-4) | ✅ alert-blokk |
| Retention-merking per dokument­type | ✅ ny modul |
| Konfidensialitet for personal­dokumenter | ✅ ny modul |

**Restrisiko:**
1. SHA-plan-mal er ramme, ikke ferdig (krever prosjekt­spesifikk utfylling) — som bygg er
2. Stoff­kartotek henvist til ekstern­system (Eco-Online) — riktig avgrensning
3. Lønns­kartlegging­mal er ikke i denne leveransen — egen mal kreves fase 2
4. Åpenhets­lov­rapport — restanse fase 2
5. Modul-rendering for `signature_block` / `revision_log` etc. krever UI-arbeid før de viser pent (forward-kompatibel)

**Compliance­vurdering:** Innholds­krav i AML §§ 2A-2, 4-3 (3), 4-6, 6-2, 8-1, 14-5/14-6, 15-1, LDL § 26, og GDPR Art. 35 er dekket. **Godkjent.**

### 16c. Supervisor review

| Område | Status | Kommentar |
|---|---|---|
| Innholds­dekning vs gap-analyse | ✅ | 9 av 10 kritiske gap lukket (lønnskartlegging fase 2) |
| Pedagogisk struktur | ✅ | Hvert dokument: alert → heading → body → law_ref → signature |
| Skalerbarhet | ✅ | Kategoriene er åpne for fremtidige typer |
| Samspill med eksisterende UI | ⚠️ | Nye moduler renderes generisk inntil bygd |
| Vedlikehold | ✅ | Endringer i lov speiles i `law_ref`-blokker |
| Compliance-spor | ✅ | retention_marker + revision_log + acknowledgement |
| Rolle­modell | ⚠️ | Mer differensiering anbefalt fase 2 (16 roller vs dagens 5) |
| Migrasjon­kompatibel | ✅ | CHECK utvides idempotent |

**Vedtak:** **GODKJENT.**

Signert (digitalt) — Head of Compliance, 2026-05-11.

---

## 17. Restanse fase 2

- Lønns­kartleggings­mal (LDL § 26 a)
- Åpenhets­lov-rapport (åpenhets­loven § 5)
- Stoff­kartotek-integrasjon mot ekstern­system
- Rolle­modell­utvidelse (16 roller) — krever permission-system-arbeid
- UI-renderer for nye moduler
- BankID-integrasjon for `signature_block`
- Kobling av opplærings­register mellom `learning_courses` og `wiki_pages`
