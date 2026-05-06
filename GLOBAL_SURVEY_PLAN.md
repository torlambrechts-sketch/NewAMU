# Global Survey Plan — pack-driven, primitive-reuse-first

**Status:** locked decisions; ready to implement.
**Branch convention:** mirrors compliance work — feature branches merging into main, each commit shippable, migrations idempotent.
**Reuse principle:** the existing `modules/survey/` is mature; this plan extends rather than rebuilds. The compliance-checklist work introduced architectural patterns (per-org pack registry, `provision_baseline_for_org`, `nav_pinned`, `flatSubs` sidebar rendering) that survey adopts identically.

---

## 1 — Locked decisions

| # | Question | Locked answer |
|---|---|---|
| 1 | Pack model | **A — `survey_packs` per-org table**, mirrors `compliance_packs` exactly. Five seed packs per org: `vendor`, `arbeidsmiljo`, `compliance`, `engagement`, `exit`. |
| 2 | Vendor recipient model | **C — new `vendors` master table** + `survey_invitations` FK reference. Customer eventually wants vendor-level reporting; build it correctly now. |
| 3 | Definition snapshot on publish | **B — pack-conditional**. `pack='compliance'` snapshots questions on publish + locks. HMS pulse, engagement, exit, vendor, etc. stay editable. |
| Q2 | Sidebar placement | **Single "Undersøkelser" group** with pinned templates as sub-items (flatSubs). Pack switcher in topbar pivots which templates appear. No separate Leverandører group. |
| Q3 | Migration of existing surveys | **Auto-derive packs**. category='vendor' → vendor; survey_type='external' AND no category → vendor; category='wellbeing' or 'engagement' → engagement; category='safety' → arbeidsmiljo; category='compliance' → compliance; category='exit' → exit; default → engagement. |
| Q4 | Compliance attestation signing | **Generic respondent signature item type**. Mirrors compliance_checklist's `signature` type. AMU-review mechanism stays for AMU-specific use cases. |
| Q5 | This document | Persisted as `GLOBAL_SURVEY_PLAN.md` for team red-pen. |

---

## 2 — Schema design

### 2.1 `survey_packs` (new — mirrors `compliance_packs`)

```sql
create table public.survey_packs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  slug            survey_pack not null,        -- enum: vendor / arbeidsmiljo / compliance / engagement / exit
  short_name      text not null,
  plural_label    text not null,
  cta_label       text not null,
  description     text not null default '',
  legal_references jsonb not null default '[]',
  kpi_labels      jsonb not null default '{}',
  -- Per-pack defaults that influence behaviour
  requires_publish_snapshot boolean not null default false,  -- TRUE for compliance/vendor
  default_anonymous boolean not null default false,
  default_anonymity_threshold int not null default 5,
  position        int not null default 100,
  is_active       boolean not null default true,
  ...audit cols
)
```

RLS standard. Same SECURITY DEFINER provision trigger pattern as `compliance_packs`. Audit-trigger conditional on `organization_id IS NOT NULL` (lesson learned from earlier compliance bug).

### 2.2 Pack column on existing tables

```sql
alter table public.surveys                  add column pack survey_pack;
alter table public.survey_template_catalog  add column pack survey_pack;
```

**Auto-derivation migration** populates `pack` from existing data:

```sql
update surveys
set pack = case
  when survey_type = 'external'                   then 'vendor'
  when survey_type in ('exit', 'onboarding')      then survey_type::survey_pack
  -- match by template-catalog category if traceable
  when title ilike '%leverand%' or title ilike '%vendor%' then 'vendor'
  when title ilike '%qps%' or title ilike '%ark%' or title ilike '%hms%' then 'arbeidsmiljo'
  when title ilike '%compliance%' or title ilike '%åpenhet%' then 'compliance'
  else 'engagement'
end
where pack is null;

update survey_template_catalog
set pack = case category
  when 'vendor'     then 'vendor'
  when 'compliance' then 'compliance'
  when 'safety'     then 'arbeidsmiljo'
  when 'wellbeing'  then 'engagement'
  when 'engagement' then 'engagement'
  when 'exit'       then 'exit'
  else 'engagement'
end
where pack is null;

alter table surveys                  alter column pack set not null;
alter table survey_template_catalog  alter column pack set not null;
```

### 2.3 `vendors` master table (new — Decision 2c)

