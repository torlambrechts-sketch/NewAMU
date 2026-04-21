# Module Layout Evaluation — Inspeksjonsrunder vs ROS

> **Mål:** Etabler én felles layout- og typografi-standard for HMS-moduler. ROS er satt som
> «gullstandard» — Inspeksjonsrunder og framtidige moduler skal følge samme mønster.
> Resultatet er færre, men bedre UI-byggeklosser, redigert ett sted og gjenbrukt overalt.

Denne evalueringen beskriver **hva som er forskjellig i dag**, **hva som skal være felles**, og
leverer et konkret sett nye/utvidede UI-komponenter sammen med refaktorering av begge modulene.

---

## 1. Oppsummering

| Aspekt | ROS (masterpiece) | Inspeksjonsrunder (før) | Avgjørelse |
|---|---|---|---|
| Sideramme (`min-h-screen` + `max-w-[1400px]`) | I komponenten selv (`RosAnalysisPage`) | På page-wrapper (`InspectionModulePage`) | **Felles `<ModulePageShell>` brukes i begge** |
| Tabs i header | `<WorkplacePageHeading1 menu={<Tabs/>}>` | Samme på detail, men list bruker ingen tabs | **Behold mønsteret — dokumenter** |
| KPI-rad | `<LayoutScoreStatRow>` | `<LayoutScoreStatRow>` | OK — felles |
| Tabell-shell | `<LayoutTable1PostingsShell>` | `<LayoutTable1PostingsShell>` | OK — felles |
| Tabell-celler | `LAYOUT_TABLE1_POSTINGS_TH` + inline `px-5 py-3` | Lokal `TH = ... bg-neutral-50` | **Konsolider til én `TH` konstant — `bg-neutral-50`** |
| Skjemarad | `WPSTD_FORM_ROW_GRID` + UI-komponenter | Dels UI-komponenter, dels rå `<input>`/`<select>` | **Kun UI-komponenter — ingen unntak** |
| Signaturkort | Felles tekst/struktur, duplisert mellom `RosSignaturesTab` og inspection `SignaturesTab` | Samme — duplisert | **Ny `<ModuleSignatureCard>` + `<ModulePreflightChecklist>`** |
| Risiko-streng (border-l-4) | Ikke brukt i ROS-listen — brukt i inspection-findings | Brukt | **Behold — dokumentert i DESIGN_SYSTEM.md** |
| Page shell duplisering | Gjentatt `<div class="min-h-screen bg-[#F9F7F2]"><header>…</header><div class="mx-auto max-w-[1400px] …">` | Gjentatt (både list og detail) | **Ny `<ModulePageShell>` — én kilde** |
| Detaljkort-ramme | `WORKPLACE_MODULE_CARD` + inline `overflow-hidden` + inline `WORKPLACE_MODULE_CARD_SHADOW` | Samme | **Ny `<ModuleSectionCard>` — én linje, ingen duplisert shadow-style** |

**Hva gjør ROS riktig i dag (og som nå blir normen for alle):**

1. **Header-mønsteret**: `breadcrumb → serif H1 → description → headerActions → Tabs` via
   `WorkplacePageHeading1` med `menu={<Tabs/>}`. Én kilde, én typografi.
2. **Card-komposisjon**: `WORKPLACE_MODULE_CARD` hvitt kort rundt hver fane, `ComplianceBanner`
   som topp-bleed i kortet når det gjelder lovpålagt dokumentasjon.
3. **Skjema**: `WPSTD_FORM_ROW_GRID` + `WPSTD_FORM_FIELD_LABEL` + `StandardInput`/`StandardTextarea`/`SearchableSelect` — **ingen rå HTML-kontroller**.
4. **KPI**: `LayoutScoreStatRow` øverst på fane/side når det gir et øyeblikksbilde.

**Hovedproblemer i Inspeksjonsrunder (før denne PR):**

- `InspectionRoundPage` dupliserer hele page-shell-blokken med `min-h-screen bg-[#F9F7F2]`, egen
  `<header>` og `max-w-[1400px]`-container. Samme gjelder `RosAnalysisPage`, `VernerundeDetailView`,
  `ActionPlanPage` osv. Hver oppdatering må gjøres mange steder.
- **Planleggings-modalen** bruker rå `<input type="datetime-local">` og `<select>` med lange
  Tailwind-strenger (brudd på `DESIGN_SYSTEM.md` § 3). Skal erstattes av `StandardInput` +
  `SearchableSelect`.
- **TH-klasser** er lokalt duplisert i 3+ filer (`TH = 'border-b border-neutral-200 bg-neutral-50 px-5 py-3 ...'`).
- **Signaturkort** er duplisert byte-for-byte mellom ROS og Inspeksjon (manager/deputy/responsible/verneombud) —
  90+ linjer JSX × 2 moduler = 180+ linjer som må endres synkront.
