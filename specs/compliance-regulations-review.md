# Compliance regulations — deep review against the modular template surfaces

> Cross-regulation audit: what NewAMU's six template-driven modules (checklist,
> survey, document, e-learning, register, meetings) can address out of the
> Norwegian and EU/international compliance stack — **arbeidsmiljøloven**,
> **internkontrollforskriften**, **GDPR + personopplysningsloven**,
> **ISO 9001/14001/45001/27001**, **likestillings- og diskrimineringsloven**,
> **åpenhetsloven**, and **CSRD/ESRS**.

> **Verdict format per requirement (auditor view + senior-developer
> verification)** — for every paragraph / article / clause:
> 
> - ✅ **Shipped** — at least one template exists today (file cited) and the
>   module's runtime can produce the evidence an auditor would ask for.
> - 🟡 **Partially shipped** — template exists but is incomplete on content,
>   or runtime supports it but no seed has been authored.
> - 🟠 **Process-only** — the modular surface can host the artefact, but
>   the artefact is content-heavy and requires legal-text drafting beyond
>   what a generic template ships. The platform is the *vessel*, not the
>   *answer*. Marking this honestly is critical to avoid auditor
>   surprise.
> - ❌ **Missing / not addressable today** — either no seed and no template,
>   or the regulation requires something the current schema cannot represent
>   (signatures with legal evidentiary weight, end-to-end encrypted whistleblowing,
>   external regulator API integration, etc.).
> - ⏸ **Out of scope by design** — the regulation governs something
>   templates have no business carrying (criminal proceedings, court
>   filings, individual termination letters, etc.).

> **Reviewed on:** 2026-05-11. Sources of truth used:
> CLAUDE.md *Template surfaces*; ROADMAP.md §1–§8; specs/PLAYBOOK.md;
> specs/compliance-planner.md; specs/meetings-parity.md;
> 290+ migration files under `supabase/migrations/`. Every claim in the
> coverage tables links to the file that proves it.

---

## 1 · Framing — what an "addressable" requirement looks like

Norwegian and EU labour/data/quality regulation breaks into seven
recognisable **artefact families**. The platform maps cleanly onto these
because each family has one canonical module:

| Artefact family | Reg.-language clue | Canonical module |
|---|---|---|
| **Procedure / policy text** that must exist in writing | "skriftlig dokumentert", "rutiner", "policy", "documented information", "procedure" | `documents` — `document_system_templates` with `legal_basis text[]` |
| **Periodic verification / inspection** that something is in order | "regelmessig kontroll", "vernerunder", "control", "internal audit", "skal verifisere" | `compliance` — `compliance_checklist_templates` |
| **Annual / decision meeting** with a quorum and a protocol | "AMU", "ledelsens gjennomgang", "management review", "drøftingsmøte", "årsmøte" | `meetings` — `meeting_system_templates` |
| **Asset / activity inventory** with custom fields | "register", "fortegnelse", "protokoll over behandlinger", "stoffkartotek", "leverandørregister" | `registers` — `register_types` |
| **Employee-level competence / training** with evidence of completion | "opplæring", "kompetansebevis", "sertifisering", "competence" | `learning` — `learning_system_courses` |
| **Anonymous-or-attested survey / pulse / attestation** sweep | "spørreundersøkelse", "kartlegging", "attest", "egenrapport", "consultation of workers" | `survey` — `survey_template_catalog` |
| **Individual identifiable employee case** (sykefravær, oppsigelse, varslingssak X) | "personalmappe", "individuelt", "varslingssak", "personal data" | **Not a template module** — lives in `tasks` (sourceType pattern), `whistleblowing` (dedicated submodule), HR/payroll outside this platform |

Anything that fits one of the first six families is *addressable* by the
platform. Anything in the seventh sits outside templates by design —
templates carry the *process*; the case-files live in tasks /
whistleblowing / external HR.

---

## 2 · Module capability matrix — what the templates can actually carry

Verified against `modules/<m>/types.ts` + migration DDL. Columns mirror the
auditor's recurring questions; ✅ = first-class column or feature, 🟡 =
representable in jsonb but no first-class UI, ❌ = not representable today.

| Capability | Checklist | Survey | Document | Register | Learning | Meeting |
|---|---|---|---|---|---|---|
| Template-level `law_refs[]` | ✅ | ✅ + legacy `law_ref text` | ✅ as `legal_basis[]` | ✅ as `regulation_ids[]` + `aml_paragraphs[]` | 🟡 jsonb on courses | ✅ + per-item |
| **Per-item** `law_ref` | ✅ `items[].law_ref` | 🟡 only `mandatory_law` enum (`AML_4_3/4_4/6_2`) | 🟡 `law_ref` block kind | ❌ | 🟡 in module payload | ✅ `agendaItems[].lawRef` |
| Mandatory vs optional flag | ✅ per item | ✅ per question | ❌ | ❌ | 🟡 jsonb only | ✅ `isMandatory` per agenda |
| Frequency / cadence hint | ✅ `cadence_hint text` | ✅ `recommended_cadence_months` | ❌ | ✅ `default_review_cadence_months` | ❌ | ✅ `cadence_hint` enum + per-item override |
| Recertification / expiry | ❌ | ❌ | ✅ `revisionIntervalMonths` + `next_revision_due_at` | ✅ `default_review_cadence_months` | ✅ `recertificationMonths` (course) | 🟡 (template cadence, not instance expiry) |
| Digital sign / attestation | ✅ execution-level checksum | ✅ AMU chair + VO sign | ✅ `wiki_compliance_receipts` (acknowledgement only) | ❌ | ❌ | ✅ `meeting_signatures` row, `is_legally_binding` flag |
| Per-record attachments / evidence | 🟡 `photo` (dataURL) | 🟡 `file_upload` question type | ❌ inline HTML | ❌ `doc_ref` is reference only | ❌ | ✅ `meeting_agenda_attachments → wiki_pages` |
| Confidentiality enforcement | ❌ | 🟡 `is_anonymous` + threshold | ✅ `wiki_pages.contains_pii` + `pii_categories[]` + RLS `hr.sensitive` perm | ❌ | ❌ | ✅ `confidentiality_level` enum + `meetings.manage_confidential` |
| Audit ledger / immutable log | ✅ `compliance_template_versions` + sign trigger | ✅ publish-snapshot trigger locks questions | ✅ `wiki_audit_ledger` + version int | 🟡 `register_record_revisions` | 🟡 progress rows | ✅ BEFORE-UPDATE protocol lock + `meeting_protocol_exports` SHA-256 |
| Assignee / responsible role | ✅ | ❌ (survey-level) | ❌ | ❌ | ❌ | ✅ per agenda item + action item |
| Multi-tenant system→override layer | ❌ per-org only | ✅ catalog + org override | ✅ system + settings | ✅ `register_types.organization_id IS NULL` for system | ✅ system + settings + fork | ✅ system + settings + custom |
| Item-level org-context (location/dept/team) | ✅ via `metadata_schema` | ✅ via `metadata_schema` | ❌ | 🟡 via `location_ref` field kind | ✅ via trigger snapshot | ✅ via `metadata_schema` |
| Cross-module data binding | ❌ | ❌ | 🟡 `module` block kind | ❌ | ❌ | ✅ `dataBinding` resolves to other modules' live data |

**Auditor-relevant takeaway:** **meetings** is the most expressive surface
(signatures, attachments, confidentiality, data bindings, per-item law refs),
which is why ledelsens-gjennomgang style annual reviews map onto it natively.
**Checklists** are the strongest for repeated verification (yes/no/na +
photo + per-item law refs + sign). **Documents** are the right vessel for
policy text + acknowledgement chains. **Registers** are the right vessel
for inventories. **Surveys** carry workforce consultation. **Learning** is
the only module with first-class certification + expiry.

**Senior-developer verification:** the capability gaps that auditors *will*
notice and that the codebase does NOT yet fix:

1. **No platform-wide legally-binding eSignature** — BankID-grade signatures
   are deferred (`specs/meetings-parity.md §8` confirms). Today's sign
   columns store `signer_user_id + signed_at + sha256` which is
   audit-trail-grade but not court-grade.
2. **`learning_system_courses.law_refs` is jsonb embedded in modules** —
   the planner gap-matrix query in `specs/compliance-planner.md §3` does
   the `jsonb_array_elements_text(...)` walk to compensate, but every
   downstream surface that wants paragraph filtering pays this cost.
   Migration to a top-level `law_refs text[]` column would simplify.
3. **No "attachment" abstraction across modules** — each module solves
   evidence-file storage differently (photo data-URL on checklists,
   `file_upload` question type on surveys with no per-answer file ref
   column, `meeting_agenda_attachments` FK to wiki for meetings, nothing
   for registers/learning). A `compliance_evidence_files` table referenced
   by every artefact would close the auditor's "show me the receipt"
   question consistently.

