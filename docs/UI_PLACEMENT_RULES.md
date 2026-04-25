# UI Placement & Module Consistency Rules

Reference for module UI work. Use this file as the system prompt / context when asking another LLM (e.g. Composer 2) to bring additional modules into alignment. It codifies the patterns established across ROS, Inspeksjonsrunder, Vernerunder, SJA, AMU, AMU-valg, and Tiltaksplan. For Dokumenter / malbibliotek **handlingsrekkefølge og knappejustering**, see **`docs/UI_DESIGN_RULES.md`** (same pattern as `WorkplacePageHeading1.headerActions`).

The rules assume the UI primitives that already live in the codebase:

- `src/components/module/ModulePageShell.tsx` — page chrome (background, max width, heading, breadcrumb, description, tabs, header actions, loading + not-found states).
- `src/components/module/ModuleSectionCard.tsx` — white content card (rounded-xl, border, subtle shadow).
- `src/components/module/ModuleRecordsTableShell.tsx` — KPI row + white card + table shell for records lists.
- `src/components/module/ModuleDocumentsHubLayout.tsx` — canonical **Dokumenter** hub shell: 70/30 via `ModuleMainAside` with `cardWrap={false}` (no outer white wrap on each column), one `ModuleSectionCard` around **main** only; optional `top` / `below` full-width slots. Pass `ModuleRecordsTableShell` with `wrapInCard={false}` when the main column already owns the white card (avoids nested boxes).
- `src/components/module/ModuleDocumentsInsightPanel.tsx` — cream aside panel for filters / short help (uses `WORKPLACE_MODULE_SUBTLE_PANEL`), not a nested white `ModuleSectionCard`.
- `src/components/module/ModuleDocumentsForestCard.tsx` — forest-green aside surface for storage / status widgets.
- `src/components/documents/DocumentsHubSecondaryNav.tsx` — **én** primær menylinje under `ModulePageShell` (`HubMenu1Bar`): **Dokumenter** (`/documents`), **Malbibliotek**, **Samsvar**, **Årsgjennomgang** (admin), **Innstillinger** (admin). «Dokumenter» forblir aktiv på wiki-understier (`/documents/page/…`, `/documents/space/…`) via `navActiveOverride` i `HubMenu1Bar`.
- `src/components/module/ModuleDocumentsKandidatdetaljHub.tsx` — default **Dokumenter** hub (Kandidatdetalj-split): beige ~22% mappe-nav, høyre kolonne `pages` eller `templates`, drag page to folder, fil-slipp i høyre kolonne under «Søk i sider»; på **Malbibliotek** vises kun mapper med kategori `template_library` i venstre kolonne, og maler opprettes kun i slike mapper.
- `src/components/documents/DocumentsTemplateLibraryBody.tsx` — malrutenett for malbibliotek-siden: **Ny mal** / **Ny malmappe** (managers), blyant: **organisasjonsmal** → `/documents/templates/org/:id/edit` (TipTap, `saveOrgCustomTemplate`); **systemmal** → oppretter wiki-side fra mal i første malmappe og åpner `/documents/page/:id/reference-edit`.
- `src/components/module/ModuleInformationCard.tsx` — form/metadata card with `withCard` + `hideHeader` props.
- `src/components/module/ModuleSignatureCard.tsx` — per-role signature card.
- `src/components/module/ModulePreflightChecklist.tsx` — pre-signing checklist.
- `src/components/module/ModuleChecklistCard.tsx` — data-driven HSE checklist.
- `src/components/module/ModuleLegalBanner.tsx` — mint «regelverk»-banner med innkort per referanse, lukk (X) og bryter i `ModulePageShell`-header (`ModuleLegalFrameworkProvider` i app-ruten).
- `src/components/module/moduleTableKit.ts` — `MODULE_TABLE_TH`, `MODULE_TABLE_TR_BODY` class constants.
- `src/components/module/moduleRiskKit.ts` — shared severity/risk helpers.
- `src/components/ui/*` — `Button`, `Badge`, `StandardInput`, `StandardTextarea`, `SearchableSelect`, `WarningBox`, `InfoBox`, `Tabs`, etc.

