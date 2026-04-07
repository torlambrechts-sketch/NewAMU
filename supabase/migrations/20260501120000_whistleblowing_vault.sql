-- Whistleblowing vault: separate from internal_control JSON; strict RLS + append-only notes.

-- ---------------------------------------------------------------------------
-- Public slug on organization (for anonymous submission URL)
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists whistle_public_slug text;

update public.organizations
set whistle_public_slug = replace(id::text, '-', '')
where whistle_public_slug is null;

create or replace function public.organizations_set_whistle_slug()
returns trigger
language plpgsql
as $$
begin
  if new.whistle_public_slug is null or length(trim(new.whistle_public_slug)) < 8 then
    new.whistle_public_slug := replace(new.id::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_whistle_slug_bi on public.organizations;
create trigger organizations_whistle_slug_bi
  before insert on public.organizations
  for each row execute function public.organizations_set_whistle_slug();

alter table public.organizations
  alter column whistle_public_slug set not null;

create unique index if not exists organizations_whistle_slug_uidx
  on public.organizations (whistle_public_slug);

-- ---------------------------------------------------------------------------
-- Permission key: assign via Admin → roller (whistleblowing.committee).
-- Demo org: grant to admin role only (see bottom of file).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Cases
-- ---------------------------------------------------------------------------

create table if not exists public.whistleblowing_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  access_key uuid not null unique default gen_random_uuid(),
  category text not null,
  title text not null,
  description text not null default '',
  who_what_where text not null default '',
  occurred_at_text text,
  is_anonymous boolean not null default true,
  reporter_contact text,
  reporter_user_id uuid references auth.users (id) on delete set null,
  attachment_paths text[] not null default '{}',
  status text not null default 'received'
    check (status in ('received', 'triage', 'investigation', 'internal_review', 'closed')),
  received_at timestamptz not null default now(),
  acknowledgement_due_at timestamptz not null,
  closed_at timestamptz,
  closing_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whistleblowing_cases_org_idx
  on public.whistleblowing_cases (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Append-only internal notes
-- ---------------------------------------------------------------------------

create table if not exists public.whistleblowing_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.whistleblowing_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists whistleblowing_notes_case_idx
  on public.whistleblowing_case_notes (case_id, created_at);

-- Prevent update/delete on notes (append-only)
create or replace function public.whistleblowing_notes_no_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'whistleblowing_case_notes is append-only';
end;
$$;

drop trigger if exists whistleblowing_notes_no_upd on public.whistleblowing_case_notes;
create trigger whistleblowing_notes_no_upd
  before update on public.whistleblowing_case_notes
  for each row execute function public.whistleblowing_notes_no_mutation();

drop trigger if exists whistleblowing_notes_no_del on public.whistleblowing_case_notes;
create trigger whistleblowing_notes_no_del
  before delete on public.whistleblowing_case_notes
  for each row execute function public.whistleblowing_notes_no_mutation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.whistleblowing_cases enable row level security;
alter table public.whistleblowing_case_notes enable row level security;

drop policy if exists "whistle_cases_select" on public.whistleblowing_cases;
create policy "whistle_cases_select"
  on public.whistleblowing_cases for select
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('whistleblowing.committee')
      or reporter_user_id = auth.uid()
    )
  );

drop policy if exists "whistle_cases_insert_auth" on public.whistleblowing_cases;
create policy "whistle_cases_insert_auth"
  on public.whistleblowing_cases for insert
  with check (
    organization_id = public.current_org_id()
    and auth.uid() is not null
    and reporter_user_id is not distinct from auth.uid()
  );

drop policy if exists "whistle_cases_insert_committee" on public.whistleblowing_cases;
create policy "whistle_cases_insert_committee"
  on public.whistleblowing_cases for insert
  with check (
    organization_id = public.current_org_id()
    and auth.uid() is not null
    and reporter_user_id is null
    and (public.is_org_admin() or public.user_has_permission('whistleblowing.committee'))
  );

drop policy if exists "whistle_cases_update_committee" on public.whistleblowing_cases;
create policy "whistle_cases_update_committee"
  on public.whistleblowing_cases for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('whistleblowing.committee'))
  )
  with check (
    organization_id = public.current_org_id()
  );

