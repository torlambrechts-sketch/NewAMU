-- Replaces the hardcoded inspection finding trigger with a rule-driven version.
-- Active workflow_rules where source_module = 'inspection' are evaluated on every
-- inspection_findings INSERT. A default rule seeds existing orgs so existing
-- critical-finding behaviour is preserved without any manual configuration.
--
-- New action types supported in execute_inspection_finding_rule_actions():
--   create_deviation  → inserts into public.deviations
--   create_task       → inserts into public.tasks (direct row, not JSON append)
--   (others)          → delegated to workflow_execute_actions()

-- ── 1. Per-rule action executor for inspection findings ────────────────────

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
  p_item_label        text   -- nullable
)
returns uuid   -- first deviation_id created by this rule, or null
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
  -- XOR-branches envelope: delegate entirely to the generic executor
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
      -- Only one deviation per rule execution
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
          'open',
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
      -- send_email, send_notification, call_webhook, log_only → generic executor
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

-- ── 2. Rewrite process_inspection_finding_workflow() ──────────────────────
--
-- Queries workflow_rules (source_module = 'inspection', trigger_on in
-- ('insert','both'), is_active = true) and evaluates each rule's condition
-- against the finding row as JSONB.  The hardcoded critical-only guard is
-- removed — the seeded default rule below preserves that behaviour.

create or replace function public.process_inspection_finding_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round       record;
  v_item        record;
  v_rule        record;
  v_finding_json jsonb;
  v_matched     boolean;
  v_dev_id      uuid := null;
  v_rule_dev_id uuid;
begin
  -- Skip if already workflow-processed (idempotency guard)
  if new.deviation_id is not null then
    return new;
  end if;

  -- Load round and (optional) checklist item
  select r.* into v_round
  from public.inspection_rounds r
  where r.id = new.round_id;

  select i.* into v_item
  from public.inspection_items i
  where i.id = new.item_id;

  -- Build JSONB representation of the finding for condition evaluation
  v_finding_json := jsonb_build_object(
    'id',              new.id,
    'severity',        new.severity::text,
    'description',     new.description,
    'round_id',        new.round_id,
    'item_id',         new.item_id,
    'organization_id', new.organization_id,
    'created_by',      new.created_by,
    'photo_path',      new.photo_path
  );

  -- Iterate over active rules for this org + module, priority ASC
  for v_rule in
    select *
    from public.workflow_rules
    where organization_id = new.organization_id
      and source_module    = 'inspection'
      and is_active        = true
      and trigger_on       in ('insert', 'both')
    order by priority asc, created_at asc
  loop
    begin
      v_matched := public.workflow_payload_matches_condition(
        v_rule.condition_json, v_finding_json, null, 'insert'
      );

      if not v_matched then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, v_rule.id, 'inspection', 'payload_change',
          'skipped',
          jsonb_build_object('reason', 'condition_not_met', 'finding_id', new.id)
        );
        continue;
      end if;

      v_rule_dev_id := public.execute_inspection_finding_rule_actions(
        new.organization_id,
        v_rule.id,
        v_rule.actions_json,
        new.id,
        new.description,
        new.severity::text,
        new.created_by,
        new.round_id,
        coalesce(v_round.title, 'Inspeksjonsrunde'),
        v_round.assigned_to,
        case when v_item.id is not null then v_item.checklist_item_label else null end
      );

      -- First deviation wins (sets finding.deviation_id)
      if v_rule_dev_id is not null and v_dev_id is null then
        v_dev_id := v_rule_dev_id;
      end if;

      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'inspection', 'payload_change',
        'completed',
        jsonb_build_object(
          'finding_id',   new.id,
          'round_id',     new.round_id,
          'severity',     new.severity,
          'deviation_id', v_rule_dev_id
        )
      );

    exception when others then
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'inspection', 'payload_change',
        'failed',
        jsonb_build_object('finding_id', new.id, 'error', sqlerrm)
      );
    end;
  end loop;

  -- Stamp the finding if any rule ran (with or without deviation)
  if v_dev_id is not null then
    update public.inspection_findings
    set deviation_id         = v_dev_id,
        workflow_processed_at = now(),
        updated_at            = now()
    where id = new.id;
  else
    -- Mark processed so future re-inserts are skipped cleanly
    update public.inspection_findings
    set workflow_processed_at = now(),
        updated_at            = now()
    where id = new.id
      and workflow_processed_at is null;
  end if;

  return new;

exception when others then
  insert into public.workflow_runs (
    organization_id, rule_id, source_module, event, status, detail
  ) values (
    new.organization_id, null, 'inspection', 'payload_change',
    'failed',
    jsonb_build_object('finding_id', new.id, 'error', sqlerrm)
  );
  return new;
end;
$$;

-- Trigger already exists from Phase 3 migration — recreate to pick up new function
drop trigger if exists inspection_findings_workflow_tg on public.inspection_findings;
create trigger inspection_findings_workflow_tg
  after insert on public.inspection_findings
  for each row execute function public.process_inspection_finding_workflow();

-- ── 3. Seed default rule for every existing org ────────────────────────────
--
-- Preserves pre-migration behaviour: critical finding → deviation + high-priority task.
-- is_template = false so it shows as a live rule (not a draft in the templates tab).
-- ON CONFLICT DO NOTHING so re-running the migration is safe.

insert into public.workflow_rules (
  organization_id,
  slug,
  name,
  description,
  source_module,
  trigger_on,
  is_active,
  condition_json,
  actions_json,
  priority,
  is_template
)
select
  o.id,
  'inspection_critical_finding',
  'Kritisk inspeksjonsfunn → avvik + oppgave',
  'Standard-regel: kritiske funn oppretter automatisk et avvik og en høy-prioritets oppgave tildelt rundeeier.',
  'inspection',
  'insert',
  true,
  '{"match":"field_equals","path":"severity","value":"critical"}'::jsonb,
  '[{"type":"create_deviation","dueInDays":1,"assignFromRound":true},{"type":"create_task","title":"Løs kritisk inspeksjonsfunn","dueInDays":1,"priority":"high","assignFromRound":true}]'::jsonb,
  100,
  false
from public.organizations o
on conflict (organization_id, slug) do nothing;

-- Also seed a high-severity rule (inactive by default — org activates if desired)
insert into public.workflow_rules (
  organization_id,
  slug,
  name,
  description,
  source_module,
  trigger_on,
  is_active,
  condition_json,
  actions_json,
  priority,
  is_template
)
select
  o.id,
  'inspection_high_finding',
  'Høy-alvor inspeksjonsfunn → oppgave',
  'Valgfri regel: høy-alvor funn oppretter en oppgave tildelt rundeeier. Aktiver under Arbeidsflyt når ønskelig.',
  'inspection',
  'insert',
  false,   -- off by default; org turns it on
  '{"match":"field_equals","path":"severity","value":"high"}'::jsonb,
  '[{"type":"create_task","title":"Følg opp høy-alvor inspeksjonsfunn","dueInDays":3,"priority":"high","assignFromRound":true}]'::jsonb,
  200,
  false
from public.organizations o
on conflict (organization_id, slug) do nothing;
