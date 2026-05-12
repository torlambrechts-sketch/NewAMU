# Plan for utestående endringer — fase 5 og videre

**Forfatter:** Claude (planlegger)
**Dato:** 2026-05-11
**Status:** UTKAST — venter på godkjenning
**Reviewers:** Senior utvikler + Leder (se §7 og §8)

Denne planen samler **alle utestående endringer** etter fase 1-4 og presenterer dem som et prioritert program. Ingen implementering før godkjenning.

---

## 1. Sammendrag

NewAMU sin AML/HMS-compliance-pakke er nå 88% fullt dekket. Gjenstående arbeid faller i fire klare strømmer:

| Strøm | Innhold | Estimat | Avhengigheter |
|---|---|---|---|
| **A — Eksterne integrasjoner** | BankID, MinID, Altinn, Eco-Online, NAV | 4-6 sprinter | **Eksterne avtaler** |
| **B — Lovgrunnlag-gaps** | 13 gjenstående § fra inventory | 3-4 sprinter | Ingen |
| **C — UX/UI-forbedringer** | PDF-eksport, drag-and-drop, notifikasjoner | 2-3 sprinter | Ingen |
| **D — Tekniske gaps** | Cron-oppsett, edge functions, HR-integrasjon | 2 sprinter | Avhenger av A |

**Total:** 11-15 sprinter ved seriell utførelse, 6-8 sprinter ved parallellisering med 2 team.

**Anbefalt rekkefølge (justert etter reviews):** Se §6.

---

## 2. Strøm A — Eksterne integrasjoner

### A1. BankID Merchant OIDC
**Hva:** Bytte ut `bankid-init`-skeleton med faktisk OIDC-flow + `bankid-callback`.
**Forretningsverdi:** Juridisk bindende signering av arbeidsavtaler, oppsigelser, drøftings-protokoller.
**Avhengigheter:** Merchant-avtale med Vipps BankID AS (eksternt, krever bedrifts­vedtak + signering).
**Estimat:** 1 sprint kode + 2-6 uker avtale­prosess.
**Hemmelig-håndtering:** Klient-sertifikat i Supabase Vault.
**Risiko:** Avtalen kan ta lengre tid enn forventet. Tester­miljø tilgjengelig fra Vipps, men produksjons-aktivering krever signert avtale.

### A2. MinID / ID-porten OIDC
**Hva:** Tilsvarende OIDC-flow for ID-porten.
**Forretningsverdi:** «Sterk pålogging-lite» — for kvitteringer som ikke trenger BankID-nivå.
**Avhengigheter:** Digdir-registrering (offentlig prosess, vanligvis < 4 uker).
**Estimat:** 1 sprint kode + 2-4 uker registrering.
**Note:** Lettere enn BankID — Digdir har dokumentert OIDC-flow og test-IDP.

### A3. Altinn/Maskinporten — brudd-rapportering
**Hva:** Bytte ut `datatilsynet-breach-report`-skeleton med faktisk Altinn 3-correspondence-flow.
**Forretningsverdi:** Automatisk varsling til Datatilsynet innen 72-timers-fristen — lukker GDPR Art. 33 end-to-end.
**Avhengigheter:** Maskinporten klient-registrering hos Digdir + privat nøkkel.
**Estimat:** 1.5 sprint kode + 3-4 uker registrering.
**Risiko:** Skjema 8081 (Innmelding av brudd) skal verifiseres mot Datatilsynets faktiske API-spec. Anbefaler å pre-validere med Datatilsynet før produksjons-bruk.

### A4. Eco-Online stoff-kartotek-sync
**Hva:** Ny edge function `eco-online-sync` som henter SDS-blad og kjemikalie­liste inn i NewAMU.
**Forretningsverdi:** Lukker Forskr. utf. § 1-7-gap. Spesielt verdifullt for industri/bygg/helse.
**Avhengigheter:** Eco-Online API-konto + workspace-ID.
**Estimat:** 1 sprint.
**Note:** Eco-Online tilbyr standard REST-API. Krever ny tabell `org_chemicals` + RLS.

