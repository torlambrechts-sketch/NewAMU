# Studio Builder — unified authoring surface

This spec documents a senior-architect review and proposed implementation
of the **Studio Builder**: one editing surface where customer admins,
consultancy partners, and (later) marketplace contributors author
templates, workflows, documents, e-learning courses, surveys, registers,
dashboards, and full compliance packs. It is the architecture hand-over
for the studio sprint(s) and the source of truth for the Simple/Advanced
mode split, the kind registry, the pack-authoring loop, and the partner
multi-tenancy model.

The strategic framing in §11 is the picture that justifies the
investment; §1–§10 are the plan that delivers it.

**Spec status:** `📋 draft — pending senior review`.
**Last reviewed:** 2026-05-17.
**Reference modules:** dashboards (`src/lib/dashboards/dashboardRegistry.ts`),
workflows (`src/lib/workflows/workflowRegistry.ts` + 12 module scopes),
compliance studio (`src/pages/overview/studio/ComplianceStudioPage.tsx`).
**Target module:** `modules/studio/` + `src/pages/studio/StudioPage.tsx`
+ `src/lib/studio/`.

> **Read first:** `CLAUDE.md` *Template surfaces* (per-module table
> shapes + law-ref columns + provisioning conventions),
> `specs/workflow-engine-review.md` §3 (registry-via-declaration-merging
> precedent), `specs/PLAYBOOK.md` §3 (standard task shape this spec
> uses), and `specs/compliance-planner.md` §2 (what's already shipped
> as data substrate the studio writes against).

---

## 1. One-paragraph framing

Seven modules ship templates and content today (compliance / survey /
documents / learning / meetings / registers / dashboards) and each has
its own editor pattern: TipTap rich text, dnd-kit drag-drop, slide-panel
form, wizard modal, dashboard edit panel. Admins learn five UI patterns
to do one job ("change our compliance content"). A unified **Studio
Builder** at `/studio` collapses these into one shell with progressive
disclosure: **Simple mode** (default — outcome-named wizards + presets +
constrained palette) for the 80% who just want to change a field;
**Advanced mode** (opt-in — canvas + palette + property panel + pack
authoring) for consultants, power admins, and marketplace contributors.
Both modes write the same data through the existing per-module mutation
paths. The studio is **enabling infrastructure** for the platform thesis
(customer/partner/marketplace tiers, ISO 27001/NIS2/GDPR pack arbitrage,
content moat). Build order: (0) registry + property-form foundation
[engineering only], (1) studio shell + Simple mode default, (2) Advanced
mode + pack authoring [ISO 27001 ships as the loop-closes proof],
(3) customer + partner authoring with delegated multi-tenancy,
(4) marketplace (conditional on density milestones in §11).

---

## 2. Current state

Functional but fragmented. Strong per-module editors, no unifying shell,
no kind registry, no pack-authoring UI.

**Per-module editors (live today):**

| Module | Editor | Pattern | Versioning | System↔org override |
|---|---|---|---|---|
| Documents / Wiki | `src/components/documents/DocumentEditorWorkbench.tsx` | TipTap + `ContentBlock` JSON | Yes (`WikiVersionDiff`) | Yes |
| E-learning | `src/pages/learning/LearningCourseBuilder.tsx` | Tabbed CRUD + TipTap | Yes (`LearningVersionPublishModal`) | Yes (`forkSystemCourse`) |
| Surveys | `modules/survey/SurveyBuilderStage.tsx` | dnd-kit palette + branching | No (status enum only) | Yes |
| Compliance | `modules/compliance/admin/TemplateEditorPanel.tsx` | Slide-panel form | No | Yes |
| Meetings | `src/pages/meetings/MeetingsTemplateEditorPanel.tsx` | Slide-panel form | No | Yes |
| Registers | `src/pages/registers/RegistersScopeTyper.tsx` | Form + JSON schema | No | Yes |
| Dashboards | `src/components/module/dashboard/DashboardEditLayoutPanel.tsx` | Drag-drop + property form | Yes (named views) | n/a |
| **Aggregator (today)** | `src/pages/overview/studio/ComplianceStudioPage.tsx` | 3 setup wizards | n/a | n/a |

**Foundations ready to extend:**
- `src/lib/dashboards/dashboardRegistry.ts` — per-scope registration
  (catalog, datasets, accent, composite members). Pattern is
  domain-agnostic; only `ReportModuleWidget`'s renderer is
  dashboard-specific.
