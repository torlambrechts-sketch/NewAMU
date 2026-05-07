# Survey Template Coverage — AML + Internkontrollforskriften (+ Åpenhetsloven, GDPR)

**Status:** `draft` — for HMS-rådgiver review before any template here is promoted past `review_status='draft'` in the database.
**Scope:** Arbeidsmiljøloven (Lov 2005-06-17 nr. 62) + Internkontrollforskriften (FOR-1996-12-06-1127) + relevant cross-cutting acts (Åpenhetsloven, GDPR) for the survey-shaped use cases the existing engine can carry.
**Companion to:** `COMPLIANCE_TEMPLATE_COVERAGE.md` (checklist primitive). Where the same clause is handled by both primitives, both entries cite each other.
**Methodology:** A clause earns a survey template only when it is multi-respondent, recurring, aggregate-analysed, and (often) anonymous. Otherwise it routes to checklist, document, AMU, hr.discussion, whistleblowing, or avvik.

---

## Verification flags

- `Verifisert: Lovdata-curl` — confirmed verbatim from a curl fetch.
- `Verifisert: WebFetch-paraphrase` — fetched but paraphrased; ordlyd needs HMS-rådgiver re-check.
- `Verifisert: Trening` — drawn from training recall; **must be re-checked against lovdata before approval.**

All proposed templates ship with `review_status='draft'`. The admin Maler tab (when surfaced) renders the badge so customers see what is and isn't expert-verified.

---

## Pack assignment summary

| Pack | Purpose | Default anonymity | Snapshot lock | Templates this round |
|---|---|---|---|---|
| **arbeidsmiljo** | QPSNordic / ARK / pulse / D&I / workload | TRUE (k=5) | FALSE (iterates) | 5 new + 4 existing stubs |
| **compliance** | Identified attestations + leader self-assessments | FALSE | TRUE (locked on publish) | 7 new |
| **vendor** | Leverandørkontroll, åpenhetsloven, project closeout | FALSE | TRUE | 2 new + 3 existing |
| **engagement** | eNPS, Edmondson, leadership, team pulse | TRUE | FALSE | 2 new + 4 existing |
| **exit** | Sluttsamtale | TRUE | FALSE | 1 enriched (existing stub) |

---

## Part 1 — AML coverage walk

### Kap 1 — Innledende
**Verdict:** none survey-shaped. Definitions only.

### Kap 2 — Plikter

#### § 2-3 — Arbeidstakers medvirkningsplikt
`Verifisert: Trening`
**Mapping:** Compliance-pack survey — annual identified attestation that the employee understands their medvirkningsplikt and knows how to varsle.
**Slug:** `aml-2-3-medvirkningsplikt-attest`. **Pack:** compliance. **Cadence:** årlig + ved tilsetting.
**Items (forslag):**
1. Forstår jeg min medvirkningsplikt etter AML §2-3? (yes_no, required)
2. Vet jeg hvem mitt verneombud er og hvordan jeg når dem? (yes_no, required, law_ref="AML §6-1")
3. Vet jeg hvordan jeg melder avvik? (yes_no, required)
4. Vet jeg hvordan jeg varsler om kritikkverdige forhold? (yes_no, required, law_ref="AML §2A-1")
5. Hvilke spørsmål eller bekymringer har jeg knyttet til min rolle i HMS? (long_text, optional)
6. Bekreftelse — jeg har forstått innholdet i denne attesten. (respondent_signature, required)

- **Selskapsadmin:** sendes til alle ansatte ved tilsetting + årlig fornyelse. Identifisert (compliance pack); ikke anonym.
- **HMS-rådgiver:** dekker §2-3 og kobler til §6-1 (kjenne VO) + §2A (varslingskanaler). Sterkt artefakt for tilsyn.
- **Arbeidstilsynet:** dokumenterer at arbeidsgiver har sikret kunnskap hos ansatte. Lå brukbart svar på "har dere informert ansatte om plikt og rettigheter?"
- **Sr. utvikler:** OK — bruker eksisterende compliance-pack lock-flow + respondent_signature item.

#### § 2-1, § 2-2
**Verdict:** non-survey (umbrella employer duty / coordination — process). Cross-ref: `COMPLIANCE_TEMPLATE_COVERAGE.md` for tagging-only requirement rows.

