-- Split workflows.manage into a finer-grained permission set.
--
-- The original migration (_20260420120001) ships one all-or-nothing key.
-- That's wrong for the engine we're building: composing a Kanban-task rule
-- has a very different blast radius from activating a rule that calls
-- Arbeidstilsynet on the org's behalf.
--
-- New keys (additive — workflows.manage stays for backward compat):
--   workflows.compose            — author + edit rule definitions
--   workflows.activate           — toggle is_active on internal rules
--   workflows.activate_external  — toggle is_active on rules with a gov action
--   workflows.view_confidential  — see body of restricted/confidential runs
--
-- For existing admins, all four new keys are seeded so rights aren't lost.
-- Member roles unchanged.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 (fordeling av ansvar);
--   personvernforordningen art. 32 (need-to-know-prinsipp på
--   varsler-/sykefraværsdata). Tidligere kunne én admin trykke gjennom
--   en regulator-melding uten dobbel godkjennelse.
--   Restrisiko deferred: BankID-mobil-signering av aktivering (Phase E).

-- Existing admins keep the new keys.
insert into public.role_permissions (role_id, permission_key)
select rd.id, k
  from public.role_definitions rd
  cross join (values
    ('workflows.compose'),
    ('workflows.activate'),
    ('workflows.activate_external'),
    ('workflows.view_confidential')
  ) as v(k)
 where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- Extend seed_default_roles_for_org so newly-onboarded orgs get the new
-- keys too. Function is recreated verbatim with the new rows appended.
create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'module.view.workflow'),
      (r_admin, 'workflows.manage'),
      (r_admin, 'workflows.compose'),
      (r_admin, 'workflows.activate'),
      (r_admin, 'workflows.activate_external'),
      (r_admin, 'workflows.view_confidential'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports'),
      (r_member, 'module.view.workflow')
    on conflict do nothing;
  end if;
end;
$$;

-- Tighten the workflow_rules write policy. Updates that touch is_active
-- must satisfy workflows.activate (or .activate_external for gov-action
-- rules); other edits are allowed under workflows.compose. The legacy
-- workflows.manage key satisfies all checks for backward compat.
create or replace function public.workflow_can_compose()
returns boolean
language sql
stable
as $$
  select public.is_org_admin()
      or public.user_has_permission('workflows.manage')
      or public.user_has_permission('workflows.compose');
$$;

create or replace function public.workflow_can_activate_internal()
returns boolean
language sql
stable
as $$
  select public.is_org_admin()
      or public.user_has_permission('workflows.manage')
      or public.user_has_permission('workflows.activate');
$$;

create or replace function public.workflow_can_activate_external()
returns boolean
language sql
stable
as $$
  select public.is_org_admin()
      or public.user_has_permission('workflows.manage')
      or public.user_has_permission('workflows.activate_external');
$$;

-- Replace the catch-all write policy with split policies.
drop policy if exists "workflow_rules_write_manage" on public.workflow_rules;

drop policy if exists "workflow_rules_compose" on public.workflow_rules;
create policy "workflow_rules_compose"
  on public.workflow_rules for all
  using (
    organization_id = public.current_org_id()
    and public.workflow_can_compose()
  )
  with check (
    organization_id = public.current_org_id()
    and public.workflow_can_compose()
    -- Activation gates: tightened below in BEFORE-UPDATE trigger so the
    -- policy stays simple. (Splitting INSERT-of-already-active from
    -- UPDATE-flip-to-active in pure RLS is awkward; the trigger guards.)
  );

-- BEFORE-UPDATE/INSERT trigger: blocks activation of a gov-action rule
-- without workflows.activate_external; blocks activation of an internal
-- rule without workflows.activate.
create or replace function public.trg_workflow_rules_activation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_gov boolean;
  v_actions jsonb;
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
  else
    if not public.workflow_can_activate_internal() then
      raise exception 'Activating a rule requires the workflows.activate permission';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists workflow_rules_activation_guard on public.workflow_rules;
create trigger workflow_rules_activation_guard
  before insert or update of is_active, actions_json on public.workflow_rules
  for each row execute function public.trg_workflow_rules_activation_guard();

comment on function public.workflow_can_activate_external() is
  'TRUE if caller can activate a rule containing gov-reporting actions. Satisfied by org_admin OR workflows.manage OR workflows.activate_external.';
