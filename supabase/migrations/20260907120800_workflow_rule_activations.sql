-- workflow_rule_activations: dual-approver audit row required to activate a
-- gov-action workflow rule (any rule whose actions_json contains a
-- regulator-facing action such as Arbeidstilsynet / Datatilsynet / Altinn /
-- NAV / LDO).
--
-- Closes IK-f §5 nr. 4 (fordeling av ansvar) gap: a single org-admin could
-- previously flip is_active on a rule that dispatches gov reports. Spec §4
-- Phase E requires AML §5-2 (gov-rapportering skal være tilbørlig styre-
-- godkjent) and GDPR Art. 24 (accountability — documented authorisation).

-- ---------------------------------------------------------------------------
-- 1. Activation-audit table. organization_id on delete RESTRICT so the
--    audit trail cannot be wiped by a tenant cascade (paired with the
--    retention migration _120900). rule_id cascades because deleting the
--    rule itself is a deliberate compose-time action.
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_rule_activations (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid not null references public.workflow_rules (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  requested_by      uuid not null references public.profiles (id),
  requested_at      timestamptz not null default now(),
  approver_user_id  uuid references public.profiles (id),
  approved_at       timestamptz,
  revoked_by        uuid references public.profiles (id),
  revoked_at        timestamptz,
  is_gov_action     boolean not null default false,
  reason            text,
  actions_snapshot  jsonb,
  unique (rule_id, requested_at)
);

create index if not exists workflow_rule_activations_rule_idx
  on public.workflow_rule_activations (rule_id, requested_at desc);

create index if not exists workflow_rule_activations_org_idx
  on public.workflow_rule_activations (organization_id, requested_at desc);

create index if not exists workflow_rule_activations_pending_idx
  on public.workflow_rule_activations (rule_id)
  where approved_at is null and revoked_at is null;

alter table public.workflow_rule_activations enable row level security;

-- SELECT: any org member can see activation audit rows for their org.
drop policy if exists "workflow_rule_activations_select" on public.workflow_rule_activations;
create policy "workflow_rule_activations_select"
  on public.workflow_rule_activations for select
  using (organization_id = public.current_org_id());

-- INSERT: caller must hold workflows.activate OR workflows.activate_external,
-- must be inserting a row for their own org, and must mark themselves as
-- requester. The approve_at path (separate UPDATE policy) enforces the
-- different-person rule.
drop policy if exists "workflow_rule_activations_insert" on public.workflow_rule_activations;
create policy "workflow_rule_activations_insert"
  on public.workflow_rule_activations for insert
  with check (
    organization_id = public.current_org_id()
    and requested_by = (select auth.uid())
    and (
      public.workflow_can_activate_internal()
      or public.workflow_can_activate_external()
    )
    and approver_user_id is null
    and approved_at is null
  );

-- UPDATE: only the approval/revocation fields can be touched, and only by
-- a user that is NOT the requester. RLS check + a BEFORE-UPDATE trigger
-- pin the immutable columns (defence-in-depth).
drop policy if exists "workflow_rule_activations_update" on public.workflow_rule_activations;
create policy "workflow_rule_activations_update"
  on public.workflow_rule_activations for update
  using (
    organization_id = public.current_org_id()
    and (select auth.uid()) <> requested_by
    and (
      public.workflow_can_activate_internal()
      or public.workflow_can_activate_external()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (select auth.uid()) <> requested_by
  );

-- DELETE: never.
drop policy if exists "workflow_rule_activations_no_delete" on public.workflow_rule_activations;
create policy "workflow_rule_activations_no_delete"
  on public.workflow_rule_activations for delete
  using (false);

-- Immutability: only approver_user_id / approved_at / revoked_by / revoked_at
-- may change after insert.
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
     or new.reason is distinct from old.reason then
    raise exception 'workflow_rule_activations: immutable column changed (only approval/revocation fields may be updated)';
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_rule_activations_pin on public.workflow_rule_activations;
create trigger workflow_rule_activations_pin
  before update on public.workflow_rule_activations
  for each row execute function public.trg_workflow_rule_activations_pin_columns();

comment on table public.workflow_rule_activations is
  'Dual-approver audit log for workflow_rules activations. Gov-action rules require a row here with approver_user_id != requested_by, approved within 7 days, and actions_snapshot matching the live rule. AML §5-2 / IK-f §5 nr. 4 / GDPR Art. 24.';

-- ---------------------------------------------------------------------------
-- 2. Tighten the activation guard. Re-creates the function defined in
--    _20260905120900_workflow_permissions.sql:168-228 verbatim, then adds
--    the dual-approver requirement for gov-action rules.
-- ---------------------------------------------------------------------------
create or replace function public.trg_workflow_rules_activation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_gov  boolean;
  v_actions jsonb;
  v_match   record;
begin
  -- Activating now? (INSERT with is_active=true, or UPDATE flipping to true)
  if not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active then
    -- already active; no activation event
    return new;
  end if;

  -- Inspect actions for any gov-type action.
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
  -- XOR branches envelope: scan the nested branches.
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

    -- Dual-approver: must have a workflow_rule_activations row for this
    -- rule with a different approver, approved within the last 7 days,
    -- and the actions_snapshot must still match the live actions_json
    -- (the rule cannot have been edited since approval).
    select a.*
      into v_match
      from public.workflow_rule_activations a
     where a.rule_id = new.id
       and a.approved_at is not null
       and a.revoked_at is null
       and a.approver_user_id is not null
       and a.approver_user_id <> a.requested_by
       and a.approved_at > now() - interval '7 days'
       and a.actions_snapshot = new.actions_json
     order by a.approved_at desc
     limit 1;

    if v_match is null then
      raise exception 'workflow.dual_approver_required: gov-action rule needs a second approver in workflow_rule_activations'
        using hint = 'Call workflow_request_activation, then a different user must call workflow_approve_activation, both within 7 days and against the current actions_json.';
    end if;
  else
    if not public.workflow_can_activate_internal() then
      raise exception 'Activating a rule requires the workflows.activate permission';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger binding unchanged (recreate idempotently in case migration is replayed).
drop trigger if exists workflow_rules_activation_guard on public.workflow_rules;
create trigger workflow_rules_activation_guard
  before insert or update of is_active, actions_json on public.workflow_rules
  for each row execute function public.trg_workflow_rules_activation_guard();

-- ---------------------------------------------------------------------------
-- 3. Helper RPC: requester opens an activation audit row.
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
begin
  if v_uid is null then
    raise exception 'workflow_request_activation: not authenticated' using errcode = '42501';
  end if;

  select id, organization_id, actions_json
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

  insert into public.workflow_rule_activations (
    rule_id, organization_id, requested_by, is_gov_action, reason, actions_snapshot
  ) values (
    v_rule.id, v_rule.organization_id, v_uid, v_is_gov, p_reason, v_rule.actions_json
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.workflow_request_activation(uuid, text) from public;
grant execute on function public.workflow_request_activation(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Helper RPC: a different user approves (or rejects) the request.
--    p_approve=false marks the row revoked so it can never satisfy the
--    activation guard.
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
  v_requester_perm boolean;
  v_caller_perm    boolean;
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

  -- Caller must hold the same activation permission tier as the request
  -- demands. Gov-action requests need workflows.activate_external on both
  -- requester and approver; internal requests need workflows.activate.
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
    update public.workflow_rule_activations
       set approver_user_id = v_uid,
           approved_at      = now(),
           reason           = coalesce(reason, '') ||
                              case when p_note is null then '' else E'\n[approve] ' || p_note end
     where id = p_activation_id;
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
  'Opens a workflow_rule_activations row as the requester. Snapshots actions_json so the activation guard can detect tampering after approval.';
comment on function public.workflow_approve_activation(uuid, boolean, text) is
  'Approves or revokes a workflow_rule_activations row. Caller must differ from requester and hold the same activate-tier permission. Required by trg_workflow_rules_activation_guard for gov-action rules.';

do $$
begin
  raise notice 'workflow_rule_activations + dual-approver guard installed';
end
$$;
