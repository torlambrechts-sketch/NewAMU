# Klarert Undersøkelser — Pixel-Perfect Implementation Spec

> **Source design (Claude Design bundle):** `https://api.anthropic.com/v1/design/h/x0xe95USBxtoH6HATarjUA`
> — a gzipped tar of HTML/CSS/JSX prototypes. Extract to a temp dir
> (`mkdir -p /tmp/klarert && curl -sL <url> | tar -xz -C /tmp/klarert`)
> and treat **`new-klarert/project/`** as the visual source of truth.
> Filenames referenced below are relative to that folder.
>
> **Primary files to read in order:**
> 1. `new-klarert/chats/chat1.md` — design intent / scope
> 2. `new-klarert/project/tokens.css` — every CSS variable + semantic class
> 3. `new-klarert/project/kit/KitChrome.jsx` — shell, button, tabs, badge
> 4. `new-klarert/project/kit/Shared.jsx` — ModeToggle, Initials, ProgressBar
> 5. `new-klarert/project/survey/seed.js` — data shape for templates / entries / sample
> 6. `new-klarert/project/survey/SurveyApp.jsx` — hub (Undersøkelser / Maler / Resultater)
> 7. `new-klarert/project/survey/SurveyDetail.jsx` — detail (5 tabs)
> 8. `new-klarert/project/Klarert Undersøkelser.html` — wiring of the above
>
> **Target codebase:** existing survey module surfaces
> (`src/pages/SurveyModulePage.tsx`, `src/pages/SurveyDetailPage.tsx`,
> `src/components/survey/**`). Read these top-to-bottom before touching them —
> the design replaces the *visual layer*, not the data / hooks layer.
>
> **Non-goal:** copying the prototype's local React state, seed data, or
> `window.*` globals. Match pixels, wire to real data via the existing
> `useSurvey` / `useSurveyModule` hooks.

---

## 0 · How Claude Code should use this spec

This document is split into:

- **§1–§2** — tokens + IA. Read once, keep in working memory.
- **§3–§5** — page-by-page pixel rules. Implement section-by-section.
- **§6** — reusable components. Build these *first* (§6 before §3).
- **§7** — interaction states. Verify after each section.
- **§8** — data binding. The bridge from prototype seed → real hooks.
- **§9** — acceptance gates. Don't claim done until each ✅ holds.
- **§10** — ready-to-run prompts. Copy-paste straight into Claude Code.

**Implementation order (build → ship sequence):**

```
§6 primitives  →  §4 hub shell (no data)  →  §8 wire hooks
              →  §4.4 view modes one by one  →  §4.5 Resultater tab
              →  §5 detail page (5 tabs)  →  §7 polish  →  §9 verify
```

Don't try to land the hub + detail + all 5 detail tabs in one PR. Land
**§4 hub (Table view only)** first, ship it, then iterate. Each
deliverable in §10 corresponds to one shippable PR.

---

## 1 · Design tokens

All values mirror `new-klarert/project/tokens.css`. Add any missing
ones to `src/index.css` (or the Tailwind config) — **do not** redefine
tokens that already exist there.

### 1.1 Colors (use these exact hex values)

| Token | Hex | Used for |
|---|---|---|
| `--forest` | `#1a3d32` | Primary brand. Primary button bg, ring on active rail item, KPI big numbers, ResponseRing ≥70% |
| `--forest-deep` | `#142e26` | Primary button :hover bg |
| `--forest-mid` | `#15302a` | (nav rail mid — unused on survey pages, listed for completeness) |
| `--forest-soft` | `#e7efe9` | Active-category rail bg, kind-icon halo, lov chip bg, "Anonym" chip bg, channel-active card bg |
| `--forest-line` | `#c5d3c8` | Border on `--forest-soft` chips/banners |
| `--forest-darktext` | `#14312a` | Text inside `--forest-soft` chips |
| `--bg` | `#F9F7F2` | `ModulePageShell` page background (the cream "paper") |
| `--paper` | `#fbf9f3` | Card-on-cream surface (KPI tiles, kanban column bg, response-ring backdrop) |
| `--line` | `#e3ddcc` | Warm divider against paper |
| `--ink` | `#1d1f1c` | Primary text on paper |
| `--muted` | `#6b6f68` | Secondary text on paper |
| **Status — survey** | | |
| Utkast accent | `#a3a3a3` | Kanban dot + timeline node |
| Planlagt accent | `#6366F1` | Kanban dot + timeline node (indigo-500) |
| Aktiv accent | `#2F7757` | Kanban dot, timeline node, live "ping" dot, eNPS Promotere |
| Lukket accent | `#1a3d32` | Kanban dot, timeline node (forest) |
| Arkivert accent | `#737373` | (Folds into "Lukket" bucket on kanban) |
| **eNPS donut** | | |
| Promotere | `#2F7757` | 9–10 segment |
| Passive | `#C98A2B` | 7–8 segment |
| Detraktorer | `#B3382A` | 0–6 segment |
| **Per-question 1–5 stacked bar** | | |
| 1 (worst) | `#B3382A` | red |
| 2 | `#D67849` | orange-red |
| 3 | `#C98A2B` | amber |
| 4 | `#5A9C76` | mid green |
| 5 (best) | `#1a3d32` | forest |
| **ResponseRing tone (driven by value)** | | |
| `value >= 0.70` | `#1a3d32` | forest |
| `0.40 ≤ value < 0.70` | `#c98a2b` | warn |
| `value < 0.40` | `#b3382a` | critical |
| Ring track (background) | `#E5E5E5` | neutral-200 |
| **eNPS table text** | | |
| `eNPS ≥ 30` | `text-green-700` (`#15803D`) | |
| `0 ≤ eNPS < 30` | `text-amber-700` (`#B45309`) | |
| `eNPS < 0` | `text-red-700` (`#B91C1C`) | |
| **Tailwind neutrals** (used directly, not as CSS vars) | | |
| `neutral-50` | `#fafafa` | |
| `neutral-100` | `#f5f5f5` | Table head bg, hover overlays |
| `neutral-200` | `#e5e5e5` | Default borders, ProgressBar track |
| `neutral-300` | `#d4d4d4` | Switch off-state |
| `neutral-400` | `#a3a3a3` | Disabled / dim placeholder |
| `neutral-500` | `#737373` | Secondary text |
| `neutral-600` | `#525252` | Eyebrow text |
| `neutral-700` | `#404040` | Body text on white |
| `neutral-800` | `#262626` | High-emphasis body |
| `neutral-900` | `#171717` | Headings |

**Semantic Badge triads (already in `src/components/ui/Badge.tsx` — use as-is):**

| Variant | bg / border / text |
|---|---|
| `neutral` (Utkast / Arkivert) | `#F5F5F5` / `#E5E5E5` / `#404040` |
| `info` (Planlagt) | `#DBEAFE` / `#BFDBFE` / `#1E40AF` |
| `success` (Aktiv) | `#DCFCE7` / `#BBF7D0` / `#166534` |
| `signed` (Lukket) | `#DCFCE7` / `#BBF7D0` / `#166534` (same green as `success`) |
| `warning` | `#FEF9C3` / `#FEF08A` / `#854D0E` |
| `danger` | `#FEE2E2` / `#FECACA` / `#991B1B` |

### 1.2 Typography

| Token | Family | Notes |
|---|---|---|
| `--font-sans` | `Inter, ui-sans-serif, system-ui, …` | UI body, controls, tables |
| `--font-serif` | `Libre Baskerville, Georgia, serif` | Page H1, KPI big numbers in Resultater tab, section titles in Spørsmål tab |
| `--font-prose` | `Source Serif 4, Libre Baskerville, Georgia` | (long-form prose — unused in survey) |

Scale (Tailwind class → px):

| Class | px | Used for |
|---|---|---|
| `text-[10px]` | 10 | Eyebrows (uppercase tracking-wider), tiny meta |
| `text-xs` | 12 | Body meta, table footer, dl entries |
| `text-[11px]` | 11 | List item meta, channel chip, sidebar dl |
| `text-sm` | 14 | Body, table cells, form copy |
| `text-base` | 16 | Default |
| `text-lg` | 18 | Section sub-heading |
| `text-xl` | 20 | Card title (sans variant) |
| `text-2xl` | 24 | Page H1 (mobile), KPI big number |
| `text-3xl` | 30 | Page H1 (`md+`) |

Weights used: `400 / 500 / 600 / 700`. No others.

Tracking: `tracking-tight` on H1, `tracking-wider` (0.05em) on eyebrows.

