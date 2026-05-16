# Compliance walkthrough — pack-agnostic spec

A walkthrough is a sectioned compliance checklist template that drives
a wizard-style UX (one section at a time, progress bar, save/resume,
auto-mark from existing artefacts, audit-binder export) and ships with
generic versioning, periodic reminders, and a paragraph-grid
analytics widget — for **any** compliance pack.

This spec is the single source of truth for adding a new walkthrough
(ISO 45001, GDPR, Åpenhetsloven, …) after the AML implementation
(commits `f80e2cf` → `9c2ad26`) landed. It documents what's generic,
what's pack-specific, and exactly which files to touch per new pack.

---

## 1 · Architecture overview

```
                           ┌───────────────────────┐
                           │  ChecklistWalkthrough  │
                           │       Page             │
                           └──┬────────────────────┘
                              │ reads
              ┌───────────────┴───────────────┐
              ▼                               ▼
   ┌─────────────────────┐         ┌──────────────────────┐
   │ compliance_checklist│         │ compliance_wizard_   │
   │ _templates          │         │ runs                 │
   │ (definition jsonb)  │         │ (current_step, resume│
   └──────────┬──────────┘         │  state per user)     │
              │                    └──────────────────────┘
              │ executions reference template
              ▼
   ┌─────────────────────┐    ┌─────────────────────────────┐
   │ compliance_checklist│    │ compliance_template_versions│
   │ _executions         │    │ (append-only snapshots)     │
   │ (responses,         │    └─────────────────────────────┘
   │  definition_snapshot,│                ▲
   │  sign_checksum)     │                │ published_by
   └──────────┬──────────┘                │
              │ resolution clicks         │
              ▼                            │
   ┌─────────────────────┐         ┌──────┴──────────────────┐
   │ task_items          │         │ compliance_walkthrough  │
   │ (source_category =  │         │ _fresh_artefacts() RPC  │
   │  'compliance_       │         │ (checklist + document   │
   │   checklist_item')  │         │  + learning + meeting   │
   └─────────────────────┘         │  + register)            │
                                   └─────────────────────────┘
```

---

## 2 · Template definition shape

A walkthrough template's `definition` jsonb must carry `sections[]`
(the rich, ordered chapter list) AND `items[]` (a flat denormalised
copy — required to satisfy the existing `jsonb_typeof(definition->'items')='array'`
check constraint on `compliance_checklist_templates`):

```jsonc
{
  "sections": [
    {
      "key": "kap4",
      "title": "5. Krav til arbeidsmiljøet",
      "chapter": "AML kap. 4",          // drives paragraph-grid grouping
      "intro": "Fysisk, kjemisk, …",   // optional intro paragraph
      "estimatedMinutes": 15,
      "items": [
        {
          "key": "k4_3_psyko",          // stable per-item identifier
          "prompt": "Er det psykososiale arbeidsmiljøet ivaretatt …?",
          "type": "yes_no_na",
          "required": true,
          "law_ref": "AML § 4-3",       // single string; auto-split on comma
          "severity_default": "critical",
          "help": "...",
          "status_hint": "Kun ved …",   // optional; gates threshold UX
          "resolutions": [              // up to ~3 pointers per item
            { "kind": "checklist_template", "ref": "psykososial-pulsmaling",
              "label": "Psykososial pulsmåling" }
          ],
          "task_template": {            // optional; pre-fills the Opprett-oppgave form
            "title": "Audit av psykososialt arbeidsmiljø",
            "priority": "high"
          }
        }
        // … more items …
      ]
    }
    // … more sections …
  ],
  "items": [ /* flat denormalised copy of all sections[].items[] */ ]
}
```

Build the flat `items[]` in the seed migration with `jsonb_path_query`
+ `jsonb_agg` — see `_120100_aml_fullgjennomgang_template.sql` for the
canonical pattern (`v_def := jsonb_set(v_def, '{items}', (select
jsonb_agg(item) from jsonb_path_query(v_def, '$.sections[*].items[*]')))`).

### Resolution kinds (auto-mark targets)

Each `item.resolutions[]` entry uses one of these kinds. The
`compliance_walkthrough_fresh_artefacts(p_org_id, p_max_age_months)` RPC
auto-detects when the org has a fresh signed/acked instance:

