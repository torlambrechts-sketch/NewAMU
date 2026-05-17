-- Studio Builder — studio_revisions table + generic trigger framework.
--
-- Foundation for tracking template/workflow/document/etc. mutations made via
-- Studio. Mirrors workflow_rule_revisions but is scope-agnostic — every
-- studio-aware table can ship a trigger that writes here using
-- studio_capture_revision('<scope_id>', '<kind_id>') as TG arguments.
--
-- The `app.studio_skip_revisions` GUC lets bulk paths (provision_*_baseline_for_org,
-- studio-pack-import) skip writing — they would otherwise produce hundreds of
-- revision rows per call. Set with `set local app.studio_skip_revisions = on;`
-- inside the transaction that wants to skip.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 (overvåking og gjennomgang av
--   internkontrollen). Studio writes by customer admins and consultancy
--   partners need before/after snapshots so audit can trace "who changed
--   § 4-3 wording, when, and why" — without a per-row revision log there
--   is no defence against post-hoc tampering. AML § 3-1 (2) e (iverksette
--   tiltak ved avvik) also depends on this; an authoring tool that doesn't
--   record what changed cannot support a corrective-action audit trail.
--   Restrisiko deferred:
--     - Per-table triggers wired only on compliance_checklist_templates in
--       this migration; other studio-aware tables get their triggers as
--       each scope's embedder lands in Phase 2a.
--     - No tamper-evident checksum chain yet (Merkle-style); studio_revisions
--       is append-only via RLS but not cryptographically chained. Phase D
--       of workflow-engine-review.md ships that pattern.
--
-- Idempotent — all DDL uses `if not exists` / guarded `do $$` blocks.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. compliance_review_status enum — re-create if missing
-- ────────────────────────────────────────────────────────────────────
-- This enum lives in archive/_20260808120000_compliance_templates_review_and_cadence.sql.
-- Re-create guard so this migration is self-sufficient on environments
-- where the archive migration hasn't been applied.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_review_status') then
    create type public.compliance_review_status as enum ('draft', 'reviewed', 'approved');
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. studio_revisions — append-only mutation log
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.studio_revisions (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  kind_id text not null,
  row_id uuid not null,
  row_table text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  prev_payload jsonb,
  next_payload jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  change_reason text,
  review_status public.compliance_review_status not null default 'draft'
);

create index if not exists studio_revisions_org_changed_idx
  on public.studio_revisions (organization_id, changed_at desc);

create index if not exists studio_revisions_row_idx
  on public.studio_revisions (row_table, row_id, changed_at desc);

create index if not exists studio_revisions_scope_idx
  on public.studio_revisions (scope_id, kind_id, changed_at desc);

comment on table public.studio_revisions is
  'Append-only audit log of every Studio-mediated mutation. Trigger-driven via studio_capture_revision().';
comment on column public.studio_revisions.scope_id is
  'Studio scope (compliance | survey | documents | learning | meetings | registers | dashboards | workflows).';
comment on column public.studio_revisions.kind_id is
  'Studio kind within the scope (e.g. policy, checklist, course_module).';
comment on column public.studio_revisions.prev_payload is
  'Row state before the mutation. NULL for inserts.';
comment on column public.studio_revisions.next_payload is
  'Row state after the mutation. NULL for deletes.';
comment on column public.studio_revisions.review_status is
  'Carried forward from the mutated row when present, else defaults to draft.';

-- ────────────────────────────────────────────────────────────────────
-- 3. RLS — org-scoped read; writes via security-definer trigger only
-- ────────────────────────────────────────────────────────────────────

alter table public.studio_revisions enable row level security;

drop policy if exists studio_revisions_select on public.studio_revisions;
create policy studio_revisions_select
  on public.studio_revisions for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    or organization_id is null
  );

-- No insert / update / delete policies — writes are trigger-only via
-- security definer. UPDATE and DELETE will be denied for everyone except
-- the table owner (which only runs via maintenance scripts).

-- ────────────────────────────────────────────────────────────────────
-- 4. Generic trigger function — studio_capture_revision()
-- ────────────────────────────────────────────────────────────────────
-- Attach to any studio-aware table via:
--   create trigger trg_studio_revisions_<scope> after insert or update or delete
--     on public.<table_name>
--     for each row
--     execute function public.studio_capture_revision('<scope_id>', '<kind_id>');

