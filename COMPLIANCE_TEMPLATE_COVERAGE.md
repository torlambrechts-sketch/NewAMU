# Compliance Template Coverage — AML + Internkontrollforskriften

**Status:** `draft` — for HMS-rådgiver review before any template here is promoted past `review_status='draft'` in the database.
**Scope:** Arbeidsmiljøloven (Lov 2005-06-17 nr. 62) + Internkontrollforskriften (FOR-1996-12-06-1127). Satellite forskrifter (Stoffkartotek, Arbeidsutstyr, Byggherre, Forskrift om systematisk HMS-arbeid) are **out of scope this round** per Q1.
**Methodology:** Each clause is mapped to one of three verdicts:
- **Template** — the clause is recurring, observable, and answerable with structured items. A `compliance_checklist_templates` row will be authored (commits 5.2 onwards).
- **Non-template** — the clause is satisfied by another primitive (Documents, Meetings, AMU, ROS, HR cases, Avvik). Recorded as a requirement row in `compliance_requirements` so coverage analysis can claim it via the appropriate primitive when those primitives ship.
- **Out-of-scope-here** — purely policy / penalty / administrative. Recorded as a requirement row only if it has any operational expression in the customer's day-to-day.

**Verification flags:**
- `Verifisert: Lovdata-curl` — text or wording confirmed via raw HTTP fetch from lovdata.no during this drafting pass.
- `Verifisert: WebFetch-paraphrase` — fetched but paraphrased by the WebFetch processing model; structure is right, exact wording must be re-checked.
- `Verifisert: Trening` — drawn from training recall; **must be re-checked against lovdata before approval**.

**Multi-tenant note:** All system requirements live as `organization_id IS NULL` rows; system templates are provisioned per-org by the AFTER INSERT/UPDATE trigger on `compliance_packs` (commit 5.0). Customers can edit their per-org template copy without affecting other tenants. They can disable but not delete system rows.

---

## Role lenses (applied per template entry below)

When a clause is mapped to **Template**, four role notes follow:

- **Selskapsadmin** — operational reality: who fills it out, when, what proof of work it produces.
- **HMS-rådgiver** — does the proposed template actually satisfy the legal text? What's missing?
- **Arbeidstilsynet** — what would a state inspector ask for, and does this template produce it?
- **Sr. utvikler / sikkerhet** — does the primitive support this without schema or RLS changes?

---

# Part 1 — Internkontrollforskriften (FOR-1996-12-06-1127)

`Verifisert: Lovdata-curl` for the full text of all 8 sections. Eight sections total; the spine of any HMS internkontroll system is **§ 4 (plikt) + § 5 (innhold)**.

## § 1 — Formål
**Mapping:** Out-of-scope-here. Statement of purpose; no operational expression.
**Krav-slug:** `ik-1`. **Pack:** aml-amu.

## § 2 — Virkeområde
**Mapping:** Out-of-scope-here. Determines whether the regulation applies; no template needed.
**Krav-slug:** `ik-2`. **Pack:** aml-amu.

## § 3 — Definisjoner
**Mapping:** Out-of-scope-here. Definitions; consumed by other clauses.
**Krav-slug:** `ik-3`. **Pack:** aml-amu.

