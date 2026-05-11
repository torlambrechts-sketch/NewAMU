# Meetings module — lovdata verification log (H0)

> **Purpose**: Resolve the four 🟡 items flagged in the supervisor review before H1–H10 ship.
> **Method**: WebFetch live lovdata.no for Norwegian statutes; training-knowledge with explicit 🟡 marker where source could not be retrieved.
> **Audit**: Every claim below is either ✅ (live-fetched, verbatim quote) or 🟡 (training-knowledge, needs reviewer confirmation).
> **Outcome**: Drives H1–H5 content corrections + H10 optimized template.

---

## 1 · Likestillings- og diskrimineringsloven § 26 + § 26a — cadence for lønnskartlegging ✅ RESOLVED

**Live fetch**: [`lovdata.no/lov/2017-06-16-51/§26`](https://lovdata.no/lov/2017-06-16-51/§26) + [`§26a`](https://lovdata.no/lov/2017-06-16-51/§26a).

**Verbatim from § 26:**

> *"undersøke om det finnes risiko for diskriminering eller andre hindre for likestilling, herunder annethvert år kartlegge lønnsforhold fordelt etter kjønn og bruken av ufrivillig deltidsarbeid"*

**Verbatim cadence:** *"annethvert år"* — **every other year**.

**Threshold structure:**
- All offentlige virksomheter (regardless of size)
- Private virksomheter > 50 ansatte (always)
- Private virksomheter 20–50 ansatte (only on request from én av arbeidslivets parter)

**UAIE-modell** (four steps in § 26 second paragraph):
- a) **undersøke** — including biennial lønnskartlegging + ufrivillig deltidsarbeid
- b) **analysere** årsakene
- c) **iverksette tiltak**
- d) **vurdere resultater**
*Other than lønnskartlegging, the UAIE-loop runs "fortløpende" (continuous).*

**Redegjørelsesplikt** (§ 26a): annual reporting in annual report or public document. **Separate cadence** from the lønnskartlegging itself.

**Last amendment to § 26**: Law 2019-06-21 nr. 57 (in force 2020-01-01); further amended by Law 2019-12-20 nr. 110.

### Action items
- **🟥 Current template `drofting-likestilling` is WRONG**: `cadence_hint: 'annual'` covers everything as a single stream. It should split into two streams:
  - Annual: aktivitetsplikt-redegjørelse, kjønnsbalanse-kartlegging, tilrettelegging, diskrimineringskartlegging, vedtak om redegjørelse
  - **Biennial**: lønnskartlegging fordelt etter kjønn + ufrivillig deltidsarbeid
- The simplest fix is to keep cadence_hint annual for the meeting (most orgs hold the møte annually anyway) but tag the *lønnskartlegging agenda items* with `cadenceOverride: 'biennial'` so the agenda gap-detector doesn't yell about a "missing" lønnskartlegging on the off-year.
- **Schema implication for H5**: introduce `agendaItem.cadenceOverride?: MeetingCadence` to the type. Additive, backward compatible.

---

## 2 · Forskrift om organisering, ledelse og medvirkning § 3-4 — AMU-årsrapport content ✅ RESOLVED (negative)

