# Alerts (Varslinger) — Module Architecture Spec

> **Read this first:** `specs/PLAYBOOK.md` (§3 task shape, §4 capability inventory,
> §7 architect checklist) and `specs/meetings-parity.md` (the most recent
> net-new module; this spec mirrors its shape).

**Reference modules (priority order):**
- `modules/meetings/` — net-new template-driven module with system catalog + per-org settings + per-org custom templates. Closest architectural fit.
- `modules/compliance/` — categories + metadata_schema + lock-trigger relaxation; the gold standard for "template + instance with lock".
- `modules/documents/` — 3-layer template surface and `provision_<module>_baseline_for_org` pattern.

**Existing infrastructure being absorbed** (full purge, not parallel surfaces — per user directive):
- `whistleblowing_cases` + `whistleblowing_case_notes` tables (archive migration `20260501120000`).
- `gdpr_breach_incidents` table (archive migration `20260903120100`).
- `public_submit_whistleblowing` / `public_whistleblowing_status` / `public_whistleblowing_org_lookup` RPCs.
- Permission key `whistleblowing.committee`.
- Pages: `PublicWhistlePage`, `WhistleStatusPage`, `WorkplaceReportingPage`, `WorkplaceAnonymousAmlPage`, `WorkplaceAnonymousAmlSettingsPage`, `PublicAnonymousAmlPage`, admin `GdprBreachAdminPanel`.
- Hooks: `useWhistleblowing`, `useWorkplaceReportingCases`.
- Types/data: `src/types/whistleblowing.ts`, `src/data/amlAnonymousReporting.ts`, `src/data/workplaceCaseCategories.ts`, `src/lib/varslingssakerLayoutFromPreset.ts`.
- Component: `src/components/workplace/WorkplaceReportingCasesSection.tsx`.

**Spec status:** `📋 ready to execute` (supervisor + human-owner signed off in §13.4; OQ-A4 overridden by owner).
**Owner:** human. **Author:** senior architect + compliance officer dual review, supervisor revision pass applied.

---

## 1 · One-paragraph framing

Norwegian organisations are legally required to operate **two distinct
reporting pipelines** with overlapping plumbing but incompatible legal
contracts: **AML kap. 2A varsling** (whistleblowing — anonymous,
identity-protected, 5-day acknowledgement, 6-week investigation,
prohibition on retaliation) and **GDPR Art. 33 brudd-håndtering**
(personal-data breach — 72-hour mandatory notification to Datatilsynet,
optional notification to data subjects, risk-based severity scoring). The
current platform addresses both with bespoke admin pages
(`WorkplaceReportingPage`, `WorkplaceAnonymousAmlPage`,
`GdprBreachAdminPanel`) that share no template surface, no analyse page,
no provisioning, and don't appear on the main sidebar. The new
`modules/alerts/` module **unifies both pipelines** behind a single
template-driven engine — each alert kind (AML varsel, GDPR brudd,
HMS-avvik, sikkerhetshendelse, etisk varsel) is a **system template** the
platform ships, with mandatory fields, retention rules, escalation paths,
and confidentiality contracts encoded declaratively. The module appears
as a top-level sidebar group "Varslinger" between Møter and Register,
following the same shape as Sjekklister / Undersøkelser / Dokumenter /
Møter.

The single non-negotiable architectural commitment: **anonymity and
confidentiality are first-class**, not bolt-on. Every table, every RPC,
every UI surface must satisfy AML § 2A-7 (5) (taushetsplikt om
varslerens identitet) and GDPR Art. 5 (1) (f) (konfidensialitet og
integritet) by construction.

---

## 2 · Architecture decisions (made up front)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| A1 | Template surface shape | **3-layer** (system catalog → per-org settings → per-org custom) | Mirrors meetings + documents. AML varsling and GDPR brudd ship as system templates with mandatory fields; orgs can disable/customise. |
| A2 | Where do overrides go? | Per-org `alert_org_template_settings` carries `override_name`, `override_description`, `override_definition`, `nav_pinned`, `category_id`, `position` | Org admins who want to fork agenda fields into a custom template explicitly create an `alert_org_templates` row. Mirrors meetings. |
| A3 | Categories | **Per-org, free vocabulary** (mirror compliance/meetings categories) | Seeded per org via `provision_alerts_baseline_for_org`: AML, GDPR, HMS, Sikkerhet, Etisk. |
| A4 | Instance table | **One `alert_cases` table** with `kind text` discriminator (`whistleblowing` / `gdpr_breach` / `hms_incident` / `security_incident` / `ethical_concern`) + kind-specific child tables for non-shared payload | Single timeline / single dashboard / single permission gate. Kind-specific 72-hour SLA logic lives in trigger + dataset hooks. |
| A5 | Notes / case journal | Append-only `alert_case_notes` (mirror existing `whistleblowing_case_notes`) | Forensic integrity. Trigger rejects update/delete. |
| A6 | Attendees / participants | **None on case** — the equivalent is `assigned_committee_member_ids[]` (committee roster) + `reporter_*` (one row). Surveys-grade `participant_member_ids` does not apply | Whistleblower is one identity (or none). The committee that handles the case is a different concept. |
| A7 | Lock model | Lock at `closed_at`, with trigger that protects identity-bearing columns + immutable timeline events but allows metadata edits | Same contract every other module uses. **Critically**: the trigger also enforces `reporter_user_id` and `reporter_contact` are immutable post-`closed_at` to prevent post-hoc identity reveal. |
| A8 | Metadata schema | Same `TemplateMetadataField` types as compliance (copy verbatim) | Reuse renderer + admin editor. Each system template declares which fields apply (e.g. GDPR brudd template declares `affected_subjects_estimate: number`, `breach_type: select`; AML varsling declares `is_anonymous: boolean`, `category: select`). |
| A9 | Public anonymous submission | **Single public RPC** `public_submit_alert(p_org_slug, p_template_slug, p_payload jsonb, p_captcha_token)` returning `{accessKey: uuid}` | Replaces `public_submit_whistleblowing`. Template slug determines required fields server-side via `definition.requiredFields`. |
| A10 | Public status check | RPC `public_alert_status(p_access_key uuid)` returning `{status, updatedAt, acknowledgementDueAt, latestPublicNote}` | Replaces `public_whistleblowing_status`. Public notes are an opt-in subset of `alert_case_notes` flagged `visible_to_reporter`. |
| A11 | Attachment storage | Supabase Storage **private bucket** `alert-attachments`; signed URLs only; never `public` access | Attachment paths reference the bucket key; resolving requires committee permission. |
| A12 | Captcha on public form | **hCaptcha** verification in Edge Function before RPC invocation (config-driven; falls open in dev) | Per Datatilsynet guidance on whistleblowing systems — prevent spam DoS without IP logging. |
| A13 | Confidentiality levels | `confidentiality_level text` (`standard` / `restricted` / `confidential`) on `alert_cases`, set at creation by template default, **immutable post-creation** | Restricted/confidential cases visible only to a sub-roster (`alerts.committee_confidential`). Mirrors meetings confidentiality gate. |
| A14 | Retention | **System retention policy** per template kind, enforced by scheduled function `alerts_purge_expired_cases()`: AML varsling default **5 years** post-`closed_at` (saklig nødvendighet — no statutory floor; documented as org policy, not "per Datatilsynet"), GDPR brudd default **5 years** (Art. 33 (5) dokumentasjonsplikt — "as long as necessary to demonstrate compliance"; cite Datatilsynets veiledning om internkontroll). HMS-avvik **5 years** as generic floor; templates with kjemikalie-eksponering raise to **30 years** via override per **Forskrift om utførelse av arbeid kap. 31**. **Yrkesskade-relaterte saker**: kept until subject is 70 (folketrygdloven § 13-14 evidence preservation, set by org policy, not module default). | Retention deadlines on case row (`retention_until timestamptz`) calculated at close-time. Purge function NULLs identity fields + reporter-facing note bodies rather than hard-delete, to preserve audit count statistics. Separate **Art. 17 erasure path** for identified-tier reporters who exercise right-to-erasure (§ 3.8) — hard-deletes the row. |
| A15 | Co-existence with legacy | **Hard cutover, no parallel surfaces.** Migration absorbs `whistleblowing_cases` + `gdpr_breach_incidents` rows into `alert_cases`. Legacy pages, hooks, RPCs, permissions are deleted in Phase F | Per user directive. Existing `/varsle/:slug` URL kept as compatibility redirect for one release, then dropped. |

---

## 3 · Data model

### 3.1 Tables (all new — legacy tables dropped after data migration)