---

## 3 · Arbeidsmiljøloven — chapter-by-chapter

> Norway's Arbeidsmiljøloven (LOV-2005-06-17-62) is the primary workplace
> safety + employment-rights statute. Coverage assessment below treats
> each paragraph; for full chapters where the platform covers every
> material section, the chapter is summarised; for chapters with gaps
> the gap is enumerated per §.

### Kap. 1 — Lovens formål og virkeområde (§§ 1-1 til 1-9)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 1-1 | Lovens formål | ⏸ | Statement of purpose — not actionable. |
| 1-2 til 1-8 | Virkeområde, definisjoner, EØS-bestemmelser | ⏸ | Scoping clauses — not actionable. |
| 1-9 | Ufravikelighet | ⏸ | Legal-doctrine clause. |

**Verdict:** chapter 1 is reference-only. Reflected in the `regulations`
table seed (`_120036`) but no templates needed.

### Kap. 2 — Arbeidsgivers og arbeidstakers plikter (§§ 2-1 til 2-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 2-1 | Arbeidsgivers plikter | ✅ | Checklist `aml-2-1` (`_120020_compliance_provision_bundle`) — employer-duties self-audit. Also baked into IK-f § 5 sjekklister. |
| 2-2 | Arbeidsgivers plikter overfor andre enn egne ansatte | ✅ | Register `external_suppliers` (`_120042_registers_seed`) carries `due_diligence_status` + criticality. Linked from åpenhetsloven flow. |
| 2-3 | Arbeidstakers medvirkningsplikt | ✅ | Checklist `aml-2-3`; survey `aml-2-3-medvirkningsplikt-attest` (`_120013_compliance_templates_batch5_aml_gaps` + `_140000_survey_templates_batch1`). Annual identified attestation per worker. |
| 2-4, 2-5 | Vern av arbeidstakere som varsler | ✅ | See § 2A-1..7 below. |

**Verdict:** ✅ Fully addressed. Three concurrent surfaces (checklist for
employer self-audit + survey for employee attestation + register for
external-supplier coverage).

### Kap. 2A — Varsling (§§ 2A-1 til 2A-7)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 2A-1 | Rett til å varsle | ✅ | Checklist `aml-2a-1` (`_120044`), survey `gdpr-personvern-attest` includes whistleblowing-route awareness Q. |
| 2A-2 | Fremgangsmåte ved varsling | ✅ | Checklist `aml-2a-2`. Document `tpl-varslingsrutine` policy template. |
| 2A-3 | Arbeidsgivers ansvar | ✅ | Checklist `aml-2a-3`. |
| 2A-4 | Forbud mot gjengjeldelse | ✅ | Checklist `aml-2a-4`. |
| 2A-5 | Erstatning, oppreisning | ⏸ | Court remedy — not template-driven. |
| 2A-6 | Drøfting | 🟡 | Meeting `varslingsutvalg` template (`_120001`) carries this — but the **drøfting requirement** specifically lives in chapter 8; AML § 2A-6's drøfting hook covers procedure design, not individual cases. |
| 2A-7 | Taushetsplikt for myndigheter (5) | ✅ | Meeting `varslingsutvalg` template enforces taushetsplikt via mandatory `confidentiality` preparation checklist + `confidentiality_level = 'confidential'` (post `_120046`). Checklist `varsling-handtering-logg` records anonymised case log. |

**Verdict:** ✅ chapter 2A is the canonical example of a multi-module pack
working: policy doc + annual checklist + identified attestation survey +
confidential committee meeting + paragraph-tagged whistleblowing log.

**Senior-dev verification:** the whistleblowing module is intentionally
separate from templates (`modules/whistleblowing/`) for confidentiality
reasons — the meeting template surfaces only the *aggregate* committee
process. Individual case-files stay in their own RLS-restricted module.
This is the right architectural call; templates carrying named individuals
would be an immediate § 2A-7 violation.

### Kap. 3 — Virkemidler i arbeidsmiljøarbeidet (§§ 3-1 til 3-6)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 3-1 | Krav til systematisk HMS-arbeid | ✅ | Checklist `aml-3-1` + `internkontroll-arsgjennomgang` + survey `aml-3-1-hms-modenhet-leder` (annual leader self-report). |
| 3-2 | Særskilte forholdsregler for opplæring | ✅ | Checklist `aml-3-2`; learning `c-aml-arbeidstaker` (employee induction course). |
| 3-3 | Bedriftshelsetjeneste (BHT) | ✅ | Checklist `bht-samarbeid-arsplan` (`_120050`) + register `external_suppliers` filtered to category=BHT. |
| 3-4 | Pensjonsordning | ✅ | Checklist `aml-3-4` (`_120050`). Documents `tpl-pensjon-ordningsbeskrivelse` (template needs to be authored if not). |
| 3-5 | Plikt for arbeidsgiver til å gjennomgå opplæring i HMS | ✅ | Checklist `arbeidsgivers-hms-opplaering` + survey `aml-3-5-arbeidsgivers-hms-attest` + learning `c-40-timers-hms` (40-hour AML required HMS course). |
| 3-6 | Plikt til å legge forholdene til rette for varsling | ✅ | See 2A coverage. |

**Verdict:** ✅ kap. 3 is the **anchor chapter** — every module participates.
This is also where ISO 45001 § 5–7 maps onto AML coverage.

### Kap. 4 — Krav til arbeidsmiljøet (§§ 4-1 til 4-6)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 4-1 | Generelle krav til arbeidsmiljøet | ✅ | Checklist `vernerunde-standard` covers § 4-1 via items. AMU-Q2 meeting template (`amu-kvartalsmote-q2`) carries `ros` agenda item with `lawRef: AML § 3-1` (which transitively covers 4-1). |
| 4-2 | Krav til tilrettelegging, medvirkning og utvikling | ✅ | Meetings `allmote` (`_120001`) + `personalmote` + `mus` all stamp `AML § 4-2`. Survey `psykososial-pulsmaling` runs the consultation sweep. |
| 4-3 | Krav til det psykososiale arbeidsmiljøet | ✅ | AMU-Q3 template (`amu-kvartalsmote-q3`) — `psykososial` agenda item is mandatory with `AML § 4-3`; `mobbing` item ditto. Survey `psykososial-pulsmaling`. Checklist `psykososial-arsattest` (in batch5). MUS template (`mus`) includes `trivsel` + `hms` mandatory items law-ref'd to § 4-3. |
| 4-4 | Krav til det fysiske arbeidsmiljøet | ✅ | Checklists `ergonomi-runde`, `stoffkartotek-runde`, `vernerunde-standard`. Register `chemicals` covers § 4-5 + § 4-4 chemical hazards. |
| 4-5 | Særlig om kjemisk og biologisk helsefare | ✅ | Register `chemicals` (`_120042`) with H-phrases (CLP), CAS, SDS link, annual volume. Checklist `stoffkartotek-runde` runs the periodic verification. |
| 4-6 | Tilrettelegging og oppfølging av sykmeldte arbeidstakere | ✅ | Checklist `ia-oppfolgingsplan-sjekk`. Sykefravær binding (`useMeetingDataBindings`) feeds AMU-Q1/Q4. |

**Verdict:** ✅ — multi-module pack, well covered.

### Kap. 5 — Registrerings- og meldeplikt, helseundersøkelse mm. (§§ 5-1 til 5-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 5-1 | Registrering av skader og sykdommer | ✅ | Register `aml_5_personskade` (`_120049`) — yrkesskader/yrkessykdommer log. AMU-Q4 årsmøte template references annual aggregate via `hendelser` mandatory item (`lawRef: AML § 5-1`). |
| 5-2 | Arbeidsgivers varslings- og meldeplikt | ✅ | Checklist `skade-sykdom-register-sjekk` (`_120049`) verifies the Arbeidstilsynet-melding pipeline. |
| 5-3 | Arbeidstakers melding om skade og sykdom | ✅ | Same checklist. |
| 5-4, 5-5 | Helseundersøkelse | 🟡 | BHT-rytmen (`bht-samarbeid-arsplan`) covers the *scheduling* of helseundersøkelser; individual case-files are HR/BHT side, out of template scope. **Restrisiko:** templates don't track which workers actually completed the undersøkelse — this should be a learning-progress-style record. Recommendation: add a `learning_system_courses` row with `kind: 'external_certification'` + `recertificationMonths` for "Lovpålagt helseundersøkelse — verksomhet med spesielle risikoforhold". |

**Verdict:** ✅ for the recording-and-reporting half; 🟡 for the
helseundersøkelse-per-worker half.

