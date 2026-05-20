-- Security fix (follow-up): the previous revoke targeted anon + authenticated
-- directly, but EXECUTE on these functions is held by the PUBLIC pseudo-role
-- (the default grant for functions). anon and authenticated are implicit
-- members of PUBLIC, so revoking from them by name left the PUBLIC grant —
-- and therefore anon/authenticated access — fully intact.
--
-- Fix: REVOKE EXECUTE ... FROM PUBLIC on the internal plumbing functions, then
-- GRANT EXECUTE ... TO service_role so the cron edge functions that legitimately
-- call them (workflow-queue-worker, gov-outbox-worker, role-compliance-reconcile,
-- govEvidence) keep working. The function owner (postgres) always retains
-- EXECUTE, so trigger-driven (definer-chain) usage is unaffected.

do $$
declare
  v_oid oid;
  v_name text;
  v_names text[] := array[
    'workflow_append_task','workflow_dispatch_db_event','workflow_execute_actions',
    'workflow_execute_step','workflow_fire_rule','workflow_record_evidence',
    'execute_compliance_checklist_rule_actions','execute_inspection_finding_rule_actions',
    'reconcile_role_requirements','reconcile_with_logging',
    'seed_iso27001_starter_pack_for_org','seed_iso27001_v1_1_0_for_org',
    'studio_seed_default_studio_permissions','studio_visual_diff_seed',
    'provision_compliance_baseline_for_org','provision_alerts_baseline_for_org',
    'provision_iso_27001_soa_for_org','provision_meetings_baseline_for_org',
    'provision_registers_baseline_for_org','provision_regulations_baseline_for_org',
    'provision_survey_baseline_for_org','provision_survey_packs_for_org',
    'provision_task_baseline_for_org','provision_tasks_baseline_for_org',
    '_provision_compliance_aml_baseline','_provision_compliance_aml_ik_core',
    '_provision_compliance_aml_onboarding','_provision_compliance_aml_fysisk',
    '_provision_compliance_aml_psyk_vo','_provision_compliance_iso_baseline',
    '_provision_compliance_iso_9001_baseline','_provision_compliance_iso_14001_baseline',
    '_provision_compliance_iso_27001_baseline'
  ];
begin
  foreach v_name in array v_names loop
    for v_oid in
      select p.oid from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
    loop
      execute format('revoke execute on function %s from public, anon, authenticated', v_oid::regprocedure);
      execute format('grant execute on function %s to service_role', v_oid::regprocedure);
    end loop;
  end loop;
end$$;
