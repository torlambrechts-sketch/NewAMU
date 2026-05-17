-- "Skulle ha kjørt"-revisor — nightly reconciliation of dispatched events
-- vs. produced workflow_runs. Closes the silent-failure class of bugs.
--
-- Adds workflow_dispatch_events (capture of every dispatch attempt) +
-- workflow_missed_fire_log (discrepancies). Cron job re-evaluates the
-- last 24h of dispatch events against the currently-active rule set and
-- logs any rule that *should* have fired but didn't. Each detection emits
-- WORKFLOW_RULE_MISSED_FIRE so downstream rules can react.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — overvåking av at rutinene
--   faktisk fungerer. AML § 3-1 — systemets integritet skal kunne ettervises.
--   Uten denne revisoren har systemet ingen måte å oppdage "stille feil"
--   der en regel ble ignorert mens den skulle ha fyrt.
--   Restrisiko deferred: window er 24h — en regel som har stått stille i
--   30 dager før revisoren installeres detekteres ikke retroaktivt; det
--   aksepteres siden seal-window for workflow_runs uansett er 30d.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. workflow_dispatch_events — what the dispatcher saw.
--
-- Every call to workflow_dispatch_db_event records one row here BEFORE
-- iterating rules. This is the immutable contract the revisor reconciles
-- against. Without it we have no "should have fired" reference.
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_dispatch_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_module   text not null,
  event_name      text not null,
  payload         jsonb not null default '{}'::jsonb,
  dispatched_at   timestamptz not null default now(),
  -- Set by dispatcher: how many rules matched in real-time. Lets the revisor
  -- spot dispatch errors vs condition errors.
  matched_count   int not null default 0
);

create index if not exists workflow_dispatch_events_org_time_idx
  on public.workflow_dispatch_events (organization_id, dispatched_at desc);
create index if not exists workflow_dispatch_events_module_event_idx
  on public.workflow_dispatch_events (source_module, event_name, dispatched_at desc);

alter table public.workflow_dispatch_events enable row level security;

drop policy if exists "workflow_dispatch_events_select_org" on public.workflow_dispatch_events;
create policy "workflow_dispatch_events_select_org"
  on public.workflow_dispatch_events for select
  using (organization_id = public.current_org_id());

-- Inserts only from security-definer dispatcher (no direct client writes).
drop policy if exists "workflow_dispatch_events_no_writes" on public.workflow_dispatch_events;
create policy "workflow_dispatch_events_no_writes"
  on public.workflow_dispatch_events for all
  using (false) with check (false);

comment on table public.workflow_dispatch_events is
  'Append-only log of every event the workflow dispatcher saw. Source of truth for the missed-fire revisor.';

-- ---------------------------------------------------------------------------
-- 2. workflow_missed_fire_log — discrepancies the revisor found.
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_missed_fire_log (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  rule_id            uuid references public.workflow_rules (id) on delete set null,
  system_rule_slug   text,
  event_id           uuid references public.workflow_dispatch_events (id) on delete set null,
  source_module      text,
  event_name         text,
  detected_at        timestamptz not null default now(),
  expected_fire_at   timestamptz,
  reason             text not null,
  severity           text not null default 'high'
                       check (severity in ('low','medium','high','critical')),
  triage_status      text not null default 'open'
                       check (triage_status in ('open','investigating','resolved','accepted_as_correct')),
  triaged_by         uuid references public.profiles (id),
  triaged_at         timestamptz,
  triage_note        text,
  -- Either rule_id or system_rule_slug must be populated.
  constraint workflow_missed_fire_log_rule_or_slug
    check (rule_id is not null or system_rule_slug is not null)
);

create index if not exists workflow_missed_fire_log_org_status_idx
  on public.workflow_missed_fire_log (organization_id, triage_status, expected_fire_at desc);
create index if not exists workflow_missed_fire_log_rule_idx
  on public.workflow_missed_fire_log (rule_id, detected_at desc)
  where rule_id is not null;
create index if not exists workflow_missed_fire_log_system_slug_idx
  on public.workflow_missed_fire_log (system_rule_slug, detected_at desc)
  where system_rule_slug is not null;

