# ISO IMS Implementation Plan
## Integrated Management System: ISO 9001 · ISO 14001 · ISO 45001 · ISO 27001

**Status:** 📋 planned — ready for sprint sequencing  
**Date:** 2026-05-18  
**Audience:** Senior architect, lead developer, PM, UX designer  
**Scope:** Full four-standard IMS — phased over four quarters

---

## 0. Executive Summary

NewAMU already satisfies a substantial portion of the Harmonized Structure (Annex SL) requirements that underpin all four ISO standards. The platform has document control, audit checklists, CAPA-via-tasks, management review meetings, training records, and a regulation taxonomy that already seeds `iso-9001`, `iso-14001`, `iso-45001`, and `iso-27001` as first-class regulation IDs.

The gap is not the engine — the engine is proven. The gap is:
1. **Four new compliance packs** (iso-9001, iso-14001, iso-27001 fully seeded; iso-45001 already exists)
2. **Four standard-specific registers** (Environmental Aspects, HIRA, IS Asset + Risk, Legal Compliance)
3. **A cross-standard Gap Analysis engine** (clause-by-clause structured checklist → score → action)
4. **A Statement of Applicability builder** (ISO 27001 mandatory)
5. **An IMS composite dashboard** (one page, all four standards' health in one view)
6. **A public-facing ISO compliance portal page** per org (auditor read-only view)

Competitive positioning: no Norwegian-language platform does this. The mid-market Norwegian SME needing ISO 9001 + ISO 45001 + ISO 14001 (increasingly ISO 27001) as an IMS in one tool, in Norwegian, integrated with AML compliance, is completely underserved. This is a EUR 2–4k/year/org expansion of ARPU requiring ~3 months of focused engineering.

---

## 1. Standards vs Current Module Mapping

### 1.1 The Harmonized Structure advantage

All four standards share Clauses 4–7, 9, and 10 verbatim at structure level. The platform already implements these generically:

| ISO Clause | Topic | NewAMU Module | Status |
|---|---|---|---|
| 4.1–4.4 | Context, Scope, Processes | Documents (scope doc), Registers | ⚠️ partial — no formal scope/context doc type |
| 5.1–5.3 | Leadership, Policy, Roles | Documents (policy), Meetings (leadership) | ✅ exists via document templates + meetings |
| 5.2 | Policy | Documents — system templates | ✅ policy doc templates exist |
| 6.1.1 | Risks & Opportunities (generic) | Registers (risk), Tasks | ⚠️ generic risk view — not standard-specific |
| 6.2 | Objectives | Tasks (objectives as tasks), Meetings | ⚠️ no dedicated objectives module |
| 7.2 | Competence | Learning (course completion records) | ✅ full learning module |
| 7.3 | Awareness | Learning + Survey | ✅ |
| 7.4 | Communication | Meetings, Alerts | ✅ |
| 7.5 | Documented Information | Documents (wiki) | ✅ version control, approval workflow |
| 9.1 | Monitoring & Measurement | Dashboard analytics | ✅ per-module KPI dashboards |
| 9.2 | Internal Audit | Compliance Checklists | ✅ reusable as audit protocols |
| 9.3 | Management Review | Meetings (ISO 9001/14001/45001/27001 templates seeded) | ✅ templates exist, databindings wired |
| 10.2 | Nonconformity & Corrective Action | Tasks (CAPA) + Alerts | ✅ tasks = corrective actions; alerts = nonconformity capture |

### 1.2 Standard-specific gaps

| ISO Clause | Topic | Standard | Gap | Priority |
|---|---|---|---|---|
| 6.1.2 | Environmental Aspects & Impacts Register | 14001 | No register type exists | P1 |
| 6.1.2 | HIRA (Hazard Identification & Risk Assessment) | 45001 | Existing risk module is generic; no HIRA schema | P1 |
| 6.1.2 | IS Risk Assessment (Asset × Threat × Vulnerability) | 27001 | No IS risk table | P1 |
| 6.1.3 | Legal/Compliance Register with evaluation workflow | 14001, 45001 | Register module exists but no evaluation workflow | P1 |
| 6.1.3(d) | Statement of Applicability (93 Annex A controls) | 27001 | Does not exist | P1 |
| 6.1.3 | IS Risk Treatment Plan | 27001 | Does not exist | P1 |
| 4.4 | Process Library (process map with inputs/outputs/owners) | 9001 | No process library | P2 |
| 8.4 | Supplier/External Provider Register + performance | 9001 | No supplier register | P2 |
| 8.1.3 | Management of Change workflow | 9001, 45001 | Change management workflow not formalized | P2 |
| 5.4 | Worker Consultation & Participation Records | 45001 | Survey can serve this; no explicit record type | P3 |
| 8.2 | Emergency Preparedness Register + drill records | 14001, 45001 | No emergency scenario register | P3 |
| 9.2 | Gap Analysis engine (clause-by-clause, RAG scoring) | all | No gap analysis flow | P1 |
| — | IMS composite dashboard | all | No cross-standard dashboard scope | P1 |
| — | Auditor read-only portal (signed URL) | all | No auditor view (ROADMAP 5.3 deferred) | P2 |
| — | ISO 9001/14001/27001 compliance packs (seeded templates) | 9001, 14001, 27001 | Only iso-45001 pack fully seeded | P1 |

---

## 2. Architecture Design

### 2.1 Core principle: extend, don't replace

Every new ISO feature slots into an existing engine:
- **Compliance packs** — new packs (`iso-9001`, `iso-14001`, `iso-27001`) following the `iso-45001` pattern
- **Registers** — new system `register_types` for each standard-specific register (HIRA, Environmental Aspects, IS Assets, Supplier, Legal Compliance, Emergency Preparedness)
- **Gap analysis** — a structured compliance checklist where each item = one ISO clause; scoring is the existing KPI aggregation
- **SoA** — a special register type for ISO 27001's 93 Annex A controls, with per-org applicability rows
- **IMS dashboard** — a new composite scope following the `hms_overview` pattern

### 2.2 New compliance packs

Three new packs added to `compliance_pack` enum:

```sql
alter type compliance_pack add value if not exists 'iso-9001';
alter type compliance_pack add value if not exists 'iso-14001';
alter type compliance_pack add value if not exists 'iso-27001';
```

Each pack gets:
- **Seeded checklist templates** (one per main clause group: 4, 5, 6, 7, 8, 9, 10)
- **Categories** seeded in `compliance_checklist_categories` (per clause section)
- **Provision function** `provision_compliance_baseline_for_org(org, 'iso-9001')` mirroring the existing iso-45001 provisioner
- **Pack accent** registered in `packAccents.ts`:
  - `iso-9001`: `#0369a1` (Quality blue)
  - `iso-14001`: `#15803d` (Environment green)
  - `iso-27001`: `#7c3aed` (Security purple)
- **Dashboard scope registration** alongside the existing `compliance_checklist` scope — filtered by pack

### 2.3 New register types (system-seeded)

Six new register types added via migration, following `20260828120042_registers_seed_and_provision.sql`:

```
iso-14001-environmental-aspects   — Environmental Aspects & Impacts Register
iso-45001-hira                    — Hazard Identification & Risk Assessment
iso-27001-asset-register          — Information Asset Register
iso-27001-risk-register           — IS Risk Assessment Register
iso-27001-risk-treatment          — Risk Treatment Plan
iso-legal-compliance              — Legal/Compliance Obligation Register (shared 14001+45001)
supplier-register                 — Supplier & External Provider Register (9001+14001+45001)
emergency-preparedness            — Emergency Preparedness Scenarios (14001+45001)
```

Each register type has:
- `regulation_ids text[]` linking to the relevant ISO regulation IDs
- `metadata_schema jsonb` declaring the specific fields for that register type
- `org_id IS NULL` = system template visible to all orgs
- Toggleable per org via `register_org_settings`

### 2.4 New tables for ISO-specific data structures

#### 2.4.1 Statement of Applicability (ISO 27001)

```sql
-- System table: all 93 Annex A controls (2022 edition), seeded once
create table if not exists iso_27001_annex_a_controls (
  id          text primary key,                    -- e.g. 'A.5.1'
  theme       text not null,                       -- 'Organizational' | 'People' | 'Physical' | 'Technological'
  theme_code  text not null,                       -- '5' | '6' | '7' | '8'
  title       text not null,
  description text,
  is_new_2022 boolean not null default false,
  sort_order  int not null
);

-- Per-org applicability (the actual SoA)
create table if not exists iso_27001_soa (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id),
  control_id          text not null references iso_27001_annex_a_controls(id),
  applicable          boolean not null default true,
  justification       text,                        -- required if applicable = false
  implementation_status text not null default 'not_implemented'
                      check (implementation_status in ('not_implemented','planned','implemented','tested')),
  owner_member_id     uuid references organization_members(id),
  implementation_date date,
  policy_doc_id       uuid references wiki_pages(id),
  risk_ids            text[],                      -- links to iso_risk_register rows
  notes               text,
  updated_at          timestamptz not null default now(),
  constraint iso_27001_soa_org_control unique (organization_id, control_id)
);
```

#### 2.4.2 IS Risk Assessment (ISO 27001)

```sql
-- Extends the existing registers engine; stored as register entries
-- but with a well-known schema on the iso-27001-risk-register type.
-- Fields in metadata jsonb:
--   asset_type, asset_name, threat, vulnerability,
--   confidentiality_impact (1-5), integrity_impact (1-5), availability_impact (1-5),
--   likelihood (1-5), risk_score (computed: max(CIA) × likelihood),
--   treatment ('reduce'|'avoid'|'transfer'|'accept'),
--   annex_a_controls text[],  -- links to iso_27001_annex_a_controls.id
--   residual_risk_score, risk_owner_member_id, treatment_due_date, status
```

#### 2.4.3 Environmental Aspects & Impacts (ISO 14001)

```sql
-- Stored as register entries with iso-14001-environmental-aspects type.
-- Fields in metadata jsonb:
--   activity_or_product, aspect, impact, condition ('normal'|'abnormal'|'emergency'),
--   lifecycle_stage ('upstream'|'own_operations'|'downstream'),
--   scale (1-3), severity (1-3), probability (1-3),
--   significance_score (computed), is_significant boolean,
--   controls text, linked_objective_task_id uuid,
--   next_review_date date
```

#### 2.4.4 HIRA — Hazard Identification & Risk Assessment (ISO 45001)

```sql
-- Stored as register entries with iso-45001-hira type.
-- Extends existing risk_register_unified_view concept.
-- Fields in metadata jsonb:
--   hazard_source, location_id, activity,
--   exposed_persons ('workers'|'contractors'|'visitors'|'public'),
--   existing_controls,
--   initial_likelihood (1-5), initial_severity (1-5), initial_risk_score,
--   hierarchy_controls_level ('elimination'|'substitution'|'engineering'|'administrative'|'ppe'),
--   additional_controls,
--   residual_likelihood (1-5), residual_severity (1-5), residual_risk_score,
--   responsible_member_id, due_date,
--   linked_incident_alert_id uuid,
--   status ('open'|'controls_implemented'|'closed'), next_review_date
```

#### 2.4.5 Gap Analysis Engine

```sql
-- System table: all clauses per standard, pre-seeded
create table if not exists iso_standard_clauses (
  id            text primary key,                   -- e.g. 'iso-9001-4.1'
  standard_id   text not null,                      -- 'iso-9001' | 'iso-14001' | 'iso-45001' | 'iso-27001'
  clause_number text not null,                      -- '4.1'
  title         text not null,
  description   text,
  guidance      text,                               -- what evidence typically satisfies this
  sort_order    int not null
);

-- Per-org gap analysis sessions
create table if not exists iso_gap_analysis (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  standard_id     text not null,
  session_name    text not null,
  conducted_at    date,
  conducted_by    uuid references organization_members(id),
  status          text not null default 'in_progress'
                  check (status in ('in_progress','completed')),
  created_at      timestamptz not null default now()
);

-- Per-clause responses in a gap analysis session
create table if not exists iso_gap_analysis_responses (
  id               uuid primary key default gen_random_uuid(),
  gap_analysis_id  uuid not null references iso_gap_analysis(id) on delete cascade,
  organization_id  uuid not null references organizations(id),
  clause_id        text not null references iso_standard_clauses(id),
  compliance_level text not null default 'not_assessed'
                   check (compliance_level in ('not_assessed','compliant','partial','not_compliant','not_applicable')),
  evidence_notes   text,
  linked_doc_id    uuid references wiki_pages(id),
  linked_task_id   uuid references tasks(id),
  action_required  boolean not null default false,
  updated_at       timestamptz not null default now()
);
```

### 2.5 IMS Dashboard scope

New composite scope `iso_ims` registered in `modules/iso/dashboards/isoImsDashboardScope.ts`:

```typescript
registerDashboardScope({
  scopeId: 'iso_ims',
  label: 'ISO IMS',
  accent: '#1e40af',                        // IMS blue (distinct from all module accents)
  compositeMembers: ['compliance_checklist', 'tasks', 'learning', 'documents', 'meetings'],
  defaultLayout: [
    // Row 1: four standard health KPIs
    { kind: 'kpi', datasetKey: 'iso_9001_gap_score',   ... },
    { kind: 'kpi', datasetKey: 'iso_14001_gap_score',  ... },
    { kind: 'kpi', datasetKey: 'iso_45001_gap_score',  ... },
    { kind: 'kpi', datasetKey: 'iso_27001_gap_score',  ... },
    // Row 2: open CAPAs by standard (bar), objectives progress (bar)
    { kind: 'bar',    datasetKey: 'iso_open_capas_by_standard', ... },
    { kind: 'bar',    datasetKey: 'iso_objectives_achievement',  ... },
    // Row 3: recent audit findings (table), upcoming audit schedule (table)
    { kind: 'table',  datasetKey: 'iso_recent_audit_findings',  ... },
    { kind: 'table',  datasetKey: 'iso_audit_schedule',          ... },
    // Row 4: legal compliance heat (14001+45001), HIRA risk matrix (45001)
    { kind: 'heatmap', datasetKey: 'iso_legal_compliance_status', ... },
    { kind: 'heatmap', datasetKey: 'iso_hira_risk_matrix',        ... },
  ],
  widgetCatalog: [
    // Standard health
    'iso_9001_gap_score', 'iso_14001_gap_score', 'iso_45001_gap_score', 'iso_27001_gap_score',
    'iso_soa_implementation_rate',        // 27001: % controls implemented
    'iso_significant_aspects_count',      // 14001: # significant environmental aspects
    'iso_hira_high_risk_open',            // 45001: # uncontrolled high risks
    // Cross-module
    'iso_open_capas_by_standard', 'iso_capas_by_status', 'iso_overdue_capas',
    'iso_objectives_achievement', 'iso_objectives_by_standard',
    'iso_audit_schedule', 'iso_recent_audit_findings', 'iso_audit_nc_trend',
    'iso_management_review_actions_open',
    'iso_training_completion_by_regulation',
    'iso_document_review_overdue',
    'iso_legal_compliance_status',
    'iso_hira_risk_matrix',
    'iso_supplier_performance',
  ],
  datasets: [ /* defined in useImsDatasets.ts */ ],
  dimensions: [
    { key: 'standard',   label: 'Standard',  kind: 'multi-select', options: ['iso-9001','iso-14001','iso-45001','iso-27001'] },
    { key: 'status',     label: 'Status',    kind: 'select' },
    { key: 'department', label: 'Avdeling',  kind: 'org-context' },
    { key: 'period',     label: 'Periode',   kind: 'date-range' },
  ],
})
```

### 2.6 Navigation additions

In `AticsShell.tsx`, add a new top-level `NavGroup` between HMS-oversikt and Sjekklister:

```
ISO IMS (/iso)
  ├─ Oversikt (IMS composite dashboard)
  ├─ Analyse (IsoImsAnalysePage)
  ├─ Gapanalyse (/iso/gap-analysis)
  │     ├─ ISO 9001
  │     ├─ ISO 14001
  │     ├─ ISO 45001
  │     └─ ISO 27001
  ├─ Registre (/iso/registers)
  │     ├─ Miljøaspekter (14001)
  │     ├─ Risikovurdering HIRA (45001)
  │     ├─ Informasjonsaktiva (27001)
  │     ├─ IS Risikovurdering (27001)
  │     ├─ Lovregister (14001 + 45001)
  │     └─ Leverandørregister (9001)
  ├─ SoA – Statement of Applicability (/iso/soa) [27001 only, shown when 27001 active]
  ├─ Mål & Handlingsplaner (/iso/objectives)
  └─ Innstillinger (/iso/settings)
        ├─ Standarder i bruk (which of the 4 are active)
        └─ Sertifiseringsstatus (certification body, next audit date)
```

Permission key: `ISO_NAV_PERMS: ['view:iso', 'manage:iso']`

### 2.7 ISO settings per organization

```sql
create table if not exists organization_iso_settings (
  organization_id    uuid primary key references organizations(id),
  active_standards   text[] not null default '{}',  -- subset of {iso-9001, iso-14001, iso-45001, iso-27001}
  scope_document_id  uuid references wiki_pages(id), -- link to IMS scope document
  policy_doc_id      uuid references wiki_pages(id), -- link to IMS policy document
  certification_body text,
  next_audit_date    date,
  last_audit_date    date,
  certification_status text check (certification_status in ('not_certified','pursuing','certified','surveillance','recertification')),
  notes              text,
  updated_at         timestamptz not null default now()
);
```

---

## 3. Compliance Pack Seeding — ISO 9001 (detailed blueprint)

This is the model migration for all three new packs. ISO 14001 and 27001 follow the same pattern.

### 3.1 Categories (clause groups)

```sql
-- Seeded into compliance_checklist_categories for pack='iso-9001'
-- Clause 4  — Kontekst
-- Clause 5  — Lederskap
-- Clause 6  — Planlegging
-- Clause 7  — Støtte
-- Clause 8  — Drift
-- Clause 9  — Ytelsesmåling
-- Clause 10 — Forbedring
```

### 3.2 Template items (clause 9.2 — Internal Audit, as example)

```jsonc
// Template: "ISO 9001 — Intern revisjon (9.2)"
// Category: Ytelsesmåling
// law_refs: ["ISO 9001:2015 § 9.2"]
{
  "items": [
    {
      "id": "9.2-a",
      "label": "Er det etablert et revisjonsprogram som dekker hele KLS-en?",
      "iso_clause": "9.2.2a",
      "law_ref": "ISO 9001:2015 § 9.2.2a",
      "finding_kind": "text",
      "required": true
    },
    {
      "id": "9.2-b",
      "label": "Er revisorutvalg og revisjonskriterier definert?",
      "iso_clause": "9.2.2b",
      "law_ref": "ISO 9001:2015 § 9.2.2b",
      "finding_kind": "text",
      "required": true
    },
    {
      "id": "9.2-c",
      "label": "Foreligger dokumentert informasjon fra revisjonsprogrammet og revisjonsfunnene?",
      "iso_clause": "9.2.2f",
      "law_ref": "ISO 9001:2015 § 9.2.2f",
      "finding_kind": "text",
      "required": true
    }
  ]
}
```

### 3.3 Migration header (Arbeidstilsynet-style self-audit for ISO context)

```sql
/*
  ISO 9001:2015 — Compliance pack baseline
  Gap closed: No ISO 9001 checklist templates existed. Organizations pursuing 
  ISO 9001 certification had no audit protocols aligned to clauses 4–10.
  Self-audit:
    Clause addressed: all of 9001:4–10 (structured as 7 audit templates).
    Restrisiko deferred: 
      - Clause 8 (Operation) templates are generic; product/service-specific 
        items must be added by the org (by design — 9001 § 8 is org-specific).
      - No supplier register integration (P2 roadmap item).
  Idempotent: on conflict (organization_id, slug) do update set ...
  Backfill: loops over all organizations that have set iso-9001 as active standard.
*/
```

---

## 4. Gap Analysis Engine — Flow Design

### 4.1 User flow

```
/iso/gap-analysis
  └─ Choose standard → [ISO 9001] [ISO 14001] [ISO 45001] [ISO 27001]

/iso/gap-analysis/iso-9001
  └─ Sessions list → [New gap analysis] [View previous sessions]

/iso/gap-analysis/iso-9001/new
  └─ Wizard:
       Step 1: Session name, conducted by, date
       Step 2: Clause-by-clause assessment
              For each clause:
                ● Compliance: [Compliant ✅] [Partial ⚠️] [Non-compliant ❌] [N/A]
                ● Evidence notes (text)
                ● Link document / task (optional)
                ● "Create action" button → spawns task with clause ref
       Step 3: Summary & export
              ● Clause coverage heatmap (Red/Amber/Green per clause group)
              ● Overall score (%)
              ● Open action items
              ● PDF/CSV export
```

### 4.2 Scoring algorithm

```typescript
type ClauseScore = 'compliant' | 'partial' | 'not_compliant' | 'not_applicable' | 'not_assessed';

const scoreWeights: Record<ClauseScore, number> = {
  compliant:       1.0,
  partial:         0.5,
  not_compliant:   0.0,
  not_applicable:  1.0,  // N/A doesn't penalise
  not_assessed:    0.0,  // unassessed = zero until assessed
};

// Section score = avg of clause scores in that section
// Overall score = weighted avg across all sections
// Dashboard KPI: iso_9001_gap_score = { value: 73, unit: '%', label: 'ISO 9001 Dekningsgrad' }
```

### 4.3 Gap analysis as compliance checklist

The gap analysis engine IS the compliance checklist engine, used with a special `pack='iso-9001-gap'` template type. Each ISO clause = one checklist item. The existing execution/response tables handle the storage. The new `iso_standard_clauses` system table drives the item definitions rather than a manually seeded JSON blob — giving structured clause lookup across the platform.

The difference from a standard checklist:
- Items are system-defined (from `iso_standard_clauses`), not editable by org
- Finding options map to compliance_level (compliant/partial/not_compliant/N/A) not just text
- Scoring is computed differently (weighted % vs pass/fail count)
- Results drive a heatmap widget rather than a findings list

---

## 5. Statement of Applicability — Feature Design (ISO 27001)

### 5.1 The SoA page (`/iso/soa`)

```
ISO 27001 — Statement of Applicability

[Filter by theme] [Filter by status] [Export PDF] [Export Excel]

┌─────────────────────────────────────────────────────────────────────────┐
│ Theme 5 — Organisatoriske tiltak                          37 controls   │
├──────┬────────────────────────────────┬─────────┬──────────┬────────────┤
│ A.5.1│ Retningslinjer for IS          │ ✅ Inkl.│ Impl.    │ Crit. Mgr  │
│ A.5.2│ IS-roller og ansvar            │ ✅ Inkl.│ Impl.    │ IT-sjef    │
│ A.5.7│ Trusselintelligens             │ ✅ Inkl.│ Planlagt │ IT-sjef    │
│ A.5.8│ IS i prosjektledelse           │ ⚠️ Ekskl.│ N/A — [Begrunnelse: Ingen prosjektutvikling]
│ ...  │                                │         │          │            │
└──────┴────────────────────────────────┴─────────┴──────────┴────────────┘
```

### 5.2 Per-control edit panel (slide-over)

```
A.5.7 — Trusselintelligens                                         [Ny 2022]

Inkludert i ISMS: ● Ja  ○ Nei

Begrunnelse for ekskludering: [—]

Implementeringsstatus:
  ○ Ikke implementert
  ● Planlagt (frist: 2026-09-01)
  ○ Implementert
  ○ Testet og bekreftet

Kontrolleier: [Søk etter person...]

Tilknyttede risikoer: [#IS-23 Phishing via e-post]  [Legg til risiko...]

Tilknyttet dokument/prosedyre: [wiki_pages søk...]

Notater: [fritekst]
```

### 5.3 SoA completeness KPI

Dashboard widget: `iso_soa_implementation_rate`
```
93 kontroller
├─ 67 implementert  (72%)
├─ 12 planlagt      (13%)
├─ 8  ikke impl.    (9%)
└─ 6  ekskludert    (6%)
```

---

## 6. UX Design — ISO IMS Dashboard Page

### 6.1 Page layout: `/iso` (IMS Overview)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ISO IMS                                    [Analyse ▾] [Eksporter] [⚙]     │
│  Integrert styringssystem — Aktive standarder: ISO 9001 · ISO 14001 · 45001 │
├─────────────┬──────────────┬──────────────┬──────────────────────────────────┤
│ ISO 9001    │ ISO 14001    │ ISO 45001    │ ISO 27001                         │
│ Dekningsgrad│ Dekningsgrad │ Dekningsgrad │ SoA Implementering                │
│   73%  ▲4  │   61%  ▲2   │   88%  ▲1   │   72%  ─                          │
│ [Vis detaljer]│[Vis detaljer]│[Vis detaljer]│ [Vis SoA]                       │
├─────────────┴──────────────┴──────────────┴──────────────────────────────────┤
│                                                                               │
│  Åpne avvik per standard          Mål & handlingsplaner                      │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │ 9001  ████░░░░░ 12 åpne  │    │ ● ISO 9001: Kundeklagehåndtering 80%│   │
│  │ 14001 ██░░░░░░░  4 åpne  │    │ ● 14001: Energireduksjon 15% 45%    │   │
│  │ 45001 █░░░░░░░░  3 åpne  │    │ ● 45001: HIRA dekning 100%  92%    │   │
│  │ 27001 ███░░░░░░  9 åpne  │    │ ● 27001: SoA fullstendig   72%     │   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
│                                                                               │
│  Revisjonsplan 2026               Lovregister — Etterlevelse                 │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │ Jun · ISO 9001 intern    │    │ Arbeidsmiljøloven    ✅ Etterleves   │   │
│  │ Aug · ISO 45001 ekstern  │    │ Forurensningsloven   ⚠️ Delvis       │   │
│  │ Sep · ISO 14001 intern   │    │ Brann- og eksplosjon ✅ Etterleves   │   │
│  │ Nov · ISO 27001 ekstern  │    │ GDPR Art. 32         ✅ Etterleves   │   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
│                                                                               │
│  HIRA — Risikomatrise (45001)     Miljøaspekter — Signifikans (14001)       │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │        Alvorlighet →     │    │  Energiforbruk      ● Signifikant   │   │
│  │ Høy  [  ][  ][🔴][🔴]   │    │  Avfallsgenerering  ● Signifikant   │   │
│  │ Mid  [  ][🟡][🟡][  ]   │    │  Kjemikalieutslipp  ⚠️ Under vurder.│   │
│  │ Lav  [🟢][🟢][  ][  ]   │    │  Vannforbruk        ○ Ikke sign.    │   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Gap Analysis page (`/iso/gap-analysis/iso-9001`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Gapanalyse — ISO 9001:2015                           [Ny analyse] [▾ Vis]  │
│                                                                               │
│  Siste analyse: Mai 2026 · Totalt: 73% · Utført av: Kari N.                │
│                                                                               │
│  Klausuldekning                                                               │
│  ┌─────┬──────────────────────────────────────┬──────┬──────────────────┐   │
│  │ 4   │ Kontekst                              │ 80% │ ████████░░       │   │
│  │ 5   │ Lederskap                             │ 90% │ █████████░       │   │
│  │ 6   │ Planlegging                           │ 65% │ ██████░░░░       │   │
│  │ 7   │ Støtte                                │ 85% │ ████████░░       │   │
│  │ 8   │ Drift                                 │ 60% │ ██████░░░░       │   │
│  │ 9   │ Ytelsesmåling                         │ 75% │ ███████░░░       │   │
│  │ 10  │ Forbedring                            │ 70% │ ███████░░░       │   │
│  └─────┴──────────────────────────────────────┴──────┴──────────────────┘   │
│                                                                               │
│  Åpne handlingspunkter fra analysen (4)                                      │
│  ● 6.1.1  Risiko og muligheter — oppdater risikoregister  [Due: 30 jun]     │
│  ● 8.4    Leverandørevaluering — etabler register          [Due: 15 jul]     │
│  ● 8.7    Håndtering av avvik — dokumenter prosedyre       [Due: 1 aug]      │
│  ● 9.1.2  Kundetilfredshet — etabler målemetode            [Due: 31 aug]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Register views

**Environmental Aspects Register (14001)**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Miljøaspekter                        [+ Nytt aspekt] [Filter ▾] [Eksporter]│
│                                                                               │
│  [Alle] [Signifikante] [Under vurdering] [Ikke signifikante]                │
│                                                                               │
│  Aktivitet/produkt       Aspekt              Påvirkning     Sign.  Risiko   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Kontordrift             Energiforbruk        Klimagassutsl.  ● Ja  Høy     │
│  Avfallshåndtering       Restavfall           Deponibelast.   ● Ja  Middels │
│  Rengjøring              Kjemikalieutslipp    Vannkvalitet    ⚠️ ?  Under v. │
│  Pendling ansatte         CO₂-utslipp         Klimapåvirk.    ○ Nei Lav     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**HIRA Register (45001)**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Risikovurdering (HIRA)              [+ Ny fare] [Filter ▾] [Risikomatrise] │
│                                                                               │
│  [Alle] [Høy risiko] [Under tiltak] [Lukket]                                │
│                                                                               │
│  Farekilde            Aktivitet       Ekspon.    Init.  Tiltak      Resid.  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Fall fra høyde       Takarbeid       Ansatte    🔴 H   ● Impl.     🟡 M   │
│  Klemfare maskiner    Produksjon      Ansatte    🔴 H   ⚠️ Delvis   🔴 H   │
│  Ergonomi skjerm      Kontorarbeid    Ansatte    🟡 M   ● Impl.     🟢 L   │
│  Støy                 Verksted        Ansatte    🟡 M   ● Impl.     🟢 L   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 ISO settings page (`/iso/settings`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ISO IMS — Innstillinger                                                     │
│                                                                               │
│  Aktive standarder                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ✅ ISO 9001:2015 — Kvalitetsstyring                                │    │
│  │  ✅ ISO 14001:2015 — Miljøstyring                                  │    │
│  │  ✅ ISO 45001:2018 — HMS-styring                                    │    │
│  │  ☐  ISO 27001:2022 — Informasjonssikkerhet   [Aktiver]             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  Sertifiseringsstatus                                                         │
│  Sertifiseringsorgan: DNV GL                                                  │
│  Siste eksterne revisjon: 2025-11-14                                          │
│  Neste overvåkingsrevisjon: 2026-11-10                                        │
│  Status: ● Sertifisert                                                        │
│                                                                               │
│  IMS Omfangsdokument:  [Lenke til wiki-side...]                              │
│  IMS Policy:           [Lenke til wiki-side...]                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Roadmap

### Phase 1 — Foundation (Sprint 1–3, ~6 weeks) — ISO 9001 + 45001 deepening

**Goal:** Get a working ISO 9001 + ISO 45001 gap analysis in front of a pilot customer.

| Item | Description | Estimate |
|---|---|---|
| 1.1 | DB: `iso_standard_clauses` table + seed all clauses for 9001 & 45001 | 0.5d |
| 1.2 | DB: `iso_gap_analysis` + `iso_gap_analysis_responses` tables | 0.5d |
| 1.3 | DB: `organization_iso_settings` table | 0.5d |
| 1.4 | DB: New compliance packs `iso-9001` and pack accent | 0.5d |
| 1.5 | Migration: seed ISO 9001 checklist templates (7 templates, clauses 4–10) | 2d |
| 1.6 | Migration: provision function for iso-9001 pack per org | 0.5d |
| 1.7 | UI: ISO IMS module shell — nav group, settings page, standard selector | 1d |
| 1.8 | UI: Gap analysis wizard — clause list, compliance-level picker, evidence notes | 3d |
| 1.9 | UI: Gap analysis results — clause heatmap, score, action items | 2d |
| 1.10 | UI: ISO IMS dashboard page (IsoImsAnalysePage) with hardcoded first-version layout | 2d |
| 1.11 | Dashboard: Register `iso_ims` composite scope, basic datasets (gap scores, open tasks) | 1d |
| 1.12 | ISO 45001: deepening — verify iso-45001 pack templates are complete to 2018 standard | 1d |
| **Total** | | **~14d** |

**Exit criteria:** An org can select ISO 9001 + ISO 45001, run a gap analysis, see clause scores, create action tasks from gaps, and see a combined IMS dashboard.

---

### Phase 2 — Environmental & IS Registers (Sprint 4–6, ~6 weeks)

**Goal:** ISO 14001 + ISO 27001 standard-specific data structures.

| Item | Description | Estimate |
|---|---|---|
| 2.1 | DB: `iso-14001-environmental-aspects` register type + metadata_schema | 0.5d |
| 2.2 | DB: ISO 14001 clauses seed + gap analysis support | 0.5d |
| 2.3 | UI: Environmental Aspects register — list, create/edit form, significance matrix | 3d |
| 2.4 | Dashboard: Environmental aspects widgets (significance heatmap, aspect count KPIs) | 1d |
| 2.5 | Migration: ISO 14001 compliance pack templates (clauses 4–10) | 2d |
| 2.6 | DB: `iso_27001_annex_a_controls` table — seed all 93 controls (2022 edition) | 1d |
| 2.7 | DB: `iso_27001_soa` per-org applicability table | 0.5d |
| 2.8 | DB: ISO 27001 clauses seed | 0.5d |
| 2.9 | UI: Statement of Applicability page — full control list, theme grouping, edit slide-over | 4d |
| 2.10 | UI: SoA completeness widget + dashboard integration | 1d |
| 2.11 | DB: `iso-27001-risk-register` register type + metadata_schema | 0.5d |
| 2.12 | UI: IS Risk Assessment register — list, risk matrix view, link to SoA controls | 3d |
| 2.13 | Migration: ISO 27001 compliance pack templates | 2d |
| **Total** | | **~19d** |

**Exit criteria:** An org can manage a full ISO 14001 Environmental Aspects register, produce a meaningful gap analysis for ISO 14001 and ISO 27001, and generate a first-pass SoA with implementation status.

---

### Phase 3 — HIRA, Legal Register & CAPA deepening (Sprint 7–9, ~6 weeks)

**Goal:** Full ISO 45001 HIRA, cross-standard legal register, and closed-loop CAPA visible in IMS dashboard.

| Item | Description | Estimate |
|---|---|---|
| 3.1 | DB: `iso-45001-hira` register type with full HIRA metadata_schema | 1d |
| 3.2 | UI: HIRA register — list, risk matrix heatmap, hierarchy-of-controls picker | 4d |
| 3.3 | UI: HIRA → Task link (if hazard risk is high, create a corrective task automatically) | 1d |
| 3.4 | DB: `iso-legal-compliance` register type + evaluation workflow | 1d |
| 3.5 | UI: Legal Compliance register — obligation list, evaluation form, evidence attach | 3d |
| 3.6 | UI: Legal compliance status widget (heatmap by law × status) | 1d |
| 3.7 | DB: `supplier-register` register type | 0.5d |
| 3.8 | UI: Supplier register — list, performance rating, linked audit checklist | 2d |
| 3.9 | DB: `emergency-preparedness` register type | 0.5d |
| 3.10 | UI: Emergency preparedness register — scenario list, drill record, review workflow | 2d |
| 3.11 | UI: CAPA source tagging — tag tasks with ISO clause reference + standard | 1d |
| 3.12 | Dashboard: HIRA risk matrix widget, open CAPA by standard bar chart | 1d |
| 3.13 | Dashboard: IMS overview completeness — all 4 standard scores + trend | 1d |
| **Total** | | **~18d** |

**Exit criteria:** Full HIRA workflow, legal compliance evaluation, supplier register, and emergency preparedness. CAPA loop visible cross-standard.

---

### Phase 4 — Auditor Portal, IMS Export & Certification Tracking (Sprint 10–12, ~6 weeks)

**Goal:** Customer-facing value — share ISO compliance status externally, export audit evidence packages, track certification lifecycle.

| Item | Description | Estimate |
|---|---|---|
| 4.1 | Auditor read-only portal (`/iso/portal/:token`) — signed URL, 30-day expiry | 3d |
| 4.2 | Auditor portal content: gap scores, audit schedule, SoA, open CAPAs, key docs | 2d |
| 4.3 | Evidence export package — PDF bundle of all evidence for a specific standard | 3d |
| 4.4 | Management review — auto-generate ISO standard agenda sections from live data | 2d |
| 4.5 | Certification lifecycle tracker — org certification status, audit dates, next surveillance | 1d |
| 4.6 | Multi-site support — HIRA + Environmental Aspects filterable by location | 1d |
| 4.7 | ISO 9001: Process Library register type (processes with inputs/outputs/owners) | 3d |
| 4.8 | ISO 9001: Customer satisfaction — link survey results to 9001 KPIs | 1d |
| 4.9 | ISO 9001: Management of Change workflow — pre-change risk assessment task trigger | 2d |
| 4.10 | ISO 27001: Risk Treatment Plan view (derived from risk register, showing treatment status) | 2d |
| 4.11 | AI-assisted gap analysis: suggest relevant documents/checklists per clause gap | 3d |
| **Total** | | **~23d** |

---

### Phase 5 — IMS Polish & Market Differentiation (ongoing)

| Item | Description |
|---|---|
| 5.1 | Integrated audit program — one audit covers multiple standards, findings tagged to clauses |
| 5.2 | Regulatory change monitoring (webhook/email alerts when relevant Norwegian law changes) |
| 5.3 | IMS Policy builder — template-driven policy creation with standard-specific paragraphs |
| 5.4 | AI-powered cross-framework gap detection ("your Document Control satisfies 7.5 in all 4 standards") |
| 5.5 | Benchmarking — anonymised cross-org IMS scores (opt-in) |
| 5.6 | ISO 45001 × AML integration — AML compliance mapped to 45001 clauses (unique to Norwegian market) |
| 5.7 | ESG reporting integration — ISO 14001 environmental data → ESG report sections |
| 5.8 | Certification body integration — sync audit findings directly from DNV GL / Bureau Veritas portals |

---

## 8. Competitive Positioning — Entrepreneur's Perspective

### 8.1 The market gap

| Competitor | Problem |
|---|---|
| SafetyCulture (iAuditor) | Excellent mobile UX, poor ISO depth. No closed-loop CAPA trail. No SoA. No legal register. Fails ISO 27001 entirely. |
| Intelex / Cority | Full ISO depth, but enterprise-only (EUR 50k+ ACV), English-only, 6-month+ implementation. Norwegian SMEs can't afford it. |
| Qualio | Life sciences focus (FDA, ISO 13485). No HMS, no 14001, no 45001. |
| Nimonik | Legal register content only. Not a full platform. |
| Norwegian EHS tools (Kvalitet.no, etc.) | Outdated UI, no ISO 27001, no IMS concept, no analytics. |
| Vanta / Drata | ISO 27001 only, cloud-infra focus. No HMS. No 9001/14001/45001. |

**The opportunity:** A modern, Norwegian-language, SME-priced IMS platform that covers ISO 9001 + 14001 + 45001 + 27001, integrated with AML compliance, with a beautiful UX — does not exist.

### 8.2 Pricing lever

Current HMS-only ARPU: ~EUR 800–1,200/org/year (estimated).
ISO IMS add-on: EUR 1,500–2,500/org/year (positioned as "certification readiness").
IMS full tier: EUR 3,000–5,000/org/year (all four standards + auditor portal + evidence export).

The math: 200 orgs on IMS tier = EUR 600k–1M ARR incremental — on the same engineering team.

### 8.3 Go-to-market angles

1. **"Sertifiseringsklare på 90 dager"** — a structured onboarding program using the gap analysis engine to produce a 90-day certification action plan. Differentiator: no competitor offers a structured path to certification.

2. **AML → ISO 45001 bridge** — Norwegian orgs already use NewAMU for AML compliance. Upsell: "You're already 60% of the way to ISO 45001 — here's what's missing." The AML checklist items map directly to ISO 45001 clauses; this is a unique insight only a platform covering both can offer.

3. **One tool, four standards** — the IMS pitch. Finance and ops teams hate managing 4 separate SaaS tools for quality, environment, safety, and IS. One platform, one data model, one team.

4. **Auditor portal** — the most-requested enterprise EHS feature and conspicuously absent from mid-market tools. Giving certification body auditors a clean read-only view of compliance posture creates a viral loop (auditors see the tool, recommend it to other clients).

5. **Norwegian regulatory alignment** — every ISO 45001 legal register item pre-populated with Arbeidstilsynet regulations. Every ISO 14001 legal register pre-populated with Miljødirektoratet obligations. No competitor does this for Norway.

### 8.4 Feature bets from competitor reviews (G2/Capterra synthesis)

Features users love but most tools get wrong — these are table-stakes for differentiation:

1. **Mobile HIRA capture** — field workers need to report hazards from their phone. SafetyCulture wins here; NewAMU must match mobile responsiveness for HIRA.
2. **Pre-built ISO templates** — "live in days, not months." Pre-seed all 7 ISO 9001 audit protocols, all ISO 27001 gap analysis clauses, all 14001 aspects categories.
3. **Closed-loop CAPA** — every audit finding → task → effectiveness review → closed. The loop must be one click, not three screens. The tasks module already has this; wire it explicitly to ISO findings.
4. **Management review auto-generation** — meetings module already pulls data bindings. An ISO 9001 management review that auto-populates with live KPIs from the dashboard is a standout feature.
5. **Evidence packages for auditors** — one-click PDF bundle of all evidence for an external audit. No mid-market tool does this well.

### 8.5 SaaS features to copy (ethically)

| Source | Feature to copy | Implementation |
|---|---|---|
| Vanta/Drata | SoA auto-updated from risk register changes | Trigger: when risk row is added/closed, flag SoA controls for review |
| Qualio | "Compliance Intelligence" — AI surfaces gaps | Phase 5: AI gap detection across modules |
| Intelex | Integrated audit program covering multiple standards | Phase 4: multi-standard audit scope |
| Nimonik | Pre-curated legal register content per jurisdiction | Seed Norwegian legal register for 14001+45001 |
| SafetyCulture | In-field photo evidence capture on checklists | Enhance checklist findings with photo upload |
| Benchmark Gensuite | Customer-voted roadmap (community) | Product community portal — user votes on next ISO feature |
| Sherpany | Meeting data packages (already copied in meetings module) | ✅ already done |

---

## 9. House-style Notes for Implementation

### 9.1 Law-ref string format for ISO clauses

Follow the existing convention exactly:
```
'ISO 9001:2015 § 4.1'     — context clause
'ISO 9001:2015 § 9.2.2a'  — audit programme requirement
'ISO 14001:2015 § 6.1.2'  — environmental aspects
'ISO 45001:2018 § 6.1.2'  — hazard identification
'ISO 27001:2022 § 6.1.3'  — risk treatment + SoA
'ISO 27001:2022 A.5.7'    — Annex A control reference
```

### 9.2 Regulation IDs (already seeded)

The `regulations` table already has rows for `iso-9001`, `iso-14001`, `iso-45001`, `iso-27001`, `iso-19011`. No new seeds needed for the taxonomy — just use these IDs in `regulation_ids[]` on new register types and category rows.

### 9.3 Migration naming

Next available timestamps (after `20260913100000`):
- `20260914100001_iso_foundation_tables.sql`
- `20260914100002_iso_gap_analysis_tables.sql`
- `20260914100003_iso_9001_clauses_seed.sql`
- `20260914100004_iso_9001_compliance_pack.sql`
- `20260914100005_iso_45001_clauses_seed.sql`
- ... (increment last 5 digits for each)

### 9.4 What NOT to build (yet)

- A separate "process library" module UI (Phase 4; a register type is sufficient for Phase 1–3)
- A custom risk matrix algorithm (reuse the existing severity × likelihood pattern from HIRA metadata_schema)
- A document signing flow for SoA (the existing wiki approval flow is sufficient)
- ISO 19011 (auditing standard) as a compliance pack — it's a guidance standard, not certifiable
- Any AI features before Phase 4 — nail the data model first

---

## 10. Senior Supervisor Review Checklist

Before each phase ships, validate:

- [ ] All new tables have `organization_id` + RLS policy (`where organization_id = current_org_id()`)
- [ ] All migrations are idempotent (`if not exists`, `on conflict ... do update/nothing`)
- [ ] New register types have `regulation_ids` correctly linked to existing regulation seeds
- [ ] Gap analysis clause items sourced from `iso_standard_clauses` (not hardcoded JSON)
- [ ] SoA `control_id` always references `iso_27001_annex_a_controls.id` (no orphan rows)
- [ ] New dashboard scope registered as side-effect import in the analyse page
- [ ] IMS nav group uses `permAny` pattern so view roles see the menu
- [ ] Pack accents registered in `packAccents.ts` (IMS scope has its own accent)
- [ ] No `crypto.randomUUID()` polyfills — use `freshId(prefix)` from registry
- [ ] Migration header has self-audit section (which ISO gap is closed + restrisiko deferred)
- [ ] Norwegian (nb) for all user-facing strings; English for code and commit messages
- [ ] Soft delete (`deleted_at`) on all org-configurable register types
- [ ] Version snapshots on any template-like entity the org can edit
