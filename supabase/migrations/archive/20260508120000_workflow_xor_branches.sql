-- XOR / AND / OR condition groups + per-branch actions for workflow rules.
-- Legacy rules: condition_json is a leaf or always; actions_json is a JSON array.

-- ---------------------------------------------------------------------------
-- Recursive condition evaluation (and / or / xor)
-- ---------------------------------------------------------------------------

create or replace function public.workflow_payload_matches_condition(
  p_condition jsonb,
  p_new jsonb,
  p_old jsonb,
  p_trigger text
)
returns boolean
language plpgsql
immutable
as $$
declare
  m text;
  p text;
  w jsonb;
  arr jsonb;
  el jsonb;
  kids jsonb;
  i int;
  cnt int;
  ok boolean;
begin
  if p_condition is null then
    return false;
  end if;

  m := coalesce(p_condition->>'match', 'always');

  if m = 'always' then
    return true;
  end if;

  if m = 'and' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if not public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  if m = 'or' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if m = 'xor' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    cnt := 0;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        cnt := cnt + 1;
      end if;
    end loop;
    return cnt = 1;
  end if;

  if m = 'array_any' then
    p := p_condition->>'path';
    w := p_condition->'where';
    if p is null or w is null then
      return false;
    end if;
    arr := p_new #> string_to_array(p, '.');
    if arr is null or jsonb_typeof(arr) <> 'array' then
      return false;
    end if;
    for el in select * from jsonb_array_elements(arr)
    loop
      if w = '{}'::jsonb or w is null then
        return true;
      end if;
      if el @> w then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if m = 'field_equals' then
    p := p_condition->>'path';
    if p is null then
      return false;
    end if;
    return (p_new #>> string_to_array(p, '.')) = (p_condition->>'value');
  end if;

  return false;
end;
$$;

-- 0-based index of sole matching XOR child, or -1 if not exactly one
create or replace function public.workflow_xor_match_index(
  p_condition jsonb,
  p_new jsonb,
  p_old jsonb,
  p_trigger text
)
returns int
language plpgsql
immutable
as $$
declare
  kids jsonb;
  i int;
  cnt int;
  idx int := -1;
begin
  if p_condition is null or coalesce(p_condition->>'match', '') <> 'xor' then
    return -1;
  end if;
  kids := p_condition->'conditions';
  if kids is null or jsonb_typeof(kids) <> 'array' then
    return -1;
  end if;
  cnt := 0;
  for i in 0..jsonb_array_length(kids) - 1
  loop
    if public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
      cnt := cnt + 1;
      idx := i;
    end if;
  end loop;
  if cnt = 1 then
    return idx;
  end if;
  return -1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions: legacy array OR { "mode": "xor_branches", "branches": [ { "actions": [...] } ] }
-- ---------------------------------------------------------------------------

create or replace function public.workflow_execute_actions(
  p_org_id uuid,
  p_rule_id uuid,
  p_actions jsonb,
  p_context jsonb,
  p_xor_branch_index int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  tid text;
  title text;
  descr text;
  assignee text;
  due_days int;
  mod text;
  src text;
  due text;
  t jsonb;
  mode text;
  branch_el jsonb;
  acts jsonb;
begin
  -- XOR branches object
  if jsonb_typeof(p_actions) = 'object' and coalesce(p_actions->>'mode', '') = 'xor_branches' then
    if p_xor_branch_index is null or p_xor_branch_index < 0 then
      return;
    end if;
    branch_el := p_actions->'branches'->p_xor_branch_index;
    if branch_el is null then
      return;
    end if;
    acts := branch_el->'actions';
    if acts is null or jsonb_typeof(acts) <> 'array' then
      return;
    end if;
    for a in select * from jsonb_array_elements(acts)
    loop
      if a->>'type' = 'create_task' then
        tid := coalesce(a->>'id', gen_random_uuid()::text);
        title := coalesce(a->>'title', 'Arbeidsflyt-oppgave');
        descr := coalesce(a->>'description', '');
        assignee := coalesce(a->>'assignee', 'Ansvarlig');
        due_days := coalesce((a->>'dueInDays')::int, 7);
        mod := coalesce(a->>'module', 'hse');
        src := coalesce(a->>'sourceType', 'hse_incident');
        due := (current_date + (due_days || ' days')::interval)::date::text;
        t := jsonb_build_object(
          'id', tid,
          'title', title,
          'description', descr,
          'status', 'todo',
          'assignee', assignee,
          'ownerRole', coalesce(a->>'ownerRole', 'HMS'),
          'dueDate', due,
          'createdAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'module', mod,
          'sourceType', src,
          'sourceId', p_context->>'sourceId',
          'sourceLabel', coalesce(a->>'sourceLabel', 'Arbeidsflyt'),
          'requiresManagementSignOff', coalesce((a->>'requiresManagementSignOff')::boolean, false)
        );
        perform public.workflow_append_task(p_org_id, t);
      elsif a->>'type' = 'log_only' then
        null;
      end if;
    end loop;
    return;
  end if;

  -- Legacy: array of actions
  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    if a->>'type' = 'create_task' then
      tid := coalesce(a->>'id', gen_random_uuid()::text);
      title := coalesce(a->>'title', 'Arbeidsflyt-oppgave');
      descr := coalesce(a->>'description', '');
      assignee := coalesce(a->>'assignee', 'Ansvarlig');
      due_days := coalesce((a->>'dueInDays')::int, 7);
      mod := coalesce(a->>'module', 'hse');
      src := coalesce(a->>'sourceType', 'hse_incident');
      due := (current_date + (due_days || ' days')::interval)::date::text;
      t := jsonb_build_object(
        'id', tid,
        'title', title,
        'description', descr,
        'status', 'todo',
        'assignee', assignee,
        'ownerRole', coalesce(a->>'ownerRole', 'HMS'),
        'dueDate', due,
        'createdAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'module', mod,
        'sourceType', src,
        'sourceId', p_context->>'sourceId',
        'sourceLabel', coalesce(a->>'sourceLabel', 'Arbeidsflyt'),
        'requiresManagementSignOff', coalesce((a->>'requiresManagementSignOff')::boolean, false)
      );
      perform public.workflow_append_task(p_org_id, t);
    elsif a->>'type' = 'log_only' then
      null;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: pass XOR branch index when applicable
-- ---------------------------------------------------------------------------

create or replace function public.workflow_on_org_module_payload_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  skip text;
  r record;
  ev text;
  payload_new jsonb;
  payload_old jsonb;
  ctx jsonb;
  xidx int;
begin
  skip := current_setting('app.workflow_skip', true);
  if skip = 'on' then
    return NEW;
  end if;

  if tg_op = 'INSERT' then
    payload_new := NEW.payload;
    payload_old := '{}'::jsonb;
    ev := 'insert';
  else
    payload_new := NEW.payload;
    payload_old := OLD.payload;
    ev := 'update';
  end if;

  for r in
    select *
    from public.workflow_rules
    where organization_id = NEW.organization_id
      and source_module = NEW.module_key
      and is_active = true
    order by priority desc, created_at
  loop
    if r.trigger_on = 'insert' and ev = 'update' then
      continue;
    end if;
    if r.trigger_on = 'update' and ev = 'insert' then
      continue;
    end if;

    if not public.workflow_payload_matches_condition(r.condition_json, payload_new, payload_old, ev) then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, NEW.module_key, 'payload_change', 'skipped', jsonb_build_object('reason', 'condition_not_met'));
      continue;
    end if;

    ctx := jsonb_build_object(
      'module', NEW.module_key,
      'sourceId', NEW.organization_id::text,
      'payloadSnapshot', left(payload_new::text, 8000)
    );

    xidx := null;
    if coalesce(r.condition_json->>'match', '') = 'xor' then
      xidx := public.workflow_xor_match_index(r.condition_json, payload_new, payload_old, ev);
      if xidx < 0 then
        insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
        values (
          NEW.organization_id,
          r.id,
          NEW.module_key,
          'payload_change',
          'skipped',
          jsonb_build_object('reason', 'xor_not_exactly_one_branch')
        );
        continue;
      end if;
    end if;

    begin
      perform public.workflow_execute_actions(NEW.organization_id, r.id, r.actions_json, ctx, xidx);
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        NEW.organization_id,
        r.id,
        NEW.module_key,
        'payload_change',
        'completed',
        jsonb_build_object(
          'xor_branch', xidx,
          'actions_mode', case when jsonb_typeof(r.actions_json) = 'object' and r.actions_json->>'mode' = 'xor_branches' then 'xor_branches' else 'array' end
        )
      );
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        NEW.organization_id,
        r.id,
        NEW.module_key,
        'payload_change',
        'failed',
        jsonb_build_object('error', sqlerrm)
      );
    end;
  end loop;

  return NEW;
