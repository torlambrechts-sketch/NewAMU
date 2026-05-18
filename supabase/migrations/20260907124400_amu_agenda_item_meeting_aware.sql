-- add_amu_agenda_item — route to meeting_agenda_items + backlog drain.
--
-- archive/_20260829120011 wired the handler to insert into the legacy
-- public.amu_agenda_items table, which was DROPPED in
-- archive/_20260901120020_drop_legacy_amu_council_tables. The existence
-- guard makes the call silently no-op; P2 then seeded 7 catalog rules
-- that call this action — all currently dropped on the floor.
--
-- Fix: re-issue execute_workflow_action so add_amu_agenda_item:
--   1. Resolves the next upcoming meeting matching the action's
--      meetingType / meetingTypeSlug (system_template_id-anchored).
--   2. Inserts into meeting_agenda_items when a meeting is found.
--   3. Otherwise stamps an amu_agenda_backlog row (new table here)
--      that a trigger drains into agenda items when a matching
--      meeting is created.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 7-2 (AMU årlig rapporteringsplikt
--   + saksbehandling), § 6-2 (verneombudets rolle i AMU-sak), IK-f § 5
--   nr. 7 (sporbar sakshåndtering). Det er pålegg-grunn at en alvorlig
--   hendelse-rapport "forsvinner" mellom hendelsen og første AMU-møte.
--   Restrisiko deferred: vi resolver bare første kommende møte uten
--   sjekk på status — hvis et møte er 'cancelled' burde vi hoppe
--   videre. Forenkles til v0.2 når status-livssyklus settes.
--
-- Hele migrasjonen er gated på meetings-tabellen — på et fresh DB hvor
-- RUN_MEETINGS_MODULE.sql ikke er kjørt enda emittes en NOTICE og
-- migrasjonen exit'er rent.

set local search_path = public, pg_catalog;

do $outer$
begin

if to_regclass('public.meetings') is null
   or to_regclass('public.meeting_agenda_items') is null
then
  raise notice 'amu_agenda_item_meeting_aware: meetings module not yet applied — skipping. Run RUN_MEETINGS_MODULE.sql first, then re-run this migration.';
  return;
end if;