### 1.3 Spacing & radius

| Token | Value | Used for |
|---|---|---|
| `gap-5` (20px) | Hub two-col grid gap; detail tab two-col gap |
| `gap-3` (12px) | Header actions, kanban columns, kpi row internal gap |
| `gap-2` (8px) | Channel cards grid, deltakere list |
| `px-4 / md:px-8` | Page horizontal padding |
| `py-2 / py-2.5 / py-3` | Common vertical padding |
| `px-5 py-3` | Table cell padding |
| `rounded-md` | 6px — buttons, inputs, list items, kpi tiles, channel cards |
| `rounded-lg` | 8px — kind-icon haloes, kanban columns |
| `rounded-xl` | 12px — cards (`ModuleSectionCard`, status strip, sidebar boxes) |
| `rounded-full` | Avatars, count pills, dots |
| `rounded-sm` | 2px — stacked bar segments |
| `shadow` | `0 1px 2px rgba(0,0,0,0.04)` (`k-card-shadow`) — every white card |

### 1.4 Layout constants

- **Page max width:** `1400px` (`max-w-[1400px]`).
- **Hub two-column grid:** `grid-cols-[260px_minmax(0,1fr)]`, gap `20px`.
- **Detail Oversikt grid:** `grid-cols-[minmax(0,1fr)_320px]`, gap `20px`.
- **Detail Spørsmål grid:** `grid-cols-[minmax(0,1fr)_280px]`, gap `20px`.
- **Detail Resultater eNPS grid:** `grid-cols-[280px_minmax(0,1fr)]`, gap `20px`.
- **Kanban:** `grid-cols-4`, `min-h-[420px]` per column.
- **Boxes view:** `grid-cols-3`, gap `12px`, padding `16px`.
- **Tables:** `w-full min-w-[920px]` (entries / resultater), `min-w-[860px]` (maler). Wrap in `overflow-x-auto` so they never blow out of the card.
- **Card shadow class:** `k-card-shadow` = `box-shadow: 0 1px 2px rgba(0,0,0,0.04)`.

---

## 2 · Information architecture

### 2.1 Routes

| Path | Page component | Purpose |
|---|---|---|
| `/undersokelser` | `SurveyModulePage.tsx` | Hub — categories + Undersøkelser / Maler / Resultater tabs |
| `/undersokelser/:id` | `SurveyDetailPage.tsx` | Detail — Oversikt / Spørsmål / Distribusjon / Resultater / Innstillinger |
| `/undersokelser/:id/svar` | `SurveyRespondPage.tsx` (existing) | Respondent flow (out of scope for this redesign) |

Keep the existing route names. Don't introduce new top-level paths.

### 2.2 Sidebar (`AticsShell.tsx`)

Already wired — survey lives in `NavGroup` "Undersøkelser" with
fixed `Analyse` + `Innstillinger` subs and dynamic pinned templates
from `useSurveyNav`. Don't touch.

### 2.3 Breadcrumbs

- Hub: `Klarert › HR & HMS › Undersøkelser`
- Detail: `Klarert › Undersøkelser (back-link) › {entry.title (truncate >40)}`

---

## 3 · Page shells

Both pages use `<ModulePageShell breadcrumb title description headerActions>`
(existing component in the codebase — verify it matches the prototype's
signature in `kit/KitChrome.jsx:167`; extend if needed). Page bg is
`#F9F7F2`, content max-w `1400px`, horizontal padding `px-4 md:px-8`,
vertical content padding `py-6`, between-section spacing `space-y-6`.

Header title is serif (`Libre Baskerville`), 24/30px, semibold,
`tracking-tight`. Description is sans, `text-sm text-neutral-600`,
mt-2.

Header actions area uses `flex-wrap items-center gap-2 lg:justify-end`,
`shrink-0`.

---

## 4 · Hub page (`SurveyModulePage`)

### 4.1 Header actions (in order, left → right)

1. `<ModeToggle>` — see §6.4
2. `<Button variant="secondary" icon={<Lucide name="BarChart3" />}>Resultatanalyse</Button>` → routes to `/dashboards/survey`
3. `<Button variant="secondary" icon={<Lucide name="Plus" />}>Ny mal</Button>` → opens template editor
4. `<Button variant="primary" icon={<Lucide name="Send" />}>Ny undersøkelse</Button>` → opens "new survey" wizard

Description:

- **Enkel mode:** `Lag og send ut undersøkelser — medarbeider, puls, HMS og mer.`
- **Avansert mode:** `Spørreundersøkelser for arbeidsmiljø, puls og lifecycle. Anonyme der det kreves, med distribusjon, påminnelser og resultatanalyse.`

### 4.2 Two-column grid

```
grid-cols-[260px_minmax(0,1fr)] gap-5
```

#### 4.2.1 Left rail — CategoryRail

Outer: `rounded-xl border border-neutral-200/80 bg-white k-card-shadow`.

Header (inside rail card):
- `border-b border-neutral-100 px-4 py-3`
- Title: `text-xs font-bold uppercase tracking-wider text-neutral-500` → "Kategorier"

List (`<ul className="py-1.5">`):

| `id` | `label` | `icon` | `kind` |
|---|---|---|---|
| `all` | Alle | `LayoutGrid` | null |
| `medarbeider` | Medarbeiderundersøkelser | `Users` | `medarbeider` |
| `hms` | HMS & arbeidsmiljø | `Brain` | `hms` |
| `puls` | Pulsmålinger | `Activity` | `puls` |
| `lifecycle` | Onboarding / Exit | `Repeat` | `lifecycle` |
| `risk` | Risikokartlegging | `AlertTriangle` | `risk` |

Each item is a `<button>`:

- Base: `flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors`
- Inactive: `text-neutral-700 hover:bg-neutral-50` + icon `text-neutral-500` + label `font-medium`
- Active: `bg-[#e7efe9] text-neutral-900` + inline `boxShadow: 'inset 3px 0 0 #1a3d32'` (left rail) + icon `text-[#1a3d32]` + label `font-semibold`
- Count pill on the right (always shown):
  - Active: `bg-white text-[#14312a]`
  - Inactive: `bg-neutral-100 text-neutral-500`
  - Both: `rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums`

**Count source:** active tab determines whether to show templates or entries count for the category. Switching tab refreshes both.

#### 4.2.2 Status panel (advanced mode only)

Below the category card, separate `rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow`:

- Title: `text-xs font-bold uppercase tracking-wider text-neutral-500` → "Status nå"
- List (`mt-2 space-y-1.5 text-xs`):
  - "Aktive" row — live ping dot (see §6.7) + count, right-aligned `tabular-nums font-semibold`
  - "Planlagt" row — solid `bg-indigo-500` dot + count
- Divider: `mt-3 border-t border-neutral-100 pt-3`
- Snitt-svar block: eyebrow + big number (`text-base font-bold tabular-nums text-[#1a3d32]`) + `<ProgressBar value={avgResponseRate} />`

#### 4.2.3 Lovpålagt callout (advanced mode only)

Bottom of left rail: `rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900`. Inside: `flex items-start gap-2` with `ShieldAlert` icon (h-3.5, amber-700) + title `Lovpålagt: psykososialt arbeidsmiljø` + sub `Kvartalsvis kartlegging neste forfall 30.06.2026.`

(Wire to real cadence data — drop the callout entirely if no overdue lovpålagt surveys exist.)

### 4.3 Right pane

Outer card: `rounded-xl border border-neutral-200/80 bg-white k-card-shadow`.

#### 4.3.1 Toolbar row

- Container: `flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-2.5`
- Left: `<Tabs>` (see §6.3) with these items:
  - `entries` — label "Undersøkelser", icon `Send`, badge = filtered entries count
  - `maler` — label "Maler", icon `FileText`, badge = filtered templates count
  - `resultater` — label "Resultater", icon `BarChart3`, badge = entries with `responded > 0`
- Right: search input + view switcher
  - Search: `w-52 rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white`. Leading `Search` icon `h-3.5 w-3.5 text-neutral-400`, absolutely positioned `left-2 top-1/2 -translate-y-1/2`. Placeholder: `Søk i tittel, mottakere…`
  - View switcher: **hidden when `tab === 'resultater'`**. Pill row: `inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5`.
    - Buttons: `inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors`
    - Inactive: `text-neutral-500 hover:text-neutral-800`
    - Active: `bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200`
    - Items: `Tabell` (Rows3), `Bokser` (LayoutGrid), `Tidslinje` (CalendarDays), `Tavle` (Columns3)
    - Label hidden on small screens (`hidden md:inline`); icon `h-3.5 w-3.5` always visible