alter table public.workflow_missed_fire_log enable row level security;

-- Org members can SELECT every row for their org.
drop policy if exists "workflow_missed_fire_log_select_org" on public.workflow_missed_fire_log;
create policy "workflow_missed_fire_log_select_org"
  on public.workflow_missed_fire_log for select
  using (organization_id = public.current_org_id());

-- INSERT denied to all RLS callers — service_role only (the revisor uses
-- security definer + bypasses RLS). Clients never insert.
drop policy if exists "workflow_missed_fire_log_no_client_insert" on public.workflow_missed_fire_log;
create policy "workflow_missed_fire_log_no_client_insert"
  on public.workflow_missed_fire_log for insert
  with check (false);

-- UPDATE permitted only to the triage fields and only for users with
-- workflows.activate (or admin/legacy workflows.manage).
drop policy if exists "workflow_missed_fire_log_update_triage" on public.workflow_missed_fire_log;
create policy "workflow_missed_fire_log_update_triage"
  on public.workflow_missed_fire_log for update
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
      or public.user_has_permission('workflows.activate')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
      or public.user_has_permission('workflows.activate')
    )
  );

-- DELETE denied (append-only audit substrate).
drop policy if exists "workflow_missed_fire_log_no_delete" on public.workflow_missed_fire_log;
create policy "workflow_missed_fire_log_no_delete"
  on public.workflow_missed_fire_log for delete
  using (false);

comment on table public.workflow_missed_fire_log is
  'Discrepancies the revisor found between workflow_dispatch_events and workflow_runs. Append-only; only triage fields can be updated post-insert.';

-- BEFORE UPDATE trigger: deny changes to identifying columns.
create or replace function public.trg_workflow_missed_fire_log_immutable()
returns trigger
language plpgsql
as $$
begin
  if  new.id                 is distinct from old.id
   or new.organization_id    is distinct from old.organization_id
   or new.rule_id            is distinct from old.rule_id
   or new.system_rule_slug   is distinct from old.system_rule_slug
   or new.event_id           is distinct from old.event_id
   or new.detected_at        is distinct from old.detected_at
   or new.expected_fire_at   is distinct from old.expected_fire_at
   or new.reason             is distinct from old.reason
  then
    raise exception 'workflow_missed_fire_log row %: identifying fields are immutable; only triage_status/triaged_by/triaged_at/triage_note are mutable', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_missed_fire_log_immutable on public.workflow_missed_fire_log;
create trigger workflow_missed_fire_log_immutable
  before update on public.workflow_missed_fire_log
  for each row execute function public.trg_workflow_missed_fire_log_immutable();

-- ---------------------------------------------------------------------------
-- 3. Extend workflow_dispatch_db_event() to also record into
--    workflow_dispatch_events so the revisor has its reconciliation
--    reference. Preserves the dispatch semantics from _122100.
-- ---------------------------------------------------------------------------

