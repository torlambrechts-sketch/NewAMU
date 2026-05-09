-- Task subtasks, comments and activity log — moves localStorage data to the DB.
--
-- Coverage gap closed:
--   useTaskExtensions.ts stored subtasks, comments, projects and priorities in
--   localStorage. This means data is lost on browser clear, not multi-user,
--   and not auditable. This migration provides proper relational tables so
--   subtasks and comments are:
--     - Persisted server-side with org-level RLS
--     - Multi-user (collaborators can add comments and subtasks)
--     - Audited via task_activity_log (INSERT-only, no UPDATE/DELETE by policy)
--
--   task_activity_log is the immutable audit trail required by ISO 45001 § 9.1.1
--   and AML § 5-2 for objective evidence.
--
-- Self-audit:
--   IK-f § 5 nr. 1 krever at internkontrollsystemet er dokumentert.
--   task_activity_log gir uforanderlig tidslinje for hver oppgave.
--   Restrisiko: ingen full-text søk på kommentarer i dag (GIN-indeks
--   kan legges til om behov oppstår).

set local search_path = public, pg_catalog;

-- ── Table: task_subtasks ──────────────────────────────────────────────────

create table if not exists public.task_subtasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  title           text not null,
  is_done         boolean not null default false,
  done_at         timestamptz,
  done_by         uuid references auth.users (id) on delete set null,
  position        int not null default 100,
  assignee_user_id uuid references auth.users (id) on delete set null,
  due_date        date,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_subtasks_item_pos_idx
  on public.task_subtasks (task_item_id, position)
  where deleted_at is null;

alter table public.task_subtasks enable row level security;

drop policy if exists task_subtasks_select_org on public.task_subtasks;
create policy task_subtasks_select_org
  on public.task_subtasks for select
  using (organization_id = public.current_org_id());

drop policy if exists task_subtasks_write_org on public.task_subtasks;
create policy task_subtasks_write_org
  on public.task_subtasks for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_subtasks_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_subtasks_before_insert_defaults_tg on public.task_subtasks;
create trigger task_subtasks_before_insert_defaults_tg
  before insert on public.task_subtasks
  for each row execute function public.task_subtasks_before_insert_defaults();

drop trigger if exists task_subtasks_set_updated_at on public.task_subtasks;
create trigger task_subtasks_set_updated_at
  before update on public.task_subtasks
  for each row execute function public.set_updated_at();

-- Auto-set done_at when is_done flips true
create or replace function public.task_subtasks_before_update_done()
returns trigger
language plpgsql
as $$
begin
  if new.is_done = true and (old.is_done = false or old.is_done is null) then
    new.done_at := coalesce(new.done_at, now());
    new.done_by := coalesce(new.done_by, auth.uid());
  end if;
  if new.is_done = false and old.is_done = true then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists task_subtasks_before_update_done_tg on public.task_subtasks;
create trigger task_subtasks_before_update_done_tg
  before update on public.task_subtasks
  for each row execute function public.task_subtasks_before_update_done();

-- ── Table: task_comments ──────────────────────────────────────────────────

create table if not exists public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  -- author_name denormalized for display without auth join
  author_name     text not null default '',
  author_user_id  uuid references auth.users (id) on delete set null,
  -- For threaded replies
  parent_comment_id uuid references public.task_comments (id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists task_comments_item_created_idx
  on public.task_comments (task_item_id, created_at)
  where deleted_at is null;

alter table public.task_comments enable row level security;

drop policy if exists task_comments_select_org on public.task_comments;
create policy task_comments_select_org
  on public.task_comments for select
  using (organization_id = public.current_org_id());

drop policy if exists task_comments_insert_org on public.task_comments;
create policy task_comments_insert_org
  on public.task_comments for insert
  with check (organization_id = public.current_org_id());

-- Only author can update/delete own comment
drop policy if exists task_comments_update_own on public.task_comments;
create policy task_comments_update_own
  on public.task_comments for update
  using (organization_id = public.current_org_id() and author_user_id = auth.uid());

drop policy if exists task_comments_delete_own on public.task_comments;
create policy task_comments_delete_own
  on public.task_comments for delete
  using (organization_id = public.current_org_id() and author_user_id = auth.uid());

create or replace function public.task_comments_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.author_user_id is null then
    new.author_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_comments_before_insert_defaults_tg on public.task_comments;
create trigger task_comments_before_insert_defaults_tg
  before insert on public.task_comments
  for each row execute function public.task_comments_before_insert_defaults();

-- ── Table: task_activity_log ──────────────────────────────────────────────
-- Immutable audit trail. RLS allows INSERT but blocks UPDATE and DELETE.
-- This is the "objective evidence" store for ISO 45001 § 9.1.1.

create table if not exists public.task_activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  -- action codes: status_change, comment_added, subtask_done, evidence_added,
  --               assignee_changed, reviewer_assigned, approved, reviewed,
  --               vo_notified, amu_notified, arbeidstilsynet_notified,
  --               created, deleted, field_updated
  action          text not null,
  actor_user_id   uuid references auth.users (id) on delete set null,
  actor_name      text not null default '',
  -- Flexible payload: {from, to, field, comment, ...}
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists task_activity_log_item_created_idx
  on public.task_activity_log (task_item_id, created_at desc);

create index if not exists task_activity_log_org_created_idx
  on public.task_activity_log (organization_id, created_at desc);

alter table public.task_activity_log enable row level security;

drop policy if exists task_activity_log_select_org on public.task_activity_log;
create policy task_activity_log_select_org
  on public.task_activity_log for select
  using (organization_id = public.current_org_id());

-- INSERT only — no UPDATE or DELETE (immutable audit trail)
drop policy if exists task_activity_log_insert_org on public.task_activity_log;
create policy task_activity_log_insert_org
  on public.task_activity_log for insert
  with check (organization_id = public.current_org_id());

create or replace function public.task_activity_log_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.actor_user_id is null then
    new.actor_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_activity_log_before_insert_defaults_tg
  on public.task_activity_log;
create trigger task_activity_log_before_insert_defaults_tg
  before insert on public.task_activity_log
  for each row execute function public.task_activity_log_before_insert_defaults();

-- Auto-log status changes on task_items
create or replace function public.task_items_status_change_log()
returns trigger
language plpgsql
as $$
begin
  if new.status <> old.status then
    insert into public.task_activity_log
      (organization_id, task_item_id, action, actor_user_id, payload)
    values (
      new.organization_id,
      new.id,
      'status_change',
      auth.uid(),
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists task_items_status_change_log_tg on public.task_items;
create trigger task_items_status_change_log_tg
  after update on public.task_items
  for each row
  when (old.status is distinct from new.status)
  execute function public.task_items_status_change_log();

-- ── Table: task_watchers ──────────────────────────────────────────────────

create table if not exists public.task_watchers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- role: 'watcher' | 'contributor' (contributors can add evidence/comments)
  role            text not null default 'watcher'
    check (role in ('watcher', 'contributor')),
  created_at      timestamptz not null default now(),
  unique (task_item_id, user_id)
);

create index if not exists task_watchers_user_idx
  on public.task_watchers (user_id, organization_id);

alter table public.task_watchers enable row level security;

drop policy if exists task_watchers_select_org on public.task_watchers;
create policy task_watchers_select_org
  on public.task_watchers for select
  using (organization_id = public.current_org_id());

drop policy if exists task_watchers_write_org on public.task_watchers;
create policy task_watchers_write_org
  on public.task_watchers for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