#### 4.3.2 Tab content

Below toolbar, no extra padding wrapper — each view manages its own padding.

### 4.4 Hub views

#### 4.4.1 Tabell (`SvTable`)

```
overflow-x-auto
table: w-full min-w-[920px] text-sm
thead: bg-neutral-50/60
th: px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600   (= MODULE_TABLE_TH)
tr (body): border-t border-neutral-100 hover:bg-neutral-50/60 transition-colors + cursor-pointer
```

Columns (in order):

| Col | Show when | Cell |
|---|---|---|
| Undersøkelse | always | Kind-icon halo (h-7 w-7 rounded-md bg-neutral-100, icon h-3.5) + title `font-medium text-neutral-900 truncate` + sub `text-[11px] text-neutral-500` (audience) |
| Status | always | `<SvStatusPill status={e.status} />` |
| Periode | always | `text-neutral-700 tabular-nums`, `{openFrom} – {openTo}` |
| Svar | always | `<ResponseRing value size=32 stroke=3 />` + `{responded}/{recipients}` + (advanced) `{reminders} påminnelser sendt` |
| Distribusjon | advanced | `flex flex-wrap gap-1` of `<ChannelBadge>` per channel |
| Anonym | advanced | Ja: `EyeOff` + `text-[11px] font-semibold text-[#1a3d32]`. Nei: `Eye` + `text-[11px] text-neutral-600` |
| Eier | advanced | `<Initials size=22 />` + name |
| `›` | always | `text-right text-neutral-300` |

Row click → opens detail.

#### 4.4.2 Bokser (`SvBoxes`)

Grid `grid-cols-3 gap-3 p-4`. Each card:

```
rounded-xl border border-neutral-200/80 bg-white p-4
hover:border-[#1a3d32]/40 hover:shadow-md
k-card-shadow + transition-all
cursor-pointer
```

Internal layout:

- **Header row** (`flex items-start gap-3`):
  - Kind-icon halo: `h-9 w-9 rounded-lg bg-[#e7efe9] text-[#1a3d32]` (icon `h-4 w-4`)
  - Title block: line-clamp-2 `text-sm font-semibold leading-tight`, sub `mt-0.5 text-[11px] text-neutral-500 truncate`
  - Anonym chip (only if `anonymous`): `rounded-full bg-[#e7efe9] p-1 text-[#1a3d32]` + `EyeOff h-3 w-3`

- **Meta row** (`mt-3 flex items-center justify-between`):
  - `<SvStatusPill>` + `text-[11px] tabular-nums text-neutral-500` (period)

- **Response block** (`mt-3`):
  - If `recipients > 0`: `flex items-center gap-3 rounded-md bg-[#fbf9f3] px-3 py-2.5` — ResponseRing size 48 stroke 4 + label "SVAR" eyebrow + `{responded} av {recipients}` (`text-sm font-bold tabular-nums`) + (advanced) snittscore line + eNPS line
  - Else: dashed-border `rounded-md border border-dashed border-neutral-200 px-3 py-2.5 text-center text-[11px] text-neutral-500` → "Ikke startet"

- **Channels row** (advanced only): `mt-3 flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-2.5` — channel badges or placeholder "Ingen distribusjon ennå"

#### 4.4.3 Tidslinje (`SvTimeline`)

`p-5`. Group entries by month (`MM.YYYY`); render in chronological order. Month sections (`space-y-5`):

- Header: `<h4 className="text-sm font-semibold text-neutral-900" style={{ fontFamily: SHARED_SERIF }}>{MonthName YYYY}</h4>` + count meta
- List: `ol relative border-l-2 border-neutral-200 pl-5` — each `<li>` `relative mb-2.5 last:mb-0`
- Node: absolutely positioned `-left-[28px] top-1`, `h-4 w-4 rounded-full ring-2 ring-white`, color from status (forest/green/indigo/neutral)
- Card: `block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]` — kind icon, title + meta, ResponseRing (size 28), SvStatusPill

Entries with `openFrom === '—'` group as `Uten periode` and render last.

#### 4.4.4 Tavle / Kanban (`SvKanban`)

Grid `grid-cols-4 gap-3 p-3`. Columns:

| col `id` | label | accent dot |
|---|---|---|
| `utkast` | Utkast | `#a3a3a3` |
| `planlagt` | Planlagt | `#6366F1` |
| `aktiv` | Aktiv | `#2F7757` |
| `lukket` | Lukket | `#1a3d32` |

(`arkivert` entries fold into `lukket` bucket; unknown status falls into `utkast`.)

- Column wrapper: `flex min-h-[420px] flex-col rounded-lg border border-neutral-200/80 bg-[#fbf9f3]/60`
- Column header: `flex items-center justify-between border-b border-neutral-200/70 px-3 py-2` — dot (`h-2 w-2 rounded-full` w/ accent) + label `text-xs font-semibold` + count pill `rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-200`
- Card: `cursor-pointer rounded-md border border-neutral-200/80 bg-white p-2.5 hover:border-[#1a3d32]/40 hover:shadow-sm k-card-shadow`
- Empty column: dashed placeholder card "Ingen"

### 4.5 Maler tab (`SvMaler`)

Tabell view = same `MODULE_TABLE_TH` skeleton:

| Col | Show when | Notes |
|---|---|---|
| Mal | always | Kind icon halo + name + `text-[11px] text-neutral-500`: `{sections.length} seksjoner · ~{avgMinutes} min · {owner}` |
| Spørsmål | always | `tabular-nums` |
| Cadence | always | text |
| Lov | advanced | wrap of `<span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">{law}</span>` |
| Anonym | advanced | same EyeOff/Eye treatment as entries |
| Kjøringer | always | `tabular-nums` |
| Action | always | `<Button variant="primary" size="sm" icon={<Send/>}>Send ut</Button>` |

Bokser view: cards with header (icon halo `h-10 w-10`, eyebrow `Mal · {kind}`, title serif), section list (first 3 sections), advanced stats row (3 cols: spørsmål / kjøringer / snitt), footer with "Rediger ›" link + "Send ut" primary button.

Tidslinje & Tavle are **hidden** in Maler (only Tabell + Bokser).

### 4.6 Resultater tab (`SvResultater`)

`p-5`. Filtered to entries with `responded > 0`.

#### 4.6.1 KPI row

`grid grid-cols-4 gap-3`. Each tile `rounded-md p-3`:

- 3× cream tiles (`bg-[#fbf9f3]`):
  - Eyebrow `text-[10px] font-bold uppercase tracking-wider text-neutral-500`
  - Big: `text-2xl font-bold tabular-nums text-[#1a3d32]` w/ `fontFamily: SHARED_SERIF`
  - Sub: `text-[11px] text-neutral-500`
- 1× amber tile (`bg-amber-50 ring-1 ring-amber-100`) for "Røde flagg": amber-800 eyebrow, amber-900 number, amber-800 sub

Values from aggregate calc: `Snitt svarprosent`, `Snitt eNPS`, `Røde flagg`, `Innsamlede svar`.

#### 4.6.2 Table

`mt-5 overflow-x-auto`. `min-w-[920px] text-sm`. Head wrapped in `thead.border-y border-neutral-200`.

Columns: Undersøkelse · Svarprosent · Snittscore · eNPS · (advanced) Distribusjon · Avsluttet · `›`

- Svarprosent cell: `flex items-center gap-2` of `<ProgressBar value w-20 />` + `text-xs font-semibold tabular-nums`
- Snittscore: bold if present, else `—`
- eNPS: see color thresholds in §1.1
- "Rødt flagg" pill when `e.riskFlag === true`: `rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800`

---

## 5 · Detail page (`SurveyDetailPage`)

### 5.1 Header

- Breadcrumb: `Klarert › Undersøkelser (link) › {title}`
- Title = `entry.title` (serif H1)
- Description:
  - **Enkel:** `{audience}`
  - **Avansert:** `Mal: {tpl.name} · {audience} · åpen {openFrom} – {openTo}.`

Header actions (order, **status-dependent**):

1. `<Button variant="ghost" icon={<ArrowLeft/>}>Tilbake</Button>` — always
2. `<ModeToggle>` — always
3. Status-driven primary actions:

