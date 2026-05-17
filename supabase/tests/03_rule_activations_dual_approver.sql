-- Invariant: workflow_rule_activations enforces approver != requester
-- and the dual-approver guard in trg_workflow_rules_activation_guard
-- lets a properly-approved gov-action rule activate.
-- Covers _20260907120800_workflow_rule_activations.sql
--      + _20260907121200_workflow_activation_guard_hardening.sql.

begin;
select plan(4);

set local role postgres;

do $$
declare
  v_org    uuid := public.setup_test_org('rule-activations');
  v_user_a uuid := public.setup_test_user('alice@pgtap.test', v_org);
  v_user_b uuid := public.setup_test_user('bob@pgtap.test',   v_org);
  v_rule   uuid;
begin
  perform public.with_permission('workflows.activate_external', v_user_a, v_org);
  perform public.with_permission('workflows.activate_external', v_user_b, v_org);

  insert into public.workflow_rules (
    organization_id, slug, name, source_module, actions_json, is_active
  )
  values (
    v_org, 'pgtap-gov-rule', 'pgtap gov rule', 'pgtap',
    '[{"type":"meld_personvernbrudd_datatilsynet"}]'::jsonb,
    false
  )
  on conflict (organization_id, slug) do update
    set actions_json = excluded.actions_json,
        is_active    = false
  returning id into v_rule;

  perform set_config('pgtap.org',  v_org::text,    true);
  perform set_config('pgtap.ua',   v_user_a::text, true);
  perform set_config('pgtap.ub',   v_user_b::text, true);
  perform set_config('pgtap.rule', v_rule::text,   true);
end$$;

-- (1) User A requests activation.
do $$
declare
  v_activation uuid;
begin
  perform set_config('request.jwt.claim.sub', current_setting('pgtap.ua'), true);
  perform set_config('app.current_org_id',    current_setting('pgtap.org'), true);
  v_activation := public.workflow_request_activation(
    current_setting('pgtap.rule')::uuid,
    'pgtap requested'
  );
  perform set_config('pgtap.activation', v_activation::text, true);
end$$;

select isnt(
  current_setting('pgtap.activation'), '',
  'user A requests activation → returns activation_id'
);

-- (2) User A self-approves → must throw with approver_must_differ-style msg.
select set_config('request.jwt.claim.sub', current_setting('pgtap.ua'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org'), true);
select throws_like(
  format(
    $f$select public.workflow_approve_activation(%L::uuid, true, null)$f$,
    current_setting('pgtap.activation')
  ),
  '%requester cannot self-approve%',
  'requester self-approval is blocked at the RPC layer'
);

-- (3) User B approves successfully.
select set_config('request.jwt.claim.sub', current_setting('pgtap.ub'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org'), true);
select lives_ok(
  format(
    $f$select public.workflow_approve_activation(%L::uuid, true, 'pgtap approved')$f$,
    current_setting('pgtap.activation')
  ),
  'user B (different from requester) approves successfully'
);

-- (4) With the dual-approver row in place, flipping is_active=true
--     no longer trips trg_workflow_rules_activation_guard.
select lives_ok(
  $sql$
    update public.workflow_rules
       set is_active = true
     where id = current_setting('pgtap.rule')::uuid
  $sql$,
  'gov-action rule activates once dual-approver row exists'
);

select * from finish();
rollback;