### Kap 2A — Varsling
**Verdict:** non-survey. Whistleblowing module owns case lifecycle. *Exception:* a "trygghet for å varsle" (psychological safety) item exists in the engagement Edmondson template — sufficient.

### Kap 3 — Virkemidler

#### § 3-1 — Krav til systematisk HMS-arbeid
`Verifisert: Lovdata-curl` (partial)
**Mapping:** Compliance-pack survey — annual leader self-assessment of how mature the systematic HMS work is across the org. Distinct from the checklist `internkontroll-arsgjennomgang` (which is a single signed record); this survey collects across multiple leaders/units to produce an aggregate maturity score.
**Slug:** `aml-3-1-hms-modenhet-leder`. **Pack:** compliance. **Cadence:** årlig.
**Items (forslag):**
1. Har min enhet gjennomført minst én vernerunde siste 6 mnd? (yes_no, required, law_ref="IK-forskriften §5 nr.7")
2. Er ROS oppdatert siste 12 mnd for mitt ansvarsområde? (yes_no, required, law_ref="IK-forskriften §5 nr.6")
3. Er HMS-mål for mitt ansvarsområde dokumentert? (yes_no, required, law_ref="IK-forskriften §5 nr.4")
4. Har jeg hatt minst én HMS-samtale med teamet siste 12 mnd? (yes_no_na)
5. Er avvikshåndtering rutinemessig i bruk? (rating_1_to_5, required)
6. Hovedhindring for HMS-arbeid i min enhet (long_text, optional)
7. Bekreftelse fra leder (respondent_signature, required)

- **Selskapsadmin:** alle linjeledere fyller årlig. Eksponer aggregat per enhet i Statistikk-fanen.
- **HMS-rådgiver:** dekker §3-1 sammen med IK §5. Surveyens trend over år er det som svarer på "fungerer internkontrollen?"
- **Arbeidstilsynet:** flere års trend er sterk dokumentasjon på systematisk arbeid. Manglende lederattestasjon → tilsynsfunn.
- **Sr. utvikler:** OK. Threshold for "X of Y leaders attested" UI surface deferred per §8E.

#### § 3-5 — Plikt for arbeidsgiver til å gjennomgå opplæring i HMS
`Verifisert: Lovdata-curl`
**Mapping:** Compliance-pack survey — annual identified attestation by every leader with arbeidsgiveransvar. Distinct from the existing checklist `arbeidsgivers-hms-opplaering` which is a single one-shot record per leader; the survey version is a yearly sweep across all leaders for dashboard visibility.
**Slug:** `aml-3-5-arbeidsgivers-hms-attest`. **Pack:** compliance. **Cadence:** årlig.
**Items:**
1. Hvilken HMS-opplæring har jeg gjennomført siste 24 mnd? (long_text, required, law_ref="AML §3-5")
2. Når ble opplæringen sist fornyet? (datetime, required)
3. Last opp kursbevis (photo, optional)
4. Er det endringer i regelverk eller risikobilde som krever ny opplæring? (yes_no, required)
5. Bekreftelse fra arbeidsgiver / leder (respondent_signature, required)

- **Selskapsadmin:** sendes til hver leder hvert år. Statistikk-fanen viser dekning per enhet.
- **HMS-rådgiver:** §3-5 har ikke fast frekvens, men praksis er årlig oppdatering. Templatet er i samsvar.
- **Arbeidstilsynet:** spørres rutinemessig — surveyens dekningsgrad er sterk dokumentasjon.
- **Sr. utvikler:** photo-type fungerer for kursbevis (Commit 7-bucket). Lock på publish (compliance-pack) sikrer evidence.

#### § 3-2, § 3-3, § 3-4
**Verdict:** non-survey. Verneutstyr/opplæring is checklist; BHT is document; fysisk aktivitet is too thin for own template (folds into engagement pulse).

### Kap 4 — Krav til arbeidsmiljøet

#### § 4-1 — Generelle krav
**Verdict:** survey. Already covered by existing HMS-klima 8q stub. **No new template proposed.**