```sql
create table public.vendors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  display_name    text not null,
  org_number      text,                       -- BRREG nine-digit
  primary_email   text,
  contact_name    text,
  status          text not null default 'active' check (status in ('active','inactive','offboarded')),
  metadata        jsonb not null default '{}',
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, org_number)         -- BRREG unique per tenant
);

-- Free-text search support for vendor pickers
create index vendors_org_search_idx
  on vendors using gin (organization_id, to_tsvector('simple', display_name));
```

RLS standard. Audit triggers. Org-only.

### 2.4 `survey_invitations` refactor

```sql
alter table public.survey_invitations
  alter column profile_id drop not null,
  add column vendor_id uuid references vendors(id) on delete set null,
  add column recipient_email text,            -- snapshot for audit; copies vendors.primary_email at send-time
  add constraint survey_invitations_recipient_xor check (
    -- exactly one recipient channel set
    (profile_id is not null)::int +
    (vendor_id  is not null)::int = 1
  );
```

`survey_invitations.email_snapshot` is preserved for back-compat; `recipient_email` is the canonical send-time email going forward.

### 2.5 Per-org template overrides (`survey_org_templates`)

Mirrors compliance pattern. Customers can edit a system catalog template's display + pin to sidebar without affecting other tenants.

```sql
create table public.survey_org_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  catalog_id      uuid not null references survey_template_catalog(id) on delete cascade,
  pack            survey_pack not null,
  -- Override fields (NULL = inherit from catalog)
  name_override   text,
  description_override text,
  body_override   jsonb,                      -- if set, replaces catalog body for this org
  -- Per-org operational state
  nav_pinned      boolean not null default false,
  is_active       boolean not null default true,
  is_system       boolean not null default true,    -- TRUE if mirrors a system catalog row; FALSE for org-authored
  review_status   compliance_review_status not null default 'draft',
  cadence_hint    text,
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, catalog_id)
);
```

**Why a separate table** (instead of mutating `survey_template_catalog`): the catalog has system rows shared globally. Per-org customisation needs isolation. Compliance learned this — `compliance_checklist_templates` is per-org from day one, but the survey catalog already exists with global system rows we can't break.

### 2.6 Question type additions

```sql
alter type survey_question_type add value if not exists 'photo';
alter type survey_question_type add value if not exists 'respondent_signature';
```

Photo reuses Storage bucket pattern from `compliance_checklist_files`; new bucket `survey_files` with same org-prefix RLS policies.

`respondent_signature` mirrors checklist's `signature` — captures `{signedAt, signedBy: userId}`. Compliance-pack surveys gate publish on at least one signature item being completed by the respondent (similar to checklist's required-items-on-sign check).

### 2.7 `surveys.questions_snapshot` (Decision 3b — pack-conditional)

```sql
alter table public.surveys
  add column questions_snapshot jsonb,
  add column published_definition_locked boolean not null default false;
```

BEFORE UPDATE trigger:
- If `pack` is `'compliance'` or `'vendor'` AND status transitions to `'active'` (publish): snapshot all questions ordered by `order_index` into `questions_snapshot`, set `published_definition_locked=true`.
- If `published_definition_locked=true`: reject any update to `org_survey_questions` for this survey via a partner trigger on the questions table.
- Other packs: skip; questions remain editable post-publish (existing behaviour preserved).

---

## 3 — Build sequence (9 commits)

Each commit ships green (`npx tsc -b`, `npx eslint`), each migration idempotent.