| `status` | Buttons (in order) |
|---|---|
| `utkast` | `<Button variant="primary" icon={<Send/>}>Publiser & send ut</Button>` |
| `planlagt` | `<Button variant="primary" icon={<Play/>}>Start nå</Button>` |
| `aktiv` | `<Button variant="secondary" icon={<Bell/>}>Send påminnelse</Button>` + `<Button variant="primary" icon={<Lock/>}>Lukk undersøkelse</Button>` |
| `lukket` | `<Button variant="primary" icon={<Download/>}>Eksporter rapport</Button>` |
| `arkivert` | (no destructive actions; only `Tilbake` + mode toggle) |

### 5.2 Status strip

Below header, before tabs:

```
flex items-center justify-between
rounded-xl border border-neutral-200/80 bg-white px-5 py-3 k-card-shadow
```

- **Left** (`flex items-center gap-3`): `<SvStatusPill>` + (if anonymous) anonym chip `inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]` with `EyeOff h-3 w-3` + (advanced) lov chips per `tpl.lov`
- **Right** (`flex items-center gap-4 text-xs text-neutral-600`):
  - Calendar icon + `{openFrom} – {openTo}` (tabular-nums)
  - Users icon + `{recipients} mottakere`
  - MailCheck icon + `{Math.round(completionRate * 100)}% svart` (only if `recipients > 0`)
  - All icons: `h-3.5 w-3.5 text-neutral-400`, `inline-flex items-center gap-1.5`

### 5.3 Tabs container

```
rounded-xl border border-neutral-200/80 bg-white k-card-shadow
```

Header: `border-b border-neutral-100 px-5 py-2.5` — `<Tabs>` with items:

| `id` | label | icon | badge |
|---|---|---|---|
| `oversikt` | Oversikt | `LayoutDashboard` | — |
| `sporsmal` | Spørsmål | `HelpCircle` | `tpl.questionCount` |
| `distribusjon` | Distribusjon | `Send` | — |
| `resultater` | Resultater | `BarChart3` | `entry.responded` |
| `innstillinger` | Innstillinger | `Settings` | — |

Body: `p-5`.

### 5.4 Oversikt tab

Two-col grid `grid-cols-[minmax(0,1fr)_320px] gap-5`.

**Left column** (`space-y-4`):

1. **KPI row** — `grid grid-cols-4 gap-2`. Each tile `rounded-md bg-[#fbf9f3] px-3 py-2.5`:
   - Svarprosent: eyebrow + `text-2xl font-bold tabular-nums text-[#1a3d32]` + `<ProgressBar>` mt-1.5
   - Svar: `{responded}` big + `/{recipients}` thin (`text-base font-normal text-neutral-400`) + `{recipients - responded} gjenstår` sub
   - Snittscore (only if `entry.avgScore != null`): bold neutral-900 + "av 5,0"
   - eNPS (only if `entry.eNPS != null`): green/amber/red text by threshold + "benchmark +25"

2. **Svar over tid** (advanced + hasResults only): `rounded-md border border-neutral-200/80 p-4` — title + meta + inline SVG line+area chart (300×120 viewBox), grid lines dashed `stroke="#E5E5E5" strokeDasharray="2 3"`, line `#1a3d32` strokeWidth 2, fill linear-gradient `#1a3d32` 0.18 → 0, point dots r=3 `#1a3d32`. X-axis labels: openFrom · I dag · openTo.

3. **Nøkkelfunn** (advanced + hasResults only): `h4` + `ul.mt-2 space-y-2`. Each insight:
   - Layout: `flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs`
   - Tone palettes:
     - `positive`: `border-green-200 bg-green-50/60` + `TrendingUp text-green-700` + `text-green-900`
     - `warning`: `border-amber-200 bg-amber-50` + `AlertCircle text-amber-700` + `text-amber-900`
     - `critical`: `border-red-200 bg-red-50` + `AlertTriangle text-red-700` + `text-red-900`
   - Icon `h-3.5 w-3.5 shrink-0 mt-0.5`

4. **Quick links** — `grid grid-cols-3 gap-2`. Each button routes to a sibling tab. Style:
   ```
   flex items-center gap-2 rounded-md border border-neutral-200/80 bg-white p-3 text-left
   hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]
   ```
   Icon halo `h-8 w-8 rounded-md bg-[#e7efe9] text-[#1a3d32]`, title `text-xs font-semibold`, sub `text-[10px] text-neutral-500`. Targets: Spørsmål · Distribusjon · Resultater.

**Right column** (`space-y-3`):

1. **Detaljer card** `rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow` — title `text-sm font-semibold` + `dl mt-2 space-y-2 text-[12px]` with rows:
   - Mal, Eier, Anonym (Ja/Nei), Påminnelser ("{N} sendt"), (advanced) Spørsmål, (advanced) Est. tid
   - Each row: `flex justify-between` — dt `text-neutral-500`, dd `text-neutral-900`

2. **Deltakere card** — same shell, `<ul>` of avatar + name + role.

3. **Riskflag card** (only when `entry.riskFlag === true`):
   ```
   rounded-xl border border-red-200 bg-red-50/70 p-4
   ```
   - Title row: `AlertTriangle h-4 w-4 text-red-700` + `text-sm font-semibold text-red-900` ("Lovpålagt oppfølging")
   - Body: `text-[11px] text-red-800` explaining (AML § 4-3)
   - CTA: `text-[11px] font-semibold text-red-900 hover:underline` → "Opprett avvik ›" (routes to Avvik module)

### 5.5 Spørsmål tab

Two-col `grid-cols-[minmax(0,1fr)_280px] gap-5`.

**Left column** — sections list. Group questions by `section`. Each section:

- Header: `mb-2 flex items-baseline gap-2` — `h3 text-sm font-semibold` with `fontFamily: SHARED_SERIF` showing `{idx + 1}. {section}` + count meta `text-[11px] tabular-nums text-neutral-400` "{N} spørsmål"
- List: `space-y-1.5`, each item `rounded-md border border-neutral-200/80 bg-white p-2.5 hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]` with `group` for hover state

Inside item (`flex items-start gap-2`):
- `GripVertical h-3.5 text-neutral-300 group-hover:text-neutral-500` (mt-1)
- Body:
  - Row 1: `{i+1}` index `text-[11px] font-bold tabular-nums text-neutral-400` + question text `text-sm text-neutral-900`. Required → `*` red. Conditional → `(betinget)` `text-[10px] font-semibold uppercase tracking-wider text-neutral-400`
  - Row 2 (advanced): type pill (`border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700` + icon + label + optional ` · {range}`) and branching hint (`GitBranch h-2.5` + `{branching}` text-[10px] text-neutral-500)

Question type map:

| `type` | icon | label |
|---|---|---|
| `scale` | `BarChart2` | Skala |
| `nps` | `Gauge` | NPS |
| `ja/nei` | `ToggleLeft` | Ja/Nei |
| `fritekst` | `Type` | Fritekst |
| `flervalg` | `List` | Flervalg |

**Footer of left col:** `flex items-center gap-2 border-t border-neutral-100 pt-3`:
- `<button>` dashed: `inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]` → "+ Nytt spørsmål"
- (advanced) Quick-add type buttons (one per type)

**Right column — Forhåndsvisning:**

`rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow`:
- Title + sub
- Preview card: `rounded-md border border-neutral-200 bg-[#fbf9f3] p-3`
  - Eyebrow "Spørsmål 1 av {N}"
  - Question text `text-sm text-neutral-900`
  - 5-button scale: `grid grid-cols-5 gap-1.5`, each `rounded-md border py-2 text-center text-sm font-semibold`
    - Inactive: `border-neutral-200 bg-white text-neutral-700 hover:border-[#1a3d32]`
    - Active: `border-[#1a3d32] bg-[#1a3d32] text-white`
  - Labels: "Helt uenig" / "Helt enig" `text-[10px] text-neutral-400`

### 5.6 Distribusjon tab

Two-col `grid-cols-[minmax(0,1fr)_320px] gap-5`.

**Left column** (`space-y-5`):

1. **Kanaler section** — title + sub + `grid grid-cols-3 gap-2`. Each channel card:
   ```
   flex items-center justify-between rounded-md border p-3 transition-colors
   ```
   - Inactive: `border-neutral-200 bg-white`, icon halo `h-7 w-7 bg-neutral-100 text-neutral-500`
   - Active: `border-[#1a3d32] bg-[#e7efe9]`, icon halo `h-7 w-7 bg-white text-[#1a3d32]`
   - Right side: `<ToggleSwitch>` (see §6.5) — track `h-5 w-9 rounded-full` (forest when on, neutral-300 when off), knob `h-4 w-4 rounded-full bg-white absolute top-0.5` translate-x-4 (on) / translate-x-0.5 (off)

   Channel → icon map: `e-post` Mail · `SMS` MessageCircle · `Slack` Hash · `intranett` Globe · `QR-plakat` QrCode · `lenke` Link.

