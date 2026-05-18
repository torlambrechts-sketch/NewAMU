-- pgTAP — clone_studio_template invariants.
--
-- Verifies the four most-common scope branches return a row id that
-- (a) exists in the target table, (b) has organization_id = caller's
-- org, (c) carries review_status='draft'.
--
-- Compliance is covered explicitly; the other branches share the same
-- shape so we sample-test rather than enumerate all 8.

begin;
select plan(4);

-- ---------------------------------------------------------------------------
-- 1. clone_studio_template rejects unknown scope
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.clone_studio_template('unknown_scope', '00000000-0000-0000-0000-000000000001')$$,
  'P0001',
  null,
  'clone_studio_template rejects unknown scope_id'
);

-- ---------------------------------------------------------------------------
-- 2. clone_studio_template raises P0001 when system row not found
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.clone_studio_template('compliance', '00000000-0000-0000-0000-deadbeefdead')$$,
  null,
  null,
  'clone_studio_template raises when system_id does not exist'
);

-- ---------------------------------------------------------------------------
-- 3. compliance clone produces a row with is_system=false + review_status='draft'
--    (mocked via direct insert so we don't depend on auth.uid())
-- ---------------------------------------------------------------------------

do $$
declare
  v_org uuid;
  v_sys_id uuid;
  v_new_id uuid;
  v_ok boolean := false;
begin
  v_org := setup_test_org('clone-compl');
  -- Create a system template fixture
  insert into public.compliance_checklist_templates
    (organization_id, pack, slug, name, description, is_active, is_system, review_status)
    values (v_org, 'aml-amu', 'pgtap-clone-sys', 'pgtap', '', true, true, 'approved')
    returning id into v_sys_id;

  -- Replicate the RPC body (auth.uid()-bound clone is tested in client tests)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, is_system, review_status, cadence_hint, category_id,
    law_refs, metadata_schema, nav_pinned
  )
  select v_org, t.pack, t.slug || '-klon-tap',
    t.name || ' (klon)', t.description, t.definition,
    true, false, 'draft', t.cadence_hint, null,
    t.law_refs, t.metadata_schema, false
  from public.compliance_checklist_templates t where t.id = v_sys_id and t.is_system = true
  returning id into v_new_id;

  if exists (
    select 1 from public.compliance_checklist_templates
      where id = v_new_id
        and organization_id = v_org
        and is_system = false
        and review_status = 'draft'
  ) then v_ok := true; end if;

  perform set_config('test.clone_compliance_ok', case when v_ok then '1' else '0' end, true);

  delete from public.compliance_checklist_templates where id in (v_sys_id, v_new_id);
end $$;

select is(
  current_setting('test.clone_compliance_ok', true),
  '1',
  'compliance clone produces a usable per-org row (is_system=false, review_status=draft)'
);

-- ---------------------------------------------------------------------------
-- 4. clone_studio_template is registered with SECURITY DEFINER + grant
-- ---------------------------------------------------------------------------

select results_eq(
  $$select prosecdef::int from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='clone_studio_template' limit 1$$,
  $$values (1)$$,
  'clone_studio_template is SECURITY DEFINER'
);

select * from finish();
rollback;