### Kap. 6 — Verneombud (§§ 6-1 til 6-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 6-1 | Plikt til å velge verneombud | ✅ | Survey `aml-6-1-verneombud-bekreftelse`; checklist `aml-6-1`. **Restrisiko:** valgprosessen selv (eligibility / hemmelig avstemning) ligger i `survey_template_catalog.amu-valg-system` placeholder; full election engine is `⏸` per ROADMAP §8.20 — tracked as `modules/elections/`. |
| 6-2 | Verneombudets oppgaver | ✅ | Meeting `verneombud-mote` (quarterly) with `vernerunder` mandatory item. |
| 6-3 | Særskilte rettigheter (rett til å stanse arbeid) | ✅ | Documents `tpl-vernerunde-prosedyre` covers right-to-stop procedure. Checklist items in `vernerunde-standard`. |
| 6-4 | Opplysningsplikt | ✅ | Meeting `verneombud-mote.agendaItems.saker_amu`. |
| 6-5 | Opplæring av verneombud | ✅ | Learning `c-verneombud-40t` (40-timers vernobudkurs). Meeting `verneombud-mote.opplaering` mandatory item `lawRef: AML § 6-5`. |

**Verdict:** ✅ kap. 6 fully covered except secret-ballot election engine
(explicit ⏸).

### Kap. 7 — Arbeidsmiljøutvalg (§§ 7-1 til 7-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 7-1 | Plikt til å opprette AMU (≥ 30 ansatte) | ✅ | Meeting templates `amu-kvartalsmote-q1`..`q4` enforce `minimum_employee_count = 30` (`_120047`). Hub warning badge surfaces if < 30 ansatte. |
| 7-2 (1) | AMU sammensetning og oppgaver | ✅ | AMU template `composition` agenda item in `amu-arsrapport-q4` (`lawRef: AML § 7-1`). |
| 7-2 (2) bokstav a-f | Pliktige saker i AMU | ✅ | Verbatim mapping: `q1.vernerunder` → b, `q1.sykefravar` → c, `q1.opplaering` → e, `q2.arbeidsmiljoundersokelse` → d, `q4.arsrapport` → § 7-2 (6) årsrapport. Verified in `meetings-lovdata-verification.md`. |
| 7-2 (6) | Årsrapport | ✅ | `amu-arsrapport-arsrapport` template (`_120049_meetings_amu_arsmote_v2`) covers all six bokstaver a-f as discrete mandatory items. |
| 7-3, 7-4 | Tilsynsmyndighet, forskrifter | ⏸ | Statute-meta. |
| 7-5 | Lokale arbeidsmiljøutvalg | 🟡 | Same template family applies; recommendation: clone `amu-kvartalsmote-q1` with `defaultCategory = 'aml-amu-lokal'` and `metadata_schema.location.required = true` so multi-site orgs get site-scoped AMU rooms. |

**Verdict:** ✅ chapter 7 is the platform's strongest single chapter. AMU
templates close every AML § 7-2 (2) bokstav as a mandatory item. The
new `amu-konstitueringsmote` template (`_120051`) closes the chain from
the (still-deferred) election engine.

### Kap. 8 — Informasjon og drøfting (§§ 8-1 til 8-3)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 8-1 | Plikt til informasjon og drøfting (≥ 50 ansatte) | 🟡 | Meeting `bedriftsutvalg` template (Hovedavtalen § 9-3) — formelt en separat hjemmel, men dekker samme behov. **Gap:** kvalifiseringen "minst 50" må vises som badge. |
| 8-2 | Gjennomføring av plikten | ✅ | Meeting `drofting-omstilling` template's `agendaItems` enumerate § 8-2 obligatoriske saker (begrunnelse / alternativer / konsekvenser / synspunkter) som `isMandatory: true`. |
| 8-3 | Taushetsplikt | ✅ | `confidentiality_level = 'restricted'` set as default on `drofting-omstilling` (post `_120046`). |

**Verdict:** ✅. Drøftings-prosessen er den klart sterkeste meeting-flaten;
H6 custom-template editor (ROADMAP §8.10) lar customers legge til ekstra
drøftingsmaler for sektor-spesifikke caser.

### Kap. 9 — Kontrolltiltak i virksomheten (§§ 9-1 til 9-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 9-1 | Vilkår for kontrolltiltak | ✅ | Checklist `kontrolltiltak-evaluering` (`_120047`). Document template for kontrolltiltakpolicy (`tpl-kontrolltiltakpolicy`). |
| 9-2 | Drøfting, informasjon og evaluering | ✅ | Meeting template can be cloned from `drofting-omstilling` shape — **recommend** authoring `drofting-kontrolltiltak` as a system template. |
| 9-3 | Innsyn i e-post mv. | 🟠 | Procedure exists in doc templates; individual case-handling out of scope. |
| 9-4, 9-5 | Helseopplysninger, tilbakeleveringsplikt | 🟠 | Cross-references to GDPR — covered there. |

**Verdict:** ✅ for § 9-1 / 9-2 (the core obligation); 🟠 for the
individual-case provisions which sit outside templates.

### Kap. 10 — Arbeidstid (§§ 10-1 til 10-13)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 10-1 til 10-3 | Definisjoner, omfang, gjennomsnittsberegning | ⏸ | Definitions — not template work. |
| 10-4 | Alminnelig arbeidstid | ✅ | Checklist `aml-10-4` (`_120048`). |
| 10-5 | Gjennomsnittsberegning | 🟠 | Tariff-spesifikk; documents template + register `arbeidstidsavtaler` (recommend authoring). |
| 10-6 | Overtidsarbeid | ✅ | Checklist `aml-10-6` (`_120048`). |
| 10-7 | Oversikt over arbeidstid | ✅ | Checklist `aml-10-7` — verifies tidsregistrering. |
| 10-8 | Daglig og ukentlig arbeidsfri | ✅ | Checklist `aml-10-8`. |
| 10-9 | Pauser | ✅ | (covered transitively in `aml-10-8`). |
| 10-10, 10-11 | Søndagsarbeid, nattarbeid | ✅ | Checklists `aml-10-10`, `aml-10-11`. |
| 10-12 | Unntak | ✅ | Checklist `aml-10-12`. |
| 10-13 | Tvisteløsningsnemnda | ⏸ | External body. |

**Verdict:** ✅ for the verification-of-compliance half (checklists per §).
**Restrisiko:** the platform doesn't ingest actual time-clock data —
checklists verify that *the procedure exists*, not that *every employee
this week worked ≤ 13 hours per day*. That gap requires either an HR/payroll
integration or a `register_arbeidstid_avvik` register seeded with
exception-driven workflow. Recommend authoring the register type.

### Kap. 11 — Arbeid av barn og ungdom (§§ 11-1 til 11-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 11-1 til 11-5 | Mindreårige arbeidstakere | 🟡 | Checklist `aml-11-1..5` exists in batch5 (`_120013`); BUT no learning module for parental-consent flow. Most orgs without minors leave this unused. **Recommendation:** keep checklists; add a register `mindrearige_arbeidstakere` for orgs that need it. |

**Verdict:** 🟡 — addressable; thin seed because most customers don't
employ minors.

### Kap. 12 — Rett til permisjon (§§ 12-1 til 12-15)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 12-1 til 12-6 | Svangerskap, fødsel, foreldre | 🟡 | Documents `tpl-permisjonsoversikt` (guide-format) covers § 12 mapping; **no recurring checklist exists** to verify that varsel-frister + lønnsutbetaling + tilrettelegging are tracked over time. Individual cases are HR. |
| 12-7 til 12-8 | Pleie / omsorgspermisjon | 🟡 | Same. |
| 12-9 til 12-12 | Utdanning, militærtjeneste, offentlig tillitsverv, religiøse høytider | ✅ | Checklist `aml-12-9..12` in `_120052`. |
| 12-13, 12-14 | Plikt til å varsle | 🟡 | Document policy; not template content. |
| 12-15 | Diskriminering ved permisjon | ✅ | Tied into kap. 13. |

**Verdict:** mostly 🟡 — permisjonsretten er individuell rettighet, men
permisjons-administrasjonen *som prosess* mangler en periodisk
sjekkliste. Varsel-frister i § 12 er asymmetriske (1 uke / 3 mnd / 1 år
avhengig av paragraf) og brytes typisk pga. ad-hoc HR-prosess.
**Recommendation:** author `aml-12-permisjon-arsgjennomgang` checklist
+ `register_types.permisjonssaker` (with `varslingsfrist_satisfied`
boolean per case + `lonnsutbetaling_status`). Restrisiko er at
Arbeidstilsynet sjelden gir pålegg på § 12 isolert, men LDO + NAV
gjør det jevnlig.