### A5. NAV yrkesskade-melding
**Hva:** Integrasjon for å sende yrkesskade-melding direkte fra NewAMU til NAV via Altinn.
**Forretningsverdi:** Lukker AML § 5-2-gap.
**Avhengigheter:** Altinn-integrasjon (A3-overlapp) + NAV-skjema-spec.
**Estimat:** 0.5 sprint hvis A3 er ferdig.

---

## 3. Strøm B — Lovgrunnlag-gaps (13 av 13)

### Høy prioritet (compliance-risiko)

**B1. AML § 9-1 til § 9-4 kontrolltiltak (Høy)**
- 1 ny mal: `tpl-kontrolltiltak-policy` — vilkår, drøfting, samtykke, evaluering
- 1 ny mal: `tpl-epost-innsyn-prosedyre` (§ 9-3) — formkrav for arbeidsgivers tilgang til ansattes e-post
- Estimat: 0.5 sprint
- Note: Hyppigste tilsyns-pålegg i 2024-2025

**B2. AML kap. 10-5 til 10-12 arbeidstid (Høy)**
- Ny modul: `tasks/working-time-violations` som leser fra HR/timeregistrering
- Krever HR-system-integrasjon (tariff­avtaler varierer)
- Estimat: 2-3 sprinter
- **Foreslår:** Splitt i to faser
  - B2a: Stand-alone arbeidstids-policy-mal + manuell sjekk (0.5 sprint)
  - B2b: HR-integrasjon (2 sprinter, krever HR-system-valg)

### Middels prioritet

**B3. AML § 13-4 / LDL § 19 rekrutterings-opplysninger (Middels)**
- 1 ny mal: `tpl-rekrutterings-policy`
- Estimat: 0.25 sprint

**B4. LDL § 28 universell utforming (Middels)**
- 1 ny mal: `tpl-uu-vurdering`
- Compliance-sjekkliste for UU
- Estimat: 0.5 sprint

**B5. Stoff-kartotek (Forskr. utf. § 1-7) (Middels)**
- Dekket av A4 hvis Eco-Online aktiveres
- Hvis ikke: 1 ny mal `tpl-stoffkartotek-manuell` + admin-panel for å registrere kjemikalier manuelt
- Estimat: 1 sprint (manuell variant)

**B6. AML § 5-2 yrkesskade-melding (Middels)**
- 1 ny mal: `tpl-yrkesskade-melding` + tasks-modul-utvidelse for å triggere skjema-eksport
- A5 (NAV-integrasjon) automatiserer; manuell mal som mellomstasjon
- Estimat: 0.5 sprint (manuell), pluss A5

### Lav prioritet

**B7-B13.** Åremål, verneplikt-vern, barn/ungdom, virksomhets­overdragelse, brannvern-detalj:
- 6 nye maler, alle ~0.25 sprint hver
- Samlet: 1.5 sprint
- Note: Lav frekvens i typisk virksomhet. Kan ventes.

---

## 4. Strøm C — UX/UI-forbedringer

### C1. PDF-rendering for tilsyns-eksport
**Hva:** Edge function som tar audit-CSV-data og produserer pen PDF-rapport for Arbeidstilsynet.
**Verdi:** Compliance-officer-wow-faktor. CSV er teknisk korrekt, men PDF er mer mottakelig hos tilsyns­myndigheter.
**Estimat:** 1 sprint.
**Tekniske valg:** Deno-PDF-bibliotek (eks. pdf-lib) eller server-side rendering via Puppeteer i Supabase Edge.
**Anbefaling:** pdf-lib for enklere deploy.

### C2. Drag-and-drop UI for `required_for_roles`
**Hva:** Admin-side hvor man kan se alle templates (kurs, dokumenter, surveys, møter, ROS) i én matrise og toggle rolle-binding via klikk.
**Verdi:** Lukker manuell SQL-vedlikehold av rolle-krav. I dag krever det migrasjon hver gang.
**Estimat:** 1.5 sprint.
**Avhengigheter:** Ingen.

### C3. Notifikasjoner ved nye/forfalt krav
**Hva:** E-post + i-app-varsler:
- Ved tildeling av ny rolle: liste over påkomne krav
- 14 dager før forfall: påminnelse
- Ved forfall: rød alarm til både bruker og leder
- Brudd-deadline: SMS-eskalering ved < 4 timer igjen
**Verdi:** Lukker reconcile-løkken end-to-end.
**Estimat:** 1 sprint (hvis e-post-infrastruktur eksisterer, ellers 2 sprinter).
**Note:** Bygger på eksisterende `wiki_mention_notifications` / `documents-notification-digest`-mønster.

