-- Org-course versioning parity with system courses (PR #292 follow-up).
--
-- The first versioning migration (20260906122000) only added the changelog
-- surface to system-course locales. Org courses (learning_courses) still
-- only had a monotonic int via bumpCourseVersion() — no changelog, no
-- major/minor, no history. This adds the same shape so the Versjonshistorikk
-- tab in the builder can render a unified timeline regardless of origin.

create table if not exists public.learning_org_course_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id text not null,
  version_major int not null,
  version_minor int not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  change_notes_md text,
  module_ids_snapshot jsonb not null default '[]'::jsonb,
  is_major boolean not null default false,
  unique (course_id, version_major, version_minor)
);

comment on table public.learning_org_course_versions is
  'Immutable changelog per per-org course (mirror of learning_system_course_locale_versions for org-owned content).';
comment on column public.learning_org_course_versions.module_ids_snapshot is
  'JSON array of module ids present in this version.';

create index if not exists learning_org_course_versions_org_idx
  on public.learning_org_course_versions (organization_id, course_id);

alter table public.learning_org_course_versions enable row level security;

drop policy if exists "learning_org_course_versions_select" on public.learning_org_course_versions;
create policy "learning_org_course_versions_select"
  on public.learning_org_course_versions for select
  using (organization_id = public.current_org_id());

-- Inserts only via security-definer RPC below.

alter table public.learning_courses
  add column if not exists change_notes_md text;

comment on column public.learning_courses.change_notes_md is
  'Most-recent changelog (Markdown). Full history in learning_org_course_versions.';

-- Backfill: every existing org course gets a v(course_version, 0) history row
-- mirroring the current module set. Idempotent on the (course_id, major, minor)
-- unique key.
insert into public.learning_org_course_versions (
  organization_id, course_id, version_major, version_minor,
  published_at, change_notes_md, module_ids_snapshot, is_major
)
select
  c.organization_id,
  c.id,
  coalesce(c.course_version, 1),
  coalesce(c.course_version_minor, 0),
  c.updated_at,
  'Initial backfilled version (migration 20260906123000).',
  coalesce(
    (select jsonb_agg(m.id::text order by m.sort_order)
     from public.learning_modules m
     where m.course_id = c.id and m.organization_id = c.organization_id),
    '[]'::jsonb
  ),
  false
from public.learning_courses c
on conflict (course_id, version_major, version_minor) do nothing;

-- Publish a new version of an org-owned course. Validates monotonic increase,
-- updates the courses row, and inserts an immutable history row in one tx.
create or replace function public.learning_publish_org_course_version(
  p_course_id text,
  p_version_major int,
  p_version_minor int,
  p_is_major boolean,
  p_change_notes_md text
)
returns public.learning_org_course_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_course public.learning_courses%rowtype;
  v_last_major int;
  v_last_minor int;
  v_row public.learning_org_course_versions%rowtype;
  v_modules jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then
    raise exception 'No organization';
  end if;
  select * into v_course from public.learning_courses where id = p_course_id and organization_id = v_org;
  if not found then
    raise exception 'Course not found';
  end if;
  if p_version_major < 1 or p_version_minor < 0 then
    raise exception 'version must be >= 1.0';
  end if;

  select version_major, version_minor into v_last_major, v_last_minor
  from public.learning_org_course_versions
  where course_id = p_course_id
  order by version_major desc, version_minor desc
  limit 1;

  if v_last_major is not null then
    if p_version_major < v_last_major
       or (p_version_major = v_last_major and p_version_minor <= v_last_minor)
    then
      raise exception 'Version (%, %) must be greater than latest (%, %)',
        p_version_major, p_version_minor, v_last_major, v_last_minor;
    end if;
  end if;

  select coalesce(jsonb_agg(m.id::text order by m.sort_order), '[]'::jsonb)
    into v_modules
  from public.learning_modules m
  where m.course_id = p_course_id and m.organization_id = v_org;

  insert into public.learning_org_course_versions (
    organization_id, course_id, version_major, version_minor,
    published_by, change_notes_md, module_ids_snapshot, is_major
  )
  values (
    v_org, p_course_id, p_version_major, p_version_minor,
    v_uid, p_change_notes_md, v_modules, coalesce(p_is_major, false)
  )
  returning * into v_row;

  update public.learning_courses
  set course_version = p_version_major,
      course_version_minor = p_version_minor,
      change_notes_md = p_change_notes_md,
      updated_at = now()
  where id = p_course_id and organization_id = v_org;

  return v_row;
end;
$$;

grant execute on function public.learning_publish_org_course_version(text, int, int, boolean, text) to authenticated;