create or replace function public.workflow_dispatch_db_event(
  p_org_id    uuid,
  p_module    text,
  p_event     text,
  p_row       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule   record;
  v_sys    record;
  v_ctx    jsonb;
  v_emp_count int;
  v_event_id uuid;
  v_matched int := 0;
begin
  v_ctx := jsonb_build_object(
    'module',    p_module,
    'eventName', p_event,
    'rowId',     p_row->>'id',
    'row',       p_row
  );

  -- Record the dispatch BEFORE iterating so a crash mid-iteration still
  -- leaves a reconciliation reference for the revisor.
  insert into public.workflow_dispatch_events (
    organization_id, source_module, event_name, payload, dispatched_at, matched_count
  ) values (
    p_org_id, p_module, p_event, p_row, now(), 0
  ) returning id into v_event_id;

  -- (A) Per-org workflow_rules.
  for v_rule in
    select id
    from public.workflow_rules
    where organization_id = p_org_id
      and trigger_type      = 'db_event'
      and trigger_event_name = p_event
      and is_active          = true
      and public.workflow_row_matches_condition(condition_json, p_row)
  loop
    perform public.workflow_fire_rule(v_rule.id, p_org_id, p_event, v_ctx);
    v_matched := v_matched + 1;
  end loop;

  -- (B) Platform-owned workflow_system_rules — always active for every org.
  if exists (select 1 from public.workflow_system_rules
              where enabled = true and source_module = p_module
                and trigger_event_name = p_event) then

    select count(*) into v_emp_count
      from public.profiles
     where organization_id = p_org_id;

    for v_sys in
      select *
        from public.workflow_system_rules
       where enabled = true
         and source_module = p_module
         and trigger_event_name = p_event
         and (applies_if_employee_count_gte is null
              or v_emp_count >= applies_if_employee_count_gte)
         and public.workflow_row_matches_condition(condition_json, p_row)
    loop
      begin
        perform public.workflow_execute_actions(
          p_org_id, null::uuid, v_sys.actions_json,
          v_ctx || jsonb_build_object('system_rule_slug', v_sys.slug,
                                      'system_rule_framework', v_sys.framework,
                                      'system_rule_law_refs', to_jsonb(v_sys.law_refs))
        );
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail, input_snapshot
        ) values (
          p_org_id, null, p_module, 'db_event', 'completed',
          jsonb_build_object('system_rule_slug', v_sys.slug,
                             'framework', v_sys.framework,
                             'subcategory', v_sys.subcategory,
                             'law_refs', to_jsonb(v_sys.law_refs),
                             'dispatch_event_id', v_event_id),
          p_row
        );
        v_matched := v_matched + 1;
      exception when others then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          p_org_id, null, p_module, 'db_event', 'failed',
          jsonb_build_object('system_rule_slug', v_sys.slug,
                             'error', sqlerrm,
                             'dispatch_event_id', v_event_id)
        );
      end;
    end loop;
  end if;

  -- Update the dispatch event with the realtime matched count. The revisor
  -- uses (matched_count, condition re-eval) to decide if a miss happened.
  update public.workflow_dispatch_events
     set matched_count = v_matched
   where id = v_event_id;
end;
$$;

comment on function public.workflow_dispatch_db_event(uuid, text, text, jsonb) is
  'Master DB-event dispatcher. Records each call in workflow_dispatch_events, then iterates per-org workflow_rules + platform-owned workflow_system_rules. System rule executions land in workflow_runs with rule_id=null and detail.system_rule_slug populated. Dispatch event id is threaded through detail.dispatch_event_id so the revisor can match runs back to events.';

-- ---------------------------------------------------------------------------
-- 4. workflow_missed_fire_revisor_tick() — the nightly reconciler.
--
-- For each dispatch event in the last 24h:
--   * Re-evaluate every currently-active rule + system rule that targets
--     this (source_module, event_name).
--   * For each rule whose condition matches the payload, look for a
--     corresponding workflow_runs row (matched on rule_id + event_id, or
--     system_rule_slug + event_id). If absent, log a missed fire.
--   * For rules with trigger_type='schedule', if next_run_at is in the past
--     and last_run_at didn't bump, log cron_missed.
-- Emits WORKFLOW_RULE_MISSED_FIRE so downstream rules can react.
-- Returns the count of rows logged this tick.
-- ---------------------------------------------------------------------------

create or replace function public.workflow_missed_fire_revisor_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event       record;
  v_rule        record;
  v_sys         record;
  v_sched       record;
  v_existing    int;
  v_logged_id   uuid;
  v_total       int := 0;
  v_emp_count   int;
  v_window      interval := interval '24 hours';