| `kind` | Matches | `ref` is | DB join |
|---|---|---|---|
| `checklist_template` | Signed compliance_checklist_executions | `compliance_checklist_templates.slug` | executions → templates (slug) |
| `document` | wiki_compliance_receipts | `document_system_templates.id` | receipts → wiki_pages → template id |
| `learning` | Completed learning_course_progress | `learning_courses.id` | course_id direct |
| `meeting` | Signed protocols | `meeting_system_templates.slug` | meetings.system_template_id |
| `register` | Recently updated register_records | `register_types.name` | records → register_types |
| `workflow` | (not yet) | — | future |
| `manual` | No auto-mark — chip only | free-form text | — |

**Verify your refs resolve.** After seeding, run this query — every
row should return `resolves='true'`:

```sql
with refs as (
  select distinct res->>'kind' as kind, res->>'ref' as ref
  from public.compliance_checklist_templates t,
       jsonb_array_elements(t.definition->'sections') sec,
       jsonb_array_elements(sec->'items') item,
       jsonb_array_elements(coalesce(item->'resolutions','[]'::jsonb)) res
  where t.slug = '<your-walkthrough-slug>'
)
select r.kind, r.ref,
  case r.kind
    when 'checklist_template' then exists(select 1 from public.compliance_checklist_templates where slug=r.ref)::text
    when 'document'           then exists(select 1 from public.document_system_templates where id=r.ref)::text
    when 'meeting'            then exists(select 1 from public.meeting_system_templates where slug=r.ref)::text
    when 'register'           then exists(select 1 from public.register_types where name=r.ref)::text
    when 'learning'           then exists(select 1 from public.learning_courses where id=r.ref)::text
    else 'unknown' end as resolves
from refs r order by r.kind, r.ref;
```

### Section-0 metadata schema (roles + thresholds)

The wizard's first step renders `metadata_schema.fields[]` via
`ExecutionMetadataPanel`. Use it to collect roles + threshold inputs
that gate downstream items. Field shape:

```jsonc
{
  "key": "antall_ansatte",
  "kind": "number" | "select" | "text" | "participants" | "location" | "department" | "team",
  "label": "Antall ansatte",
  "required": true,
  "options": [ { "id": "u5", "label": "Under 5 ansatte" }, … ]
}
```

Threshold gating itself is currently hardcoded in
`ChecklistWalkthroughPage.applicabilityFor()` — AML-only. For other
packs, extend the function with a new `case` branch or refactor to a
per-template rule schema (deferred — see §8).

---

## 3 · Adding a new walkthrough (the recipe)

Here's the complete checklist to ship e.g. an ISO 45001 walkthrough.

### 3.1 — Seed migration (`<next-basename>_iso_fullgjennomgang_template.sql`)

Mirror `_120100_aml_fullgjennomgang_template.sql`:

- Self-audit header (which §-er pålegg-grunner addressed, restrisiko)
- Per-org loop: `for v_org_id in select id from public.organizations loop`
- `insert ... on conflict (organization_id, slug) do update set …`
- `slug='iso-fullgjennomgang'`, `pack='iso-45001'`, `is_system=true`,
  `nav_pinned=true`, `review_status='reviewed'`,
  `cadence_hint='arlig'`
- `definition` jsonb = sections[] + flat items[] (see §2)
- `metadata_schema` = role + threshold fields
- `law_refs` = aggregate of every item's law_ref (deduplicated)
- `current_version_major=1`, `current_version_minor=0` (defaults; Phase 13.5
  publish step seeds the versions table)

### 3.2 — Dispatcher hookup (provision for new orgs)

Add **one line** to `provision_compliance_baseline_for_org`'s
`iso-45001` branch:

```sql
elsif p_pack_slug = 'iso-45001' then
  perform public._provision_compliance_iso_baseline(p_org_id);
  -- New: walkthrough
  perform public._provision_compliance_walkthrough(
    p_org_id, 'iso-fullgjennomgang', 'iso-45001'
  );
end if;
```

`_provision_compliance_walkthrough` (Phase 12) is pack-agnostic — it
copies the canonical template from any existing seeded org. Don't
duplicate the AML-specific wrapper pattern.

### 3.3 — Yearly reminder (pg_cron)

Mirror `_120300` and `_120600` but call the generic helper:

