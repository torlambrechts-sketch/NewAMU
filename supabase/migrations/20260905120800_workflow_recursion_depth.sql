-- Replace the app.workflow_skip boolean recursion guard with a depth
-- counter capped at 5.
--
-- The legacy `set_config('app.workflow_skip', 'on', true)` in
-- workflow_append_task() short-circuited the entire workflow trigger any
-- time a workflow created a task — which is fine for the round-trip
-- inspector → tasks pattern, but it also silences chains that SHOULD fire:
--   inspection finding → workflow A creates task
--                       → tasks workflow B creates AMU agenda item
--                       → meetings workflow C publishes decision
-- With the boolean, B and C never get a chance.
--
-- The fix: count depth instead of toggling a kill switch. A small cap
-- (5 is a deliberate, conservative ceiling — typical chains are 2-3 deep)
-- prevents the worst-case A→B→C→A→… loops, while letting legitimate
-- multi-module chains complete. Cycles that exceed the cap log
-- WORKFLOW_DEPTH_EXCEEDED so an admin can debug.
--
-- The old set_config calls in workflow_append_task() keep working because
-- the new dispatch checker reads either signal; we don't break existing
-- call sites in this migration. The legacy boolean is treated as
-- depth=99 (always skip) for backward compat — the cleanup migration in
-- Phase B removes it once the new builder is the only writer.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — sporbar overvåking. Tidligere
--   ble lovlig fan-out (avvik → oppgave → AMU-sak) silently droppet.
--   Restrisiko deferred: dynamisk cap pr regel (noen kjeder kan trenge
--   mer enn 5 nivåer) kommer i Phase C.

create or replace function public.workflow_depth_check_and_inc()
returns int
language plpgsql
as $$
declare
  v_skip text;
  v_cur text;
  v_depth int;
begin
  v_skip := current_setting('app.workflow_skip', true);
  if v_skip = 'on' then
    return 99;  -- legacy guard fully ON: caller must short-circuit
  end if;

  v_cur := current_setting('app.workflow_depth', true);
  v_depth := coalesce(nullif(v_cur, '')::int, 0);

  if v_depth >= 5 then
    -- Caller should log + return without firing further actions.
    return v_depth;
  end if;

  perform set_config('app.workflow_depth', (v_depth + 1)::text, true);
  return v_depth + 1;
end;
$$;

create or replace function public.workflow_depth_dec()
returns void
language plpgsql
as $$
declare
  v_cur text;
  v_depth int;
begin
  v_cur := current_setting('app.workflow_depth', true);
  v_depth := coalesce(nullif(v_cur, '')::int, 0);
  if v_depth > 0 then
    perform set_config('app.workflow_depth', (v_depth - 1)::text, true);
  end if;
end;
$$;

-- Update workflow_on_org_module_payload_change() to consult the depth
-- counter. The boolean still works as an override (=99) so existing call
-- sites in workflow_append_task() don't need to change in this migration.
create or replace function public.workflow_on_org_module_payload_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d int;
  r record;
  ev text;
  payload_new jsonb;
  payload_old jsonb;
  ctx jsonb;
begin
  d := public.workflow_depth_check_and_inc();
  if d >= 99 then
    return new;  -- legacy boolean: skip entirely
  end if;
  if d > 5 then
    insert into public.workflow_runs (organization_id, source_module, event, status, detail)
    values (new.organization_id, new.module_key, 'payload_change', 'skipped',
            jsonb_build_object('reason', 'WORKFLOW_DEPTH_EXCEEDED', 'depth', d));
    return new;
  end if;

  if tg_op = 'INSERT' then
    payload_new := new.payload;
    payload_old := '{}'::jsonb;
    ev := 'insert';
  else
    payload_new := new.payload;
    payload_old := old.payload;
    ev := 'update';
  end if;

  for r in
    select *
    from public.workflow_rules
    where organization_id = new.organization_id
      and source_module = new.module_key
      and is_active = true
    order by priority desc, created_at
  loop
    if r.trigger_on = 'insert' and ev = 'update' then continue; end if;
    if r.trigger_on = 'update' and ev = 'insert' then continue; end if;

    if not public.workflow_payload_matches_condition(r.condition_json, payload_new, payload_old, ev) then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (new.organization_id, r.id, new.module_key, 'payload_change', 'skipped',
              jsonb_build_object('reason', 'condition_not_met', 'depth', d));
      continue;
    end if;

    ctx := jsonb_build_object(
      'module', new.module_key,
      'sourceId', new.organization_id::text,
      'depth', d,
      'payloadSnapshot', left(payload_new::text, 8000)
    );

    begin
      perform public.workflow_execute_actions(new.organization_id, r.id, r.actions_json, ctx);
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail, input_snapshot)
      values (
        new.organization_id, r.id, new.module_key,
        'payload_change', 'completed',
        jsonb_build_object('actions', jsonb_array_length(coalesce(r.actions_json, '[]'::jsonb)), 'depth', d),
        payload_new
      );
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (new.organization_id, r.id, new.module_key, 'payload_change', 'failed',
              jsonb_build_object('error', sqlerrm, 'depth', d));
    end;
  end loop;

  perform public.workflow_depth_dec();
  return new;
exception when others then
  perform public.workflow_depth_dec();
  raise;
end;
$$;

comment on function public.workflow_depth_check_and_inc() is
  'Reads app.workflow_depth (legacy app.workflow_skip=on → 99). Increments and returns new depth; cap is 5. Caller must call workflow_depth_dec() when done.';
