-- Task items v2 — extended columns for ISO 45001 CAPA lifecycle, approval
-- workflow, causality chain, effort tracking, and template linkage.
--
-- Coverage gap closed:
--   task_items had a 3-state status and no approval workflow.
--   ISO 45001:2018 § 10.2 requires a documented CAPA lifecycle:
--   open → investigating → root_cause_identified → action_defined →
--   action_implemented → effectiveness_pending → effectiveness_verified → closed.
--   This migration adds:
--     - 9-state status (backward-compat: 'todo' and 'done' remain valid)
--     - owner_user_id (accountable) distinct from assignee_user_id (executes)
--     - reviewer_user_id (verifies independently — ISO § 5.3 segregation)
--     - parent_item_id self-FK (tiltak → avvik causality chain)
--     - template_slug text (which template spawned this item)
--     - template_kind text (oppgave/avvik/tiltak/risiko/forslag)
--     - estimated_hours / actual_hours for resource planning
--     - sla_due_at (computed from priority + org SLA config)
--     - effectiveness_review_due_at / effectiveness_reviewed_at
--     - residual_risk_score (post-control risk re-assessment)
--     - vo_notified_at / amu_notified_at (AML § 6-2 / § 7-2)
--     - requires_approval boolean + approved_at / approved_by
--
--   task_template_catalog gains metadata_schema jsonb, template_kind text,
--   and version int for template versioning (ISO § 7.5.3).
--
-- Self-audit (Arbeidstilsynet POV):
--   AML § 5-2 krever dokumentert avviksoppfølging med rotårsaksanalyse og
--   tiltak. owner_user_id + reviewer_user_id sikrer at lukking krever
--   en person utover den som utfører (§ 5.3-prinsippet).
--   IK-f § 5 nr. 8 gjennomgang — effectiveness_reviewed_at dokumenterer
--   at tiltak er evaluert etter gjennomføring.
--   Restrisiko: sla_due_at beregnes i applikasjonen basert på org-konfig;
--   denne kolonnen er et hint, ikke en trigger-enforced constraint.

set local search_path = public, pg_catalog;

-- ── Extend status check to include full CAPA lifecycle ───────────────────

alter table public.task_items
  drop constraint if exists task_items_status_check;

alter table public.task_items
  add constraint task_items_status_check check (status in (
    -- new lifecycle states
    'open',
    'in_progress',
    'root_cause_identified',
    'action_defined',
    'action_implemented',
    'effectiveness_pending',
    'effectiveness_verified',
    'closed',
    'cancelled',
    -- legacy states retained for backward-compat
    'todo',
    'done'
  ));

-- ── New columns on task_items ─────────────────────────────────────────────

-- Owner (accountable) — may differ from assignee (executes)
alter table public.task_items
  add column if not exists owner_user_id uuid
    references auth.users (id) on delete set null;

alter table public.task_items
  add column if not exists owner_name text;

-- Reviewer (independent verification — ISO § 5.3)
alter table public.task_items
  add column if not exists reviewer_user_id uuid
    references auth.users (id) on delete set null;

alter table public.task_items
  add column if not exists reviewer_name text;

alter table public.task_items
  add column if not exists reviewed_at timestamptz;

alter table public.task_items
  add column if not exists review_comment text;

-- Approver (closes the record — must differ from assignee for avvik/risiko)
alter table public.task_items
  add column if not exists requires_approval boolean not null default false;

alter table public.task_items
  add column if not exists approved_at timestamptz;

alter table public.task_items
  add column if not exists approved_by uuid
    references auth.users (id) on delete set null;

-- Causality chain: tiltak.parent_item_id → avvik or risiko item
alter table public.task_items
  add column if not exists parent_item_id uuid
    references public.task_items (id) on delete set null;

-- Template linkage
alter table public.task_items
  add column if not exists template_slug text;

-- Template kind drives lifecycle rules (avvik = CAPA, risiko = assessment, etc.)
alter table public.task_items
  add column if not exists template_kind text
    check (template_kind in ('oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær'));