- **Pre-flight-sjekkliste** (grønne sirkler med «Runden er aktiv», «Alle påkrevde punkter besvart»,
  «Sammendrag er fylt ut» / «Minst én farekilde registrert» osv.) er samme mønster i begge — også duplisert.

---

## 2. Felles design-regler (én side å lese)

### 2.1 Typografi

| Rolle | Komponent / klasse | Font |
|---|---|---|
| Side-H1 | `WorkplacePageHeading1` | Libre Baskerville (serif), `text-2xl md:text-3xl font-semibold` |
| Seksjons-H2 på hvitt kort | `LayoutTable1PostingsShell` m/ `titleTypography="sans"` | `text-lg sm:text-xl font-semibold` (sans) |
| List/hub-H2 (utenfor hvitt kort) | `LayoutTable1PostingsShell` standard | Libre Baskerville serif |
| Feltlabels | `WPSTD_FORM_FIELD_LABEL` | `text-[10px] font-bold uppercase tracking-wider` |
| Støttetekst | `WPSTD_FORM_LEAD` / `text-sm text-neutral-600` | system sans |
| Tabell-header | `LAYOUT_TABLE1_POSTINGS_HEADER_ROW` + `*_TH` | `text-[10px] font-bold uppercase tracking-wide text-neutral-500` |

**Regel:** Aldri ny font, aldri custom font-weight uten at det finnes i tabellen over.

### 2.2 Flater, kanter og skygge

- Side-bakgrunn: `bg-[#F9F7F2]` (krem).
- Hvite kort: `WORKPLACE_MODULE_CARD` = `rounded-xl border border-neutral-200/80 bg-white shadow-sm`.
- Subtile (krem-toned) panelrader: `WORKPLACE_MODULE_SUBTLE_PANEL`.
- Alvorlighets-kant på listerader: `border-l-4` + domene-farge (se § 4 i DESIGN_SYSTEM.md).

### 2.3 Sideramme (kritisk — én komponent)

Alle modulsider (list + detail + admin) skal renderes via **`<ModulePageShell>`** (ny, denne PR):

```tsx
<ModulePageShell
  breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder' }]}
  title="Inspeksjonsrunder"
  description="..."
  headerActions={<...>}
  tabs={<Tabs items={tabItems} activeId={tab} onChange={...} />}
>
  {/* Faneinnhold */}
</ModulePageShell>
```

Den innkapsler i dag spredde, identiske biter:
- `min-h-screen bg-[#F9F7F2]`
- `mx-auto max-w-[1400px] px-4 py-6 md:px-8`
- Sticky-header variant (ROS-analysesiden brukte det, inspeksjon ikke — nå standardisert)
- Loader-/«ikke funnet»-tilstander på hele siden

### 2.4 Tabeller

- Alltid via `LayoutTable1PostingsShell`.
- `titleTypography="sans"` når tabellen er inne i et hvitt kort eller modul-detaljside; serif på hub/list-oversikter.
- Cellene bruker `LAYOUT_TABLE1_POSTINGS_HEADER_ROW`/`_TH`. Ingen lokal `const TH =` lenger.

### 2.5 Signaturer og pre-flight

- Bruk **`<ModuleSignatureCard>`** per rolle (leder, verneombud, ansvarlig …).
- Bruk **`<ModulePreflightChecklist>`** for sjekklista «klar for signering».
- Lov-/forskriftshenvisning skal alltid komme via `<ComplianceBanner>` over signaturseksjonen.

### 2.6 Skjema i modaler og slide-overs

- Header/action: `<FormModal>` eller `<SlidePanel>` — aldri «eget» dialog-mønster.
- Rader: `WPSTD_FORM_ROW_GRID` (40/60 på md+).
- Kontroller: `StandardInput`, `StandardTextarea`, `SearchableSelect`, `YesNoToggle`, `Button`.
- Label: `WPSTD_FORM_FIELD_LABEL`. Hjelpetekst: `WPSTD_FORM_LEAD` eller `text-xs text-neutral-500`.

### 2.7 Badge- og status-konsistens

- Alle statuser (`draft`/`active`/`signed`/`approved`/`critical`/`high`/`medium`/`low`) går via `<Badge variant="...">`.
- Lovdomene-chips (AML/BVL/ETL/FL/PKL) er små rektangulære chips — bare i ROS-kontekst; beholdes som spesialisering.

---

## 3. Nye/utvidede UI-komponenter levert i denne PR

Alle ligger under `src/components/module/` (dedikert til modul-layout):

| Komponent | Formål | Erstatter |
|---|---|---|
| `ModulePageShell` | Side-chrome: bg, max-bredde, padding, heading/tabs, loader, not-found. | Dupliserte `<div class="min-h-screen bg-[#F9F7F2]">…</div>`-blokker i 10+ filer |
| `ModuleSectionCard` | Hvitt innholdskort (`WORKPLACE_MODULE_CARD` + skygge) med `overflow-hidden`. | 15+ forekomster av `<div class={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>` |
| `ModuleSignatureCard` | Rolle-basert signaturkort (leder/verneombud/ansvarlig). | Duplisert JSX i `InspectionRoundPage.SignaturesTab` og `RosSignaturesTab` |
| `ModulePreflightChecklist` | Sjekkliste-komponent (grønne sirkler/tomme sirkler + label). | Duplisert i samme to steder |

