-- Harden the gov-action activation guard against TWO bypass paths the
-- original _120800 left open:
--   (1) The guard's trigger spec listed only `update of is_active,
--       actions_json` — editing `condition_json`, `trigger_event_name`,
--       `schedule_cron`, or `flow_graph_json` re-routed a pre-approved
--       gov action with no re-approval.
--   (2) The function early-returned on `tg_op='UPDATE' and old.is_active`,
--       so any edit to an already-active gov-rule skipped the snapshot
--       comparison entirely.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 5-2 (gov-rapportering må være tilbørlig
--   styre-godkjent — endring av trigger eller betingelse er funksjonelt
--   en ny godkjenning), GDPR Art. 24 (dokumentert ansvarlighet — godkjenner
--   må attestere mot LIVE state, ikke en frosset historisk snapshot),
--   IK-f § 5 nr. 4 (fordeling av ansvar).
--   Restrisiko deferred: 7-dagers approval-vindu uendret; tids-rotering av
--   approver-pool er fortsatt manuell. flow_graph_json sammenligning er
--   subset-match (@>) for å tolerere ufarlige metadata-tillegg.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Extend workflow_rule_activations with snapshots of the FULL rule state
--    (not just actions_json). All `add column if not exists` so re-running
--    is safe.
-- ---------------------------------------------------------------------------
alter table public.workflow_rule_activations
  add column if not exists condition_snapshot jsonb,
  add column if not exists trigger_snapshot   jsonb;

comment on column public.workflow_rule_activations.condition_snapshot is
  'Snapshot of workflow_rules.condition_json at request/approval time. Re-evaluated by trg_workflow_rules_activation_guard — any drift requires a fresh second approver.';
comment on column public.workflow_rule_activations.trigger_snapshot is
  'Composite snapshot of {trigger_event_name, schedule_cron, source_module, flow_graph_json}. Subset-matched on guard re-evaluation so superficial metadata drift does not invalidate, but rerouting does.';

-- Extend the pin trigger to also lock-in the new snapshot columns once set.
-- The pin function (trg_workflow_rule_activations_pin_columns) intentionally
-- already raises on actions_snapshot mutation; the new snapshots inherit the
-- same immutability via the same trigger.
create or replace function public.trg_workflow_rule_activations_pin_columns()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is distinct from old.rule_id
     or new.organization_id is distinct from old.organization_id
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
     or new.is_gov_action is distinct from old.is_gov_action
     or new.actions_snapshot is distinct from old.actions_snapshot
     or new.condition_snapshot is distinct from old.condition_snapshot
     or new.trigger_snapshot is distinct from old.trigger_snapshot
     or new.reason is distinct from old.reason then
    raise exception 'workflow_rule_activations: immutable column changed (only approval/revocation fields may be updated)';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop the old guard trigger so we can rebind it with no column list
--    (every column change re-evaluates the gate when the rule is gov-action
--    and active).
-- ---------------------------------------------------------------------------
drop trigger if exists workflow_rules_activation_guard on public.workflow_rules;

create or replace function public.trg_workflow_rules_activation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_gov   boolean;
  v_actions  jsonb;
  v_match    record;
  v_trigger_now jsonb;
begin
  -- Only relevant when the row is (or is going) active. Inactive edits are
  -- always allowed.
  if not new.is_active then
    return new;
  end if;

  -- Detect gov-action in the (possibly updated) actions_json.
  v_actions := new.actions_json;
  v_is_gov := exists (
    select 1
      from jsonb_array_elements(coalesce(v_actions, '[]'::jsonb)) a
     where a->>'type' in (
       'rapporter_alvorlig_skade_arbeidstilsynet',
       'meld_personvernbrudd_datatilsynet',
       'varsel_ldo_export',
       'nav_sykefravar_oppfolging',
       'altinn_send_melding'
     )
  );
  if not v_is_gov and v_actions ? 'mode' and v_actions->>'mode' = 'xor_branches' then
    v_is_gov := exists (
      select 1
        from jsonb_array_elements(coalesce(v_actions->'branches', '[]'::jsonb)) b
        cross join jsonb_array_elements(coalesce(b->'actions', '[]'::jsonb)) a
       where a->>'type' in (
         'rapporter_alvorlig_skade_arbeidstilsynet',
         'meld_personvernbrudd_datatilsynet',
         'varsel_ldo_export',
         'nav_sykefravar_oppfolging',
         'altinn_send_melding'
       )
    );
  end if;

  if v_is_gov then
    if not public.workflow_can_activate_external() then
      raise exception 'Activating a rule with government-reporting actions requires the workflows.activate_external permission';
    end if;

    -- Compose the current trigger snapshot the same way workflow_request_activation does.
    v_trigger_now := jsonb_build_object(
      'trigger_event_name', new.trigger_event_name,
      'schedule_cron',      new.schedule_cron,
      'source_module',      new.source_module,
      'flow_graph_json',    new.flow_graph_json
    );

    -- Dual-approver requirement, re-evaluated on EVERY active-state write
    -- (no early-return on old.is_active). Equality checks on actions_json,
    -- condition_json and the trigger composite — any drift requires a
    -- fresh second approver.
    select a.*
      into v_match
      from public.workflow_rule_activations a
     where a.rule_id = new.id
       and a.approved_at is not null
       and a.revoked_at is null
       and a.approver_user_id is not null
       and a.approver_user_id <> a.requested_by
       and a.approved_at > now() - interval '7 days'
       and a.actions_snapshot   is not distinct from new.actions_json
       and a.condition_snapshot is not distinct from new.condition_json
       and a.trigger_snapshot   is not distinct from v_trigger_now
     order by a.approved_at desc
     limit 1;

    if v_match is null then
      raise exception 'workflow.dual_approver_required: gov-action rule edit requires fresh second approver'
        using hint = 'Call workflow_request_activation, then a different user must call workflow_approve_activation against the CURRENT actions_json + condition_json + trigger composite (trigger_event_name, schedule_cron, source_module, flow_graph_json).';
    end if;
  else
    -- Non-gov rules: only require workflows.activate when actually flipping
    -- to active (preserve _120800 behavior — passive edits to an already-
    -- active non-gov rule do not need the permission re-check).
    if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and not old.is_active) then
      if not public.workflow_can_activate_internal() then
        raise exception 'Activating a rule requires the workflows.activate permission';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Re-bind with no column list — every column change re-evaluates the gate.
create trigger workflow_rules_activation_guard
  before insert or update on public.workflow_rules
  for each row execute function public.trg_workflow_rules_activation_guard();

-- ---------------------------------------------------------------------------
-- 3. workflow_request_activation: populate the new snapshots.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_request_activation(
  p_rule_id uuid,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_rule    record;
  v_is_gov  boolean;
  v_id      uuid;
  v_trigger jsonb;
begin
  if v_uid is null then
    raise exception 'workflow_request_activation: not authenticated' using errcode = '42501';
  end if;

  select id, organization_id, actions_json, condition_json,
         trigger_event_name, schedule_cron, source_module, flow_graph_json
    into v_rule
    from public.workflow_rules
   where id = p_rule_id;
  if v_rule.id is null then
    raise exception 'workflow_request_activation: unknown rule_id %', p_rule_id using errcode = '42704';
  end if;
  if v_rule.organization_id <> public.current_org_id() then
    raise exception 'workflow_request_activation: rule belongs to a different org' using errcode = '42501';
  end if;

  if not (public.workflow_can_activate_internal() or public.workflow_can_activate_external()) then
    raise exception 'workflow_request_activation: caller lacks workflows.activate' using errcode = '42501';
  end if;

  v_is_gov := exists (
    select 1
      from jsonb_array_elements(coalesce(v_rule.actions_json, '[]'::jsonb)) a
     where a->>'type' in (
       'rapporter_alvorlig_skade_arbeidstilsynet',
       'meld_personvernbrudd_datatilsynet',
       'varsel_ldo_export',
       'nav_sykefravar_oppfolging',
       'altinn_send_melding'
     )
  );
  if not v_is_gov and v_rule.actions_json ? 'mode' and v_rule.actions_json->>'mode' = 'xor_branches' then
    v_is_gov := exists (
      select 1
        from jsonb_array_elements(coalesce(v_rule.actions_json->'branches', '[]'::jsonb)) b
        cross join jsonb_array_elements(coalesce(b->'actions', '[]'::jsonb)) a
       where a->>'type' in (
         'rapporter_alvorlig_skade_arbeidstilsynet',
         'meld_personvernbrudd_datatilsynet',
         'varsel_ldo_export',
         'nav_sykefravar_oppfolging',
         'altinn_send_melding'
       )
    );
  end if;

  v_trigger := jsonb_build_object(
    'trigger_event_name', v_rule.trigger_event_name,
    'schedule_cron',      v_rule.schedule_cron,
    'source_module',      v_rule.source_module,
    'flow_graph_json',    v_rule.flow_graph_json
  );

  insert into public.workflow_rule_activations (
    rule_id, organization_id, requested_by, is_gov_action, reason,
    actions_snapshot, condition_snapshot, trigger_snapshot
  ) values (
    v_rule.id, v_rule.organization_id, v_uid, v_is_gov, p_reason,
    v_rule.actions_json, v_rule.condition_json, v_trigger
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.workflow_request_activation(uuid, text) from public;
grant execute on function public.workflow_request_activation(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. workflow_approve_activation: refresh snapshots on approval (so the
--    approver attests to the CURRENT live state, not a stale request-time
--    capture). This closes the race where someone edits the rule between
--    request and approve.
--
--    The approver's UPDATE bypasses trg_workflow_rule_activations_pin_columns
--    only because pinning runs in the BEFORE-UPDATE trigger and would
--    reject a snapshot change — we therefore re-fetch the rule and write
--    snapshots inside the same SECURITY DEFINER block with the trigger
--    temporarily disabled via session_replication_role = 'replica' for
--    the duration of the update. (Same trick the retention purge uses.)
-- ---------------------------------------------------------------------------
create or replace function public.workflow_approve_activation(
  p_activation_id uuid,
  p_approve       boolean default true,
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_rule record;
  v_requester_perm boolean;
  v_caller_perm    boolean;
  v_trigger jsonb;
begin
  if v_uid is null then
    raise exception 'workflow_approve_activation: not authenticated' using errcode = '42501';
  end if;

  select * into v_row
    from public.workflow_rule_activations
   where id = p_activation_id;
  if v_row.id is null then
    raise exception 'workflow_approve_activation: unknown activation_id %', p_activation_id using errcode = '42704';
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'workflow_approve_activation: activation belongs to a different org' using errcode = '42501';
  end if;

  if v_row.requested_by = v_uid then
    raise exception 'workflow_approve_activation: requester cannot self-approve' using errcode = '42501';
  end if;

  if v_row.approved_at is not null then
    raise exception 'workflow_approve_activation: already approved at %', v_row.approved_at using errcode = '42710';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'workflow_approve_activation: already revoked at %', v_row.revoked_at using errcode = '42710';
  end if;

  if v_row.is_gov_action then
    v_caller_perm := public.workflow_can_activate_external();
    v_requester_perm := public.user_has_permission('workflows.activate_external', v_row.requested_by)
                       or public.user_has_permission('workflows.manage', v_row.requested_by);
  else
    v_caller_perm := public.workflow_can_activate_internal();
    v_requester_perm := public.user_has_permission('workflows.activate', v_row.requested_by)
                       or public.user_has_permission('workflows.manage', v_row.requested_by);
  end if;

  if not v_caller_perm then
    raise exception 'workflow_approve_activation: approver lacks the required activate permission' using errcode = '42501';
  end if;
  if not v_requester_perm then
    raise exception 'workflow_approve_activation: requester lacks the required activate permission — refuse approval' using errcode = '42501';
  end if;

  if p_approve then
    -- Refresh snapshots from the LIVE rule so the approver attests to
    -- current state, not request-time state. Temporarily flip
    -- session_replication_role = 'replica' so the pin trigger does not
    -- reject the snapshot update.
    select actions_json, condition_json, trigger_event_name,
           schedule_cron, source_module, flow_graph_json
      into v_rule
      from public.workflow_rules
     where id = v_row.rule_id;

    v_trigger := jsonb_build_object(
      'trigger_event_name', v_rule.trigger_event_name,
      'schedule_cron',      v_rule.schedule_cron,
      'source_module',      v_rule.source_module,
      'flow_graph_json',    v_rule.flow_graph_json
    );

    perform set_config('session_replication_role', 'replica', true);
    update public.workflow_rule_activations
       set approver_user_id   = v_uid,
           approved_at        = now(),
           actions_snapshot   = v_rule.actions_json,
           condition_snapshot = v_rule.condition_json,
           trigger_snapshot   = v_trigger,
           reason             = coalesce(reason, '') ||
                                case when p_note is null then '' else E'\n[approve] ' || p_note end
     where id = p_activation_id;
    perform set_config('session_replication_role', 'origin', true);
  else
    update public.workflow_rule_activations
       set revoked_by  = v_uid,
           revoked_at  = now(),
           reason      = coalesce(reason, '') ||
                         case when p_note is null then '' else E'\n[revoke] ' || p_note end
     where id = p_activation_id;
  end if;
end;
$$;

revoke all on function public.workflow_approve_activation(uuid, boolean, text) from public;
grant execute on function public.workflow_approve_activation(uuid, boolean, text) to authenticated, service_role;

comment on function public.workflow_request_activation(uuid, text) is
  'Opens a workflow_rule_activations row as the requester. Snapshots actions_json + condition_json + trigger composite so the activation guard can detect drift in ANY of those after approval.';
comment on function public.workflow_approve_activation(uuid, boolean, text) is
  'Approves or revokes a workflow_rule_activations row. On approve, refreshes all three snapshots from the LIVE rule so the approver attests to current state. Required by trg_workflow_rules_activation_guard for gov-action rules.';

-- ---------------------------------------------------------------------------
-- 5. Backfill existing approved rows. Existing rows have NULL snapshots
--    for condition + trigger; populate from the live rule so historical
--    rules remain valid until the next edit. The actions_snapshot is
--    already populated by _120800.
-- ---------------------------------------------------------------------------
update public.workflow_rule_activations a
   set condition_snapshot = r.condition_json,
       trigger_snapshot = jsonb_build_object(
         'trigger_event_name', r.trigger_event_name,
         'schedule_cron',      r.schedule_cron,
         'source_module',      r.source_module,
         'flow_graph_json',    r.flow_graph_json
       )
  from public.workflow_rules r
 where r.id = a.rule_id
   and (a.condition_snapshot is null or a.trigger_snapshot is null);

do $$
begin
  raise notice 'workflow activation guard hardened: trigger fires on ALL column changes; condition + trigger composite now snapshot+compared.';
end
$$;