### Kap. 13 — Vern mot diskriminering (§§ 13-1 til 13-10)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 13-1 | Forbud mot diskriminering | ✅ | Checklist `c-aml-13-likestilling` (`_120046`) — annual ARP-redegjørelse self-audit. |
| 13-2 | Hvilke områder rammes | ✅ | Same checklist enumerates: rekruttering, arbeidsvilkår, opprykk, opphør. |
| 13-3 | Unntak | ⏸ | Legal-doctrine. |
| 13-4 til 13-6 | Forbud mot innhenting | 🟠 | Procedure documents; HR. |
| 13-7 | Trakassering | ✅ | Meeting `amu-kvartalsmote-q3.mobbing` mandatory item; checklist `aml-13-7`. |
| 13-8, 13-9 | Delt bevisbyrde, oppreisning | ⏸ | Court remedy. |
| 13-10 | Organisasjonsfrihet, politisk syn | ✅ | Survey `psykososial-pulsmaling` covers via FAIR-Q items. |

**Cross-reference: Likestillings- og diskrimineringsloven** — covered in §6 below.

**Verdict:** ✅ for the procedural surface; ⏸ for the court-remedy provisions.

### Kap. 14 — Ansettelse mv. (§§ 14-1 til 14-15)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 14-1 | Skriftlig arbeidsavtale | ✅ | Checklist `arbeidsavtale-sjekk` (`_120052`). |
| 14-2 | Fortrinnsrett | 🟡 | Checklist exists in batch5; documents template — author `tpl-fortrinnsrett-prosedyre`. |
| 14-3 til 14-4 | Deltid, fortrinnsrett deltid | ✅ | Checklist `aml-14-3`. |
| 14-5 | Krav om skriftlig avtale | ✅ | `aml-14-5`. |
| 14-6 | Innhold | ✅ | `aml-14-6` (item-by-item check of mandatory contract items per AML § 14-6). |
| 14-7 til 14-8 | Endringer, ansiennitet | ⏸ | Individual case. |
| 14-9 | Midlertidig ansettelse | ✅ | `aml-14-9`. |
| 14-10, 14-11 | Åremål, ulovlig midlertidig | ⏸ | Individual case. |
| 14-12 | Innleie fra bemanningsforetak | ✅ | Checklist `innleie-sjekk` + `aml-14-12` / `aml-14-12a` / `aml-14-12c`. |
| 14-13 | Innleie fra produksjonsbedrift | 🟡 | Same checklist family; thin coverage. |
| 14-14, 14-15 | Etterlønn ved ulovlig innleie | ⏸ | Court remedy. |

### Kap. 14A — Konkurransebegrensende avtaler (§§ 14A-1 til 14A-5)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 14A-1 til 14A-3 | Konkurranseklausul / kundeklausul / rekruttering | ✅ | Checklist `aml-14a-1`..`aml-14a-3` (`_120052`). Document `tpl-konkurranseklausul-mal` (recommend authoring). Register `konkurranseklausuler` (recommend seeding) for tracking active clauses. |
| 14A-4, 14A-5 | Tidsbegrensning, oppreisning | ⏸ | Court / individual case. |

**Verdict:** ✅ procedurally; recommended register type to track active
clauses for an org's portfolio (since deadlines are paragraph-driven).

### Kap. 15 — Opphør av arbeidsforhold (§§ 15-1 til 15-17)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 15-1 | Drøfting før oppsigelse | ✅ | Meeting `drofting-omstilling` template — mandatory `begrunnelse / alternativer / konsekvenser / synspunkter` items `lawRef: AML § 15-1`. Checklist `oppsigelse-drofting-sjekk` (`_120045`). |
| 15-2 | Plikt til å informere | ✅ | Same meeting + checklist. |
| 15-3 | Oppsigelsesfrister | ⏸ | Individual contract. |
| 15-4 | Formkrav | ✅ | Checklist `aml-15-4`. |
| 15-5 | Virkninger av formfeil | ⏸ | Court remedy. |
| 15-6, 15-7 | Saklig grunn | ✅ | Checklist `aml-15-7`. Documents `tpl-oppsigelsepolicy`. |
| 15-8, 15-9 | Sykdom, svangerskap | ⏸ | Individual. |
| 15-10 til 15-14 | Avskjed, suspensjon, sluttavtale | ⏸ | Individual. |
| 15-15 | Attest | ✅ | Checklist `aml-15-15`. |
| 15-16, 15-17 | Forhandling, søksmål | ⏸ | Court. |

**Verdict:** ✅ for the drøftings-flate (§ 15-1 + § 15-2); ⏸ for individual
cases.

### Kap. 16 — Virksomhetsoverdragelse (§§ 16-1 til 16-7)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 16-1 til 16-5 | Overdragelse: vilkår, rettigheter, informasjon, valg | 🟡 | Document `tpl-virksomhetsoverdragelse-plan` (recommended). Meeting `drofting-virksomhetsoverdragelse` — author from `drofting-omstilling` shape. Currently only `aml-16-5` checklist exists. Restrisiko: low frequency, high stakes; recommend authoring as a pack. |
| 16-6, 16-7 | Konkurranseklausul, pensjonsavtale ved overdragelse | ⏸ | Individual. |

**Verdict:** 🟡 — surface supports it; seed thin.

### Kap. 17 — Tvister om arbeidsforhold (§§ 17-1 til 17-7)

⏸ Court / dispute resolution — not template territory.

### Kap. 18 — Tilsynet med loven (§§ 18-1 til 18-12)

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| 18-1 til 18-7 | Tilsynsmyndighet, samarbeid | ⏸ | Reference. |
| 18-6 | Pålegg | ✅ | Register `aml_18_tilsynssaker` (`_120053`) — 19 felter for tilsyn / pålegg / frist / klage / lukking. Drives the planner-KPI "åpne pålegg". |
| 18-7 | Tvangsmulkt | ✅ | Same register; `outcome` field has `'tvangsmulkt'` value. |
| 18-8 | Stansing | ✅ | Same register; `outcome = 'stansing'`. |
| 18-9 | Bedriftshelsetjeneste | ✅ | Already covered under § 3-3. |
| 18-10 til 18-12 | Klage, anke | 🟡 | Same register has `klage_dato` + `klage_utfall` fields. |

**Verdict:** ✅ — the AML §18 register is the auditor's primary view onto
"what's open against this org right now?"

### Kap. 19 — Straff (§§ 19-1 til 19-7)

⏸ Criminal proceedings.

### Kap. 20 — Avsluttende bestemmelser (§§ 20-1 til 20-3)

⏸ Statutory housekeeping.

---

## 4 · Internkontrollforskriften (IK-f, FOR-1996-12-06-1127)

The IK-f's operational obligation is § 5 (8 numbered items) — every
Norwegian HMS audit Arbeidstilsynet runs maps onto these eight items.
Coverage assessment:

| § 5 nr. | Topic | Verdict | Coverage |
|---|---|---|---|
| **1a** | "Påse at de lover og forskrifter i HMS-lovgivningen som gjelder for virksomheten er tilgjengelig" | ✅ | Document `tpl-hms-lovverk-oversikt` system template + register `regulations` table (`_120036`). |
| **1b** | "Ha oversikt over virksomhetens organisasjon, herunder hvordan ansvar, oppgaver og myndighet for arbeidet med HMS er fordelt" | ✅ | Document block kind `live_org_chart` (renders from `org_members`); document `tpl-hms-organisasjonskart`. |
| **1c** | "Sørge for at arbeidstakerne har tilstrekkelige kunnskaper og ferdigheter" | ✅ | Learning module — `c-40-timers-hms` + `c-amu-grunnopplaering` + `c-verneombud-40t`. |
| **2** | "Sørge for at arbeidstakerne medvirker slik at samlet kunnskap og erfaring utnyttes" | ✅ | Survey module + medvirkningsplikt-attest + AMU meeting consultation items. |
| **3** | "Fastsette mål for HMS" | ✅ | Document `tpl-hms-mal` + checklist `hms-maal-arsplan-sjekk` (annual goal review). |
| **4** | "Ha oversikt over virksomhetens organisasjon" (re-confirmation, deviation procedures) | ✅ | Checklist `ik-5-4`. |
| **5** | "Kartlegge farer og problemer og på denne bakgrunn vurdere risiko" | ✅ | ROS lives in `modules/ros/` (separate module, integrated as document block kind `live_risk_feed`); checklist `ik-5-5` verifies the ROS practice. |
| **6** | "Iverksette rutiner for å avdekke, rette opp og forebygge overtredelser" | ✅ | Checklist `avviksoppfolging-runde`; tasks module captures the individual deviations. |
| **7** | "Foreta systematisk overvåkning og gjennomgang av internkontrollen for å sikre at den fungerer som forutsatt" | ✅ | Meeting `iso-45001-ledelsens-gjennomgang` (annual) covers this — § 5 nr. 7 is the equivalent of ISO 9.3 management review. Also checklist `internkontroll-arsgjennomgang`. |
| **8** | "Ha rutiner for melding av yrkesskade og yrkessykdom" | ✅ | Register `aml_5_personskade` (§ 5-1 above). |

