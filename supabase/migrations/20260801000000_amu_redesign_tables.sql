-- AMU redesign — additive tables (committees, members, attendance, proposals, annual reports)
-- and extensions to amu_meetings. Audit uses public.hse_audit_trigger (project standard).

-- ── 1. Committees (before members / meeting FKs) ───────────────────────────
create table if not exists public.amu_committees (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  name                  text not null,
  term_start            date not null,
  term_end              date not null,
  chair_side            text not null check (chair_side in ('employer', 'employee')),
  min_meetings_per_year int not null default 4,
  bht_provider          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id)
);

create index if not exists amu_committees_org_idx
  on public.amu_committees (organization_id);

drop trigger if exists amu_committees_set_updated_at on public.amu_committees;
create trigger amu_committees_set_updated_at
  before update on public.amu_committees
  for each row execute function public.set_updated_at();

alter table public.amu_committees enable row level security;

drop policy if exists amu_committees_select on public.amu_committees;
create policy amu_committees_select on public.amu_committees
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_committees_insert on public.amu_committees;
create policy amu_committees_insert on public.amu_committees
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists amu_committees_update on public.amu_committees;
create policy amu_committees_update on public.amu_committees
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists amu_committees_delete on public.amu_committees;
create policy amu_committees_delete on public.amu_committees
  for delete to authenticated
  using (organization_id = public.current_org_id());

create or replace function public.amu_committees_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists amu_committees_before_insert_tg on public.amu_committees;
create trigger amu_committees_before_insert_tg
  before insert on public.amu_committees
  for each row execute function public.amu_committees_before_insert();

drop trigger if exists amu_committees_audit_tg on public.amu_committees;
create trigger amu_committees_audit_tg
  after insert or update or delete on public.amu_committees
  for each row execute function public.hse_audit_trigger();

grant select, insert, update, delete on public.amu_committees to authenticated;

-- ── 2. Members ─────────────────────────────────────────────────────────────
create table if not exists public.amu_members (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  committee_id             uuid not null references public.amu_committees (id) on delete cascade,
  user_id                  uuid references auth.users (id),
  display_name             text not null,
  side                     text not null check (side in ('employer', 'employee', 'bht')),
  role                     text not null check (role in ('leader', 'deputy_leader', 'member', 'bht_observer')),
  function_label           text,
  voting                   boolean not null default true,
  hms_training_valid_until date,
  term_start               date not null,
  term_end                 date not null,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references auth.users (id)
);

create index if not exists amu_members_org_idx on public.amu_members (organization_id);
create index if not exists amu_members_committee_idx on public.amu_members (committee_id);

drop trigger if exists amu_members_set_updated_at on public.amu_members;
create trigger amu_members_set_updated_at
  before update on public.amu_members
  for each row execute function public.set_updated_at();

alter table public.amu_members enable row level security;

drop policy if exists amu_members_select on public.amu_members;
create policy amu_members_select on public.amu_members
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_members_insert on public.amu_members;
create policy amu_members_insert on public.amu_members
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists amu_members_update on public.amu_members;
create policy amu_members_update on public.amu_members
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists amu_members_delete on public.amu_members;
create policy amu_members_delete on public.amu_members
  for delete to authenticated
  using (organization_id = public.current_org_id());

create or replace function public.amu_members_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org
  from public.amu_committees c
  where c.id = new.committee_id;
  if v_org is null then
    raise exception 'amu_members: committee not found';
  end if;
  if new.organization_id is null then
    new.organization_id := coalesce(public.current_org_id(), v_org);
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_members: organization_id does not match committee';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_members_before_insert_tg on public.amu_members;
create trigger amu_members_before_insert_tg
  before insert on public.amu_members
  for each row execute function public.amu_members_before_insert();

drop trigger if exists amu_members_audit_tg on public.amu_members;
create trigger amu_members_audit_tg
  after insert or update or delete on public.amu_members
  for each row execute function public.hse_audit_trigger();

grant select, insert, update, delete on public.amu_members to authenticated;

