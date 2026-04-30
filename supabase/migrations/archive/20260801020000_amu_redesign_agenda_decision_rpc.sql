-- Align legacy amu_agenda_items / amu_decisions with redesign column names + stub RPCs for the hook.

-- Agenda: redesign columns (keep order_index / description / source_module / source_id for compat)
alter table public.amu_agenda_items
  add column if not exists position int;

update public.amu_agenda_items set position = order_index where position is null;

alter table public.amu_agenda_items
  alter column position set default 0;

alter table public.amu_agenda_items
  add column if not exists source_type text,
  add column if not exists source_ref_id uuid,
  add column if not exists legal_ref text,
  add column if not exists presenter_id uuid references public.amu_members (id),
  add column if not exists notes text;

update public.amu_agenda_items ai
set source_type = case
  when ai.source_module is null or trim(ai.source_module) = '' then 'manual'
  when ai.source_module = 'avvik' then 'auto_deviation'
  else 'manual'
end
where ai.source_type is null;

update public.amu_agenda_items
set source_ref_id = coalesce(source_ref_id, source_id)
where source_ref_id is null and source_id is not null;

update public.amu_agenda_items
set notes = coalesce(notes, description)
where notes is null;

alter table public.amu_agenda_items
  alter column source_type set not null;

alter table public.amu_agenda_items
  drop constraint if exists amu_agenda_items_source_type_check;

alter table public.amu_agenda_items
  add constraint amu_agenda_items_source_type_check
  check (source_type in (
    'standard', 'auto_deviation', 'auto_sick_leave', 'auto_whistleblowing',
    'auto_inspection', 'auto_hms_plan', 'manual', 'employee_proposal'
  ));

-- Decisions: redesign numeric / FK columns
alter table public.amu_decisions
  add column if not exists votes_for int not null default 0,
  add column if not exists votes_against int not null default 0,
  add column if not exists votes_abstained int not null default 0,
  add column if not exists responsible_member_id uuid references public.amu_members (id),
  add column if not exists due_date date,
  add column if not exists linked_action_id uuid;

update public.amu_decisions
set linked_action_id = coalesce(linked_action_id, action_plan_item_id)
where linked_action_id is null and action_plan_item_id is not null;

-- ── RPC: populate agenda from org default template (idempotent if rows exist) ─
create or replace function public.amu_generate_auto_agenda(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_meeting record;
  v_cnt int;
begin
  select * into v_meeting from public.amu_meetings m where m.id = p_meeting_id;
  if v_meeting.id is null then
    raise exception 'amu_generate_auto_agenda: meeting not found';
  end if;
  v_org := v_meeting.organization_id;
  if v_org is distinct from public.current_org_id() then
    raise exception 'amu_generate_auto_agenda: org mismatch';
  end if;

  select count(*)::int into v_cnt from public.amu_agenda_items i where i.meeting_id = p_meeting_id;
  if v_cnt > 0 then
    return;
  end if;

  insert into public.amu_agenda_items (
    meeting_id, organization_id, title, description, order_index, position,
    source_module, source_id, source_type, source_ref_id, legal_ref, presenter_id, notes, status
  )
  select
    p_meeting_id,
    v_org,
    d.title,
    d.description,
    d.order_index,
    d.order_index,
    d.source_module,
    d.source_id,
    case
      when d.source_module is null or btrim(d.source_module) = '' then 'manual'
      when d.source_module = 'avvik' then 'auto_deviation'
      else 'manual'
    end,
    d.source_id,
    null,
    null,
    d.description,
    'pending'
  from public.amu_default_agenda_items d
  where d.organization_id = v_org
  order by d.order_index, d.title;
end;
$$;

grant execute on function public.amu_generate_auto_agenda(uuid) to authenticated;

-- ── RPC: ensure annual report row exists for current committee + year ─────────
create or replace function public.amu_draft_annual_report(p_organization_id uuid, p_year int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid uuid;
  v_id uuid;
begin
  if p_organization_id is distinct from public.current_org_id() then
    raise exception 'amu_draft_annual_report: org mismatch';
  end if;

  select c.id into v_cid
  from public.amu_committees c
  where c.organization_id = p_organization_id
  order by c.created_at asc
  limit 1;

  if v_cid is null then
    raise exception 'amu_draft_annual_report: no committee';
  end if;

  insert into public.amu_annual_reports (organization_id, committee_id, year, body, status)
  values (p_organization_id, v_cid, p_year, '{}'::jsonb, 'draft')
  on conflict (committee_id, year) do nothing
  returning id into v_id;

  if v_id is null then
    select ar.id into v_id
    from public.amu_annual_reports ar
    where ar.committee_id = v_cid and ar.year = p_year;
  end if;

  return v_id;
end;
$$;

grant execute on function public.amu_draft_annual_report(uuid, int) to authenticated;
