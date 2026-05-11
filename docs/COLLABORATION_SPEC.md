# AI INSTRUCTION SET — NEWAMU COLLABORATION SPEC

**Role:** Senior backend + frontend developer building a feature module on the NewAMU / Klarert platform.
**Mission:** Use a single canonical pattern for everything collaboration-shaped — comments, suggestions, avvik, varsling, mentions, presence, review/approval, sign-off receipts, audit timeline, retention, moderation. **Do not invent module-specific shapes** when the canonical primitives apply. **Do not duplicate the data layer** when extending an existing module with collaboration.

This file is the single source of truth for collaboration. Companion docs:

- `DESIGN_SYSTEM.md` — UI primitives, spacing, typography, button variants.
- `docs/UI_DESIGN_RULES.md` — header action ordering.
- `MODULE_SPEC.md` — generic module conventions (RLS, soft delete, org scoping).

---

## 1. Scope & terms

| Term | Meaning |
|---|---|
| **Entity** | A row in any feature module that a user can comment on, propose changes to, escalate from, or be notified about. Examples: a wiki page, a task item, a survey response, a compliance checklist execution, an AMU meeting agenda item, a learning course assignment. |
| **Entity type** | A short slug that identifies the kind of entity: `wiki_page` / `task_item` / `survey_response` / `compliance_execution` / `amu_meeting` / `learning_course` / `vernerunde` / `whistleblowing_case`. New consumers add a slug via migration. |
| **Anchor** | The position inside an entity that a comment attaches to (`block_index` for a wiki block, `question_id` for a survey question, `agenda_item_id` for a meeting, `whole` for entity-level). Stored as `(anchor_kind, anchor_id)` on the comment row. |
| **Kind** | The intent of a comment: `comment` / `suggestion` / `avvik_proposal` / `varsling`. |
| **Severity** | `low` / `medium` / `high` / `critical`. Required when `kind in ('avvik_proposal', 'varsling')`. |
| **Confidential** | Append-only varsling row visible only to the author, org admin, and `whistleblowing.committee`. Mirrors `whistleblowing_case_notes`. |
| **Audience** | The set of users expected to acknowledge a publication: `all_employees` / `leaders_only` / `safety_reps_only` / `department:<id>`. |

This spec replaces every previous module-specific shape (`wiki_page_comments`, `task_comments`, `whistleblowing_case_notes`, future survey/checklist/learning/meeting comment tables). New modules MUST adopt these primitives; existing modules SHOULD migrate.

## 2. Forbidden patterns

- A new `*_comments` table per module. Use `entity_comments` with the `entity_type` discriminator.
- A new `*_mention_notifications`, `*_review_requests`, `*_audit_ledger`, `*_avvik_links` table per module. Use the shared `entity_*` family below.
- Inline `<button className="…">` for collab actions. Use the primitives in `src/components/collab/`.
- A new permission key for "comment on X" (`survey.comment`, `checklist.comment`, …). Comment access is gated by the same module-`.view` permission that grants entity visibility.
- A per-module realtime channel name that doesn't follow `collab:<entity_type>:<entity_id>`.
- A polymorphic FK without a registry entry. Every `entity_type` must be registered in `entity_collab_registry` before any row referencing it is inserted.

---

## 3. Architecture

Three layers:

```
                        ┌─────────────────────────────────────────────┐
                        │  src/components/collab/                     │
        UI primitives ──┤  src/hooks/collab/                          │
                        │  Reusable widgets + presence + clock        │
                        └─────────────────┬───────────────────────────┘
                                          │
                        ┌─────────────────▼───────────────────────────┐
        Dispatcher  ────┤  public.entity_collab_registry              │
        (per-entity-    │  public.can_view_entity()                   │
         type config)   │  public.can_edit_entity()                   │
                        └─────────────────┬───────────────────────────┘
                                          │
                        ┌─────────────────▼───────────────────────────┐
        Data layer  ────┤  public.entity_comments                     │
                        │  public.entity_mentions                     │
                        │  public.entity_review_requests              │
                        │  public.entity_avvik_links                  │
                        │  public.entity_audit_ledger                 │
                        │  public.entity_acknowledgements             │
                        │  public.entity_moderation_flags             │
                        │  public.entity_moderation_keywords          │
                        └─────────────────────────────────────────────┘
```

