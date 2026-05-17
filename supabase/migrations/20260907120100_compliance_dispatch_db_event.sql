-- Compliance checklist → workflow engine dispatch (P0 fix #2).
--
-- Arbeidstilsynet self-audit: closes a hard gap where the seeded system
-- rules and per-org catalog rules keyed on response_finding_<severity>,
-- execution_signed, and execution_overdue never fired — the legacy
-- response trigger looped workflow_rules directly and bypassed the
-- dispatcher. Pålegg-grunner addressed: AML §3-1 (HMS-systematikk),
-- §4-3 (psykososialt — kritisk/høy finding chain), §5-2 (handlingsplan
-- via execution_signed → tildelt oppfølging) and GDPR Art. 33 (72t-
-- varsel via critical-finding chain). Restrisiko: the legacy direct
-- loop in process_compliance_checklist_response_workflow() is kept
-- alive so existing baseline rules keep firing during the transition;
-- the engine path now runs in parallel.

-- ── 1. Debounce column on executions (overdue emitter) ─────────────────────
alter table public.compliance_checklist_executions
  add column if not exists due_at timestamptz;

alter table public.compliance_checklist_executions
  add column if not exists last_overdue_emitted_at timestamptz;

comment on column public.compliance_checklist_executions.due_at is
  'Optional hard deadline for completing this execution. When set and passed without status=signed, the workflow_emit_compliance_overdue_tick() cron job emits an execution_overdue db_event (debounced 24h via last_overdue_emitted_at).';
comment on column public.compliance_checklist_executions.last_overdue_emitted_at is
  'Set by workflow_emit_compliance_overdue_tick() each time an execution_overdue event is dispatched, so a single overdue execution does not flood the dispatcher.';

create index if not exists compliance_checklist_executions_due_at_idx
  on public.compliance_checklist_executions (organization_id, due_at)
  where due_at is not null and status <> 'signed';

-- ── 2. Extend response workflow trigger to ALSO call the dispatcher ───────
--
-- The existing function loops workflow_rules directly (legacy direct-emitter
-- path). We keep that loop intact for backwards compatibility, then ALSO
-- fan out via workflow_dispatch_db_event so the seeded workflow_system_rules
-- and per-org rules keyed on db_event / response_finding_<severity> fire.

create or replace function public.process_compliance_checklist_response_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exec        record;
  v_rule        record;
  v_payload     jsonb;
  v_matched     boolean;
  v_dev_id      uuid := null;
  v_rule_dev_id uuid;
begin
  -- Only fire on findings (severity present).
  if new.severity is null then
    return new;
  end if;

  -- Idempotency: if this response is already linked to a deviation, skip.
  if new.deviation_id is not null then
    return new;
  end if;

  select e.* into v_exec
  from public.compliance_checklist_executions e
  where e.id = new.execution_id;

  v_payload := jsonb_build_object(
    'id',              new.id,
    'severity',        new.severity::text,
    'comment',         new.comment,
    'execution_id',    new.execution_id,
    'item_key',        new.item_key,
    'organization_id', new.organization_id,
    'created_by',      new.created_by,
    'pack',            v_exec.pack::text
  );

  for v_rule in
    select *
    from public.workflow_rules
    where organization_id = new.organization_id
      and source_module    = 'compliance_checklist'
      and is_active        = true
      and trigger_on       in ('insert', 'both')
    order by priority asc, created_at asc
  loop
    begin
      v_matched := public.workflow_payload_matches_condition(
        v_rule.condition_json, v_payload, null, 'insert'
      );

      if not v_matched then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
          'skipped',
          jsonb_build_object('reason', 'condition_not_met', 'response_id', new.id)
        );
        continue;
      end if;

      v_rule_dev_id := public.execute_compliance_checklist_rule_actions(
        new.organization_id,
        v_rule.id,
        v_rule.actions_json,
        new.id,
        new.comment,
        new.severity::text,
        new.created_by,
        new.execution_id,
        coalesce(v_exec.title, 'Sjekkliste'),
        v_exec.assigned_to,
        new.item_key
      );

      if v_rule_dev_id is not null and v_dev_id is null then
        v_dev_id := v_rule_dev_id;
      end if;

      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
        'completed',
        jsonb_build_object(
          'response_id',  new.id,
          'execution_id', new.execution_id,
          'severity',     new.severity,
          'deviation_id', v_rule_dev_id
        )
      );

    exception when others then
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
        'failed',
        jsonb_build_object('response_id', new.id, 'error', sqlerrm)
      );
    end;
  end loop;

  -- Stamp the response with the first deviation id (if any rule created one).
  if v_dev_id is not null then
    update public.compliance_checklist_responses
    set deviation_id = v_dev_id,
        updated_at   = now()
    where id = new.id;
  end if;

  -- ── NEW: dispatch to the workflow engine so system rules + catalog rules
  -- keyed on response_finding_<severity> fire. The legacy loop above stays
  -- in place (parallel path during transition).
  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'compliance_checklist',
      'response_finding_' || new.severity::text,
      v_payload
    );
  exception when others then
    insert into public.workflow_runs (
      organization_id, rule_id, source_module, event, status, detail
    ) values (
      new.organization_id, null, 'compliance_checklist',
      'response_finding_' || new.severity::text,
      'failed',
      jsonb_build_object('response_id', new.id, 'error', sqlerrm,
                         'stage', 'workflow_dispatch_db_event')
    );
  end;

  return new;

