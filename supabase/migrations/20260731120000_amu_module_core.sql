-- AMU (arbeidsmiljøutvalg) — kjerne tabeller, RLS, org-triggere og revisjonslogg for møter.
-- Personvern: aggregerte tellere for varsling/sykefravær eksponeres via SECURITY DEFINER-RPC (ingen PII).

-- ── 1. Hovedtabell: møter ────────────────────────────────────────────────────
create table if not exists public.amu_meetings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  meeting_date    date not null,
  location        text not null default '',
  status          text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'completed', 'signed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists amu_meetings_org_date_idx
  on public.amu_meetings (organization_id, meeting_date desc);

drop trigger if exists amu_meetings_set_updated_at on public.amu_meetings;
create trigger amu_meetings_set_updated_at
  before update on public.amu_meetings
  for each row execute function public.set_updated_at();

-- ── 2. Deltakere (én rad per bruker per møte) ───────────────────────────────
create table if not exists public.amu_participants (
  meeting_id      uuid not null references public.amu_meetings (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            text not null
    check (role in ('employer_rep', 'employee_rep', 'safety_deputy', 'bht', 'secretary')),
  present         boolean not null default false,
  signed_at       timestamptz,
  primary key (meeting_id, user_id)
);

create index if not exists amu_participants_org_idx
  on public.amu_participants (organization_id);

-- ── 3. Agendapunkter (polymorf kilde: source_module + source_id) ────────────
create table if not exists public.amu_agenda_items (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.amu_meetings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  description     text not null default '',
  order_index     int not null default 0,
  source_module   text,
  source_id       uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists amu_agenda_items_meeting_order_idx
  on public.amu_agenda_items (meeting_id, order_index);

-- ── 4. Vedtak ───────────────────────────────────────────────────────────────
create table if not exists public.amu_decisions (
  id                  uuid primary key default gen_random_uuid(),
  agenda_item_id      uuid not null references public.amu_agenda_items (id) on delete cascade,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  decision_text       text not null,
  action_plan_item_id uuid references public.action_plan_items (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists amu_decisions_agenda_idx
  on public.amu_decisions (agenda_item_id);

-- ── 5. BEFORE INSERT: fyll organization_id ─────────────────────────────────
create or replace function public.amu_meetings_before_insert()
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

drop trigger if exists amu_meetings_before_insert_tg on public.amu_meetings;
create trigger amu_meetings_before_insert_tg
  before insert on public.amu_meetings
  for each row execute function public.amu_meetings_before_insert();

create or replace function public.amu_participants_before_insert()
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
    raise exception 'amu_participants: meeting not found';
  end if;
  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_participants: organization_id does not match meeting';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_participants_before_insert_tg on public.amu_participants;
create trigger amu_participants_before_insert_tg
  before insert on public.amu_participants
  for each row execute function public.amu_participants_before_insert();

create or replace function public.amu_agenda_items_before_insert()
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
    raise exception 'amu_agenda_items: meeting not found';
  end if;
  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_agenda_items: organization_id does not match meeting';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_agenda_items_before_insert_tg on public.amu_agenda_items;
create trigger amu_agenda_items_before_insert_tg
  before insert on public.amu_agenda_items
  for each row execute function public.amu_agenda_items_before_insert();

create or replace function public.amu_decisions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select i.organization_id into v_org
  from public.amu_agenda_items i
  where i.id = new.agenda_item_id;
  if v_org is null then
    raise exception 'amu_decisions: agenda item not found';
  end if;
  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id is distinct from v_org then
    raise exception 'amu_decisions: organization_id does not match agenda item';
  end if;
  return new;
end;
$$;

drop trigger if exists amu_decisions_before_insert_tg on public.amu_decisions;
create trigger amu_decisions_before_insert_tg
  before insert on public.amu_decisions
  for each row execute function public.amu_decisions_before_insert();

drop trigger if exists amu_agenda_items_set_updated_at on public.amu_agenda_items;
create trigger amu_agenda_items_set_updated_at
  before update on public.amu_agenda_items
  for each row execute function public.set_updated_at();

drop trigger if exists amu_decisions_set_updated_at on public.amu_decisions;
create trigger amu_decisions_set_updated_at
  before update on public.amu_decisions
  for each row execute function public.set_updated_at();

-- Revisjonsspor (append-only hse_audit_log) — kun møteregisteret
drop trigger if exists amu_meetings_audit_tg on public.amu_meetings;
create trigger amu_meetings_audit_tg
  after insert or update or delete on public.amu_meetings
  for each row execute function public.hse_audit_trigger();

-- ── 6. Hjelpefunksjoner: møte låst (signert) ─────────────────────────────────
create or replace function public.amu_meeting_is_signed(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.status = 'signed' from public.amu_meetings m where m.id = p_meeting_id),
    false
  );
$$;

-- ── 7. Personvern: aggregater for AMU-agenda (ingen PII) ─────────────────────
create or replace function public.amu_privacy_whistleblowing_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_open bigint;
  v_closed bigint;
begin
  if v_org is null then
    return jsonb_build_object('open', 0, 'closed', 0, 'error', 'no_org');
  end if;
  if to_regclass('public.whistleblowing_cases') is null then
    return jsonb_build_object('open', 0, 'closed', 0);
  end if;
  execute $q$
    select
      count(*) filter (where c.status is distinct from 'closed'),
      count(*) filter (where c.status = 'closed')
    from public.whistleblowing_cases c
    where c.organization_id = $1
  $q$ into v_open, v_closed using v_org;
  return jsonb_build_object(
    'open', v_open,
    'closed', v_closed
  );
end;
$$;

create or replace function public.amu_privacy_sick_leave_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_payload jsonb;
  v_active bigint := 0;
  v_partial bigint := 0;
  v_other bigint := 0;
  elem jsonb;
begin
  if v_org is null then
    return jsonb_build_object('active', 0, 'partial', 0, 'other', 0, 'error', 'no_org');
  end if;
  select p.payload into v_payload
  from public.org_module_payloads p
  where p.organization_id = v_org
    and p.module_key = 'hse'
  limit 1;
  if v_payload is null then
    return jsonb_build_object('active', 0, 'partial', 0, 'other', 0);
  end if;
  for elem in select * from jsonb_array_elements(coalesce(v_payload->'sickLeaveCases', '[]'::jsonb))
  loop
    if (elem->>'status') in ('active') then
      v_active := v_active + 1;
    elsif (elem->>'status') in ('partial') then
      v_partial := v_partial + 1;
    else
      v_other := v_other + 1;
    end if;
  end loop;
  return jsonb_build_object('active', v_active, 'partial', v_partial, 'other', v_other);
end;
$$;

grant execute on function public.amu_privacy_whistleblowing_stats() to authenticated;
grant execute on function public.amu_privacy_sick_leave_stats() to authenticated;
grant execute on function public.amu_meeting_is_signed(uuid) to authenticated;

-- ── 8. RLS: alle tabeller, isolasjon på organization_id ────────────────────
alter table public.amu_meetings enable row level security;
alter table public.amu_participants enable row level security;
alter table public.amu_agenda_items enable row level security;
alter table public.amu_decisions enable row level security;

-- Les: alle innloggede i org
drop policy if exists amu_meetings_select on public.amu_meetings;
create policy amu_meetings_select on public.amu_meetings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_participants_select on public.amu_participants;
create policy amu_participants_select on public.amu_participants
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_agenda_items_select on public.amu_agenda_items;
create policy amu_agenda_items_select on public.amu_agenda_items
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_decisions_select on public.amu_decisions;
create policy amu_decisions_select on public.amu_decisions
  for select to authenticated
  using (organization_id = public.current_org_id());

-- Skriv: administrator eller amu.manage; ikke endre signert møte (hovedregister)
drop policy if exists amu_meetings_insert on public.amu_meetings;
create policy amu_meetings_insert on public.amu_meetings
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('amu.manage')
    )
  );

drop policy if exists amu_meetings_update on public.amu_meetings;
create policy amu_meetings_update on public.amu_meetings
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and status is distinct from 'signed'
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_meetings_delete on public.amu_meetings;
create policy amu_meetings_delete on public.amu_meetings
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and status is distinct from 'signed'
  );

