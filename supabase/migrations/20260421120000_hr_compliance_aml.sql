-- HR compliance: AML § 15-1 drøftelse, Kap. 8 informasjon/drøfting, O-ROS signoff tracking.
-- RLS: strict separation — verneombud/AMU must not see §15-1 rows unless explicitly participant.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profile flags for RLS (union rep, verneombud for HR gates)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists hr_metadata jsonb not null default '{}'::jsonb;

comment on column public.profiles.hr_metadata is 'JSON flags e.g. {"union_rep": true, "verneombud": true} for RLS.';

create or replace function public.hr_profile_flag(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (hr_metadata ->> p_key)::boolean from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.hr_can_manage_discussion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin() or public.user_has_permission('hr.discussion.manage');
$$;

create or replace function public.hr_can_manage_consultation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin() or public.user_has_permission('hr.consultation.manage');
$$;

-- ---------------------------------------------------------------------------
-- AML § 15-1 — Drøftelsessamtale (referat uten oppsigelseskonklusjon)
-- ---------------------------------------------------------------------------

create table if not exists public.hr_discussion_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  manager_user_id uuid not null references auth.users (id) on delete set null,
  union_rep_user_id uuid references auth.users (id) on delete set null,
  union_rep_invited boolean not null default false,
  informed_union_accompaniment_right boolean not null default false,
  union_rep_present boolean not null default false,
  checklist_completed boolean not null default false,
  summary_text text not null default '',
  status text not null default 'draft' check (status in ('draft', 'pending_signatures', 'locked')),
  manager_signed_at timestamptz,
  employee_signed_at timestamptz,
  union_rep_signed_at timestamptz,
  content_sha256 text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_discussion_org_idx on public.hr_discussion_meetings (organization_id);
create index if not exists hr_discussion_emp_idx on public.hr_discussion_meetings (employee_user_id);
create index if not exists hr_discussion_mgr_idx on public.hr_discussion_meetings (manager_user_id);

drop trigger if exists hr_discussion_set_updated_at on public.hr_discussion_meetings;
create trigger hr_discussion_set_updated_at
  before update on public.hr_discussion_meetings
  for each row execute function public.set_updated_at();

alter table public.hr_discussion_meetings enable row level security;

-- Participants + org admins + HR role — NOT general verneombud
create policy "hr_discussion_select_participants"
  on public.hr_discussion_meetings for select
  using (
    organization_id = public.current_org_id()
    and (
      employee_user_id = auth.uid()
      or manager_user_id = auth.uid()
      or (union_rep_invited and union_rep_user_id = auth.uid())
      or public.hr_can_manage_discussion()
    )
  );

create policy "hr_discussion_insert_manage"
  on public.hr_discussion_meetings for insert
  with check (
    organization_id = public.current_org_id()
    and public.hr_can_manage_discussion()
  );

create policy "hr_discussion_update_manage"
  on public.hr_discussion_meetings for update
  using (
    organization_id = public.current_org_id()
    and status <> 'locked'
    and public.hr_can_manage_discussion()
  );

create policy "hr_discussion_update_manager"
  on public.hr_discussion_meetings for update
  using (
    organization_id = public.current_org_id()
    and status <> 'locked'
    and manager_user_id = auth.uid()
  );

-- Employee / union rep can update draft fields until locked (signatures via dedicated RPC anbefales i produksjon)
create policy "hr_discussion_update_self_sign"
  on public.hr_discussion_meetings for update
  using (
    organization_id = public.current_org_id()
    and status <> 'locked'
    and employee_user_id = auth.uid()
  );

create policy "hr_discussion_update_union"
  on public.hr_discussion_meetings for update
  using (
    organization_id = public.current_org_id()
    and status <> 'locked'
    and union_rep_invited
    and union_rep_user_id = auth.uid()
  );

-- Lock row + content hash (tidsstempel bevis — utvid med ekstern TSA senere)
create or replace function public.hr_discussion_apply_lock(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.hr_discussion_meetings%rowtype;
  payload text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.hr_discussion_meetings where id = p_meeting_id for update;
  if r.id is null then
    raise exception 'Not found';
  end if;
  if r.organization_id <> public.current_org_id() then
    raise exception 'Not allowed';
  end if;
  if r.status = 'locked' then
    return;
  end if;
  if r.manager_signed_at is null or r.employee_signed_at is null then
    raise exception 'Signatures required before lock';
  end if;
  payload := concat_ws('|',
    r.id::text,
    r.organization_id::text,
    coalesce(r.summary_text, ''),
    r.manager_signed_at::text,
    r.employee_signed_at::text,
    coalesce(r.union_rep_signed_at::text, '')
  );
  update public.hr_discussion_meetings
  set
    status = 'locked',
    content_sha256 = encode(digest(convert_to(payload, 'UTF8'), 'sha256'), 'hex'),
    locked_at = now()
  where id = p_meeting_id;
end;
$$;

grant execute on function public.hr_discussion_apply_lock(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- AML Kap. 8 — informasjon og drøfting (50+)
-- ---------------------------------------------------------------------------

create table if not exists public.hr_consultation_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references auth.users (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_consultation_participants (
  case_id uuid not null references public.hr_consultation_cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'union_rep' check (role in ('union_rep', 'observer', 'management')),
  invited_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table if not exists public.hr_consultation_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.hr_consultation_cases (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists hr_consultation_org_idx on public.hr_consultation_cases (organization_id);
create index if not exists hr_consultation_comments_case_idx on public.hr_consultation_comments (case_id);

drop trigger if exists hr_consultation_set_updated_at on public.hr_consultation_cases;
create trigger hr_consultation_set_updated_at
  before update on public.hr_consultation_cases
  for each row execute function public.set_updated_at();

alter table public.hr_consultation_cases enable row level security;
alter table public.hr_consultation_participants enable row level security;
alter table public.hr_consultation_comments enable row level security;

create policy "hr_consultation_case_select"
  on public.hr_consultation_cases for select
  using (
    organization_id = public.current_org_id()
    and (
      public.hr_can_manage_consultation()
      or exists (
        select 1 from public.hr_consultation_participants p
        where p.case_id = hr_consultation_cases.id and p.user_id = auth.uid()
      )
    )
  );

create policy "hr_consultation_case_write"
  on public.hr_consultation_cases for all
  using (organization_id = public.current_org_id() and public.hr_can_manage_consultation())
  with check (organization_id = public.current_org_id() and public.hr_can_manage_consultation());

create policy "hr_consultation_part_select"
  on public.hr_consultation_participants for select
  using (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_participants.case_id
        and c.organization_id = public.current_org_id()
        and (
          public.hr_can_manage_consultation()
          or exists (select 1 from public.hr_consultation_participants p2 where p2.case_id = c.id and p2.user_id = auth.uid())
        )
    )
  );

create policy "hr_consultation_part_write"
  on public.hr_consultation_participants for all
  using (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_participants.case_id
        and c.organization_id = public.current_org_id()
        and public.hr_can_manage_consultation()
    )
  )
  with check (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_participants.case_id
        and c.organization_id = public.current_org_id()
        and public.hr_can_manage_consultation()
    )
  );

create policy "hr_consultation_comment_select"
  on public.hr_consultation_comments for select
  using (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_comments.case_id
        and c.organization_id = public.current_org_id()
        and (
          public.hr_can_manage_consultation()
          or exists (select 1 from public.hr_consultation_participants p where p.case_id = c.id and p.user_id = auth.uid())
        )
    )
  );

create policy "hr_consultation_comment_insert"
  on public.hr_consultation_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_comments.case_id
        and c.organization_id = public.current_org_id()
        and (
          public.hr_can_manage_consultation()
          or exists (select 1 from public.hr_consultation_participants p where p.case_id = c.id and p.user_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- O-ROS — AMU/VO signoff on organisatorisk ROS (references JSON id in internal_control payload)
-- ---------------------------------------------------------------------------

create table if not exists public.hr_ros_org_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ros_assessment_id text not null,
  category text not null default 'organizational_change' check (category in ('organizational_change')),
  requires_amu_signoff boolean not null default true,
  amu_representative_user_id uuid references auth.users (id) on delete set null,
  amu_signed_at timestamptz,
  verneombud_user_id uuid references auth.users (id) on delete set null,
  verneombud_signed_at timestamptz,
  blocked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, ros_assessment_id)
);

create index if not exists hr_ros_org_org_idx on public.hr_ros_org_signoffs (organization_id);

drop trigger if exists hr_ros_org_set_updated_at on public.hr_ros_org_signoffs;
create trigger hr_ros_org_set_updated_at
  before update on public.hr_ros_org_signoffs
  for each row execute function public.set_updated_at();

alter table public.hr_ros_org_signoffs enable row level security;

create policy "hr_ros_org_select"
  on public.hr_ros_org_signoffs for select
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('hr.o_ros.view')
      or public.user_has_permission('hr.o_ros.sign')
      or amu_representative_user_id = auth.uid()
      or verneombud_user_id = auth.uid()
    )
  );

create policy "hr_ros_org_write_manage"
  on public.hr_ros_org_signoffs for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('hr.o_ros.manage'))
  );

create policy "hr_ros_org_update_signers"
  on public.hr_ros_org_signoffs for update
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('hr.o_ros.manage')
      or (amu_representative_user_id = auth.uid() and public.user_has_permission('hr.o_ros.sign'))
      or (verneombud_user_id = auth.uid() and public.user_has_permission('hr.o_ros.sign'))
    )
  );

-- ---------------------------------------------------------------------------
-- Permission keys (attach to admin; narrow keys for union/vo later via Admin UI)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, k
from public.role_definitions rd
cross join (
  values
    ('module.view.hr_compliance'),
    ('hr.discussion.manage'),
    ('hr.consultation.manage'),
    ('hr.o_ros.manage'),
    ('hr.o_ros.view'),
    ('hr.o_ros.sign')
) as v(k)
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, k
from public.role_definitions rd
cross join (values ('module.view.hr_compliance')) as v(k)
where rd.slug = 'member'
on conflict (role_id, permission_key) do nothing;