#### § 4-2 — Krav om tilrettelegging, medvirkning og utvikling
`Verifisert: Trening`
**Mapping:** arbeidsmiljo-pack survey, distinct from §4-3 psykososial.
**Slug:** `aml-4-2-medvirkning`. **Pack:** arbeidsmiljo. **Cadence:** halvårlig.
**Items (forslag):**
1. Føler jeg at jeg har medvirket i beslutninger som påvirker mitt arbeid? (likert_scale 1–5, required, law_ref="AML §4-2 (1)")
2. Er arbeidet tilrettelagt for min kompetanse og forutsetninger? (likert_scale 1–5, required, law_ref="AML §4-2 (2)")
3. Får jeg utviklingsmuligheter (kurs, nye oppgaver, ansvar)? (likert_scale 1–5, required, law_ref="AML §4-2 (3)")
4. Hvordan kan medvirkningen bedres i din enhet? (long_text, optional)

- Anonymous default (pack), k=5.
- **HMS-rådgiver:** §4-2 er bredere enn pulsmåling alene; surveyen dekker observable forhold. Komplementeres av §4-3 og engagement.
- **Arbeidstilsynet:** ja, medvirkningsdokumentasjon er ofte etterlyst i tilsyn med psykososialt arbeidsmiljø.
- **Sr. utvikler:** OK.

#### § 4-3 — Psykososialt
**Verdict:** survey, full domain. **Existing** stubs ARK, QPSNordic, HMS-klima, mobbing. **No new template proposed** — content licensing for ARK/QPSNordic is the bottleneck, not template creation.

#### § 4-4, § 4-5
**Verdict:** non-survey (vernerunde / stoffkartotek-runde checklists).

#### § 4-6
**Verdict:** non-survey (per-case HR).

### Kap 5
**Verdict:** non-survey (avvik primitive).

### Kap 6 — Verneombud

#### § 6-1 — Plikt til å velge verneombud
`Verifisert: Trening`
**Mapping:** Compliance-pack survey — annual confirmation across employees that VO is known + active in their area.
**Slug:** `aml-6-1-verneombud-bekreftelse`. **Pack:** compliance. **Cadence:** årlig.
**Items:**
1. Jeg vet hvem mitt verneombud er. (yes_no, required, law_ref="AML §6-1")
2. Verneombudet har vært aktivt det siste året (synlig, deltatt i runder, formidlet saker). (yes_no, required, law_ref="AML §6-2")
3. Jeg har kontakt-info til verneombudet. (yes_no, required)
4. Hvis nei på noen — hvilke, og hva trenger du? (long_text, optional)
5. Bekreftelse (respondent_signature, required)

- Identified (compliance pack).
- **HMS-rådgiver:** kombinerer §6-1 (plikt til å velge) og §6-2 (oppgaver). Surveyen dokumenterer at valget faktisk er kommunisert.
- **Arbeidstilsynet:** typisk spørsmål under tilsyn — "kjenner ansatte sitt verneombud?". Surveyen er svaret.
- **Sr. utvikler:** OK.

### Kap 7, 8 — non-survey (AMU + drøftelse)

### Kap 9 — Kontrolltiltak

#### § 9-1, § 9-2 — Vilkår + drøfting
`Verifisert: Trening`
**Mapping:** arbeidsmiljo-pack survey — employees' perception of whether ongoing kontrolltiltak (overvåking, integrasjoner, bevegelsesporing) er forsvarlige.
**Slug:** `aml-9-kontrolltiltak-opplevelse`. **Pack:** arbeidsmiljo. **Cadence:** årlig + ved nye kontrolltiltak. **Recommended anonymity threshold: 3** (small teams).
**Items:**
1. Har du fått informasjon om kontrolltiltakene som påvirker deg? (yes_no, required, law_ref="AML §9-2 (2)")
2. Oppleves kontrolltiltakene som forholdsmessige (proporsjonale)? (likert_scale 1–5, required, law_ref="AML §9-1 (1)")
3. Oppleves kontrolltiltakene som uforsvarlig belastende? (yes_no, required, severity_default="high")
4. Hvilke kontrolltiltak er du særlig opptatt av? (long_text, optional)

- Anonymous; threshold 3 because seksjons-/avdelings-spesifikke svar ofte er low-volume.
- **HMS-rådgiver:** §9-1 krever forholdsmessig vurdering; surveyen er empirisk innspill.
- **Arbeidstilsynet:** har høy oppmerksomhet på dette etter GDPR-Art.88.