exception when others then
  insert into public.workflow_runs (
    organization_id, rule_id, source_module, event, status, detail
  ) values (
    new.organization_id, null, 'compliance_checklist', 'payload_change',
    'failed',
    jsonb_build_object('response_id', new.id, 'error', sqlerrm)
  );
  return new;
end;
$$;

-- Trigger re-bind (idempotent).
drop trigger if exists compliance_checklist_responses_workflow_tg
  on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_workflow_tg
  after insert on public.compliance_checklist_responses
  for each row execute function public.process_compliance_checklist_response_workflow();

-- ── 3. New AFTER UPDATE trigger on executions → execution_signed ──────────
--
-- Fires the moment signed_at flips from null to non-null. Engine rules can
-- key on event='execution_signed' for handoff to handlingsplan, archiving,
-- audit-log emission, etc.

create or replace function public.process_compliance_checklist_execution_signed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_slug text;
  v_payload       jsonb;
begin
  if new.signed_at is null or old.signed_at is not null then
    return new;
  end if;

  select slug into v_template_slug
  from public.compliance_checklist_templates
  where id = new.template_id;

  v_payload := jsonb_build_object(
    'id',              new.id,
    'execution_id',    new.id,
    'template_id',     new.template_id,
    'template_slug',   v_template_slug,
    'pack',            new.pack::text,
    'title',           new.title,
    'signed_at',       new.signed_at,
    'signed_by',       new.signed_by,
    'assigned_to',     new.assigned_to,
    'organization_id', new.organization_id
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'compliance_checklist',
      'execution_signed',
      v_payload
    );
  exception when others then
    insert into public.workflow_runs (
      organization_id, rule_id, source_module, event, status, detail
    ) values (
      new.organization_id, null, 'compliance_checklist', 'execution_signed',
      'failed',
      jsonb_build_object('execution_id', new.id, 'error', sqlerrm)
    );
  end;

  return new;
end;
$$;

drop trigger if exists compliance_checklist_executions_signed_tg
  on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_signed_tg
  after update of signed_at, status on public.compliance_checklist_executions
  for each row execute function public.process_compliance_checklist_execution_signed();

-- ── 4. Cron-driven execution_overdue emitter ──────────────────────────────
--
-- Scans for executions past due_at that aren't signed, debounced 24h per
-- execution via last_overdue_emitted_at. Emits execution_overdue through
-- the dispatcher so engine rules (Arbeidstilsynet ettersyn → påminnelse-
-- chain, AML §5-2 handlingsplan-eskalering) can subscribe.

create or replace function public.workflow_emit_compliance_overdue_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_count  int := 0;
  v_slug   text;
  v_payload jsonb;
begin
  for v_row in
    select e.*
    from public.compliance_checklist_executions e
    where e.due_at is not null
      and e.due_at < now()
      and e.status <> 'signed'
      and e.deleted_at is null
      and coalesce(e.last_overdue_emitted_at, '1970-01-01'::timestamptz)
            < now() - interval '24 hours'
    for update skip locked
  loop
    select slug into v_slug
    from public.compliance_checklist_templates
    where id = v_row.template_id;

    v_payload := jsonb_build_object(
      'id',                 v_row.id,
      'execution_id',       v_row.id,
      'template_id',        v_row.template_id,
      'template_slug',      v_slug,
      'pack',               v_row.pack::text,
      'title',              v_row.title,
      'status',             v_row.status::text,
      'assigned_to',        v_row.assigned_to,
      'scheduled_for',      v_row.scheduled_for,
      'due_at',             v_row.due_at,
      'overdue_seconds',    extract(epoch from (now() - v_row.due_at))::bigint,
      'organization_id',    v_row.organization_id
    );

    begin
      perform public.workflow_dispatch_db_event(
        v_row.organization_id,
        'compliance_checklist',
        'execution_overdue',
        v_payload
      );

      update public.compliance_checklist_executions
        set last_overdue_emitted_at = now()
      where id = v_row.id;

      v_count := v_count + 1;
    exception when others then
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        v_row.organization_id, null, 'compliance_checklist', 'execution_overdue',
        'failed',
        jsonb_build_object('execution_id', v_row.id, 'error', sqlerrm)
      );
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.workflow_emit_compliance_overdue_tick() to service_role;

comment on function public.workflow_emit_compliance_overdue_tick() is
  'Scans compliance_checklist_executions for rows past due_at that are not signed and dispatches execution_overdue via workflow_dispatch_db_event(). Debounced 24h per execution via last_overdue_emitted_at. Intended for pg_cron at 02:00 daily.';

-- ── 5. pg_cron registration — daily 02:00 (matches _120600 pattern) ───────

do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_emit_compliance_overdue_tick')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_emit_compliance_overdue_tick',
      '0 2 * * *',
      $cmd$select public.workflow_emit_compliance_overdue_tick();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule public.workflow_emit_compliance_overdue_tick() externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule public.workflow_emit_compliance_overdue_tick() externally';
end
$cron$;