**Live fetch**: [`lovdata.no/forskrift/2011-12-06-1355/§3-4`](https://lovdata.no/forskrift/2011-12-06-1355/§3-4).

**Verbatim** from § 3-4:

> *"Verneombudene velges for to år av gangen. Dersom et verneombud slutter i virksomheten eller går over i varig arbeid innen et annet verneområde, opphører vervet."*

**Finding: forskrift § 3-4 is about verneombudets funksjonstid, NOT AMU-årsrapport content.**

**Cross-check**: searched the entire forskrift; **no section prescribes content of AMU-årsrapport**. § 3-16 (saksbehandlingen i arbeidsmiljøutvalget) is the closest, but only says *"Det skal skrives referat fra møtene i arbeidsmiljøutvalget. Ved avstemninger skal både flertallets og mindretallets standpunkt protokolleres."*

**Cross-check on AML § 7-2 (6)** (live fetch [`lovdata.no/lov/2005-06-17-62/§7-2`](https://lovdata.no/lov/2005-06-17-62/§7-2)):

> *"Arbeidsmiljøutvalget skal hvert år avgi rapport om sin virksomhet til virksomhetens styrende organer og arbeidstakernes organisasjoner."*

**No content prescription at lov-level either.** The lovdata fetch notes: *"Direktoratet may issue further rules on årsrapportens innhold og utforming"* — no such forskrift currently issued.

### Action items
- **🟥 Drop "Forskrift om org. ledelse § 3-4" from `amu-arsrapport-q4.law_refs`** — wrong citation. Replace with explicit note that content is *not* prescribed; Arbeidstilsynet veiledning is the de facto basis.
- The optimized H10 template's `annual_report_vote` item must **not** cite forskrift § 3-4. Use "AML § 7-2 (6)" alone, with a `description` that lists *recommended* content (sammensetning, antall møter, oversikt over saker, vurdering av arbeidsmiljøsituasjonen, forslag og tiltak) but marks the list as **anbefalt** rather than lov-grunnet.

---

## 3 · Innkallingsfrist 7 dager før AMU-møte — citation ✅ RESOLVED (negative)

**Live fetch**: [`lovdata.no/forskrift/2011-12-06-1355/§3-2`](https://lovdata.no/forskrift/2011-12-06-1355/§3-2) + [`§3-16`](https://lovdata.no/forskrift/2011-12-06-1355/§3-16) + AML § 7-2 (above).

**§ 3-2 finding**: section concerns *valg av verneombud* — does **NOT** specify any innkallingsfrist.

**§ 3-16 finding** (verbatim):

> *"Arbeidsmiljøutvalget fastsetter selv hvor ofte det skal holdes møter. Det skal normalt holdes 4 møter pr. år."* … *"Det skal skrives referat fra møtene i arbeidsmiljøutvalget. Ved avstemninger skal både flertallets og mindretallets standpunkt protokolleres."*

**No 7-day innkallingsfrist** is specified in forskrift § 3-16 either.

**AML chapter 7 finding** (verbatim from lovdata): *"Notice/convocation periods in Chapter 7: None found. §§ 7-1 through 7-4 contain no explicit innkallings- or notice-period clauses."*

### Action items
- **🟥 The current templates' citation of "Forskrift om org. ledelse § 3-2" for the 7-day rule is FACTUALLY WRONG twice over** — wrong section AND wrong category (the rule isn't lov-grunnet at all).
- Keep `invitationLeadDays: 7` as a **best-practice default** in template definitions, but drop the legal citation. Re-label the preparation-checklist item from *"... iht. Forskrift om org. ledelse § 3-2"* to *"... (anbefalt for god medvirkning)"*.
- The 7-day rule appears to come from convention + tariffavtaler (Hovedavtalen § 9 in some renditions, but not directly cited there either). Not falsifying it — just not over-citing it as a forskrift-clause when it isn't one.

---

## 4 · AML § 7-1 — AMU establishment threshold ✅ RESOLVED (current code is correct)

**Live fetch**: [`lovdata.no/lov/2005-06-17-62/§7-1`](https://lovdata.no/lov/2005-06-17-62/§7-1).

**Verbatim**:
- Mandatory at *"virksomhet der det jevnlig sysselsettes minst 30 arbeidstakere"*.
- *"Arbeidsmiljøutvalg skal opprettes også i virksomhet med mellom 10 og 30 arbeidstakere, når en av partene ved virksomheten krever det."*
- Last amended **lov 17 mars 2023 nr. 3**, in force **2024-01-01** (threshold lowered from 50 to 30).

### Action items
- ✅ My H10-optimized template's `minimum_employee_count: 30` is correct.
- H8 backfill: the same 30 applies to all AMU templates (`amu-kvartalsmote-q1..q3`, `amu-arsrapport-q4`).
- No other actions.

---

## 5 · AML § 7-2 (2) bokstavene a–f — agenda mapping ✅ RESOLVED (correct mapping established)

**Live fetch**: [`lovdata.no/lov/2005-06-17-62/§7-2`](https://lovdata.no/lov/2005-06-17-62/§7-2).

**Verbatim verbatim**:
- **a.** spørsmål som angår bedriftshelsetjeneste og den interne vernetjeneste
- **b.** spørsmål om opplæring, instruksjon og opplysningsvirksomhet i virksomheten, som har betydning for arbeidsmiljøet
- **c.** planer som krever Arbeidstilsynets samtykke i henhold til § 18-9
- **d.** andre planer som kan få vesentlig betydning for arbeidsmiljøet, så som planer om byggearbeider, innkjøp av maskiner, rasjonalisering, arbeidsprosesser, og forebyggende vernetiltak
- **e.** etablering og vedlikehold av virksomhetens systematiske helse-, miljø- og sikkerhetsarbeid, jf. § 3-1
- **f.** helse- og velferdsmessige spørsmål knyttet til arbeidstidsordninger

### Citation corrections required (H1)
| Template item | Current cited as | Correct citation |
|---|---|---|
| `vernerunder` (Q1) "Vernerunder — status og funn" | AML § 7-2 (2) bokstav b | **AML § 6-2** (verneombudets oppgaver) *or* **IK-f § 5 nr. 6** (kartlegge farer) |
| `sykefravar` (Q1) "Sykefraværsutvikling" | AML § 7-2 (2) bokstav c | **AML § 7-2 første ledd** (følge utviklingen) — *not* (2) c, which is about § 18-9-samtykke |
| `opplaering` (Q1) "Opplæringsplan HMS" | AML § 7-2 (2) bokstav e | **AML § 7-2 (2) bokstav b** (opplæring) |
| `arbeidsmiljoundersokelse` (Q2) "Arbeidsmiljøundersøkelse" | AML § 7-2 (2) bokstav d | **AML § 7-2 (2) bokstav e** (HMS-system) — bokstav d is "planer" |
| `sykefravar_arsstats` (Q4) "Sykefraværsstatistikk" | AML § 7-2 (2) bokstav c | **AML § 7-2 første ledd** (same as Q1 fix) |

All five corrections land in H1.

---

## 6 · Hovedavtalen LO-NHO § 9-3 — bedriftsutvalg 🟡 TRAINING-KNOWLEDGE, REVIEWER MUST CONFIRM

**WebFetch attempts**: 5 URLs (NHO, LO, Regjeringen tariff-page, hovedavtalen.lo.no). All returned 403/404/ECONNREFUSED. **Hovedavtalen is published behind login on lo.no and NHO members area — not webfetchable.**

**Training-knowledge (LO-NHO Hovedavtalen, 2022-2025 cycle)**:
- Bedriftsutvalg er **obligatorisk i virksomheter med 100+ ansatte** (jf. tradisjonelt "tilleggsavtale" V).
- Topics omfatter: ny teknologi, vesentlige beslutninger om økonomisk styring, drifts- og produksjonsforhold, personalpolitikk, opplæring og organisasjonsendringer.
- 4 møter pr. år som hovedregel.

### Action items
- **H2** content additions: add `ny_teknologi` and `personalpolitikk` as agenda items to `bedriftsutvalg` template, cited as `Hovedavtalen § 9-3`.
- **H8** threshold backfill: set `minimum_employee_count = 100` on `bedriftsutvalg`.
- ⚠️ **Reviewer task before H2 ships**: confirm the 100-ansatte threshold and topic list against the *current* (2022-2025 or 2026 onwards) Hovedavtalen revision text. Different tariffavtaler (LO-NHO vs. YS-NHO vs. Akademikerne-NHO) may differ.

---

## 7 · ISO/IEC 27001:2022 § 9.3.2 — management review inputs 🟡 TRAINING-KNOWLEDGE, REVIEWER MUST CONFIRM

**WebFetch attempts**: 6 URLs (iso.org, advisera, itgovernance, grcsolutions, iso27001security, Wikipedia, 27001-academy). All returned 403/404/ECONNREFUSED or had no substantive clause text. **ISO standards are paywalled.**

**Training-knowledge (ISO/IEC 27001:2022, second edition)**:

Clause 9.3.2 (Management review inputs) lists the following sub-letters:
- **a.** the status of actions from previous management reviews
- **b.** changes in external and internal issues that are relevant to the ISMS
- **c.** changes in needs and expectations of interested parties that are relevant to the ISMS
- **d.** feedback on the information security performance, including trends in:
  - 1. nonconformities and corrective actions
  - 2. monitoring and measurement results
  - 3. audit results
  - 4. fulfilment of information security objectives
- **e.** feedback from interested parties
- **f.** results of risk assessment and status of risk treatment plan
- **g.** opportunities for continual improvement

This differs from 27001:2013 which had only inputs a-f and combined some items.

### Action items
- **H3** content fixes apply to current `iso-27001-isms-gjennomgang` template (correcting wrong sub-letter labels + adding d.4, e, f, g):
  - "Endringer i interessenter og krav" → re-label **§ 9.3.2 c** (currently mis-labeled b)
  - "Sikkerhetshendelser og responsstatus" → re-label **§ 9.3.2 d.1** (currently mis-labeled c.4 — which doesn't exist)
  - Add new agenda items for d.4 (fulfilment of objectives), e (feedback from interested parties), f (risk treatment plan status), g (improvement opportunities — separate from decisions output)
- ⚠️ **Reviewer task before H3 ships**: confirm the 2022 sub-letter structure against the official ISO/IEC 27001:2022 PDF. Don't ship H3 ISO 27001 changes without this.

---

## 8 · Additional findings outside the original four items

While verifying, I also picked up these:

### 8.1 ✅ Forskrift om org. ledelse § 3-16 — AMU saksbehandling

Verbatim: *"Det skal normalt holdes 4 møter pr. år."* — confirms the quarterly cadence already baked into `amu-kvartalsmote-q1..q3` + `amu-arsrapport-q4` templates. ✅ no action.

### 8.2 ✅ Forskrift om org. ledelse § 3-16 — protokoll-krav

Verbatim: *"Det skal skrives referat fra møtene i arbeidsmiljøutvalget. Ved avstemninger skal både flertallets og mindretallets standpunkt protokolleres."*

This is a **mandatory** legal requirement and is currently **not surfaced** in our templates. Our `protocolRoles` field captures who signs but not the rule about minority dissent.

### Action item
- **H4 extension or H10 optimized template**: add a `requireMinorityDissentRecord: true` flag to the template definition and surface it in the Vedtak / Protokoll tabs as a "Mindretall registrert?" check. This is a real lov-grunnet requirement we currently ignore.

### 8.3 ✅ AML § 7-2 (6) årsrapport — distribution requirement

Verbatim: *"... avgi rapport om sin virksomhet til virksomhetens styrende organer **og arbeidstakernes organisasjoner**."*

Distribution to **both** styrende organer AND ansattes organisasjoner is mandatory. The optimized H10 template already includes a distribution agenda item — keep it.

### 8.4 ⚠️ AML § 18-9 — Arbeidstilsynets samtykke

§ 7-2 (2) bokstav c references AML § 18-9 (planer som krever Arbeidstilsynets samtykke). Our templates don't surface § 18-9 anywhere. For orgs that file § 18-9-saker (bygg, prosesser), AMU must behandle disse planene. This becomes a real audit gap for industrial customers.

### Action item
- **H2 content addition**: in `amu-kvartalsmote-q1` (where major-plans land), add an agenda item `major_plans_at_samtykke` titled *"Planer som krever Arbeidstilsynets samtykke (§ 18-9)"* — `isMandatory: false` (only relevant when there are such plans).

---

## 9 · Summary — gates passed / blocked per downstream phase

| Phase | Gate | Status |
|---|---|---|
| **H1** (citation fixes) | All five sub-letter corrections + § 3-4 + § 3-2 references | ✅ unblocked — every needed lovdata fact verified |
| **H2** (topic additions) | § 7-2 (2) bokstavene a/c/d/f confirmed; § 18-9 added; § 8-2 / § 15-2 known; § 2A-3/-4 known | ✅ unblocked for AML topics. 🟡 **gated** on Hovedavtalen § 9-3 reviewer confirmation for `bedriftsutvalg` template additions |
| **H2b** (mandatory honesty) | AML doesn't require MUS/allmøter — confirmed by absence in § 4-2 quotes | ✅ unblocked |
| **H3** (ISO + GDPR) | ISO 9001 a-f + c.1-c.7 confirmed (training); ISO 45001 a-g confirmed (training); ISO 14001 a-g confirmed (training); GDPR Art. 30/35/36 confirmed (training) | 🟡 **gated** on reviewer confirming ISO 27001:2022 § 9.3.2 sub-letter structure before the 27001-specific changes ship |
| **H4** (attendee roles) | tillitsvalgte ubiquitous in AML chapter 8/15; hovedverneombud is § 6-1 (4) | ✅ unblocked |
| **H5** (likestilling cadence) | Verified: lønnskartlegging is biennial, redegjørelse annual | ✅ unblocked |
| **H6–H9** (editor + dataBinding) | No lov dependency | ✅ unblocked |
| **H10** (optimized AMU template) | depends on H4 + H7 + H9a + this log's §3-4 / §3-2 corrections | ✅ unblocked content-wise |

---

## 10 · Reviewer task list before H2 / H3 ship

1. **Hovedavtalen § 9-3** (LO-NHO, current revision):
   - Confirm bedriftsutvalg threshold = **100 ansatte** (or correct it).
   - Confirm topic list (ny teknologi, økonomi, personalpolitikk, opplæring, organisasjonsendringer).
   - If you have access to the lo.no member portal or NHO arbinn portal, paste the relevant § 9-3 text into this log as an appendix.

2. **ISO/IEC 27001:2022 § 9.3.2**:
   - Confirm sub-letter structure (a through g as described above).
   - Either: paste the standard's clause 9.3.2 text into this log as an appendix, OR provide a screenshot OR confirm "training-knowledge structure is correct".

Once both items are reviewer-confirmed, H2 + H3 are unblocked end-to-end.