### Kap 10 — Arbeidstid

#### Hele kapittelet
**Mapping:** arbeidsmiljo-pack survey — pulsmåling på arbeidstid, belastning, restitusjon.
**Slug:** `aml-10-arbeidstid-belastning`. **Pack:** arbeidsmiljo. **Cadence:** kvartalsvis.
**Items:**
1. Jobber jeg vanligvis innenfor avtalt arbeidstid? (yes_no, required, law_ref="AML §10-4")
2. Hvor ofte må jeg arbeide overtid? (single_select, required: aldri/sjeldent/ukentlig/daglig, law_ref="AML §10-6")
3. Får jeg tilstrekkelig restitusjon (døgnhvile, ukehvile)? (likert_scale 1–5, required, law_ref="AML §10-8")
4. Opplever jeg arbeidsbelastningen som forsvarlig? (likert_scale 1–5, required)
5. Kommentarer om belastning eller arbeidstid (long_text, optional)

- Anonymous default.
- **HMS-rådgiver:** kap 10 er normativ; surveyen kartlegger faktisk opplevelse, ikke om regelen er fulgt formelt.
- **Arbeidstilsynet:** trend over kvartal er sterk dokumentasjon ved tilsyn på overtid.

### Kap 11–12 — non-survey (mindreårige checklist; permisjon HR)

### Kap 13 — Likebehandling

#### § 13-1 — Forbud mot diskriminering
`Verifisert: Trening`
**Mapping:** arbeidsmiljo-pack survey — annual D&I + inkludering. Threshold 3.
**Slug:** `aml-13-likebehandling`. **Pack:** arbeidsmiljo. **Cadence:** årlig.
**Items:**
1. Har du opplevd diskriminering på din arbeidsplass siste 12 mnd? (yes_no, required, severity_default="critical", law_ref="AML §13-1")
2. Hvis ja — hva slags? (multi_select: politisk/medlemskap/kjønn/alder/etnisitet/funksjonsevne/legning/annet, optional)
3. Føler du at virksomheten aktivt arbeider mot diskriminering? (likert_scale 1–5, required)
4. Har du hørt om eller observert mobbing eller utilbørlig opptreden? (yes_no, required, severity_default="critical", law_ref="AML §4-3 (3)")
5. Frivillige kommentarer (long_text, optional)

- Anonymous, threshold 3 for liten avdelings-realisme.
- **HMS-rådgiver:** dekker §13-1 sammen med §4-3 (3) trakassering. Komplementeres av varslingsmodulen.
- **GDPR-flagg:** spørsmål 5 kan inneholde personidentifiserende særlige kategorier — UI-hint nødvendig (allerede flagget i compliance-pass).

#### § 13-2..§ 13-9
**Verdict:** non-survey (process / legal).

### Kap 14 — non-survey (onboarding checklist)

### Kap 15 — Opphør

#### § 15 — sluttsamtale
**Mapping:** exit-pack survey. **Existing** exit stub. **Enrich the existing template** rather than create new — skipping new template, content enrichment is HMS-rådgiver content task.

### Kap 16–20 — non-survey

---

## Part 2 — Internkontrollforskriften coverage walk

### § 5 nr.2 — Kunnskap og ferdigheter
**Mapping:** arbeidsmiljo-pack survey — annual employee perception of opplæring.
**Slug:** `ik-5-2-opplaering-effekt`. **Pack:** arbeidsmiljo. **Cadence:** årlig.
**Items:**
1. Har jeg fått tilstrekkelig opplæring til å utføre arbeidet sikkert? (likert_scale 1–5, required, law_ref="IK-forskriften §5 nr.2")
2. Får jeg informasjon ved endringer i rutiner eller utstyr? (likert_scale 1–5, required)
3. Hva slags opplæring savner du? (long_text, optional)

- Anonymous default, k=5.

### § 5 nr.3 — Medvirkning
**Mapping:** Overlapping with AML §4-2 medvirkning. **Use the same template** (`aml-4-2-medvirkning`); tag both clauses.

