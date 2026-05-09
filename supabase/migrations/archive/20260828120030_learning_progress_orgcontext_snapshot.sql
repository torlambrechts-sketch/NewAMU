-- Learning course progress: snapshot org-context at completion + course metadata_schema.
--
-- Per /specs/elearning-parity.md (T5 + T6, merged into one migration since
-- both add columns and neither needs the other's data).
--
-- T5 — snapshot org-context columns on learning_course_progress:
--   `location_id_at_completion` / `department_id_at_completion` / `team_id_at_completion`
-- These are immutable snapshots of the user's org_member row at the moment
-- `completed_at` transitions from null to non-null. Preserves audit context
-- when a learner transfers departments later. The trigger only writes once
-- (when previous values are null) so admin-tweaked values stay sticky.
--
-- T6 — metadata_schema on courses:
--   `learning_courses.metadata_schema jsonb default '{"fields":[]}'`
-- Drives the dynamic completion panel (per spec §6).
--
-- Idempotent: alter add column if not exists; trigger uses on conflict
-- semantics implicitly via the "previous values null" guard.

set local search_path = public, pg_catalog;

-- ── 1. Snapshot columns on learning_course_progress ───────────────────────

alter table public.learning_course_progress
  add column if not exists location_id_at_completion uuid
    references public.locations (id) on delete set null,
  add column if not exists department_id_at_completion uuid
    references public.departments (id) on delete set null,
  add column if not exists team_id_at_completion uuid
    references public.teams (id) on delete set null;

create index if not exists learning_progress_dept_at_completion_idx
  on public.learning_course_progress (department_id_at_completion)
  where department_id_at_completion is not null;

create index if not exists learning_progress_loc_at_completion_idx
  on public.learning_course_progress (location_id_at_completion)
  where location_id_at_completion is not null;

-- ── 2. Trigger: snapshot org-context at completion ────────────────────────
--
-- organization_members doesn't carry a user_id FK to auth.users in this
-- codebase; the closest match is by email/name resolution. As a pragmatic
-- v1 we look up the *first* organization_member row that matches the
-- user's profile email (case-insensitive). If no match found, the columns
-- stay null — analytics treat that as "uten avdeling".

create or replace function public.learning_progress_snapshot_orgcontext_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_member record;
begin
  -- Only fire on the transition INTO completed (null → non-null).
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  -- Idempotent: don't overwrite an admin-tweaked snapshot.
  if new.location_id_at_completion is not null
     or new.department_id_at_completion is not null
     or new.team_id_at_completion is not null then
    return new;
  end if;

  -- Resolve the user's email via auth.users → profiles. Best-effort.
  begin
    select coalesce(p.email, au.email) into v_email
    from auth.users au
    left join public.profiles p on p.id = au.id
    where au.id = new.user_id;
  exception
    when others then v_email := null;
  end;

  if v_email is null then
    return new;
  end if;

  -- Match the first organization_member row in this org with the same email.
  select location_id, department_id, team_id
    into v_member
    from public.organization_members
   where organization_id = new.organization_id
     and lower(coalesce(email, '')) = lower(v_email)
   limit 1;

  if found then
    new.location_id_at_completion   := v_member.location_id;
    new.department_id_at_completion := v_member.department_id;
    new.team_id_at_completion       := v_member.team_id;
  end if;

  return new;
end;
$$;

drop trigger if exists learning_progress_snapshot_orgcontext_tg on public.learning_course_progress;
create trigger learning_progress_snapshot_orgcontext_tg
  before update on public.learning_course_progress
  for each row execute function public.learning_progress_snapshot_orgcontext_on_completion();

-- Also fire on insert when the row is created already-completed (rare).
create or replace function public.learning_progress_snapshot_orgcontext_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_member record;
begin
  if new.completed_at is null then return new; end if;
  if new.location_id_at_completion is not null
     or new.department_id_at_completion is not null
     or new.team_id_at_completion is not null then
    return new;
  end if;

  begin
    select coalesce(p.email, au.email) into v_email
    from auth.users au
    left join public.profiles p on p.id = au.id
    where au.id = new.user_id;
  exception
    when others then v_email := null;
  end;

  if v_email is null then return new; end if;

  select location_id, department_id, team_id into v_member
    from public.organization_members
   where organization_id = new.organization_id
     and lower(coalesce(email, '')) = lower(v_email)
   limit 1;

  if found then
    new.location_id_at_completion   := v_member.location_id;
    new.department_id_at_completion := v_member.department_id;
    new.team_id_at_completion       := v_member.team_id;
  end if;

  return new;
end;
$$;

drop trigger if exists learning_progress_snapshot_orgcontext_insert_tg on public.learning_course_progress;
create trigger learning_progress_snapshot_orgcontext_insert_tg
  before insert on public.learning_course_progress
  for each row execute function public.learning_progress_snapshot_orgcontext_on_insert();

-- ── 3. metadata_schema on courses ─────────────────────────────────────────

alter table public.learning_courses
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

comment on column public.learning_courses.metadata_schema is
  $c$Field declarations driving the course completion metadata panel.
  Same shape as compliance_checklist_templates.metadata_schema. Built-in
  kinds (location, department, team, participants) bind to typed FK columns
  on learning_course_progress (snapshot at completion); free-form kinds
  (text, number, select) land in learning_course_progress.metadata under
  their declared key. Common values per spec OQ-L6: external_cert_id,
  external_hours, practical_test_score, provider.$c$;

-- Per-progress metadata bag — same pattern as
-- compliance_checklist_executions.metadata.
alter table public.learning_course_progress
  add column if not exists metadata jsonb not null
    default '{}'::jsonb;
