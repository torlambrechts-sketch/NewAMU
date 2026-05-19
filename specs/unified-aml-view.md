# Unified Arbeidsmiljøloven view — design + gap-closure plan

How we copy what VComply, Workiva, MetricStream, Netwrix, Onspring and
Resolver do for compliance/internkontroll, and turn our scattered
surfaces (`/overview/internkontroll`, `/compliance/checklists`,
`/overview/regelverk`, per-module analyse pages) into **one canonical
"hvor står vi med AML?" landing**. Successor to and extension of
`specs/compliance-planner.md`.

Same multi-perspective team as the VComply / GRC reviews:
senior dev (codebase mapping + feasibility) · UX designer (interaction
patterns + Norwegian-SMB readability) · entrepreneur (sales wedge +
tilsyn-readiness positioning).

---

## TL;DR

Internkontroll Phase 2+3 already shipped the **data backbone** for the
unified view — `gap_matrix`, `framework_coverage`,
`recent_evidence`, `plan_items_by_status` datasets are live; the
ParagraphInspectorPanel, plan items, and auditor token mechanics
all exist. What's missing is the **landing IA + a few surfaces** that
vendors prove are essential:

1. A canonical `/overview/aml` home that **leads with one number**
   (tilsyn-readiness score, MetricStream pattern) and **a framework
   badge wall** (Onspring pattern) before any tabs.
2. A real per-§ **deep page** (not just the slide-over) — answers
   *"what touches §4-3 across all modules?"* in one URL.
3. An **evidence ledger** (compliance-planner §5.4 — designed,
   never built).
4. An **årshjul overlay** so the per-§ view shows recurrence.
5. A **tilsyn-readiness pre-flight** before minting the auditor token.

Close in one sprint cycle. ~3 weeks of dev. No greenfield infra
required — every dataset already exists.

---

## 1. The brief

When a Norwegian HMS-leder asks *"hvor står vi med Arbeidsmiljøloven?"*
they should land on one URL that answers:

- One number — are we tilsyn-ready right now?
- Which framework am I weakest on? (AML / IK-f / GDPR / Åpenhetsloven /
  ISO 45001)
- Which §§ are uncovered, and which §§ are over-engineered?
- What's coming up on the årshjul this month / quarter?
- Can I hand this to Arbeidstilsynet in one click?

Today the answer requires bouncing between `/overview/internkontroll`,
`/overview/regelverk`, the per-module analyse pages, and the
HMS-oversikt composite. The unified view collapses these into one
opinionated screen.

---

## 2. What we already have — don't rebuild

(From the codebase Explore — file:line refs verified.)

| Asset | Where | What it gives us |
|---|---|---|
| **Internkontroll dashboard** | `src/pages/overview/internkontroll/InternkontrollDashboardPage.tsx:17` | Locked system report with 5 datasets |
| **Gap matrix heatmap** | `src/pages/overview/internkontroll/InternkontrollGapPage.tsx:16` | Paragraphs × modules cell counts |
| **ParagraphInspectorPanel** | `src/components/internkontroll/ParagraphInspectorPanel.tsx` | Slide-over for per-§ coverage + plan items + evidence |
| **Plan items CRUD** | `src/components/internkontroll/CompliancePlanItemsSection.tsx:46` | Per-§ planlagte tiltak with status workflow |
| **Auditor token mint + verify** | `compliance_auditor_tokens` table; RPC `compliance_auditor_token_verify` | Signed-URL read-only auditor mode |
| **Public auditor view** | `src/pages/auditor/InternkontrollAuditorPage.tsx:30` | Unauthenticated view with frozen layout |
| **Datasets** | `modules/internkontroll/dashboards/useInternkontrollDatasets.ts` | `internkontroll_kpi_summary`, `framework_coverage`, `gap_matrix`, `recent_evidence`, `plan_items_by_status` |
| **5-framework taxonomy** | `modules/internkontroll/frameworkParagraphs.ts:FRAMEWORKS` | AML · IK-f · GDPR · Åpenhetsloven · ISO 45001 |
| **Per-§ artefact aggregation** | `useInternkontrollDatasets.ts` | Already unions compliance · survey · documents · registers · learning |
| **80+ AML §§ inventory** | `specs/aml-requirements-inventory.md` | Catalogued with per-module coverage status |
| **Regelverk-coverage report** | `src/pages/overview/regelverk/RegelverkCoveragePage.tsx:20` | Per-regulation deductible coverage |
| **Compliance-planner spec** | `specs/compliance-planner.md` | §5.4 evidence ledger, §5.5 KPI widget — designed, not shipped |