### C4. Department-scoped requirements UI
**Hva:** Eksisterende `org_functional_role_assignments.department_id` overflate i admin-UI så man kan tildele rolle for bestemt avdeling (eks: verneombud for Avd. A vs Avd. B).
**Verdi:** Konsern-håndtering. Mindre relevant for SMB.
**Estimat:** 0.5 sprint.

### C5. Auto-enroll opplæring ved rolle-tildeling
**Hva:** Når funksjonell rolle tildeles, automatisk opprette `learning_progress`-rader for `required_for_roles`-kurs slik at de viser i brukerens læringsside.
**Verdi:** Per-bruker «Mine kurs»-flyt blir komplett.
**Estimat:** 0.5 sprint.
**Note:** I dag dekker `materialize_requirements_for_assignment` instans-tabellen; trenger bare en tilleggsfunksjon for å speile inn i `learning_progress`.

---

## 5. Strøm D — Tekniske gaps

### D1. Cron-scheduling oppsett
**Hva:** Konfigurere Supabase Scheduled Functions (eller GitHub Actions cron) til å kalle:
- `role-compliance-reconcile` — daglig 02:00
- `documents-acknowledgement-reminders` — daglig 09:00 (eksisterende)
- `documents-notification-digest` — hver time
**Estimat:** 0.25 sprint.
**Avhengigheter:** Ingen.

### D2. Edge function `gdpr-breach-subject-notify` (Art. 34)
**Hva:** Varsler berørte personer ved høyrisiko-brudd.
**Avhengigheter:** E-post-/SMS-infrastruktur.
**Estimat:** 0.5 sprint.

### D3. Lønnskartlegging — HR-integrasjon
**Hva:** Mal `tpl-lonnskartlegging` finnes, men har manuell utfylling. HR-integrasjon for å auto-importere lønn pr. ansatt → kjønn → kategori.
**Verdi:** LDL § 26 a — pliktig hvert 2. år.
**Estimat:** 1 sprint hvis HR-system har API; ellers manuell upload-flyt 0.5 sprint.

### D4. Stoff-kartotek-tabell (manuell variant)
**Hva:** Hvis Eco-Online ikke aktiveres: `org_chemicals`-tabell + admin-panel for å registrere kjemikalier + SDS-vedlegg manuelt.
**Estimat:** 1 sprint.

---

## 6. Forslag til faser

### Fase 5 (2 sprinter — interne lavhengende oppgaver)
**Mål:** Lukke alle gaps som ikke krever eksterne avtaler.
1. **B1** — kontrolltiltak-maler (§ 9)
2. **B3** — rekrutterings-policy
3. **B4** — UU-vurdering
4. **B6** — yrkesskade-mal (manuell)
5. **B7-B13** — 6 lav-prioritet-maler
6. **C1** — PDF-rendering for tilsyns-eksport
7. **D1** — cron-scheduling oppsett
8. **C5** — auto-enroll opplæring
9. **B2a** — arbeidstids-policy-mal (uten HR-integrasjon)

**Total: 6 sprinter komprimert til 2 hvis en utvikler jobber dedikert. Mer realistisk 3 sprinter.**

### Fase 6 (parallell — 2 sprinter — UX-forbedringer)
**Mål:** Bedre admin-opplevelse.
1. **C2** — drag-and-drop UI for required_for_roles
2. **C3** — notifikasjoner
3. **C4** — department-scoped UI

### Fase 7 (parallell med 5-6 — 4-6 uker venting + 2 sprinter kode)
**Mål:** Eksterne integrasjoner når avtaler er klare.
1. Avtale-prosess starter: BankID Merchant, Digdir Maskinporten
2. **A2** — MinID (raskest å få aktivert)
3. **A1** — BankID
4. **A3** — Altinn/Datatilsynet
5. **A4** — Eco-Online (hvis valgt over manuell)
6. **A5** — NAV (bygger på A3)
7. **D2** — Art. 34 subject-notify
8. **D3** — lønnskartlegging HR-integrasjon
9. **B2b** — arbeidstids HR-integrasjon
10. **B5** — stoff-kartotek (hvis A4 er ferdig)