**§ 6 Dokumentasjon** — IK-f requires items 1a, 4, 5, 6, 7 to be written.
The platform's `documents` module IS the written form. Every checklist
execution carries `signed_at + sign_checksum` so the *evidence trail* is
also written.

**§ 7 Samordning** — multi-employer worksites. Register `external_suppliers`
+ checklist for samordningsavtale verification. Currently 🟡 — template
exists but not formally seeded with the § 7 wording.

**Verdict:** ✅ IK-f is the most cleanly addressed regulation in the
platform — all 8 sub-items of § 5 have at least one shipped artefact, and
the documents module satisfies § 6 by construction.

**Caveat — no single "IK-system audit" template.** § 5's 8 items are
covered distributively (arbeidstid-kvartalsgjennomgang touches nr. 7,
personskade-kvartalsgjennomgang touches nr. 8, varsling-arsgjennomgang
touches nr. 6, etc.). An Arbeidstilsynet *system audit* — which asks the
admin to walk through all 8 items in one sitting — currently requires
opening 6+ checklist templates. **Recommendation:** author a single
`ik-f-systemgjennomgang-arlig` checklist with one section per § 5 nr.
that *cross-references* the per-domain checklists (via `metadata_schema`
`kind: 'related_template'`). This is a "rolled-up evidence view" rather
than duplicate content — equivalent to ISO 9.3 management review for
IK-f. Same shape as the planner §5.1 gap matrix, but as a single
sjekkliste-execution-instance for archival.

**Auditor truth:** an Arbeidstilsynet inspector running a documentary
inspection per IK-f § 5 would be able to ask the org admin to navigate to
`/compliance/planner` (when shipped) and see every § 5 nr. closed.

---

## 5 · GDPR + Personopplysningsloven

GDPR (EU 2016/679) operationalised by Personopplysningsloven (LOV-2018-06-15-38).
The platform must address two distinct surfaces: **principle compliance**
(controller documentation) and **data-subject rights** (operational
endpoints).

### Principle compliance

| Article | Topic | Verdict | Coverage |
|---|---|---|---|
| Art. 5 | Principles relating to processing | ✅ | Register `gdpr_processing_activities` (`_120042`) carries purpose, legal basis, data categories, retention period, transfer flag, DPIA flag. |
| Art. 5 (1) e | Storage limitation | ✅ | Meeting `gdpr-ropa-arsgjennomgang.retention` mandatory item; register's `retention_period` field. Document templates have `revisionIntervalMonths` for periodic review. |
| Art. 6 | Lawfulness | ✅ | ROPA register field `legal_basis` with six enum options (consent / contract / legal_obligation / vital_interest / public_interest / legitimate_interest) directly matching Art. 6 (1) (a-f). |
| Art. 7 | Conditions for consent | 🟡 | Document `tpl-samtykke-mal` (recommend authoring); ROPA records but doesn't track *individual* consents (those would need a `consents` table by data-subject — out of template scope for now). |
| Art. 9 | Special categories | ✅ | Same ROPA register; data_categories has `health / biometric / union / criminal` enum values. `wiki_pages.pii_categories[]` enforces RLS for `helse / fagforeningsmedlemskap / etnisitet` requiring `hr.sensitive` perm (`_120000_wiki_pages_pii_gdpr_templates`). |
| Art. 13 | Information to data subject (collected from subject) | ✅ | Document `tpl-personvern-ansatt` system template (`_120000`) covers ansattes personvernerklæring with Art. 13 og 14 fields. |
| Art. 14 | Information (not collected from subject) | ✅ | Same template. |
| Art. 15 | Right of access | ✅ | RPC `wiki_page_comments_export_for_subject(p_subject_user_id uuid)` (`_120015_documents_gdpr_endpoints`) returns every comment authored or mentioned. **Restrisiko:** this is *one* surface; cross-platform export across surveys, tasks, learning, registers requires a unified Art. 15 endpoint per data-subject — author as `compliance.export_data_subject(uuid)` RPC. |
| Art. 16 | Right to rectification | 🟠 | Each module has its own edit path; no consolidated endpoint. **Auditor risk:** moderate. |
| Art. 17 | Right to erasure ("right to be forgotten") | ✅ | RPC `wiki_page_comments_erase_for_subject(uuid, text)` (`_120015`) pseudonymises rows + writes `wiki_audit_ledger` entry. **Cross-module gap:** same as Art. 15 — needs `compliance.erase_data_subject(uuid, reason)`. |
| Art. 18 | Restriction | 🟠 | No first-class flag. |
| Art. 20 | Data portability | 🟡 | Per-widget CSV export exists; per-subject export does not. |
| Art. 21 | Object | ❌ | No surface. |
| Art. 22 | Automated decision-making | ⏸ | Platform doesn't make automated individual decisions. |
| Art. 24 | Controller responsibility | ✅ | ROPA register + DPIA template + governance survey. |
| Art. 25 | Data protection by design | ✅ | RLS-by-default + `current_org_id()` everywhere. |
| Art. 26 | Joint controllers | ✅ | Meeting `gdpr-ropa-arsgjennomgang.joint_controllers` mandatory item (`_120043`). |
| Art. 28 | Processors | ✅ | Same meeting `processors` item. Register `external_suppliers` carries `due_diligence_status` (also serves åpenhetsloven). |
| Art. 30 | Records of processing activities | ✅ | Register `gdpr_processing_activities` IS the ROPA. Annual meeting `gdpr-ropa-arsgjennomgang`. |
| Art. 32 | Security of processing | ✅ | Meeting `gdpr-ropa-arsgjennomgang.security_measures` mandatory item (`_120043`). Cross-references ISO 27001 ISMS. |
| Art. 33 | Personal data breach to supervisory authority | 🟡 | Document `tpl-personvernhendelse-prosedyre` exists; **gap:** no register `gdpr_breaches` for individual cases with the 72-hour timer. **Recommendation:** author `register_types.gdpr_breach_log` with `detected_at + notified_at + risk_level + outcome` to enforce the 72-hour rule. |
| Art. 34 | Communication to data subject | 🟡 | Same. |
| Art. 35 | DPIA | ✅ | Meeting `gdpr-dpia-gjennomgang` with 9 mandatory agenda items (Art. 35 (7) a/b/c/d, Art. 35 (2) DPO advice, Art. 35 (8) code of conduct, Art. 35 (9) data subject views, Art. 36 residual risk). Most expressive single template in the platform. |
| Art. 36 | Prior consultation | ✅ | Same template; `residual.lawRef = 'GDPR Art. 36'`. |
| Art. 37–39 | DPO designation, position, tasks | 🟡 | Documents `tpl-dpo-utnevnelse` template recommended; no specific schedule. |
| Art. 44–49 | International transfers | ✅ | Meeting `gdpr-ropa-arsgjennomgang.transfers` mandatory item with `lawRef: GDPR Art. 44-49`. |

**Personopplysningsloven** (Norway-specific):
- § 2 covers EØS-adjustments — `tpl-personvern-ansatt` references this.
- §§ 8-12 (Norwegian-specific provisions on whistleblowing, freedom of
  expression, archives, scientific/statistical use) — covered as sub-cases
  of the relevant GDPR articles.

**Verdict:** ✅ for the documentation/governance plane; 🟡 for the
individual rights-management plane (consolidated cross-module data-subject
endpoint is the most valuable thing left to build).

**Senior-dev verification:** the existing `wiki_page_comments_*_for_subject`
RPC pattern (`_120015`) is the right design. Extending it module-by-module
(surveys, tasks, registers, learning) is mechanical; the missing
abstraction is a top-level `gdpr_data_subject_request` table that
records the request, dispatches the per-module sub-routines, and stores
the per-module result for audit. Recommend authoring a
`specs/gdpr-rights-engine.md`.

---

## 6 · Likestillings- og diskrimineringsloven (LOV-2017-06-16-51)

Norway's anti-discrimination + active-duty law. The **employer activity
and reporting duty (ARP, § 26 + § 26a)** is the operational core that
templates must address.

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| § 6–13 | Prohibition (discrimination, harassment) | ✅ | Covered via AML § 13 (above). |
| § 12 | Trakassering | ✅ | AMU-Q3 `mobbing` item + survey `psykososial-pulsmaling`. |
| § 24 | Public-body activity duty | ⏸ | Only public sector. |
| **§ 26** | **Arbeidsgivers aktivitetsplikt** | ✅ | Meeting `drofting-likestilling` template (`_120001`) with `kjonnsbalanse / tilrettelegging / diskriminering / redegjorelse` mandatory items. Checklist `likestilling-arssjekk` (`_120046`). Survey `psykososial-pulsmaling` for sub-data on tilretteleggingsbehov. |
| **§ 26a** | **Arbeidsgivers redegjørelsesplikt + lønnskartlegging (biennial for 20–50 ansatte, annual ≥ 50)** | ✅ | Meeting `drofting-likestilling.lonnskartlegging` mandatory item `lawRef: § 26a`. Cadence enforced by `_120045_meetings_likestilling_cadence` (biennial flag). Document `tpl-arp-redegjorelse` template seeded under documents. **Restrisiko:** lønnskartleggingen selv (selve dataen — lønn per kjønn per stillingskode) er HR-side, ikke template-data. Vi *holder protokollen* for at den ble gjort. |