The data backbone is essentially **done**. What's missing is IA and
five UI surfaces.

---

## 3. Vendor patterns we're adopting (and rejecting)

Cross-vendor pattern → adoption decision. Adopt = port the pattern;
adapt = port with Norwegian-SMB modifications; skip = wrong for our
buyer.

| Pattern | Vendor source(s) | Decision | How |
|---|---|---|---|
| **One composite score on landing** | MetricStream (only one with named formula) | **Adopt** | "Tilsyn-readiness-score / 100", 4 inputs documented openly — see §5. **Avoid MetricStream's anti-pattern of a black-box pill.** |
| **Framework badge wall** (per-framework % with R.A.G. arrow) | Onspring NIST badge wall — cleanest in class | **Adopt** | 5 badges: AML · IK-f · GDPR · Åpenhetsloven · ISO 45001. Already have `framework_coverage` dataset. |
| **Heatmap as gap surface** (never flat list) | Resolver (live risk matrix), MetricStream (compliance snapshot), Onspring (heatmap), VComply | **Adopt** | Already shipped — keep `gap_matrix` as the centre. |
| **Tile grid + drill everywhere** | Universal across 5/6 | **Adopt** | Already the dashboard-engine model. |
| **Two-tier dashboard (Executive + Assurance)** | Resolver (explicit naming) | **Adapt** | Single page with a `?lens=` toggle — Lederlens / Vernerundlens / Tilsynlens — re-skins density and shows different widget mix. |
| **Per-control / per-§ deep page** | All six in different forms | **Adopt** | Replace slide-over with full-page `/overview/aml/§:law_ref` — see §7. Slide-over stays as a peek; deep page is canonical. |
| **PBC / evidence-request dashboard as separate surface** | Workiva, VComply, Resolver | **Defer** | Evidence ledger first (§8); request dashboard is a downstream feature. |
| **Workflow builder in marketing screenshot** | 5/6 — drag-and-drop builders | **Skip** | Already in Sprint D of `grc-feature-review.md`. Not part of this surface. |
| **Trend chart on landing** | Resolver, Netwrix, VComply, MetricStream | **Adopt** | 30-day line chart of tilsyn-readiness score below the badge wall. |
| **Audit trail as marketing headline** | 4/6 | **Adopt** | "Siste 7 dager" activity ribbon at the bottom of the landing reading from the unified `audit_events` table (Sprint A of the broader review). |
| **Auditor logs into the same product** | Workiva (their differentiator) | **Adapt** | Already shipped via auditor tokens — extend to cross-framework. |
| **Tilsyn-readiness PDF pack** | Resolver (board-ready exports) | **Adopt** | One-click PDF export of the unified view. |
| **English-only framework labels** | All six | **Reject** | Native AML § / IK-f § / GDPR Art. labels everywhere. Already correct in NewAMU. |
| **Empty-by-default composer** | Onspring, partly VComply | **Reject** | Unified view is opinionated; no composer. |
| **Module-card menu as landing** | MetricStream | **Reject** | We have this anti-pattern on `/overview/internkontroll` today — fix it (§4). |
| **Black-box composite score** | MetricStream (no formula published) | **Reject** | Show the formula always, with click-into-each-input. |

---

## 4. The unified view — `/overview/aml`

This becomes the canonical "compliance home". Internkontroll dashboard
is **promoted** to this URL (the data backbone is already there);
existing `/overview/internkontroll` route stays as a redirect for
6 months.