## § 4 — Plikt til internkontroll
**Mapping:** Non-template. The duty is *to have a system*; the system itself is the collection of templates, ROS, action plans, audit log, etc. that the platform constitutes.
**Krav-slug:** `ik-4` (already seeded as `ik-5` per existing data — needs reconciliation; see "Schema reconciliation" below).
**Lovdata:** [lovdata.no/SF/forskrift/1996-12-06-1127/§4](https://lovdata.no/SF/forskrift/1996-12-06-1127/§4)

## § 5 — Innholdet i det systematiske HMS-arbeidet ⚠ **central clause**
**Mapping:** Eight numbered points, each mapping differently. This is the primary AML/IK template-coverage anchor. Quoting verbatim because exact wording matters:

| nr. | Krav (verbatim, lovdata) | Dokumentasjon | Mapping |
|---|---|---|---|
| 1 | Sørge for at lover og forskrifter i HMS-lovgivningen er tilgjengelig og ha oversikt over særlig viktige krav | Ikke påkrevd skriftlig | **Non-template** — Documents primitive (legal register). Krav-slug `ik-5-1`. |
| 2 | Sørge for at arbeidstakerne har tilstrekkelig kunnskaper og ferdigheter, inkl. informasjon om endringer | Ikke påkrevd skriftlig | **Non-template** — Learning module. Krav-slug `ik-5-2`. |
| 3 | Sørge for at arbeidstakerne medvirker | Ikke påkrevd skriftlig | **Non-template** — Verneombud + AMU. Krav-slug `ik-5-3`. |
| 4 | Fastsette mål for HMS | **Skal dokumenteres** | **Non-template** — Documents primitive (HMS-mål dokument). Krav-slug `ik-5-4`. |
| 5 | Ha oversikt over organisasjon, ansvar, oppgaver og myndighet for HMS | **Skal dokumenteres** | **Non-template** — Documents primitive (organisasjonskart). Krav-slug `ik-5-5`. |
| 6 | Kartlegge farer og problemer, vurdere risiko, lage planer og tiltak | **Skal dokumenteres** | **Non-template** — ROS module. Krav-slug `ik-5-6`. |
| 7 | Iverksette rutiner for å avdekke, rette opp og forebygge | **Skal dokumenteres** | **Template** — *Vernerunde – standard* + *Avviksoppfølging-runde* (new). Krav-slug `ik-5-7`. |
| 8 | Foreta systematisk overvåkning og gjennomgang av internkontrollen | **Skal dokumenteres** | **Template** — *Internkontroll-årsgjennomgang* (new). Krav-slug `ik-5-8`. |

**Schema reconciliation:** The existing seed at `20260807130100` introduced one combined `ik-5` requirement. Going forward I'll split that into `ik-5-1` … `ik-5-8` so coverage reports can be granular per numbered point. Migration in the next batch will keep the old `ik-5` row for backward-compat (mark as deprecated) and add the eight new rows.

### IK § 5 nr. 7 — Template: *Avviksoppfølging-runde*
**Pack:** aml-amu. **Cadence-hint:** kvartalsvis.
**Forslag til items:**
1. `aapne_avvik_oversikt` — yes_no_na — "Er status for åpne avvik gjennomgått siste kvartal?" (required, severity_default=high)
2. `forebygge_gjentakelse` — text — "Hvilke tiltak er iverksatt for å forebygge gjentakelse?" (required)
3. `lukket_avvik_eff` — yes_no_na — "Er effekt av lukkede avvik verifisert?" (required, severity_default=medium)
4. `signatur_hms_leder` — signature — "HMS-leders signatur" (required)

- **Selskapsadmin:** Fylles ut av HMS-leder hvert kvartal. Tar ~15 min hvis avviksoversikten er løpende oppdatert.
- **HMS-rådgiver:** Dekker IK § 5 nr. 7 sammen med eksisterende vernerunde. Kan med fordel kobles til avvik-modulen via `findings` for direkte oppslag.
- **Arbeidstilsynet:** Tilsyn vil etterlyse skriftlig dokumentasjon på "rutiner for å avdekke, rette opp og forebygge". Sjekklisten + signatur dekker dette.
- **Sr. utvikler:** Primitivet støtter dette uten endringer. Anbefaling: link `comment`-feltet til avvik-IDer via tekstkonvensjon, ikke FK (deferring relational tracking til Findings-primitivet).

### IK § 5 nr. 8 — Template: *Internkontroll-årsgjennomgang*
**Pack:** aml-amu. **Cadence-hint:** årlig.
**Forslag til items:**
1. `mal_oppfolging` — yes_no_na — "Er HMS-mål satt for året evaluert?" (required, law_ref="IK-forskriften §5 nr. 4")
2. `risikovurdering_oppdatert` — yes_no_na — "Er risikovurderinger oppdatert siste 12 mnd?" (required, law_ref="IK-forskriften §5 nr. 6")
3. `verneombud_aktivt` — yes_no_na — "Har verneombudet vært aktivt deltakende?" (required, law_ref="AML §6-2")
4. `amu_protokoll_signert` — yes_no_na — "Er AMU-protokoll for året undertegnet?" (required, law_ref="AML §7-2")
5. `avvik_handlingsplan` — yes_no_na — "Er avvikshåndtering og handlingsplan ført løpende?" (required, severity_default=high)
6. `bht_dialog` — yes_no_na — "Har bedriftshelsetjenesten levert årsrapport?" (law_ref="AML §3-3")
7. `forbedringsforslag` — text — "Hva er identifisert som hovedforbedring for neste år?"
8. `signatur_dagligleder` — signature — "Daglig leders signatur" (required)

- **Selskapsadmin:** Årlig egenkontroll, fylles ut av HMS-leder, signeres av daglig leder. Dette er det "produktet" et tilsyn kan be om å se.
- **HMS-rådgiver:** Direkte koble til IK § 5 nr. 8. Bør komplementeres av separate dokumenter for hver av de andre numrene (ikke alt-i-ett).
- **Arbeidstilsynet:** Sentral artefakt. Mangler signert årsgjennomgang er ofte første tegn på svikt i internkontrollen.
- **Sr. utvikler:** OK med eksisterende primitiv. Foreslå å eksponere `definition_snapshot` i ekstern eksport så historisk gjennomgang kan reproduseres bit-for-bit.

## § 6 — Samordning
**Mapping:** Non-template. Coordination duty between contractors at shared sites.
**Krav-slug:** `ik-6`. **Pack:** aml-amu. Could be a Documents primitive entry ("samordningsavtale") later.

## § 7 — Tilsynsmyndighet
**Mapping:** Out-of-scope-here. Statement of jurisdiction.
**Krav-slug:** `ik-7`.

## § 8 — Dispensasjon
**Mapping:** Out-of-scope-here. Departmental dispensation power.
**Krav-slug:** `ik-8`.

---

# Part 2 — Arbeidsmiljøloven

## Kap 1 — Innledende bestemmelser
**Mapping:** Out-of-scope-here. § 1-1 formål, § 1-2 virkeområde, § 1-3 unntak, § 1-4 utvidet anvendelse, § 1-5 hjemmearbeid, § 1-6 personer som ikke er arbeidstakere, § 1-7 utsendte arbeidstakere, § 1-8 definisjoner, § 1-9 ufravikelighet.
**Krav-slugs:** `aml-1-1` … `aml-1-9` (taxonomy completeness per Q5).

## Kap 2 — Arbeidsgivers og arbeidstakers plikter
`Verifisert: WebFetch-paraphrase` (HMS-rådgiver må gjennomgå ordlyd).

### § 2-1 — Arbeidsgivers plikter
**Mapping:** Non-template (umbrella duty). Krav-slug `aml-2-1`.

### § 2-2 — Arbeidsgivers plikter overfor andre enn egne arbeidstakere
**Mapping:** Non-template. Coordination duty for innleid + entreprenør. Krav-slug `aml-2-2`. Kan kobles til IK § 6 i Documents.

### § 2-3 — Arbeidstakers medvirkningsplikt
**Mapping:** Non-template. Slug `aml-2-3`. Innholdet i bokstav b, c, d, e (varsle om fare, stans ved livsfare, varsle trakassering, melde yrkesskade) er reaktive prosesser, ikke recurring sjekklister.

### § 2-4, § 2-5 — Opphevet
Excluded.

### § 2 A — Varsling
**Mapping:** Non-template. Whistleblowing-modulen håndterer dette. Krav-slug `aml-2a`.

## Kap 3 — Virkemidler i arbeidsmiljøarbeidet ⚠ **major checklist source**

### § 3-1 — Krav til systematisk HMS-arbeid
`Verifisert: Lovdata-curl` (partial — § 3-1 fragment confirmed).
**Mapping:** Non-template (the systematic work itself). The system is the platform; the requirement is met by *having* templates + ROS + action plans + audit log.
**Krav-slug:** `aml-3-1` (already seeded). **Pack:** aml-amu.

### § 3-2 — Særskilte forholdsregler for å ivareta sikkerheten
**Mapping:** **Template** — multiple sub-templates depending on hazard.
**Krav-slug:** `aml-3-2` (already seeded).

#### § 3-2 (1) a — Verneutstyr / personlig sikkerhet
Already covered by *Vernerunde – standard* item `verneutstyr_tilg`.

#### § 3-2 (1) b — Opplæring og informasjon før farlig arbeid
**Template:** *Onboarding – HMS-opplæring* (new). **Pack:** aml-amu. **Cadence-hint:** ved tilsetting.
**Forslag til items:**
1. `intro_arb_omr` — yes_no_na — "Har den ansatte fått omvisning og gjennomgang av arbeidsplassen?" (required)
2. `verneutstyr_opplaering` — yes_no_na — "Er bruk av personlig verneutstyr vist og praktisert?" (required, severity_default=critical)
3. `noedutgang` — yes_no_na — "Er nødutganger og samlingsplass vist?" (required)
4. `kjemikalier_intro` — yes_no_na — "Er stoffkartotek og kjemiske risikoer gjennomgått?" (severity_default=high)
5. `verneombud_kontakt` — text — "Hvem er den ansattes verneombud (navn + kontakt)?" (required)
6. `signatur_ansatt` — signature — "Den ansattes signatur" (required)
7. `signatur_naermeste_leder` — signature — "Nærmeste leders signatur" (required)

- **Selskapsadmin:** Fylles ut første arbeidsdag, signeres av begge. Beviset på at lovkrav om opplæring er fulgt før selvstendig arbeid.
- **HMS-rådgiver:** Dekker AML § 3-2 (1) b og § 3-3 (informasjon ved ansettelse). Kan sammenkobles med Onboarding-modul i HR.
- **Arbeidstilsynet:** Etterlyses særlig etter hendelser med nyansatte. Manglende signert opplæring er en klassisk avvik-trigger.
- **Sr. utvikler:** OK uten endringer. Anbefaling: vurder å la `assigned_to` peke på den nyansatte slik at sjekklisten knyttes til personalmappen via en framtidig people-FK.

### § 3-3 — Bedriftshelsetjeneste
**Mapping:** Non-template. Avtale + årsrapport hører i Documents-primitivet. Krav-slug `aml-3-3`.

### § 3-4 — Vurdering av tiltak for fysisk aktivitet
`Verifisert: Lovdata-curl` ("Arbeidsgiver skal, i tilknytning til det systematiske helse-, miljø- og sikkerhetsarbeidet, vurdere tiltak for å fremme fysisk aktivitet blant arbeidstakerne.").
**Mapping:** Non-template. Documents primitive (HMS-policy-vedlegg om fysisk aktivitet). Krav-slug `aml-3-4`.

### § 3-5 — Plikt for arbeidsgiver til å gjennomgå opplæring i HMS
**Mapping:** **Template** — *Arbeidsgivers HMS-opplæring – kontroll* (new, one-shot per leder).
**Pack:** aml-amu. **Cadence-hint:** ved tilsetting av leder / endring av arbeidsgiverrolle.
**Forslag til items:**
1. `kursnavn` — text — "Hvilken HMS-opplæring er gjennomført?" (required)
2. `kursdato` — text — "Når ble opplæringen fullført? (dd.mm.åååå)" (required)
3. `dokumentasjon` — photo — "Last opp kursbevis/diplom"
4. `signatur` — signature — "Bekreftelse fra arbeidsgiver" (required, law_ref="AML §3-5")

- **Selskapsadmin:** Fylles ut én gang per leder med arbeidsgiveransvar. Fungerer som arkiv-bevis.
- **HMS-rådgiver:** § 3-5 har ikke fast tidsangivelse, men praksis er at oppdatert kunnskap dokumenteres ved vesentlige endringer. Vurder cadence-hint "ved endring av regelverk".
- **Arbeidstilsynet:** Spørres rutinemessig: "Hvem har HMS-ansvar, og når har vedkommende tatt opplæring?" Manglende dokumentasjon → pålegg.
- **Sr. utvikler:** OK. `definition_snapshot` på sign sikrer at hva som ble dokumentert ikke kan endres senere.

### § 3-6 — Opphevet

## Kap 4 — Krav til arbeidsmiljøet ⚠ **major checklist source**

`Verifisert: Trening` — wording må kontrolleres mot lovdata.

### § 4-1 — Generelle krav til arbeidsmiljøet
**Mapping:** **Template** (covered by *Vernerunde – standard*, items `fysisk_arb_omr`). Krav-slug `aml-4-1` already seeded.

### § 4-2 — Krav om tilrettelegging, medvirkning og utvikling
**Mapping:** Non-template (organizational/HR-shaped). Krav-slug `aml-4-2`. Documents primitive ("HMS-handbok – kapittel om medvirkning") + AMU-saker.

### § 4-3 — Krav til det psykososiale arbeidsmiljøet
**Mapping:** **Template** — *Psykososial pulsmåling* (new) **+** existing item `psyk_arbmiljo` in standard vernerunde.
**Pack:** aml-amu. **Cadence-hint:** halvårlig.
**Forslag til items:**
1. `trakassering_observert` — yes_no_na — "Er det observert eller meldt om trakassering eller utilbørlig opptreden?" (required, severity_default=critical, law_ref="AML §4-3 (3)")
2. `arbeidsbelastning_balansert` — yes_no_na — "Oppleves arbeidsbelastningen som forsvarlig?" (severity_default=high)
3. `ledelse_dialog` — yes_no_na — "Har de ansatte regelmessig dialog med leder om arbeidssituasjon?" (severity_default=medium)
4. `inkluderende_kultur` — yes_no_na — "Oppleves arbeidsmiljøet som inkluderende?" (severity_default=medium)
5. `aapne_temaer` — text — "Hvilke psykososiale temaer er aktive nå?"
6. `signatur_verneombud` — signature — "Verneombudets signatur" (required)

- **Selskapsadmin:** Halvårlig pulsmåling fra verneombud. Mer uformelt enn QPSNordic-undersøkelse — supplerer survey-modulen.
- **HMS-rådgiver:** § 4-3 (1)–(4) er bredere enn pulsmålingen alene; sjekklisten dekker observable forhold. Krever støtte fra periodisk anonymisert survey for ikke-observable forhold.
- **Arbeidstilsynet:** Pulsmåling er ikke et lovkrav i seg selv, men dokumentasjon på systematisk oppfølging av psykososialt miljø er det.
- **Sr. utvikler:** GDPR-merknad: `aapne_temaer` text-felt kan inneholde personidentifiserende helseopplysninger. Anbefal å vise hint i UI før lagring (allerede flagget i tidligere compliance-pass).

### § 4-4 — Krav til det fysiske arbeidsmiljøet
**Mapping:** **Template** (delvis dekket av eksisterende vernerunde + dedikerte runder).

#### Item-utdrag i vernerunde dekker grunnsjekken. **Nye dedikerte templates:**

#### *Brannvernrunde* (new)
**Pack:** aml-amu. **Cadence-hint:** kvartalsvis.
1. `roemningsveier_frie` — yes_no_na — "Er rømningsveier frie og merkede?" (required, severity_default=critical, law_ref="AML §4-4, Forskrift om brannforebygging §6")
2. `slokkemidler_tilgjengelig` — yes_no_na — "Er slokkemidler tilgjengelig og kontrollert?" (required, severity_default=critical)
3. `branninstruks_synlig` — yes_no_na — "Er branninstruks tydelig oppslått?" (severity_default=high)
4. `samlingsplass_kjent` — yes_no_na — "Vet ansatte hvor samlingsplassen er?" (severity_default=high)
5. `siste_oevelse` — text — "Når ble siste branntestøvelse gjennomført?" (required)
6. `foto_avvik` — photo — "Bilder av eventuelle avvik"
7. `signatur` — signature — "Verneombudets signatur" (required)

- **Selskapsadmin:** Sjekkes hvert kvartal av verneombud + eier av lokalet. ~10–15 min på små lokaler.
- **HMS-rådgiver:** Brannforebygging er primært under brann- og eksplosjonsvernloven, men AML § 4-4 dekker beredskap og rømning. Sjekklisten må kompletteres av brannøvelse-protokoll i Documents.
- **Arbeidstilsynet:** Sammen med brannvesenet — manglende rømningsvei er et av de vanligste pålegg.
- **Sr. utvikler:** OK, ingen schema-endring.

#### *Ergonomi-runde* (new)
**Pack:** aml-amu. **Cadence-hint:** halvårlig.
1. `arbeidsstilling` — yes_no_na — "Er arbeidsstillingen vurdert som forsvarlig?" (severity_default=medium, law_ref="AML §4-4 (2) c")
2. `tunge_loft` — yes_no_na — "Forekommer tunge løft som ikke er risikovurdert?" (severity_default=high)
3. `gjentakende_bevegelser` — yes_no_na — "Er gjentakende bevegelser identifisert og dempet?" (severity_default=medium)
4. `hjelpemidler_tilgjengelig` — yes_no_na — "Er ergonomiske hjelpemidler tilgjengelig der det trengs?" (severity_default=medium)
5. `pauser_tilrettelagt` — yes_no_na — "Er pauser og rotering tilstrekkelig?" (severity_default=low)
6. `tiltak_foreslaatt` — text — "Forslag til ergonomiske tiltak"

- **Selskapsadmin:** Verneombud + eventuelt fysioterapeut/BHT. Fokus på fysiske arbeidsplasser; mindre relevant for ren kontorvirksomhet (men ikke null).
- **HMS-rådgiver:** Dekker § 4-4 (2) c. For arbeidsplasser med produksjon/lager må også Forskrift om utførelse av arbeid §§ 23-1 ff. konsulteres (ikke i scope nå).
- **Arbeidstilsynet:** Ergonomi-pålegg er økende. Dokumentert oppfølging er hovedmotmelding.
- **Sr. utvikler:** OK.

#### *Maskinsikkerhet-sjekk* (new)
**Pack:** aml-amu. **Cadence-hint:** månedlig på maskinell virksomhet, ellers ved endring.
1. `maskin_id` — text — "Hvilken maskin/utstyr er kontrollert? (ID)" (required)
2. `verneanordning_funksjon` — yes_no_na — "Fungerer verneanordninger som forutsatt?" (required, severity_default=critical, law_ref="AML §4-4 (1)")
3. `noedstopp_test` — yes_no_na — "Er nødstopp testet og responderer?" (required, severity_default=critical)
4. `dokumentasjon_oppdatert` — yes_no_na — "Er bruksanvisning og samsvarserklæring tilgjengelig?" (severity_default=high)
5. `vedlikehold_journal` — yes_no_na — "Er siste vedlikehold dokumentert?" (severity_default=medium)
6. `foto` — photo — "Bilder av kontrollert utstyr"
7. `signatur` — signature — "Inspektørens signatur" (required)

- **Selskapsadmin:** Bruksavhengig — produksjonsbedrifter har dette løpende; rene kontorer bruker det aldri.
- **HMS-rådgiver:** Komplementeres av Arbeidsutstyrsforskriften (FOR-2011-12-06-1357). Krav-slugs til den forskriften legges til i en senere runde.
- **Arbeidstilsynet:** Maskin- og utstyrssikkerhet er ofte primær årsak til alvorlige hendelser. Dokumentert månedssjekk er forventet.
- **Sr. utvikler:** OK uten endringer. Foreslår kobling til en framtidig "Equipment" entitet (out of scope nå).

### § 4-5 — Krav til kjemisk og biologisk helsefare
**Mapping:** **Template** — *Stoffkartotek-runde* (new).
**Pack:** aml-amu. **Cadence-hint:** årlig + ved nye stoffer.
**Forslag til items:**
1. `stoffkartotek_oppdatert` — yes_no_na — "Er stoffkartoteket oppdatert siste 12 mnd?" (required, severity_default=high, law_ref="AML §4-5, Forskrift om kjemikalier")
2. `merking_korrekt` — yes_no_na — "Er kjemikalier korrekt merket (CLP)?" (required, severity_default=critical)
3. `oppbevaring_forsvarlig` — yes_no_na — "Er oppbevaring og separasjon forsvarlig?" (required, severity_default=critical)
4. `verneutstyr_dedikert` — yes_no_na — "Er dedikert verneutstyr for kjemikaliebruk tilgjengelig?" (required, severity_default=critical)
5. `risikovurdering_pr_stoff` — yes_no_na — "Er risikovurdering gjort for hvert farlig stoff?" (required, severity_default=high)
6. `eksponeringsmaling` — yes_no_na — "Er eksponeringsmålinger gjennomført der pålagt?" (severity_default=high)
7. `foto` — photo — "Bilder fra runden"
8. `signatur` — signature — "Verneombud + HMS-leder signatur" (required)

- **Selskapsadmin:** Bruksavhengig (mest produksjon, lab, renhold, verksted). Hvis ingen kjemikaliebruk → templatet kan deaktiveres.
- **HMS-rådgiver:** Dekker hovedlinje av § 4-5 men ikke detaljer i Forskrift om utførelse av arbeid kap. 3 (kjemisk arbeidsmiljø). Tilstrekkelig for AML-baseline; full compliance krever forskriften.
- **Arbeidstilsynet:** Stoffkartotek + risikovurdering er to av de mest etterspurte dokumentene under tilsyn.
- **Sr. utvikler:** OK.

### § 4-6 — Tilrettelegging for arbeidstakere med redusert arbeidsevne
**Mapping:** Non-template (case-shaped). Documents primitive (tilretteleggingsplan per ansatt). Krav-slug `aml-4-6`.

## Kap 5 — Registrerings- og meldeplikt, produsentkrav m.v.

`Verifisert: Trening`.

### § 5-1 — Registrering av skader og sykdommer
**Mapping:** Non-template — Avvik / Findings primitive (allerede dekket av automatisk avvik-opprettelse fra kritiske svar). Krav-slug `aml-5-1`.

### § 5-2 — Arbeidsgivers varslings- og meldeplikt
**Mapping:** Non-template — Incident-modulen. Krav-slug `aml-5-2`.

### § 5-3 — Leges meldeplikt
**Mapping:** Out-of-scope-here (gjelder leger). Krav-slug `aml-5-3`.

### § 5-4, § 5-5 — Produsentkrav
**Mapping:** Out-of-scope-here. Krav-slugs `aml-5-4`, `aml-5-5`.

## Kap 6 — Verneombud

### § 6-1 — Plikt til å velge verneombud
**Mapping:** Non-template — AMU-valg / amu_election-modulen. Krav-slug `aml-6-1`.

### § 6-2 — Verneombudets oppgaver
**Mapping:** **Template** — *Verneombud-årsrapport* (new).
**Pack:** aml-amu. **Cadence-hint:** årlig.
**Forslag til items:**
1. `runder_gjennomfort` — number — "Antall vernerunder gjennomført dette året"
2. `avvik_meldt` — number — "Antall avvik meldt fra verneombud"
3. `samarbeid_amu` — yes_no_na — "Er saker brakt videre til AMU der det er aktuelt?" (severity_default=medium, law_ref="AML §7-2")
4. `egen_opplæring` — yes_no_na — "Er verneombudets opplæring oppdatert?" (severity_default=high, law_ref="AML §6-5")
5. `kommentar` — text — "Verneombudets kommentarer til arbeidsmiljøåret"
6. `signatur_verneombud` — signature — "Verneombudets signatur" (required)
7. `signatur_dagligleder` — signature — "Daglig leders bekreftelse" (required)

- **Selskapsadmin:** En gang i året, fylles av VO selv, signeres med daglig leder. Følger naturlig før AMU-årsrapport.
- **HMS-rådgiver:** § 6-2 lister oppgaver; rapporten er platformens måte å dokumentere oppfyllelsen. Bør forbindes med AMU-protokoll.
- **Arbeidstilsynet:** Spørres ofte: "Hvilken oversikt har VO?" Skriftlig årsrapport er et sterkt svar.
- **Sr. utvikler:** Forslag (ikke i scope nå): legg til rolle-sjekk på `signed_by` så bare brukere med rollen verneombud kan signere. Dokumenter dette som "V1" gap fra tidligere compliance-pass.

### § 6-3 — Verneombudets rett til å stanse farlig arbeid
**Mapping:** Non-template (rett, ikke recurring sjekk). Krav-slug `aml-6-3`.

### § 6-4 — Særskilte lokale eller regionale verneombud
**Mapping:** Non-template. Krav-slug `aml-6-4`.

### § 6-5 — Utgifter, opplæring m.v.
**Mapping:** Non-template — Documents primitive (kursbevis). Krav-slug `aml-6-5`.

## Kap 7 — Arbeidsmiljøutvalg
**Mapping:** Non-template — eksisterende AMU-modul (Meetings-primitiv). Krav-slugs `aml-7-1`, `aml-7-2`, `aml-7-3`, `aml-7-4`.

## Kap 8 — Informasjon og drøftelse
**Mapping:** Non-template — HR-konsultasjon-modulen. Krav-slugs `aml-8-1`, `aml-8-2`, `aml-8-3`.

## Kap 9 — Kontrolltiltak
**Mapping:** Non-template — Documents (overvåkingspolicy) + GDPR. Krav-slug `aml-9-x`.

## Kap 10 — Arbeidstid
**Mapping:** Non-template — HR-modul. Sjekkliste-uegnet (kontinuerlig kontroll, ikke periodisk). Krav-slug `aml-10-x`.

## Kap 11 — Arbeid av barn og ungdom

`Verifisert: WebFetch-paraphrase`.
**Mapping:** **Template** — *Tilsetting av mindreårig – sjekk* (new). Hele kapittelet kan dekkes av én onboarding-sjekk for under-18.
**Pack:** aml-amu. **Cadence-hint:** ved tilsetting.
**Forslag til items:**
1. `alder_bekreftet` — yes_no_na — "Er alderen til den ansatte bekreftet (kopi av legitimasjon)?" (required, severity_default=critical, law_ref="AML §11-1")
2. `arbeidstid_innenfor_grenser` — yes_no_na — "Er planlagt arbeidstid innenfor lovens grenser (8t/dag, 40t/uke for 15-18 år)?" (required, severity_default=critical, law_ref="AML §11-2")
3. `nattarbeid_unngas` — yes_no_na — "Er nattarbeid (kl 20-06) unngått eller unntatt etter §11-3?" (required, severity_default=critical, law_ref="AML §11-3")
4. `helsekontroll` — yes_no_na — "Er helsekontroll gjennomført før arbeid?" (required, severity_default=high, law_ref="AML §11-4")
5. `pauser_dokumentert` — yes_no_na — "Er pauseregler (30 min ved 4,5t) sikret i arbeidsplanen?" (required, severity_default=high, law_ref="AML §11-5")
6. `foresatt_samtykke` — yes_no_na — "Er samtykke fra foresatt innhentet (under 18)?" (required, severity_default=critical)
7. `signatur_naermeste_leder` — signature — "Nærmeste leders signatur" (required)
8. `signatur_foresatt` — signature — "Foresattes signatur (hvis under 18)" (required)

- **Selskapsadmin:** Engangs-sjekkliste per ung tilsatt. Vesentlig at den er signert FØR første arbeidsdag.
- **HMS-rådgiver:** Dekker hele kap. 11. Bør lenkes til personalmappen + arbeidsavtale-mal i Documents.
- **Arbeidstilsynet:** Tilsyn med ungdomsarbeid har høy prioritet, særlig sommerjobber + lærlinger. Manglende dokumentasjon → pålegg + bot.
- **Sr. utvikler:** Vurder å fjerne CTA hvis pakken aktiveres for org uten under-18-ansatte. Per nå: vis i Maler-fanen, admin kan deaktivere.

## Kap 12 — Permisjon
**Mapping:** Non-template — HR-modul. Krav-slugs `aml-12-x`.

## Kap 13 — Vern mot diskriminering
**Mapping:** Non-template — HR + Whistleblowing. Krav-slugs `aml-13-x`.

## Kap 14 — Ansettelse mv.

`Verifisert: Trening`.

### § 14-1 — § 14-4
**Mapping:** Non-template — HR-prosesser (utlysning, fortrinnsrett). Krav-slugs `aml-14-1` … `aml-14-4`.

### § 14-5 — Krav om skriftlig arbeidsavtale
**Mapping:** Non-template — Documents primitive (arbeidsavtale-mal). Krav-slug `aml-14-5`.

### § 14-6 — Minimumskrav til innholdet i den skriftlige arbeidsavtalen
**Mapping:** **Template** — *Arbeidsavtale-sjekk* (new) — kontroll av at minstekrav er dekket før signering.
**Pack:** aml-amu. **Cadence-hint:** ved tilsetting.
**Forslag til items:**
1. `partenes_identitet` — yes_no_na — "Er partenes identitet angitt?" (required)
2. `arbeidssted` — yes_no_na — "Er arbeidssted angitt?" (required)
3. `stillingsbetegnelse` — yes_no_na — "Er stillingsbetegnelse / arbeidsoppgaver beskrevet?" (required)
4. `tiltredelse_dato` — yes_no_na — "Er tiltredelsesdato angitt?" (required)
5. `varighet` — yes_no_na — "Er varighet (fast/midlertidig) angitt?" (required)
6. `proevetid` — yes_no_na — "Er prøvetid (om aktuelt) skriftlig avtalt?" (severity_default=medium)
7. `ferierettigheter` — yes_no_na — "Er rett til ferie og feriepenger angitt?" (required)
8. `oppsigelsesfrister` — yes_no_na — "Er oppsigelsesfrister angitt?" (required)
9. `lonn` — yes_no_na — "Er lønn / godtgjørelse spesifisert?" (required)
10. `arbeidstid` — yes_no_na — "Er arbeidstid (lengde + plassering) angitt?" (required)
11. `pauser` — yes_no_na — "Er rett til pauser angitt?" (required)
12. `tariffavtale` — yes_no_na — "Er eventuell tariffavtale angitt?" (severity_default=low)
13. `signatur_arbeidsgiver` — signature — "Arbeidsgivers signatur" (required)
14. `signatur_ansatt` — signature — "Den ansattes signatur" (required)

- **Selskapsadmin:** Brukes som sjekkpunkt før kontrakten signeres. Tar 5 min, hindrer at avtalen havner uten et minstekrav.
- **HMS-rådgiver:** Dekker § 14-6 (1) bokstav a-l fullstendig (jeg telte tilsynelatende riktig — må verifiseres mot ordlyd). Bra som "lifecycle gate".
- **Arbeidstilsynet:** Manglende minstekrav i kontrakt er en hyppig avvik-årsak. Dokumentert sjekk forhindrer dette systematisk.
- **Sr. utvikler:** OK. Forslag (ikke i scope nå): integrer mot Documents-modul slik at arbeidsavtalen i seg selv lenkes som vedlegg.

### § 14-9 — Fast og midlertidig ansettelse
**Mapping:** Non-template (vurdering, ikke kontroll). Krav-slug `aml-14-9`.

### § 14-12 / § 14-13 — Innleie
**Mapping:** Non-template (vurderingsregel). Krav-slugs `aml-14-12`, `aml-14-13`. Documents primitive (innleieavtale).

## Kap 15 — Opphør av arbeidsforhold
**Mapping:** Non-template — HR-modul. Krav-slugs `aml-15-x`.

## Kap 16 — Virksomhetsoverdragelse
**Mapping:** Non-template — HR. Krav-slugs `aml-16-x`.

## Kap 17 — Tvister
**Mapping:** Out-of-scope-here.

## Kap 18 — Tilsynet
**Mapping:** Out-of-scope-here.

## Kap 19 — Straff
**Mapping:** Out-of-scope-here.

## Kap 20 — Avsluttende bestemmelser
**Mapping:** Out-of-scope-here.

---

# Part 3 — Schema reconciliation needed before commit 5.2

Two cleanups before the first new template batch lands:

1. **Split `ik-5` into `ik-5-1` … `ik-5-8`** — the existing seed has one combined row; new requirements migration adds the eight numbered points + marks the old `ik-5` as `is_active=false` (don't delete; existing tagging junctions reference it).
2. **Backfill missing AML chapter requirements** — slug skeletons `aml-2-1`, `aml-2-2`, `aml-2-3`, `aml-3-2` (already seeded), `aml-3-3`, `aml-3-4`, `aml-3-5`, `aml-4-2`, `aml-4-6`, `aml-5-1`, `aml-5-2`, `aml-6-1`, `aml-6-3`, `aml-6-5` plus the chapter-level placeholders `aml-2a`, `aml-7-x`, `aml-8-x`, `aml-9-x`, `aml-10-x`, `aml-12-x`, `aml-13-x`, `aml-14-x`, `aml-15-x`, `aml-16-x` (taxonomy completeness per Q5 — for coverage reports later, even if no template covers them yet).

Both cleanups are additive — no existing data destroyed.

---

# Part 4 — Review status

This dossier itself is **draft**. Before any of the proposed new templates ship in commits 5.2+, I recommend:

1. **HMS-rådgiver**: red-pen each role-note row, especially the `Verifisert: Trening` clauses where my recall may have drifted. Anything flagged needs lovdata-confirmation.
2. **Compliance / legal**: confirm the mapping verdicts (Template / Non-template / Out-of-scope-here) are defensible.
3. **Senior dev (me)**: verified the proposed templates fit the existing primitive — no new schema, no new RLS surfaces, no new attachment types beyond what commit 3 already shipped. Item-level `requirement_slugs` (Q3b) gives the granular traceability without code changes.

Open questions for the user / domain expert:

- **Q-A:** Should *Tilsetting av mindreårig* be its own template or items added to *Onboarding – HMS-opplæring*? (My instinct: separate — different role-notes, different cadence applicability.)
- **Q-B:** Should the *Brannvernrunde* live in the AML pack, or in a hypothetical future `brann-eksp` pack tied to brann- og eksplosjonsvernloven? (My current proposal: AML pack now; can be re-tagged when satellite forskrifter ship.)
- **Q-C:** *Maskinsikkerhet-sjekk* duplicates Arbeidsutstyrsforskriften scope. Acceptable to include now and split later, or wait?

---
