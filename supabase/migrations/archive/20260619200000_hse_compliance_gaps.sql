-- HSE / IK-f compliance: per-finding risk matrix, deviation workflow statuses,
-- root cause fields, and close audit metadata.

-- ── 1. Risk matrix on inspection_findings ─────────────────────────────────
-- IK-f §5 requires risk to be assessed per finding, not just per deviation.

alter table public.inspection_findings
  add column if not exists risk_probability smallint
    check (risk_probability between 1 and 5),
  add column if not exists risk_consequence smallint
    check (risk_consequence between 1 and 5),
  add column if not exists risk_score smallint
    generated always as (
      case
        when risk_probability is not null and risk_consequence is not null
        then risk_probability * risk_consequence
        else null
      end
    ) stored;

create index if not exists inspection_findings_risk_score_idx
  on public.inspection_findings (organization_id, risk_score desc nulls last)
  where deleted_at is null;

-- ── 2. Deviation workflow: proper 4-step status ────────────────────────────
-- Norwegian IK-forskriften: Rapportert → Under behandling →
-- Tiltak iverksatt → Verifisert/Lukket.

alter table public.deviations
  drop constraint if exists deviations_status_check;

-- Migrate while unrestricted (old check would reject new literals).
update public.deviations set status = 'rapportert'       where status = 'open';
update public.deviations set status = 'under_behandling' where status = 'in_progress';
update public.deviations set status = 'lukket'           where status = 'closed';

alter table public.deviations
  alter column status set default 'rapportert';

alter table public.deviations
  add constraint deviations_status_check
  check (status in (
    'rapportert',       -- initial state on creation
    'under_behandling', -- assigned, being investigated
    'tiltak_iverksatt', -- action taken, awaiting verification
    'lukket'            -- verified and closed
  ));

-- ── 3. Root cause analysis on deviations ───────────────────────────────────

alter table public.deviations
  add column if not exists root_cause_analysis text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_notes text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users (id) on delete set null;

-- Auto-set closed_at when status changes to 'lukket'
create or replace function public.deviations_before_update_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'lukket' and old.status <> 'lukket' then
    new.closed_at := now();
    new.closed_by := auth.uid();
  end if;
  if new.status <> 'lukket' then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists deviations_before_update_defaults_tg on public.deviations;
create trigger deviations_before_update_defaults_tg
  before update on public.deviations
  for each row execute function public.deviations_before_update_defaults();

