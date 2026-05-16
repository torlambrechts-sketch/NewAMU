-- learning_template_versions — append-only snapshot log for
-- learning_courses. Captures the course definition (title, content,
-- status, gradebook config) on each meaningful update.
--
-- Note: learning_courses is the "template" in the learning module —
-- enrolments / attempts are tracked in separate tables and are NOT
-- the subject of this log. This table tracks course-as-template
-- edits only.

create table if not exists public.learning_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.learning_courses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists learning_template_versions_tpl_idx
  on public.learning_template_versions (template_id, created_at desc);
create index if not exists learning_template_versions_org_idx
  on public.learning_template_versions (organization_id, created_at desc);

alter table public.learning_template_versions enable row level security;

drop policy if exists learning_template_versions_select on public.learning_template_versions;
create policy learning_template_versions_select
  on public.learning_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.learning_template_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Snapshot when meaningful course fields change. We deliberately
  -- include 'status' here so publish / archive events are auditable.
  if old.title is not distinct from new.title
     and coalesce(old.description, '') is not distinct from coalesce(new.description, '')
     and old.status is not distinct from new.status
     and old.category_id is not distinct from new.category_id
  then
    return new;
  end if;
  insert into public.learning_template_versions
    (template_id, organization_id, snapshot, changed_by)
  values (
    new.id,
    new.organization_id,
    jsonb_build_object(
      'title', new.title,
      'description', new.description,
      'status', new.status,
      'category_id', new.category_id,
      'updated_at', new.updated_at
    ),
    auth.uid()
  );
  return new;
end
$fn$;

drop trigger if exists learning_template_snapshot on public.learning_courses;
create trigger learning_template_snapshot
  after update on public.learning_courses
  for each row execute function public.learning_template_snapshot_fn();

comment on table public.learning_template_versions is
  'Append-only snapshot of course (template) state on each meaningful update.';