If a primitive does not exist yet, create it under `src/components/module/` rather than ad-hoc Tailwind. Do **not** paste raw `<input>`, `<select>`, `<button className="…">` into module code.

---

## Documents module hub (default)

Hele dokumentmodulen under **`DocumentsModuleShellLayout`** bruker **én** `ModulePageShell` (én `h1`, én beskrivelse som varierer med rute, én `HubMenu1Bar`). **`DocumentsModuleLayout`** er kun en tynn `Outlet`-wrapper (ingen egen overskrift/meny).

**Dokumenter** (`DocumentsHome`, `/documents`): **`ModuleDocumentsKandidatdetaljHub`** med **`centerContent="pages"`** (mapper utenom `template_library` + dokumenttabell). Opplastingsslipp vises også når **«Alle mapper»** er valgt (målmappe = første aktive mappe i listen, med forklarende hjelpetekst). **Malbibliotek** (`/documents/malbibliotek`): samme hub med **`centerContent="templates"`** — venstre kolonne: kun **malmapper** (`category === template_library`); høyre: `DocumentsTemplateLibraryBody` med `destinationSpaces` begrenset til disse. Opplastingsslipp ligger i **høyre kolonne** rett under «Søk i sider».

Alternativt 70/30-oppsett for andre dokumentvisninger: **`ModuleDocumentsHubLayout`** med valgfri `top`-stripe (`DocumentFolderJobsStrip`), `ModuleMainAside` **`cardWrap={false}`**, og `ModuleRecordsTableShell` med **`wrapInCard={false}`** i hovedkolonnen.

---

## 0. Prime directive

**Every module page looks and behaves the same way.** If a new module needs a shape that no existing module uses, stop and either (a) reuse an existing primitive, or (b) propose a new primitive for all modules — do not one-off the layout.

---

## 1. Page chrome — always `ModulePageShell`

Every route page (hub, detail, admin) renders inside a `ModulePageShell`.

```tsx
<ModulePageShell
  breadcrumb={[{ label: 'HMS' }, { label: 'Modulnavn' }]}
  title="Modulnavn"
  description="…compliance-anchored one-liner…"
  tabs={tabsNode}           // optional
  headerActions={actions}   // optional
>
  {body}
</ModulePageShell>
```

Rules:

1. **Never** wrap a module page in another `<div className="min-h-screen bg-[#F9F7F2]">` or `<div className="max-w-[1400px] …">` — that chrome is the shell's job. If you find a page doing this, migrate it to `ModulePageShell`.
2. **Never** render two `ModulePageShell`s in one view (no double page chrome). If a parent route and a child component both render a shell, make the child accept `bodyOnly` / `embedded` and render only the body content when the parent owns the shell.
3. Exactly one `h1`/`heading` per page — supplied by the shell's `title` prop. Do not put a second "Section heading"-style block directly under it.
4. Description is **compliance-anchored**: name the lovverk / forskrift relevant to the module when there is one (e.g. "Planlegg, gjennomfør og signer vernerunder i henhold til Internkontrollforskriften § 5.").
5. On list/hub pages, breadcrumb is `[{ label: 'HMS' | 'Samarbeid' | … }, { label: 'Modulnavn' }]` — two levels. On detail pages add the record's title as a third level, linking the second level back to the list.

**Dokumenter — TipTap reference editor:** `/documents/page/:pageId/reference-edit` is a child of `DocumentsModuleShellLayout` (same outer chrome as `/documents/editor-test`). Wiki space / page view / block editor stay under `DocumentsWikiOutlet` with their own shells.

---

## 2. Hub / settings pattern — root-tab model (canonical)

