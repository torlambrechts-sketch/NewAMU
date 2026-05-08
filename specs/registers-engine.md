# Registers engine — generic record-list module across compliance packs

> **Read this first:** `specs/PLAYBOOK.md` (process spec, capability inventory,
> task shape, checkpoint protocol). Then read `specs/documents-parity.md` —
> registers borrows almost the entire shape of Documents (system catalog +
> per-org overrides + schema-driven editor) and the survey-style provisioning
> chain.

**Reference modules:** documents (`src/hooks/useDocuments.tsx`), survey
(`modules/survey/`), compliance (`modules/compliance/`) — all on `main` after
commit `0b49d87`.
**Target module:** new `modules/registers/` + `src/pages/registers/`.
**Owner of this spec:** human.
**Spec status:** `🚧 in flight — Phase A starting`. OQs resolved 2026-05:
- **OQ-R1: Custom register types in v1** — yes. Build for scalability;
  admins can author their own register types alongside platform-shipped
  ones. The data layer already supports this (`register_types.organization_id`
  is nullable; null = system, set = per-org). v1 ships a basic schema
  editor for the common field kinds (text, number, date, select,
  select_multi, boolean, doc_ref); advanced kinds can layer on later.
- **OQ-R3: Sidebar shape** — match Sjekklister + Undersøkelser.
  Single "Register" NavGroup with `Analyse + Innstillinger` as fixed
  flatSubs, then enabled register types grouped by category (just like
  Survey's pinned templates by category). Same regulation chip filter
  as the rest of the modules.

---

## 1 · One-paragraph framing

Every compliance pack we ship — AML, ISO 9001 / 14001 / 45001, GDPR,
åpenhetsloven, IK-forskriften — boils down to roughly the same set of
artefacts. NewAMU already has the engines for periodic actions
(checklists), surveys, training (læring), documents, and incidents. The
**register** layer is the one piece missing — and it shows up in every
framework: kjemikalier (AML §4-5 + ISO 14001 + REACH), leverandører (ISO
9001 §8.4 + åpenhetsloven §4 + AML §2-2), GDPR Art. 30
behandlingsprotokoll, måleutstyr-kalibrering (ISO 9001 §7.1.5),
miljøaspekter (ISO 14001 §6.1.2), kundeklager, internrevisjon-funn,
CAPA, og så videre. Building one generic registers engine — `register_types`
(catalogue) + `register_records` (per-org rows, schema-driven) — collapses
all of these into a single module. Adding a new compliance pack later
becomes seeding a few `register_types` rows, not new tables / hooks /
pages.

After this port, the org admin sees a `Register` top-level NavGroup whose
sub-items are the enabled register types (Kjemikalier, Leverandører,
Behandlingsprotokoll, …). Each register type is a flat list of records
edited via the same schema-driven panel Documents uses, filtered with the
same `RegulationFilterMenu` chip already on the top bar, analysed via the
same `ModuleAnalyticsDashboard` runtime.

---

## 2 · Mapping table — Documents concept → Registers concept

| Documents (reference) | Registers (target) | Notes |
|---|---|---|
| `document_system_templates` | `register_types` | Platform-shipped catalogue of register kinds (chemicals, suppliers, gdpr_processing_activities, …). Each row carries a `metadata_schema jsonb` describing its record fields, plus `regulation_ids text[]` and `pack_slugs text[]`. |
| `document_org_template_settings` | `register_org_settings` | Per-org enable/disable + name override + category override. Mirrors documents' settings table. |
| `document_org_templates` (per-org custom) | (skip for v1) | Admins can override built-in register types but not author entirely new ones. Defer custom register types to a follow-up — the seed catalogue covers ≥80% of compliance needs. |
| `wiki_pages` | `register_records` | The actual rows. `(organization_id, register_type_id, values jsonb, status enum, review_due_at, owner_user_id, evidence_doc_refs text[])`. |
| `wiki_pages.metadata` | `register_records.values` | Free-form jsonb keyed by the type's `metadata_schema` field keys. Same renderer Documents already uses. |
| `useDocuments` | `useRegisters` (hub-level) + `useRegisterRecords(typeId)` (per-type) | Two hooks because consumers are different shapes (catalogue vs. record list). |
| `documentDashboardScope` | `registersDashboardScope` | KPIs: records by status, reviews overdue, missing required fields, by category. |
| `provision_documents_baseline_for_org` | `provision_registers_baseline_for_org` | Same recovery pattern. Seeds `register_org_settings` rows for every active register_type when an org is created or licenses a new pack. |
| `useDocumentNav` | `useRegistersNav` | Returns enabled register types (= sub-items in the sidebar) + categories. |

---

## 3 · Capability map (playbook §4 → registers)

| Capability | Decision | Rationale |
|---|---|---|
| **C-1 Categories DB + admin** | ✅ in scope | New `register_categories` per org — same shape as `learning_categories`. Admin can group register types in the hub + sidebar (e.g. "Personvern" group with GDPR registers, "Leverandører" group with supplier + due-diligence). |
| **C-2 Categories discovery (hub + sidebar)** | ✅ in scope | Mirror Documents: pinned-types-by-category in the sidebar, hub tiles sectioned by category. |
| **C-3 Sidebar Settings + Analyse fixed children** | ✅ in scope | Two fixed `flatSubs`: Analyse + Innstillinger. Pinned register types follow under their category headers. |
| **C-4 `/registers/analyse` page + registry** | ✅ in scope | KPIs: records per type, reviews overdue, by status, by category. |
| **C-5 Editable metadata post-lock** | ❌ N/A | Records don't have a sign event. Status changes (draft → active → archived) are reversible. Audit trail via `register_record_revisions` (NEW, but trivial). |
| **C-6 Org-context FKs on instances** | ⚠️ partial | `register_records.owner_user_id` and `record.values.location_id` (when the type's schema declares it). No mandatory FKs across all types — one of the points of this engine is that schemas vary. |
| **C-7 Type `metadata_schema`** | ✅ in scope | The single most important column on `register_types`. Drives the form, the table columns, the filter chips, the CSV export. |
| **C-8 Schema-driven UI** | ✅ in scope | Reuse `DocumentMetadataPanel` (or extract into `MetadataSchemaForm` shared primitive). Same renderer; new consumer. |
| **C-9 Analytics filter dimensions** | ✅ in scope | Common: register_type, status, owner, regulation, category, review-due bucket. Type-specific filters (e.g. CAS number for chemicals) are out of scope for the cross-cutting analyse page; per-type list pages handle those via the `Alle X` chip-filter pattern. |

**Registers-specific capabilities** (not in PLAYBOOK §4):

| Capability | Decision | Rationale |
|---|---|---|
| **R-1 Pack-membership on register types** | ✅ in scope | `register_types.pack_slugs text[]` — when an org licenses a new pack, the provision trigger enables only the matching types. |
| **R-2 Cross-regulation linking** | ✅ in scope | `register_types.regulation_ids text[]` (multi). One register type can serve multiple regulations (chemicals → AML §4-5 + ISO 14001 + REACH simultaneously). The `RegulationFilterMenu` already on the top bar narrows the visible types. |
| **R-3 Review cadence + due reminders** | ✅ in scope | `register_records.review_due_at` driven by the type's `default_review_cadence_months` (override per record). Surfaces in dashboard KPI + Notification tray. |
| **R-4 Evidence attachments** | ✅ in scope | `register_records.evidence_doc_refs text[]` linking to `wiki_pages` ids. SDS files, contracts, audit reports — Documents already stores them. |
| **R-5 Custom register types (admin-authored)** | ✅ in scope | OQ-R1 resolved: build for scalability. Admin authors register types via a schema-builder UX in `/registers/admin`. v1 supports the common field kinds (text, number, date, select, select_multi, boolean, doc_ref); advanced kinds (location_multi, conditional fields, formula columns) can layer on later. |

**Reduced scope:** C-5 dropped (no sign event); custom types deferred (R-5).
Total tasks: T1–T9 across three phases.

---

## 4 · Dependency graph

```
T1 (DB schema: register_types + register_records + register_categories
    + register_org_settings + revisions)
  └─ T2 (TypeScript types + Zod schemas + useRegisters / useRegisterRecords
         hooks)
       ├─ T3 (Seed first three register types: chemicals / suppliers /
       │     gdpr_processing_activities — proves the engine across packs)
       │    └─ T6 (Provision trigger + recovery bundle)
       └─ T4 (RegistersHubPage = list of enabled types as tiles +
              `Alle / Analyse / Innstillinger`)
            └─ T5 (RegisterRecordListPage + RegisterRecordDetailPage —
                   schema-driven form, mirrors Documents editor)
                 └─ T7 (Analyse page + dashboardRegistry scope)
                      └─ T8 (Sidebar nav: registers NavGroup + useRegistersNav)
                           └─ T9 (TS + lint + smoke tests; verify the three
                                   seeded types render correctly + filter
                                   correctly via the regulation chip)
```

Phase A · T1 + T2 (foundations)
🛑 Ship checkpoint
Phase B · T3 + T4 + T5 + T6 (engine + first records can be authored)
🛑 Ship checkpoint
Phase C · T7 + T8 + T9 (analytics + nav + verification)

---

## 5 · Tasks (T1–T9 fleshed out elsewhere — this section captures the non-obvious choices)

### Task T1 · DB schema

```sql
create table public.register_types (
  id              text primary key,                    -- e.g. 'chemicals'
  organization_id uuid null references public.organizations on delete cascade,
                                                       -- null = system-shipped
  name            text not null,
  description     text,
  metadata_schema jsonb not null default '{"fields":[]}',
  regulation_ids  text[] not null default '{}',        -- multi (R-2)
  pack_slugs      text[] not null default '{}',        -- multi (R-1)
  default_review_cadence_months integer,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.register_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  regulation_id   text references public.regulations,    -- two-level taxonomy
  position        integer not null default 0,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.register_org_settings (
  organization_id     uuid not null references public.organizations on delete cascade,
  register_type_id    text not null references public.register_types on delete cascade,
  enabled             boolean not null default true,
  name_override       text,
  category_id         uuid references public.register_categories on delete set null,
  nav_pinned          boolean not null default true,
  primary key (organization_id, register_type_id)
);

create table public.register_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  register_type_id text not null references public.register_types on delete restrict,
  values          jsonb not null default '{}',
  status          text not null default 'active'
                  check (status in ('draft', 'active', 'archived')),
  review_due_at   date,
  owner_user_id   uuid references auth.users,
  evidence_doc_refs text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index register_records_org_type_idx
  on public.register_records (organization_id, register_type_id)
  where deleted_at is null;
create index register_records_review_due_idx
  on public.register_records (organization_id, review_due_at)
  where deleted_at is null and review_due_at is not null;

create table public.register_record_revisions (
  id              uuid primary key default gen_random_uuid(),
  record_id       uuid not null references public.register_records on delete cascade,
  values_before   jsonb not null,
  values_after    jsonb not null,
  changed_by      uuid references auth.users,
  changed_at      timestamptz not null default now()
);
```

### Task T3 · Seed register types — proves the engine across packs

Three system rows that demonstrate the breadth:

| `id` | regulation_ids | pack_slugs | Schema highlights |
|---|---|---|---|
| `chemicals` | `aml`, `iso-14001`, `reach` | `aml-amu`, `iso-45001`, `iso-14001` | name, cas_number, h_phrases, p_phrases, hazard_pictograms, sds_attachment, locations, review cadence |
| `external_suppliers` | `iso-9001`, `apenhetsloven`, `aml` | `iso-9001`, `apenhetsloven`, `aml-amu` | name, org_number, criticality, due_diligence_status, contract_doc, last_audit_at |
| `gdpr_processing_activities` | `gdpr` | `gdpr` | purpose, legal_basis, data_categories, data_subjects, retention_period, processor_contracts, transfer_outside_eea |

These three prove:
- Regulation_ids works as multi (R-2): chemicals serve three regs.
- Pack_slugs works as multi (R-1): chemicals enabled when *any* of three packs licensed.
- A single-regulation register works (gdpr): no special-casing required.

### Task T7 · Analyse page

KPIs from `register_records` aggregates (cross-cutting, not per-type):
- Total active records (KPI)
- Records by type (bar)
- Records by status (donut)
- Reviews overdue + due-30d (KPI + line over time)
- Records by regulation (bar — cross-regulation reach)

Filter chips: `register_type`, `regulation`, `category`, `status`, `owner`,
`review_due` (date range).

### Task T8 · Sidebar

```
Register
├── Analyse
├── Alle records (cross-type flat list)
├── Innstillinger (manage register types + categories)
├── ─── per category ───
├── Personvern
│   └── Behandlingsprotokoll
├── Leverandører
│   ├── Eksterne leverandører
│   └── Aktsomhetsvurderinger
├── Kjemikalier
│   └── Kjemikalieregister
└── …
```

Same `flatSubs` + `useRegistersNav` shape as Survey/Documents/Læring.

---

## 6 · Acceptance criteria for the *whole* engine

After T1–T9:
- [ ] Three system register types (chemicals / suppliers / gdpr_processing_activities) load + render their schema-driven forms
- [ ] A new org with no pack-licensed yet sees no register types in the sidebar; licensing AML auto-enables chemicals
- [ ] The `RegulationFilterMenu` on the top bar narrows visible register types when AML / ISO / GDPR is toggled
- [ ] `/registers/analyse` shows KPIs aggregated across all enabled types
- [ ] CSV export per type works via the existing `widgetCsv` engine
- [ ] Adding a fourth register type (e.g. `customer_complaints` for ISO 9001 §10.2) is a single migration row + zero code change
- [ ] No regression on the existing five module sidebars

---

## 7 · How adding a fourth pack works (the test of modularity)

When ISO 9001 is later licensed to an org:

1. Migration adds the pack to `compliance_packs` (existing pattern).
2. Migration seeds three new `register_types` rows: `customer_complaints`,
   `internal_audit_findings`, `calibration_register`. Each carries
   `pack_slugs: ['iso-9001']` and the right `regulation_ids`.
3. The existing `provision_registers_baseline_for_org` trigger (or
   re-runnable bundle) auto-enables those types for every org with the
   pack flag flipped on.

**No new tables. No new pages. No new hooks. No new sidebar code.**

That's the test the architecture has to pass.

---

## 8 · Stretch (after the engine lands)

- **Custom register types (R-5)** — admin schema-editor UX
- **Workflow layer per type** — some registers (incidents, complaints,
  CAPA) need a state machine on top of the static record. Pattern: a
  separate `register_workflows` table keyed by `register_type_id` with
  states + transitions defined in jsonb. Out of scope for the engine.
- **Bulk import** — CSV upload for chemicals (orgs migrating from
  Stoffkartoteket / Eccoflo) and suppliers (CSV from procurement). Per-
  type CSV adapters.
- **External integrations** — REACH/CLP database lookup for chemical
  H/P-phrases; Brønnøysund-API for supplier org_number lookup. One
  hook per integration, gated by per-type config.

---

## 9 · Open questions

| ID | Question | Notes |
|---|---|---|
| OQ-R1 | Custom (per-org) register types in v1, or only system catalogue? | Spec assumes only system catalogue (deferred R-5). One-week saving but admins won't be able to author "vehicle register" type without code. |
| OQ-R2 | Should `register_records.values` validation happen DB-side or app-side? | App-side (zod) only for v1. DB-side jsonb-schema validation is supabase-extension territory. |
| OQ-R3 | Per-type sidebar tiles vs. one sidebar tile per category? | Spec assumes per-category headers with the type names underneath, matching the four parity-ported modules. Could collapse to one sidebar entry "Register" with an inline type picker if it gets too long. |
| OQ-R4 | Cross-type "Alle records" page useful, or skip? | Skip if no clear use case after building. Per-type "Alle X" is the primary surface. |
| OQ-R5 | Audit trail — `register_record_revisions` always-on, or opt-in per type? | Always-on; the table is cheap, and compliance demands it for half the types. |

Resolve OQ-R1 + OQ-R3 minimum before T1 commits. The rest can resolve
during execution.
