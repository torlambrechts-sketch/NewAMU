# E-læring — UI-fornyelse og komponentgjenbruk

**Status:** Fase A implementert i app-kode; Fase B køet i `PHASE_B_QUEUE.md`.  
**Referanser:** `DESIGN_SYSTEM.md`, `MODULE_LAYOUT_EVALUATION.md`, `src/components/ui/*`, `src/components/module/*`, `src/components/layout/*`, `eval/compliance/*.md`, `eval/ui/*.md`

---

## 1. Nåværende avvik (verifisert i kode, mai 2026)

### 1.1 `DESIGN_SYSTEM.md` — obligatoriske UI-kontroller

| Krav | Funn |
|------|------|
| `Button`, `StandardInput`, `StandardTextarea`, `SearchableSelect`, `Badge`, `Tabs`, `InfoBox` / `WarningBox`, `YesNoToggle`, `ComplianceBanner` | **Ingen** imports fra `src/components/ui/` i `src/pages/learning/*` eller `src/components/learning/*`. |
| Rå `<button>`, `<input>`, `<textarea>`, `<select>` | **~52** treff på rå kontroller på tvers av learning-sider (grep-telling). |
| Feil i UI | `alert()` brukes flere steder (`LearningPlayer.tsx` sertifikat, `LearningSettings.tsx`, `LearningCourseBuilder.tsx`) — bryter med «render errors in WarningBox». |
| `console.warn` | `LearningPlayer.tsx` (profil / ILT) — støy og ingen bruker-synlig håndtering. |

### 1.2 Modul-layout (`ModulePageShell`, `ModuleSectionCard`)

| Krav | Funn |
|------|------|
| `ModulePageShell` | **Ikke** brukt. `LearningLayout.tsx` bruker egen `min-h-screen` + `WorkplacePageHeading1`. |
| `ModuleSectionCard` | **Ikke** brukt; mange lokale `rounded-* border bg-[#fbf9f3]` mønstre. |
| `Tabs` vs `HubMenu1Bar` | `DESIGN_SYSTEM.md` peker på `Tabs`; learning bruker `HubMenu1Bar` (samme som flere arbeidsflate-moduler — avklar én kanonisk løsning og oppdater enten kode eller design-dokument). |

### 1.3 Layout-kit (intern plattform, `platform-admin/layout`)

| Mønster | Mulig gjenbruk for e-læring |
|---------|----------------------------|
| `LayoutTable1PostingsShell` + `layoutTable1PostingsKit` | Deltakere, sertifikater, kurslister (tabell-header, rader). |
| `LayoutScoreStatRow` | Dashboard-KPI (er delvis etterlignet med egne `KpiCard`-komponenter). |
| `WorkplaceStandardListLayout` | Kursliste med søk/filter/toolbar. |
| `WorkplaceNoticePanel` / `WorkplaceEditableNoticeList` | Varsler, agenda-lignende lister dersom behov. |

### 1.4 Språk og innhold

| Krav | Funn |
|------|------|
| Norsk (Bokmål) i UI | `LearningDashboard.tsx`: overskrift «Gjentakelse (**spaced repetition**)» — **engelsk** i brukergrensesnitt. |
| `LearningLayout.tsx` | Brødsmule «**Workspace**» — engelsk (arbeidsflate bør bruke norsk etikett). |

### 1.5 Personvern og samsvar (koblet til UI)

| Kilde | UI-relevant funn |
|-------|------------------|
| `eval/compliance/03_data_privacy.md` | Avdelingsleaderboard uten k-anonymitetsgrense (f.eks. k≥5); ingen kort personvernerklæring ved første datainnsamling. |
| `eval/compliance/04_certificate_requirements.md` | Fritekst navn + `alert` ved utstedelse — svakt sporbarhets- og brukeropplevelsesmønster. |
| `LearningPlayer.tsx` | `alert(\`Certificate issued! ...\`)` — **engelsk** og ikke `WarningBox`/toast-mønster. |

---

## 2. Målbilde (etter fornyelse)