A module that has both a "list/overview" surface and admin/settings uses a single `ModulePageShell` with a root-tab strip (`Oversikt` / `Innstillinger`) shared across both. The shell's chrome (title, breadcrumb, description) stays stable when the user toggles between root tabs — no double heading, no duplicate back-button when admin is open.

### Files involved

- `src/pages/<Module>Page.tsx` (or `<Module>HubPage.tsx`) — **orchestrator**. Thin route wrapper. Holds the `[rootTab, setRootTab]` state, renders the shared `ModulePageShell` when `innstillinger` is active, and delegates to the hub component when `oversikt` is active.
- `modules/<module>/<Module>View.tsx` — **hub component**. Owns the list table, KPI row, create modals, etc. Accepts `{ tabs, bodyOnly, hideAdminNav }` props so the orchestrator can render it bodies-only under a shared shell.
- `src/pages/<Module>AdminPage.tsx` — **admin component**. Accepts `{ embedded }` prop. When embedded, renders only the tab strip + body (no shell, no back button).

### Hub component signature

```tsx
export function FooModuleView({
  supabase,
  tabs,
  bodyOnly = false,
  hideAdminNav = false,
}: {
  supabase: SupabaseClient | null
  /** Optional tabs row passed to `ModulePageShell.tabs`. */
  tabs?: ReactNode
  /** When true, skip the shell and render the body only. */
  bodyOnly?: boolean
  /** When true, hide the duplicate "Innstillinger" header button. */
  hideAdminNav?: boolean
}) {
  // … compute headerActions, body …

  if (bodyOnly) return <>{body}</>

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Foo' }]}
      title="Foo"
      description="…"
      tabs={tabs}
      headerActions={headerActions}
    >
      {body}
    </ModulePageShell>
  )
}
```

### Admin component signature

```tsx
export function FooAdminPage({ embedded = false }: { embedded?: boolean } = {}) {
  // … compute tabsNode, body …

  if (!canManage) {
    const accessBody = <WarningBox>…</WarningBox>
    if (embedded) return accessBody
    return <ModulePageShell …>{accessBody}</ModulePageShell>
  }

  if (embedded) {
    return (
      <div className="space-y-6">
        {tabsNode}
        {body}
      </div>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Foo', to: '/foo' }, { label: 'Innstillinger' }]}
      title="Foo — innstillinger"
      description="…"
      headerActions={<Button … onClick={() => navigate('/foo')}>Tilbake til Foo</Button>}
      tabs={tabsNode}
    >
      {body}
    </ModulePageShell>
  )
}
```

### Orchestrator (route wrapper)

```tsx
export function FooHubPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('foo.manage')
  const [rootTab, setRootTab] = useState<'oversikt' | 'innstillinger'>('oversikt')

  const rootTabItems = useMemo(() => {
    const items = [{ id: 'oversikt', label: 'Oversikt', icon: ClipboardList }]
    if (canManage) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManage])

  const activeRootTab = rootTab === 'innstillinger' && !canManage ? 'oversikt' : rootTab

  const rootTabsNode = rootTabItems.length > 1 ? (
    <Tabs items={rootTabItems} activeId={activeRootTab} onChange={(id) => setRootTab(id as any)} />
  ) : undefined

  if (activeRootTab === 'innstillinger' && canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Foo' }]}
        title="Foo"
        description="Konfigurer … for Foo."
        tabs={rootTabsNode}
        headerActions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/foo')}>
            Ny foo
          </Button>
        }
      >
        <FooAdminPage embedded />
      </ModulePageShell>
    )
  }

  return <FooModuleView supabase={supabase} hideAdminNav={canManage} tabs={rootTabsNode} />
}
```

### Back-compat

Keep the legacy `/foo/admin` route pointing at the non-embedded `FooAdminPage` so existing deep links resolve. The orchestrator lives at `/foo` only.

### Sidebar dedupe

Once a module is on this pattern, the top-level sidebar entry for the module should have **`subs: []`**. Do not duplicate `Oversikt` / `Innstillinger` in the sidebar — the in-page root-tab strip is the canonical nav. See `src/components/layout/AticsShell.tsx`.