2. **Mottakere section** — title row with `<Button variant="secondary" size="sm" icon={<Filter/>}>Tilpass utvalg</Button>` on the right. Body: `mt-3 overflow-hidden rounded-md border border-neutral-200/80` wrapping a small `table.text-xs`:
   - Head: `bg-[#fbf9f3]` `th px-3 py-2 text-left font-semibold text-neutral-700`
   - Rows: `divide-y divide-neutral-100 hover:bg-neutral-50/60`
   - Cols: Gruppe · Mottakere · Svart · (advanced) Svarprosent (ProgressBar w-16 height-3 + percent)

3. **Påminnelser section** (advanced only) — title + sub + `ul.mt-3 space-y-2`. Each row:
   - Sent: `border-green-200 bg-green-50/50`, icon halo `bg-green-600 text-white` with `CheckCircle`, right label `Sendt` text-green-700
   - Planned: `border-neutral-200 bg-white`, icon halo `bg-neutral-100 text-neutral-500` with `Clock`, right label `Planlagt` text-neutral-500
   - Title `text-sm font-medium text-neutral-900`, sub `text-[11px] text-neutral-500`
   - Footer: dashed `+ Legg til påminnelse` (same style as §5.5)

**Right column — sidebar** (`space-y-3`):

1. **Delbar lenke card** — title + URL row `flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px]` (Link icon + `<code class="font-mono">` URL + Copy button `rounded p-1 hover:bg-white`) + (if anonymous) anonymity hint with `EyeOff text-[#1a3d32]`.

2. **QR-kode card** — title + sub + `flex h-32 items-center justify-center rounded-md bg-[#fbf9f3] ring-1 ring-neutral-200` containing an 80×80 SVG (deterministic pseudo-random fill cells + 3 finder squares in forest). Footer button `<Button variant="secondary" size="sm" icon={<Download/>}>Last ned PNG</Button>` (full width).

### 5.7 Resultater tab

`space-y-5`.

#### 5.7.1 eNPS + per-question row

`grid grid-cols-[280px_minmax(0,1fr)] gap-5`.

**eNPS donut** (only if `entry.eNPS != null`):
- Card `rounded-md border border-neutral-200/80 p-4`
- SVG 160×160 donut, radius 60, stroke 22, paths colored by §1.1 (Promotere/Passive/Detraktorer)
- Center label: big `+{eNPS}` (24px, 700, forest) + "eNPS" subtle below
- Legend `ul.mt-3 space-y-1 text-[11px]` — colored dot + label + count `tabular-nums font-semibold`

**Per-question card**:
- Title row + (advanced) link "Sammenlign mot forrige ›"
- `ul.mt-3 space-y-3` — each question:
  - Label + snitt with `text-xs`. Snitt color by threshold (≥4 green-700, ≥3.5 neutral-900, else amber-700)
  - 5-segment stacked bar `flex h-3 overflow-hidden rounded-sm` with widths `${(v / total) * 100}%`, colors from §1.1 1–5 scale
- Legend (advanced): 5 color swatches `h-2 w-2` + numeric label

#### 5.7.2 Fritekst — utdrag (advanced only)

Card with title + meta "{N} åpne svar · klikk for å se alle". `ul.mt-3 grid grid-cols-2 gap-2`. Each card:
- `rounded-md border p-2.5 text-[12px]`
- Tone palettes:
  - `positive`: `border-green-200 bg-green-50/40`
  - `warning`: `border-amber-200 bg-amber-50/60`
  - `critical`: `border-red-200 bg-red-50/60`
- Body: `<p className="italic text-neutral-800">{quote}</p>` + footer `flex items-center justify-between text-[10px]` with section tag + (if flagged) `rounded-full bg-red-200 px-1.5 py-0.5 font-bold text-red-900` "Krever oppfølging"

### 5.8 Innstillinger tab

Two-col `grid grid-cols-2 gap-5`.

**Left column** (`space-y-3`):

1. "Tilgang & anonymitet" — `h3 text-sm font-semibold` + `rounded-md border border-neutral-200/80 p-4` containing `<ToggleRow>`s (see §6.6):
   - Anonymisert · "Svar lagres uten kobling til respondent. Kan ikke endres når svar er mottatt."
   - Krev innlogging · "Respondenten må logge inn med SSO før svar lagres."
   - Tillat delvis lagring · "Respondent kan lukke og fortsette senere."
   - Vis fremdriftslinje · "Respondent ser hvor langt de er kommet."

2. "Lovverk & retensjon" — chips for `tpl.lov[]` (forest-soft, see §1.1) + `dl.text-xs space-y-2` with Lagringstid / Behandlingsgrunnlag / Eksport.

**Right column** (`space-y-3`):

1. "Resultatdeling" — ToggleRows:
   - Del live-dashboard med HMS-leder
   - Send sammendrag automatisk ved lukking
   - Tillat ledere å se sitt teams resultater (default off)

2. "Faresone" `rounded-md border border-red-200 bg-red-50/50 p-4` with `ul.space-y-2 text-xs`:
   - "Lukk undersøkelse nå" row + `<Button variant="secondary" size="sm">Lukk</Button>`
   - "Slett undersøkelse" row (separated by `border-t border-red-100 pt-2`) + `<Button variant="ghost" size="sm" className="!text-red-700">Slett</Button>`

---

## 6 · Reusable components

Build these before §4/§5. Each has a fixed API; **don't add props** beyond
what's listed.

### 6.1 `<Button>` — existing (`src/components/ui/Button.tsx`)

Verify it matches:

| Prop | Type | Values |
|---|---|---|
| `variant` | enum | `primary` `secondary` `danger` `ghost` |
| `size` | enum | `default` `sm` `icon` |
| `icon` | ReactNode | Lucide icon, sized via class on the icon |
| `className` | string | Pass-through |
| `children` | ReactNode | Label |

Base: `inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50`.

Variants:
- `primary`: `bg-[#1a3d32] text-white hover:bg-[#14312a]`
- `secondary`: `border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`
- `danger`: `bg-red-600 text-white hover:bg-red-700`
- `ghost`: `border border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900`

Sizes:
- `default`: `px-4 py-2 text-sm`
- `sm`: `px-3 py-1.5 text-xs`
- `icon`: `p-1 text-neutral-500 hover:text-neutral-900`

### 6.2 `<Badge>` — existing (`src/components/ui/Badge.tsx`)

Confirm `variant` covers: `draft neutral active info signed success warning medium high critical danger`. Pill class: `inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border shadow-sm`.

### 6.3 `<Tabs>` — existing (`src/components/ui/Tabs.tsx`)

Confirm signature:

```ts
type TabItem = { id: string; label: string; icon?: LucideName; badgeCount?: number; disabled?: boolean };
type Props = { items: TabItem[]; activeId: string; onChange(id: string): void; overflow?: 'wrap' | 'scroll' };
```

Item base: `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors`. Active: `bg-[#1a3d32] text-white`. Inactive: `text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`. Badge: `ml-1.5 rounded-full px-2 py-0.5 text-xs`; active = `bg-white/20 text-white`, inactive = `bg-neutral-200 text-neutral-700`.

### 6.4 `<ModeToggle>` — port from `kit/Shared.jsx:6`

Two-segment pill: `Enkel` (CircleDot) / `Avansert` (SlidersHorizontal).

```ts
type Props = { mode: 'easy' | 'advanced'; onChange(mode): void; compact?: boolean };
```

Wrapper: `inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1` with `boxShadow: '0 1px 1px rgba(0,0,0,0.03)'`. Active segment: `bg-[#1a3d32] text-white`. Inactive: `text-neutral-600 hover:text-neutral-900`. Sub-label (`· For alle i felt` / `· HMS-ansvarlig`) hidden on small screens.

State stored in URL search param `?mode=easy|advanced` (default `advanced`). Persist across hub → detail navigation.

### 6.5 `<ResponseRing>` — new file `src/components/survey/ResponseRing.tsx`

Donut ring with percentage label.

```ts
type Props = { value: number; /* 0..1 */ size?: number; stroke?: number };
```

Tone driven by value (see §1.1). Background ring `#E5E5E5`. Foreground ring uses `strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round"` and `transform={rotate(-90 cx cy)}`. Center text: `fontSize: size * 0.32, fontWeight: 700, fill: '#1d1f1c'`, dy `0.35em`, textAnchor middle.