```sql
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'iso_fullgjennomgang_periodic_reminder',
      '0 8 1 * *',
      $cmd$select public._compliance_walkthrough_check_due_orgs(
        'iso-fullgjennomgang', 'iso-45001', 12
      );$cmd$
    );
  end if;
exception when undefined_table then null;
         when undefined_function then null;
end $cron$;
```

The helper auto-derives task `law_refs` from `template.law_refs[1:3]`,
so reminder tasks tag correctly for ISO (no manual law_ref override
needed).

### 3.4 — Optional: paragraph-grid catalog entry

If you want the heat-map widget for this walkthrough in the dashboard
"Add Widget" picker, add an entry to
`modules/compliance/dashboards/checklistDashboardScope.ts`:

```ts
const PARAGRAPH_GRID_ISO: ReportModuleComplianceParagraphGrid = {
  id: 'paragraph-grid-iso',
  kind: 'compliance_paragraph_grid',
  datasetKey: 'compliance_paragraph_grid_iso-fullgjennomgang',
  title: 'ISO 45001 — klausuldekning',
  // …
}
```

The dataset itself is **auto-emitted** by `useChecklistDatasets` —
no React changes needed beyond the catalog entry.

### 3.5 — Publish v1.0 baseline

After seeding (3.1) and dispatcher hookup (3.2) have run, publish the
baseline so the versions UI has a starting point:

```sql
select public.compliance_template_publish_version(
  'iso-fullgjennomgang', 'iso-45001', 1, 0,
  'Initial ISO 45001 baseline.'
);
```

(This is a server-side admin call. Wrap it in a migration `do $$ …
end $$` block that runs as service_role if you want it baked into the
seed.)

### 3.6 — Verify

Run the resolves-query in §2, then end-to-end:

```sql
-- 1. Template seeded
select count(*) from public.compliance_checklist_templates
where slug = 'iso-fullgjennomgang';

-- 2. Version baseline exists
select * from public.compliance_template_versions
where slug = 'iso-fullgjennomgang';

-- 3. Reminder fires for un-signed orgs
select public._compliance_walkthrough_check_due_orgs(
  'iso-fullgjennomgang', 'iso-45001', 12
);

-- 4. Fresh-artefacts RPC accepts the new walkthrough's resolutions
select * from public.compliance_walkthrough_fresh_artefacts(
  (select organization_id from public.compliance_packs where slug='iso-45001' limit 1), 12
);
```

On the frontend: visit `/compliance/checklists` (hub) — your tile
should render with a "Veiviser" badge. Click → lands on
`/compliance/checklists/walkthrough/iso-fullgjennomgang`. The
ChecklistWalkthroughPage renders with the new template's
ComplianceBanner (title derived from `pack.pluralLabel`, body from
`template.description`).

---

## 4 · Generic infrastructure (already shipped)

These all work without per-pack changes:

| Surface | File | Notes |
|---|---|---|
| Walkthrough page | `modules/compliance/ChecklistWalkthroughPage.tsx` | Reads `definition.sections[]` from any template |
| Auto-mark suggestion banner | same page, `findFreshArtefact()` | 5 resolution kinds supported |
| Fresh-artefacts RPC | `public.compliance_walkthrough_fresh_artefacts` | 5 source tables unioned, RLS-aware |
| Audit binder | `modules/compliance/ChecklistAuditBinderPage.tsx` | Renders from `definition_snapshot`, reproducible |
| Paragraph-grid widget | `compliance_paragraph_grid` kind | Pack-agnostic; dataset key per template |
| Task bridge | `task_source_category='compliance_checklist_item'` | + `source_id=execution_id` + `source_item_key=item.key` |
| Yearly reminder | `_compliance_walkthrough_check_due_orgs(slug, pack, months)` | Derives task law_refs from template |
| Provisioning | `_provision_compliance_walkthrough(org, slug, pack)` | Copy-from-canonical pattern |
| Versioning | `compliance_template_versions` + 2 RPCs | Publish gated on platform_is_admin |
| Versions UI | `modules/compliance/admin/TemplateVersionsPanel.tsx` | List + publish form + diff modal |

---

## 5 · Pack-locked code (still AML-only, deferred refactors)

These are hardcoded for AML for now. Each one becomes an extension
point when the next walkthrough ships.

