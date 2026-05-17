-- Invariant: workflow_runs SELECT policy hides confidentiality_level='confidential'
-- rows from org-admins lacking workflows.view_confidential.
-- The bypass paths are (a) holding the strict permission OR (b) being the run's
-- own actor_id. workflow_run_evidence inherits the gate via EXISTS on the run.
-- Covers _20260907120200_workflow_confidentiality_strict.sql.

begin;
select plan(5);

set local role postgres;

do $$
declare
  v_org_a   uuid := public.setup_test_org('confidential-a');
  v_org_b   uuid := public.setup_test_org('confidential-b');
  -- Org admin in org_a, no workflows.view_confidential.
  v_admin   uuid := public.setup_test_user('admin@pgtap.test', v_org_a);
  -- Permitted user (has workflows.view_confidential explicitly).
  v_viewer  uuid := public.setup_test_user('viewer@pgtap.test', v_org_a);
  -- Run actor — can always see their own confidential runs.
  v_actor   uuid := public.setup_test_user('actor@pgtap.test', v_org_a);
  -- Cross-org user.
  v_other   uuid := public.setup_test_user('other@pgtap.test', v_org_b);
  v_run     uuid;
begin
  update public.profiles set is_org_admin = true where id = v_admin;
  perform public.with_permission('workflows.view_confidential', v_viewer, v_org_a);

  insert into public.workflow_runs (
    organization_id, source_module, event, status, actor_id, confidentiality_level
  ) values (
    v_org_a, 'pgtap', 'payload_change', 'completed', v_actor, 'confidential'
  )
  returning id into v_run;

  -- One piece of evidence on that run.
  insert into public.workflow_run_evidence (
    run_id, rule_id, organization_id,
    artefact_kind, storage_path, storage_bucket,
    sha256_checksum, chain_root_checksum
  ) values (
    v_run, null, v_org_a,
    'generated_pdf', 'pgtap/conf.pdf', 'workflow-evidence',
    'deadbeef', 'deadbeef'
  );

  perform set_config('pgtap.org_a',  v_org_a::text,  true);
  perform set_config('pgtap.org_b',  v_org_b::text,  true);
  perform set_config('pgtap.admin',  v_admin::text,  true);
  perform set_config('pgtap.viewer', v_viewer::text, true);
  perform set_config('pgtap.actor',  v_actor::text,  true);
  perform set_config('pgtap.other',  v_other::text,  true);
  perform set_config('pgtap.run',    v_run::text,    true);
end$$;

-- (1) Org admin without workflows.view_confidential: sees 0.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('pgtap.admin'),  true);
select set_config('app.current_org_id',    current_setting('pgtap.org_a'), true);

select is(
  (select count(*)::int from public.workflow_runs
    where confidentiality_level = 'confidential'
      and id = current_setting('pgtap.run')::uuid),
  0,
  'org admin without workflows.view_confidential sees 0 confidential runs'
);

-- (2) Same query as the permitted viewer: sees 1.
reset role; set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('pgtap.viewer'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org_a'),  true);

select is(
  (select count(*)::int from public.workflow_runs
    where confidentiality_level = 'confidential'
      and id = current_setting('pgtap.run')::uuid),
  1,
  'user with workflows.view_confidential sees the confidential run'
);

-- (3) Run actor sees their own run even without the permission.
reset role; set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('pgtap.actor'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org_a'), true);

select is(
  (select count(*)::int from public.workflow_runs
    where id = current_setting('pgtap.run')::uuid
      and actor_id = current_setting('pgtap.actor')::uuid),
  1,
  'run actor sees their own confidential run via actor_id bypass'
);

-- (4) Cross-org user (in org_b) sees 0.
reset role; set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('pgtap.other'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org_b'), true);

select is(
  (select count(*)::int from public.workflow_runs
    where id = current_setting('pgtap.run')::uuid),
  0,
  'cross-org user sees 0 runs (organization_id predicate)'
);

-- (5) workflow_run_evidence inherits the gate: the same admin sees 0 rows.
reset role; set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('pgtap.admin'), true);
select set_config('app.current_org_id',    current_setting('pgtap.org_a'), true);

select is(
  (select count(*)::int from public.workflow_run_evidence
    where run_id = current_setting('pgtap.run')::uuid),
  0,
  'workflow_run_evidence inherits the confidentiality gate'
);

reset role;
select * from finish();
rollback;