### Fase 8 (1 sprint — opprydning)
1. Konsolider documentation
2. Oppdater specs/aml-requirements-inventory.md til 100%
3. Compliance-audit av hele pakken
4. Tilsyns-simulering med ekte data

---

## 7. Senior utvikler review

### Tekniske risikoer

**1. Migration ordering blir kompleks**
Vi har bygget 6 migrasjoner i fase 1-4 (20260902120000–20260903120200). Fase 5 legger til minst 4-6 nye. Med composite indekser og GENERATED-kolonner på tvers er rekkefølgen kritisk.
**Tiltak:** Hver fase får ett samlet timestamp-prefiks (20260904, 20260905 etc.). Forward-only — ingen «fiksing av» eldre migrasjoner.

**2. Edge function-secrets-håndtering**
Vi har BankID-sertifikat, Maskinporten-nøkkel, Eco-Online-token, NAV-credentials. Krever Supabase Vault eller per-secret env-konfigurasjon. **Dokumenter et single secrets-inventar** før strøm A starter.
**Tiltak:** Lag `specs/secrets-inventory.md` som dekker hvert secret + rotasjons­regel + revocation-prosedyre.

**3. RLS-policies blir vanskelige å vedlikeholde**
Vi har nå 4-5 forskjellige RLS-mønstre: `is_org_admin`, `dpo`-rolle via `functional_role_assignments`, user_id-self, etc.
**Tiltak:** Lag en `public.user_has_role(org_id, role_slug)` helper-funksjon for å DRY opp policy-bodyene.

**4. Test-dekning er minimal**
Vi har 0% test-dekning for nye admin-paneler og edge functions.
**Tiltak:** Før fase 6, legg til vitest-test for kritiske admin-paneler (særlig GdprBreachAdminPanel — der status-overganger må fungere korrekt). Edge functions trenger integration test mot lokalt Supabase.

**5. Notifikasjons-spam-risiko**
C3 kan generere mange e-poster ved første roll-out (alle eksisterende krav blir «nye»).
**Tiltak:** Implementere notifikasjons-baseline — alt eksisterende ved deploy markeres «notification_sent_at=now()» slik at bare reelt nye krav varsler.

**6. PDF-rendering i edge function kan time-oute**
Supabase Edge har 30s timeout (gratis tier) / 150s (pro). PDF med 1000+ rader kan ta lengre tid.
**Tiltak:** Bruk pagination + manuell paging i PDF. Maks 500 rader per side. Hvis mer: dele i flere PDF-vedlegg.

**7. Department-scoping (C4) krysser RLS**
`functional_role_assignments.department_id` finnes, men RLS på `org_role_requirement_instances` ser bare på `organization_id` — ikke department.
**Tiltak:** Eksisterende design dekker ikke department-scoped lese-tilgang for vanlige ansatte. Hvis verneombud-i-Avd-A skal kunne se bare sine egne avdelings-krav, må vi utvide RLS. Anbefaler å utsette C4 til fase 7 og diskutere modell først.

### Tekniske anbefalinger

- **B7-B13** kan komprimeres til én PR siden malene har lik struktur. Mindre PR-overhead.
- **A1 + A2** bør bygges som felles `oidc-init`/`oidc-callback`-mønster med provider-felt — DRY.
- **C1 PDF-rendering** bør vurdere bruk av eksisterende widget-CSV-eksport (`widgetToCsv`) som intermediate, så bygger PDF oppå. Gjenbruk.
- **D1 cron** bør lagre siste invocations + resultater i en `cron_run_log`-tabell for sporbarhet.

### Senior-dev vurdering: GODKJENT med 4 forutsetninger
1. Lag `specs/secrets-inventory.md` før strøm A
2. Lag `user_has_role()` helper-funksjon før neste RLS-utvidelse
3. C4 (department-scoping) flyttes til fase 7 etter modell-diskusjon
4. Vitest-suite for admin-paneler innført før fase 6

---

## 8. Leder review

### Forretnings-risikoer