-- Keep workflow helpers aligned with deviations_status_check (avoid literal 'open').
create or replace function public.workflow_execute_step(
  p_org_id     uuid,
  p_rule_id    uuid,
  p_step_id    uuid,
  p_step_type  text,
  p_config     jsonb,
  p_context    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text;
  v_due     text;
  v_task    jsonb;
  v_sev     text;
begin
  if p_step_type = 'create_task' then
    v_title := coalesce(p_config->>'title', 'Arbeidsflyt-oppgave');
    v_due   := (current_date + (coalesce((p_config->>'dueInDays')::int, 7) || ' days')::interval)::date::text;
    v_task  := jsonb_build_object(
      'id',          gen_random_uuid()::text,
      'title',       v_title,
      'description', coalesce(p_config->>'description', ''),
      'status',      'todo',
      'assignee',    coalesce(p_config->>'assignee', ''),
      'ownerRole',   coalesce(p_config->>'ownerRole', 'HMS'),
      'dueDate',     v_due,
      'createdAt',   to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'module',      coalesce(p_context->>'module', 'inspection'),
      'sourceType',  coalesce(p_context->>'eventName', 'workflow'),
      'sourceId',    coalesce(p_context->>'rowId', ''),
      'sourceLabel', coalesce(p_config->>'sourceLabel', v_title),
      'requiresManagementSignOff', false
    );
    perform public.workflow_append_task(p_org_id, v_task);

  elsif p_step_type = 'create_deviation' then
    v_sev := coalesce(p_config->>'severity', 'medium');
    insert into public.deviations
      (organization_id, source, source_id, title, description, severity, status)
    values (
      p_org_id,
      'workflow',
      (p_context->>'rowId')::uuid,
      coalesce(p_config->>'title', 'Avvik fra arbeidsflyt'),
      coalesce(p_config->>'description', ''),
      v_sev::public.inspection_finding_severity,
      'rapportert'
    );

  else
    insert into public.workflow_action_queue
      (organization_id, rule_id, step_id, step_type, config_json, context_json,
       execute_after, status)
    values (
      p_org_id, p_rule_id, p_step_id, p_step_type, p_config, p_context,
      now(), 'pending'
    );
  end if;
end;
$$;

create or replace function public.execute_inspection_finding_rule_actions(
  p_org_id            uuid,
  p_rule_id           uuid,
  p_actions           jsonb,
  p_finding_id        uuid,
  p_finding_desc      text,
  p_finding_severity  text,
  p_finding_created_by uuid,
  p_round_id          uuid,
  p_round_title       text,
  p_round_assigned_to uuid,
  p_item_label        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a              jsonb;
  v_dev_id       uuid := null;
  v_due_days     int;
  v_assign_round bool;
  v_title        text;
begin
  if jsonb_typeof(p_actions) = 'object'
     and coalesce(p_actions->>'mode', '') = 'xor_branches'
  then
    perform public.workflow_execute_actions(
      p_org_id, p_rule_id, p_actions,
      jsonb_build_object(
        'module',    'inspection',
        'sourceId',  p_finding_id::text,
        'severity',  p_finding_severity
      )
    );
    return null;
  end if;

  if jsonb_typeof(p_actions) <> 'array' then
    return null;
  end if;

  for a in select * from jsonb_array_elements(p_actions)
  loop
    case coalesce(a->>'type', '')

    when 'create_deviation' then
      if v_dev_id is null then
        v_due_days     := coalesce((a->>'dueInDays')::int, 1);
        v_assign_round := coalesce((a->>'assignFromRound')::boolean, true);
        v_title        := coalesce(
          nullif(trim(a->>'titlePrefix'), ''),
          p_round_title
        ) || ' — inspeksjonsfunn';

        insert into public.deviations (
          organization_id,
          source,
          source_id,
          title,
          description,
          severity,
          status,
          due_at,
          created_by
        ) values (
          p_org_id,
          'inspection_finding',
          p_finding_id,
          v_title,
          p_finding_desc,
          p_finding_severity::public.inspection_finding_severity,
          'rapportert',
          now() + (v_due_days || ' days')::interval,
          p_finding_created_by
        )
        returning id into v_dev_id;
      end if;

    when 'create_task' then
      v_due_days     := coalesce((a->>'dueInDays')::int, (a->>'dueDays')::int, 1);
      v_assign_round := coalesce((a->>'assignFromRound')::boolean, true);

      insert into public.tasks (
        organization_id,
        source,
        source_id,
        title,
        description,
        assigned_to,
        due_at,
        status,
        priority,
        created_by
      ) values (
        p_org_id,
        'inspection_finding',
        p_finding_id,
        coalesce(nullif(trim(a->>'title'), ''), 'Løs inspeksjonsfunn'),
        p_finding_desc
          || case when p_item_label is not null
               then E'\n\nSjekkliste-punkt: ' || p_item_label
               else ''
             end
          || E'\n\nRunde: ' || p_round_title,
        case when v_assign_round then p_round_assigned_to else null end,
        now() + (v_due_days || ' days')::interval,
        'todo',
        coalesce(nullif(trim(a->>'priority'), ''), 'high'),
        p_finding_created_by
      );

    else
      perform public.workflow_execute_actions(
        p_org_id, p_rule_id, jsonb_build_array(a),
        jsonb_build_object(
          'module',    'inspection',
          'sourceId',  p_finding_id::text,
          'severity',  p_finding_severity
        )
      );

    end case;
  end loop;

  return v_dev_id;
end;
$$;