end;
$$;

-- Wiki: evaluate conditions against page row as JSON context
create or replace function public.workflow_on_wiki_page_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  ctx jsonb;
  page_new jsonb;
  page_old jsonb;
  xidx int;
begin
  if tg_op <> 'UPDATE' then
    return NEW;
  end if;
  if NEW.status <> 'published' or OLD.status = 'published' then
    return NEW;
  end if;

  page_new := to_jsonb(NEW);
  page_old := to_jsonb(OLD);

  for r in
    select *
    from public.workflow_rules
    where organization_id = NEW.organization_id
      and source_module = 'wiki_published'
      and is_active = true
    order by priority desc
  loop
    if not public.workflow_payload_matches_condition(r.condition_json, page_new, page_old, 'update') then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'skipped', jsonb_build_object('reason', 'condition_not_met'));
      continue;
    end if;

    ctx := jsonb_build_object('pageId', NEW.id, 'title', NEW.title);

    xidx := null;
    if coalesce(r.condition_json->>'match', '') = 'xor' then
      xidx := public.workflow_xor_match_index(r.condition_json, page_new, page_old, 'update');
      if xidx < 0 then
        insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
        values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'skipped', jsonb_build_object('reason', 'xor_not_exactly_one_branch'));
        continue;
      end if;
    end if;

    begin
      perform public.workflow_execute_actions(NEW.organization_id, r.id, r.actions_json, ctx, xidx);
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'completed', ctx || jsonb_build_object('xor_branch', xidx));
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  return NEW;
end;
$$;

alter table public.workflow_rules
  add column if not exists flow_graph_json jsonb;

comment on column public.workflow_rules.flow_graph_json is 'Optional visual flow builder state (nodes, edges) for UI round-trip; execution uses condition_json + actions_json.';