The dispatcher is the keystone. Every RLS policy on the data tables defers to `can_view_entity(entity_type, entity_id)` so visibility tracks the parent record exactly. No data table embeds knowledge of any single module.

---

## 4. The registry

Every consumer registers itself by inserting a row in `entity_collab_registry`. The row tells the dispatcher how to resolve permission for that entity_type and what optional behaviours are enabled.

```sql
create table public.entity_collab_registry (
  entity_type text primary key,
  -- Permission keys (from src/lib/permissionKeys.ts) used to gate access
  view_permission text not null,
  edit_permission text not null,
  manage_permission text not null,
  -- Per-type behaviour toggles
  supports_varsling boolean not null default true,
  supports_moderation boolean not null default true,
  supports_avvik_bridge boolean not null default true,
  supports_presence boolean not null default true,
  supports_review_workflow boolean not null default false,
  supports_acknowledgements boolean not null default false,
  -- Default retention (years) for comments on this entity type when the
  -- parent record has no retention metadata.
  default_retention_years int not null default 5,
  -- Free-form notes for operators (Norwegian)
  notes text,
  created_at timestamptz not null default now()
);

-- Seed: documents
insert into public.entity_collab_registry
  (entity_type, view_permission, edit_permission, manage_permission,
   supports_review_workflow, supports_acknowledgements, default_retention_years)
values
  ('wiki_page', 'documents.view', 'documents.edit', 'documents.manage', true, true, 5);

-- Seed: tasks
insert into public.entity_collab_registry
  (entity_type, view_permission, edit_permission, manage_permission,
   default_retention_years)
values
  ('task_item', 'tasks.view', 'tasks.edit', 'tasks.manage', 5);
```

Registry rows are inserted by each module's own migration. **A consumer module that hasn't inserted its registry row MUST NOT insert collab rows** — RLS will reject them.

---

## 5. Schema

All tables are organisation-scoped, soft-deleted, and append-only when flagged confidential. All FKs cascade on entity deletion via the dispatcher (see §6.4).

### 5.1 `entity_comments`

```sql
create table public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Polymorphic anchor to the parent record
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,                       -- uuid or domain id; cast at the boundary
  anchor_kind text not null default 'whole'      -- 'whole' | 'block' | 'field' | 'item' | 'response' | <custom>
    check (length(anchor_kind) between 1 and 32),
  anchor_id text,                                -- block_index, question_id, agenda_item_id; null for 'whole'

  -- Threading
  parent_comment_id uuid null references public.entity_comments (id) on delete cascade,

  -- Content
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,

  -- Intent
  kind text not null default 'comment'
    check (kind in ('comment', 'suggestion', 'avvik_proposal', 'varsling')),
  severity text null
    check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  is_anonymous boolean not null default false,
  is_confidential boolean not null default false,
  legal_basis text[] not null default '{}',

  -- Lifecycle
  resolved boolean not null default false,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users (id) on delete set null,
  hidden_until_reviewed boolean not null default false,
  edited_history jsonb not null default '[]'::jsonb,   -- [{at, by, prev_body}]
  deleted_at timestamptz null,

  -- Retention
  retention_max_years int null,
  scheduled_deletion_at timestamptz null,

  -- Avvik bridge back-pointer
  linked_deviation_id uuid null references public.deviations (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz null,

  -- Severity required for avvik/varsling, forbidden for comment/suggestion
  constraint entity_comments_severity_required check (
    (kind in ('avvik_proposal', 'varsling') and severity is not null)
    or (kind in ('comment', 'suggestion') and severity is null)
  )
);

create index entity_comments_entity_idx
  on public.entity_comments (entity_type, entity_id);
create index entity_comments_org_kind_idx
  on public.entity_comments (organization_id, kind);
create index entity_comments_parent_idx
  on public.entity_comments (parent_comment_id);
create index entity_comments_hidden_idx
  on public.entity_comments (organization_id, hidden_until_reviewed)
  where hidden_until_reviewed = true;
create index entity_comments_scheduled_deletion_idx
  on public.entity_comments (scheduled_deletion_at)
  where scheduled_deletion_at is not null;
```

### 5.2 `entity_mentions`

```sql
create table public.entity_mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  actor_name text not null,
  context text not null
    check (context in ('comment', 'editor', 'review')),
  snippet text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index entity_mentions_recipient_idx
  on public.entity_mentions (recipient_user_id, created_at desc)
  where read_at is null;
create index entity_mentions_entity_idx
  on public.entity_mentions (entity_type, entity_id);
```