Keep subs only when the sub-entries point at genuinely distinct destinations (different datasets, different workflows, not just tabs of the same page).

---

## 3. Hub page — primary CTA placement (strict)

**The primary "Ny X" / "Nytt X" button belongs in `headerActions` of the page-level `ModulePageShell`. Never inside the table's own `headerActions`.**

This is the single most violated rule. Every hub must look like this:

```tsx
const headerActions = (
  <div className="flex flex-wrap items-center gap-2">
    {/* Secondary actions first (left) */}
    <Button variant="secondary" onClick={() => setScheduleOpen(true)}>Planlegging</Button>

    {/* Admin-nav button is suppressed when root tabs are active */}
    {!hideAdminNav && canManage && (
      <Button variant="secondary" icon={<Settings className="h-4 w-4" />} onClick={() => navigate('/foo/admin')}>
        <span className="hidden sm:inline">Innstillinger</span>
      </Button>
    )}

    {/* Primary action always last (right) */}
    <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
      Ny foo
    </Button>
  </div>
)
```

Order left-to-right: **secondary actions → admin nav → primary create.**

Table-level `headerActions` may exist but must never contain the primary "Ny …" button. Reserve table-level actions for things genuinely scoped to the table (refresh, column visibility, filters the toolbar doesn't cover). Most hubs leave it empty.

### Primary-button rules

- `variant="primary"` always.
- `icon={<Plus className="h-4 w-4" />}` always.
- Label is "Ny X" or "Nytt X" in Norwegian, matching the record noun's gender — "Ny analyse", "Ny vernerunde", "Ny inspeksjonsrunde", "Nytt møte", "Nytt valg".
- Only render when `canManage` is true (permission gate). Never show a disabled "Ny …" button.

---

## 4. Hub page — body layout

Canonical body for a hub:

```tsx
const body = (
  <>
    {error ? <WarningBox>{error}</WarningBox> : null}

    <ModuleRecordsTableShell
      kpiItems={kpiItems}              // 4 KPI tiles, always
      title="…list heading…"
      description="…one-liner…"
      toolbar={<SearchInput … />}       // search on the left, flex-1
    >
      <table …>…</table>
    </ModuleRecordsTableShell>

    {/* Optional create modal(s) below */}
  </>
)
```

Rules:

1. Surface module errors at the **top of the body** via `<WarningBox>…</WarningBox>`. Never inside a table header as a red `<span className="text-xs text-red-600">…</span>` — that pattern is forbidden.
2. KPI tiles are always exactly **four**. Pick meaningful values; do not pad. The canonical shapes are `{ big: string; title: string; sub: string }`.
3. Table uses `ModuleRecordsTableShell` (not raw `LayoutTable1PostingsShell` unless the module predates the migration and we haven't migrated it yet). New modules must use `ModuleRecordsTableShell`.
4. Table header cells use `MODULE_TABLE_TH`; body rows use `MODULE_TABLE_TR_BODY`. No bespoke Tailwind in the table header.
5. Search box on the left of `toolbar`, relative-positioned with `<Search>` icon absolutely positioned at `left-3 top-1/2 -translate-y-1/2`. Input uses `StandardInput`, `type="search"`, `placeholder="Søk i …"`, `className="py-2 pl-10"`.

---

## 5. Detail page — tab layout

Canonical detail page shape:

```tsx
<ModulePageShell
  breadcrumb={[
    { label: 'HMS' },
    { label: 'Foo', to: '/foo' },
    { label: record.title },
  ]}
  title={record.title}
  description={record.description}
  headerActions={<Badge variant={statusBadgeVariant(record.status)}>{STATUS_LABEL[record.status]}</Badge>}
  tabs={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as DetailTab)} />}
>
  <ModuleLegalBanner title="Foo" references={[…]} />

  {activeTab === 'informasjon' && (
    <ModuleSectionCard>
      <RecordInformationCard record={record} … />
    </ModuleSectionCard>
  )}

  {activeTab === 'sjekkliste' && (
    <ModuleSectionCard>…</ModuleSectionCard>
  )}

  {activeTab === 'signaturer' && (
    <>
      <ModulePreflightChecklist items={…} />
      <ModuleSignatureCard role="leder" signature={…} onSign={…} />
      <ModuleSignatureCard role="verneombud" signature={…} onSign={…} />
    </>
  )}
</ModulePageShell>
```

Rules:

### 5.1 First tab

The first tab of every detail page is **`informasjon` / "Informasjon"** — no exceptions. Do **not** use domain-specific names like "Planlegging", "Grunnlag", "Scope" as the first tab. The tab renders a `ModuleInformationCard` showing the record's metadata/form fields.

### 5.2 Tab body wrapping (card ownership)

**The page owns the card, not the tab component.** Each `{activeTab === 'x' && ...}` block wraps its child in `<ModuleSectionCard>` at the page level. Tab components receive `withCard={false}` on their inner `ModuleInformationCard` / equivalent, so the wrapping card is the page's, not the component's.

```tsx
{activeTab === 'informasjon' && (
  <ModuleSectionCard>
    <RecordInformationCard record={record} /* passes withCard={false} internally */ />
  </ModuleSectionCard>
)}
```

Why: this guarantees every tab body has the same outer visual treatment (border, radius, shadow, padding) regardless of what the inner component does. Tab components therefore never contain a top-level card themselves.

### 5.3 Header actions on detail pages

Detail-page `headerActions` is usually **just the status `Badge`**. Do **not** put an "Admin" / "Innstillinger" button on a detail page — the breadcrumb already links back to the list, and the root-tab strip on the list handles admin navigation.

### 5.4 Legal banner (regelverk)

The first element inside the shell body is `<ModuleLegalBanner title="…" intro={…} references={[…]} />` on pages where the lovverk / forskrift is core to the module (ROS, Inspection, VR, SJA, dokumenter). The banner is a light mint panel with white inner cards (one per `references` item). The user can close it with **X**; a **Regelverk** toggle in the page header (from `ModulePageShell`) shows it again for the browser session (`sessionStorage`).

### 5.5 Signatures tab

Use `ModulePreflightChecklist` above the signature cards to show the conditions that must be true for signing. Use one `ModuleSignatureCard` per signing role (Leder, Verneombud, etc.). Do not build signature cards with raw divs + Tailwind.

### 5.6 Critical-finding banners etc.

If a tab needs to surface a critical condition ("⛔ STOPPET — N farekilder i rød sone"), put it inside the tab body above the table, using `<WarningBox>` styled with `font-bold`. Do not invent a new component for this.

---

## 6. Admin page — canonical tab order

All admin pages use the following canonical tab order. Render only the tabs the module actually has — do not fabricate empty tabs.

```
Generelt · Maler · Lokasjoner · Kategorier · Signaturer · Tilgang · Arbeidsflyt · Statistikk
```

Tab icons (from `lucide-react`):

- Generelt: `SlidersHorizontal`
- Maler: `ClipboardList`
- Lokasjoner: `MapPin`
- Kategorier: `Tags`
- Signaturer: `UserCheck`
- Tilgang: `Shield`
- Arbeidsflyt: `GitBranch`
- Statistikk: `BarChart2`

Use `<Tabs items={…} activeId={…} onChange={…} overflow="scroll" />` on admin pages so the strip gracefully overflows on narrow screens.

### Admin body

Wrap the tab body in a single `ModuleSectionCard className="p-5 md:p-6"` when the tab renders a form, **or** leave it unwrapped when the tab renders a table with its own `ModuleRecordsTableShell`. Do not double-wrap a table in `ModuleSectionCard`.

---

## 7. Form controls — no raw HTML

**Forbidden** in module code:

- `<input type="…" className="…" />`
- `<select className="…">…</select>`
- `<textarea className="…" />`
- `<button className="…">…</button>`

**Required** replacements:

- `StandardInput` (`src/components/ui/Input.tsx`) for text/date/search/number inputs.
- `StandardTextarea` (`src/components/ui/Textarea.tsx`) for multi-line.
- `SearchableSelect` (`src/components/ui/SearchableSelect.tsx`) for dropdowns.
- `Button` (`src/components/ui/Button.tsx`) with `variant` of `primary | secondary | ghost | danger | icon`, and optional `icon={<Lucide… className="h-4 w-4" />}` prop. Never pass a bespoke `className` to replace variant styles. Sizing uses the `size` prop (`sm | md | lg | icon`).
- `WarningBox` / `InfoBox` (`src/components/ui/AlertBox.tsx`) for alerts — never a raw `<div className="bg-yellow-…">`.

Bare `<input type="checkbox">` is acceptable only for grid-dense controls where a full control would break layout. Such inputs must carry `aria-label`.

### Form rows

Form rows use the layout constants from `src/components/layout/WorkplaceStandardFormPanel`:

```tsx
<div className={WPSTD_FORM_ROW_GRID}>
  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="foo">Navn</label>
  <StandardInput id="foo" value={…} onChange={…} />
</div>
```

Or, preferably, use `ModuleInformationCard` with a `rows` array — every form inside an information-tab should be a `ModuleInformationCard`, not hand-rolled rows.

---

## 8. Severity & risk

Use the shared helpers from `src/components/module/moduleRiskKit.ts` — `ModuleSeverity`, `moduleSeverityLabel`, `moduleSeverityBadgeVariant`, `moduleSeverityRowClass`, `moduleSeverityFromScore`, `moduleRiskScoreBadgeVariant`, `moduleRiskScoreLabel`. Do not inline a severity-to-color mapping in a module file; register new severities in the kit.

---

## 9. Layout 70/30 where applicable

For frontpages and detail views with a primary area + a contextual aside, use `ModuleMainAside` (thin wrapper around `WorkplaceSplit7030Layout`). Do not hand-roll flex/grid 70/30 layouts.

---

## 10. Permissions

- Every page that gates write access computes `const canManage = isAdmin || can('<module>.manage')`.
- Permission keys live in `src/lib/permissionKeys.ts`. Register new keys there; do not inline string constants.
- Never render a disabled primary CTA to users without the permission — hide the button entirely.
- Within root-tab orchestrators, `Innstillinger` only appears as a root tab when `canManage === true`.

---

## 11. Sidebar (`AticsShell`)

- Modules live inside one of the seven canonical groups:
  1. Risiko & Sikkerhet
  2. Hendelser & Varsling
  3. Internkontroll
  4. Arbeidsmiljø & AMU
  5. Dokumentasjon
  6. Opplæring & Kompetanse
  7. Organisasjon & HR
  Any module not yet assigned goes to the "Gamle moduler" / old group.
- Each module entry has `subs: []` **when the module uses the root-tab model** (Oversikt / Innstillinger live inside the page). Keep sub-entries only when they point at genuinely distinct destinations.
- Top-level label is the **module name in Norwegian, title-case**, not "Foo (Council)" or "Foo Module". Examples: `AMU`, `Vernerunder`, `Inspeksjonsrunder`, `Sikker Jobbanalyse`, `ROS-analyser`, `AMU-valg`.

---

## 12. Typography & spacing tokens (do not improvise)

- Page background: `bg-[#F9F7F2]` — applied by `ModulePageShell`. Never by a module.
- Max content width: `max-w-[1400px]` — applied by `ModulePageShell`. Never by a module.
- Card: `rounded-xl border border-neutral-200/80 bg-white shadow-sm` (= `ModuleSectionCard`).
- Headings inside a section card: `text-sm font-semibold text-neutral-900` for sub-headings. The page `h1` is handled by the shell.
- Body copy: `text-sm text-neutral-600` (prose), `text-sm text-neutral-800` (dense tables).
- Tiny meta/helper: `text-xs text-neutral-500`.
- Compliance / IK copy: use `ComplianceBanner` for compact callouts; use `ModuleLegalBanner` for the mint regelverkspanel — do not recreate with raw Tailwind.

---

## 13. Before you ship

Checklist — run through this for every module PR:

- [ ] Page renders inside exactly one `ModulePageShell`.
- [ ] Primary "Ny …" CTA is in `ModulePageShell.headerActions`, not in a table header.
- [ ] Errors surface as `<WarningBox>` at the top of the body, not as inline red text.
- [ ] Hub is on the root-tab model (Oversikt / Innstillinger); admin has `embedded` prop; view has `bodyOnly` + `hideAdminNav` props.
- [ ] First detail-page tab is `informasjon` / "Informasjon".
- [ ] Each detail-page tab body is wrapped in `<ModuleSectionCard>` at the page level; inner components pass `withCard={false}`.
- [ ] Detail page header has the status `Badge` only — no "Admin" button.
- [ ] Admin tabs follow canonical order (Generelt · Maler · Lokasjoner · Kategorier · Signaturer · Tilgang · Arbeidsflyt · Statistikk).
- [ ] No raw `<input>`, `<select>`, `<textarea>`, or `<button className=…>` in the module.
- [ ] Sidebar entry has `subs: []` (unless subs point at distinct destinations).
- [ ] Legacy `/module/admin` route still resolves (back-compat).
- [ ] `npm run build` and `npx tsc -b --noEmit` are clean.

---

## 14. How to apply this to a new or drifted module

1. **Identify the role** of the file (hub, detail, admin, route wrapper).
2. **Find the closest already-aligned module** (ROS or Inspeksjonsrunder are the canonical references) and read its current code.
3. **Copy the shape** (`headerActions`, `body`, `bodyOnly` / `embedded` props) — never hand-invent.
4. **Reuse primitives** from `src/components/module/*` and `src/components/ui/*`. If a pattern repeats ≥3 times across modules, extract it to a new primitive rather than duplicating.
5. **Run `npx tsc -b --noEmit` and `npm run build`** after every small change. Do not batch multiple unrelated fixes in a single commit.
6. **Update `src/components/layout/AticsShell.tsx`** to drop duplicate subs once the module is on the root-tab model.
7. **Keep back-compat**: legacy `/module/admin` stays alive as a non-embedded shell until all internal links are migrated.

---

## 15. Explicit anti-patterns (copy-paste bait)

These show up repeatedly when LLMs or humans don't know the rules. Reject them.

- Primary CTA placed inside `LayoutTable1PostingsShell.headerActions` — **move it to `ModulePageShell.headerActions`**.
- Error surfaced as `<span className="text-xs text-red-600">{error}</span>` inside a table header — **replace with top-of-body `<WarningBox>`**.
- First detail tab named `Planlegging`, `Grunnlag`, `Scope`, `Omfang` — **rename to `informasjon` / "Informasjon"**.
- "Admin" button on the detail page header — **delete it; breadcrumb + root tab handle this**.
- Second `<div className="min-h-screen bg-[#F9F7F2]">` wrapper around the shell — **delete it**.
- A detail-page tab component that owns its own `ModuleSectionCard` — **page owns the card; tab component passes `withCard={false}`**.
- Duplicate `Oversikt` / `Innstillinger` sub-entries in the sidebar for modules on the root-tab model — **set `subs: []`**.
- Raw HTML form controls (`<input>`, `<select>`, `<textarea>`, `<button className=…>`) — **use `StandardInput`, `SearchableSelect`, `StandardTextarea`, `Button`**.
- Ad-hoc severity-to-color maps inside a module — **use `moduleRiskKit`**.
- Module file containing its own Tailwind page background / max-width — **let `ModulePageShell` do that**.

---

*This document is the source of truth. If you propose a deviation, justify it in the PR and update this document in the same commit.*