```
alert_template_categories         (id, organization_id, slug, name, description,
                                    position, is_active, is_system, deleted_at,
                                    created_at, updated_at,
                                    unique(organization_id, slug))

alert_system_templates            (id text PK, slug text unique, label, description,
                                    kind text check in ('whistleblowing','gdpr_breach',
                                      'hms_incident','security_incident','ethical_concern'),
                                    frameworks text[],              -- ['AML kap. 2A','GDPR'] etc.
                                    law_refs text[],                -- ['AML § 2A-1','AML § 2A-7 (5)','GDPR Art. 33']
                                    default_category_slug text,
                                    default_confidentiality_level text default 'restricted',
                                    default_retention_years int not null,
                                    acknowledgement_due_days int not null default 7,
                                    investigation_due_days int,
                                    requires_dpo boolean default false,
                                    allows_anonymous boolean not null default true,
                                    definition jsonb not null,      -- see §3.2
                                    metadata_schema jsonb not null, -- {fields: TemplateMetadataField[]}
                                    is_active, sort_order, created_at, updated_at)

alert_org_template_settings       (organization_id, system_template_id text references alert_system_templates(id),
                                    enabled bool default true,
                                    nav_pinned bool default false,
                                    position int default 100,
                                    category_id uuid references alert_template_categories,
                                    override_name text,
                                    override_description text,
                                    override_definition jsonb,
                                    override_metadata_schema jsonb,
                                    override_retention_years int,    -- org can extend; never shorten below legal min
                                    created_at, updated_at,
                                    primary key (organization_id, system_template_id))

alert_org_templates               (id uuid PK, organization_id, slug,
                                    name, description, kind text,
                                    category_id, frameworks, law_refs,
                                    default_confidentiality_level, default_retention_years,
                                    acknowledgement_due_days, investigation_due_days,
                                    requires_dpo, allows_anonymous,
                                    definition jsonb, metadata_schema jsonb,
                                    nav_pinned, is_active, deleted_at, created_at, updated_at,
                                    unique(organization_id, slug))

alert_cases                       (id uuid PK, organization_id,
                                    access_key uuid not null unique default gen_random_uuid(),
                                    kind text not null,             -- mirrors template.kind
                                    source_kind text check in ('system','org'),
                                    system_template_id text references alert_system_templates(id),
                                    org_template_id uuid references alert_org_templates(id),
                                    title text not null,
                                    description text not null default '',
                                    category text,                  -- legacy free-text snapshot, kept for migration
                                    category_id uuid references alert_template_categories(id),
                                    -- Reporter identity (pseudonymisable)
                                    is_anonymous boolean not null default true,
                                    reporter_contact text,          -- email/phone, only when is_anonymous=false
                                    reporter_user_id uuid references auth.users(id) on delete set null,
                                    reporter_display_name text,     -- pseudonymous handle the committee uses
                                    -- Org context (set by committee, not reporter)
                                    location_id uuid references locations(id),
                                    department_id uuid references departments(id),
                                    team_id uuid references teams(id),
                                    assigned_committee_member_ids uuid[] not null default '{}',
                                    metadata jsonb not null default '{}',
                                    -- Workflow
                                    status text not null default 'received'
                                      check in ('received','triage','investigation','internal_review','closed','dismissed'),
                                    confidentiality_level text not null default 'restricted'
                                      check in ('standard','restricted','confidential'),
                                    severity text check in ('low','medium','high','critical'),
                                    -- Timeline
                                    occurred_at_text text,          -- free-form ("forrige uke") — never validated as date
                                    received_at timestamptz not null default now(),
                                    acknowledgement_due_at timestamptz not null,
                                    investigation_due_at timestamptz,
                                    acknowledged_at timestamptz,
                                    closed_at timestamptz,           -- LOCK MARKER
                                    closing_summary text,
                                    closing_outcome text check in ('substantiated','unsubstantiated','inconclusive','referred'),
                                    -- GDPR-breach specific (nullable when kind <> 'gdpr_breach')
                                    breach_type text check in ('confidentiality','integrity','availability','combined'),
                                    affected_categories text[],
                                    affected_subjects_estimate int,
                                    affected_subjects_actual int,
                                    risk_assessment text,
                                    mitigation_actions text,
                                    datatilsynet_reported_at timestamptz,
                                    datatilsynet_reference text,
                                    data_subjects_notified_at timestamptz,
                                    -- Retention (calculated at close)
                                    retention_until timestamptz,
                                    redacted_at timestamptz,        -- when purge function NULLed identity columns
                                    -- Snapshots
                                    definition_snapshot jsonb,      -- frozen template definition at submit
                                    metadata_schema_snapshot jsonb,
                                    -- Audit
                                    created_at, updated_at,
                                    submission_user_agent text,     -- only when not anonymous; for spam triage
                                    submission_locale text
                                  )

alert_case_notes                  (id uuid PK, case_id, organization_id,
                                    author_id uuid references auth.users(id) on delete set null,
                                    body text not null,
                                    note_kind text not null default 'internal'
                                      check in ('internal','communication_to_reporter','communication_from_reporter','system'),
                                    visible_to_reporter boolean not null default false,
                                    created_at timestamptz not null default now()
                                    -- APPEND-ONLY: trigger rejects update/delete
                                  )

alert_case_attachments            (id uuid PK, case_id, organization_id,
                                    storage_bucket text not null default 'alert-attachments',
                                    storage_path text not null,
                                    uploaded_by_user_id uuid,       -- null for anonymous public uploads
                                    filename text not null,
                                    content_type text,
                                    size_bytes bigint,
                                    sha256_hex text,                -- integrity check
                                    is_redacted boolean default false,
                                    created_at timestamptz not null default now(),
                                    unique (case_id, storage_path))

alert_case_timeline_events        (id uuid PK, case_id, organization_id,
                                    event_kind text not null check in (
                                      'submitted','acknowledged','assigned','escalated',
                                      'status_changed','severity_set','attachment_added',
                                      'note_added_public','note_added_internal',
                                      'closed','reopened','retention_purged'),
                                    actor_kind text check in ('reporter','committee','system'),
                                    actor_user_id uuid,
                                    payload jsonb not null default '{}',
                                    created_at timestamptz not null default now()
                                    -- APPEND-ONLY
                                  )
```

### 3.2 `alert_system_templates.definition` jsonb shape

```ts
{
  preparationGuidance: string,            // shown above the public form
  publicFormFields: [
    { key: string,                        // 'title' | 'description' | 'who_what_where' | 'occurred_at_text' | <custom>
      label: string,
      kind: 'text'|'longtext'|'select'|'date_text'|'attachment',
      required: boolean,
      options?: string[],                 // for select
      helpText?: string,
      piiHint?: 'low'|'medium'|'high'     // shown in form: 'Vi anbefaler å unngå navn på enkeltpersoner her'
    }
  ],
  defaultCategorySlug?: string,
  defaultSeverity?: 'low'|'medium'|'high'|'critical',
  committeeChecklistItems: [
    { key: string, label: string, isMandatory: boolean, lawRef?: string }
  ],
  workflowStages: [
    { status: 'received'|'triage'|'investigation'|'internal_review'|'closed',
      slaHours?: number,                  // soft SLA
      requiresRoles?: Array<'committee'|'dpo'|'verneombud'|'tillitsvalgt'> }
  ],
  escalation: {
    onAcknowledgementOverdue?: { action: 'notify_committee'|'notify_dpo'|'notify_management' },
    onInvestigationOverdue?: { action: 'notify_committee'|'notify_management' }
  },
  externalReporting: {                    // for GDPR brudd
    target?: 'datatilsynet'|'arbeidstilsynet',
    deadlineHours?: number,               // 72 for Datatilsynet
    lawRef?: string
  } | null,
  retaliationProtection: {                // for AML varsling
    enabled: boolean,
    lawRefs?: string[]                    // ['AML § 2A-4','AML § 2A-5']
  } | null
}
```

### 3.3 `metadata_schema` (same shape as compliance/meetings)

```ts
TemplateMetadataSchema = { fields: TemplateMetadataField[] }
TemplateMetadataField  = { key, kind, label?, help?, required?, options? }
  kind: 'location' | 'department' | 'team' | 'text' | 'longtext'
      | 'number' | 'select' | 'date' | 'severity' | 'breach_type'
      | 'affected_categories' | 'boolean'
```

The kind-to-column binding mirrors compliance:
- `kind=location|department|team` → `alert_cases.{location_id, department_id, team_id}`
- `kind=severity` → `alert_cases.severity`
- `kind=breach_type` → `alert_cases.breach_type`
- `kind=affected_categories` → `alert_cases.affected_categories`
- everything else → `alert_cases.metadata[key]`

### 3.4 Lock trigger contract (BEFORE UPDATE on `alert_cases`)

**Reject** changes to (always immutable):
- `organization_id`, `system_template_id`, `org_template_id`, `source_kind`, `kind`
- `access_key`, `received_at`
- `reporter_user_id`, `reporter_contact`, `is_anonymous`, `reporter_display_name` *— immutable from day one to prevent post-hoc de-anonymisation*
- `definition_snapshot`, `metadata_schema_snapshot`
- `acknowledgement_due_at` (set at insert by template SLA)
- `confidentiality_level` (set at insert by template default; never relaxable)

**Reject post-`closed_at` changes** to:
- `status`, `closing_summary`, `closing_outcome`, `closed_at` (going non-null → null)
- `datatilsynet_reported_at`, `datatilsynet_reference`, `data_subjects_notified_at`
- `severity`, `breach_type`, `affected_subjects_actual`
- **`title`, `description`** — reporter-supplied free-text fields may contain identity hints; allowing post-close rewrites = identity-laundering vector. Corrections happen via append-only `alert_case_notes` rows flagged `note_kind='internal'`, not in-place mutation.

