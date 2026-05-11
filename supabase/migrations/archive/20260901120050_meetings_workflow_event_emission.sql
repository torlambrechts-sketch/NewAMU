-- Meetings — workflow event emission + module registration (G1 + G2).
--
-- Why
--   The TypeScript catalog `workflowTriggerRegistry.ts` declares
--   MEETINGS_WORKFLOW_TRIGGER_EVENTS (ON_MEETING_SCHEDULED,
--   ON_MEETING_SIGNED, ON_MEETING_DECISION_LOGGED). The UI lets admins
--   configure workflow rules against these events, but no Postgres
--   trigger emits them — so configured rules silently never fire.
--   This migration closes that gap by attaching AFTER triggers on
--   `meetings` + `meeting_decisions` that call the canonical
--   `workflow_dispatch_db_event(org_id, module, event, row)` RPC.
--
--   Companion: the `modules` table (per-org module registry that
--   workflow_rules.module_id FKs into) has no row for meetings. This
--   migration backfills one row per org and wires an on-org-insert
--   trigger so future orgs get it automatically.
--
-- Strategy
--   1. modules table: backfill + on-org-insert trigger.
--   2. Trigger on meetings AFTER INSERT — emit ON_MEETING_SCHEDULED.
--   3. Trigger on meetings AFTER UPDATE — emit ON_MEETING_SIGNED when
--      protocol_signed_at transitions null → not-null.
--   4. Trigger on meeting_decisions AFTER INSERT — emit
--      ON_MEETING_DECISION_LOGGED.
--   5. All triggers wrapped in BEGIN/EXCEPTION to ensure a failing
--      workflow dispatch never blocks the underlying write (defensive
--      pattern used by trg_amu_meetings_workflow / vernerunder etc.).
--
-- Idempotent: drop/create triggers; insert with on-conflict.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Register `meetings` module per org                                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Idempotent insert: one row per existing org.
insert into public.modules (organization_id, slug, display_name, is_active, required_permissions)
select o.id, 'meetings', 'Møter', true, '["module.view.meetings"]'::jsonb
from public.organizations o
where not exists (
  select 1 from public.modules m
  where m.organization_id = o.id and m.slug = 'meetings'
);

-- New-org trigger: auto-register the meetings module entry.
create or replace function public.meetings_register_module_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.modules (organization_id, slug, display_name, is_active, required_permissions)
  values (new.id, 'meetings', 'Møter', true, '["module.view.meetings"]'::jsonb)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists meetings_register_module_on_org_insert_tg on public.organizations;
create trigger meetings_register_module_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.meetings_register_module_on_org_insert();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Trigger: meetings AFTER INSERT → ON_MEETING_SCHEDULED                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.trg_meetings_on_insert_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'meetings',
      'ON_MEETING_SCHEDULED',
      jsonb_build_object(
        'id', new.id,
        'title', new.title,
        'status', new.status,
        'scheduled_at', new.scheduled_at,
        'system_template_id', new.system_template_id,
        'org_template_id', new.org_template_id,
        'confidentiality_level', new.confidentiality_level
      )
    );
  exception when others then
    -- Never block the underlying insert if workflow dispatch fails.
    raise notice 'meetings workflow ON_MEETING_SCHEDULED dispatch failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists meetings_workflow_on_insert_tg on public.meetings;
create trigger meetings_workflow_on_insert_tg
  after insert on public.meetings
  for each row execute function public.trg_meetings_on_insert_workflow();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Trigger: meetings AFTER UPDATE → ON_MEETING_SIGNED                    │
-- │    Fires only when protocol_signed_at transitions null → set.            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.trg_meetings_on_signed_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.protocol_signed_at is null) and (new.protocol_signed_at is not null) then
    begin
      perform public.workflow_dispatch_db_event(
        new.organization_id,
        'meetings',
        'ON_MEETING_SIGNED',
        jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'protocol_signed_at', new.protocol_signed_at,
          'protocol_signed_by', new.protocol_signed_by,
          'system_template_id', new.system_template_id,
          'org_template_id', new.org_template_id,
          'completed_at', new.completed_at
        )
      );
    exception when others then
      raise notice 'meetings workflow ON_MEETING_SIGNED dispatch failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_workflow_on_signed_tg on public.meetings;
create trigger meetings_workflow_on_signed_tg
  after update on public.meetings
  for each row execute function public.trg_meetings_on_signed_workflow();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Trigger: meeting_decisions AFTER INSERT → ON_MEETING_DECISION_LOGGED  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.trg_meeting_decisions_on_insert_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.meetings where id = new.meeting_id;
  if v_org_id is null then
    return new;
  end if;
  begin
    perform public.workflow_dispatch_db_event(
      v_org_id,
      'meetings',
      'ON_MEETING_DECISION_LOGGED',
      jsonb_build_object(
        'decision_id', new.id,
        'meeting_id', new.meeting_id,
        'agenda_item_id', new.agenda_item_id,
        'decision_text', new.decision_text,
        'status', new.status,
        'follow_up_task_id', new.follow_up_task_id
      )
    );
  exception when others then
    raise notice 'meetings workflow ON_MEETING_DECISION_LOGGED dispatch failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists meeting_decisions_workflow_on_insert_tg on public.meeting_decisions;
create trigger meeting_decisions_workflow_on_insert_tg
  after insert on public.meeting_decisions
  for each row execute function public.trg_meeting_decisions_on_insert_workflow();

-- Verification:
-- expected: 2 meetings module rows (one per org)
-- select organization_id, slug from public.modules where slug = 'meetings' order by organization_id;
--
-- expected: 3 triggers on the meetings + meeting_decisions tables
-- select tgname from pg_trigger where tgname like '%workflow%' order by tgname;