drop policy if exists "whistle_notes_select" on public.whistleblowing_case_notes;
create policy "whistle_notes_select"
  on public.whistleblowing_case_notes for select
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('whistleblowing.committee')
      or exists (
        select 1 from public.whistleblowing_cases c
        where c.id = case_id and c.reporter_user_id = auth.uid()
      )
    )
  );

drop policy if exists "whistle_notes_insert_committee" on public.whistleblowing_case_notes;
create policy "whistle_notes_insert_committee"
  on public.whistleblowing_case_notes for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('whistleblowing.committee'))
    and author_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Public: resolve slug → org display (no list of all orgs)
-- ---------------------------------------------------------------------------

create or replace function public.public_whistleblowing_org_lookup(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.name
  )
  from public.organizations o
  where lower(trim(o.whistle_public_slug)) = lower(trim(p_slug))
  limit 1;
$$;

grant execute on function public.public_whistleblowing_org_lookup(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: submit without login (by org slug)
-- ---------------------------------------------------------------------------

create or replace function public.public_submit_whistleblowing(
  p_org_slug text,
  p_category text,
  p_title text,
  p_description text,
  p_who_what_where text,
  p_occurred_at_text text,
  p_is_anonymous boolean,
  p_reporter_contact text,
  p_captcha_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_id uuid;
  v_key uuid;
  v_due timestamptz;
begin
  if p_org_slug is null or length(trim(p_org_slug)) < 8 then
    raise exception 'invalid_slug';
  end if;
  if p_title is null or length(trim(p_title)) < 3 then
    raise exception 'title_required';
  end if;
  if p_category is null or length(trim(p_category)) < 2 then
    raise exception 'category_required';
  end if;
  -- Placeholder: integrate captcha verification in Edge Function for production
  if p_captcha_token is not null and length(p_captcha_token) < 1 then
    null;
  end if;

  select id into v_org_id
  from public.organizations
  where whistle_public_slug = lower(trim(p_org_slug))
  limit 1;

  if v_org_id is null then
    raise exception 'org_not_found';
  end if;

  v_due := now() + interval '7 days';

  insert into public.whistleblowing_cases (
    organization_id,
    category,
    title,
    description,
    who_what_where,
    occurred_at_text,
    is_anonymous,
    reporter_contact,
    acknowledgement_due_at
  ) values (
    v_org_id,
    trim(p_category),
    trim(p_title),
    coalesce(trim(p_description), ''),
    coalesce(trim(p_who_what_where), ''),
    nullif(trim(p_occurred_at_text), ''),
    coalesce(p_is_anonymous, true),
    case
      when coalesce(p_is_anonymous, true) then null
      else nullif(trim(p_reporter_contact), '')
    end,
    v_due
  )
  returning id, access_key into v_id, v_key;

  return jsonb_build_object(
    'caseId', v_id,
    'accessKey', v_key,
    'message', 'Varsel mottatt. Oppbevar saksnøkkelen trygt for statusoppslag.'
  );
end;
$$;

grant execute on function public.public_submit_whistleblowing(text, text, text, text, text, text, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: minimal status by access key (no sensitive fields)
-- ---------------------------------------------------------------------------

create or replace function public.public_whistleblowing_status(p_access_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select c.status, c.updated_at, c.acknowledgement_due_at
  into r
  from public.whistleblowing_cases c
  where c.access_key = p_access_key
  limit 1;

  if r.status is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'status', r.status,
    'updatedAt', r.updated_at,
    'acknowledgementDueAt', r.acknowledgement_due_at
  );
end;
$$;

grant execute on function public.public_whistleblowing_status(uuid) to anon, authenticated;

-- Grant varslingsmottak to every org admin role (tighten per org in production via Admin UI)
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'whistleblowing.committee'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- Touch updated_at on case updates
drop trigger if exists whistleblowing_cases_set_updated_at on public.whistleblowing_cases;
create trigger whistleblowing_cases_set_updated_at
  before update on public.whistleblowing_cases
  for each row execute function public.set_updated_at();