### 5.3 `entity_review_requests`

Only used when the registry row has `supports_review_workflow = true`.

```sql
create table public.entity_review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,
  entity_version int not null,                  -- monotonic counter from parent module
  requester_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'cancelled')),
  reviewer_comment text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,

  -- Only one open review per entity+version at a time
  constraint entity_review_one_open exclude using btree
    (entity_type with =, entity_id with =, entity_version with =)
    where (status = 'pending')
);

create index entity_review_pending_for_reviewer_idx
  on public.entity_review_requests (reviewer_id, status, created_at desc)
  where status = 'pending';
```

### 5.4 `entity_avvik_links`

Bridge table — never inserted directly by user code. The trigger in §6.5 inserts it.

```sql
create table public.entity_avvik_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,
  deviation_id uuid not null references public.deviations (id) on delete cascade,
  source_comment_id uuid null references public.entity_comments (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, deviation_id)
);
```

### 5.5 `entity_acknowledgements`

Replaces `wiki_compliance_receipts`. Per-user, per-entity-version sign-off.

```sql
create table public.entity_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,
  entity_version int not null,
  entity_title text not null,                   -- denormalised, for reporting
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null,                       -- denormalised, immutable at sign time
  acknowledged_at timestamptz not null default now(),
  -- Audience the signature was given under, in case the audience changes
  audience text not null,
  unique (entity_type, entity_id, entity_version, user_id)
);
```

### 5.6 `entity_audit_ledger`

Replaces `wiki_audit_ledger`, `task_activity_log`, and similar. INSERT-only at the RLS level; UPDATE/DELETE revoked.

```sql
create table public.entity_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null references public.entity_collab_registry (entity_type),
  entity_id text not null,
  entity_title text not null,
  action text not null,                          -- 'created' | 'updated' | 'published' | 'archived' |
                                                  -- 'acknowledged' | 'submitted_for_review' | 'approved' |
                                                  -- 'changes_requested' | 'commented' | 'comment_resolved' |
                                                  -- 'moderation_flagged' | 'moderation_released' |
                                                  -- 'moderation_escalated' | 'lock_overridden' |
                                                  -- 'avvik_promoted' | 'subject_erased' | <module-extension>
  actor_user_id uuid null references auth.users (id) on delete set null,
  actor_name text not null,                      -- 'System' for trigger-emitted rows
  from_version int null,
  to_version int null,
  payload jsonb not null default '{}'::jsonb,    -- module-specific detail
  at timestamptz not null default now()
);

create index entity_audit_entity_idx
  on public.entity_audit_ledger (entity_type, entity_id, at desc);
create index entity_audit_org_action_idx
  on public.entity_audit_ledger (organization_id, action, at desc);

revoke update, delete on public.entity_audit_ledger from authenticated;
```

### 5.7 `entity_moderation_flags` + `entity_moderation_keywords`

Only used when `supports_moderation = true` in the registry.

```sql
create table public.entity_moderation_keywords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations (id) on delete cascade,
  slug text not null,
  label text not null,
  terms text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.entity_moderation_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  comment_id uuid not null references public.entity_comments (id) on delete cascade,
  reason text not null,
  matched_terms text[] not null default '{}',
  flagged_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewer_id uuid null references auth.users (id) on delete set null,
  reviewer_note text null,
  action text not null default 'pending_review'
    check (action in ('pending_review', 'released', 'kept_hidden', 'escalated_to_varsling'))
);

create index entity_mod_flags_pending_idx
  on public.entity_moderation_flags (organization_id, action)
  where action = 'pending_review';
```

Seed `entity_moderation_keywords` with a system-default row (`organization_id is null`) for Norwegian harassment + threat terms.

---

## 6. RLS dispatcher

The dispatcher is two SECURITY DEFINER functions that the data-table RLS policies call. They route the (entity_type, entity_id) to the right module-specific check.

### 6.1 The contract