-- Effort tracking (ISO § 6.2.2 resource planning)
alter table public.task_items
  add column if not exists estimated_hours numeric(6,1);

alter table public.task_items
  add column if not exists actual_hours numeric(6,1);

-- SLA deadline (computed app-side from priority × org SLA config)
alter table public.task_items
  add column if not exists sla_due_at timestamptz;

-- Effectiveness review (ISO 45001 § 10.2)
alter table public.task_items
  add column if not exists effectiveness_review_due_at timestamptz;

alter table public.task_items
  add column if not exists effectiveness_reviewed_at timestamptz;

-- Post-control residual risk score (risiko template — re-assessment after tiltak)
alter table public.task_items
  add column if not exists residual_risk_score int
    check (residual_risk_score between 1 and 25);

-- Regulatory notification timestamps (AML § 6-2 VO, § 7-2 AMU)
alter table public.task_items
  add column if not exists vo_notified_at timestamptz;

alter table public.task_items
  add column if not exists amu_notified_at timestamptz;

-- Arbeidstilsynet notification for serious incidents (AML § 5-1)
alter table public.task_items
  add column if not exists arbeidstilsynet_notified_at timestamptz;

alter table public.task_items
  add column if not exists arbeidstilsynet_notification_due_at timestamptz;

-- Module settings override: hard_gate (cannot close without linked tiltak)
-- Stored per-item to capture the org setting at creation time
alter table public.task_items
  add column if not exists closure_gate text not null default 'hard'
    check (closure_gate in ('hard', 'soft', 'none'));

-- Recurrence: cadence hint for recurring tasks (IK-f § 5 nr. 8)
alter table public.task_items
  add column if not exists recurrence_cadence text
    check (recurrence_cadence in ('arlig', 'halvarlig', 'kvartalsvis', 'manedlig', 'ad_hoc'));

alter table public.task_items
  add column if not exists next_recurrence_date date;

-- ── Extend task_template_catalog ─────────────────────────────────────────

-- template_kind: drives lifecycle and UI rules
alter table public.task_template_catalog
  add column if not exists template_kind text
    check (template_kind in ('oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær'));

-- metadata_schema jsonb: per-template field declarations
-- Shape: {fields: [{id, label, kind, required, options?}]}
-- Kinds: text | textarea | date | datetime | daterange | number | boolean | select
alter table public.task_template_catalog
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

-- Version counter — bumped by trigger on each UPDATE
alter table public.task_template_catalog
  add column if not exists version int not null default 1;

-- category_id FK for hub grouping + sidebar collapsible headers
alter table public.task_template_catalog
  add column if not exists category_id uuid
    references public.task_template_categories (id) on delete set null;

-- Backfill template_kind from source_category for existing rows
update public.task_template_catalog
set template_kind = case source_category
  when 'avvik'           then 'avvik'
  when 'risikovurdering' then 'risiko'
  when 'tiltak'          then 'tiltak'
  else 'oppgave'
end
where template_kind is null;

-- Backfill metadata_schema from definition for existing rows
-- (definition.fields → metadata_schema.fields, same shape)
update public.task_template_catalog
set metadata_schema = jsonb_build_object('fields', coalesce(definition->'fields', '[]'::jsonb))
where metadata_schema = '{"fields":[]}'::jsonb
  and definition->'fields' is not null
  and jsonb_array_length(definition->'fields') > 0;

-- ── Additional indexes ────────────────────────────────────────────────────

create index if not exists task_items_owner_idx
  on public.task_items (organization_id, owner_user_id)
  where deleted_at is null;

create index if not exists task_items_parent_idx
  on public.task_items (parent_item_id)
  where parent_item_id is not null and deleted_at is null;

create index if not exists task_items_sla_idx
  on public.task_items (organization_id, sla_due_at)
  where deleted_at is null and status not in ('closed', 'cancelled', 'done');

create index if not exists task_items_template_kind_idx
  on public.task_items (organization_id, template_kind, status)
  where deleted_at is null;