### § 5 nr.8 — Systematisk overvåking
**Mapping:** Compliance-pack survey — annual leader self-assessment that internkontrollen fungerer som forutsatt. Distinct from the checklist `internkontroll-arsgjennomgang` which is a single signed leader-record; the survey aggregates across all leaders for dashboard visibility.
**Slug:** `ik-5-8-internkontroll-egenkontroll`. **Pack:** compliance. **Cadence:** årlig.
**Items:**
1. Er HMS-mål for mitt ansvarsområde nådd siste år? (yes_no, required, law_ref="IK-forskriften §5 nr.4")
2. Er ROS oppdatert? (yes_no, required, law_ref="IK-forskriften §5 nr.6")
3. Er rutiner for avvik faktisk fulgt? (yes_no, required, law_ref="IK-forskriften §5 nr.7")
4. Er VO-samarbeid og AMU-deltakelse aktiv? (yes_no, required, law_ref="AML §6, §7")
5. Hva er det største forbedringsområdet for neste år? (long_text, required)
6. Bekreftelse fra leder (respondent_signature, required)

### Other IK clauses
- §5 nr.1, nr.4, nr.5: documents.
- §5 nr.6: ROS module.
- §5 nr.7: checklist.
- §6, §7: documents / out of scope.

---

## Part 3 — Cross-cutting laws

### Åpenhetsloven §4-§5 — Aktsomhetsvurderinger

**External (vendor):** existing template `ext-apenhetsloven` (vendor pack). No new external template.

**Internal (compliance):** annual attestation by innkjøp/ledelse that aktsomhetsvurderinger er gjennomført, dokumentert og publisert.
**Slug:** `apenhetsloven-aktsomhet-internal`. **Pack:** compliance. **Cadence:** årlig (innen 30. juni).
**Items:**
1. Har vi kartlagt våre leverandørkjeder siste 12 mnd? (yes_no, required, law_ref="Åpenhetsloven §4 (a)")
2. Har vi vurdert risiko for menneskerettighets-/arbeidsforholdsbrudd? (yes_no, required, law_ref="Åpenhetsloven §4 (b)")
3. Er aktsomhetsrapport publisert / klar til publisering innen 30. juni? (yes_no, required, law_ref="Åpenhetsloven §5")
4. Har vi behandlet eventuelle henvendelser etter §6? (yes_no, required, law_ref="Åpenhetsloven §6")
5. Bekreftelse fra ansvarlig (respondent_signature, required)

- Identified, locked on publish.
- **HMS-rådgiver:** dekker plikt etter §4 og §5 i ett sweep. Komplementeres av eksterne vendor-undersøkelser.
- **Arbeidstilsynet:** ikke deres jurisdiksjon — Forbrukertilsynet håndhever Åpenhetsloven.

### GDPR — Personvern-attest
**Mapping:** annual internal compliance attestation that personvern-rutiner er ivaretatt.
**Slug:** `gdpr-personvern-attest`. **Pack:** compliance. **Cadence:** årlig.
**Items:**
1. Er personvernerklæring oppdatert siste 12 mnd? (yes_no, required, law_ref="GDPR Art. 13/14")
2. Er behandlingsoversikt (Art. 30) oppdatert? (yes_no, required, law_ref="GDPR Art. 30")
3. Har vi gjennomført DPIA der pålagt? (yes_no, required, law_ref="GDPR Art. 35")
4. Er ansatte trent i personvern? (yes_no, required)
5. Har vi behandlet henvendelser fra registrerte (innsyn, retting, sletting)? (yes_no, required, law_ref="GDPR Kap. III")
6. Bekreftelse fra DPO / ansvarlig (respondent_signature, required)

- Identified, locked.
- **HMS-rådgiver:** ikke direkte AML, men Datatilsynet etterspør tilsvarende dokumentasjon.

### Arbeidsforhold-attest fra leverandør (AML §2-2)
**Mapping:** vendor-pack — vendors who place workers at the customer's site confirm their employees' arbeidsforhold complies with AML.
**Slug:** `vendor-arbeidsforhold-attest`. **Pack:** vendor. **Cadence:** ved kontrakt.
**Items:**
1. Bekrefter dere at deres ansatte som arbeider på vår plass har skriftlig arbeidsavtale per AML §14-5/§14-6? (yes_no, required, law_ref="AML §14-5")
2. Bekrefter dere at arbeidstid følger AML kap. 10 for våre prosjekter? (yes_no, required, law_ref="AML §10")
3. Last opp utdrag fra arbeidsavtale-mal (photo, required)
4. Last opp HMS-policy (photo, required)
5. Last opp BRREG-firmaattest (photo, required)
6. Bekreftelse fra leverandør (respondent_signature, required)