**Allow** post-`closed_at` changes to:
- `category_id` (recategorisation for analytics)
- `location_id`, `department_id`, `team_id` (org-context re-attribution)
- `assigned_committee_member_ids` (committee membership rotation)
- `metadata` (free-form fields not tied to lock — but note that `metadata` cannot contain identity columns; see §4.3 RPC contract)
- `retention_until`, `redacted_at` (retention purge writes these)

### 3.5 Append-only triggers on `alert_case_notes` + `alert_case_timeline_events`

Mirrors existing `whistleblowing_notes_no_mutation()` — `BEFORE UPDATE` and `BEFORE DELETE` triggers raise exception. The purge function (§3.7) writes to `alert_case_notes.body` via a controlled redaction path: it's the *only* SQL function exempted from the append-only triggers (via `session_replication_role` or a dedicated bypass flag).

Additional **post-close note insert gate**: trigger `BEFORE INSERT on alert_case_notes` rejects inserts with `visible_to_reporter = true` against a case where `closed_at is not null` unless the author holds `alerts.committee_confidential`. Closes T11 retroactive-leak vector — a malicious committee member can't surface identity-bearing text to the reporter after close.

### 3.6 Provision function

```sql
function public.provision_alerts_baseline_for_org(p_org_id uuid) returns void
language plpgsql security definer
```

Does:
1. Seed default categories: AML-varsling, GDPR-brudd, HMS-avvik, Sikkerhet, Etisk.
2. Insert one `alert_org_template_settings` row per system template (`enabled=true`).
3. Map each system template to its default category via `default_category_slug`.

Wired to `after insert on organizations` trigger. Backfill loop runs once at migration end.

### 3.7 Retention purge function

```sql
function public.alerts_purge_expired_cases() returns int
language plpgsql security definer
```

Selects rows where `closed_at is not null AND retention_until < now() AND redacted_at is null`. **Row-level lock**: `select … for update skip locked` to avoid races with concurrent committee edits or the storage-attachment cron. For each row:
- NULLs on `alert_cases`: `description`, `reporter_contact`, `reporter_display_name`, `reporter_user_id`, `closing_summary`, `risk_assessment`, `mitigation_actions`, `metadata`, `submission_user_agent`, `submission_locale`.
- Replaces `title` with `'[redacted: retention expired]'`.
- NULLs `alert_case_notes.body` where `visible_to_reporter = true OR note_kind in ('communication_to_reporter','communication_from_reporter')` for the case (these are the only note classes that can contain reporter-shared PII). Internal investigation notes are kept — auditable evidence the committee acted, with reporter PII already minimised by §4.1 T6 redaction tooling at insert time.
- Soft-deletes attachment rows (`is_redacted = true`, `storage_path` nulled); corresponding storage objects deleted via separate scheduled Edge Function `alerts-purge-attachments` keyed off `redacted_at`.
- Sets `redacted_at = now()`; inserts `retention_purged` timeline event.

Scheduled daily via Supabase `cron.schedule()`. Result count logged for audit. Idempotent — re-running on a redacted row is a no-op via the `redacted_at is null` filter.

### 3.8 Art. 17 erasure path (right-to-be-forgotten)

```sql
function public.alerts_erase_case(p_case_id uuid, p_legal_basis text, p_actor uuid) returns void
language plpgsql security definer
```

Separate from `alerts_purge_expired_cases()`. Used when an identified-tier reporter exercises GDPR Art. 17. **Hard-deletes** the `alert_cases` row + cascading children (notes, attachments, timeline events) inside a single transaction; writes a single audit row in `level1_audit_log` with `event='alert_case_erased', case_kind, legal_basis, actor_user_id, redaction_only_count` (the case ID is *not* preserved — only counts).

Permission gate: `alerts.dpo` (data protection officer) only. Anonymous-tier cases (`is_anonymous = true`) cannot be erased via this path because there's no verified subject — they fall under §3.7 retention only.

---

## 4 · Security & anonymity architecture (priority section)

This section is the legally-load-bearing part of the spec. Every claim
here must hold true after Phase A ships — otherwise the module is not
shippable.

### 4.1 Threat model

| # | Threat | Mitigation |
|---|---|---|
| T1 | An admin user with `module.view.admin` on the org tries to read another org's cases | RLS `alert_cases_select` checks `organization_id = current_org_id()` AND (`is_org_admin()` OR `user_has_permission('alerts.committee')` OR `reporter_user_id = auth.uid()`). No service-role queries from client. |
| T2 | A committee member tries to de-anonymise a reporter who chose anonymity | `reporter_contact`, `reporter_user_id`, `reporter_display_name`, `is_anonymous` are **immutable** from insert via lock trigger. There is no admin UI surface to edit these fields. |
| T3 | A reporter's IP address leaks via Supabase logs | Public RPC `public_submit_alert` does **not** receive IP as a parameter and does **not** read `request.headers` for IP. **The captcha Edge Function explicitly scrubs IP-bearing headers before downstream calls**: at function start, `delete request.headers['cf-connecting-ip']`, `delete request.headers['x-forwarded-for']`, `delete request.headers['x-real-ip']`. Captcha verification with Cloudflare Turnstile uses **only the token**, not the client IP optional parameter. Supabase log retention for the `alerts-*` Edge Functions is configured to **0 days** via `supabase functions deploy --no-log-retention` (or equivalent project setting). Verified by post-deploy check: `supabase logs --function alerts-public-submit --since 1h` returns empty. |
| T4 | An attacker brute-forces `access_key` UUIDs to read other reporters' status | `access_key` is `uuid v4` (122 bits entropy). `public_alert_status` returns only `{status, updatedAt, acknowledgementDueAt, publicNotes: [{body}]}` — no identity-bearing fields. Brute-force gives an attacker only the publishable status of an unknown case. **Rate-limiting**: status lookups go through Edge Function `alerts-public-status` (not direct RPC), which throttles via a DB-side table `alerts_public_status_throttle (ip_hash text, window_start timestamptz, attempts int)` with sliding-window check (10 attempts/hour per `sha256(ip + daily_salt)`). Daily salt rotated by cron; throttle rows TTL'd after 24h. |
| T5 | A reporter loses their access_key and asks support to recover it | **There is no recovery flow.** access_key is the only handle on an anonymous case. Loss = case lookup impossible for the reporter (committee can still operate the case). UI explicitly warns at submit time. |
| T6 | An attachment uploaded by an anonymous reporter contains PII the reporter didn't intend to share | Public form shows `piiHint` on relevant fields ("Vi anbefaler å unngå navn på enkeltpersoner her"). Storage bucket is private; signed URLs are 60s TTL. Committee UI surfaces "Redact?" tooling that adds a `redacted` version alongside the original. |
| T7 | Service-role queries from a misconfigured Edge Function expose all cases | RLS is enabled on all alerts tables (no `SECURITY DEFINER` reads except the two whitelisted public RPCs, which return scoped subsets only). Edge Functions for captcha/purge use `service_role` but operate on a strict whitelist of columns. |
| T8 | A retention purge accidentally deletes evidence in an active case | Purge function filters `closed_at is not null` — open cases are never touched. Additional guard: `closed_at + retention_years` must be in the past, calculated from `retention_until` written at close-time. |
| T9 | A captcha bypass enables submission spam | hCaptcha (or Cloudflare Turnstile) verification in Edge Function before the RPC. Falls open in dev (`ALERT_CAPTCHA_REQUIRED=false`). Production deploys require the env var set true. |
| T10 | A confidential case (e.g. naming the CEO as subject) becomes visible to org-admin | Confidentiality level `confidential` requires `alerts.committee_confidential` permission. `is_org_admin()` alone is **not sufficient**. RLS clause: `(level = 'confidential' AND user_has_permission('alerts.committee_confidential')) OR (level <> 'confidential' AND (is_org_admin() OR user_has_permission('alerts.committee')))`. |
| T11 | A note authored by a committee member contains the reporter's real name and later leaks via reporter's status check | `alert_case_notes.visible_to_reporter` defaults `false`. Only notes explicitly flagged `true` surface to `public_alert_status`. UI shows a warning when toggling that flag. **Post-close gate** (§3.5 trigger): inserts on `alert_case_notes` with `visible_to_reporter=true` against a closed case require `alerts.committee_confidential`. Retroactive surfacing of identity data to the reporter is blocked unless the highest-privilege actor explicitly approves. |
| T12 | An exporter pulls a CSV that includes anonymous reporter fields | CSV export of cases excludes `reporter_contact`, `reporter_user_id`, `reporter_display_name`, `submission_user_agent` unless the operator explicitly checks "Inkluder identitetsfelt" (and that requires `alerts.committee_confidential`). |

### 4.2 Anonymity tiers (declared on each case)

| Tier | `is_anonymous` | `reporter_contact` | `reporter_user_id` | When chosen |
|---|---|---|---|---|
| Full anonymous | true | null | null | Default public form choice. No follow-up channel except access_key status check. |
| Pseudonymous | true | nullable email | null | Reporter provides a single contact for follow-up; committee never sees real identity unless reporter chooses to reveal in a note. |
| Identified (public) | false | required contact | null | Submitted via public form, not anonymously. |
| Identified (auth) | false | optional | required | Logged-in employee submits — `reporter_user_id` set, committee sees who they are. |