```sql
create function public.can_view_entity(p_entity_type text, p_entity_id text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_reg record;
begin
  select * into v_reg from public.entity_collab_registry where entity_type = p_entity_type;
  if not found then return false; end if;
  if not public.user_has_permission(v_reg.view_permission) then return false; end if;

  -- Module-specific existence + sub-permission dispatch
  case p_entity_type
    when 'wiki_page' then
      return exists (
        select 1 from public.wiki_pages
        where id = p_entity_id and organization_id = public.current_org_id()
      );
    when 'task_item' then
      return exists (
        select 1 from public.task_items
        where id = p_entity_id::uuid and organization_id = public.current_org_id()
      );
    when 'survey_response' then
      -- … one branch per registered entity_type
    else
      return false;
  end case;
end;
$$;

create function public.can_edit_entity(p_entity_type text, p_entity_id text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_reg record;
begin
  select * into v_reg from public.entity_collab_registry where entity_type = p_entity_type;
  if not found then return false; end if;
  return public.is_org_admin()
      or public.user_has_permission(v_reg.manage_permission)
      or public.user_has_permission(v_reg.edit_permission);
end;
$$;
```

**Adding a new entity_type** means extending the `case` branch in `can_view_entity` and inserting a registry row. A migration that registers a type without adding its branch is rejected by code review (no fallback to `true` — the `else` returns `false`).

### 6.2 RLS template — applied verbatim to every data table

```sql
alter table public.entity_comments enable row level security;

create policy "entity_comments_select"
  on public.entity_comments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.can_view_entity(entity_type, entity_id)
    and (is_confidential is false
      or author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('whistleblowing.committee'))
    and (hidden_until_reviewed is false
      or author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('whistleblowing.committee'))
    and deleted_at is null
  );

create policy "entity_comments_insert"
  on public.entity_comments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and author_id = auth.uid()
    and public.can_view_entity(entity_type, entity_id)
  );

create policy "entity_comments_update"
  on public.entity_comments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (author_id = auth.uid() or public.can_edit_entity(entity_type, entity_id))
  )
  with check (organization_id = public.current_org_id());

create policy "entity_comments_delete"
  on public.entity_comments for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and author_id = auth.uid()
  );
```

Same template for `entity_mentions` (`recipient_user_id = auth.uid()` instead of confidentiality), `entity_review_requests` (`requester_id = auth.uid() or reviewer_id = auth.uid() or can_edit_entity`), `entity_avvik_links` (`can_view_entity`), `entity_acknowledgements` (`user_id = auth.uid() or can_edit_entity`), `entity_audit_ledger` (`can_view_entity`, INSERT-only), `entity_moderation_flags` (admin / `documents.manage` / `whistleblowing.committee` only — moderation is privileged regardless of entity type).

### 6.3 Realtime channel naming

```
collab:<entity_type>:<entity_id>
```

Examples: `collab:wiki_page:abc123`, `collab:task_item:550e8400-…`, `collab:survey_response:…`.

Channel access is automatically gated by Supabase Realtime + the SELECT RLS on `entity_comments` — clients subscribe but only receive rows they could already select.

---

## 7. Triggers — the compliance enforcement layer

Six triggers, all `SECURITY DEFINER`. Each one is short, focused, and idempotent.

### 7.1 Retention inheritance — `entity_comments_inherit_retention`

BEFORE INSERT. Looks up the registry default; if the parent entity exposes a `retain_maximum_years` column, prefer it; falls back to 5 years if nothing else is available. Sets `retention_max_years` and `scheduled_deletion_at` in the same pass. The function probes `to_regclass(entity_type's anchor table)` and `information_schema.columns` so a missing column doesn't break the trigger.

### 7.2 Append-only varsling — `entity_comments_no_mutation_when_confidential`

BEFORE UPDATE OR DELETE.

- UPDATE: if `old.is_confidential = true`, reject changes to `body`, `kind`, `severity`, `parent_comment_id`, `is_anonymous`, `is_confidential`.
- DELETE: if `old.is_confidential = true`, reject **unless** `old.scheduled_deletion_at is not null and old.scheduled_deletion_at < now()` (retention exit; GDPR Art. 5(1)(e) wins over the lock).

### 7.3 Mention extraction — `entity_comments_extract_mentions`

AFTER INSERT. Parses `body` for `data-user-id="<uuid>"` chips OR `@<DisplayName>` literals when a display name is unambiguous in the org. For each recipient `≠ author_id`, inserts an `entity_mentions` row with `context = 'comment'`. The chips encoding is the same one the frontend `MentionAutocomplete` emits.