### 4.1 Page anatomy (top → bottom)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Arbeidsmiljøloven — oversikt                                       │
│  [Lederlens ▼]  [Eksporter PDF ⎙]  [Mint tilsynslenke 🔗]          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ZONE 1 — HERO                                                       │
│  ┌──────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Tilsyn-          │  │  AML  IK-f  GDPR  Åpenhet  ISO 45001    │  │
│  │ beredskap        │  │  ┌──┐ ┌──┐  ┌──┐  ┌──┐    ┌──┐          │  │
│  │                  │  │  │82│ │76│  │94│  │68│    │ — │          │  │
│  │   78 / 100       │  │  │▲5│ │▼2│  │▲1│  │▼8│    │ina│          │  │
│  │   ▲ +3 (30d)     │  │  └──┘ └──┘  └──┘  └──┘    └──┘          │  │
│  │   GOD            │  │   God   God   God  Svak    Ikke aktiv    │  │
│  └──────────────────┘  └─────────────────────────────────────────┘  │
│                                                                       │
│  ZONE 2 — GAP-MATRISE                                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  §       | Sjekkl | Spørs | Dok | Reg | Lær | Status            ││
│  │  AML 2A-1| 0      | 1     | 1   | 0   | 0   | ⚠ Tynt dekket    ││
│  │  AML 3-1 | 8      | 2     | 1   | 0   | 1   | ✓ Dekket          ││
│  │  AML 4-3 | 3      | 1     | 2   | 0   | 1   | ✓ Dekket          ││
│  │  AML 9-1 | 0      | 0     | 0   | 0   | 0   | ✗ Mangler          ││
│  │  ...                                                              ││
│  │  [Vis 76 til ▼]                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ZONE 3 — TRE PANELER                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Årshjul     │  │ Åpne planer │  │ Trend 30d   │                  │
│  │ • Maj: 4    │  │ • Planlagt5 │  │ ╱─╱╲╱─╲╱─╲ │                  │
│  │ • Jun: 12   │  │ • I gang  3 │  │                                ││
│  │ • Jul: 2    │  │ • Blokkert1 │  │                                ││
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                       │
│  ZONE 4 — SISTE 7 DAGER                                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Aktivitetsstripe — siste 7 dagers endringer (audit_events)     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Zones in detail

**Zone 1 — Hero (composite score + framework badge wall)**

Left third: the **Tilsyn-beredskap** score (see §5 for formula),
huge number + trend chip + status word (Kritisk / Svak / Akseptabel /
God / Sterk), exactly the pattern from Sprint A's HMS-helse spec.

Right two-thirds: **five framework badges** in a horizontal row. Each
badge shows:

- Framework abbreviation (AML, IK-f, GDPR, Åpenhet, ISO 45001)
- Coverage % as a big number (computed from `framework_coverage`
  dataset)
- Trend chip (▲▼ vs. 30 days ago)
- Status word and R.A.G. colour
- Click → filters Zone 2 (and the rest of the page) to that framework

This is the **Onspring NIST badge wall ported wholesale** — the
single cleanest "where am I covered" surface across all six vendors.

ISO 45001 in particular renders "Ikke aktiv" when the org hasn't
activated that pack — see `usePacks.ts:76`.

**Zone 2 — Gap matrix (already built; promote into landing)**

The existing `gap_matrix` heatmap, but rendered as a **table** by
default (rows = §, columns = the five modules, cell = artefact count).
Toggle button switches to a heatmap rendering. Status column on the
right uses a R.A.G. chip:

- **✓ Dekket** — green — ≥1 artefact in 2+ modules
- **⚠ Tynt dekket** — amber — ≥1 artefact in only 1 module
- **✗ Mangler** — red — 0 artefacts, but pack mandates coverage
- **— Ikke relevant** — grey — pack doesn't mandate this §

Click any row → navigate to per-§ deep page (§7).

**Zone 3 — Three side-by-side panels**

- **Årshjul** — what compliance activities are due this month / next /
  the one after, grouped by §. Drilling into a month opens
  `/overview/aml/årshjul?month=2026-06`. Data: derived from
  `compliance_checklist_templates.cadence_hint` + existing tasks
  due-dates. New widget (§9).