Sizes used: 28 (kanban), 32 (table), 40 (default), 48 (boxes view).

### 6.6 `<ToggleRow>` — port from `SurveyDetail.jsx:636`

```ts
type Props = { label: string; desc?: string; value: boolean; onChange?(next: boolean): void };
```

Row: `flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-b-0`. Switch: track `h-5 w-9 rounded-full` (forest on, neutral-300 off), knob `h-4 w-4 bg-white rounded-full absolute top-0.5` translate-x-4 (on) / translate-x-0.5 (off), `transition-colors` on track + `transition-transform` on knob. Whole switch is the click target; cursor-pointer.

Accessibility: render as `<button role="switch" aria-checked={value}>`, label/desc connected via aria-labelledby.

### 6.7 `<LivePingDot>` — for "Aktive" indicator

```jsx
<span className="relative flex h-2 w-2">
  <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-60" />
  <span className="relative h-2 w-2 rounded-full bg-green-600" />
</span>
```

Use only on status-panel "Aktive" row.

### 6.8 `<ChannelBadge>` — port from `SurveyApp.jsx:67`

```ts
type Props = { ch: 'e-post' | 'SMS' | 'Slack' | 'intranett' | 'QR-plakat' | 'lenke' };
```

Render: `inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700`. Leading icon `h-2.5 w-2.5` from the channel→icon map (§5.6).

### 6.9 `<SvStatusPill>` & `<SvKindIcon>`

- `<SvStatusPill status>` — wraps `<Badge>` with this status→variant map:

  ```ts
  const SV_STATUS_VARIANT = {
    utkast: { label: 'Utkast', variant: 'neutral' },
    planlagt: { label: 'Planlagt', variant: 'info' },
    aktiv: { label: 'Aktiv', variant: 'success' },
    lukket: { label: 'Lukket', variant: 'signed' },
    arkivert: { label: 'Arkivert', variant: 'neutral' },
  };
  ```

- `<SvKindIcon kind className>` — Lucide icon from this map:

  ```ts
  const SV_KIND_ICON = {
    medarbeider: 'Users',
    hms: 'Brain',
    puls: 'Activity',
    lifecycle: 'Repeat',
    risk: 'AlertTriangle',
  };
  ```
  Fallback: `ClipboardList`.

### 6.10 `<ProgressBar>` — existing/shared

```ts
type Props = { value: number; tone?: 'forest' | 'warn' | 'danger'; height?: number };
```

Track: `w-full overflow-hidden rounded-full bg-neutral-200/70` with `height` (default 4). Fill: `width: ${value*100}%, height: 100%, background: { forest: '#1a3d32', warn: '#c98a2b', danger: '#b3382a' }[tone]`, `transition: width .35s ease`.

### 6.11 `<Initials>` — existing/shared

```ts
type Props = { name: string; size?: number; tone?: 'forest' | 'cream' | 'sand' };
```

Round chip with initials. Tone palette:
- `forest`: bg `#e7efe9`, fg `#1a3d32`
- `cream`: bg `#f1ecdf`, fg `#5a4a2a`
- `sand`: bg `#efe9d8`, fg `#6b5a2b`

`fontSize: max(9, round(size * 0.42))`, `letterSpacing: 0.2`.

---

## 7 · Interaction states

State coverage requirements (verify each component supports):

| State | Spec |
|---|---|
| **Hover** | Buttons, table rows, sidebar items, cards. All transitions `transition-colors` 150ms default. Tables: row bg `neutral-50/60`. Cards: border → `border-[#1a3d32]/40`, shadow → `shadow-md`. |
| **Focus** | All inputs: `focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25`. Buttons: rely on browser default focus ring; **do not** suppress with `focus:outline-none` without re-adding `focus-visible:ring-2 focus-visible:ring-[#1a3d32]/30`. |
| **Active** | Tabs / category rail: forest accent (`bg-[#e7efe9]` + 3px inset shadow / `bg-[#1a3d32] text-white`). |
| **Disabled** | Buttons: `disabled:cursor-not-allowed disabled:opacity-50`. Inputs: `disabled:bg-neutral-50`. Tab item: `cursor-not-allowed text-neutral-400 opacity-60`. |
| **Loading** | Reuse existing `<Spinner>` from `src/components/ui/Spinner.tsx`. For table/list loading, show 5 skeleton rows (`animate-pulse bg-neutral-100`) — match cell heights, not contents. |
| **Empty** | Hub views: centered placeholder `px-5 py-12 text-center text-sm text-neutral-500`. Text: "Ingen undersøkelser i denne kategorien ennå." Sidebar lists: short inline `text-neutral-400 text-xs` "Ingen". |
| **Error** | Wrap data sections in `<ErrorBoundary>` that shows `<WarningBox>Kunne ikke laste {section}. Prøv på nytt ›</WarningBox>`. |

**Mode-driven (Enkel vs Avansert):**

- Enkel hides: lov chips, distribusjon column, anonym column, eier column, reminders sub-text, snittscore + eNPS lines on box cards, key-findings panel, fritekst-utdrag panel, quick-add type buttons, "Sammenlign mot forrige" link, per-question legend.
- Enkel description text is shorter (see §4.1, §5.1).

**Status-driven (entry.status):**

- Header actions: see §5.1 table.
- Kanban placement: arkivert → lukket column.
- Quick links / KPIs: `Svarprosent` and ring tone reflect `completionRate`, color thresholds in §1.1.

---

## 8 · Data binding

The prototype `seed.js` is for visual reference only. Wire to real data via
the existing hooks:

| Prototype object | Real source |
|---|---|
| `seed.templates[]` | `useSurveyOrgTemplates()` returning rows from `survey_org_templates` + `survey_template_catalog` (per the survey-parity spec) |
| `seed.entries[]` | `useSurveys({ organizationId })` returning rows from `surveys` table |
| `seed.sample.questions[]` | Joined from `survey_org_template_questions` for `entry.tplId` |
| `seed.sample.results.*` | `useSurveyResults(surveyId)` → aggregated from `survey_responses` |
| `seed.sample.deltakere` | `useSurveyParticipants(surveyId)` |

**Field mapping (prototype → DB column):**

| Prototype | DB |
|---|---|
| `entry.id` | `surveys.id` |
| `entry.tplId` | `surveys.org_template_id` |
| `entry.title` | `surveys.title` |
| `entry.audience` | computed from `surveys.audience_group_label` or derived |
| `entry.recipients` | `surveys.recipient_count` (computed view) |
| `entry.responded` | count of `survey_responses` where `survey_id = entry.id AND submitted_at NOT NULL` |
| `entry.status` | `surveys.status` enum: `utkast \| planlagt \| aktiv \| lukket \| arkivert` |
| `entry.openFrom` / `openTo` | `surveys.open_from` / `open_to` (formatted `dd.MM.yyyy`) |
| `entry.anonymous` | `surveys.is_anonymous` |
| `entry.channels[]` | `surveys.distribution_channels text[]` |
| `entry.reminders` | count of `survey_reminders.sent_at NOT NULL` for survey |
| `entry.owner` | `members.full_name` joined via `surveys.owner_member_id` |
| `entry.eNPS` / `avgScore` / `completionRate` | computed in `useSurveyResults` (or DB view) |
| `entry.riskFlag` | `surveys.risk_flag` boolean (NEW column — add via migration if missing) |
| `tpl.kind` | `survey_org_templates.category_slug` (`medarbeider`, `hms`, `puls`, `lifecycle`, `risk`) — needs the survey-template-categories work from `survey-parity.md` §2 |
| `tpl.lov[]` | `survey_org_templates.law_refs text[]` |

**Date formatting:** use `formatNorwegianDate(date)` (`src/lib/format/date.ts`). Always `dd.MM.yyyy`. When period is missing, show `'—'` (em dash) and group as "Uten periode" in Tidslinje.

**Currency / numbers:** all numeric columns use `tabular-nums` for stable column widths. `Math.round(value * 100)` for percentages.

---

## 9 · Acceptance checklist

Run each box top-to-bottom before claiming "done". Anything not ✅ is not shipped.