### 7.4 Harassment moderation — `entity_comments_moderate_on_insert`

AFTER INSERT. Skips when `is_confidential = true` (varsling outranks the harassment scan). Scans `body` against the active keyword list (org-overridable in `entity_moderation_keywords`, falls back to system rows where `organization_id is null`). On match: sets `hidden_until_reviewed = true` and inserts an `entity_moderation_flags` row with `action = 'pending_review'`. Only fires when the registry has `supports_moderation = true`.

### 7.5 Avvik bridge — `entity_comments_promote_to_avvik`

AFTER INSERT. Fires only when `kind = 'avvik_proposal' AND severity in ('high', 'critical')` AND `linked_deviation_id is null` AND registry has `supports_avvik_bridge = true`. Inserts a `deviations` row with `source = entity_type`, `source_id = null` (because `deviations.source_id` is uuid but our entity_id is text — the bridge table is the authoritative link), inserts the bridge row, and stamps `linked_deviation_id` back on the comment. Lower severities are promoted manually via `promoteCommentToAvvik` in the UI.

### 7.6 Audit emission — distributed to each module's existing triggers

Modules emit audit rows to `entity_audit_ledger` from their own triggers — they know best when a record changes. No central trigger fans out to everywhere; the registry just provides the canonical `action` vocabulary (§5.6).

---

## 8. Norwegian + GDPR compliance contract

Every rule below has a specific code-level enforcement point. A new module must not regress any of these.

| Rule | Section | Enforcement |
|---|---|---|
| Varsling confidentiality | AML § 2A-7 (3) | `entity_comments` RLS hides confidential rows from non-author/non-admin/non-committee. Append-only via trigger 7.2. Mirrors `whistleblowing_case_notes`. |
| Non-retaliation / anonymity | AML § 2A-4 | `is_anonymous = true` — `author_id` retained for RLS, `author_name` set to `'Anonym ansatt'` on insert. The display layer never reads `author_id` for anonymous rows except in admin-only audit exports. |
| Psykososialt arbeidsmiljø | AML § 4-3 | Harassment moderation (trigger 7.4) hides flagged rows until reviewed. `entity_moderation_flags.action = 'escalated_to_varsling'` converts the row into a confidential varsling automatically. |
| Verneombud involvement | AML § 6-2 | Each module owns its own publish-gate trigger that queries `entity_comments` for a comment from a `learning_metadata.is_safety_rep = true` author. Documents demonstrates the pattern; surveys/learning/etc. follow it when relevant. |
| Internkontroll / avvikshåndtering | IK-f § 5 nr. 7 | High/critical `avvik_proposal` auto-promote via trigger 7.5; the bridge keeps the trail intact even if the comment is anonymised later. |
| Medvirkning | AML § 3-1 | Any user with the module's `.view` permission can post `comment`, `suggestion`, `avvik_proposal`, `varsling`. The dispatcher (§6.1) does not require `.edit`. |
| Legal basis for personal data | GDPR Art. 6 / 9 | `legal_basis text[]` on every comment, populated by the client from the parent entity's compliance frame. Special-category mentions (helse, fagforening, …) are detected on insert and flip the row to `is_confidential = true`. |
| Storage limitation | GDPR Art. 5 (1)(e) | `scheduled_deletion_at` populated by trigger 7.1. Service-role cleanup function `entity_comments_cleanup_expired()` deletes expired rows; trigger 7.2's retention exit permits this even for varsling. |
| Subject access | GDPR Art. 15 | RPC `entity_comments_export_for_subject(p_subject_user_id uuid)` — SECURITY DEFINER, gated to admin/`documents.manage`/`whistleblowing.committee`, returns every row authored by or mentioning the subject. CSV-downloadable from the privacy page. |
| Erasure | GDPR Art. 17 | RPC `entity_comments_erase_for_subject(p_subject_user_id uuid, p_reason text)` — pseudonymises rather than hard-deletes (record retained under IK-f § 5; identifying text replaced with `'[Slettet etter GDPR Art. 17]'`). Mention chips referencing the subject are regex-rewritten to `@[anonymisert]`. A single row is added to `entity_audit_ledger` with `action = 'subject_erased'`. |
| Audit trail | AML § 2A-3 / IK-f § 5 | `entity_audit_ledger` is INSERT-only (UPDATE/DELETE revoked at the role level). All collab operations (comment create/resolve/delete, moderation decisions, review approvals, lock overrides) write a ledger row. |
| Workplace monitoring caution | Datatilsynet guidance | Presence tracks only **active editors** (never read-only viewers). The `collab:*` realtime channel does not record a row when a user merely opens a page. Disclosed in the org's privacy notice. |
| Confidentiality of moderation queue | AML § 4-3 / § 9-1 | `entity_moderation_flags` visible only to admin / `documents.manage` / `whistleblowing.committee`. Author of the flagged row sees their own row with an "Avventer moderering" chip; everyone else sees nothing until released. |

