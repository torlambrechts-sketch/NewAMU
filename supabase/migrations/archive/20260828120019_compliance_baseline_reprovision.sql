-- Re-run compliance baseline provisioning for every active licensed pack.
--
-- Why this exists: each template-batch migration shipped its own backfill
-- loop, but environments that applied the schema before all batches were
-- merged ended up with only the early baseline (often just the single
-- "Vernerunde standard" template per AML org). The new /compliance/checklists
-- hub surfaces every active template per pack, so the missing rows became
-- visible: orgs see one tile instead of ~12.
--
-- This block is idempotent. provision_compliance_baseline_for_org uses
-- `on conflict (organization_id, slug) do nothing` for templates and the
-- same for requirement links, so re-running it on a fully-provisioned org
-- is a no-op. On a partially-provisioned org it fills in the gaps.
--
-- Tolerant of missing prerequisites: if provision_compliance_baseline_for_org
-- doesn't exist (because the earlier batch migrations were never applied to
-- this environment), this block raises a notice and exits cleanly instead
-- of failing the migration. The operator still needs to apply migrations
-- 20260808120100 through 20260808180000 to actually populate templates.

set local search_path = public, pg_catalog;

do $$
declare
  v_pack record;
  v_fn   regprocedure := to_regprocedure(
    'public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)'
  );
begin
  if v_fn is null then
    raise notice
      'compliance: provision_compliance_baseline_for_org(uuid, compliance_pack) is missing — '
      'apply migrations 20260808120100..20260808180000 to seed the AML/ISO baseline templates, '
      'then re-run this migration. Skipping reprovision.';
    return;
  end if;

  for v_pack in
    select organization_id, slug
    from public.compliance_packs
    where is_active = true
      and deleted_at is null
  loop
    execute format(
      'select %s($1, $2)',
      v_fn::regproc::text
    ) using v_pack.organization_id, v_pack.slug;
  end loop;
end $$;
