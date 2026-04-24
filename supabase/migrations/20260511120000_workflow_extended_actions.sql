-- Utvid workflow_execute_actions med send_email, send_notification, call_webhook (logges i workflow_runs / detail utvides ikke her — se insert i triggers).
-- Faktisk SMTP og HTTP outbound krever Edge Function / jobb; dette registrerer intensjon for revisjon.

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
      elsif a->>'type' = 'send_email' then
        insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
        values (
          p_org_id,
          p_rule_id,
          coalesce(p_context->>'module', 'workflow'),
          'payload_change',
          'completed',
          jsonb_build_object(
            'action', 'send_email',
            'from', left(coalesce(a->>'fromAddress', ''), 200),
            'to', left(coalesce(a->>'toAddress', ''), 200),
            'subject', left(coalesce(a->>'subject', ''), 500),
            'queued', true,
            'note', 'E-post krever server-side utsending (planlagt).'
          )
        );
      elsif a->>'type' = 'send_notification' then
        insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
        values (
          p_org_id,
          p_rule_id,
          coalesce(p_context->>'module', 'workflow'),
          'payload_change',
          'completed',
          jsonb_build_object(
            'action', 'send_notification',
            'title', left(coalesce(a->>'title', ''), 300),
            'category', coalesce(a->>'category', 'workflow'),
            'channels', coalesce(a->'channels', '[]'::jsonb)
          )
        );
      elsif a->>'type' = 'call_webhook' then
        insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
        values (
          p_org_id,
          p_rule_id,
          coalesce(p_context->>'module', 'workflow'),
          'payload_change',
          'completed',
          jsonb_build_object(
            'action', 'call_webhook',
            'url', left(coalesce(a->>'url', ''), 2000),
            'method', coalesce(a->>'method', 'POST'),
            'queued', true,
            'note', 'HTTP-kall krever sikker server/Edge Function (planlagt).'
          )
        );
      elsif a->>'type' = 'log_only' then
        null;
      end if;
    end loop;
    return;
  end if;

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
    elsif a->>'type' = 'send_email' then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        p_org_id,
        p_rule_id,
        coalesce(p_context->>'module', 'workflow'),
        'payload_change',
        'completed',
        jsonb_build_object(
          'action', 'send_email',
          'from', left(coalesce(a->>'fromAddress', ''), 200),
          'to', left(coalesce(a->>'toAddress', ''), 200),
          'subject', left(coalesce(a->>'subject', ''), 500),
          'queued', true,
          'note', 'E-post krever server-side utsending (planlagt).'
        )
      );
    elsif a->>'type' = 'send_notification' then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        p_org_id,
        p_rule_id,
        coalesce(p_context->>'module', 'workflow'),
        'payload_change',
        'completed',
        jsonb_build_object(
          'action', 'send_notification',
          'title', left(coalesce(a->>'title', ''), 300),
          'category', coalesce(a->>'category', 'workflow'),
          'channels', coalesce(a->'channels', '[]'::jsonb)
        )
      );
    elsif a->>'type' = 'call_webhook' then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        p_org_id,
        p_rule_id,
        coalesce(p_context->>'module', 'workflow'),
        'payload_change',
        'completed',
        jsonb_build_object(
          'action', 'call_webhook',
          'url', left(coalesce(a->>'url', ''), 2000),
          'method', coalesce(a->>'method', 'POST'),
          'queued', true,
          'note', 'HTTP-kall krever sikker server/Edge Function (planlagt).'
        )
      );
    elsif a->>'type' = 'log_only' then
      null;
    end if;
  end loop;
end;
$$;
