/**
 * Generates supabase/migrations/*_learning_system_catalog.sql with embedded AML JSON.
 * Run: node scripts/generate-learning-system-migration.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const jsonPath = join(root, 'supabase/seed-data/aml-system-course.json')
const outPath = join(root, 'supabase/migrations/20260408120000_learning_system_catalog.sql')

const raw = readFileSync(jsonPath, 'utf8')
// Validate JSON
JSON.parse(raw)

const payload = raw.replace(/'/g, "''")

const sql = `-- System-wide learning catalog + org settings + AML seed (generated).
-- Regenerate seed body: node scripts/generate-learning-system-migration.mjs

-- ---------------------------------------------------------------------------
-- Catalog: system-defined courses (shared across all organizations)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_system_courses (
  id text primary key,
  slug text not null unique,
  default_locale text not null default 'nb',
  created_at timestamptz not null default now()
);

create table if not exists public.learning_system_course_locales (
  system_course_id text not null references public.learning_system_courses (id) on delete cascade,
  locale text not null,
  title text not null,
  description text not null default '',
  modules jsonb not null default '[]',
  primary key (system_course_id, locale)
);

create index if not exists learning_system_locales_course_idx
  on public.learning_system_course_locales (system_course_id);

-- Per-organization: enable/disable system offerings; optional fork to org-owned copy
create table if not exists public.learning_org_course_settings (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  system_course_id text not null references public.learning_system_courses (id) on delete cascade,
  enabled boolean not null default true,
  forked_course_id text references public.learning_courses (id) on delete set null,
  primary key (organization_id, system_course_id)
);

create index if not exists learning_org_course_settings_fork_idx
  on public.learning_org_course_settings (forked_course_id)
  where forked_course_id is not null;

-- Org course may mirror a system definition (modules loaded from catalog unless forked)
alter table public.learning_courses
  add column if not exists source_system_course_id text references public.learning_system_courses (id) on delete set null;

alter table public.learning_courses
  add column if not exists catalog_locale text;

comment on column public.learning_courses.source_system_course_id is 'When set, module payload may come from learning_system_course_locales instead of learning_modules.';
comment on column public.learning_courses.catalog_locale is 'Locale used when resolving system catalog content for this row.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.learning_system_courses enable row level security;
alter table public.learning_system_course_locales enable row level security;
alter table public.learning_org_course_settings enable row level security;

drop policy if exists "learning_system_courses_select_authenticated" on public.learning_system_courses;
create policy "learning_system_courses_select_authenticated"
  on public.learning_system_courses for select
  to authenticated
  using (true);

drop policy if exists "learning_system_locales_select_authenticated" on public.learning_system_course_locales;
create policy "learning_system_locales_select_authenticated"
  on public.learning_system_course_locales for select
  to authenticated
  using (true);

drop policy if exists "learning_org_course_settings_select_member" on public.learning_org_course_settings;
create policy "learning_org_course_settings_select_member"
  on public.learning_org_course_settings for select
  using (organization_id = public.current_org_id());

drop policy if exists "learning_org_course_settings_write_manage" on public.learning_org_course_settings;
create policy "learning_org_course_settings_write_manage"
  on public.learning_org_course_settings for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

drop policy if exists "learning_org_course_settings_update_manage" on public.learning_org_course_settings;
create policy "learning_org_course_settings_update_manage"
  on public.learning_org_course_settings for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

drop policy if exists "learning_org_course_settings_delete_manage" on public.learning_org_course_settings;
create policy "learning_org_course_settings_delete_manage"
  on public.learning_org_course_settings for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- ---------------------------------------------------------------------------
-- Ensure each org has a learning_courses row for enabled system courses (FK for progress)
-- ---------------------------------------------------------------------------

create or replace function public.learning_ensure_system_course_rows(p_locale text default 'nb')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  r record;
  v_loc text;
  v_title text;
  v_desc text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    return;
  end if;
  v_loc := case when p_locale in ('nb', 'en') then p_locale else 'nb' end;

  for r in
    select s.id as sid, s.default_locale,
           coalesce(l.title, l2.title) as title,
           coalesce(l.description, l2.description) as description
    from public.learning_system_courses s
    left join public.learning_system_course_locales l
      on l.system_course_id = s.id and l.locale = v_loc
    left join public.learning_system_course_locales l2
      on l2.system_course_id = s.id and l2.locale = s.default_locale
  loop
    insert into public.learning_courses (
      id, organization_id, title, description, status, tags,
      source_system_course_id, catalog_locale
    ) values (
      r.sid,
      v_org,
      coalesce(r.title, 'Course'),
      coalesce(r.description, ''),
      'published',
      array['system']::text[],
      r.sid,
      v_loc
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      source_system_course_id = excluded.source_system_course_id,
      catalog_locale = excluded.catalog_locale,
      updated_at = now();

    insert into public.learning_org_course_settings (organization_id, system_course_id, enabled)
    values (v_org, r.sid, true)
    on conflict (organization_id, system_course_id) do nothing;
  end loop;
end;
$$;

grant execute on function public.learning_ensure_system_course_rows(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fork system course into org-owned copy (modules copied to learning_modules)
-- ---------------------------------------------------------------------------

create or replace function public.learning_fork_system_course(p_system_course_id text, p_locale text default 'nb')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_loc text;
  v_new_id text;
  v_title text;
  v_desc text;
  v_modules jsonb;
  m jsonb;
  v_sort int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  v_loc := case when p_locale in ('nb', 'en') then p_locale else 'nb' end;

  select l.title, l.description, l.modules
    into v_title, v_desc, v_modules
  from public.learning_system_course_locales l
  where l.system_course_id = p_system_course_id and l.locale = v_loc;
  if v_modules is null then
    select l.title, l.description, l.modules
      into v_title, v_desc, v_modules
    from public.learning_system_course_locales l
    join public.learning_system_courses s on s.id = l.system_course_id
    where l.system_course_id = p_system_course_id and l.locale = (select default_locale from public.learning_system_courses where id = p_system_course_id);
  end if;
  if v_modules is null then
    raise exception 'System course not found';
  end if;

  v_new_id := gen_random_uuid()::text;
  insert into public.learning_courses (
    id, organization_id, title, description, status, tags,
    source_system_course_id, catalog_locale
  ) values (
    v_new_id,
    v_org,
    coalesce(v_title, 'Course'),
    coalesce(v_desc, ''),
    'draft',
    array['fork', 'system']::text[],
    null,
    null
  );

  v_sort := 0;
  for m in select * from jsonb_array_elements(v_modules)
  loop
    insert into public.learning_modules (
      id, organization_id, course_id, title, sort_order, kind, content, duration_minutes
    ) values (
      coalesce(m->>'id', gen_random_uuid()::text),
      v_org,
      v_new_id,
      coalesce(m->>'title', 'Module'),
      coalesce((m->>'order')::int, v_sort),
      coalesce(m->>'kind', 'text'),
      coalesce(m->'content', '{}'::jsonb),
      coalesce((m->>'durationMinutes')::int, 5)
    );
    v_sort := v_sort + 1;
  end loop;

  insert into public.learning_org_course_settings (organization_id, system_course_id, enabled, forked_course_id)
  values (v_org, p_system_course_id, true, v_new_id)
  on conflict (organization_id, system_course_id) do update set
    forked_course_id = excluded.forked_course_id,
    enabled = true;

  return v_new_id;
end;
$$;

grant execute on function public.learning_fork_system_course(text, text) to authenticated;

create or replace function public.learning_set_system_course_enabled(p_system_course_id text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;

  insert into public.learning_org_course_settings (organization_id, system_course_id, enabled)
  values (v_org, p_system_course_id, p_enabled)
  on conflict (organization_id, system_course_id) do update set enabled = excluded.enabled;
end;
$$;

grant execute on function public.learning_set_system_course_enabled(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: AML course (JSON payload)
-- ---------------------------------------------------------------------------

do $amlseed$
declare
  payload jsonb := '${payload}'::jsonb;
  nb jsonb;
  en jsonb;
begin
  insert into public.learning_system_courses (id, slug, default_locale)
  values ('c-aml-ledere', 'aml-ledere', 'nb')
  on conflict (id) do nothing;

  nb := payload->'locales'->'nb';
  en := payload->'locales'->'en';

  insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
  values (
    'c-aml-ledere',
    'nb',
    nb->>'title',
    coalesce(nb->>'description', ''),
    coalesce(nb->'modules', '[]'::jsonb)
  )
  on conflict (system_course_id, locale) do update set
    title = excluded.title,
    description = excluded.description,
    modules = excluded.modules;

  insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
  values (
    'c-aml-ledere',
    'en',
    en->>'title',
    coalesce(en->>'description', ''),
    coalesce(en->'modules', '[]'::jsonb)
  )
  on conflict (system_course_id, locale) do update set
    title = excluded.title,
    description = excluded.description,
    modules = excluded.modules;
end;
$amlseed$;

-- ---------------------------------------------------------------------------
-- Certificate RPC: count modules from catalog when source_system_course_id set
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
  v_mods jsonb;
  m record;
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

  if v_course.source_system_course_id is not null
     and not exists (select 1 from public.learning_modules where course_id = p_course_id and organization_id = v_org)
  then
    select l.modules into v_mods
    from public.learning_system_course_locales l
    where l.system_course_id = v_course.source_system_course_id
      and l.locale = coalesce(v_course.catalog_locale, 'nb');
    if v_mods is null then
      select l.modules into v_mods
      from public.learning_system_course_locales l
      where l.system_course_id = v_course.source_system_course_id
        and l.locale = (select default_locale from public.learning_system_courses where id = v_course.source_system_course_id limit 1);
    end if;
    select count(*)::int into v_modules from jsonb_array_elements(coalesce(v_mods, '[]'::jsonb));
    select count(*)::int into v_done
    from jsonb_array_elements(coalesce(v_mods, '[]'::jsonb)) as e(elem)
    where coalesce((v_prog.module_progress -> (e.elem->>'id') ->> 'completed')::boolean, false) = true;
  else
    select count(*)::int into v_modules from public.learning_modules where course_id = p_course_id and organization_id = v_org;
    select count(*)::int into v_done
    from public.learning_modules m
    where m.course_id = p_course_id and m.organization_id = v_org
      and coalesce((v_prog.module_progress -> (m.id::text) ->> 'completed')::boolean, false) = true;
  end if;

  if v_modules = 0 then
    raise exception 'Course has no modules';
  end if;
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
`

writeFileSync(outPath, sql)
console.log('Wrote', outPath)