-- ── 3. Extend amu_meetings ─────────────────────────────────────────────────
alter table public.amu_meetings
  add column if not exists scheduled_at timestamptz;

update public.amu_meetings
set scheduled_at = meeting_date::timestamp at time zone 'Europe/Oslo'
where scheduled_at is null;

alter table public.amu_meetings
  add column if not exists committee_id uuid references public.amu_committees (id),
  add column if not exists sequence_no int,
  add column if not exists is_hybrid boolean not null default false,
  add column if not exists signed_by_leader uuid references public.amu_members (id),
  add column if not exists signed_by_deputy uuid references public.amu_members (id),
  add column if not exists completed_at timestamptz,
  add column if not exists signed_at timestamptz;

-- Generated year from scheduled_at (one column; not separate from scheduled_at)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'amu_meetings' and column_name = 'year'
  ) then
    alter table public.amu_meetings
      add column year int generated always as (extract(year from scheduled_at)::int) stored;
  end if;
end $$;

-- Map legacy status values before new check constraint
update public.amu_meetings set status = 'in_progress' where status = 'active';

alter table public.amu_meetings
  drop constraint if exists amu_meetings_status_check;

alter table public.amu_meetings
  add constraint amu_meetings_status_check
  check (status in ('draft', 'scheduled', 'in_progress', 'completed', 'signed', 'archived'));

-- Align signed meetings with signed_at when missing
update public.amu_meetings
set signed_at = coalesce(signed_at, chair_signed_at, updated_at)
where status = 'signed' and signed_at is null;

-- Immutability: block updates when signed/archived (policies below)

-- ── 4. Agenda items: status for redesign views ─────────────────────────────
alter table public.amu_agenda_items
  add column if not exists status text not null default 'pending';

alter table public.amu_agenda_items
  drop constraint if exists amu_agenda_items_status_check;

alter table public.amu_agenda_items
  add constraint amu_agenda_items_status_check
  check (status in ('pending', 'active', 'decided', 'deferred'));

-- ── 5. Attendance ───────────────────────────────────────────────────────────
create table if not exists public.amu_attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id      uuid not null references public.amu_meetings (id) on delete cascade,
  member_id       uuid not null references public.amu_members (id) on delete cascade,
  status          text not null default 'present'
    check (status in ('present', 'absent', 'excused', 'digital')),
  joined_at       timestamptz,
  unique (meeting_id, member_id)
);

create index if not exists amu_attendance_meeting_idx on public.amu_attendance (meeting_id);
create index if not exists amu_attendance_org_idx on public.amu_attendance (organization_id);

alter table public.amu_attendance enable row level security;

drop policy if exists amu_attendance_select on public.amu_attendance;
create policy amu_attendance_select on public.amu_attendance
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_attendance_insert on public.amu_attendance;
create policy amu_attendance_insert on public.amu_attendance
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists amu_attendance_update on public.amu_attendance;
create policy amu_attendance_update on public.amu_attendance
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.amu_meetings m
      where m.id = meeting_id
        and m.status not in ('signed', 'archived')
    )
  )
  with check (organization_id = public.current_org_id());

create or replace function public.amu_attendance_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select m.organization_id into v_org
  from public.amu_meetings m
  where m.id = new.meeting_id;
  if v_org is null then
    raise exception 'amu_attendance: meeting not found';
  end if;
  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_attendance: organization_id does not match meeting';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_attendance_before_insert_tg on public.amu_attendance;
create trigger amu_attendance_before_insert_tg
  before insert on public.amu_attendance
  for each row execute function public.amu_attendance_before_insert();

drop trigger if exists amu_attendance_audit_tg on public.amu_attendance;
create trigger amu_attendance_audit_tg
  after insert or update or delete on public.amu_attendance
  for each row execute function public.hse_audit_trigger();

grant select, insert, update on public.amu_attendance to authenticated;

-- ── 6. Topic proposals ───────────────────────────────────────────────────────
create table if not exists public.amu_topic_proposals (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  proposed_by       uuid references auth.users (id),
  target_meeting_id uuid references public.amu_meetings (id),
  description       text not null,
  status            text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'deferred')),
  created_at        timestamptz not null default now()
);