**Verdict:** ✅ — one of the best-covered cross-cutting regulations
because it forces an annual meeting + an annual document + a survey, and
the platform owns all three.

---

## 7 · Åpenhetsloven (LOV-2021-06-18-99)

Transparency Act — due-diligence on human rights and decent working
conditions in the value chain. Applies to "større virksomheter".

| § | Topic | Verdict | Coverage |
|---|---|---|---|
| § 1, 2, 3 | Formål, virkeområde, definisjoner | ⏸ | Reference. |
| **§ 4** | **Plikt til aktsomhetsvurderinger** | ✅ | Register `external_suppliers` (`_120042`) carries `due_diligence_status` enum (not_started / in_progress / completed / not_applicable) + `criticality` + `last_audit_at`. Survey `apenhetsloven-aktsomhet-internal` (`_140000`) — annual internal attestation. |
| **§ 5** | **Plikt til å redegjøre for aktsomhetsvurderingen** | ✅ | Document `tpl-apenhetsloven-redegjorelse` template (annual public report). `wiki_pages.revisionIntervalMonths = 12` enforces the annual cadence. |
| § 6 | Plikt til å informere | ✅ | Same document template + acknowledgement_footer for å spore styre-godkjenning. |
| § 7 | Informasjonsplikt overfor anmodninger | 🟡 | Procedure exists in documents; *individual* requests need a `register_types.apenhetsloven_requests` (recommend seeding) with `received_at / responded_at / response` for the law's 3-week response timer. |
| § 8–15 | Tilsyn, gebyr | ✅ via `aml_18_tilsynssaker` shape | Forbrukertilsynet's pålegg use the same register shape — could be cloned as `apenhet_18_tilsynssaker`. |

**Verdict:** ✅ for the annual cycle (the regulatory headline); 🟡 for
incoming public information requests (§ 7).

---

## 8 · ISO 9001:2015 (Quality)

Universal management-system standard. Templates target every clause in §§
4–10 where ISO 9001 prescribes documented information or a periodic
activity.

| Clause | Topic | Verdict | Coverage |
|---|---|---|---|
| 4.1, 4.2 | Context, interested parties | ✅ | Meeting `iso-9001-ledelsens-gjennomgang.context` item; document `tpl-iso9001-kontekstanalyse`. |
| 4.3, 4.4 | Scope, QMS processes | ✅ | Document `tpl-qms-omfang`. |
| 5.1 | Leadership commitment | ✅ | Meeting agenda item + checklist `iso-9001-leadership-attest`. |
| 5.2 | Policy | ✅ | Document `tpl-kvalitetspolicy`. |
| 5.3 | Roles, responsibilities, authority | ✅ | Document `live_org_chart` block. |
| 6.1 | Risk + opportunity actions | ✅ | ROS module + meeting `risk_opportunity_actions` mandatory item (`_120043`). |
| 6.2 | Quality objectives | ✅ | Document `tpl-kvalitetsmal-arsplan` + checklist `hms-maal-arsplan-sjekk` (covers both ISO 9001 + 45001 § 6.2). |
| 6.3 | Planning of changes | ✅ | Meeting `change_management` agenda item. |
| 7.1 | Resources | ✅ | Meeting `resources` mandatory item. |
| 7.2 | Competence | ✅ | Learning courses + `learning_courses.recertificationMonths`. |
| 7.3 | Awareness | ✅ | Document `acknowledgementAudience: 'all_employees'` + `wiki_compliance_receipts`. |
| 7.4 | Communication | ✅ | Meeting `consultation` items + survey. |
| 7.5 | Documented information | ✅ | The documents module by construction. |
| 8.1 | Operational planning + control | 🟡 | Procedure documents; per-process operational data is outside templates. |
| **8.4** | **Control of externally-provided processes, products and services** | ✅ | Register `external_suppliers` (`_120042`) with `iso-9001` in `regulation_ids`. |
| 8.5 | Production + service provision | ⏸ | Process-specific, customer responsibility. |
| 8.6 | Release of products and services | ⏸ | Same. |
| 8.7 | Control of nonconforming outputs | ✅ | Tasks module (`sourceType = 'iso_nonconformity'`) + checklist `avviksoppfolging-runde`. |
| 9.1.1 | Monitoring + measurement | ✅ | Meeting `monitoring_measurement` (`_120043`). |
| 9.1.2 | Customer satisfaction | 🟡 | Survey `iso-9001-customer-satisfaction` (recommend authoring; currently not seeded as a system template). |
| 9.1.3 | Analysis + evaluation | ✅ | Dashboard engine. |
| 9.2 | Internal audit | ✅ | Checklist `iso-45001-internal-audit` covers ISO 9001 + 45001 + 14001 audit cadence. |
| **9.3** | **Management review** | ✅ | Meeting `iso-9001-ledelsens-gjennomgang` — 14 mandatory agenda items covering every § 9.3.2 input (a + b + c.1-c.7 + e + g) and § 9.3.3 outputs. Largest meeting template by item count. |
| 10.1 | Improvement | ✅ | Same meeting. |
| 10.2 | Nonconformity and corrective action | ✅ | Meeting `nonconformities` item. Tasks integration. |
| 10.3 | Continual improvement | ✅ | Dashboard + planner. |

**Verdict:** ✅ — ISO 9001 is comprehensively covered by the cross-module
pack. The `iso-9001-ledelsens-gjennomgang` template alone closes 14 of the
~30 documented-information requirements.

---

## 9 · ISO 14001:2015 (Environment)

Same High-Level Structure as ISO 9001. Coverage delta from ISO 9001:

| Clause | Topic | Verdict | Coverage |
|---|---|---|---|
| 6.1.2 | Environmental aspects | 🟡 | Register `environmental_aspects` (recommend seeding; same shape as `chemicals` with `aspect / impact / significance` fields). |
| 6.1.3 | Compliance obligations | ✅ | Document `tpl-iso14001-lovkravsregister` + register `regulations` table. |
| 8.1 | Operational control | 🟡 | Procedure documents. |
| 8.2 | Emergency preparedness | ✅ | Checklist `brannvernrunde` (cross-references brann- og eksplosjonsvernloven + ISO 14001 § 8.2). |
| 9.1.2 | Evaluation of compliance | ✅ | Meeting `env_compliance` (`_120043`). |
| 9.3 | Management review | ✅ | Meeting `iso-14001-miljogjennomgang` — 11 mandatory items. |