---

## 9. UI primitive contract

Shared components live in `src/components/collab/`. Shared hooks live in `src/hooks/collab/`. Shared types live in `src/types/collab.ts`. Anything else is module-local.

| Element | Component / hook | Path | Notes |
|---|---|---|---|
| Threaded comment surface | `<EntityCommentsPanel>` | `src/components/collab/EntityCommentsPanel.tsx` | Drop-in for any anchor. Props: `entityType`, `entityId`, `anchorKind`, `anchorId`, `canView`, `canComment`, `mentionUsers`, `retentionHint`, `canSeeConfidential`, `inviteCollaboratorsHref`, `onPromoteToAvvik` |
| @-mention input | `<MentionAutocomplete>` | `src/components/collab/MentionAutocomplete.tsx` | textarea + dropdown over `MentionUser[]`; emits resolved user-id list separately so the caller can build the HTML chips for `notifyEntityMentions` |
| Presence avatar stack | `<PresenceStack>` | `src/components/collab/PresenceStack.tsx` | Page-level avatars in a `space-x-1.5` row. Tooltip = `displayName`. Self always first. |
| Activity timeline | `<ActivityTimeline>` | `src/components/collab/ActivityTimeline.tsx` | Reads `entity_audit_ledger`. Optional `onCompareVersion` for modules with versioned snapshots. |
| Avvik chip + linked-list | `<EntityAvvikChip>` / `<EntityAvvikPanel>` | `src/components/collab/EntityAvvikPanel.tsx` | Renders `entity_avvik_links` joined to `deviations`. |
| Acknowledgement view | `<EntityAcknowledgementsPanel>` | `src/components/collab/EntityAcknowledgementsPanel.tsx` | Splits audience into Signed / Unsigned for the current version. |
| Review banner | `<ReviewRequestPanel>` | `src/components/collab/ReviewRequestPanel.tsx` | Send/approve/request-changes UI. |
| Publish gates | `<PublishGatesPanel>` | `src/components/collab/PublishGatesPanel.tsx` | Toggles for `reviewRequired` + `requiresVerneombudReview`; only renders when the parent module exposes those flags via the registry. |
| Realtime presence | `useEntityPresence(entityType, entityId)` | `src/hooks/collab/useEntityPresence.ts` | Returns `{ presence: PresenceUser[] }`. Joins channel `collab:<entityType>:<entityId>`. |
| Comments hook | `useEntityComments({ entityType, entityId, anchorKind?, anchorId? })` | `src/hooks/collab/useEntityComments.ts` | Returns `{ comments, addComment, editComment, setResolved, removeComment, refresh }`. |
| Mentions hook | `useEntityMentions(entityType, entityId)` | `src/hooks/collab/useEntityMentions.ts` | Returns recent mentions + `markRead`. |
| Avvik bridge hook | `useEntityAvvik(entityType, entityId)` | `src/hooks/collab/useEntityAvvik.ts` | Returns `{ linked, promoteCommentToAvvik }`. |
| Privacy page | `<EntityPrivacyPage>` | `src/pages/collab/EntityPrivacyPage.tsx` | GDPR Art. 15 / Art. 17 UI for any subject. |
| Moderation queue | `<EntityModerationQueuePage>` | `src/pages/collab/EntityModerationQueuePage.tsx` | Pending / released / kept-hidden / escalated, filter chips. |

Component visual language follows `DESIGN_SYSTEM.md` strictly. No primitive owns its own padding or button styles — they use `<Button>`, `<Badge>`, `<ModuleSectionCard>`, `<StandardTextarea>`, `<SearchableSelect>`, `<ToggleSwitch>`, `<InfoBox>` from `src/components/ui/` and `src/components/module/`.

---

## 10. Per-module integration recipe (six steps)

