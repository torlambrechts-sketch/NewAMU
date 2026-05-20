-- Security fix: SECURITY DEFINER functions callable cross-tenant by anon.
--
-- Gap closed: functions created in the public schema receive EXECUTE for the
-- PUBLIC role by default. Two classes of problem resulted:
--
--   1. compliance_company_audit_export(p_org_id) — a SECURITY DEFINER reporting
--      RPC granted to anon AND authenticated, with NO check that the caller
--      belongs to p_org_id. Any client with the publishable key could pass an
--      arbitrary organization id and receive every employee's name, e-mail,
--      role, requirement status and evidence URL for that tenant. Confirmed
--      cross-tenant personopplysning leak (GDPR art. 5(1)(f), art. 32).
--
--   2. Internal provisioning / workflow / reconcile plumbing functions
--      (workflow_execute_*, workflow_fire_rule, workflow_dispatch_db_event,
--      workflow_append_task, workflow_record_evidence, execute_*_rule_actions,
--      reconcile_*, provision_*_baseline_for_org, seed_iso27001_*, studio_seed_*)
--      were all EXECUTE-able by anon. These are meant to run only from triggers
--      (definer chain) or the service-role cron workers. Direct anon access let
--      an attacker forge workflow runs, inject tasks, write fake Merkle-chained
--      evidence, and re-provision arbitrary tenants. App code never calls these
--      directly (verified by grep over src/, modules/, supabase/functions/).
--
-- Fix: (a) rebuild compliance_company_audit_export with a current_org_id()
-- guard and a pinned search_path; (b) revoke EXECUTE from anon + authenticated
-- on the internal plumbing functions — triggers and service_role are
-- unaffected; (c) add studio_provision_baseline_for_current_org(), a guarded
-- RPC the Compliance Studio wizard can call instead of the now-locked
-- provision_compliance_baseline_for_org.

-- (a) Cross-tenant guard on the audit export RPC.
create or replace function public.compliance_company_audit_export(p_org_id uuid)
returns table(
  role_slug text, role_label text, user_name text, user_email text,
  requirement_kind text, resource_label text, hjemmel text, status text,
  severity text, due_at timestamptz, completed_at timestamptz, evidence_url text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if p_org_id is null or p_org_id is distinct from current_org_id() then
    raise exception 'forbidden: caller is not a member of the requested organization'
      using errcode = '42501';
  end if;

  return query
    select
      i.role_slug, fr.label, p.display_name, p.email,
      i.requirement_kind, i.resource_label, i.hjemmel, i.status,
      i.severity, i.due_at, i.completed_at, i.evidence_url
    from public.org_role_requirement_instances i
    join public.functional_roles fr on fr.slug = i.role_slug
    left join public.profiles p on p.id = i.user_id
    where i.organization_id = p_org_id
    order by i.role_slug, p.display_name, i.requirement_kind, i.resource_label;
end;
$function$;

revoke execute on function public.compliance_company_audit_export(uuid) from anon;

-- (b) Lock down internal plumbing functions: revoke EXECUTE from anon +
-- authenticated for every overload of each name. Triggers (definer chain) and
-- the service_role keep access.
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
      execute format('revoke execute on function %s from anon, authenticated', v_oid::regprocedure);
    end loop;
  end loop;
end$$;

-- (c) Guarded re-provision RPC for the Compliance Studio wizard. Resolves the
-- org from the session (never a request parameter) and requires org admin, so
-- it cannot touch another tenant. Idempotent: inserting the baseline pack
-- cascades through compliance_pack_provision_tg.
create or replace function public.studio_provision_baseline_for_current_org()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := current_org_id();
begin
  if v_org is null then
    raise exception 'no active organization' using errcode = '42501';
  end if;
  if not is_org_admin() then
    raise exception 'forbidden: organization admin required' using errcode = '42501';
  end if;

  insert into public.compliance_packs (
    organization_id, slug, short_name, plural_label, cta_label, description,
    position, is_active, requires_verneombud_signing,
    legal_references, kpi_labels, severity_labels
  )
  values (
    v_org, 'aml-amu', 'AML', 'Vernerunder', 'Ny vernerunde',
    'Vernerunder og avvik etter arbeidsmiljøloven og internkontrollforskriften.',
    10, true, true,
    ('[{"code":"AML §3-1","text":"Krav til systematisk HMS-arbeid (internkontroll)."},'
    || '{"code":"AML §4-1","text":"Generelle krav til arbeidsmiljøet."},'
    || '{"code":"IK-forskriften §5","text":"Internkontrollens innhold (sjekklister, avvik, oppfølging)."}]')::jsonb,
    '{"ytd":"Vernerunder i år","open":"Åpne vernerunder","critical":"Kritiske avvik"}',
    '{"low":"Forbedringspotensial","medium":"Mindre avvik","high":"Vesentlig avvik","critical":"Kritisk avvik"}'
  )
  on conflict (organization_id, slug) do nothing;
end;
$function$;

revoke execute on function public.studio_provision_baseline_for_current_org() from anon, public;
grant execute on function public.studio_provision_baseline_for_current_org() to authenticated;