1. **Én sannhet for skall:** `LearningLayout` enten wrappes i eller refaktoreres til `ModulePageShell` (breadcrumb, tittel, beskrivelse, faner) med `ModuleSectionCard` per hovedflate der det gir mening.
2. **Én sannhet for kontroller:** Alle primære/sekundære handlinger, felt, valg og boolske valg via `src/components/ui/`.
3. **Én sannhet for lister/tabeller:** Der tabellmønster finnes, bruk `LayoutTable1PostingsShell` (+ kit) eller `ModuleRecordsTableShell` der det matcher HMS-modulene.
4. **Samsvar synlig i UI:** Toppstripe med `ComplianceBanner` eller tilsvarende for opplæringsplikt (AML / IK) der `DESIGN_SYSTEM.md` krever det; kort personvern-info (`InfoBox`) før sporing i spiller/kursliste (jf. compliance gap C08).
5. **Ingen `alert`/`confirm` for forretningsfeil:** Bytt til `WarningBox` / modal med `Button`.

---

## 3. Strukturert implementering (faser)

### Fase A — Grunnmur (lav risiko, høy avkastning) ✅

| # | Oppgave | Filer (hovedtrekk) |
|---|---------|-------------------|
| A1 | Erstatt `alert` med synlig banner eller inline feilmelding + norsk tekst | `LearningPlayer.tsx`, `LearningSettings.tsx`, `LearningCourseBuilder.tsx` |
| A2 | Fjern engelsk UI: «spaced repetition» → norsk; brødsmule Workspace → f.eks. «Arbeidsflate»; sertifikat-melding | `LearningDashboard.tsx`, `LearningLayout.tsx`, `LearningPlayer.tsx` |
| A3 | Sertifikatflyt: `StandardInput` + `Button`; suksess via `InfoBox` eller toast-mønster i appen | `LearningPlayer.tsx` |
| A4 | K-anonymitet for avdelingsliste (k≥5) + forklarende hjelpetekst | `LearningDashboard.tsx` og/eller `useLearning.ts` (der leaderboard bygges) |

**Implementert:** `issueCertificate` returnerer nå `IssueCertificateResult` (ingen `setError` ved sertifikatfeil); avdelingsliste filtreres i `useLearning.ts` (k≥5); `LearningSettings` / kursbygger bruker `WarningBox`; kursbevis-seksjon bruker `StandardInput`, `Button`, `InfoBox`/`WarningBox`; profilnavn forhåndsutfylles; ILT-feil vises i UI uten `console.warn`.

### Fase B — Komponentinntog (kø)

Se **`eval/learning/PHASE_B_QUEUE.md`** for tabell og verifiseringsgrep.

### Fase C — Layout og gjenbruk

| # | Oppgave | Filer |
|---|---------|-------|
| C1 | Innfør `ModuleSectionCard` som ytre ramme for hovedpaneler (erstatt dupliserte border/bg-klasser) | Side for side i `src/pages/learning/` |
| C2 | Vurder `ModulePageShell` for learning-routes (breadcrumb/tabs fra hook) | `LearningLayout.tsx`, `App.tsx` (rute-struktur) |
| C3 | Tabell-sider: migrer til `LayoutTable1PostingsShell` der kolonner matcher | `LearningCertifications.tsx`, `LearningParticipants.tsx`, deler av `LearningCoursesList.tsx` |
| C4 | Dashboard-KPI: vurder `LayoutScoreStatRow` i stedet for duplikat `KpiCard` | `LearningDashboard.tsx` |

### Fase D — Samsvar og pedagogikk (UI + backend der nødvendig)

| # | Oppgave | Kilde |
|---|---------|--------|
| D1 | Personvernboks første besøk (sessionStorage) | `eval/compliance/05_gaps_and_actions.md` GAP-C08 |
| D2 | `ComplianceBanner` på relevant admin-/oversiktsside | `DESIGN_SYSTEM.md` |
| D3 | Autoutfyll navn fra profil + begrens fritekst i prod | `eval/compliance/03_data_privacy.md` |
| D4 | Utskriftsvennlig kursbevis / eksport (UI-kroker) | `eval/compliance/04`, `05` |