- Identified (vendor recipient flow), locked.

### Vendor — prosjekt-sluttattest
**Mapping:** vendor-pack — project closeout, lessons learned, eventual avvik for follow-up.
**Slug:** `vendor-prosjekt-sluttattest`. **Pack:** vendor. **Cadence:** prosjektslutt.
- Items list elided here for brevity; same shape as åpenhetsloven attest.

### Engagement (no AML/IK clause grounding)

#### Leder-360
**Slug:** `leadership-360`. **Pack:** engagement. **Cadence:** halvårlig.
**Justification:** common HR practice, AML §4-2 (3) brukes som rammeverk for utviklingsmuligheter.

#### Team-puls kvartal
**Slug:** `team-pulse-kvartal`. **Pack:** engagement. **Cadence:** kvartalsvis.

---

## Part 4 — Module adjustments shipped (Commit 10)

| Adjustment | What | Migration |
|---|---|---|
| **A** | Drop `mandatory_law` enum CHECK; add `law_ref text` to `org_survey_questions` | `20260811130000_survey_module_adjustments.sql` |
| **B** | `recommended_cadence_months int` on `survey_template_catalog` | same |
| **F** | `recommended_anonymity_threshold int` on `survey_template_catalog` | same |

Decisions C (junction), D (per-template anonymous override), E (multi-respondent attestation UI) deferred per the plan.

---

## Part 5 — Two-batch shipping plan

| Commit | Batch | Pack | Templates |
|---|---|---|---|
| **12** | Batch 1 | **compliance** (locked, identified) | aml-2-3-medvirkningsplikt-attest, aml-3-1-hms-modenhet-leder, aml-3-5-arbeidsgivers-hms-attest, aml-6-1-verneombud-bekreftelse, ik-5-8-internkontroll-egenkontroll, apenhetsloven-aktsomhet-internal, gdpr-personvern-attest |
| **13** | Batch 2 | **arbeidsmiljo + vendor + engagement + exit** | aml-4-2-medvirkning, aml-10-arbeidstid-belastning, aml-13-likebehandling, aml-9-kontrolltiltak-opplevelse, ik-5-2-opplaering-effekt, vendor-arbeidsforhold-attest, vendor-prosjekt-sluttattest, leadership-360, team-pulse-kvartal |

(`exit-utvidet` is content enrichment of an existing stub, not a new template — defer to a content commit when HMS-rådgiver provides the items.)

---

## Part 6 — Honest open gaps (NOT in scope this round)

1. **ARK / QPSNordic licensed content** — existing stubs say "erstatt med full pakke ved lisens". Real content needs a separate licensing channel.
2. **Cross-primitive coverage tagging** — survey ↔ requirement junction (decision C, deferred). Promote when reporting demands cross-primitive coverage analytics.
3. **Multi-respondent attestation threshold UI** — "X of Y leaders attested" surface (decision E, deferred). The data is queryable today via the invitations table.
4. **Subscale taxonomy normalization** — current `config.subscale` is freeform string. Acceptable until aggregate trend across templates becomes a customer demand.
5. **HMS-rådgiver review** of every proposed template — `review_status='draft'` until content + ordlyd verified.

---

## Part 7 — Verification & shipping cadence

Each new template lands in a single migration with `is_system=true`, `organization_id=NULL`, `pack` set, `recommended_cadence_months` set, `recommended_anonymity_threshold` set when overriding pack default. Idempotent on PK (catalog uses text primary key).

The `provision_survey_baseline_for_org` trigger from Survey Commit 3 picks them up automatically — every existing org with a matching pack license gets `survey_org_templates` rows pinned to the sidebar; new orgs auto-receive at license-grant.

Same posture as the compliance work: small commits, idempotent migrations, `review_status='draft'` everywhere, HMS-rådgiver promotes via direct DB UPDATE or a future admin action.