### Hub
- [ ] Page header matches §3 (serif H1, breadcrumb, header actions in declared order)
- [ ] Category rail: 6 items, counts switch when tab changes, active item shows 3px inset-left forest accent + `bg-[#e7efe9]`
- [ ] Status-nå panel hidden in Enkel; visible in Avansert with live ping dot
- [ ] Lovpålagt callout appears only when an overdue lovpålagt survey exists
- [ ] Tabs render in declared order with declared badges (entries / maler / resultater)
- [ ] Search input present; placeholder Norwegian; focus rings forest
- [ ] View switcher visible on entries+maler; hidden on resultater
- [ ] Tabell view: 4 cols Enkel, 7 cols Avansert; row click → detail
- [ ] Bokser view: 3-col grid; response block shows ring + count when `recipients > 0`, dashed "Ikke startet" otherwise
- [ ] Tidslinje view: grouped by month, "Uten periode" group renders last
- [ ] Tavle view: 4 columns in declared order; arkivert merges into lukket; empty column shows dashed "Ingen"
- [ ] Maler tab: tabell + bokser only; tidslinje/tavle hidden
- [ ] Resultater tab: KPI row (3 cream tiles + 1 amber) + result table with eNPS color thresholds; no view switcher

### Detail
- [ ] Header actions reflect status (per §5.1 table)
- [ ] Status strip: pill + (if anonymous) anonym chip + (advanced) lov chips on left; date/users/svart on right
- [ ] Tab order: Oversikt · Spørsmål · Distribusjon · Resultater · Innstillinger; badges match
- [ ] Oversikt KPI tiles hide Snittscore/eNPS when null; ProgressBar tone follows §1.1 thresholds
- [ ] Svar-over-tid chart renders only in Avansert with results; grid lines dashed
- [ ] Nøkkelfunn tone palettes match (positive/warning/critical)
- [ ] Quick-links route to sibling tabs
- [ ] Riskflag sidebar appears only when `entry.riskFlag === true`
- [ ] Spørsmål: sections numbered, type pill icon+label correct, conditional + required indicators present
- [ ] Distribusjon: 6 channel cards with correct active/inactive styling; toggle switch animation works
- [ ] Distribusjon: mottakere table; påminnelser list (advanced) with sent/planned tones
- [ ] Distribusjon sidebar: delbar lenke + QR card with PNG download
- [ ] Resultater: eNPS donut renders only when `eNPS != null`; per-question stacked bars use 5-color scale (§1.1); legend only in Avansert
- [ ] Innstillinger: 4 ToggleRows + 3 ToggleRows in correct sections; Faresone styled red

### Cross-cutting
- [ ] Norwegian copy verbatim (no English UI strings)
- [ ] All buttons reach focus via Tab; visible focus ring
- [ ] All cards use `rounded-xl border border-neutral-200/80 bg-white` + `k-card-shadow`
- [ ] All tables wrapped in `overflow-x-auto` with appropriate `min-w-*`
- [ ] Mode toggle persists across hub ↔ detail navigation (URL param)
- [ ] No hardcoded seed data — all values come from hooks
- [ ] `npm run typecheck` + `npm run lint` pass
- [ ] No new console warnings

---

## 10 · Optimized Claude Code prompts

Each prompt below is **self-contained** — paste it into a fresh Claude
Code session. Each one corresponds to **one PR-sized chunk**. Run them
in order; each assumes the previous is merged.

### Prompt A — Build the reusable primitives

```
Read specs/klarert-undersokelser-implementation.md §1 (tokens) and §6
(reusable components). Then implement the components that don't already
exist in src/components/ui/:

1. src/components/survey/ResponseRing.tsx  (§6.5)
2. src/components/survey/ToggleRow.tsx     (§6.6)
3. src/components/survey/LivePingDot.tsx   (§6.7)
4. src/components/survey/ChannelBadge.tsx  (§6.8)
5. src/components/survey/SvStatusPill.tsx + SvKindIcon.tsx (§6.9)

For each, mirror the props table from §6 exactly. Don't add extra props.
Tailwind classes are listed in the spec — copy them verbatim. Strings are
all Norwegian; don't translate them.

Verify <Button>, <Badge>, <Tabs>, <ModeToggle>, <ProgressBar>, <Initials>
already exist with the expected APIs (§6.1–6.4, 6.10–6.11). If any
existing implementation deviates from the spec, update it — these are
shared primitives and must match the design.

Don't touch SurveyModulePage.tsx or SurveyDetailPage.tsx yet.
Run npm run typecheck before committing.
```

### Prompt B — Hub shell + Tabell view

```
Read specs/klarert-undersokelser-implementation.md §3, §4.1–§4.3, §4.4.1, §8.

Rewrite src/pages/SurveyModulePage.tsx as the new hub:

- Use <ModulePageShell> with the declared breadcrumb, title, description
  (mode-aware per §4.1), and header actions in declared order.
- Two-col layout grid-cols-[260px_minmax(0,1fr)] gap-5.
- Left rail: <CategoryRail> with 6 items from §4.2.1 (extract as
  src/components/survey/CategoryRail.tsx). Counts driven by the active
  tab. Active item: bg-[#e7efe9] + inset 3px forest accent.
- Status-nå panel (§4.2.2) and Lovpålagt callout (§4.2.3) advanced-only.
- Right pane: tabs (entries/maler/resultater) + search + view switcher
  (hidden on resultater).
- Implement the Tabell view (§4.4.1) only. Bokser/Tidslinje/Tavle render
  a placeholder "Kommer snart" empty state for now.
- Wire to useSurveys() and useSurveyOrgTemplates() per §8. Field
  mapping is in the spec — don't invent new columns.
- Mode toggle state lives in ?mode= search param.

Verify against §9 hub checklist for the items that apply to Tabell view.
Run typecheck + lint. Don't commit if either fails.
```

### Prompt C — Bokser, Tidslinje, Tavle views

```
Read specs/klarert-undersokelser-implementation.md §4.4.2–§4.4.4.

In src/pages/SurveyModulePage.tsx (or extract to
src/components/survey/views/), implement the three remaining hub views:

1. SvBoxes (§4.4.2) — 3-col grid, response block w/ ring or dashed
   placeholder.
2. SvTimeline (§4.4.3) — group by MM.YYYY, "Uten periode" group last,
   left rail with status-colored nodes.
3. SvKanban (§4.4.4) — 4 columns in declared order, arkivert merges
   into lukket, empty column shows "Ingen".

Replace the "Kommer snart" placeholders. Don't touch the data hooks —
use the same useSurveys() data the Tabell view consumes.

Verify against §9 hub checklist (Bokser/Tidslinje/Tavle items).
```

### Prompt D — Maler tab + Resultater tab

```
Read specs/klarert-undersokelser-implementation.md §4.5 and §4.6.

In SurveyModulePage.tsx:

1. Maler tab: Tabell (default) + Bokser. Tidslinje/Tavle hidden when
   tab === 'maler' (already gated by view switcher visibility — also
   hide the switcher buttons for Tidslinje/Tavle in this tab). Use
   useSurveyOrgTemplates() data; Send-ut button opens the existing
   "send survey" modal (find it via grep).

2. Resultater tab: hide the view switcher entirely (§4.3.1). KPI row
   from §4.6.1 (3 cream + 1 amber tile). Table from §4.6.2 with eNPS
   color thresholds from §1.1. Source: entries with responded > 0.
   Aggregate the 4 KPI numbers in a useMemo.

Run typecheck + lint.
```

### Prompt E — Detail shell + Oversikt tab

```
Read specs/klarert-undersokelser-implementation.md §3, §5.1–§5.4, §8.

Rewrite src/pages/SurveyDetailPage.tsx:

- <ModulePageShell> with breadcrumb back-link calling navigate(-1) or
  /undersokelser. Status-driven header actions per §5.1.
- Status strip per §5.2 (pill + anonym + lov chips left; date+users+svart
  right).
- Tabs container per §5.3 with 5 tabs in declared order.
- Implement the Oversikt tab (§5.4) only — other tabs render "Kommer
  snart" placeholders.

Wire to useSurvey(id), useSurveyResults(id), useSurveyParticipants(id)
per §8. Date formatting via formatNorwegianDate. Mode toggle reads/writes
?mode= search param so it persists from the hub.

Verify against §9 detail checklist (status strip + Oversikt items).
```

### Prompt F — Spørsmål + Distribusjon tabs

