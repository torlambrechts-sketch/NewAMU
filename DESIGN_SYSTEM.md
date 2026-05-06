# AI INSTRUCTION SET — NEWAMU MODULE GENERATION

**Role:** Expert React, TypeScript, Tailwind CSS, and Supabase developer.
**Mission:** Build feature modules for the NewAMU / Klarert platform that are visually identical to the Survey and Documents modules. **Do not invent UI patterns.** **Do not use raw HTML for interactive elements.** Every spacing, typography and button decision below is taken from the working Survey and Documents implementations — the same conventions must apply to every new or refactored module (e-learning is the current target).

This file is the single source of truth for UI. Companion docs:

- `docs/UI_PLACEMENT_RULES.md` — module shells, hub layouts, and primitive locations.
- `docs/UI_DESIGN_RULES.md` — `WorkplacePageHeading1` action ordering.

---

## 1. Architecture & database (Supabase)

- Migrations live in `supabase/migrations/` (root); historical chain in `supabase/migrations/archive/`.
- Core tables MUST have audit-log triggers.
- **RLS:** every table enforces isolation by `organization_id`. Insert trigger pattern:
  ```sql
  create or replace function public.[table]_before_insert()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if new.organization_id is null then
      new.organization_id := public.current_org_id();
    end if;
    return new;
  end;
  $$;
  ```
- Immutable rule — block updates to signed/archived rows: `using (status not in ('signed', 'archived', 'approved'))`.

## 2. State, hooks & permissions

- Hook lives at `modules/[module_name]/use[ModuleName].ts`. UI components do **not** fetch directly.
- Always include `isAdmin` so the global admin is not locked out:
  ```tsx
  const { organization, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('[module].manage')
  ```
- Errors come back through `getSupabaseErrorMessage(err)` and render as `<WarningBox>` at the **top of the body** — never as inline red `<p>` text.

---

## 3. UI primitive library — strict component list

You are FORBIDDEN from copy-pasting Tailwind for inputs, buttons, or selects. Use these primitives:

| Element | Component | Path | Notes |
|---|---|---|---|
| Page chrome | `<ModulePageShell>` | `src/components/module` | Owns `bg-[#F9F7F2]` + `max-w-[1400px]` + breadcrumb + h1. Never wrap a module in a second `min-h-screen` div. |
| Section card | `<ModuleSectionCard>` | `src/components/module` | White surface, rounded-xl, border, soft shadow. Default padding ~`p-5` — **for new content always pass `className="p-5 md:p-6"`** to make it explicit and scale up on `md+`. |
| KPI tile row | `<LayoutScoreStatRow>` | `src/components/layout/LayoutScoreStatRow` | 4 tiles canonical (3 acceptable). |
| Records table shell | `<ModuleRecordsTableShell>` | `src/components/module` | KPI row + table wrapper. Pass `wrapInCard={false}` when the parent already owns a `ModuleSectionCard`. |
| Slide-out panel | `<SlidePanel>` | `src/components/layout/SlidePanel` | Right-aligned overlay for create/edit forms (Ny X). Exposes `title`, `footer`. |
| Buttons | `<Button>` | `src/components/ui/Button` | See §5. |
| Text inputs | `<StandardInput>` | `src/components/ui/Input` | Replaces `<input type="text">`. |
| Multi-line | `<StandardTextarea>` | `src/components/ui/Textarea` | Replaces `<textarea>`. |
| Dropdowns | `<SearchableSelect>` | `src/components/ui/SearchableSelect` | Replaces `<select>`. |
| Status pills | `<Badge>` | `src/components/ui/Badge` | `variant="active|draft|info|success|warning|danger|neutral|signed|critical"`. |
| Tabs | `<Tabs>` | `src/components/ui/Tabs` | Replaces `HubMenu1Bar`. |
| Alerts | `<WarningBox>` / `<InfoBox>` | `src/components/ui/AlertBox` | Top of body for errors / hints. |
| Compliance / regelverk | `<ComplianceBanner>` (compact) / `<ModuleLegalBanner>` (full) | `src/components/ui/ComplianceBanner` and `src/components/module/ModuleLegalBanner` | `<ModuleLegalBanner>` automatically registers a Regelverk on/off toggle in the page header. |
| Yes/No, on/off | `<YesNoToggle>` / `<ToggleSwitch>` | `src/components/ui/FormToggles` | Replaces checkboxes. |

If a pattern is not covered, **propose a new primitive** in `src/components/module/` or `src/components/[module]/` — never one-off Tailwind.

---

## 4. Layout & visual tokens

Page-level:

- Background: `bg-[#F9F7F2]` (provided by `ModulePageShell`).
- Max width: `max-w-[1400px]` (provided by `ModulePageShell`).
- Brand: forest green `#1a3d32`. Mint accent `#e7efe9`. Beige nav `#EDE4D3` (BEIGE_NAV).
- Page body siblings of header: `space-y-6`.

Module heading:

```tsx
<ModulePageShell
  breadcrumb={[{ label: 'HMS' }, { label: 'Modulnavn' }]}
  title="Modulnavn"
  description="…compliance-anchored one-liner…"
  headerActions={<Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny X</Button>}
  tabs={<Tabs items={tabItems} activeId={tab} onChange={setTab} />}
>
  {body}
</ModulePageShell>
```

Severity borders (lists of risks/deviations) use `border-l-4` with these colours: critical `border-l-red-500 bg-red-50/30`, high `border-l-orange-400 bg-orange-50/20`, medium `border-l-yellow-400`, low `border-l-blue-300`.

---

## 5. Buttons (canonical, copied from Survey + Documents)

`src/components/ui/Button.tsx` exposes `variant` and `size`. Use the **default** size for primary CTAs in headers and form footers; use `size="sm"` only inside compact toolbars or dense list rows.

| Use | Variant | Size | Icon |
|---|---|---|---|
| Primary "Ny X" CTA in `ModulePageShell.headerActions` | `primary` | _default_ | `<Plus className="h-4 w-4" />` |
| Primary submit at bottom of card / panel | `primary` | _default_ | task-specific (`Save`, `Plus`, …, `h-4 w-4`) |
| Toolbar primary inside a card / table shell | `primary` | `sm` | `h-4 w-4` |
| Secondary action (Avbryt, Filter, Importer alt) | `secondary` | _default_ (or `sm` in toolbars) | `h-4 w-4` (or `h-3.5 w-3.5` for `sm`) |
| Compact CTA in cream nav aside | `secondary` | `sm` | `h-4 w-4` |
| Destructive (Slett kurs / Slett seksjon) | `danger` (in headers) **or** `ghost` + `className="text-red-600 hover:bg-red-50 hover:text-red-700"` (inline list rows) | _default_ for headers, `sm` inline | `<Trash2 className="h-4 w-4" />` (sm: `h-3.5 w-3.5`) |
| Icon-only row action (drag, rename) | `ghost` | `icon` (override `className="h-7 w-7"`) | `h-3.5 w-3.5` |
| Ghost link-style action inside a list row | `ghost` | `sm` | `h-3.5 w-3.5` |

Examples (verbatim shapes — copy these):

```tsx
// Header CTA — modules/survey/SurveyPage.tsx
<Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny undersøkelse</Button>

// Toolbar primary inside a section card — modules/survey/SurveySectionBuilder.tsx
<Button variant="primary" size="sm">
  <Plus className="h-4 w-4" /> Nytt spørsmål
</Button>

// Slide-panel footer — order: Avbryt → Lagre, primary always last
<div className="flex w-full flex-wrap items-center justify-end gap-2">
  <Button variant="secondary" onClick={close}>Avbryt</Button>
  <Button variant="primary" onClick={save}>Lagre</Button>
</div>

// Destructive at the bottom of a slide-panel body
<Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50 hover:text-red-700">
  Slett seksjon
</Button>
```

**Never** override variant colour with inline `style={{ backgroundColor: PIN_GREEN }}` — `variant="primary"` already paints brand green.

---

## 6. Form fields & spacing

Labels always use `WPSTD_FORM_FIELD_LABEL` from `src/components/layout/WorkplaceStandardFormPanel`:

```tsx
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

<div>
  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="x-name">Navn</label>
  <StandardInput id="x-name" value={…} onChange={…} className="mt-1.5" />
  <p className="mt-1 text-xs text-neutral-500">Hjelpetekst.</p>
</div>
```

Spacing rules:

| Context | Token |
|---|---|
| Page body — siblings of header (multi-card stack) | `space-y-6` |
| Inside `ModuleSectionCard` body — plain stacked form | `space-y-4` (short forms) or `space-y-5` (long forms) |
| Inside `ModuleSectionCard` body — `WPSTD_FORM_ROW_GRID` rows | `space-y-8` |
| `SlidePanel` body — long create form | `space-y-5` |
| `SlidePanel` body — short edit form | `space-y-4` |
| Aside column with multiple section cards | `space-y-4` |
| Tight nav row group | `space-y-0.5` |
| Sub-divider section after toggle | `space-y-3 border-t border-neutral-100 pt-3` |
| Compact mini-list inside a card | `mt-3 space-y-2` |
| Toolbar / action row inside card body | `mt-3 flex flex-wrap gap-2` |
| Label → input | input gets `className="mt-1.5"` |
| Label → helper paragraph | `mt-1 text-xs text-neutral-500` |
| Heading → first body block | `mt-4` (lists) / `mt-5` (forms) / `mt-6` (form stacks with WPSTD grid) |