create index if not exists amu_topic_proposals_org_idx on public.amu_topic_proposals (organization_id);

alter table public.amu_topic_proposals enable row level security;

drop policy if exists amu_topic_proposals_select on public.amu_topic_proposals;
create policy amu_topic_proposals_select on public.amu_topic_proposals
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_topic_proposals_insert on public.amu_topic_proposals;
create policy amu_topic_proposals_insert on public.amu_topic_proposals
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists amu_topic_proposals_update on public.amu_topic_proposals;
create policy amu_topic_proposals_update on public.amu_topic_proposals
  for update to authenticated
  using (organization_id = public.current_org_id() and status = 'submitted')
  with check (organization_id = public.current_org_id());

create or replace function public.amu_topic_proposals_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists amu_topic_proposals_before_insert_tg on public.amu_topic_proposals;
create trigger amu_topic_proposals_before_insert_tg
  before insert on public.amu_topic_proposals
  for each row execute function public.amu_topic_proposals_before_insert();

drop trigger if exists amu_topic_proposals_audit_tg on public.amu_topic_proposals;
create trigger amu_topic_proposals_audit_tg
  after insert or update or delete on public.amu_topic_proposals
  for each row execute function public.hse_audit_trigger();

grant select, insert, update on public.amu_topic_proposals to authenticated;

-- ── 7. Annual reports ────────────────────────────────────────────────────────
create table if not exists public.amu_annual_reports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  committee_id     uuid not null references public.amu_committees (id),
  year             int not null,
  body             jsonb not null default '{}',
  status           text not null default 'draft'
    check (status in ('draft', 'signed', 'archived')),
  signed_by_leader uuid references public.amu_members (id),
  signed_by_deputy uuid references public.amu_members (id),
  signed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  unique (committee_id, year)
);

create index if not exists amu_annual_reports_org_idx on public.amu_annual_reports (organization_id);

drop trigger if exists amu_annual_reports_set_updated_at on public.amu_annual_reports;
create trigger amu_annual_reports_set_updated_at
  before update on public.amu_annual_reports
  for each row execute function public.set_updated_at();

alter table public.amu_annual_reports enable row level security;

drop policy if exists amu_annual_reports_select on public.amu_annual_reports;
create policy amu_annual_reports_select on public.amu_annual_reports
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_annual_reports_insert on public.amu_annual_reports;
create policy amu_annual_reports_insert on public.amu_annual_reports
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists amu_annual_reports_update on public.amu_annual_reports;
create policy amu_annual_reports_update on public.amu_annual_reports
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and status not in ('signed', 'archived')
  )
  with check (organization_id = public.current_org_id());

create or replace function public.amu_annual_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org
  from public.amu_committees c
  where c.id = new.committee_id;
  if v_org is null then
    raise exception 'amu_annual_reports: committee not found';
  end if;
  if new.organization_id is null then
    new.organization_id := coalesce(public.current_org_id(), v_org);
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_annual_reports: organization_id does not match committee';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_annual_reports_before_insert_tg on public.amu_annual_reports;
create trigger amu_annual_reports_before_insert_tg
  before insert on public.amu_annual_reports
  for each row execute function public.amu_annual_reports_before_insert();

drop trigger if exists amu_annual_reports_audit_tg on public.amu_annual_reports;
create trigger amu_annual_reports_audit_tg
  after insert or update or delete on public.amu_annual_reports
  for each row execute function public.hse_audit_trigger();

grant select, insert, update on public.amu_annual_reports to authenticated;

-- ── 8. amu_meetings: treat archived like signed for RLS / child tables ──────
create or replace function public.amu_meeting_is_signed(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.status in ('signed', 'archived')
      from public.amu_meetings m
      where m.id = p_meeting_id
    ),
    false
  );
$$;

drop policy if exists amu_meetings_update on public.amu_meetings;
create policy amu_meetings_update on public.amu_meetings
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and status not in ('signed', 'archived')
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_meetings_delete on public.amu_meetings;
create policy amu_meetings_delete on public.amu_meetings
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and status not in ('signed', 'archived')
  );