Resultat etter refaktorering:

- `InspectionRoundPage`: **1127 → 1049 linjer** (–78 linjer i denne PR). Flere
  spesifikke optimeringer listet i anbefalinger under kan fjerne ytterligere 150–200 linjer
  uten funksjonell endring.
- `RosSignaturesTab`: **162 → 122 linjer** (duplisert signatur-JSX fjernet).
- Nye gjenbrukbare primitiver: `ModulePageShell` (158 lo), `ModuleSectionCard` (39), `ModuleSignatureCard` (120),
  `ModulePreflightChecklist` (41) = én kilde for layout-avgjørelser på tvers av alle moduler.
- **Null** rå `<input>`/`<select>` i modul-JSX (planleggings-modalen brukte før `<input type="datetime-local">`
  og `<select>` med lange Tailwind-strenger; nå `StandardInput`/`SearchableSelect`).
- **Null** gjenværende duplisert page-chrome: `min-h-screen bg-[#F9F7F2]` + `max-w-[1400px]` lever kun inne i
  `ModulePageShell`.

---

## 4. Anbefalinger videre (ikke i denne PR)

Disse vil gi ytterligere reduksjon uten å endre funksjonalitet — spesifiser som egne PR-er:

1. **`ModuleDetailHeader` preset**: wrapper rundt `WorkplacePageHeading1` som tar `statusBadge`,
   `adminPath`, og `tabs`, slik at detail-sider bare trenger å fylle inn tittel + metadata-streng.
2. **`ModuleStatsRow` preset**: wrapper `LayoutScoreStatRow` med presis 4-kolonne layout og
   typevennlig API (`{ label, value, sub, tone }`), fordi store/små tall varierer i dag.
3. **`ModuleEntityTable` primitiv**: generisk tabell (kolonnedefinisjoner + data) over
   `LayoutTable1PostingsShell` som håndterer tom-tilstand, rad-klikk-navigering, og bredder.
4. **Konvergere planleggings-/edit-paneler** til `WorkplaceStandardFormPanel` i stedet for en
   blanding av `FormModal`/`SlidePanel` (ROS bruker `FormModal` for «Ny analyse», inspection bruker
   samme for create + `SlidePanel` for edit). Anbefaling: **`FormModal`** for alt som er
   opprett-fra-scratch, **`SlidePanel`** for edit-i-kontekst.
5. **Faneikoner normaliseres**: samme ikon-sett per fane-ID (f.eks. «Historikk» alltid
   `History`, «Signaturer» alltid `PenLine`). Implementeres som et lite ikon-map i
   `modules/shared/tabIcons.ts`.
6. **Audit-fane alltid som eget kort**: `<ModuleSectionCard><HseAuditLogViewer/></ModuleSectionCard>`
   er allerede identisk pattern — trygt å pakke inn bak en `<ModuleAuditTab recordId… tableName…/>`.

---

## 5. Oversikt før → etter (Inspeksjonsrunder)

### List-siden

**Før:**

```tsx
// InspectionModulePage (page wrapper)
<div className="min-h-screen bg-[#F9F7F2]">
  <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
    <InspectionModuleView supabase={supabase} />
  </div>
</div>

// InspectionModuleView — gjentar heading + stats + table inline
```

**Etter:**

```tsx
<ModulePageShell
  breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder' }]}
  title="Inspeksjonsrunder"
  description="Planlegg, gjennomfør og signer …"
  headerActions={<...>}
>
  <LayoutScoreStatRow items={…} />
  <LayoutTable1PostingsShell … />
</ModulePageShell>
```

### Detail-siden

Samme før/etter-mønster — `ModulePageShell` + `ModuleSectionCard`, og `SignaturesTab` bruker
`ModuleSignatureCard` + `ModulePreflightChecklist`. Se kodeendringer i PR.

---

## 6. Hva som er konsistent etter PR

1. **Én** `min-h-screen bg-[#F9F7F2]`-blokk i hele kodebasen (inne i `ModulePageShell`).
2. **Én** header-struktur (breadcrumb → serif H1 → description → actions → tabs).
3. **Én** `TH`-konstant for tabell-headere (ingen lokale varianter).
4. **Én** signaturkort-implementasjon på tvers av ROS og Inspeksjon — samme JSX, samme farger.
5. **Null** rå `<input>`/`<select>`/`<textarea>` i modul-kode.
6. **Gjenbrukbart** fundament for `sja`, `avvik`, `action_plan`, `amu` og framtidige moduler: bytt
   ut deres side-wrappere med `ModulePageShell` (oppfølgings-PR).