1. **`ChecklistWalkthroughPage.applicabilityFor()`** — encodes AML
   thresholds (§ 2A-7 ≥5 ansatte, § 7-1 ≥50, § 14-12 only when
   innleide). Item keys (`k2a_7_rutiner`, `k6_1_valgt`, etc.) are
   hardcoded. To extend for ISO: add a new `case` per ISO item key,
   or refactor to a per-template applicability rule schema.
2. **AML wrappers** — `_provision_compliance_aml_fullgjennomgang`,
   `_aml_fullgjennomgang_check_due_orgs`. Kept so the existing
   dispatcher + pg_cron continue to work, but no new wrappers should
   be added — new walkthroughs call the generic helpers directly.
3. **Paragraph-grid catalog entry** — single hardcoded AML entry.
   New walkthroughs need their own catalog entry (3.4 above).

---

## 6 · Versioning workflow

1. **Edit the template definition** via the admin editor OR by
   running a new seed migration.
2. **Publish a new version** via the `compliance_template_publish_version`
   RPC (or the TemplateVersionsPanel UI):
   ```sql
   select public.compliance_template_publish_version(
     'aml-fullgjennomgang', 'aml-amu', 1, 1,
     'AML § 14-12 oppdatert per Prop. 14 L (2022-23).'
   );
   ```
3. **Snapshot semantics**: signed executions are unaffected — their
   `definition_snapshot` was frozen at sign time. New executions
   started after the publish carry `started_version_major=1`,
   `started_version_minor=1` via the
   `_exec_snapshot_template_version` trigger.
4. **Diff** via `compliance_template_version_diff(slug, pack,
   from_major, from_minor, to_major, to_minor)` — returns
   `{added, removed, modified}` keyed by `item.key`.

---

## 7 · Open questions / deferred work

1. **Per-template applicability rules** — extension point in #5. Schema
   sketch: `metadata_schema.fields[].applicability_rule = { field, op,
   value, reason }` evaluated by a shared helper.
2. **Paragraph-grid catalog auto-discovery** — DatasetMeta registration
   is static at scope-load. To go fully dynamic, the dashboard registry
   would need a runtime hook that walks `compliance_checklist_templates`
   at component mount.
3. **i18n** — every user-facing string in the seed is Norwegian. To
   support en-US / sv-SE, the seed migration would write to a flat
   translation table keyed by `(slug, item.key, locale)` and the page
   would look up at render time. Deferred until first non-NO customer.
4. **Per-section sign-off** — currently whole-template only. If a long
   walkthrough wants chapter-by-chapter audit signing, the existing
   sign trigger needs to extend its check.
5. **PDF audit binder polish** — currently relies on browser
   print-to-PDF. Server-side puppeteer rendering would give pixel-
   perfect output but adds infra dependencies.

---

## 8 · Reference commits

| Phase | Commit | What |
|---|---|---|
| 1 | `f80e2cf` | DB foundations, types, Zod, AML seed |
| 2 | `5a18b81` | AML wizard UI (was AmlWalkthroughPage) |
| 3 | `9b02e06` | Hub routing for walkthroughs |
| 4 | `8c93736` | Wizard hardening (8 audit-blocker fixes) |
| 5 | `651731d` | Polish: summary step, sticky strip, mobile |
| 6 | `6c991cd` | compliance_paragraph_grid widget kind |
| 6.5 | `d78dcf5` | Provision dispatcher hookup + race fix |
| 7 | `e68faf2` | Auto-mark + bulk N/A + keyboard + banner |
| 8 | `cf69d5f` | Yearly cadence reminder (AML-specific) |
| 9 | `9517d74` | Auto-mark covers documents + courses |
| 10 | `81674bd` | 4 broken refs + meeting/register branches |
| 10.5 | `b771705` | Kind-aware auto-mark wording |
| 11 | `18883fe` | Revisor-ready audit binder export |
| 11.5 | `f5510b6` | Binder hardening |
| 12+13 | `65898b8` | **Generalisation + versioning** |
| 13.5 | `189fc8d` | Security gate + walkthrough not-found |
| 13.6 | `79560be` | Reminder law_refs derived from template |
| 14 | `9863da6` | Versions admin UI + diff modal |
| 14.5 | `9c2ad26` | Refresh template list after publish |