begin
  -- Reconcile per-org workflow_rules + system rules against payload events.
  for v_event in
    select id, organization_id, source_module, event_name, payload, dispatched_at
      from public.workflow_dispatch_events
     where dispatched_at > now() - v_window
  loop

    -- Per-org rules currently active for this (module, event_name).
    for v_rule in
      select id, slug, name, condition_json
        from public.workflow_rules
       where organization_id = v_event.organization_id
         and trigger_type      = 'db_event'
         and trigger_event_name = v_event.event_name
         and source_module      = v_event.source_module
         and is_active          = true
    loop
      -- Should-have-matched?
      if public.workflow_payload_matches_condition(
           v_rule.condition_json, v_event.payload, null::jsonb, 'insert'
         ) then
        -- Was there a corresponding workflow_runs row?
        select count(*) into v_existing
          from public.workflow_runs
         where organization_id = v_event.organization_id
           and rule_id        = v_rule.id
           and created_at     > v_event.dispatched_at - interval '5 minutes'
           and created_at     < v_event.dispatched_at + interval '1 hour';

        if v_existing = 0 then
          -- De-dupe: don't log the same (event_id, rule_id) twice.
          select count(*) into v_existing
            from public.workflow_missed_fire_log
           where event_id = v_event.id and rule_id = v_rule.id;

          if v_existing = 0 then
            insert into public.workflow_missed_fire_log (
              organization_id, rule_id, system_rule_slug, event_id,
              source_module, event_name, expected_fire_at, reason, severity
            ) values (
              v_event.organization_id, v_rule.id, null, v_event.id,
              v_event.source_module, v_event.event_name, v_event.dispatched_at,
              'condition_should_match', 'high'
            )
            returning id into v_logged_id;
            v_total := v_total + 1;

            -- Emit a downstream event so reactive rules can pick this up.
            perform public.workflow_dispatch_db_event(
              v_event.organization_id, 'workflow', 'WORKFLOW_RULE_MISSED_FIRE',
              jsonb_build_object(
                'id', v_logged_id,
                'rule_id', v_rule.id,
                'rule_slug', v_rule.slug,
                'rule_name', v_rule.name,
                'source_module', v_event.source_module,
                'event_name', v_event.event_name,
                'expected_fire_at', v_event.dispatched_at,
                'reason', 'condition_should_match',
                'severity', 'high'
              )
            );
          end if;
        end if;
      end if;
    end loop;

    -- System rules (platform-owned) for this (module, event_name).
    select count(*) into v_emp_count
      from public.profiles
     where organization_id = v_event.organization_id;

    for v_sys in
      select slug, name, condition_json, applies_if_employee_count_gte
        from public.workflow_system_rules
       where enabled = true
         and source_module      = v_event.source_module
         and trigger_event_name = v_event.event_name
         and (applies_if_employee_count_gte is null
              or v_emp_count >= applies_if_employee_count_gte)
    loop
      if public.workflow_payload_matches_condition(
           v_sys.condition_json, v_event.payload, null::jsonb, 'insert'
         ) then
        -- System rules log to workflow_runs with rule_id=null and
        -- detail->>'system_rule_slug' set.
        select count(*) into v_existing
          from public.workflow_runs
         where organization_id = v_event.organization_id
           and rule_id is null
           and detail->>'system_rule_slug' = v_sys.slug
           and created_at > v_event.dispatched_at - interval '5 minutes'
           and created_at < v_event.dispatched_at + interval '1 hour';

        if v_existing = 0 then
          select count(*) into v_existing
            from public.workflow_missed_fire_log
           where event_id = v_event.id and system_rule_slug = v_sys.slug;

          if v_existing = 0 then
            insert into public.workflow_missed_fire_log (
              organization_id, rule_id, system_rule_slug, event_id,
              source_module, event_name, expected_fire_at, reason, severity
            ) values (
              v_event.organization_id, null, v_sys.slug, v_event.id,
              v_event.source_module, v_event.event_name, v_event.dispatched_at,
              'condition_should_match', 'critical'
            )
            returning id into v_logged_id;
            v_total := v_total + 1;

            perform public.workflow_dispatch_db_event(
              v_event.organization_id, 'workflow', 'WORKFLOW_RULE_MISSED_FIRE',
              jsonb_build_object(
                'id', v_logged_id,
                'system_rule_slug', v_sys.slug,
                'rule_name', v_sys.name,
                'source_module', v_event.source_module,
                'event_name', v_event.event_name,
                'expected_fire_at', v_event.dispatched_at,
                'reason', 'condition_should_match',
                'severity', 'critical'
              )
            );
          end if;
        end if;
      end if;
    end loop;
  end loop;

  -- Schedule-type checks: any active scheduled rule whose next_run_at is in
  -- the past by more than 1 hour has missed a cron tick.
  for v_sched in
    select r.id, r.organization_id, r.slug, r.name, r.source_module,
           r.schedule_cron, r.next_run_at, r.last_run_at
      from public.workflow_rules r
     where r.is_active = true
       and r.schedule_cron is not null
       and r.next_run_at is not null
       and r.next_run_at < now() - interval '1 hour'
  loop
    -- De-dupe per rule + expected_fire_at.
    select count(*) into v_existing
      from public.workflow_missed_fire_log
     where rule_id = v_sched.id
       and expected_fire_at = v_sched.next_run_at
       and reason = 'cron_missed';

    if v_existing = 0 then
      insert into public.workflow_missed_fire_log (
        organization_id, rule_id, system_rule_slug, event_id,
        source_module, event_name, expected_fire_at, reason, severity
      ) values (
        v_sched.organization_id, v_sched.id, null, null,
        v_sched.source_module, 'cron_tick', v_sched.next_run_at,
        'cron_missed', 'critical'
      )
      returning id into v_logged_id;
      v_total := v_total + 1;

      perform public.workflow_dispatch_db_event(
        v_sched.organization_id, 'workflow', 'WORKFLOW_RULE_MISSED_FIRE',
        jsonb_build_object(
          'id', v_logged_id,
          'rule_id', v_sched.id,
          'rule_slug', v_sched.slug,
          'rule_name', v_sched.name,
          'source_module', v_sched.source_module,
          'schedule_cron', v_sched.schedule_cron,
          'expected_fire_at', v_sched.next_run_at,
          'last_run_at', v_sched.last_run_at,
          'reason', 'cron_missed',
          'severity', 'critical'
        )
      );

      -- Create a high-severity task for HMS-leder on the org's task board.
      begin
        perform public.workflow_append_task(
          v_sched.organization_id,
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'title', 'Missed-fire: planlagt regel «' || coalesce(v_sched.name, v_sched.slug) || '» kjørte ikke',
            'description',
              'Den planlagte arbeidsflyt-regelen skulle ha kjørt '
              || to_char(v_sched.next_run_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI" UTC"')
              || ' men workflow_runs har ingen rad. Verifiser at pg_cron er aktiv og at workflow_cron_tick() fyrer.',
            'status', 'todo',
            'assignee', '',
            'ownerRole', 'HMS',
            'dueDate', (current_date + interval '1 day')::date::text,
            'createdAt', to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'module', 'workflow',
            'sourceType', 'workflow_missed_fire',
            'sourceId', v_logged_id::text,
            'sourceLabel', 'Missed-fire revisor',
            'requiresManagementSignOff', false
          )
        );
      exception when others then
        -- Task creation must never block the revisor from logging the miss.
        null;
      end;
    end if;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.workflow_missed_fire_revisor_tick() to service_role;

comment on function public.workflow_missed_fire_revisor_tick() is
  'Nightly reconciliation: re-evaluates the last 24h of workflow_dispatch_events against currently-active workflow_rules and workflow_system_rules, plus schedule-type rules whose next_run_at is overdue. Logs discrepancies to workflow_missed_fire_log and emits WORKFLOW_RULE_MISSED_FIRE. Intended for pg_cron daily at 03:00 UTC.';

-- ---------------------------------------------------------------------------
-- 5. pg_cron schedule — daily 03:00 UTC. Gated on extension availability.
-- ---------------------------------------------------------------------------

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'workflow_missed_fire_revisor_tick';

    perform cron.schedule(
      'workflow_missed_fire_revisor_tick',
      '0 3 * * *',
      $cmd$select public.workflow_missed_fire_revisor_tick();$cmd$
    );
    raise notice 'workflow_missed_fire_revisor_tick scheduled daily 03:00 UTC via pg_cron';
  else
    raise notice 'pg_cron not installed — workflow_missed_fire_revisor_tick must be invoked manually by ops';
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — workflow_missed_fire_revisor_tick must be invoked manually by ops';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — workflow_missed_fire_revisor_tick must be invoked manually by ops';
end
$cron$;