| # | Commit | Files | What |
|---|---|---|---|
| **1** | `survey: pack registry + per-org seed` | 1 migration | `survey_pack` enum, `survey_packs` per-org table, RLS, audit trigger (with conditional-org_id pattern), seed 5 packs per existing org. |
| **2** | `survey: pack column + auto-derivation backfill` | 1 migration | Add `pack` to surveys + catalog. UPDATE statements per the auto-mapping rules in §2.2. SET NOT NULL after backfill. |
| **3** | `survey: provision_survey_baseline_for_org + trigger` | 1 migration | SECURITY DEFINER function copies system catalog rows that match `pack` into `survey_org_templates` per org. AFTER INSERT/UPDATE trigger on `survey_packs` calls it on license-grant. |
| **4** | `survey: per-org template overrides + nav_pinned` | 1 migration + TS | `survey_org_templates` table. New `useSurveyOrgTemplates()` hook. Existing `useSurvey` extended to read overrides. |
| **5** | `survey: vendors master table + invitation refactor` | 1 migration + TS hook | `vendors` table, RLS, audit. Refactor `survey_invitations.profile_id` to nullable + add `vendor_id` + XOR constraint. New `useVendors()` hook for the vendor picker UI. |
| **6** | `survey: pack-conditional publish snapshot + lock` | 1 migration | `questions_snapshot` column on surveys, BEFORE UPDATE trigger snapshots + locks for compliance/vendor packs. Partner trigger on `org_survey_questions` blocks edits when locked. |
| **7** | `survey: photo question type + Storage bucket` | 1 migration + TS PhotoControl | ALTER TYPE adds 'photo'. Bucket `survey_files` + frozen-attachment RLS pattern. Reuse `<PhotoItemControl>` from compliance with a slug-prefix prop. |
| **8** | `survey: respondent_signature question type + publish gate` | 1 migration + TS SignatureControl | ALTER TYPE adds 'respondent_signature'. Validation in `surveyRespondValidation.ts` requires non-empty value before submit when item is `is_required`. |
| **9** | `survey: Undersøkelser sidebar group + topbar pack switcher` | TS only | New `useSurveyNav()` hook (mirror of `useComplianceNav`). New synthetic NavGroup in AticsShell. Reuse `flatSubs` flag. New `<ShellSurveyPackSwitcher>` topbar widget visible on `/survey/*`. |

After all 9: `<SurveyRespondPage>` and `<SurveyDetailView>` get small pack-aware tweaks (terminology overrides from `useActiveSurveyPack()`), but the bulk stays unchanged.

---

## 4 — Reuse map (compliance ↔ survey)

Direct copies of patterns from compliance work, often with parameterisation:

