-- Invariant: workflow_record_evidence enforces tenant consistency.
-- Covers _20260907120700_workflow_evidence_org_validation.sql.
--
-- Asserted shape of the signature (unchanged from _120500):
--   workflow_record_evidence(
--     p_run_id          uuid,
--     p_rule_id         uuid,
--     p_organization_id uuid,
--     p_artefact_kind   text,
--     p_storage_path    text,
--     p_storage_bucket  text default 'workflow-evidence',
--     p_bytes_size      bigint default null,
--     p_mime_type       text default null,
--     p_sha256_checksum text default null,
--     p_law_refs        text[] default '{}',
--     p_frameworks      text[] default '{}',
--     p_metadata        jsonb default '{}'::jsonb
--   ) returns uuid

begin;
select plan(5);

-- Run as the migration owner so the security-definer body sees the
-- inserts we make below (no need to flip to authenticated).
set local role postgres;

-- Fixtures: two orgs, one rule per org, one run per org.
do $$
declare
  v_org_a uuid := public.setup_test_org('evidence-org-a');
  v_org_b uuid := public.setup_test_org('evidence-org-b');
  v_rule_a uuid;
  v_run_a  uuid;
  v_run_b  uuid;
begin
  insert into public.workflow_rules (organization_id, slug, name, source_module)
  values (v_org_a, 'pgtap-evidence-rule', 'pgtap evidence rule', 'pgtap')
  on conflict (organization_id, slug) do nothing;
  select id into v_rule_a from public.workflow_rules
    where organization_id = v_org_a and slug = 'pgtap-evidence-rule';

  insert into public.workflow_runs (organization_id, rule_id, source_module, event, status)
  values (v_org_a, v_rule_a, 'pgtap', 'payload_change', 'completed')
  returning id into v_run_a;

  insert into public.workflow_runs (organization_id, rule_id, source_module, event, status)
  values (v_org_b, null, 'pgtap', 'payload_change', 'completed')
  returning id into v_run_b;

  perform set_config('pgtap.org_a',  v_org_a::text,  true);
  perform set_config('pgtap.org_b',  v_org_b::text,  true);
  perform set_config('pgtap.rule_a', v_rule_a::text, true);
  perform set_config('pgtap.run_a',  v_run_a::text,  true);
  perform set_config('pgtap.run_b',  v_run_b::text,  true);
end$$;

-- 1) Matching org succeeds.
select lives_ok(
  $sql$
    select public.workflow_record_evidence(
      current_setting('pgtap.run_a')::uuid,
      current_setting('pgtap.rule_a')::uuid,
      current_setting('pgtap.org_a')::uuid,
      'generated_pdf', 'pgtap/ok-1.pdf',
      'workflow-evidence', null, null,
      'deadbeef',
      '{}'::text[], '{}'::text[], '{}'::jsonb
    )
  $sql$,
  'matching org succeeds'
);

-- 2) Mismatched run_org vs p_organization_id raises 42501.
select throws_ok(
  $sql$
    select public.workflow_record_evidence(
      current_setting('pgtap.run_a')::uuid,
      current_setting('pgtap.rule_a')::uuid,
      current_setting('pgtap.org_b')::uuid,
      'generated_pdf', 'pgtap/mismatch.pdf',
      'workflow-evidence', null, null,
      'deadbeef',
      '{}'::text[], '{}'::text[], '{}'::jsonb
    )
  $sql$,
  '42501',
  null,
  'org mismatch (run vs p_org) raises insufficient_privilege'
);

-- 3) Null run_id skips the run-org check.
select lives_ok(
  $sql$
    select public.workflow_record_evidence(
      null,
      current_setting('pgtap.rule_a')::uuid,
      current_setting('pgtap.org_a')::uuid,
      'generated_pdf', 'pgtap/null-run.pdf',
      'workflow-evidence', null, null,
      'cafebabe',
      '{}'::text[], '{}'::text[], '{}'::jsonb
    )
  $sql$,
  'null run_id accepted (no run-org validation path)'
);

-- 4) Rule-org mismatch raises 42501 even when run_id is null.
do $$
declare
  v_rule_b uuid;
begin
  insert into public.workflow_rules (organization_id, slug, name, source_module)
  values (current_setting('pgtap.org_b')::uuid, 'pgtap-evidence-rule-b', 'pgtap evidence rule b', 'pgtap')
  on conflict (organization_id, slug) do nothing;
  select id into v_rule_b from public.workflow_rules
    where organization_id = current_setting('pgtap.org_b')::uuid
      and slug = 'pgtap-evidence-rule-b';
  perform set_config('pgtap.rule_b', v_rule_b::text, true);
end$$;

select throws_ok(
  $sql$
    select public.workflow_record_evidence(
      null,
      current_setting('pgtap.rule_b')::uuid,
      current_setting('pgtap.org_a')::uuid,
      'generated_pdf', 'pgtap/rule-mismatch.pdf',
      'workflow-evidence', null, null,
      'beadface',
      '{}'::text[], '{}'::text[], '{}'::jsonb
    )
  $sql$,
  '42501',
  null,
  'rule belongs to different org raises insufficient_privilege'
);

-- 5) System-rule path (rule_id IS NULL, system_rule_slug carried in metadata)
--    is accepted: the org-consistency check sees a null v_rule_org and
--    waves it through.
select lives_ok(
  $sql$
    select public.workflow_record_evidence(
      current_setting('pgtap.run_b')::uuid,
      null,
      current_setting('pgtap.org_b')::uuid,
      'generated_pdf', 'pgtap/system-rule.pdf',
      'workflow-evidence', null, null,
      'feedface',
      '{}'::text[], '{}'::text[],
      jsonb_build_object('system_rule_slug', 'pgtap.test-system-rule')
    )
  $sql$,
  'system-rule path (null rule_id) accepts cross-rule chain'
);

select * from finish();
rollback;