-- Deltakere: stopp når møte er signert
drop policy if exists amu_participants_insert on public.amu_participants;
create policy amu_participants_insert on public.amu_participants
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  );

drop policy if exists amu_participants_update on public.amu_participants;
create policy amu_participants_update on public.amu_participants
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_participants_delete on public.amu_participants;
create policy amu_participants_delete on public.amu_participants
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  );

-- Agendapunkter / vedtak: stopp når møte er signert
drop policy if exists amu_agenda_items_insert on public.amu_agenda_items;
create policy amu_agenda_items_insert on public.amu_agenda_items
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  );

drop policy if exists amu_agenda_items_update on public.amu_agenda_items;
create policy amu_agenda_items_update on public.amu_agenda_items
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_agenda_items_delete on public.amu_agenda_items;
create policy amu_agenda_items_delete on public.amu_agenda_items
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(meeting_id)
  );

drop policy if exists amu_decisions_insert on public.amu_decisions;
create policy amu_decisions_insert on public.amu_decisions
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(
      (select i.meeting_id from public.amu_agenda_items i where i.id = agenda_item_id)
    )
  );

drop policy if exists amu_decisions_update on public.amu_decisions;
create policy amu_decisions_update on public.amu_decisions
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(
      (select i.meeting_id from public.amu_agenda_items i where i.id = agenda_item_id)
    )
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_decisions_delete on public.amu_decisions;
create policy amu_decisions_delete on public.amu_decisions
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
    and not public.amu_meeting_is_signed(
      (select i.meeting_id from public.amu_agenda_items i where i.id = agenda_item_id)
    )
  );

grant select, insert, update, delete on public.amu_meetings to authenticated;
grant select, insert, update, delete on public.amu_participants to authenticated;
grant select, insert, update, delete on public.amu_agenda_items to authenticated;
grant select, insert, update, delete on public.amu_decisions to authenticated;
