-- E-learning: org-scoped courses, modules, progress, certificates + RLS.
-- Adds permission key: learning.manage (course authoring; admin role gets it by default).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Text IDs match app seed courses (e.g. AML) and client-generated UUID strings.
create table if not exists public.learning_courses (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_courses_org_idx on public.learning_courses (organization_id);
create index if not exists learning_courses_org_status_idx on public.learning_courses (organization_id, status);

create table if not exists public.learning_modules (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id text not null references public.learning_courses (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  kind text not null,
  content jsonb not null,
  duration_minutes int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_modules_course_idx on public.learning_modules (course_id, sort_order);
create index if not exists learning_modules_org_idx on public.learning_modules (organization_id);

create table if not exists public.learning_course_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id text not null references public.learning_courses (id) on delete cascade,
  module_progress jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, course_id)
);

create index if not exists learning_progress_org_idx on public.learning_course_progress (organization_id);
create index if not exists learning_progress_user_idx on public.learning_course_progress (user_id);

create table if not exists public.learning_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id text not null references public.learning_courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_title text not null,
  learner_name text not null,
  issued_at timestamptz not null default now(),
  verify_code text not null,
  constraint learning_certificates_user_course_unique unique (user_id, course_id)
);

create index if not exists learning_certificates_org_idx on public.learning_certificates (organization_id);
create index if not exists learning_certificates_user_idx on public.learning_certificates (user_id);

drop trigger if exists learning_courses_set_updated_at on public.learning_courses;
create trigger learning_courses_set_updated_at
  before update on public.learning_courses
  for each row execute function public.set_updated_at();

drop trigger if exists learning_modules_set_updated_at on public.learning_modules;
create trigger learning_modules_set_updated_at
  before update on public.learning_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.learning_courses enable row level security;
alter table public.learning_modules enable row level security;
alter table public.learning_course_progress enable row level security;
alter table public.learning_certificates enable row level security;

-- Courses: read published for any org member; drafts for learning.manage or org admin
create policy "learning_courses_select_member"
  on public.learning_courses for select
  using (
    organization_id = public.current_org_id()
    and (
      status = 'published'
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

create policy "learning_courses_write_manage"
  on public.learning_courses for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_courses_update_manage"
  on public.learning_courses for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_courses_delete_manage"
  on public.learning_courses for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- Modules: same visibility as parent course (via exists)
create policy "learning_modules_select_member"
  on public.learning_modules for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.learning_courses c
      where c.id = learning_modules.course_id
        and c.organization_id = learning_modules.organization_id
        and (
          c.status = 'published'
          or public.is_org_admin()
          or public.user_has_permission('learning.manage')
        )
    )
  );

create policy "learning_modules_write_manage"
  on public.learning_modules for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_modules_update_manage"
  on public.learning_modules for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_modules_delete_manage"
  on public.learning_modules for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- Progress: own row always; managers see org rows
create policy "learning_progress_select"
  on public.learning_course_progress for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

create policy "learning_progress_insert_own"
  on public.learning_course_progress for insert
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

create policy "learning_progress_update_own"
  on public.learning_course_progress for update
  using (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- Certificates: read own or manage; insert via RPC only
create policy "learning_certificates_select"
  on public.learning_certificates for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- Issue certificate (validates completion server-side)
-- ---------------------------------------------------------------------------

create or replace function public.learning_issue_certificate(
  p_course_id text,
  p_learner_name text default null
)
returns public.learning_certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
  v_course public.learning_courses%rowtype;
  v_prog public.learning_course_progress%rowtype;
  v_modules int;
  v_done int;
  v_name text;
  v_cert public.learning_certificates%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then
    raise exception 'No organization';
  end if;
  select * into v_course from public.learning_courses where id = p_course_id and organization_id = v_org;
  if not found then
    raise exception 'Course not found';
  end if;
  select * into v_prog
  from public.learning_course_progress
  where user_id = v_uid and course_id = p_course_id and organization_id = v_org;
  if not found then
    raise exception 'No progress for course';
  end if;
  select count(*)::int into v_modules from public.learning_modules where course_id = p_course_id and organization_id = v_org;
  if v_modules = 0 then
    raise exception 'Course has no modules';
  end if;
  select count(*)::int into v_done
  from public.learning_modules m
  where m.course_id = p_course_id and m.organization_id = v_org
    and coalesce((v_prog.module_progress -> (m.id::text) ->> 'completed')::boolean, false) = true;
  if v_done < v_modules then
    raise exception 'Course not completed';
  end if;
  if exists (select 1 from public.learning_certificates where user_id = v_uid and course_id = p_course_id) then
    select * into v_cert from public.learning_certificates where user_id = v_uid and course_id = p_course_id;
    return v_cert;
  end if;
  select display_name into v_name from public.profiles where id = v_uid;
  insert into public.learning_certificates (
    organization_id, course_id, user_id, course_title, learner_name, verify_code
  ) values (
    v_org,
    p_course_id,
    v_uid,
    v_course.title,
    coalesce(nullif(trim(p_learner_name), ''), nullif(trim(v_name), ''), 'Bruker'),
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8))
  )
  returning * into v_cert;
  update public.learning_course_progress
  set completed_at = coalesce(completed_at, now())
  where user_id = v_uid and course_id = p_course_id;
  return v_cert;
end;
$$;

grant execute on function public.learning_issue_certificate(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grant learning.manage to existing admin roles
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'learning.manage'
from public.role_definitions rd
where rd.slug = 'admin' and rd.is_system = true
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sync org creation RPCs: add learning.manage for admin role
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'learning.manage'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning')
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.create_organization_with_brreg(
  p_orgnr text,
  p_name text,
  p_brreg jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  r_admin uuid;
  r_member uuid;
  existing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Ikke innlogget';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and organization_id is not null) then
    raise exception 'Profilen er allerede knyttet til en virksomhet';
  end if;
  if p_orgnr is null or p_orgnr !~ '^\d{9}$' then
    raise exception 'Ugyldig organisasjonsnummer (9 siffer)';
  end if;

  select id into existing_id
  from public.organizations
  where organization_number = p_orgnr
  limit 1;

  if existing_id is not null then
    update public.profiles
    set organization_id = existing_id, is_org_admin = coalesce(is_org_admin, false)
    where id = auth.uid();
    return existing_id;
  end if;

  insert into public.organizations (organization_number, name, brreg_snapshot)
  values (p_orgnr, trim(p_name), p_brreg)
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id, is_org_admin = true
  where id = auth.uid();

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (v_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (v_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = v_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = v_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'learning.manage'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (auth.uid(), r_admin, auth.uid())
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning')
    on conflict do nothing;
  end if;

  return v_org_id;
end;
$$;