**1. Eksterne avtaler er bottleneck-en**
Strøm A er kritisk for GDPR Art. 33 / BankID-signering. Men *vi* kontrollerer ikke tids­linjen — Vipps BankID AS og Digdir gjør det. Hvis vi planlegger en sprint og avtalen ikke er klar, blir det fall-out.
**Anbefaling:** Start avtale-prosess IMMEDIATELY parallelt med fase 5. Avtaler tar typisk 4-8 uker. Hvis vi får dem på plass før fase 5 er ferdig, kan strøm A starte på direkten.

**2. Compliance-officer-bruksopplevelse er kritisk for adopsjon**
NewAMU's verdi for kunder ligger i bruker­opplevelsen, ikke i feature-mengden. C1 (PDF-eksport), C2 (drag-and-drop) og C3 (notifikasjoner) gir mer kundeverdi enn B7-B13 (lav-prioritet-maler).
**Anbefaling:** Re-ranger fase 5 til å starte med C1 + C3, ikke med B-malene.

**3. Test-dekning er en forretnings-risiko**
0% testing på admin-paneler er en tidsbombe. Når en regresjon treffer GDPR brudd-modulen (eks: ødelegger 72-timers-frist), står vi i en compliance-katastrofe.
**Anbefaling:** Senior dev sin testing-forutsetning er en business-blocker. Implementere FØR fase 6, ikke etter.

**4. Tilsyns-eksport bør være "showcase-ready"**
Når en kunde har Arbeidstilsynet-besøk, vil PDF-eksporten være selve produktet de demonstrer. Hvis den er stygg eller mangler punkter, mister vi salgs-momentum.
**Anbefaling:** Sett av tid til design-review av PDF-output før release. Inviter en faktisk compliance officer fra en pilot-kunde til å feedback'e den.

**5. Notifikasjons-strategi krever business-vurdering**
For mye varsling → opt-out-bølge. For lite → krav blir glemt.
**Anbefaling:** A/B-test eller pilot med 2-3 kunder før bredt rollout. Bygg opt-out per kategori, ikke alt-eller-ingenting.

**6. Lav-prioritet-malene (B7-B13) gir lite verdi for typisk kunde**
Virksomhets­overdragelse, åremål, verneplikt: kanskje 5% av kunder treffer disse årlig.
**Anbefaling:** Lever som "long-tail content" — bunt sammen og lever i én PR. Ikke ta plass i sprintplan.

**7. HR-integrasjoner (B2b, D3) krever HR-system-strategi**
Norge har 4-5 dominerende HR-systemer (Visma, Simploy, Unit4, Tripletex, Datapoint). Hver krever egen integrasjon.
**Anbefaling:** Pilot med ETT HR-system (anbefal Visma som markedsleder). Bygg som referanse­implementasjon — mønstret kan kopieres.

### Leder vurdering: BETINGET GODKJENT

**Justeringer fra leder-perspektiv:**
1. **Fase 5 re-rangering:** C1 (PDF) + C3 (notifikasjoner) FØR B-maler — mer kundeverdi
2. **Testing er ikke valgfritt:** Vitest-suite skal i fase 5 (ikke fase 6)
3. **Start avtale-prosess umiddelbart:** ikke vent på fase 6
4. **B7-B13 bundles i én PR:** ikke ta sprint-plass
5. **HR-integrasjon krever pilot-strategi:** velg ett system først (anbefaling: Visma)
6. **PDF-output må design-reviewes med ekte compliance officer:** budsjetter 2 dager

---

## 9. Sammenslått ledelses- og senior-dev plan (justert)

### Fase 5 (3 sprinter — re-rangert per leder)

**Sprint 1:**
- Sett opp **`specs/secrets-inventory.md`** (senior-dev forutsetning 1)
- Lag **`user_has_role()`** helper (senior-dev forutsetning 2)
- Start **avtale-prosess** for BankID + Maskinporten (leder anbefaling 1)
- Vitest-suite skeleton for kritiske admin-paneler (senior-dev + leder)
- **C1 — PDF-rendering** for tilsyns-eksport (leder anbefaling 2)

**Sprint 2:**
- **C3 — Notifikasjoner** (e-post + i-app)
- **D1 — Cron-scheduling oppsett**
- **C5 — Auto-enroll opplæring**
- **Vitest-utvidelse** til alle nye admin-paneler