create or replace function public.studio_capture_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skip text;
  v_scope text;
  v_kind  text;
  v_org   uuid;
  v_user  uuid;
  v_row_id uuid;
begin
  -- 1. Honour the skip GUC for bulk paths.
  begin
    v_skip := current_setting('app.studio_skip_revisions', true);
  exception when others then
    v_skip := null;
  end;
  if v_skip in ('on', 'true', 't', '1') then
    return coalesce(NEW, OLD);
  end if;

  -- 2. Trigger args: scope_id, kind_id (required).
  v_scope := tg_argv[0];
  v_kind  := tg_argv[1];
  if v_scope is null or v_kind is null then
    raise exception 'studio_capture_revision requires (scope_id, kind_id) trigger arguments';
  end if;

  -- 3. organization_id from the row (every studio-aware table has it).
  v_org := coalesce(
    (to_jsonb(NEW)->>'organization_id')::uuid,
    (to_jsonb(OLD)->>'organization_id')::uuid
  );

  -- 4. row_id from the row's primary key column `id`.
  v_row_id := coalesce(
    (to_jsonb(NEW)->>'id')::uuid,
    (to_jsonb(OLD)->>'id')::uuid
  );
  if v_row_id is null then
    -- Composite-PK tables (e.g. partner_memberships) — fall back to a
    -- deterministic uuid_v5 over the row's jsonb so revisions still chain.
    v_row_id := uuid_generate_v5(
      '00000000-0000-0000-0000-000000000000'::uuid,
      coalesce(to_jsonb(NEW), to_jsonb(OLD))::text
    );
  end if;

  -- 5. changed_by from auth.uid() — null if no session (system path).
  begin
    v_user := auth.uid();
  exception when others then
    v_user := null;
  end;

  -- 6. Skip no-op UPDATE (prev == next).
  if tg_op = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then
    return NEW;
  end if;

  insert into public.studio_revisions (
    scope_id, kind_id, row_id, row_table, organization_id,
    prev_payload, next_payload, changed_by, review_status
  ) values (
    v_scope, v_kind, v_row_id, tg_table_name, v_org,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(NEW) else null end,
    v_user,
    coalesce(
      (to_jsonb(NEW)->>'review_status')::public.compliance_review_status,
      (to_jsonb(OLD)->>'review_status')::public.compliance_review_status,
      'draft'
    )
  );

  return coalesce(NEW, OLD);
end;
$$;

grant select on public.studio_revisions to authenticated;
grant execute on function public.studio_capture_revision() to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 5. Smoke-test trigger on compliance_checklist_templates
-- ────────────────────────────────────────────────────────────────────
-- Per-scope triggers for survey_org_templates, document_org_templates,
-- learning_courses, meeting_templates, register_types, dashboard_layouts,
-- workflow_rules ship as each scope's embedder lands in Phase 2a. This
-- one is wired now so Phase 0 acceptance criterion #3 ("editing a
-- checklist template writes a studio_revisions row") can be verified
-- end-to-end.

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'compliance_checklist_templates') then
    drop trigger if exists trg_studio_revisions_compliance on public.compliance_checklist_templates;
    create trigger trg_studio_revisions_compliance
      after insert or update or delete on public.compliance_checklist_templates
      for each row execute function public.studio_capture_revision('compliance', 'checklist_template');
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 6. Convenience helper — bulk-import wrapper
-- ────────────────────────────────────────────────────────────────────
-- Use inside provision_*_baseline_for_org and studio-pack-import to skip
-- revisions for the duration of a transaction without callers having to
-- remember the GUC string.

create or replace function public.studio_with_skip_revisions(
  p_label text default 'bulk'
) returns void
language plpgsql
as $$
begin
  perform set_config('app.studio_skip_revisions', 'on', true);
end;
$$;

grant execute on function public.studio_with_skip_revisions(text) to authenticated;

comment on function public.studio_with_skip_revisions(text) is
  'Inside a transaction, call this before running a bulk provision RPC or import to skip studio_revisions writes. Resets at transaction end (set_config local).';