Tier choice is irrevocable post-submit (lock trigger §3.4).

### 4.3 Storage + RPC contracts

- Storage bucket `alert-attachments`: **private**, no public read policy. Signed URLs only, 60 s TTL.
- Public RPC `public_submit_alert(p_org_slug, p_template_slug, p_payload, p_captcha_token)`:
  - `security definer`, `set search_path = public`.
  - Validates `p_org_slug` against `organizations.alerts_public_slug` (renamed from `whistle_public_slug` in migration).
  - Validates `p_template_slug` exists and `is_active = true` and template's `allows_anonymous = true` (or session is authenticated, which would bypass this RPC entirely).
  - Validates `p_payload` against template `definition.publicFormFields`: required fields present, kinds match.
  - **Strict key allowlist**: any key in `p_payload` not declared in `definition.publicFormFields[].key` raises exception `invalid_payload_key: <key>`. Closes the column-injection vector where an attacker stuffs `reporter_user_id`, `is_anonymous`, `closed_at`, etc. into the payload hoping the materialiser blindly forwards them.
  - **Whitelist materialisation**: the insert statement only references the whitelisted column set (`title`, `description`, `metadata`, `category`, `occurred_at_text`, and any template-declared metadata-schema field bound to a typed column per §3.3). Other case columns (`reporter_*`, `closed_at`, `severity` for non-`gdpr_breach` kinds, etc.) are *never* read from `p_payload`.
  - Inserts row with `is_anonymous = true` (unless session token present and `auth.uid()` resolves *and* the template's `requires_dpo` is false — DPO submissions for GDPR breaches go through a different authenticated RPC, not this one).
  - Returns `{caseId, accessKey, message}`. Caller stores `accessKey` only.
- Public RPC `public_alert_status(p_access_key uuid)`:
  - Returns `{found, status?, updatedAt?, acknowledgementDueAt?, publicNotes?: [{body, createdAt}]}`.
  - Never returns identity fields; never returns case ID.

### 4.4 Audit trail

- `alert_case_timeline_events` append-only — every state transition writes a row with `actor_kind` + optional `actor_user_id` + `payload` (e.g. status from→to).
- `level1_audit_log` (existing infra) writes one row per RLS-policy denied query, plus per `closed_at` set.
- Dashboard surfaces audit counts but never the underlying user identities except to `alerts.committee_confidential` holders.

---

## 5 · Compliance plan (compliance-officer self-audit)

Every template ships law-ref-grounded and Arbeidstilsynet/Datatilsynet-defensible. Below is the full template inventory with the requirements each closes.

### 5.1 AML kap. 2A — Varsling (whistleblowing)

| Slug | Template | Kind | Cadence | Allows anonymous | Key law refs |
|---|---|---|---|---|---|
| `aml-varsel-generell` | Varsel — generelt kritikkverdig forhold | whistleblowing | ad_hoc | yes | AML § 2A-1, § 2A-2, § 2A-3, § 2A-4, § 2A-7 |
| `aml-varsel-trakassering` | Varsel — trakassering eller mobbing | whistleblowing | ad_hoc | yes | AML § 4-3, § 2A-1, Likestillings- og diskrimineringsloven § 13 |
| `aml-varsel-seksuell-trakassering` | Varsel — seksuell trakassering | whistleblowing | ad_hoc | yes | AML § 4-3, Likestillings- og diskrimineringsloven § 13, § 26 |
| `aml-varsel-okonomisk-misbruk` | Varsel — korrupsjon eller økonomisk misbruk | whistleblowing | ad_hoc | yes | AML § 2A-1 (2), Straffeloven § 387, § 388 (grov korrupsjon), § 389 (påvirkningshandel) |
| `aml-varsel-hms-fare` | Varsel — fare for liv eller helse (HMS) | whistleblowing | ad_hoc | yes | AML § 2A-1 (2), § 4-1, § 6-3 |
| `aml-varsel-miljo` | Varsel — miljøkriminalitet | whistleblowing | ad_hoc | yes | AML § 2A-1 (2), Forurensningsloven § 78 |
| `aml-varsel-gjengjeldelse` | Varsel — gjengjeldelse etter tidligere varsel | whistleblowing | ad_hoc | yes | AML § 2A-4, § 2A-5 |
| `aml-varsel-mot-leder` | Varsel — forhold som angår øverste leder eller styret | whistleblowing | ad_hoc | yes | AML § 2A-1, § 2A-2 (3), § 2A-7 (5) |

`aml-varsel-mot-leder` is the **escape-hatch template** required by AML § 2A-2 (3) when the reportable conduct involves the normal committee recipient. Its `definition.workflowStages` routes to an **alternate committee roster** (configured separately under `AlertsCommitteeRosterPanel` as `kind='whistleblowing_escalated'`) and locks out the standard `alerts.committee` permission — only `alerts.committee_escalated` holders see these cases. If no escalated roster is configured, the template's public form surfaces the external-channel guidance (Arbeidstilsynet, Økokrim) prominently as a fallback.

All eight default to `confidentiality_level = 'restricted'`, retention 5 years post-close (org policy floor, not statutory). `acknowledgement_due_days` is stored as **calendar days** in the column (`acknowledgement_due_at timestamptz`) but the UI label says "innen 5 virkedager" — conversion uses `add_business_days(received_at, 5)` helper that skips Saturdays, Sundays, and the canonical Norwegian public-holiday set (`scripts/no_holidays.sql` lookup). Closes the calendar-vs-business-days mismatch.

### 5.2 GDPR Art. 33 + 34 — personal-data breach

| Slug | Template | Kind | Cadence | Allows anonymous | Key law refs |
|---|---|---|---|---|---|
| `gdpr-brudd-konfidensialitet` | GDPR-brudd — uautorisert tilgang (konfidensialitet) | gdpr_breach | ad_hoc | no (DPO submits) | GDPR Art. 33, Art. 34, Personopplysningsloven § 5 |
| `gdpr-brudd-integritet` | GDPR-brudd — endring/korrupsjon (integritet) | gdpr_breach | ad_hoc | no | GDPR Art. 33, Art. 32 |
| `gdpr-brudd-tilgjengelighet` | GDPR-brudd — tap eller utilgjengelighet | gdpr_breach | ad_hoc | no | GDPR Art. 33, Art. 32 (1) (b) |
| `gdpr-brudd-leverandor` | GDPR-brudd — databehandler-hendelse | gdpr_breach | ad_hoc | no | GDPR Art. 28, Art. 33 (2) |
| `gdpr-brudd-feilsending` | GDPR-brudd — feilsendt e-post / dokument | gdpr_breach | ad_hoc | yes (ansatt rapporterer) | GDPR Art. 33, Personopplysningsloven § 1 + § 5 |
| `gdpr-brudd-lavrisiko` | GDPR-brudd — lav risiko, ikke meldepliktig | gdpr_breach | ad_hoc | no | GDPR Art. 33 (1) ("unless unlikely to result in risk") |

All six default `confidentiality_level = 'restricted'`, retention 5 years post-close (Art. 33 (5) dokumentasjonsplikt; Datatilsynets veiledning om internkontroll — no fixed floor, 5 years matches most practitioner guidance), `requires_dpo = true`, `acknowledgement_due_days = 1` (so DPO sees the case before the 72-hour clock runs out), `externalReporting.deadlineHours = 72`, `externalReporting.target = 'datatilsynet'`.

**`gdpr-brudd-lavrisiko` is the no-notification template** — its `definition.externalReporting` is `null` (not just deadline-zero), so the dashboard widget `alerts_gdpr_72h_compliance` excludes these rows from its bucketer. DPO sets this kind explicitly after Art. 33 (1) risk assessment; the case is still recorded in `alert_cases` for Art. 33 (5) dokumentasjonsplikt.

### 5.3 HMS / sikkerhet / etisk

| Slug | Template | Kind | Cadence | Allows anonymous | Key law refs |
|---|---|---|---|---|---|
| `hms-avvik-personskade` | HMS-avvik — personskade eller nestenulykke | hms_incident | ad_hoc | yes | AML § 4-1, § 5-1, IK-f § 5 |
| `hms-avvik-yrkeshygiene` | HMS-avvik — yrkeshygiene (støy, kjemikalier, ergonomi) | hms_incident | ad_hoc | yes | AML § 4-4, Forskrift om utførelse av arbeid |
| `sikkerhet-hendelse-fysisk` | Sikkerhetshendelse — fysisk (innbrudd, hærverk) | security_incident | ad_hoc | yes | Internkontroll § 5, NS-ISO 27001 § 16 |
| `sikkerhet-hendelse-it` | Sikkerhetshendelse — IT/cyber (utenom GDPR) | security_incident | ad_hoc | no | NS-ISO 27001 § 16, NSM grunnprinsipper |
| `etisk-bekymring` | Etisk bekymring — uten kritikkverdig forhold | ethical_concern | ad_hoc | yes | Org-spesifikk etikkpolicy |

### 5.4 Default categories (per org, seeded)

| Slug | Name | Description | Position |
|---|---|---|---|
| `aml-varsling` | AML — varsling kap. 2A | Kritikkverdige forhold etter arbeidsmiljøloven | 10 |
| `gdpr-brudd` | GDPR — brudd på personvern | Art. 33/34 hendelsesregister med 72-timersfrist | 20 |
| `hms-avvik` | HMS-avvik | Personskader, nestenulykker og yrkeshygieniske forhold | 30 |
| `sikkerhet` | Sikkerhet | Fysiske + IT-sikkerhetshendelser utenfor GDPR | 40 |
| `etisk` | Etiske bekymringer | Forhold uten klart lovbrudd men i strid med etikk | 50 |

### 5.5 Compliance officer self-audit (per Arbeidstilsynet + Datatilsynet POV)

- [x] **AML § 2A-7 (1)** plikt til skriftlige rutiner: Document `tpl-varslingsrutiner` (already shipped via `20260828120044_aml_chap2a_varsling.sql`) covers the policy. Alerts module provides the **operating channel** the policy points to.
- [x] **AML § 2A-7 (5)** taushetsplikt om varslerens identitet: Lock trigger (§3.4) makes `reporter_*` fields immutable from insert; RLS prevents non-committee reads; UI never surfaces identity to non-committee users.
- [x] **AML § 2A-2 (3)** forsvarlig framgangsmåte: Public form explains internal-vs-external escalation per template; `aml-varsel-generell` includes guidance on Arbeidstilsynet / Økokrim / Datatilsynet external channels in the `preparationGuidance`.
- [x] **AML § 2A-3** aktivitetsplikt: `acknowledgement_due_days = 5` baked into AML templates; dashboard surfaces overdue acknowledgements as red badge.
- [x] **AML § 2A-4** gjengjeldelsesforbud: Dedicated `aml-varsel-gjengjeldelse` template separates retaliation reports from primary disclosure; `definition.retaliationProtection.enabled = true` flags case for priority handling.
- [x] **GDPR Art. 33 (1)** 72-timersfrist: GDPR templates set `externalReporting.deadlineHours = 72`. Trigger `set_alert_external_deadline()` (mirroring existing `set_gdpr_breach_deadline`) computes deadline = received_at + 72h, stored in immutable column.
- [x] **GDPR Art. 33 (5)** dokumentasjonsplikt: `alert_case_timeline_events` audit-log captures every state transition; CSV export available for tilsyn.
- [x] **GDPR Art. 34** notification to data subjects when "high risk": GDPR templates surface `data_subjects_notified_at` as required-when-`severity in ('high','critical')` field.
- [x] **GDPR Art. 5 (1) (f)** konfidensialitet og integritet: Storage private bucket + RLS + append-only notes/timeline.
- [x] **GDPR Art. 5 (1) (e)** lagringsbegrensning: Retention policy enforced by `alerts_purge_expired_cases()`. (**Earlier draft incorrectly cited Personopplysningsloven § 5** — § 5 governs territorial scope, not retention. Corrected.)
- [x] **GDPR Art. 17** right-to-erasure: Separate `alerts_erase_case()` hard-delete path (§3.8) for identified-tier reporters; anonymous-tier cases fall under retention only.
- [x] **Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (Internkontrollforskriften, IK-f) § 5 nr. 7** systematisk gjennomgang av varsler: Dashboard `alerts_kpi_summary` + `alerts_by_category` + `alerts_law_ref_coverage` give the AMU annual-report data point.
- [x] **NS-ISO 27001 § 16** information-security-incident management: `sikkerhet-hendelse-it` template aligns event categories to ISO 27001 Annex A.
- [x] **IK-f § 5 nr. 7** rutiner for håndtering av avvik: HMS templates produce `hms_incident` cases that feed the existing HMS analyse page via cross-scope dataset.
- [x] **Restrisiko (acknowledged, not blockers for v1):**
  - **BankID-signering av lukke-handlinger** deferred — current UI labels protocol close as "Bekreftelse (forhåndsregistrering — ikke juridisk signatur)" per the meetings-module precedent.
  - **Whistleblower legal counsel referral** — out of scope; module surfaces "AML § 2A-2 (2): du kan alltid varsle advokat" as guidance text, but doesn't operate a referral channel.
  - **Cross-org case sharing** (e.g. shared services in concern) — out of scope; each org's alerts are strictly scoped to `organization_id`.

---

## 6 · Module file layout (under `modules/alerts/`)

Mirrors `modules/meetings/` byte-for-byte where possible. Files marked **(new)** don't exist in any reference module; **(mirror)** indicates direct copy with rename.

```
modules/alerts/
  index.ts                              # (mirror)
  types.ts                              # (mirror) row + enum + jsonb shapes
  schema.ts                             # (mirror) zod parsers + parseRows helper
  useAlerts.ts                          # (mirror) main hook (state + mutations)
  useAlertsNav.ts                       # (mirror) pinned nav items resolver
  useAlertsCategories.ts                # (mirror) categories sub-hook
  alertsLegalReferences.tsx             # (mirror) legal-refs banner
  alertsLabels.ts                       # (mirror) status / kind / framework labels
  alertsModuleSettingsSchema.ts         # (mirror) zod for module-level settings
  alertTemplateApply.ts                 # (mirror) template → case materialisation helper
  alertsAnalytics.ts                    # (mirror) bucketers shared by datasets + CSV
  retentionCalculator.ts                # (new) computes retention_until at close

  components/
    AlertCaseMetadataPanel.tsx          # (mirror of MeetingMetadataPanel)
    AlertCaseTimeline.tsx               # (new) renders timeline_events as visual log
    AlertCaseNotesList.tsx              # (new) append-only note composer + reader
    AlertCaseAttachmentsPanel.tsx       # (new) signed-URL viewer + redaction
    AlertCommitteeRoster.tsx            # (new) assigned_committee_member_ids editor
    AlertGdprDeadlineBadge.tsx          # (new) 72h countdown for gdpr_breach
    AlertAcknowledgementBadge.tsx       # (new) acknowledgement_due_at countdown
    AlertConfidentialityBanner.tsx      # (new) restricted/confidential warning
    AlertRetentionNotice.tsx            # (new) shows retention_until + redacted state
    AlertAnonymityIndicator.tsx         # (new) pill showing case anonymity tier

  dashboards/
    alertsDashboardScope.ts             # (mirror) registerDashboardScope({ scopeId: 'alerts', ... })
    useAlertsDatasets.ts                # (mirror)

  admin/
    AlertsKategorierTab.tsx             # (mirror of MeetingsKategorierTab)
    AlertsMalerTab.tsx                  # (mirror of MeetingsMalerTab)
    AlertsTemplateEditorPanel.tsx       # (mirror of MeetingsTemplateEditorPanel)
    AlertsModuleSettingsPanel.tsx       # (mirror)
    AlertsCommitteeRosterPanel.tsx      # (new) module-level: who is on the committee per kind
    AlertsRetentionPolicyPanel.tsx      # (new) admin can extend (never shorten) per template

  pages/
    AlertsHubLanding.tsx                # (mirror of MeetingsHubLanding)
    AlertsPage.tsx                      # (mirror) hub router (?template= / no params)
    AlertsDetailView.tsx                # (mirror of MeetingsDetailView)
    AlertsAllePage.tsx                  # (mirror of MeetingsAllePage)
    AlertsAnalysePage.tsx               # (mirror of MeetingsAnalysePage)
    AlertsAdminPage.tsx                 # (mirror)
    PublicAlertSubmitPage.tsx           # (replaces PublicWhistlePage)
    PublicAlertStatusPage.tsx           # (replaces WhistleStatusPage)
```

---

## 7 · Phase plan

### Phase A · DB schema + provision fn + retention infra  *(1 commit)*

**A1** Migration `20260910120000_alerts_module_core.sql` — every table + RLS + triggers + provision fn + retention purge fn.
**A2** Migration `20260910120001_alerts_storage_bucket.sql` — create private `alert-attachments` bucket + policies.
**A3** Migration `20260910120002_alerts_seed_system_templates.sql` — 17 system templates listed in §5.1-5.3.
**A4** Migration `20260910120003_alerts_seed_categories.sql` — default categories seed via `provision_alerts_baseline_for_org` backfill loop.

Acceptance: `select count(*) from alert_system_templates` returns ≥ 17. Provision backfill creates settings rows for every (org × template).

### Phase B · Data migration from legacy tables  *(1 commit)*

**B1** Migration `20260910120010_alerts_migrate_whistleblowing.sql` — copy `whistleblowing_cases` → `alert_cases` mapping `category` → `system_template_id` via lookup table (one-to-many mapping; fallback to `aml-varsel-generell` template). Copy `whistleblowing_case_notes` → `alert_case_notes` as `note_kind='internal'`.
**B2** Migration `20260910120011_alerts_migrate_gdpr_breach.sql` — copy `gdpr_breach_incidents` → `alert_cases` with `kind='gdpr_breach'`, mapping `breach_type` to the right gdpr-* template. Preserve `detected_at` → `received_at`, `deadline_at` → 72h external deadline, `resolved_at` → `closed_at`.
**B3** Migration `20260910120012_alerts_drop_legacy_tables.sql` — drop `whistleblowing_cases`, `whistleblowing_case_notes`, `gdpr_breach_incidents`. Drop legacy RPCs. **Verification gate**: requires `select count(*) from alert_cases where access_key in (select access_key from whistleblowing_cases)` to match before dropping.

Acceptance: every row in legacy tables now has a corresponding `alert_cases` row. Legacy URLs still work via redirect (Phase F).

### Phase C · Module skeleton  *(1 commit)*

`modules/alerts/{types.ts, schema.ts, useAlerts.ts, index.ts}` + barrel exports + `alertsLabels.ts`. No UI yet. TS clean.

Acceptance: `import { useAlerts } from 'modules/alerts'` compiles. Hook loads from Supabase (empty state) without crashing. Existing TypeScript references to `useWhistleblowing` flagged for replacement.

### Phase D · Public-facing UI (replaces legacy public pages)  *(1 commit)*

`PublicAlertSubmitPage.tsx` + `PublicAlertStatusPage.tsx` + new public RPCs `public_submit_alert` / `public_alert_status` / `public_alert_org_lookup`. Old `PublicWhistlePage.tsx`, `WhistleStatusPage.tsx`, `PublicAnonymousAmlPage.tsx` deleted. Old RPCs `public_submit_whistleblowing` / `public_whistleblowing_status` / `public_whistleblowing_org_lookup` dropped in same migration.

`/varsle/:slug` and `/varsle/status` routes kept temporarily as 301-redirects to `/alerts/public/:slug` and `/alerts/public/status`.

Acceptance: anonymous submission via new public form creates `alert_cases` row. Access-key status lookup returns expected payload.

### Phase E1 · Hub + detail view  *(1 commit)*

`AlertsPage.tsx` (hub router) + `AlertsHubLanding.tsx` + `AlertsDetailView.tsx` (tabs: Informasjon, Tidslinje, Notater, Vedlegg, Lukking) + `AlertsAllePage.tsx`.

No admin / analyse yet. Reads from `useAlerts`. Existing migrated cases visible per template.

Acceptance: navigate to `/alerts`, see 17 system templates grouped by category. Click a template → see existing migrated cases + "+ Opprett varsel". Open a case → tabs render. Add a note (committee) → appears in timeline. Upload an attachment → signed-URL viewer works.

### Phase E2 · Admin + analyse  *(1 commit)*

`AlertsAdminPage.tsx` (templates list + categories + committee roster + retention policy) + `AlertsAnalysePage.tsx` + `alertsDashboardScope.ts` + `useAlertsDatasets.ts` + `AlertsCommitteeRosterPanel.tsx` + `AlertsRetentionPolicyPanel.tsx`.

Acceptance: `/alerts/admin` opens, admin can toggle a system template + edit categories + manage committee roster + extend retention. `/alerts/analyse` opens with KPI tiles + 9 filter chips. Filters narrow results; drill-down click on status donut adds a chip.

### Phase F1 · Sidebar + routes  *(1 commit, vertical slice — pure nav)*

`AticsShell.tsx` adds `alertsGroup` between `meetingsGroup` and `registersGroup`. `alertsFixedSubs` for Analyse + Innstillinger. `useAlertsNav` resolver registered.

`App.tsx` routes (new, alongside existing legacy routes — no purge yet):
- `/alerts` → `AlertsPage`
- `/alerts/admin` → `AlertsAdminPage`
- `/alerts/analyse` → `AlertsAnalysePage`
- `/alerts/alle` → `AlertsAllePage`
- `/alerts/:caseId` → `AlertsDetailView`
- `/alerts/public/:slug` → `PublicAlertSubmitPage` (already exists from Phase D)
- `/alerts/public/status` → `PublicAlertStatusPage` (already exists from Phase D)

Acceptance: top-level "Varslinger" entry visible in sidebar with Analyse/Innstillinger children and pinned templates below. Legacy `/workplace-reporting/*` + `/varsle/*` routes still resolve.

### Phase F2 · Permission rename  *(1 commit, vertical slice — pure permission migration)*

Migration `<ts>_alerts_permission_rename.sql`:
- Add new permissions: `alerts.committee`, `alerts.committee_confidential`, `alerts.committee_escalated`, `alerts.dpo`, `alerts.manage`, `module.view.alerts`.
- Copy grants from old: every `role_permissions` row with `permission_key='whistleblowing.committee'` gets a sibling row with `permission_key='alerts.committee'`. Same for `whistleblowing.view` → `alerts.view` (new), `whistleblowing.assign` → `alerts.assign` (new), `module.view.workplace_reporting` → `module.view.alerts`.
- **Do not drop the old permission keys yet** — leaves dual-grant until Phase F4 final code purge.

Code updates in same commit:
- `src/lib/permissionKeys.ts` lines 33-34, 102-104, 148, 181-182: add the new keys alongside old.
- `src/components/layout/AticsShell.tsx` `MEETINGS_NAV_PERMS`-style add `ALERTS_NAV_PERMS = ['module.view.alerts', 'alerts.committee', 'alerts.committee_confidential', 'alerts.dpo']`.

Acceptance: a role that holds `whistleblowing.committee` automatically has `alerts.committee`. `/alerts` is gated by the new permission. Old code paths still work.

### Phase F3 · Cross-module reference re-point  *(1 commit, vertical slice — touching consumers)*

Re-point existing non-purge-target references to read from new tables:
- `modules/meetings/useMeetingDataBindings.ts`: `whistleblowing_cases` → `alert_cases` (with `kind='whistleblowing'` filter); update `whistleblowing_anonymized` resolver. Same for `modules/meetings/lib/frameworkSignals.ts`, `modules/meetings/types.ts`, `modules/meetings/dashboards/meetingBriefingDashboardScope.ts`, `modules/meetings/dashboards/useMeetingBriefingDatasets.ts`, `modules/meetings/lib/bindingToReportModule.ts` (verify each via grep — supervisor counted 7 files in `modules/meetings/`).
- `supabase/functions/datatilsynet-breach-report/index.ts`: read from `alert_cases where kind='gdpr_breach'` instead of `gdpr_breach_incidents`. Column mapping per migration B2.
- `supabase/functions/compliance-audit-pdf/index.ts`: same re-point.
- `supabase/functions/role-compliance-reconcile/index.ts`: re-point if it reads `gdpr_breach_*` view (verify via grep first).
- `supabase/functions/gov-datatilsynet-breach/index.ts`: re-point.
- `supabase/migrations/20260908120000_pundit_invest_demo_seed_150.sql`: rewrite the seed to insert into `alert_cases` instead of `whistleblowing_cases` (this is an active migration — must be rewritten in-place since it appears in fresh-DB apply order, before drop migrations).
- `src/types/organization.ts` line 8: rename `whistle_public_slug` → `alerts_public_slug`. Migration `<ts>_org_alerts_public_slug_rename.sql` adds new column, copies data, drops old column. Trigger `organizations_set_whistle_slug()` → `organizations_set_alerts_slug()`.
- `src/types/orgHealth.ts`, `src/types/documents.ts`, `src/data/workflowConditionFields.ts`, `src/data/workflowInputPresets.ts`, `src/lib/workflows/gov/govWorkflowScope.ts`, `src/pages/admin/dashboards/useComplianceDatasets.ts`, `src/pages/ComplianceAmlPage.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/OrgHealthModule.tsx`, `src/pages/ProjectDashboard.tsx`, `src/pages/ComplianceDashboardPage.tsx`, `src/components/OrgGate.tsx`, `src/lib/icOverviewLayoutFromPreset.ts`, `src/components/layout/ShellHeaderWidgets.tsx` (lines 279, 288, 409 — `/workplace-reporting` quick actions): all updated to reference new tables/routes/types.
- `src/pages/AuthPage.tsx` lines 303-307: update public-facing login page links to `/alerts/public/...`.

Acceptance: every consumer outside the legacy-delete list now reads from `alert_*` tables / new routes. Meetings briefing dashboard still renders. Edge functions return data when invoked.

### Phase F4 · Legacy code purge  *(1 commit, destructive)*

Delete:
- **Pages**: `src/pages/PublicWhistlePage.tsx`, `WhistleStatusPage.tsx`, `WorkplaceReportingPage.tsx`, `WorkplaceAnonymousAmlPage.tsx`, `WorkplaceAnonymousAmlSettingsPage.tsx`, `PublicAnonymousAmlPage.tsx`, `WorkplaceIncidentsPage.tsx` (only delete if grep confirms no other consumer), `admin/GdprBreachAdminPanel.tsx`.
- **Hooks**: `src/hooks/useWhistleblowing.ts`, `useWorkplaceReportingCases.ts`.
- **Types**: `src/types/whistleblowing.ts`.
- **Data**: `src/data/amlAnonymousReporting.ts`, `src/data/workplaceCaseCategories.ts`, `src/data/workplaceReportingNav.ts` (verify via grep first).
- **Lib**: `src/lib/varslingssakerLayoutFromPreset.ts`.
- **Components**: `src/components/workplace/WorkplaceReportingCasesSection.tsx`, `src/components/workplace/WorkplaceReportingHubMenu.tsx` (verify), and any other `src/components/workplace/Workplace*Reporting*` files.
- **App.tsx**: remove imports + route entries for the deleted pages (lines 32, 35-36, 134-135, 241-243, 315-319). Add 301-redirects from `/varsle/:slug` → `/alerts/public/:slug` and `/varsle/status` → `/alerts/public/status` (per OQ-A2 — these stay permanently, but removed from `App.tsx` per legacy purge means moved to a small redirect-table module).
- **AdminPage.tsx**: remove `GdprBreachAdminPanel` render.
- **AticsShell.tsx** lines 401-407, 538-542: remove `/workplace-reporting` module entry + `module.view.workplace_reporting` permission.
- **permissionKeys.ts**: drop old keys `whistleblowing.committee`, `whistleblowing.view`, `whistleblowing.assign`, `module.view.workplace_reporting`. Migration `<ts>_alerts_drop_legacy_permissions.sql` deletes old `role_permissions` rows.
- **ModuleShortcutGrid.tsx**: replace shortcut target.

Migration in same commit:
- `<ts>_alerts_drop_legacy_rpcs.sql`: drop `public_submit_whistleblowing`, `public_whistleblowing_status`, `public_whistleblowing_org_lookup`.

Acceptance: `npx tsc -b` clean. `npx eslint .` clean. `grep -rE 'whistleblowing|WhistleblowingCase|useWhistleblowing|useWorkplaceReportingCases|GdprBreachAdminPanel|whistle_public_slug|WorkplaceAnonymousAml|PublicWhistle|WhistleStatusPage|WorkplaceReportingPage|amlAnonymousReporting|workplaceCaseCategories|varslingssakerLayoutFromPreset|workplaceReportingNav|WorkplaceReportingCasesSection|WorkplaceReportingHubMenu|public_submit_whistleblowing|public_whistleblowing_status|public_whistleblowing_org_lookup|whistleblowing.committee|whistleblowing.view|whistleblowing.assign|module.view.workplace_reporting|/workplace-reporting' src/ modules/ supabase/functions/` returns 0 results outside `supabase/migrations/archive/` and outside the new redirect-table module.

---

## 8 · Datasets for `alerts` dashboard scope (Phase E input)

Accent: `#b91c1c` (rød) — signals "incident / alarm". Distinct from existing scopes (compliance green, survey purple, tasks amber, learning teal, documents deep teal, meetings cyan, hms-oversikt indigo).

| Key | Shape | Bucket logic |
|---|---|---|
| `alerts_kpi_summary` | kpi-record | `{ total, openCases, overdueAcknowledgement, overdueInvestigation, closedYtd, anonymousShare, criticalSeverity }` |
| `alerts_status_distribution` | segments | `{ Mottatt, Triage, Undersøkelse, Intern_review, Lukket, Avvist }` |
| `alerts_kind_distribution` | segments | per `kind` (whistleblowing / gdpr_breach / hms_incident / security_incident / ethical_concern) |
| `alerts_template_distribution` | segments | top-N templates |
| `alerts_category_distribution` | segments | by `category_id` |
| `alerts_severity_distribution` | segments | `{ Low, Medium, High, Critical }` (gdpr_breach + security_incident only) |
| `alerts_anonymity_distribution` | segments | `{ Anonym, Pseudonym, Identifisert (public), Identifisert (auth) }` |
| `alerts_received_over_time` | series | last-12-month buckets by `received_at` |
| `alerts_closed_over_time` | series | last-12-month buckets by `closed_at` |
| `alerts_acknowledgement_compliance` | segments | `{ I tide, For sent, Ikke kvittert }` |
| `alerts_gdpr_72h_compliance` | segments | for `kind='gdpr_breach'` only: `{ Rapportert i tide, Rapportert sent, Ikke rapportert }` |
| `alerts_by_location` | segments | per `location_id` |
| `alerts_by_department` | segments | per `department_id` |
| `alerts_law_ref_coverage` | segments | exact-string buckets over `definition.lawRefs[]` × instances received |
| `alerts_retention_upcoming_purges` | segments | `{ <30 dager, 30-90 dager, 90-365 dager, >365 dager }` to `retention_until` |

Default layout (8 widgets):
1. KPI Totalt (sm) · KPI Åpne (sm) · KPI Forsinket kvittering (sm) · KPI Kritisk (sm)
2. Donut: status (md)
3. Donut: type (md)
4. Line: mottatt over tid (lg)
5. Bar: top templates (md)

**Filter dimensions** for `+ Filter` picker: Type, Mal, Kategori, Status, Alvorlighet, Anonymitet, Lokasjon, Avdeling, Periode.

**Drill-down** wired on: status (→ status chip), type (→ kind chip), severity (→ severity chip), category (→ category chip).

---

## 9 · Acceptance criteria for the whole module v1

After Phase A-F ships:

- [ ] `/alerts` opens, lists 17 system templates grouped by 5 categories.
- [ ] Anonymous submission via `/alerts/public/:slug` creates a row, returns access key, status lookup at `/alerts/public/status?key=…` returns published status.
- [ ] Authenticated employee submission attributes to `reporter_user_id`.
- [ ] Committee member opens case → sees timeline, can add notes, attach files, change status, close case.
- [ ] `confidential` cases hidden from `alerts.committee` holders, visible only to `alerts.committee_confidential`.
- [ ] GDPR breach case (`kind='gdpr_breach'`) surfaces 72-hour countdown badge; turns red after 60h.
- [ ] Closed case is locked from identity changes but `category_id`/`location_id`/`department_id` remain editable.
- [ ] `/alerts/analyse` shows KPIs that respond to all 9 filter chips.
- [ ] Sidebar shows Varslinger between Møter and Register with Analyse + Innstillinger fixed children.
- [ ] Admin can: toggle a system template, change its category, override its name, manage committee roster, extend retention (never shorten below `default_retention_years`).
- [ ] Retention purge function runs daily; sets `redacted_at` on expired cases, NULLs identity fields, drops attachments.
- [ ] Migration brought all legacy `whistleblowing_cases` + `gdpr_breach_incidents` rows over without data loss.
- [ ] `grep -r 'whistleblowing\|WhistleblowingCase\|useWhistleblowing\|useWorkplaceReportingCases\|GdprBreachAdminPanel' src/ modules/` returns 0 results outside archived migrations.
- [ ] `/varsle/:slug` and `/varsle/status` URLs still work (redirect to `/alerts/public/...`).
- [ ] `npx tsc -b` clean. ESLint clean on touched files. Migration re-runnable.

---

## 10 · Migration ordering

```
<ts+00> alerts_module_core.sql                  (Phase A1)
<ts+01> alerts_storage_bucket.sql               (Phase A2)
<ts+02> alerts_seed_system_templates.sql        (Phase A3)
<ts+03> alerts_seed_categories.sql              (Phase A4)
<ts+04> alerts_public_status_throttle.sql       (T4 throttle table)
<ts+05> alerts_business_days_helper.sql         (add_business_days + no_holidays)
<ts+10> alerts_migrate_whistleblowing.sql       (Phase B1)
<ts+11> alerts_migrate_gdpr_breach.sql          (Phase B2)
<ts+12> alerts_drop_legacy_tables.sql           (Phase B3 — DESTRUCTIVE, verification gate)
<ts+20> alerts_org_public_slug_rename.sql       (Phase F3 — whistle_public_slug → alerts_public_slug)
<ts+21> alerts_permission_add_new.sql           (Phase F2 — add new permission keys, copy grants)
<ts+30> alerts_drop_legacy_rpcs.sql             (Phase F4 — drop public_submit_whistleblowing etc.)
<ts+31> alerts_drop_legacy_permissions.sql      (Phase F4 — drop old whistleblowing.* permission keys)
<ts+40> alerts_pundit_demo_seed_rewrite.sql     (Phase F3 — rewrite 20260908120000_pundit_invest_demo_seed_150
                                                  by issuing a corrective migration that deletes the legacy
                                                  whistleblowing_cases inserts and adds equivalent alert_cases inserts
                                                  — the legacy migration itself is in an archive/active state and
                                                  cannot be mutated retroactively per CLAUDE.md migrations contract.
                                                  Safe path: forward migration is the way.)
```

The +12 migration is the only destructive one. It must be guarded by a count-check that fails the transaction if migrated rows < legacy rows:

```sql
do $$
declare v_legacy_cnt int; v_new_cnt int;
begin
  select count(*) into v_legacy_cnt from public.whistleblowing_cases;
  select count(*) into v_new_cnt from public.alert_cases where access_key in (select access_key from public.whistleblowing_cases);
  if v_new_cnt < v_legacy_cnt then
    raise exception 'alert_cases is missing % rows; aborting drop', v_legacy_cnt - v_new_cnt;
  end if;
end$$;
drop table public.whistleblowing_case_notes;
drop table public.whistleblowing_cases;
drop table public.gdpr_breach_incidents;
```

---

## 11 · House-style checklist (mirrors PLAYBOOK §8)

- Norwegian (nb) for user-facing strings; English for code/types/commits.
- Side-effect import `import './dashboards/alertsDashboardScope'` from `AlertsAnalysePage.tsx`.
- Use `freshId('alert')` not bespoke `crypto.randomUUID` polyfills.
- Component file headers: 3-6 lines, *why* not *what*.
- Migration header: 4-8 lines incl. Arbeidstilsynet/Datatilsynet self-audit.

---

## 12 · Senior architect self-review (PLAYBOOK §7)

- [x] **Reference precedent linked** — every architectural decision in §2 cites the source module.
- [x] **Vertical slices** — phases A-F each ship a working end-state.
- [x] **Dependency graph DAG** — A → B → (C, D in parallel) → E → F.
- [x] **Acceptance criteria observable** — §9 is all user-visible behaviour.
- [x] **Open questions enumerated** — §13 OQ list.
- [x] **Migrations idempotent / additive (except destructive Phase B3 which has explicit verification gate)** — all use `if not exists` / `on conflict do nothing`.
- [x] **Spec self-contained** — readable without re-opening other module specs.
- [x] **Playbook stays generic** — no module-specific edits propagated to PLAYBOOK.

**Concerns identified during self-review (applied):**

1. **Original draft kept legacy tables behind a view facade.** Removed per user directive — Phase B3 is now an explicit destructive migration with verification gate. Phase B1/B2 build full migration before drop.
2. **First draft had `reporter_*` fields as updateable post-acknowledgement** to support "reporter chose to reveal identity later". Tightened: lock trigger now makes these immutable from insert. Identity reveal happens via a new `alert_case_notes` row flagged `note_kind='communication_from_reporter'` instead — keeps the trigger contract simple and audit-defensible.
3. **Attendees / participants column carried over from meetings spec.** Removed — replaced with `assigned_committee_member_ids[]` (committee roster) which has different semantics.
4. **Confidentiality level was originally mutable** to allow upgrades when severity revealed. Tightened to immutable per A13 — operators can clone the case at higher confidentiality instead, preserving the original case's history.
5. **Retention was a global number per template.** Tightened so org can `override_retention_years` upward but never below `default_retention_years` (legal-defensibility floor). Validated by `before update` trigger on `alert_org_template_settings`.

**Result:** `🚧 draft` → `📋 ready to execute` once supervisor (§13) signs off and OQs are resolved.

---

## 13 · Supervisor review

### 13.1 First-pass review — blockers found (revision 1)

Supervisor (Plan-agent, senior architect + compliance officer hat) returned `🚧 needs revision` with 8 hard blockers. All addressed in revision 1 — diff summary:

| # | Blocker | Fix applied | Section |
|---|---|---|---|
| 1 | Phase F was a horizontal-layer commit bundling sidebar+routes+permissions+code purge | Split into **F1 (sidebar+routes), F2 (permission rename — dual-grant), F3 (cross-module re-point), F4 (legacy code purge + drop old permissions)** | §7 |
| 2 | Phase F file inventory missing ~20 files including `workplace-reporting/*` subtree, 2 edge functions (`datatilsynet-breach-report`, `compliance-audit-pdf`), 7 meetings-module files, `whistle_public_slug` column rename, `organizations_set_whistle_slug` trigger, `AuthPage.tsx` public link, `AticsShell.tsx` workplace-reporting module entry, `ShellHeaderWidgets.tsx` quick actions, and 13 other src/ consumers | Expanded F3 to enumerate every consumer; F4 grep-acceptance regex expanded to cover all the new symbols; migration ordering now includes `alerts_org_public_slug_rename.sql` | §7 F3-F4, §10 |
| 3 | Retention citations cited fabricated/wrong paragraphs (AML § 4-1 for 10y HMS; Personopplysningsloven § 5 for retention) | Replaced: AML/GDPR retention is org policy at 5y (no statutory floor); HMS at 5y default, 30y override for kjemikalie-eksponering per **Forskrift om utførelse av arbeid kap. 31**; corrected Personopplysningsloven § 5 → **GDPR Art. 5 (1) (e)** | §2 A14, §5.5 |
| 4 | Law name `Likestillingsloven` is outdated since 2017 | Replaced both occurrences with `Likestillings- og diskrimineringsloven` | §5.1 |
| 5 | `description` post-close-editable was identity-laundering risk | Moved `title` + `description` from allowed → rejected post-close. Corrections via append-only `alert_case_notes` | §3.4 |
| 6 | Public RPC didn't explicitly reject unknown payload keys | Added strict key-allowlist clause + whitelist materialisation note — column-injection vector closed | §4.3 |
| 7 | T3 IP-logging mitigation was normative not concrete | Replaced with explicit header-scrubbing code + Supabase log-retention setting + post-deploy verification command | §4.1 T3 |
| 8 | No port story for 2 edge functions reading `gdpr_breach_incidents` | Phase F3 lists each function (`datatilsynet-breach-report`, `compliance-audit-pdf`, plus `role-compliance-reconcile`, `gov-datatilsynet-breach` if grep confirms) with re-point semantics | §7 F3 |

Additional refinements applied:
- T4 rate-limiting routed through Edge Function + DB-side `alerts_public_status_throttle` table (no PostgREST primitive existed)
- T11 retroactive-leak vector closed by §3.5 post-close insert gate
- §3.7 purge race fixed with `for update skip locked`; purge now also redacts `alert_case_notes.body` for reporter-facing notes
- §3.8 added — Art. 17 erasure path (separate from retention) for identified-tier subject requests; anonymous-tier cases fall under retention only
- §5.1 added 8th template `aml-varsel-mot-leder` per AML § 2A-2 (3) — escape-hatch with separate `alerts.committee_escalated` permission
- §5.2 added 6th template `gdpr-brudd-lavrisiko` per Art. 33 (1) "unlikely to result in risk" exemption; excluded from `alerts_gdpr_72h_compliance` widget
- §5.5 corrected `IK-f` first-use to full `Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (Internkontrollforskriften)`
- §5.1 `acknowledgement_due_at` now derived via `add_business_days()` helper with Norwegian public-holiday lookup; closes calendar-vs-business-days mismatch
- §5.1 added Straffeloven § 388 (grov korrupsjon) + § 389 (påvirkningshandel) to `aml-varsel-okonomisk-misbruk`
- Phase E split into E1 (hub+detail) + E2 (admin+analyse) per supervisor request

### 13.2 Open questions — supervisor resolutions

| ID | Question | Resolution after supervisor review |
|---|---|---|
| OQ-A1 | hCaptcha vs Cloudflare Turnstile | **Cloudflare Turnstile** (accepted) — note that Turnstile still loads from Cloudflare in user's browser; document this in the `tpl-varslingsrutiner` policy doc and the `preparationGuidance` of public templates. |
| OQ-A2 | Permanent `/varsle/:slug` redirect | **Yes, permanent** — moved out of `App.tsx` route table into a small `src/redirects/varsleAliases.tsx` module so the legacy aliases are isolated from the live route table. |
| OQ-A3 | `gdpr_breach` cases in compliance-studio composite | **Yes**, follow-up commit after Phase F4. Composite scope must read `alert_cases` only with anonymity-respecting projections (no `reporter_*` columns). |
| OQ-A4 | Committee rotation visibility into closed cases | **Human owner override (final)**: rotated committee members see **all non-confidential closed cases in their org**. Confidential cases still require explicit `alerts.committee_confidential`. Supervisor flagged this as a potential § 2A-7 (5) taushetsplikt expansion — owner accepts the policy trade-off (continuity of case knowledge across HR rotation > stricter retroactive walling-off). Mitigation: `alert_case_grants` table not needed; standard committee permission read suffices. Confidentiality-level upgrade remains the way to wall off a sensitive case. |
| OQ-A5 | Severity required-at-insert or required-before-close | **Required before close** (accepted). Template `definition.workflowStages[].requiredFields` declares the severity field as required when transitioning to `closed`. |
| OQ-A6 | Anonymous-reporter self-edit window | **No** (accepted). |
| OQ-A7 | Retention: redact vs hard-delete | **Redact (default), plus separate Art. 17 hard-delete path** for identified-tier subject requests via §3.8. Two paths, two legal bases, no conflict. |

### 13.3 Supervisor checklist — post-revision

- [x] Security & anonymity threat model (§4) is complete + each threat has a **concrete** mitigation (T3, T4 strengthened; T11 retroactive-leak gate added).
- [x] Compliance officer self-audit (§5.5) cites real paragraphs (no fabricated cross-references).
- [x] Retention defaults documented as org policy where no statutory floor exists.
- [x] Legacy purge inventory exhaustive — grep-acceptance regex covers every symbol surfaced by `grep -rln`.
- [x] Public RPC contract (§4.3) rejects unknown payload keys + only inserts whitelisted columns.
- [x] Storage bucket private + signed-URL-only, never public-read.
- [x] Lock trigger (§3.4) protects every identity-bearing column from insert through purge; `title` + `description` now in the immutable-post-close set.
- [x] Phase plan is vertical slices (F1-F4 each ship a working end-state).
- [x] Art. 17 erasure path separate from retention (§3.8).

### 13.4 Sign-off

- [x] supervisor (Plan-agent first-pass review applied; all 8 blockers resolved + 7 refinements integrated)
- [x] human owner (OQ-A4 overridden; all other OQ defaults accepted; spec ready to execute)

Spec status: `📋 ready to execute`. Phase A migrations cleared to begin.