**Sprint 3:**
- **B1 — kontrolltiltak-maler** (§ 9)
- **B3 — rekrutterings-policy**
- **B4 — UU-vurdering**
- **B6 — yrkesskade-mal**
- **B2a — arbeidstids-policy-mal**
- **B7-B13** — bundled i én PR (leder anbefaling 4)
- Design-review av tilsyns-PDF med faktisk compliance officer (leder anbefaling 7)

### Fase 6 (3 sprinter — eksternt-blokkerte)

Avhenger av avtaler. Når avtaler er klare:

**Sprint 4 (først tilgjengelig):**
- **A2 — MinID OIDC** (raskest avtale)

**Sprint 5:**
- **A1 — BankID Merchant**
- **C2 — drag-and-drop UI** (parallell, blokkert ikke av avtale)

**Sprint 6:**
- **A3 — Altinn/Datatilsynet brudd-rapportering**
- **A5 — NAV yrkesskade** (overlappende)
- **D2 — Art. 34 subject-notify**

### Fase 7 (2-3 sprinter — HR + ekstern data)

**Sprint 7-8:**
- HR-pilot-prosjekt med Visma (leder anbefaling 6)
- **B2b — arbeidstids-integrasjon**
- **D3 — lønnskartlegging-integrasjon**
- **A4 — Eco-Online sync** ELLER **D4 — manuell stoff-kartotek**
- **B5 — stoff-kartotek** (avhenger av A4/D4)

**Sprint 9 (valgfritt):**
- **C4 — department-scoped UI** (krever modell-diskusjon — senior-dev forutsetning 3)

### Fase 8 (1 sprint — opprydning og audit)

- Konsolider documentation
- Oppdater inventory til 100%
- Compliance-audit av hele pakken
- Tilsyns-simulering med pilot-kunde
- Release-noter

---

## 10. Risikoer og mitigasjoner

| Risiko | Sannsynlighet | Konsekvens | Mitigasjon |
|---|---|---|---|
| Eksterne avtaler forsinkes | Høy | Strøm A blokkert | Start prosessen NÅ, parallelt med fase 5 |
| Regresjon i GDPR brudd-modul | Middels | Compliance-katastrofe | Vitest-suite før fase 6, ikke etter |
| PDF-output er stygg | Middels | Tap av salgs-momentum | Design-review med compliance officer før release |
| Notifikasjons-spam | Middels | Opt-out-bølge | Baseline-mekanisme + pilot |
| HR-system-fragmentering | Høy | Eksplosjon av integrasjons-vedlikehold | Pilot-strategi — ett system først |
| Migration ordering kollisjoner | Lav | Deploy-feil | Forward-only + timestamp-disiplin |
| Edge function timeout | Middels | PDF-eksport feiler ved store data | Pagination i PDF-rendering |
| Department-scoping bryter RLS | Lav | Datalekkasje | Utsett C4 til etter modell-diskusjon |

---

## 11. Beslutning som trengs

Før jeg starter implementasjon trenger jeg klarsignal på:

1. **Re-rangering av fase 5** (C-først, B-bundled) — godkjenner du?
2. **Vitest-suite** før fase 6 — godkjenner du tids­bruken?
3. **Avtale-prosess** for BankID + Maskinporten — hvem starter den? (Eksternt — utenfor min kontroll)
4. **HR-pilot-system** — Visma eller annet?
5. **Department-scoping (C4)** — utsette eller diskutere modell først?
6. **Stoff-kartotek-strategi** — Eco-Online (A4) eller manuell (D4)?
7. **PDF-design-review** — hvem er compliance officer-piloten?

Når disse er besvart, kan jeg starte fase 5 sprint 1.

---

## 12. Hva jeg foreslår som umiddelbar handling

Hvis godkjent uten endringer:

**I dag (denne sesjonen):**
- Lag `specs/secrets-inventory.md`
- Lag `user_has_role()` helper-migrasjon
- Sett opp vitest-test-skjelett for `GdprBreachAdminPanel` + `GdprSubjectRequestsAdminPanel`
- Start arbeid på **C1 — PDF-rendering** edge function

**Neste sesjon:**
- Ferdigstill C1
- Start C3 (notifikasjoner)
- Sett opp D1 (cron-scheduling)

**Spørsmål:** Skal jeg starte umiddelbart med dette, eller venter du på input på de 7 beslutnings­punktene i §11?