Adopting the spec for a new entity type — say `survey_response`:

### Step 1: register

```sql
-- migration
insert into public.entity_collab_registry
  (entity_type, view_permission, edit_permission, manage_permission,
   supports_avvik_bridge, supports_acknowledgements, default_retention_years)
values
  ('survey_response', 'survey.view', 'survey.edit', 'survey.manage',
   true, false, 5);
```

### Step 2: extend the dispatcher

```sql
-- same migration, replace public.can_view_entity with one extra branch
create or replace function public.can_view_entity(...)
returns boolean ... as $$
begin
  ...
  case p_entity_type
    when 'wiki_page' then ...
    when 'task_item' then ...
    when 'survey_response' then
      return exists (
        select 1 from public.survey_responses
        where id = p_entity_id::uuid and organization_id = public.current_org_id()
      );
    ...
  end case;
end;
$$;
```

### Step 3: define the anchor model

Pick `anchor_kind`. For surveys: `'response'` for response-level comments, `'question'` with `anchor_id = question_id` for per-question comments. Document the choice in the module's `MODULE_SPEC.md` so it's stable.

### Step 4: mount the UI

```tsx
// modules/survey/SurveyResponseDetail.tsx
import { EntityCommentsPanel } from '../../src/components/collab/EntityCommentsPanel'
import { useEntityPresence } from '../../src/hooks/collab/useEntityPresence'

const presence = useEntityPresence('survey_response', response.id)

<EntityCommentsPanel
  entityType="survey_response"
  entityId={response.id}
  anchorKind="response"
  canView={can('survey.view')}
  canComment={Boolean(user?.id && can('survey.view'))}
  mentionUsers={mentionUsers}
  canSeeConfidential={isAdmin || permissionKeys.has('whistleblowing.committee')}
/>
```

### Step 5: emit audit + acknowledgement rows from your existing triggers

When the response is submitted: `insert into entity_audit_ledger (entity_type, entity_id, action, ...) values ('survey_response', response.id, 'created', ...)`. When the response is approved by a reviewer: same pattern with `action = 'approved'`.

### Step 6: extend the notifications hook

`useNotifications.ts` already aggregates from `entity_mentions` and `entity_review_requests` across all entity types — adding a new entity_type does not require a new notification category. The dispatcher routes the deep-link href from the registry entry (a future enhancement: `entity_collab_registry.deep_link_template`).

That's it. No new tables, no new RLS scaffolding, no per-module comments UI.

---

## 11. Edge functions

Three scheduled functions, all under `supabase/functions/collab-*`, all using the established Resend + `X-Collab-Cron-Secret` pattern (mirror of `send-survey-invites`):

| Function | Trigger | Job |
|---|---|---|
| `collab-notification-digest` | Hourly cron | Builds a Resend email per profile with `channels.email = true`, listing unread `entity_mentions` + pending `entity_review_requests` + (for moderators) pending `entity_moderation_flags`. Marks mentions as read on success. |
| `collab-acknowledgement-reminders` | Daily cron | For every entity_type with `supports_acknowledgements = true`: find entities within 14 days of `next_revision_due_at` (or module-specific equivalent) that have unsigned audience members; insert `entity_mentions` rows with `context = 'review'` so the digest picks them up. 7-day de-dup. |
| `collab-retention-cleanup` | Weekly cron | Calls `select * from entity_comments_cleanup_expired()` (service role). Logs the count to `entity_audit_ledger` with `action = 'retention_purge'` and a system actor name. |