---

## 7. ModuleSectionCard internal layout

```tsx
<ModuleSectionCard className="p-5 md:p-6">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <GitBranch className="h-5 w-5 text-[#1a3d32]" />
      <h2 className="text-lg font-semibold text-neutral-900">Section title</h2>
    </div>
    <span className="text-xs text-neutral-500">Optional meta</span>
  </div>
  <p className="mt-1.5 text-sm text-neutral-600">Description.</p>

  <div className="mt-5 space-y-5">{/* form rows or sub-content */}</div>

  <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
    <Button variant="primary">Lagre</Button>
  </div>
</ModuleSectionCard>
```

Heading typography:

- Card heading (h2): `text-lg font-semibold text-neutral-900` — **sans, not serif**. Serif is reserved for the page-level h1 (provided by `ModulePageShell` / `WorkplacePageHeading1`).
- Sub-heading (h3): `text-sm font-semibold text-neutral-900` (sometimes `mb-4 border-b border-neutral-100 pb-2` for editor-style sub-cards).

Banded card (Documents settings convention) for a card that owns its own header strip + footer band:

```tsx
<ModuleSectionCard className="overflow-hidden p-0">
  <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
    <h2 className="text-base font-semibold text-neutral-900">Title</h2>
    <p className="mt-0.5 text-sm text-neutral-500">Subtitle</p>
  </div>
  <div className="p-5 space-y-4">{body}</div>
  <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
    <Button variant="primary">Lagre</Button>
  </div>
</ModuleSectionCard>
```

---

## 8. Inner boxes — list items inside a card

When a card lists items (e.g. a list of paths, system courses, exports), every list item is its own padded box:

```tsx
<ul className="mt-5 space-y-3">
  {items.map((it) => (
    <li
      key={it.id}
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
    >
      {/* content */}
    </li>
  ))}
</ul>
```

Mandatory tokens — **do not deviate**:

- Border: `border-neutral-200/80` (not `border-neutral-200`)
- Background: `bg-neutral-50/50` (not `bg-neutral-50/40`, not `bg-white`)
- Padding: `p-4` (16px). **Never `p-3` or `px-3 py-3`.**
- Vertical spacing between items: `space-y-3`
- Internal title→meta: `mt-0.5`, title→description: `mt-2`, title→action button row: separator `border-t border-neutral-200/80 pt-3`

For a **white** inner box (nested in a banded card body), use `rounded-md border border-neutral-200/80 bg-white px-4 py-3`. Still **never** `px-3 py-2`.

For a `<dl>` reference grid (e.g. the GDPR personvern grid), each `<div>` follows the same `rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4` shape with `dt` (`text-[10px] font-bold uppercase tracking-wider text-neutral-600`) + `dd` (`mt-2 text-neutral-700`).

For a scrollable picker list (toggle-per-row inside a card):

```tsx
<ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3">
  {rows.map((r) => (
    <li className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-neutral-50">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{r.label}</span>
      <ToggleSwitch checked={…} onChange={…} label={r.label} />
    </li>
  ))}
</ul>
```

---

## 9. Tables

Always use the canonical constants — never re-declare a local `TABLE_TH` / `TABLE_TR_BODY`:

```tsx
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY, ModuleRecordsTableShell } from '../../components/module'
```

Cell padding: header `MODULE_TABLE_TH` already sets it; body cells use `px-5 py-3` (compact builder rows) or `px-5 py-4 align-middle` (standard hub list rows).

Table inside a section card:

```tsx
<ModuleSectionCard className="!p-0">
  <ModuleRecordsTableShell
    wrapInCard={false}
    title="…"
    titleTypography="sans"
    toolbar={<…/>}
    footer={<span>{n} treff</span>}
  >
    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
      <thead className="bg-neutral-50/60">
        <tr><th className={MODULE_TABLE_TH}>Col</th>…</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
            <td className="px-5 py-3 font-medium text-neutral-900">{r.title}</td>
            …
          </tr>
        ))}
      </tbody>
    </table>
  </ModuleRecordsTableShell>
</ModuleSectionCard>
```

---

## 10. SlidePanel (Ny X form)

```tsx
<SlidePanel
  open={open}
  onClose={close}
  titleId="my-panel-title"
  title={editing ? 'Rediger X' : 'Ny X'}
  footer={
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" onClick={close}>Avbryt</Button>
      <Button variant="primary" onClick={save} disabled={!title.trim()}>Lagre</Button>
    </div>
  }
>
  <div className="space-y-5"> {/* space-y-4 for short edit panels */}
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="x-title">Tittel</label>
      <StandardInput id="x-title" value={title} onChange={(e) => setTitle(e.target.value)} />
    </div>
    {/* … */}
    {editing ? (
      <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove}>
        Slett
      </Button>
    ) : null}
  </div>
</SlidePanel>
```