- `src/lib/workflows/workflowRegistry.ts` + 12 module scopes via
  declaration-merging on `WorkflowEventMap`. Registry-via-merging is
  the locked-in SDK pattern (spec'd in `workflow-engine-review.md §3`).
- `modules/compliance/usePacks.ts` + `modules/compliance/dashboards/packAccents.ts` —
  multi-pack mechanism already wired (`aml-amu | iso-45001`).
- `src/components/wizard/WizardModal.tsx` — supports field kinds:
  `text`, `select`, `radio-cards`, `checkbox-group`, `module-picker`.
  Already the right shape for Simple-mode presets.
- `src/pages/overview/studio/{studioWizardCatalog.ts,studioWizardFactories.ts}` —
  catalog + factory pattern (3 wizards live: HMS grunnmur, varsling,
  AMU etablering). Extends naturally to N scopes.
- Shared primitives: `TipTapRichTextEditor`, `freshId`,
  `dashboardFilters`, `SlidePanel`, `FormModal`,
  `LearningMetadataSchemaEditor`.

**Gaps that prevent a unified studio:**
- `ReportModuleWidget.tsx` is a 9-branch if-chain on `m.kind`; adding a
  widget kind touches **six call sites** (CLAUDE.md flags this). Will
  not scale to 30+ kinds across 7 modules.
- Property forms (`DashboardEditWidgetPanel.tsx`) hand-coded per kind.
  No generic schema-driven form generator.
- No unified block editor library; Documents/Surveys/Learning each
  invented their own block model.
- No pack-authoring UI; `compliance_packs` is SQL-only today. Adding
  ISO 27001 means writing seed migrations, not clicking through a
  studio.
- No multi-tenant studio mode; partners can't manage N client orgs
  from one session.
- No `studio.*` permissions; today everything sits under module
  admin permissions, which is too coarse for a tiered product.
- No pack-as-portable-artifact export; marketplace would be a rewrite
  later, not an extension.

---

## 3. Decisions locked in

| Question | Decision |
|---|---|
| Architectural pattern | **Consolidate & extend** existing registries (`dashboardRegistry`, `workflowRegistry`). No parallel registry. New `studioRegistry` follows the same declaration-merging shape with a `StudioKindMap` interface. |
| UI shape | **One studio, two modes** (Simple default, Advanced opt-in). Same data, same components, `mode` prop on the shell. **Not two products.** |
| Embedding strategy | **Host existing per-module editors**, don't replace them. TipTap stays for documents/learning, dnd-kit stays for surveys, slide-panel stays for compliance/meetings. Studio shell provides the chrome (palette, preview, publish, version, accent), not the editing canvas. |
| Kind registry | **Pluggable** — each kind ships *both* a Simple-mode preset and an Advanced-mode property schema as a registry contract. Registry rejects kinds missing either. |
| Pack model | **Pack-as-portable-artifact** from day one — pack export/import shape decided in Phase 2 even though marketplace ships in Phase 4. |
| Multi-tenancy | **Delegated admin** scoped through existing per-org override pattern. Partners get a "switch org" affordance; no custom auth model, no new RLS surface beyond `partner_org_links` scope. |
| Permissions | **New `studio.*` keys** — `studio.simple`, `studio.advanced`, `studio.packs`, `studio.partner_admin`, `studio.marketplace_publish`. Tier mapping in §11. |
| Localisation | **`name_i18n: { nb, en }`** on all studio-authored content from day one (mirrors workflow spec §3); same fallback rules. |
| Audit | **Mutation log on every studio write** — `studio_revisions` table mirroring `workflow_rule_revisions`. Mandatory for marketplace trust + customer audit. |
| Review/approve | **`compliance_review_status` enum reused** (`draft → reviewed → approved`) on all studio-authored content, regardless of module. |

Anti-features explicitly out of v1:
- A new block editor that replaces TipTap / dnd-kit / slide-panel. We
  embed; we don't rewrite.
- Inline JS / JSONata code blocks inside the studio (security + audit
  nightmare; covered by workflow spec anti-features too).
- A second permission model parallel to RBAC for partners. Reuse the
  existing org-membership + role model with a `partner_admin` role.
- Marketplace, payment rails, Stripe Connect — **not in v1–v3**. Pack
  artifact shape is decided in Phase 2 so v4 marketplace is an
  extension, not a rewrite.
- A "studio mobile app". Mobile gets read-only preview of
  studio-authored content; authoring is desktop-only.
- AI/LLM-assisted authoring as a v1 feature. Capture as an open
  question (§10) for a follow-up spec.

---

## 4. Architecture (consolidate-and-extend)

```
Modules (compliance, survey, documents, learning, meetings, registers,
  dashboards, workflows — eight scopes)
    each ships:
      modules/<scope>/studio/<scope>StudioScope.ts
        registerStudioScope<MyKindMap>({ scopeId, label, accent,
          kinds, presets, propertySchemas, embedder, mutator,
          lawRefs, packAware })
                              ▼  side-effect import
src/lib/studio/studioRegistry.ts (single source of truth, types via
  declaration-merging StudioKindMap interface — adding a kind lights
  up the Simple preset picker, Advanced property panel, and CSV
  export automatically)
                              ▼
Studio shell (/studio, mode={'simple'|'advanced'}):
  ScopePicker · PalettePanel · CanvasFrame · PropertyInspector
  PreviewPane · VersionTimeline · PublishBar · ModeToggle
                              ▼
Per-scope embedders (host existing editors):
  TipTap (documents, learning) · dnd-kit canvas (survey) ·
  SlidePanel form (compliance, meetings) · JSON schema form
  (registers) · DashboardEditLayoutPanel (dashboards) ·
  WorkflowCanvas v3 (workflows — from workflow-engine-review.md)
                              ▼
Existing per-module mutation paths (extended, never rewritten):
  compliance_checklist_templates · survey_org_templates ·
  document_org_templates · learning_courses · meeting_templates ·
  register_types · dashboard_layouts · workflow_rules
  + studio_revisions (NEW — mutation audit log)
  + studio_pack_drafts (NEW — pack-authoring workspace,
    converts to compliance_packs + bundled provisioning on publish)
  + studio_packs_export (NEW — pack-as-portable-artifact view)
  + partner_org_links (NEW — delegated multi-tenant admin)
                              ▼
Edge functions (Deno):
  studio-pack-export — bundles pack → ZIP with manifest, checksums
  studio-pack-import — validates + provisions pack into target org
```

House-style guardrails (CLAUDE.md):
- Side-effect imports for every scope file
  (`import './studio/<scope>StudioScope'`); dev-mode startup
  assertion validates every module in `STUDIO_SOURCE_MODULES` is
  registered (same pattern as workflow spec).
- ID minting via `freshId('studio')` — never roll a local UUID
  polyfill.
- All new migrations idempotent (`add column if not exists`,
  `on conflict ... do update set`). Basenames timestamped past the
  latest. Each carries the 4–8 line Arbeidstilsynet self-audit header.
- `law_refs` exact strings (`'AML § 4-3'`, `'GDPR Art. 35'`,
  `'IK-f § 5 nr. 7'`). Studio writes populate the same `law_refs[]` /
  `legal_basis[]` / `regulation_ids[]` arrays the planner reads.
- `name_i18n: { nb, en }` on all studio-authored content from day one.
- Reuse, don't duplicate: `compliance_notifications` for studio
  notifications, `compliance-audit-pdf` for pack-bundle PDFs,
  `compliance_review_status` for the approve workflow,
  `dashboard_layouts` schema as the persistence shape for any
  layout-bearing kind.

### Mode model (Simple vs Advanced)

The **same shell** renders both modes by switching:

| Surface | Simple mode | Advanced mode |
|---|---|---|
| Entry | Outcome-named cards ("Add a policy", "Set up a reminder") | Scope picker → kind palette |
| Editing | `WizardModal` flow over a registered preset | Canvas + drag-drop + property inspector |
| Palette | Constrained per kind (3–5 most common blocks) | Full kind catalog |
| Property panel | Hidden behind "Open in Advanced" escape hatch | Always visible, full schema |
| Publish | One-click "Apply" | Review-and-publish with diff |
| Telemetry | Tracks "Open in Advanced" usage → prompts mode promotion at 3+ uses | n/a |

Mode is a **per-user sticky setting** (`profiles.studio_mode_default`),
not per-content. The same template can be edited Simple today,
Advanced tomorrow. Advanced is permission-gated (`studio.advanced`).

### Kind registry contract

Each kind in a scope must declare:

```ts
registerStudioKind({
  scopeId: 'documents',
  kindId: 'policy',
  label: 'Policy / instruks',
  accent: '#0f766e',
  simplePresets: SimplePreset[],   // ≥1 required — fails build if empty
  advancedSchema: PropertySchema,  // ≥1 field required
  embedder: ReactComponent<EmbedderProps>,  // existing per-module editor
  mutator: (input, ctx) => Promise<ResultRow>,
  lawRefSlot: 'law_refs' | 'legal_basis' | 'regulation_ids' | 'law_refs_jsonb',
  packAware: boolean,
  csvExporter?: (row) => Record<string, string>,
})
```

The build asserts `simplePresets.length >= 1 && advancedSchema.fields.length >= 1`
— a kind that's Advanced-only is a bug. Mode parity is enforced at
the registry level, not at review time.

---

## 5. Phasing (sequenced for least rework)

### Phase 0 — Foundation (engineering only, ~3 sprints)

**Why first:** every later phase sits on top. Without a kind registry
and property-form generator, the studio is a fork-of-everything.
Without `studio_revisions` and `compliance_review_status` wiring,
customer authoring is a liability vector. No user-visible work here.

Migrations (new forward, all idempotent):
1. `<ts>_studio_revisions.sql` — `(id, scope_id, kind_id, row_id,
   row_table text, organization_id, prev_payload jsonb,
   next_payload jsonb, changed_by, changed_at, change_reason text,
   review_status compliance_review_status)`. Trigger on every
   studio-aware table writes a revision row.
2. `<ts>_studio_review_status.sql` — `add column review_status
   compliance_review_status not null default 'draft'` to every
   org-template table not already carrying it (survey_org_templates,
   document_org_templates, meeting_templates, register_types,
   compliance_checklist_templates). The compliance table already has
   it (per CLAUDE.md); others backfill `'approved'` for existing
   rows.
3. `<ts>_studio_permissions.sql` — insert permission keys:
   `studio.simple`, `studio.advanced`, `studio.packs`,
   `studio.partner_admin`, `studio.marketplace_publish`. Grant
   `studio.simple` to every existing admin role; `studio.advanced`
   only to platform admins until tier rollout.
4. `<ts>_studio_profile_mode.sql` — `add column studio_mode_default
   text not null default 'simple'` on `profiles`. Check constraint:
   `in ('simple','advanced')`.

Application-layer (Phase 0):
- `src/lib/studio/studioRegistry.ts` (new) — `registerStudioScope`,
  `registerStudioKind`, `getStudioScope`, `getStudioKind`,
  `STUDIO_SOURCE_MODULES` const, dev startup assertion.
- `src/lib/studio/studioTypes.ts` (new) — `StudioKindMap` interface
  (declaration-merging target), `SimplePreset`, `PropertySchema`,
  `PropertyField` union (`text | textarea | select | radio-cards |
  checkbox-group | number | toggle | law-ref-picker | preset-picker |
  rich-text-embed | dnd-canvas-embed | layout-embed`).
- `src/lib/studio/freshId.ts` — re-export `src/lib/dashboards/freshId.ts`.
- `src/lib/studio/PropertyFormGenerator.tsx` (new) — renders an
  `advancedSchema` to a form. Reuses `LearningMetadataSchemaEditor`'s
  field renderers where the kind matches.
- `src/lib/studio/PresetPicker.tsx` (new) — renders `simplePresets`
  as `WizardModal` flows.
- `src/lib/studio/WidgetKindRegistry.ts` (new) — extracts the
  `ReportModuleWidget.tsx` if-chain into a registry of
  `{ kind, renderer, defaultConfig, propertySchema, simplePreset }`.
  Migrates the 9 existing kinds (`kpi | table | bar | donut | line |
  heatmap | scorecard | bowtie | benchmark`) into entries. Updates
  the six call sites (`KIND_LABELS`, `kindSwitch`,
  `defaultCompatibleKinds`, Zod enum, renderer if-chain,
  `DashboardEditWidgetPanel` property form) to read from the
  registry.
- `src/hooks/useStudioRevision.ts` (new) — load/write a
  `studio_revisions` row alongside any mutator call.
- `src/hooks/useStudioMode.ts` (new) — read/write
  `profiles.studio_mode_default`; emits telemetry on mode flip and
  on "Open in Advanced" escape-hatch use.

Acceptance for Phase 0:
- [ ] `pnpm typecheck` clean; no local re-definitions of widget kind
  enums or property forms.
- [ ] All 9 existing widget kinds render identically before/after the
  registry refactor (visual diff via Storybook or screen capture).
- [ ] Editing any of the 7 module-template tables writes a
  `studio_revisions` row.
- [ ] `studio.*` permission keys present in `permissions` table; tier
  mapping unset.
- [ ] Dev-mode startup logs `[studio] N kinds registered across M
  scopes`; missing-scope assertion fires when a scope file is
  removed.

### Phase 1 — Studio shell + Simple mode default (~1 sprint)

Files:
- `src/pages/studio/StudioPage.tsx` (renames/extends
  `ComplianceStudioPage.tsx`) — three columns: scope picker · canvas
  (mode-aware) · property inspector (hidden in Simple). Mode toggle
  top-right.
- `src/components/studio/shell/{ScopePicker,PalettePanel,CanvasFrame,
  PropertyInspector,PreviewPane,VersionTimeline,PublishBar,ModeToggle}.tsx`.
- `src/components/studio/shell/SimpleModeCards.tsx` — outcome-named
  cards reading from `simplePresets` across all registered scopes.
  Renders the existing 3 compliance wizards (HMS grunnmur, varsling,
  AMU etablering) as cards alongside new scope presets.
- `src/components/layout/AticsShell.tsx` — promote Studio to a
  top-level `NavGroup` (`flatSubs: true`): Studio · Analyse ·
  Bibliotek · Innstillinger. Permission gate: `studio.simple`.
- `modules/{compliance,survey,documents,learning,meetings,registers,
  workflows}/studio/<scope>StudioScope.ts` × 7 — minimum 3 Simple
  presets per scope at launch (21 presets total).

Telemetry events (extend `analytics` if available, otherwise log
table):
- `studio.scope_opened` `(scope_id, mode)`
- `studio.preset_started` `(scope_id, preset_id)`
- `studio.preset_completed` `(scope_id, preset_id, duration_ms)`
- `studio.open_in_advanced_clicked` `(scope_id, kind_id, from_preset_id?)`
- `studio.mode_promoted` `(from_mode, to_mode, trigger)`

Acceptance for Phase 1:
- [ ] `/studio` loads with scope picker + 21 Simple presets.
- [ ] Existing compliance wizards still work (zero regression);
  surface under the new Studio nav.
- [ ] Mode toggle flips Simple↔Advanced and persists per user.
- [ ] Advanced mode renders a placeholder per kind (palette wired
  but property forms stubbed for any kind missing a schema). Build
  must pass.
- [ ] Per-scope accent flips the shell border.
- [ ] Telemetry events fire for all five touch points above.

### Phase 2 — Advanced mode + pack authoring (~2 sprints)

Files:
- Complete `advancedSchema` for all kinds across the 7 modules. Each
  kind embeds the existing per-module editor (TipTap, dnd-kit,
  slide-panel form, etc.) as the canvas; property panel renders the
  schema.
- `src/pages/studio/PackEditor.tsx` — pack authoring surface.
  Simple mode: 3-step wizard (basics, regulations, baseline).
  Advanced mode: full property panel (slug, kpi_labels,
  severity_labels, legal_references[], accent, locale set, baseline
  template selector).
- `supabase/migrations/<ts>_studio_pack_drafts.sql` — `(id,
  organization_id, slug, draft_payload jsonb, status pack_draft_status,
  published_at, published_pack_id)`. Status: `draft → reviewed →
  published`.
- `supabase/migrations/<ts>_studio_packs_export.sql` — view or
  function returning the pack-as-portable-artifact JSON for a given
  `compliance_packs` row (includes templates, workflows, courses,
  documents joined via `pack` column / `compliance_pack` slug).
- `supabase/functions/studio-pack-export/index.ts` — bundles pack →
  ZIP with `manifest.json` (slug, version, locale, checksums) +
  per-module template files. Signed manifest mirrors
  `compliance-audit-pdf` evidence-pack mode.
- `supabase/functions/studio-pack-import/index.ts` — validates ZIP,
  provisions into target org via existing `provision_*_baseline_for_org`
  RPCs. Idempotent — re-import is no-op except for new content.

Pack-aware studio writes: when a kind is `packAware: true` and the
shell has an active pack context (`?pack=`), studio writes set
`pack` / `compliance_pack` and `law_refs[]` on the new row.

**Loop-closes proof:** ship **ISO 27001** as the first pack authored
via the studio (no SQL migration). Authoring + provisioning end-to-end
through `/studio` validates the loop.

Acceptance for Phase 2:
- [ ] All 7 scopes have full Advanced property schemas; build
  asserts no kind missing.
- [ ] Pack editor creates a draft, lets the user pick a baseline
  template set, publishes to `compliance_packs`.
- [ ] ISO 27001 pack ships via studio: ≥10 templates seeded, dashboard
  accent flips, regelverk-dekning page shows it.
- [ ] `studio-pack-export` produces a ZIP for AML-AMU; `studio-pack-import`
  re-installs it into an empty org; gap matrix (per
  `compliance-planner.md §5.1`) reports identical paragraph coverage
  before/after.

### Phase 3 — Customer + partner authoring (~1 sprint + ongoing)

Files:
- `supabase/migrations/<ts>_partner_org_links.sql` — `(partner_org_id,
  client_org_id, granted_by, granted_at, expires_at, role text default
  'partner_admin', revoked_at)`. RLS: a user in `partner_org_id` with
  `studio.partner_admin` gets read-write into `client_org_id`'s
  studio surface only (not full admin).
- `src/components/studio/shell/PartnerOrgSwitcher.tsx` — "Du arbeider
  i [Klient AS]" banner with switch dropdown. Persists last-active
  client per partner user.
- `src/pages/admin/partners/PartnerInvitePage.tsx` — partner-tier
  admin invites client orgs (one-click link grant via email).
  Client admin approves; both sides see the link in
  `partner_org_links`.
- Review/approve UX: `compliance_review_status` enum now wired in
  every studio edit. Toggle `'draft' → 'reviewed' → 'approved'`
  surfaces in `PublishBar` + `VersionTimeline`. Reviewers receive a
  `compliance_notifications` row on submit.
- "Audited" badge — display chip on templates with
  `review_status='approved'` and an additional `audit_signature`
  column populated (partner verification or AMU review). New
  column: `audited_at timestamptz, audited_by uuid, audit_kind text
  (one of 'amu','partner','external_counsel')`.

Acceptance for Phase 3:
- [ ] Customer admin with only `studio.simple` can create+edit own-org
  template; cannot touch system templates.
- [ ] Partner user with `studio.partner_admin` sees switcher; can
  edit linked client orgs but not arbitrary orgs (RLS-enforced).
- [ ] Submitting a studio edit transitions `review_status` and emits
  a notification.
- [ ] "Audited" badge renders only when both `review_status='approved'`
  and `audited_at` set.

### Phase 4 — Marketplace (conditional, ~3 sprints, deferred)

Gated on §11 milestones: 100+ Pro/Enterprise customers and 20+
partners. Builds on the pack-as-portable-artifact already shaped in
Phase 2.

- `studio_marketplace_listings` table — `(pack_export_id, publisher_org_id,
  title_i18n, summary_i18n, tags text[], price_cents, currency,
  status, published_at)`.
- `src/pages/marketplace/{MarketplaceListPage,MarketplaceListingPage,
  PublishListingWizard}.tsx`.
- Payment rails: Stripe Connect for partner payouts; 70/30 split
  default (publisher / platform). Vat handled per Norwegian rules.
- Trust layer: only `audit_kind='amu'` or `partner` packs eligible to
  list. External-counsel packs require platform review.

Defer details to a follow-up `specs/studio-marketplace.md` once §11
milestones land.

---

## 6. Inspiration borrowed (not blindly)

| Source | Borrow | Skip |
|---|---|---|
| Notion | Block-based content, slash menu, /open-in-advanced affordance | Database-as-everything mental model (overload) |
| Figma | Mode toggle ("dev mode"), shared shell with persona-specific affordances, file/page/section IA | Vector graphics (not the job here) |
| Webflow | Visual + code parity, "publish" as deliberate action with preview | Hosted CMS lock-in |
| Airtable | Field schema-driven forms (mirror of our `advancedSchema`), template library | Formula language as user-authoring DSL |
| Salesforce Lightning App Builder | Component palette + property panel + responsive preview | Marketing-cloud UI complexity |
| Vanta / Drata / Secureframe | Framework packs as first-class objects, audited badge, evidence chain | Fixed framework set with no authoring |
| Compendia / Simployer / KS HMS | Norwegian terminology, paragraph-anchored content, vedtak → task hand-off | Vendor lock-in to specific HMS taxonomy |
| Shopify | Theme marketplace mechanics (tagging, search, partner program) | E-commerce specifics |

---

## 7. Critical files to touch

**New:**
- `src/lib/studio/studioRegistry.ts`
- `src/lib/studio/studioTypes.ts`
- `src/lib/studio/freshId.ts` (re-export)
- `src/lib/studio/PropertyFormGenerator.tsx`
- `src/lib/studio/PresetPicker.tsx`
- `src/lib/studio/WidgetKindRegistry.ts`
- `src/hooks/{useStudioRevision,useStudioMode,usePartnerOrgs}.ts`
- `src/pages/studio/StudioPage.tsx` (extends `ComplianceStudioPage.tsx`)
- `src/pages/studio/PackEditor.tsx`
- `src/pages/admin/partners/PartnerInvitePage.tsx`
- `src/components/studio/shell/{ScopePicker,PalettePanel,CanvasFrame,
  PropertyInspector,PreviewPane,VersionTimeline,PublishBar,ModeToggle,
  SimpleModeCards,PartnerOrgSwitcher}.tsx`
- `modules/<scope>/studio/<scope>StudioScope.ts` × 7 scopes (compliance,
  survey, documents, learning, meetings, registers, dashboards) + 1
  workflows scope already covered by `workflow-engine-review.md`
- `supabase/functions/{studio-pack-export,studio-pack-import}/index.ts`
- ~6–8 new forward migrations listed in §5

**Refactor (collapse/replace, don't fork):**
- `src/components/reports/ReportModuleWidget.tsx` — replace if-chain
  with `WidgetKindRegistry` lookup
- `src/components/module/dashboard/{DashboardEditWidgetPanel,
  dashboardWidgetKinds}.tsx` — read from registry
- `src/types/reportBuilder.ts` — `ReportModuleKind` becomes a derived
  type from the registry (not a hand-maintained union)
- `src/lib/dashboards/useDashboardLayout.ts` — Zod enum reads from
  registry
- `src/pages/overview/studio/{studioWizardCatalog,studioWizardFactories}.ts` —
  promote to `modules/compliance/studio/`; treat them as the first
  Simple presets for the compliance scope

**Extend (don't parallel-build):**
- `compliance_review_status` enum — used by every scope after Phase 0
- `compliance_notifications` — studio notifications go here
- `compliance-audit-pdf` — share manifest-signing code with
  `studio-pack-export`
- `provision_<module>_baseline_for_org` — called from
  `studio-pack-import`
- `WizardModal` — already supports the field kinds Simple presets need

**Delete after cutover:**
- None initially. Existing module settings template-list pages remain
  as deep-links into `/studio?scope=<scope>`. Re-evaluate after Phase 3.

---

## 8. Reuses (avoid duplication)

- `src/lib/dashboards/dashboardRegistry.ts` — registry pattern + side-
  effect import discipline (already referenced by `workflow-engine-review.md`).
- `src/lib/workflows/workflowRegistry.ts` — declaration-merging
  precedent. Studio uses the same shape with `StudioKindMap`.
- `freshId('studio')` — single mint point; never copy
  `crypto.randomUUID` polyfills.
- `dashboard_layouts` — generic JSON-blob CRUD with named views,
  saveAs, markDefault. Studio reuses it for any layout-bearing
  kind (don't add `studio_layouts`).
- `compliance_review_status` enum — single review-state vocabulary
  across all studio-authored content.
- `compliance_notifications` — single inbox; no parallel
  `studio_notifications`.
- `compliance-audit-pdf` — signed-manifest code shared with pack
  export.
- `WizardModal` field kinds — match Simple preset field kinds 1:1.
- Existing per-module editors — embedded, never replaced.
- Auditor-token pattern from `specs/compliance-planner.md` — reused
  for "show pack to external auditor" if needed.

---

## 9. Verification

End-to-end smoke pass after each phase:

**After Phase 0:**
1. `pnpm typecheck` clean. `ReportModuleKind` is now `keyof StudioKindMap['dashboards']` (or equivalent registry-derived type).
2. Visual regression: all 9 widget kinds render identically on a
   pre-recorded dashboard against `main`.
3. Editing a checklist template writes a `studio_revisions` row;
   `prev_payload` and `next_payload` differ by exactly the edited
   field.
4. `select count(*) from permissions where key like 'studio.%'`
   returns 5.
5. Removing `import './studio/complianceStudioScope'` in dev causes
   the dev startup assertion to log the missing scope.

**After Phase 1:**
6. Open `/studio` as a user with `studio.simple` only. See 21 cards.
   Cannot toggle Advanced (button disabled with tooltip).
7. Grant `studio.advanced`; reload; mode toggle now active; flipping
   persists across logout.
8. Existing `ComplianceStudioPage` URL `/studio` lands on new shell;
   3 compliance wizards (HMS grunnmur, varsling, AMU etablering)
   still complete to the same DB state.
9. Telemetry: complete a preset; verify `studio.preset_completed`
   row in analytics with duration_ms set.

**After Phase 2:**
10. Author "ISO 27001" pack via `/studio` Advanced mode. No SQL
    migration written. Confirm `compliance_packs` row, ≥10 baseline
    templates seeded, dashboard accent flips on `?pack=iso-27001`.
11. Run gap-matrix query from `compliance-planner.md §3` filtered to
    ISO 27001 templates — counts ≥ 0 per included paragraph.
12. Export AML-AMU pack via `studio-pack-export`; import into an
    empty test org; gap matrix identical before/after.
13. Every kind has both `simplePresets.length >= 1` and
    `advancedSchema.fields.length >= 1` — build assertion passes.

**After Phase 3:**
14. Customer admin (only `studio.simple`) creates own-org template;
    confirm `compliance_checklist_templates.is_system = false`
    and the row's `organization_id` matches their org. Cannot edit
    a `is_system = true` row (RLS denial).
15. Partner user with `partner_org_links` to two client orgs:
    switcher renders; switching scopes studio writes to the active
    client's tables. Disconnecting the link revokes access on next
    page load.
16. Submit an edit for review; `review_status='reviewed'`; reviewer
    sees a `compliance_notifications` row; approve flips to
    `'approved'`. "Audited" badge appears only after `audited_at` is
    set via a separate admin action.

**Cross-cutting after every phase:**
17. Migrations idempotent: `scripts/apply-migrations.sh` against a
    clean Supabase project succeeds; re-run is no-op.
18. `select count(*) from studio_revisions where prev_payload =
    next_payload` returns 0 (no spurious revisions).
19. `pnpm lint` clean on touched files.
20. Bundle size: `/studio` first load < 350KB gz. (Per-scope
    embedders lazy-load.)

---

## 10. Open questions (resolve before changing status to ready)

1. **AI/LLM authoring as a v1 add-on?** Auto-draft a checklist from
   "AML § 4-3 + IK-f § 5 nr. 7" prompt, then user edits in Simple
   mode. Likely a Phase 1.5 add-on if it ships. Defer to follow-up
   spec `specs/studio-ai-authoring.md`.
2. **Pack versioning model**: does a published pack become immutable
   on publish (semver bump required for changes) or is it a moving
   target with revision history? Marketplace makes immutable more
   defensible; v1–v3 could go either way. Recommend immutable; needs
   confirmation.
3. **Marketplace gate threshold** — §11 says 100 Pro/Enterprise +
   20 partners. Validate with sales/finance once Pro tier pricing
   lands.
4. **Storybook for kind registry** — invest in visual regression
   tooling now (Phase 0) or defer until kind count > 15? Recommend
   defer; document the visual-diff manual pass in §9.
5. **Norwegian-only locale ceiling** — Phase 4 expansion to SE/DK
   needs locale-aware preset content. Survey `learning_system_course_locales`
   pattern handles courses; do we need a parallel
   `compliance_pack_locales`? Open until first non-NB customer signs.
6. **`studio.advanced` default for whom?** Platform admins only at
   Phase 0; opens to Enterprise tier in Phase 3. Customer-admin
   self-promotion via "I want Advanced" flow needs sales review
   (it's a tier-gating mechanism).
7. **Partner offboarding** — when a client revokes a partner link,
   what happens to in-flight studio drafts authored by the partner?
   Soft-delete with 30d grace? Open.
8. **Mobile preview** — Phase 2 should ship responsive preview in
   the studio shell; full mobile authoring is explicitly out of v1.
   Validate the preview-only stance with sales.

---

## 11. Business framing (strategic justification)

The studio is **enabling infrastructure** for a platform business; the
phasing is a hedge so each phase pays for itself standalone.

### Tier ladder (target product lines)

| Tier | Capability | Studio access | Permission keys | Indicative ARPU lift |
|---|---|---|---|---|
| Standard | Read system content, run compliance | Read-only previews | none | 1× baseline |
| Pro | Edit own-org templates / workflows / courses | Simple mode | `studio.simple` | 2–3× |
| Enterprise | Author org-specific packs, industry verticalisation | Simple + Advanced | `+ studio.advanced + studio.packs` | 5–10× |
| Partner | Multi-tenant studio, N client orgs | Simple + Advanced + partner switcher | `+ studio.partner_admin` | per-seat or rev-share |
| Marketplace | Publish to catalog | Simple + Advanced + listing wizard | `+ studio.marketplace_publish` | rev-share (defer to v4) |

Norwegian SMB baseline: 500–2 000 NOK/user/month. Pro at 3× and
Enterprise at 5–10× is consistent with international compliance/GRC
pricing (Vanta, Drata, Secureframe).

### Defensibility (why this beats green-field competition)

1. **Content moat**: 100 customers × 50 templates each = 5 000 pieces
   of compliance IP locked into the platform. Competitor starts from
   zero.
2. **Regulation moat**: NIS2, CSRD, EU AI Act all need packs in
   2026–2027. Studio = days; SQL migrations = quarters. First-mover
   share per regulation.
3. **Partner moat**: 50+ Norwegian HMS consultants with workflows +
   clients in the platform = an acquisition channel that doesn't
   unwind.

### Channel: consultancy partners (the unlock)

Partner economics: one partner brings 10 client orgs on Pro tier.
Platform earns 10× Pro ARR; partner earns 20–30% rev-share. Partner
replaces hourly consulting with recurring margin; platform pays only
on success; CAC for those 10 orgs ≈ zero.

### Concrete milestones (validation thresholds)

| Horizon | Milestone | Validates |
|---|---|---|
| 6 mo post-launch | 15% on Pro tier; 5 active partners | ARPU lift; channel signal |
| 12 mo | 25% Pro; 3 Enterprise with custom packs; 20 partners; first non-engineering-authored pack | Studio-replaces-SQL loop |
| 18 mo | 50+ packs in catalog; partner-sourced ARR ≥ 25% new ARR | Marketplace gate decision |
| 24 mo | SE/DK locale-aware packs; marketplace soft-launch if metrics support | International + two-sided market |

### Risks (with mitigations now spec-bound)

| Risk | Likelihood | Mitigation (where in this spec) |
|---|---|---|
| Complexity tax — 80% won't use it | High | Simple/Advanced split (§4); telemetry-led promotion (§5 Phase 1) |
| Customer-authored content liability | High | `compliance_review_status` mandatory (§5 Phase 3); "Audited" badge gated (§5 Phase 3) |
| Permission-model sprawl | High | 5 `studio.*` keys (§3); reuse org-membership for partner (§5 Phase 3) |
| Marketplace two-sided cold start | Medium | Defer to Phase 4 (§5); pack artifact shape decided in Phase 2 |
| Channel conflict (partner vs client ownership) | Medium | `partner_org_links` revocable + soft-delete grace (§10 open Q 7) |
| Pricing cannibalisation | Low-Medium | Studio is net-new capability; replaces compliance-lead salary, not existing SaaS line items |
| Norwegian-only ceiling | Medium | `name_i18n` from day one (§3); locale model in §10 open Q 5 |

### When this spec changes

- A new scope opts into the studio → add a row to §2 and a
  scope file in §7.
- The kind registry adds a new field kind → update §4 contract.
- A milestone in §11 lands → mark it ✅ and refresh thresholds.
- Marketplace ships → fork to `specs/studio-marketplace.md` and
  link from §5 Phase 4.

---

## 12. Senior-architect checklist (PLAYBOOK §7)

- [ ] Reference precedent linked for every phase: dashboardRegistry,
      workflowRegistry, ComplianceStudioPage, compliance-planner.
- [ ] Vertical slices verified — each phase ships end-to-end
      capability (DB → types → registry → UI → telemetry → docs).
- [ ] Dependency graph is a DAG — Phase 0 → 1 → 2 → 3, with 4
      conditional on §11 milestones.
- [ ] Acceptance criteria are observable, not implementation-coloured.
- [ ] Open questions enumerated at the top of §10, not buried.
- [ ] Migrations are idempotent (`add column if not exists`,
      `on conflict do update`). Reversible by design — no destructive
      ops.
- [ ] This spec runs without re-reading the PLAYBOOK at execution
      time — it duplicates the task-shape expectations where needed
      and links to §3 explicitly.
- [ ] PLAYBOOK stays generic — module-specific decisions live here,
      not in PLAYBOOK.

Status changes to `📋 ready` only when all eight check.