- **Åpne planer** — count of plan items per status from
  `plan_items_by_status` dataset. Click → `/overview/aml/planer?status=in_progress`.
  Reuses `CompliancePlanItemsSection.tsx`.
- **Trend 30d** — line chart of tilsyn-readiness score over the last
  30 days. New dataset — daily snapshot of the score (§10).

**Zone 4 — Activity strip**

Reads from `audit_events` (Sprint A's unified audit-trail table).
Filters to *AML-relevant* events (any module event with `law_refs[]`
intersecting AML or IK-f §§). Click an event → opens that record's
detail page.

### 4.3 Three lenses (single page, swapped widget mix)

Resolver's two-tier dashboard pattern, extended to three because we
have a third audience.

| Lens | Default user | What changes |
|---|---|---|
| **Lederlens** | HMS-leder, daglig leder | Default. The layout shown above. |
| **Vernerundlens** | Verneombud | Hero replaced with "Mine åpne tiltak"; Zone 2 filtered to §§ tied to verneombud's område; Zone 3 swaps Årshjul for "Mine vernerunder neste 30 dager"; Zone 4 filtered to events involving verneombud roles. |
| **Tilsynlens** | Read-only auditor preview (also what the external auditor sees) | Score becomes "Tilsyn-readiness", hero gains a "Bevisbunden er ferdig" status; Zone 2 adds an "Bevis tilgjengelig?" column; Zone 3 swaps Trend for "Klar for tilsyn" checklist (§10); Zone 4 hidden. |

Single `?lens=` query param. Persisted per user in `dashboard_layouts`.

### 4.4 What this replaces / consolidates

| Today | Tomorrow |
|---|---|
| `/overview/internkontroll` | `/overview/aml` (this page); old URL redirects |
| `/overview/internkontroll/gaps` | Zone 2 of `/overview/aml` |
| `/overview/regelverk` | Becomes a *framework-deep* page reachable from badge wall clicks |
| ParagraphInspectorPanel slide-over | Stays as a "peek"; full deep page at `/overview/aml/§:law_ref` (§7) |
| `/auditor/internkontroll/:token` | `/auditor/aml/:token` — Tilsynlens above, frozen snapshot |

---

## 5. Composite score — Tilsyn-beredskap

Single number, 0–100, with open formula. **Reject MetricStream's
black-box pill; adopt MetricStream's idea of leading with a score.**

```
Tilsyn-beredskap = w1·D + w2·E + w3·P + w4·A

where
  D = Dekningsgrad       (% AML §§ with ≥1 artefact across modules)
  E = Bevis-friskhet     (% recent_evidence within last 12 mo / 24 mo)
  P = Plan-progresjon    (% plan_items in 'done' status)
  A = Attestasjons-rate  (% relevant policies attested current version)

Defaults (org admins can adjust):
  w1 = 0.40   (coverage matters most)
  w2 = 0.25   (stale evidence devalues coverage)
  w3 = 0.20   (open gaps with no plan are worst)
  w4 = 0.15   (attestation only counts if policy exists)

Status words:
  ≥ 85: Sterk
  70–84: God
  55–69: Akseptabel
  40–54: Svak
  < 40: Kritisk
```

Each input is a click target — click the number to see the per-§
breakdown that produced it. **The formula is visible in the UI** on a
"Hva er dette tallet?"-popover next to the hero. This is the
Norwegian-SMB demand met: a CEO has to be able to point at the
number *and* the AML § behind it.

Compute snapshot daily via cron → new `tilsyn_score_snapshots(org_id,
date, score, components jsonb)` table. Powers Zone 3's trend chart.

---

## 6. Where each vendor pattern lands in the code

Senior-dev mapping — every adopted pattern, to file paths.

| Pattern | New file(s) | Reuses existing |
|---|---|---|
| Page route `/overview/aml` | `src/pages/overview/aml/AmlOverviewPage.tsx` | `src/lib/dashboards/` engine |
| Composite score hero | `src/components/aml/TilsynBeredskapHero.tsx` | Sprint A's `<StatusChip variant="rag">` |
| Framework badge wall | `src/components/aml/FrameworkBadgeWall.tsx` | `framework_coverage` dataset |
| Gap matrix table+heatmap toggle | `src/components/aml/GapMatrixSurface.tsx` | Existing `gap_matrix` dataset; existing `InternkontrollGapPage` logic |
| Årshjul panel | `src/components/aml/ArshjulPanel.tsx` | `compliance_checklist_templates.cadence_hint`; existing tasks due-dates |
| Plan items panel | (reuse) `CompliancePlanItemsSection.tsx` | as-is |
| Trend 30d panel | `src/components/aml/TilsynScoreTrend.tsx` | new `tilsyn_score_snapshots` dataset |
| Activity strip | `src/components/aml/AmlActivityStrip.tsx` | Sprint A `audit_events` table |
| Per-§ deep page | `src/pages/overview/aml/ParagraphDetailPage.tsx` | `ParagraphInspectorPanel` logic |
| Evidence ledger | `src/pages/overview/aml/EvidenceLedgerPage.tsx` | planner §5.4 union query |
| Årshjul detail page | `src/pages/overview/aml/ArshjulPage.tsx` | new dataset (§9) |
| Tilsyn-readiness pre-flight | `src/components/aml/TilsynReadinessChecklist.tsx` | composite score input |
| Lens switcher | `src/hooks/useAmlLens.ts` | `dashboard_layouts` persistence |
| Daily score snapshot cron | edge fn `aml-score-snapshot` | `cron-scheduling.md` infra |

No new framework needed. No new module. This is **almost entirely
composition over existing infra**.

---

## 7. Per-§ deep page — `/overview/aml/§:law_ref`

Today the only way to drill into a § is the slide-over panel.
Insufficient for these flows:

- A verneombud wants to bookmark "§4-3 oversikt" and return weekly.
- Arbeidstilsynet asks "vis meg alt rundt § 3-1" — needs a URL to send.
- A consultant working across departments needs a tab open per §.

**Page tabs:**

1. **Dekning** — which artefacts cover this §, in which module. List
   view grouped by module type (sjekklister, dokumenter, undersøkelser,
   registre, læring). Each row links into that artefact's detail page.
2. **Bevis** — evidence aggregation across modules: completed
   sjekklist-executions, signed dokumenter, survey-responses,
   register-records, completed learning-progressions — filtered to
   those carrying this `law_ref`. With date filter and "siste 12 mo"
   default.
3. **Planer** — plan items tied to this §; inline CRUD via existing
   `CompliancePlanItemsSection`.
4. **Historikk** — `EntityTimeline` (Sprint A) filtered to events
   whose record `law_refs[]` intersects this §. Cross-module audit
   trail for a single §.
5. **Tilknyttet** — meta tab: related §§ (same chapter, same
   regulation), parent IK-f bindings, and any tilsyn-spørsmål linked
   to this § from `aml_paragraph_questions` (if such a table exists
   from internkontroll Phase 2; verify).

This is the **VComply Workroom pattern from `grc-feature-review.md`
#2**, scoped to a § rather than to an incident — same five-tab mental
model.

---

## 8. Evidence ledger — closes `compliance-planner.md` §5.4

A single screen union-querying execution tables across all five
modules. Already designed in the planner; never built.

**Route:** `/overview/aml/bevis`

**Layout:**

- Filter rail: framework picker · § picker · date range · module ·
  status (signed/completed/expired)
- Main table: artefact · type icon · § · date · actor · evidence link
- Bulk select → "Eksporter til bevisbunke" (zip of all linked files +
  CSV index)

**Data source** — the union query is already designed in
`specs/compliance-planner.md §3`; ship it as a Postgres view
`v_compliance_evidence_ledger` with one row per
(artefact, law_ref, completed_at) tuple.

**Why this matters:** today the answer to *"vis meg bevisene for §3-1"*
requires opening five module pages and filtering each. Vendor
convergence (Workiva PBC dashboard, Resolver evidence vault, VComply
Audit Workroom, MetricStream evidence mgmt) confirms this is a
buyer-visible surface, not internal plumbing.

---

## 9. Årshjul overlay — new dataset

Today we have `compliance_checklist_templates.cadence_hint` ('arlig' /
'halvarlig' / 'kvartalsvis' / 'ad_hoc') but no surface that shows
*"these §§ have something due this month"*.

**New dataset** `aml_arshjul`: rows per (org, year, month, law_ref,
artefact_kind, cadence_hint). Built by a Postgres function that
expands each template's cadence into months based on activation date.

**Surface 1 — Zone 3 panel on `/overview/aml`** — three-month preview
"Mai: 4 aktiviteter · Juni: 12 · Juli: 2".

**Surface 2 — full year view at `/overview/aml/årshjul`** — 12-month
calendar grid (months × weeks), each cell shows count of due
activities, click any cell → list of activities, click any activity →
its execution route.

**Why this matters:** AML compliance is fundamentally **cadenced** —
*"vi tar vernerunde to ganger i året"*, *"AMU møtes kvartalsvis"*,
*"brannøvelse årlig"*. None of the six vendors publish a year-grid
calendar specific to compliance cadence; this is a defensible
Norwegian-SMB differentiator.

---

## 10. Tilsyn-readiness pre-flight

Before minting an auditor token, surface a one-screen checklist:
*"Er vi klare for tilsyn?"*

Items (computed):

- ✓ / ✗ Tilsyn-beredskap-score ≥ 70?
- ✓ / ✗ Alle AML-§§ med "Mangler" har minst en planlagt aktivitet?
- ✓ / ✗ HMS-håndbok versjon attestert av >90% av ansatte?
- ✓ / ✗ Verneombud valgt og registrert?
- ✓ / ✗ AMU sammensatt og siste møte ≤6 mnd?
- ✓ / ✗ ROS-vurdering oppdatert siste 12 mnd?
- ✓ / ✗ Beredskapsplan oppdatert siste 12 mnd?
- ✓ / ✗ Sykefraværsstatistikk siste 12 mnd tilgjengelig?
- ✓ / ✗ Avvikslogg ≤6 mnd uten åpne saker eldre enn 90 dager?
- ✓ / ✗ Bevisbunke (siste 12 mo evidence) ≥80% friskhet?

For each failing item, a "Ordne nå" link routes to the fix.

When all green → "Mint tilsynslenke" primary button. Token now spans
**all 5 frameworks** (closing the auditor-AML-only gap).

This is the **Resolver "board-ready export" pattern** plus an
opinionated pre-flight that Norwegian SMBs ask for explicitly.

---

## 11. Gap-closure plan — three sprints

Each sprint ends with a demo. Sequenced so each one rides the work
of the prior.

### Sprint α — "Promote internkontroll to /overview/aml" (1.5 weeks)

**Goal:** the landing page exists, looks like the Zone 1+2 sketch,
ships without the new pieces.

- New route `/overview/aml` mounting an `AmlOverviewPage`.
- Build `TilsynBeredskapHero` reading from a v0 of the score (use
  existing KPI sum, defer snapshot table to sprint γ).
- Build `FrameworkBadgeWall` reading from existing `framework_coverage`.
- Mount existing gap-matrix component as Zone 2.
- Add `?lens=` query param plumbing + `useAmlLens`; ship only
  Lederlens for now.
- Redirect `/overview/internkontroll` → `/overview/aml` with a banner
  explaining the rename.
- Update `AticsShell.tsx` sidebar — promote AML to a top-level
  HMS-oversikt sub.

**Demo:** *"One screen, one number, five framework badges, gap
heatmap."*

### Sprint β — "Per-§ deep + evidence ledger" (1.5 weeks)

**Goal:** the two missing canonical pages.

- New route `/overview/aml/§:law_ref` with five tabs (Dekning · Bevis ·
  Planer · Historikk · Tilknyttet). Reuse `ParagraphInspectorPanel`
  internals.
- New Postgres view `v_compliance_evidence_ledger`.
- New route `/overview/aml/bevis` with filter rail, table, bulk export.
- Wire Zone 2 row-click → deep page; wire badge-wall framework-click →
  deep page filter.
- Add Vernerundlens (filter to verneombud's område).

**Demo:** *"Click § 4-3. Read the whole story across all five modules
on one page. Export the evidence as a zip."*

### Sprint γ — "Tilsynlens + årshjul + score snapshots" (2 weeks)

**Goal:** tilsyn-ready and trend-aware.

- New cron-driven edge fn `aml-score-snapshot`; daily snapshot table.
- Trend panel on landing.
- New table-function for `aml_arshjul` dataset; year-grid page at
  `/overview/aml/årshjul`; Zone 3 panel.
- Add `TilsynReadinessChecklist` component; gate the "Mint tilsynslenke"
  button behind it; extend token scope to all five frameworks.
- Add Tilsynlens (third lens; auditor view).
- One-click PDF export of the landing page (Resolver-style board pack).

**Demo:** *"Arbeidstilsynet says they're coming next Tuesday. Check
the pre-flight, mint the link, hand it over. Trend chart shows we've
been improving."*

---

## 12. What this doesn't try to be

- **Not a control library** (Workiva / MetricStream pattern). We
  don't model controls as first-class objects between regulations and
  evidence. AML compliance at SMB scale doesn't need that indirection
  — our 5-module template surface *is* the control library, indexed by
  `law_refs[]`.
- **Not a workflow builder** (Onspring / VComply pattern). Workflow
  Studio is deferred to Sprint D of the broader review.
- **Not a SOX certification cascade** (Workiva). Norwegian SMB doesn't
  have the multi-level executive structure that needs sub-certification.
- **Not a black-box ML risk-prioritisation score** (anti-pattern).
  Every component of the composite score is openly visible and
  clickable.
- **Not a multi-jurisdiction reg-change feed** (MetricStream pattern,
  Resolver pattern). Norway is one jurisdiction; we cover AML / IK-f /
  GDPR / Åpenhetsloven / ISO 45001 deeply, not 700 regulations
  shallowly.

---

## 13. Sources

Cross-vendor compliance/IC dashboard research is captured in the
research-agent transcripts (delegated for length). Key inline URLs:

- Onspring NIST framework dashboard image: `Compliance-Management-_-Performance-Monitoring.png` on https://onspring.com/products/compliance-management/
- Resolver canonical dashboard library: https://www.resolver.com/resource/risk-and-compliance-dashboards/
- Resolver Internal Controls page (Executive + Assurance dashboards): https://www.resolver.com/grc-software/internal-controls-management-software/
- MetricStream Compliance Dashboard explainer: https://www.metricstream.com/learn/compliance-dashboard.html
- MetricStream Compliance Management: https://www.metricstream.com/products/compliance-management.htm
- VComply ComplianceOps: https://www.v-comply.com/complianceops-software/
- VComply gap analysis blog: https://www.v-comply.com/blog/regulatory-gap-analysis-guide/
- Workiva GRC platform demo: https://www.workiva.com/resources/workivas-grc-platform-for-audit-and-risk-teams
- Netwrix 1Secure compliance reports: https://docs.netwrix.com/docs/1secure/admin/searchandreports/compliance
- Netwrix Sensitive Data Posture Dashboard (Apr 2026): https://community.netwrix.com/t/1secure-april-2026-release-sensitive-data-posture-dashboard-smoother-reporting-experience-and-enhanced-psa-itsm-integrations/127813

Internal references:
- `specs/compliance-planner.md` — gap-and-audit planner (this doc
  extends it)
- `specs/aml-requirements-inventory.md` — 80+ AML §§ inventory
- `specs/grc-feature-review.md` — cross-vendor top-10 (Workroom #2,
  audit trail #3, version diff #4 all relevant here)
- `specs/endringslogg-event-spec.md` — per-event spec for the
  activity strip in Zone 4