---

## 11. Two-column layouts

| Use | Pattern |
|---|---|
| Two side-by-side ModuleSectionCards (e.g. Pathos / External: form + list) | `grid gap-6 lg:grid-cols-2` |
| Asymmetric main + aside inside a card or detail editor | `grid gap-6 lg:grid-cols-[1fr_320px]` (each column owns its own stack of `ModuleSectionCard`s with `space-y-4`) |
| Section-builder shell (left nav + right pane in one outer card) | `grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm lg:grid-cols-[minmax(200px,22%)_1fr]` |

---

## 12. Status messages

| Type | Pattern |
|---|---|
| Error | `<WarningBox>` at top of body |
| Success ("Lagret") | inline emerald card: `mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700` with `<CheckCircle2 className="size-4 shrink-0" />` |
| Transient feedback | `<p className="mt-3 text-xs text-neutral-700" role="status">{msg}</p>` |
| Info / hints | `<InfoBox>` |
| Editor save state | `<Badge variant="signed">Lagret</Badge>` / `<Badge variant="draft">Ulagrede endringer</Badge>` |

---

## 13. Language

Norwegian (Bokmål) only. No English in user-facing copy. Vocabulary:

- Required → **Påkrevd**
- Draft / Active / Signed → **Kladd / Aktiv / Signert**
- Finding / Deviation → **Avvik**
- Cancel / Save / Delete → **Avbryt / Lagre / Slett**

---

## 14. Compliance copy (REGELVERK)

- Use `<ModuleLegalBanner title="…" intro={…} references={[…]} />` once at the top of the routed body. The `ModulePageShell` automatically renders the green Regelverk on/off switch in the header — no extra wiring needed. References are an array of `{ code, text }`.
- For compact callouts inside a card body, use `<ComplianceBanner title="…">…</ComplianceBanner>`.
- A module-specific `[module]LegalReferences.tsx` file holds the `ModuleLegalReference[]` constant.

---

## 15. Execution protocol (new module)

1. **DB:** migrations + RLS + audit triggers.
2. **Types & Zod:** `types.ts` + `*.schema.ts`.
3. **Hook:** `use[Module].ts` — enforce `canManage = isAdmin || can('[module].manage')`, surface errors via `getSupabaseErrorMessage`.
4. **Page chrome:** `ModulePageShell` with breadcrumb + title + Tabs.
5. **Section bodies:** every panel inside `<ModuleSectionCard className="p-5 md:p-6">`. Lists of items use `rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4`. Tables use `MODULE_TABLE_TH` / `MODULE_TABLE_TR_BODY`.
6. **Forms:** labels are `WPSTD_FORM_FIELD_LABEL`, inputs get `mt-1.5`, helper text `mt-1 text-xs text-neutral-500`. Stacks are `space-y-4` (short) or `space-y-5` (long).
7. **CTAs:** primary "Ny X" lives in `ModulePageShell.headerActions`; never inside a table header. Footer rows are `mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4`. Primary always last.
8. **Self-correction scan** — before submitting:
   - Any `<button className="…">`? Replace with `<Button>`.
   - Any `<input>` / `<select>` / `<textarea>` with raw classes? Replace with `StandardInput` / `SearchableSelect` / `StandardTextarea`.
   - Any `p-3` or `px-3 py-3` on a list-item card? Bump to `p-4`.
   - Any `border-neutral-200` (no `/80`) on a sub-box? Change to `border-neutral-200/80`.
   - Any `bg-neutral-50/40` on a list-item card? Change to `bg-neutral-50/50`.
   - Any inline red `<p className="… text-red-…">` for errors? Replace with `<WarningBox>`.
   - Any local `TABLE_TH` / `TABLE_TR_BODY` constants? Use the imports from `moduleTableKit`.
   - Any `style={{ backgroundColor: '#1a3d32' }}` on a `Button`? Drop it — `variant="primary"` already paints brand green.
   - Any `font-serif` h2 inside a `ModuleSectionCard`? Drop it — h2 in cards is sans.

Run `npx tsc -b` and `npx eslint` before committing.

---

## 16. Reference modules (good)

- `modules/survey/*` — section builder, distribution, settings (`SurveySettingsGenerelt.tsx`).
- `src/pages/documents/*` and `src/components/documents/settings/*` — banded cards, form panels, JSON import/export pattern.
- `src/components/learning/LearningSectionBuilder.tsx` — applies the survey shell to e-learning.

If a new module diverges from these references, change the module — not the rules.