```
Read specs/klarert-undersokelser-implementation.md §5.5 and §5.6.

In SurveyDetailPage.tsx:

1. Spørsmål tab: group questions by section; render type pills (§5.5
   QTYPE table); show required (*) and conditional indicators. Forhåndsvisning
   sidebar with the 5-button scale preview.

2. Distribusjon tab: 6 channel cards with active/inactive styling and
   the toggle switch; mottakere table; påminnelser list (advanced).
   Sidebar: delbar lenke + QR card (use a real QR component or the
   prototype's deterministic SVG generator — pick one and stick with it).

Replace both "Kommer snart" placeholders. Data source for questions:
useSurveyOrgTemplateQuestions(tpl.id). Channels come from entry.channels[].

Run typecheck + lint.
```

### Prompt G — Resultater + Innstillinger tabs + acceptance

```
Read specs/klarert-undersokelser-implementation.md §5.7, §5.8, and §9.

In SurveyDetailPage.tsx:

1. Resultater tab: eNPS donut (only when entry.eNPS != null), per-question
   stacked bars with 5-color scale (§1.1). Fritekst-utdrag panel in
   advanced mode only.

2. Innstillinger tab: 4 ToggleRows in "Tilgang & anonymitet", chips +
   dl in "Lovverk & retensjon", 3 ToggleRows in "Resultatdeling",
   Faresone with Lukk + Slett buttons.

3. Walk through §9 — hub + detail + cross-cutting. Fix anything that
   isn't ✅. Don't claim done until every box is checked.

4. Manual smoke test:
   - npm run dev
   - Navigate to /undersokelser, switch through all 4 view modes
   - Open any survey, walk all 5 tabs in Avansert + Enkel
   - Verify mode persists across hub → detail
   - Verify status-driven header actions on each status

Run npm run typecheck && npm run lint && npm test.
Commit with the standard trailer.
```

### One-shot prompt (if you'd rather do it in one branch)

```
Read specs/klarert-undersokelser-implementation.md top-to-bottom — it's
the pixel-perfect implementation spec for the new Undersøkelser surface.
The source design lives at https://api.anthropic.com/v1/design/h/x0xe95USBxtoH6HATarjUA
(gzipped tar of HTML/JSX prototypes; the spec's §0 explains how to
extract it). The spec covers tokens (§1), IA (§2), the hub (§4), the
detail page (§5), reusable components (§6), interaction states (§7),
data binding (§8), and acceptance gates (§9).

Implement it in the order described in §10:

1. Primitives (Prompt A) — §6 components.
2. Hub Tabell (Prompt B) — §4 minus other views.
3. Hub other views (Prompt C) — §4.4.2–§4.4.4.
4. Hub Maler + Resultater (Prompt D) — §4.5 + §4.6.
5. Detail Oversikt (Prompt E) — §5.1–§5.4.
6. Detail Spørsmål + Distribusjon (Prompt F) — §5.5–§5.6.
7. Detail Resultater + Innstillinger (Prompt G) — §5.7–§5.8.
8. Verify against §9 checklist — every box ✅ or it's not done.

Commit at every step. Don't try to land everything in one commit — the
review is much easier if each phase is its own commit. All UI copy is
Norwegian (no translation); code/comments/commit messages are English.
Match the existing house style in CLAUDE.md.

If anything in the spec contradicts the existing codebase (an existing
component has a different prop API, a hook returns a different shape),
flag the conflict in the PR description and ask before reshaping
existing surfaces.
```

---

## Appendix A — Norwegian copy (verbatim, do not translate)

**Hub:**
- Title: `Undersøkelser`
- Description (Enkel): `Lag og send ut undersøkelser — medarbeider, puls, HMS og mer.`
- Description (Avansert): `Spørreundersøkelser for arbeidsmiljø, puls og lifecycle. Anonyme der det kreves, med distribusjon, påminnelser og resultatanalyse.`
- Header buttons: `Resultatanalyse`, `Ny mal`, `Ny undersøkelse`
- Category rail title: `Kategorier`
- Status panel title: `Status nå`
- Status rows: `Aktive`, `Planlagt`, `Snitt svar`
- Lovpålagt callout: `Lovpålagt: psykososialt arbeidsmiljø` / `Kvartalsvis kartlegging neste forfall 30.06.2026.`
- Tabs: `Undersøkelser`, `Maler`, `Resultater`
- Search placeholder: `Søk i tittel, mottakere…`
- View labels: `Tabell`, `Bokser`, `Tidslinje`, `Tavle`
- Empty: `Ingen undersøkelser i denne kategorien ennå.`
- Table columns: `Undersøkelse`, `Status`, `Periode`, `Svar`, `Distribusjon`, `Anonym`, `Eier`
- Maler columns: `Mal`, `Spørsmål`, `Cadence`, `Lov`, `Anonym`, `Kjøringer`
- Resultater KPI labels: `Snitt svarprosent`, `Snitt eNPS`, `Røde flagg`, `Innsamlede svar`
- Resultater table columns: `Undersøkelse`, `Svarprosent`, `Snittscore`, `eNPS`, `Distribusjon`, `Avsluttet`
- Box meta: `Ikke startet`, `Ingen distribusjon ennå`
- Kanban empty: `Ingen`

**Detail:**
- Back: `Tilbake`
- Action buttons by status: `Publiser & send ut` (utkast), `Start nå` (planlagt), `Send påminnelse` + `Lukk undersøkelse` (aktiv), `Eksporter rapport` (lukket)
- Anonym chip: `Anonym`
- Status strip suffix: `mottakere`, `% svart`
- Tab labels: `Oversikt`, `Spørsmål`, `Distribusjon`, `Resultater`, `Innstillinger`
- Oversikt KPIs: `Svarprosent`, `Svar`, `Snittscore`, `eNPS`, `gjenstår`, `av 5,0`, `benchmark +25`
- Chart titles: `Svar over tid`, `Daglig akkumulert`, `I dag`
- Insights title: `Nøkkelfunn`
- Quick links: `Spørsmål · Se og rediger`, `Distribusjon · Mottakere & påminnelser`, `Resultater · Diagrammer & innsikt`
- Sidebar: `Detaljer` (Mal/Eier/Anonym/Påminnelser/Spørsmål/Est. tid), `Deltakere`
- Riskflag: `Lovpålagt oppfølging` / `Respondenter rapporterer krenkende atferd. Anonyme svar — overlevert HMS-leder. AML § 4-3.` / `Opprett avvik ›`
- Spørsmål: `{n} spørsmål`, `Nytt spørsmål`, `(betinget)`, `Forhåndsvisning`, `Spørsmål 1 av {N}`, `Helt uenig`, `Helt enig`
- Distribusjon: `Kanaler` / `Velg hvor undersøkelsen distribueres. Aktive kanaler markert grønt.`, `Mottakere`, `Tilpass utvalg`, `Påminnelser` / `Sendes automatisk til mottakere som ikke har svart.`, `Legg til påminnelse`, `Delbar lenke`, `QR-kode` / `Skriv ut for verksted / lager / pauserom.`, `Last ned PNG`, `Lenke gir anonym tilgang`
- Resultater: `eNPS-fordeling`, `Promotere (9–10)`, `Passive (7–8)`, `Detraktorer (0–6)`, `Per spørsmål — skala 1–5`, `snitt`, `Sammenlign mot forrige ›`, `Fritekst — utdrag`, `{n} åpne svar · klikk for å se alle`, `Krever oppfølging`
- Innstillinger: `Tilgang & anonymitet`, `Lovverk & retensjon`, `Resultatdeling`, `Faresone`, `Anonymisert`, `Krev innlogging`, `Tillat delvis lagring`, `Vis fremdriftslinje`, `Lagringstid`, `Behandlingsgrunnlag`, `Eksport`, `Del live-dashboard med HMS-leder`, `Send sammendrag automatisk ved lukking`, `Tillat ledere å se sitt teams resultater`, `Lukk undersøkelse nå`, `Slett undersøkelse`, `Lukk`, `Slett`

---

## Appendix B — Lucide icon manifest

Pre-import these (or auto-import) so the lazy-load doesn't flash on first render:

```
LayoutGrid, Users, Brain, Activity, Repeat, AlertTriangle, ClipboardList,
Send, FileText, BarChart3, Search, Rows3, CalendarDays, Columns3, Plus,
EyeOff, Eye, Mail, MessageCircle, Hash, Globe, QrCode, Link, ShieldAlert,
Bell, Lock, Play, Download, ArrowLeft, Calendar, MailCheck,
LayoutDashboard, HelpCircle, Settings, TrendingUp, AlertCircle,
GripVertical, BarChart2, Gauge, ToggleLeft, Type, List, GitBranch,
CheckCircle, Clock, Copy, Filter, FilePen, Radio, Dot, UserPlus, LogOut,
CircleDot, SlidersHorizontal
```