---

## 4. Egensjekk (utført)

- [x] `DESIGN_SYSTEM.md` og `MODULE_LAYOUT_EVALUATION.md` lest (layout + ui-regler).
- [x] Alle `eval/compliance/0*.md` og `05_gaps_and_actions.md` lest.
- [x] `grep` på `components/ui` i learning: **0 treff**.
- [x] `grep` på rå `<button|<input|<textarea|<select` i learning: **telling dokumentert**.
- [x] `grep` på `alert`, `Certificate issued`, `Workspace`, `spaced repetition` i learning: **avvik bekreftet**.
- [x] `useLearning.ts`: `departmentLeaderboard` bygges uten k-filter — samsvar med compliance-gap.

---

## 5. Rollebaserte gjennomganger (separate «kjøringer»)

### 5.1 UI-designer

**Styrker:** Varme papirflater (`#fbf9f3`, `#e3ddcc`) på flere steder samsvarer med `eval/ui/01_design_system_alignment.md`. AML/IK-strip på dashboard er et godt compliance-visuelt grep. Hierarki (serif titler, små labels) er lesbart.

**Svakheter:** Inkonsistent bruk av design tokens (noe `neutral-*`, noe hex). Dupliserte KPI- og kortmønstre uten delt komponent. `HubMenu1Bar` vs dokumentert `Tabs` skaper langtidrisiko for visuell drift. Ingen felles «empty state»-komponent.

**Anbefaling:** Fase A–C over; dokumenter valgt fane-komponent (`Tabs` vs `HubMenu1Bar`) i `DESIGN_SYSTEM.md` etter beslutning.

### 5.2 Samsvar / «compliance official»

**Kobling AML/IK:** Opplæring skal være dokumentert og sporbar; UI må støtte eksport, tydelig status på sertifikat, og minimal risiko for feil identitet (navn) og for personvern (små avdelinger, leaderboard).

**Gap mot evaluering:** K-anonymitet, personvernmerknad, sletting/eksport, sertifikatfelt og varsling ved versjon — beskrevet i `eval/compliance/*`; dagens UI dekker bare delvis (f.eks. JSON-eksport i innstillinger).

**Anbefaling:** Fase A4 + D1–D4 i par med backend/RPC der gapene krever det.

### 5.3 Sluttbruker (læring)

**Reise:** Kursliste → spiller → modul → kursbevis er forståelig. Låst kurs og «ikke publisert» er tydelig norsk.

**Friction:** `alert()` ved kursbevis bryter flyt og virker utrygg. «Spaced repetition» på norsk side er forvirrende. Ingen eksplisitt forklaring på første gangs sporing av fremdrift.

**Anbefaling:** A1, A2, A3, D1.

### 5.4 Administrator (HR / kursansvarlig)

**Reise:** Kursbygger, deltakere, innstillinger — funksjonelt rikt, men mange rå kontroller og lange Tailwind-strenger øker vedlikehold og inkonsistens.

**Risko:** Import/eksport og feil via `alert` gir dårlig sporbarhet i demo vs prod.

**Anbefaling:** Fase B + C3 + eksport-forbedringer fra `eval/compliance/05` (CSV/tilsyn).

---

## 6. Suksesskriterier (akseptanse)

1. Zero `alert()` / `confirm()` i learning-modulen for forretningslogikk (kun evt. debug).
2. Minst 90 % av interaktive kontroller fra `src/components/ui/` (målt ved grep etter implementering).
3. Ingen synlig engelsk i strenger ment for sluttbruker (unntatt egennavn/produkt om bevisst).
4. Avdelingsleaderboard: kun rader med `memberCount >= 5`, med forklarende tekst.
5. `ModuleSectionCard` (eller dokumentert unntak) på alle hovedpanel-flater.

---

*Sist verifisert mot repo: branch-arbeid utført i evalueringskontekst; kjør `rg` på nytt etter implementering for å bekrefte kriteriene.*