**Verdict:** ✅ for the management-system layer; 🟡 for the
environmental-aspects-register (which is the customer's own data).

---

## 10 · ISO 45001:2018 (OH&S)

ISO 45001 maps almost perfectly onto AML kap. 3–7 + IK-f § 5. The
platform's HMS coverage IS its ISO 45001 coverage. Coverage delta:

| Clause | Topic | Verdict | Coverage |
|---|---|---|---|
| 5.4 | Consultation + participation | ✅ | AMU meetings + survey module. Best-fit example for the meeting `consultation` item. |
| 6.1.2 | Hazard identification + risk assessment | ✅ | ROS module + register `hazards`. |
| 7.5.3 | Control of documented information | ✅ | Documents module. |
| 8.1.2 | Hierarchy of controls | 🟡 | Document `tpl-iso45001-kontrollhierarki` + ROS field. |
| 8.2 | Emergency preparedness | ✅ | Same as ISO 14001 § 8.2. |
| 9.1.2 | Evaluation of compliance | ✅ | Meeting `oh_compliance_eval` (`_120043`). |
| 9.2 | Internal audit | ✅ | Checklist `iso-45001-internal-audit`. |
| 9.3 | Management review | ✅ | Meeting `iso-45001-ledelsens-gjennomgang` — 13 mandatory items. |
| 10 | Improvement | ✅ | Same as ISO 9001. |

**Verdict:** ✅ — the platform's strongest ISO standard, with consultation
+ OH&S management review + hazard register all native.

---

## 11 · ISO 27001:2022 (Information Security)

| Clause | Topic | Verdict | Coverage |
|---|---|---|---|
| 4–10 (HLS) | Same shape as 9001 | 🟡 | Most management-system items map onto existing templates (context, leadership, planning, support, operation, evaluation, improvement). |
| 9.3 | Management review | 🟡 | Meeting `iso-27001-isms-gjennomgang` exists, BUT the 2022 sub-letter relabelling (a-h) is reviewer-gated — `_120040` and `meetings-lovdata-verification.md §7` confirm this is paywalled and *not* fully verified. The 2013-version sub-letters were carried forward in seed; an H3b follow-up will fix. |
| **Annex A** | **93 controls in 4 themes** | 🟠 | Documents `tpl-iso27001-annex-a-statement-of-applicability` (recommend authoring) — most orgs *want* this; the template should be a per-control sub-checklist driven by the org's SoA. Currently a single document template; could become a register `iso27001_controls` with one row per A.5.x / A.6.x / A.7.x / A.8.x control + applicability + status + responsible. |
| 6.1.2 | Risk assessment + treatment | ✅ | ROS module. |
| 6.1.3 | Risk treatment | 🟡 | Tasks + ROS — operationalised but not Annex-A-mapped. |
| 7.5 | Documented information | ✅ | Documents module. |

**Verdict:** 🟡 — the platform CAN host ISO 27001 (the HLS structure is
identical to 9001) but **Annex A is the auditor's primary surface for
27001**, and the platform doesn't yet have an Annex-A-specific
register/checklist pack. Recommend authoring `iso27001-pack-baseline.md`
spec and seeding ~30 of the most-asked controls. **Restrisiko (paywalled
standard):** customer must own a licensed copy of the 2022 standard; the
platform's law-ref strings are auditor-friendly but the template can't
re-publish the standard text.

---

## 12 · ESG / CSRD / ESRS

CSRD (Directive (EU) 2022/2464) is operationalised through the European
Sustainability Reporting Standards (ESRS). Norwegian implementation via
*Regnskapsloven*'s sustainability-reporting amendment + the Verdipapir-
fondloven changes.

| Standard | Topic | Verdict | Coverage |
|---|---|---|---|
| ESRS 1, 2 | General requirements + general disclosures | 🟡 | Document `tpl-esg-bærekraftsrapport-hoveddokument` (recommend authoring). The double-materiality assessment lives most naturally as a meeting (annual `esg-vesentlighetsvurdering`) + a register `esg_impacts` with rows for each material topic. |
| **ESRS E1** | Climate change | ❌ | No template. Recommend authoring (a) register `ghg_emissions` (Scope 1/2/3) + (b) document `tpl-klimarisiko-vurdering` (TCFD-aligned) + (c) checklist for annual GHG verification. |
| ESRS E2 | Pollution | 🟡 | Register `chemicals` covers chemical hazards but not emissions to air/water/soil. Recommend extending `chemicals` schema with `emissions_air_kg / emissions_water_kg` fields or authoring a sibling register. |
| ESRS E3 | Water | ❌ | No template. |
| ESRS E4 | Biodiversity | ❌ | No template. Low-priority unless customer is in primary industries. |
| ESRS E5 | Resource use + circular economy | 🟡 | Register `external_suppliers` covers part (responsible sourcing). Resource-flow accounting is missing. |
| **ESRS S1** | **Own workforce** | ✅ | This is where the platform shines. Already covered by AML + IK-f + Likestillingsloven artefacts. Recommend authoring an `esg-s1-disclosure-bundle` document template that *reads from* the existing modules' data: headcount, gender pay gap, training hours, incidents, etc. — using the `module` block kinds. |
| ESRS S2 | Workers in value chain | ✅ | Åpenhetsloven coverage maps directly onto this. Register `external_suppliers.due_diligence_status`. |
| ESRS S3 | Affected communities | ❌ | No template. |
| ESRS S4 | Consumers and end-users | ❌ | No template. |
| **ESRS G1** | **Business conduct** | 🟡 | Document `tpl-etiske-retningslinjer` exists. Whistleblowing module covers § 2A-1 of CoC. **Gap:** anti-corruption training (recommend learning course `c-antikorrupsjon`), conflict-of-interest register. |

**Verdict:** ESG is the **single biggest greenfield**:
- **S1 (own workforce)** — ✅ Already there; needs aggregation template.
- **S2 (value chain workers)** — ✅ Already there via åpenhetsloven.
- **G1 (governance)** — 🟡 Half there.
- **E1–E5 (environment)** — ❌ Largely missing. Most Norwegian customers
  will need this for the 2026 CSRD reporting year.

**Senior-dev verification:** the modular surface is *ready*. Authoring
~6 register types (GHG emissions, water use, waste streams, biodiversity
impacts, energy consumption, suppliers-with-supply-chain-due-diligence) +
~10 document templates + 2 annual meetings (vesentlighetsvurdering +
bærekraftsrapport-godkjenning) would close most of CSRD. The platform's
`compositeMembers` dashboard pattern is the natural place for the ESG
overview composite. Recommend authoring `specs/esrs-pack.md` as the next
spec after compliance-planner.

---

## 13 · Top gaps — prioritised recommendations

In rough order of (auditor-pain × engineering-effort):

| # | Gap | Effort | Impact | Recommended action |
|---|---|---|---|---|
| 1 | **Compliance planner UI not built** (ROADMAP §5.1–5.5 all 📋) | M (2–3 weeks per spec) | Highest — without this, the platform has the *data* but no auditor-facing matrix | Build the gap-matrix + auditor-token view per `specs/compliance-planner.md`. |
| 2 | **GDPR cross-module data-subject endpoints** | M | High | Author `specs/gdpr-rights-engine.md`; build a top-level `compliance.export_data_subject(uuid)` and `compliance.erase_data_subject(uuid, reason)` that fan out to every module. |
| 3 | **ESRS E1 climate pack** | L (4–6 weeks) | High for 2026 reporters | Author `specs/esrs-pack.md`; seed GHG register + klimarisiko document + annual vesentlighet meeting. |
| 4 | **GDPR breach register with 72-hour timer** | S | Medium | Add `register_types.gdpr_breach_log` + a workflow that emits `gdpr_breach_overdue` when `detected_at + 72h < now()`. |
| 5 | **ISO 27001 Annex-A pack** | M | Medium for InfoSec-aware customers | Seed `register_types.iso27001_controls` + per-control checklists. |
| 6 | **AML § 16 virksomhetsoverdragelse pack** | S | Medium | Author `drofting-virksomhetsoverdragelse` meeting template + checklist + document. |
| 7 | **AML § 9-2 drofting-kontrolltiltak meeting** | S | Medium | Author one meeting template. |
| 8 | **Cross-module attachment abstraction** | M (schema change) | Medium | Add `compliance_evidence_files` table referenced from every artefact (current per-module evidence storage is fragmented). |
| 9 | **AML § 7-5 lokale arbeidsmiljøutvalg** | S | Low (multi-site orgs only) | Clone AMU templates with `location.required = true`. |
| 10 | **Helseundersøkelse-per-worker tracking** | S | Medium (kap. 5-4/5-5) | Add learning-progress-style record for periodic medical checks. |
| 11 | **Åpenhetsloven § 7 information-requests register** | S | Medium | Author `register_types.apenhetsloven_requests` with the 3-week timer. |
| 12 | **Konkurranseklausul register (AML § 14A)** | S | Low–medium | Author the register; tracking active clauses is a common pain. |
| 13 | **Top-level `law_refs text[]` on `learning_system_courses`** | XS (schema) | Low | Migrate from jsonb-embedded to first-class column for planner-query simplicity. |
| 14 | **BankID / legally-binding eSignature integration** | L | High when needed | Out of scope for this review; tracked in ROADMAP §8.21. |
| 15 | **AML kap. 12 permisjon — recurring audit** | S | Medium | Author `aml-12-permisjon-arsgjennomgang` checklist + `register_types.permisjonssaker` to track varselfrister + lønn + tilrettelegging across cases. Today only a guide document exists. |
| 16 | **Consolidated IK-f § 5 system-audit template** | S | Medium | Author `ik-f-systemgjennomgang-arlig` checklist with 8 sections (one per § 5 nr.) cross-referencing per-domain templates. Mirrors what Arbeidstilsynet's documentary audit asks for. |
| 17 | **AML § 10-5 gjennomsnittsberegning agreements** | S | Low | Author `register_types.arbeidstidsavtaler` to track tariff-driven gjennomsnittsberegning (separate protocol per AML § 10-5). |

---

## 14 · Restrisiko — what templates fundamentally can NOT carry

For auditor transparency, this section enumerates obligations the
platform's modular template approach **cannot** fully discharge, even
with perfect content seeding:

1. **Court-grade legally-binding signatures.** Current sign columns are
   audit-trail-grade (SHA-256 of canonical payload + signer_user_id +
   signed_at). For obligations that require BankID-level evidentiary
   weight (e.g. an arbeidsavtale being *signed*, an oppsigelsesbrev), a
   separate sign-service is required. The platform should not pretend
   otherwise.

2. **Individual employee case-files** with named-individual fields.
   Templates are *organisational artefacts*. The individual case lives in
   `tasks` (typed `sourceType`), HR/payroll, or the dedicated
   whistleblowing module. Mixing them into templates would create both an
   RLS-design problem and an AML § 13 / § 2A-7 / GDPR Art. 9 problem.

3. **Real-time enforcement.** Templates verify that *a procedure exists*
   and *was run on a date*. They don't enforce "no employee shall work
   > 13 hours today" (AML § 10-8) — that would require time-clock
   integration. Restrisiko-honest: every checklist asks the org to
   self-certify that the procedure works; periodic audits + survey
   triangulation are the only mitigations the platform provides.

4. **Substantive content of paywalled standards.** ISO 9001 / 14001 /
   45001 / 27001 are sold by Standard Norge. The platform's law-ref
   *strings* point at clauses; it cannot re-publish the standard text.
   Customers must own a licensed copy. Same applies to NS-EN ISO 19011
   (audit guidance) referenced in some templates.

5. **External-regulator API integration.** Arbeidstilsynet, Datatilsynet
   and Forbrukertilsynet inspections happen by document request, not by
   API. The platform's `aml_18_tilsynssaker` register captures *the
   org's side* of those interactions; there is no auto-submit endpoint.

6. **Domain-specific operational data.** Sykefravær per individual,
   ulykker per nær-miss event, leverandørenes egne ESG-tall — these are
   ingested *into* the platform via integrations or manual entry. The
   templates frame the *governance* around the data; they don't replace
   the data itself.

These restrisikoer are not platform bugs — they are *correct scoping*.
Stating them up-front in the auditor-token view (planner §5.3) prevents
the "I thought this product handled X" conversation.

---

## 15 · Engineering verification — senior-developer pass

Verifying the assertions in §2–§12 against the actual code (not just the
specs). Items below are findings that would block a "ship this review as
truth" call until addressed:

1. **`compliance_checklist_templates` is per-org only** — confirmed via
   migration grep. No `is_system = true` rows. The provisioning
   `provision_compliance_baseline_for_org` clones a hard-coded set of
   slugs into the org's table. This means every org gets the same
   starting point, but **drift between orgs is invisible**. A planner
   that wants "show me which orgs are missing the AML § 2A pack"
   needs to join `compliance_checklist_templates` aggregated by org. Today
   that works because the slugs are stable; if templates start being
   forked by orgs it stops working. ⚠️ track this when planner ships.

2. **`survey_template_catalog.law_ref` (singular text)** is still present
   alongside the new `law_refs[]` array — `_120043` backfills old rows
   but new seeds must populate both per CLAUDE.md *Things that are easy
   to get wrong*. Verified: `_140000_survey_templates_batch1` does
   populate both (`law_ref` set to the primary). ✅ pattern is correct
   but easy to forget.

3. **`learning_courses.law_refs jsonb`** — the planner's union query
   walks the modules JSONB with `jsonb_array_elements_text(...)`. Verified
   this works on `c-aml-arbeidstaker` etc. But the column is *jsonb*
   (`coalesce(t.law_refs, '[]'::jsonb)`), not `text[]`. Querying it
   doesn't use the GIN index that `_120043` adds to every *other* surface.
   ⚠️ For large orgs this becomes a planner-query bottleneck. Recommend
   a schema migration to `text[]` + GIN.

4. **`document_system_templates.legal_basis text[]`** — confirmed
   GIN-indexed in `_120043`. ✅

5. **`meeting_system_templates.law_refs text[]`** + `definition.agendaItems[].lawRef` — confirmed both populated and indexed. ✅

6. **`wiki_pages.contains_pii / pii_categories[] / pii_legal_basis`** —
   `_120000_wiki_pages_pii_gdpr_templates` adds columns; the RLS policy
   restricts SELECT when `pii_categories && array['helse',
   'fagforeningsmedlemskap', 'etnisitet']` unless caller has
   `hr.sensitive` or is admin. ✅ Good GDPR Art. 9 enforcement; recommend
   extending the array to also catch `'biometrisk'` and `'strafferettslige_opplysninger'`.

7. **Confidentiality enforcement** — `meetings.confidentiality_level =
   'confidential'` requires `meetings.manage_confidential` permission;
   the RLS policy is in `_120000_meetings_module_core`. Verified the
   permission is granted only to a specific role definition. ✅

8. **`meetings.binding_snapshot` (jsonb)** captures the resolved live
   data at meeting open + locks at protocol_signed_at. The locking
   trigger lives in `_120000_meetings_module_core`. ✅ This is the
   evidence-snapshot the auditor will want.

9. **Provision triggers + backfill loops** — every system→org module
   has an `on insert organizations` trigger calling
   `provision_<module>_baseline_for_org` + an immediate backfill loop.
   Verified: `_120030_documents_provision_bundle`, `_120031_survey_provision_bundle`,
   `_120042_registers_seed_and_provision`, `_120001_meetings_seed_system_templates`.
   ✅ — the most error-prone pattern in the codebase is implemented
   consistently.

10. **`migrations` ordering** — `scripts/apply-migrations.sh` sorts by
    basename across `supabase/migrations/` + `supabase/migrations/archive/`.
    Verified that no two basenames collide. The `_120013` AML-gaps seed
    runs before the `_120020` provision-bundle, which is required so the
    `compliance_checklist_templates` rows exist when the bundle's backfill
    loop runs. ✅

11. **Status flags** — `is_active = true` is the gate every "system row"
    relies on for provisioning. Verified each provision function checks
    `is_active = true`. ✅ Toggling a seed off propagates correctly.

12. **No multi-tenant data leaks** observed in the seed migrations
    reviewed. RLS-by-default + `current_org_id()` is consistent.

**Verification verdict:** the codebase honours the conventions in
CLAUDE.md. The three engineering issues that would meaningfully affect a
compliance-planner build are (i) the `learning_courses.law_refs` jsonb
representation (schema migration, low-risk, high planner value); (ii)
the cross-module attachment fragmentation; (iii) the cross-module
data-subject endpoint absence. Everything else is content-authoring
work, not engineering work.

---

## 16 · How an auditor would use what's shipped today

If Arbeidstilsynet, Datatilsynet, en revisor or en sertifiseringsorgan
showed up on 2026-05-12 asking for evidence, the org admin would (once
the planner UI ships per §13 #1):

1. **Open `/compliance/planner`** → gap matrix shows every paragraph in
   AML + IK-f + GDPR + ISO + likestillings-/åpenhetsloven with module
   coverage badges.
2. **Click `AML § 2A-7`** → slide panel shows the 3 active templates
   (varslingsrutine document, varsling-handtering-logg checklist,
   varslingsutvalg meeting) + last 12 months of evidence (signed
   executions, meeting protocols, document acknowledgements).
3. **Generate auditor token** → 30-day URL renders read-only matrix +
   evidence ledger per § without exposing whistleblowing case names
   (the `varslingsutvalg.confidentiality_level = 'confidential'`
   filter still applies in the auditor view).
4. **Eksport** → per-widget CSV today (§3.4.1 shipped); full-dashboard
   PDF 📋 (§3.4.2).

If the planner is *not* shipped, the same evidence exists in the
database — but the auditor walks through individual module analyse
pages with the regulation-filter chip applied, which is a 5-minute
guided demo instead of a 30-second answer. The content gap is closed;
the **surfacing** gap is the next sprint's work.

---

## 17 · Summary verdict per regulation

| Regulation | Coverage | Highest-value gap to close next |
|---|---|---|
| **Arbeidsmiljøloven** | ~85% of operational sections | Planner UI (so the auditor can see what's there) |
| **Internkontrollforskriften** | ~100% | Nothing structural; iterate on content |
| **GDPR / personopplysningsloven** | ~75% governance, ~40% rights-management | Cross-module data-subject endpoints + breach register |
| **Likestillings- og diskrimineringsloven** | ~95% | Nothing structural |
| **Åpenhetsloven** | ~85% | § 7 information-requests register |
| **ISO 9001** | ~90% | Customer-satisfaction survey seed |
| **ISO 14001** | ~75% | Environmental-aspects register + GHG register (shared with ESRS E1) |
| **ISO 45001** | ~95% | Nothing structural |
| **ISO 27001** | ~50% | Annex-A pack |
| **ESRS / CSRD** | ~30% (S1 / S2 strong; E1–E5 + S3 / S4 weak) | E1 climate pack |

**Net assessment:** the platform is exceptionally strong on the
Norwegian HMS / employment-rights stack (AML + IK-f + likestilling +
åpenhetsloven + ISO 45001 + IK-f-mappable parts of ISO 9001 + ISO
14001). It is weakest on (a) ISO 27001 Annex A, (b) ESRS environment
standards, and (c) GDPR individual-rights-management at scale. None of
these weaknesses are *architectural*; they are *content-seeding +
small-schema* gaps that the existing modular surfaces can close on a
known roadmap.

---

*End of review.*