-- ── 1. amu_agenda_backlog — drained when matching meetings are created ──
create table if not exists public.amu_agenda_backlog (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- meeting-type discriminator: matches meetings.system_template_id when
  -- system-templated, or a free-form slug ('amu','amu-arsmote') that the
  -- catalog rules emit. Drainer matches in priority order.
  meeting_type    text not null default 'amu',
  title           text not null,
  description     text,
  source_module   text,
  source_id       text,
  priority        text not null default 'normal'
                    check (priority in ('low','normal','high','critical')),
  drained_at      timestamptz,
  drained_into    uuid references public.meeting_agenda_items(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists amu_agenda_backlog_pending_idx
  on public.amu_agenda_backlog (organization_id, meeting_type)
  where drained_at is null;

comment on table public.amu_agenda_backlog is
  'Pending AMU-agenda items queued when add_amu_agenda_item fires but no upcoming meeting matches. Drained into meeting_agenda_items by trigger when a meeting of the matching type is created. Org-scoped RLS.';

alter table public.amu_agenda_backlog enable row level security;

drop policy if exists amu_agenda_backlog_select on public.amu_agenda_backlog;
create policy amu_agenda_backlog_select
  on public.amu_agenda_backlog
  for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_agenda_backlog_write_admin on public.amu_agenda_backlog;
create policy amu_agenda_backlog_write_admin
  on public.amu_agenda_backlog
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('meetings.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('meetings.manage'))
  );

-- ── 2. Drain trigger: when a meeting is created, drain matching backlog ─
create or replace function public.trg_amu_agenda_backlog_drain()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inserted_id uuid;
  v_pos         int;
  r record;
begin
  -- Look at planned/in-progress only; cancelled meetings don't drain.
  if new.status not in ('planned','in_progress') then
    return new;
  end if;

  -- Pick the position counter once; future drained items append.
  select coalesce(max(position), -1) + 1 into v_pos
    from public.meeting_agenda_items
   where meeting_id = new.id;

  for r in
    select b.*
      from public.amu_agenda_backlog b
     where b.organization_id = new.organization_id
       and b.drained_at is null
       -- Match meeting_type against either the system_template_id (slug)
       -- or a literal 'amu' fallback for legacy template-less meetings.
       and (
         b.meeting_type = coalesce(new.system_template_id, '__none__')
         or (b.meeting_type = 'amu'
             and (
               new.system_template_id ilike 'amu%'
               or new.title ilike 'AMU%'
             )
         )
       )
     order by case b.priority
                when 'critical' then 0
                when 'high'     then 1
                when 'normal'   then 2
                else 3
              end,
              b.created_at asc
  loop
    insert into public.meeting_agenda_items (
      meeting_id, position, title, description, is_mandatory
    ) values (
      new.id, v_pos, r.title, r.description, false
    )
    returning id into v_inserted_id;

    update public.amu_agenda_backlog
       set drained_at  = now(),
           drained_into = v_inserted_id
     where id = r.id;

    v_pos := v_pos + 1;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists amu_agenda_backlog_drain on public.meetings;
create trigger amu_agenda_backlog_drain
  after insert on public.meetings
  for each row execute function public.trg_amu_agenda_backlog_drain();

-- Trigger-only SECURITY DEFINER func — revoke EXECUTE so direct calls
-- from authenticated/anon are denied. The trigger system still invokes
-- it as the function owner when meetings is inserted.
revoke execute on function public.trg_amu_agenda_backlog_drain() from public, anon, authenticated;

comment on function public.trg_amu_agenda_backlog_drain() is
  'On meeting insert (status planned/in_progress), drain matching amu_agenda_backlog rows into meeting_agenda_items, ordered by priority then FIFO. Idempotent via drained_at marker.';

-- ── 3. Re-issue execute_workflow_action with meeting-aware branch ───────
-- Only the add_amu_agenda_item branch changes; all other branches preserved
-- verbatim from archive/_20260829120011.

create or replace function public.execute_workflow_action(
  p_action jsonb,
  p_context jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_action_type   text := p_action->>'type';
  v_org_id        uuid := (p_context->>'organization_id')::uuid;
  v_meeting_type  text;
  v_meeting_id    uuid;
  v_priority      text;
  v_title         text;
  v_description   text;
  v_pos           int;
begin
  if v_action_type = 'create_task' then
    insert into public.task_items (
      organization_id, pack, source_category, pdca_phase,
      title, description, status, priority,
      assignee_name, due_date, source_type, source_id,
      law_refs, requires_sign_off
    ) values (
      v_org_id,
      coalesce(p_action->>'pack', 'hms'),
      coalesce(p_action->>'sourceCategory', 'avvik'),
      coalesce(p_action->>'pdcaPhase', 'do'),
      coalesce(p_action->>'title', 'Automatisk oppgave'),
      coalesce(p_action->>'description', ''),
      'open',
      coalesce(p_action->>'priority', 'medium'),
      p_action->>'assigneeName',
      case when (p_action->>'dueDays') is not null
           then current_date + (p_action->>'dueDays')::int end,
      p_context->>'source_type',
      p_context->>'source_id',
      coalesce(
        (select array_agg(v) from jsonb_array_elements_text(p_action->'lawRefs') t(v)),
        '{}'::text[]
      ),
      false
    );

  elsif v_action_type = 'create_task_item' then
    insert into public.task_items (
      organization_id, pack, source_category, pdca_phase,
      title, description, status, priority,
      due_date, source_type, source_id, requires_sign_off, law_refs
    ) values (
      v_org_id,
      coalesce(p_action->>'pack', 'hms'),
      coalesce(p_action->>'sourceCategory', 'avvik'),
      coalesce(p_action->>'pdcaPhase', 'do'),
      coalesce(p_action->>'title', 'Automatisk oppgave'),
      '',
      'open',
      coalesce(p_action->>'priority', 'medium'),
      case when (p_action->>'dueInDays') is not null
           then current_date + (p_action->>'dueInDays')::int end,
      p_context->>'source_type',
      p_context->>'source_id',
      false,
      '{}'::text[]
    );

  elsif v_action_type = 'create_ros_draft' then
    insert into public.ros_assessments (
      organization_id, title, template, status, source_type, source_id
    )
    select
      v_org_id,
      'ROS-utkast — ' || coalesce(p_context->>'title', 'automatisk'),
      coalesce(p_action->>'template', 'standard 5×5'),
      'draft',
      case when (p_action->>'linkSource')::boolean then p_context->>'source_type' end,
      case when (p_action->>'linkSource')::boolean then p_context->>'source_id' end
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'ros_assessments'
    );

  -- ── add_amu_agenda_item — meeting-aware ───────────────────────────────
  elsif v_action_type = 'add_amu_agenda_item' then
    v_meeting_type := coalesce(
                        p_action->>'meetingType',
                        p_action->>'meetingTypeSlug',
                        'amu'
                      );
    v_title        := coalesce(p_action->>'agendaItem',
                               p_action->>'title',
                               'Automatisk sak');
    v_description  := coalesce(p_action->>'description', null);
    v_priority     := coalesce(p_action->>'priority', 'normal');
    if v_priority not in ('low','normal','high','critical') then
      v_priority := 'normal';
    end if;

    -- Find next upcoming meeting of this type (planned/in_progress only).
    select m.id into v_meeting_id
      from public.meetings m
     where m.organization_id = v_org_id
       and m.status in ('planned','in_progress')
       and (
         m.system_template_id = v_meeting_type
         or (v_meeting_type = 'amu'
             and (m.system_template_id ilike 'amu%'
                  or m.title ilike 'AMU%'))
       )
       and (m.scheduled_at is null or m.scheduled_at >= now())
     order by coalesce(m.scheduled_at, 'infinity'::timestamptz) asc
     limit 1;

    if v_meeting_id is not null then
      select coalesce(max(position), -1) + 1 into v_pos
        from public.meeting_agenda_items
       where meeting_id = v_meeting_id;

      insert into public.meeting_agenda_items (
        meeting_id, position, title, description, is_mandatory
      ) values (
        v_meeting_id, v_pos, v_title, v_description, false
      );
    else
      insert into public.amu_agenda_backlog (
        organization_id, meeting_type, title, description,
        source_module, source_id, priority
      ) values (
        v_org_id, v_meeting_type, v_title, v_description,
        p_context->>'source_type', p_context->>'source_id', v_priority
      );
    end if;

  elsif v_action_type = 'request_signature' then
    insert into public.signature_requests (
      organization_id, document_ref, deadline_date, status, source_type, source_id
    )
    select
      v_org_id,
      coalesce(p_action->>'document', ''),
      case when (p_action->>'deadlineDays') is not null
           then current_date + (p_action->>'deadlineDays')::int end,
      'pending',
      p_context->>'source_type',
      p_context->>'source_id'
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'signature_requests'
    );

  elsif v_action_type = 'wait_delay' then
    null;

  elsif v_action_type = 'send_email' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'send_email',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  elsif v_action_type = 'send_notification' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'send_notification',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  elsif v_action_type = 'call_webhook' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'call_webhook',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  else
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'log_only',
      jsonb_build_object('action', p_action, 'context', p_context),
      now()
    )
    on conflict do nothing;
  end if;
end;
$body$;

comment on function public.execute_workflow_action(jsonb, jsonb) is
  'Workflow action dispatcher. add_amu_agenda_item now routes into meeting_agenda_items for the next upcoming matching meeting, or buffers in amu_agenda_backlog for later drain. Replaces the legacy amu_agenda_items insert (table dropped in archive/_20260901120020).';

end
$outer$;