| Compliance asset | Survey reuse |
|---|---|
| `provision_compliance_baseline_for_org()` | `provision_survey_baseline_for_org()` — same shape, different table targets. |
| `compliance_packs` table | `survey_packs` table. Same columns minus the `severity_labels` (surveys don't have severity), plus `default_anonymous` + `default_anonymity_threshold` + `requires_publish_snapshot`. |
| `compliance_review_status` enum | Reused for `survey_org_templates.review_status`. |
| `nav_pinned` column | Same column name on `survey_org_templates`. |
| `useComplianceNav()` hook | `useSurveyNav()` — copy + change table. **Defer** extracting a generic `useModulePinnedNav({moduleSlug})` until the third primitive arrives. |
| `<ShellCompliancePackSwitcher>` | `<ShellSurveyPackSwitcher>` — copy + change icon and pack source. |
| `flatSubs` flag in `AticsShell` | Reused unchanged. |
| `<PhotoItemControl>` from `modules/compliance/components/` | Move to `src/components/shared/` (or accept a `bucketName` + `pathPrefix` prop) and reuse. |
| Conditional audit trigger pattern (skips when `org_id IS NULL`) | Apply to `survey_packs`, `survey_template_catalog` if it doesn't already (some system rows have NULL org_id). |
| Frozen-attachment Storage RLS | Reused — same SQL, different bucket name. |
| Definition snapshot pattern | Reused — same column type and trigger shape, pack-conditional. |

**Future extraction (not this round):**
- A `regulation_packs` parent table that both `compliance_packs` and `survey_packs` inherit from.
- A `useModulePinnedNav({moduleSlug, route})` generic hook.
- A `<ShellModulePackSwitcher>` parameterised widget.

These extractions are tempting now but premature — three implementations is the right threshold (when Meetings or Documents primitives arrive).

---

## 5 — UI surfaces

### Topbar
- `<ShellSurveyPackSwitcher>` next to `<ShellCompliancePackSwitcher>`. Visible only on `/survey/*`. Same dropdown pattern; lists licensed survey packs.

### Sidebar — "Undersøkelser" group
- Single high-level entry "Undersøkelser" → `/survey`. Pinned templates as sub-items (`flatSubs: true`).
- Pinned templates filtered by active pack focus.
- Each sub-item routes to `/survey?template=<slug>&pack=<pack>` or to a new survey-creation page pre-filling the template.

### Survey list page
- Reads active pack from URL/context (mirrors `ChecklistsPage`).
- Title, description, KPI labels driven by `useActiveSurveyPack()`.
- Filter by pack at the DB query level.

### Survey admin page (`/survey/admin`)
- Existing page extended with new tabs: **Pakker** (display fields per pack), **Krav** (existing law_ref text matures to requirement_slugs joined to `compliance_requirements`), **Leverandører** (vendor master CRUD).
- **Maler** tab gains the per-org override editor (rename, body override, nav_pinned, is_active toggles). System catalog rows show "System" badge.

### Vendor picker
- New `<VendorSearchableSelect>` component used in survey creation when `pack='vendor'`. Falls back to "Add new vendor" → opens a slide panel similar to `ComplianceCreateForm`.

---

## 6 — Open follow-ups (NOT in scope this round)

1. **Vendor reporting dashboard** — `/vendors` page listing all vendors + their open / completed / overdue surveys. The schema enables it (vendors + invitations linked); UI is a separate effort.
2. **ARK / QPSNordic full-question packs** — current catalog has stub templates ("erstatt med full ARK-pakke ved lisens"). Real questionnaires are licensed content; need a separate licensing channel.
3. **Cross-primitive pack** — when ESG arrives as a regulation, it spans surveys (CSRD self-assessment) and checklists (ESG audits). Promote pack registry to a parent `regulation_packs` table at that point.
4. **Anonymous-link generation as a first-class surface** — currently `surveyInviteLink.ts` produces tokens, but the customer admin has no "view all open links" page. Bottom of priority.
5. **Generic `useModulePinnedNav`** — extract once Meetings/Documents primitives ship.
6. **Migrate compliance_checklist_template_versions pattern to surveys** — survey publish-snapshot is the analogue, but a full SCD Type 2 versions table for survey templates would mirror the compliance pattern. Defer.

---

## 7 — Verification per commit

| Commit | Verifiable goal |
|---|---|
| 1 | `select count(*) from survey_packs where organization_id is not null` returns `5 × org_count`. |
| 2 | `select pack, count(*) from surveys group by pack` shows non-null buckets matching expected category mappings. |
| 3 | New (org, pack) row insertion auto-creates `survey_org_templates` rows for system catalog templates of that pack. |
| 4 | Toggle `nav_pinned` on a `survey_org_templates` row → next sidebar render reflects it. |
| 5 | Create a vendor row, send a survey invitation referencing `vendor_id`, confirm token-link flow without `profile_id`. |
| 6 | Publish a `pack='compliance'` survey → `questions_snapshot` populated and `published_definition_locked=true`; subsequent question UPDATE rejected by trigger. |
| 7 | Photo upload on a survey response, retrieved via signed URL. Bucket prefix = `{org_id}/{survey_id}/{question_id}/`. |
| 8 | Required `respondent_signature` item blocks submission when missing. |
| 9 | Sidebar shows "Undersøkelser" → pinned templates per active pack. Topbar dropdown swaps pack focus. |

---

## 8 — Honest risk register

- **Refactoring `survey_invitations.profile_id` to nullable is moderate risk** — existing surveys' invitations all have non-null profile_id. The XOR constraint in §2.4 means we can't just drop NOT NULL; we have to migrate carefully. Plan: add `vendor_id` + `recipient_email` columns first, ship a code update that handles all three states, *then* in a later migration drop the `NOT NULL` on `profile_id`.
- **Auto-deriving packs from existing surveys** is heuristic. Customers may disagree with my mappings. Plan: ship the auto-derivation, surface a "Re-tag pack" admin action immediately so customers can correct edge cases.
- **System catalog rows have organization_id IS NULL** — same issue as compliance_requirements audit trigger. Apply the conditional-trigger fix to `survey_template_catalog` and any other system-row table during commit 1 to avoid the same migration-failure pattern.
- **Vendor table without an external login flow** — vendors get token links but can't log in. If a vendor needs to view past surveys, they re-use the link. Acceptable for v1; address with magic-link auth in a follow-up if needed.
- **`survey_org_templates` synchronisation** — when system catalog rows update (via platform migration), per-org `*_override` fields shouldn't be clobbered. Plan: provision function reads system row and inserts only fields the org hasn't overridden. ON CONFLICT DO NOTHING preserves customer state.

---

**Status:** ready to implement. Locked decisions in §1 are the contract. Build sequence in §3 is the queue.