Secrets: `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET` (renamed `X-Collab-Cron-Secret` header), `PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

---

## 12. Verification

End-to-end test plan a new module's adoption must pass before shipping:

1. **Registration sanity**
   - Insert a registry row with `view_permission` that doesn't exist in `permissionKeys.ts` → reject in code review.
   - Insert a registry row but skip the dispatcher branch → confirm RLS returns false for any read; UI shows empty state.

2. **Comment lifecycle**
   - As user A (module-`.view`), post a comment → row in `entity_comments`, row in `entity_audit_ledger` with `action = 'commented'`.
   - As user B (same permission, different user), see A's comment.
   - As user C (no permission), the comment is not selectable.

3. **Confidential varsling**
   - Toggle confidentiality, post a varsling → row hidden from B. Try to `UPDATE` it as A → trigger throws `konfidensielle kommentarer kan ikke endres`. Wait until `scheduled_deletion_at < now()` (simulate by advancing the column) → DELETE permitted.

4. **Harassment moderation**
   - Post a comment containing a seeded keyword → `hidden_until_reviewed = true`, row in `entity_moderation_flags` with `action = 'pending_review'`. Non-moderators don't see it. Moderator releases it → `action = 'released'`, `hidden_until_reviewed = false`.

5. **Avvik bridge**
   - Post `kind = 'avvik_proposal' severity = 'critical'` → row in `deviations`, row in `entity_avvik_links`, `linked_deviation_id` stamped on the comment.

6. **Mentions**
   - Post a comment with `<span data-user-id="<B>">@B</span>` → row in `entity_mentions` for B. Digest function picks it up. Mark read → row's `read_at` populated.

7. **Acknowledgements**
   - User in audience signs → row in `entity_acknowledgements` with audience-at-time captured. Reminder function does not requeue them.

8. **GDPR endpoints**
   - As admin, call `entity_comments_export_for_subject(<B>)` → all rows authored by or mentioning B. As non-admin → 42501.
   - Call `entity_comments_erase_for_subject(<B>, 'request 2026-…')` → B's authored rows have `author_name = 'Anonymisert'`, `body` rewritten, `edited_history` appended; mention chips referencing B rewritten to `@[anonymisert]`; one row in `entity_audit_ledger` with `action = 'subject_erased'`.

9. **RLS regression scan**
   - Run `select * from pg_policies where tablename like 'entity_%'` → at least four policies per table (select / insert / update / delete).
   - `mcp__supabase__get_advisors` returns no missing-RLS or missing-index warnings on entity tables.

---

## 13. Self-correction scan (run before submitting any collab PR)

- Any new `*_comments` table? Replace with `entity_comments` + a registry entry.
- Any new `*_mention_notifications`, `*_review_requests`, `*_audit_ledger`, `*_avvik_links` table? Use the shared one.
- Any RLS policy that hardcodes a `case` on entity_type? Move that case into the dispatcher.
- Any insert into `entity_comments` from a module whose entity_type isn't in `entity_collab_registry`? Add the registry row in the same migration.
- Any presence channel that isn't `collab:<entity_type>:<entity_id>`? Rename.
- Any per-module retention cleanup script? Delete it; the shared cleanup handles every entity_type.
- Any UI component duplicating `MentionAutocomplete`, `PresenceStack`, `ActivityTimeline`, `ReviewRequestPanel`, `EntityAvvikPanel`, `EntityAcknowledgementsPanel`? Use the shared one.
- Any `<button className="…">` for comment/mention/review actions? Replace with `<Button>` per `DESIGN_SYSTEM.md`.

---

## 14. Language

Norwegian (Bokmål) for every user-facing string. Audit-ledger actions are English slugs (`'commented'`, `'approved'`, `'submitted_for_review'`). Notification titles, error messages, and helper text are Norwegian.

Vocabulary (matches `DESIGN_SYSTEM.md` §13):

- Comment / Suggestion / Avvik / Varsling → **Kommentar / Forslag / Avvik / Varsling**
- Send for review / Approve / Request changes → **Send til godkjenning / Godkjenn / Be om endringer**
- Confidential → **Konfidensiell**
- Acknowledge / Signed → **Bekreft / Signert**
- Resolved / Reopened → **Løst / Gjenåpnet**
- Mention → **Nevn / Omtale**
- Moderation queue → **Modereringskø**
- Subject access / Erasure → **Innsynsbegjæring / Sletting**

---

## 15. Reference implementation

The Documents module's collaboration surface (PR #232, #233, #234, #235, #236) is the canonical reference. When in doubt, copy its shape. When the reference contradicts this spec, **this spec wins** — the reference will be refactored to conform.

Files that codify the pattern:

- `src/components/collab/` — UI primitives (when refactored).
- `src/hooks/collab/` — hooks (when refactored).
- `supabase/migrations/<timestamp>_collab_*.sql` — the eight migrations that build the data layer (registry, comments, mentions, review, avvik, acknowledgements, audit, moderation).
- `supabase/functions/collab-*` — three edge functions.

If a new module diverges from the spec, change the module — not the spec. If the spec is wrong for a legitimate reason, update this file in the same PR that breaks it, with a `## 16. Spec changes` entry that says **why**.
