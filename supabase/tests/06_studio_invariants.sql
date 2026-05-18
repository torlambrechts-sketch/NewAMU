-- Studio Builder — pgTAP invariants.
--
-- Six tests covering the substrate guarantees that the Studio shell
-- + UI rest on. Run via supabase/tests/run.sh inside the
-- supabase-pgtap container.

begin;

select plan(6);

-- ---------------------------------------------------------------------------
-- 1. studio_revisions trigger fires on INSERT/UPDATE/DELETE of a
--    studio-aware table (smoke for the Task 0.1 contract).
-- ---------------------------------------------------------------------------

do $$
declare
  v_org uuid;
  v_count_before int;
  v_count_after int;
  v_tpl_id uuid;
begin
  v_org := setup_test_org('studio-rev');
  v_count_before := (select count(*) from public.studio_revisions);
  insert into public.compliance_checklist_templates
    (organization_id, pack, slug, name, description, is_active, is_system, review_status)
    values (v_org, 'aml-amu', 'pgtap-studio-rev', 'pgtap', 'before', true, false, 'draft')
    returning id into v_tpl_id;
  v_count_after := (select count(*) from public.studio_revisions);
  perform set_config('test.delta', (v_count_after - v_count_before)::text, true);

  delete from public.compliance_checklist_templates where id = v_tpl_id;
end $$;

select ok(
  (current_setting('test.delta', true))::int >= 1,
  'studio_capture_revision trigger writes ≥ 1 revision row on insert'
);

-- ---------------------------------------------------------------------------
-- 2. The skip-revisions GUC suppresses trigger writes for bulk paths.
-- ---------------------------------------------------------------------------

do $$
declare
  v_org uuid;
  v_count_before int;
  v_count_after int;
  v_tpl_id uuid;
begin
  v_org := setup_test_org('studio-skip');
  v_count_before := (select count(*) from public.studio_revisions);
  perform set_config('app.studio_skip_revisions', 'on', true);
  insert into public.compliance_checklist_templates
    (organization_id, pack, slug, name, description, is_active, is_system, review_status)
    values (v_org, 'aml-amu', 'pgtap-studio-skip', 'pgtap', 'bulk', true, false, 'draft')
    returning id into v_tpl_id;
  v_count_after := (select count(*) from public.studio_revisions);
  perform set_config('test.skip_delta', (v_count_after - v_count_before)::text, true);

  delete from public.compliance_checklist_templates where id = v_tpl_id;
end $$;

select ok(
  (current_setting('test.skip_delta', true))::int = 0,
  'app.studio_skip_revisions=on suppresses the revision trigger'
);

-- ---------------------------------------------------------------------------
-- 3. studio_packs immutable trigger blocks UPDATE on published rows.
-- ---------------------------------------------------------------------------

do $$
declare
  v_org uuid;
  v_id uuid;
  v_blocked boolean := false;
begin
  v_org := setup_test_org('studio-immut');
  insert into public.studio_packs
    (organization_id, slug, semver, manifest, immutable, published_at, status, review_status)
    values (v_org, 'pgtap-immut', '0.0.1', '{}'::jsonb, true, now(), 'published', 'draft')
    returning id into v_id;

  begin
    update public.studio_packs set name_i18n = jsonb_build_object('nb','x') where id = v_id;
  exception when others then
    v_blocked := true;
  end;

  perform set_config('test.blocked', case when v_blocked then '1' else '0' end, true);
  delete from public.studio_packs where id = v_id;
end $$;

select is(
  current_setting('test.blocked', true),
  '1',
  'studio_packs immutable trigger blocks UPDATE on published rows'
);

-- ---------------------------------------------------------------------------
-- 4. (organization_id, slug, semver) uniqueness on studio_packs.
-- ---------------------------------------------------------------------------

do $$
declare
  v_org uuid;
  v_collide boolean := false;
begin
  v_org := setup_test_org('studio-unique');
  insert into public.studio_packs (organization_id, slug, semver, manifest, status)
    values (v_org, 'pgtap-unique', '1.0.0', '{}'::jsonb, 'draft');
  begin
    insert into public.studio_packs (organization_id, slug, semver, manifest, status)
      values (v_org, 'pgtap-unique', '1.0.0', '{}'::jsonb, 'draft');
  exception when unique_violation then
    v_collide := true;
  end;
  perform set_config('test.collide', case when v_collide then '1' else '0' end, true);
  delete from public.studio_packs where organization_id=v_org and slug='pgtap-unique';
end $$;

select is(
  current_setting('test.collide', true),
  '1',
  'studio_packs (organization_id, slug, semver) uniqueness holds'
);

-- ---------------------------------------------------------------------------
-- 5. studio_draft_payload column present on every studio-aware table.
-- ---------------------------------------------------------------------------

select bag_eq(
  $$select c.table_name::text
    from information_schema.columns c
    where c.table_schema='public' and c.column_name='studio_draft_payload'
      and c.table_name in (
        'compliance_checklist_templates','survey_org_templates','document_org_templates',
        'meeting_org_templates','register_types','learning_courses','dashboard_layouts'
      )$$,
  $$values
    ('compliance_checklist_templates'::text),
    ('survey_org_templates'),
    ('document_org_templates'),
    ('meeting_org_templates'),
    ('register_types'),
    ('learning_courses'),
    ('dashboard_layouts')$$,
  'studio_draft_payload column shipped on all 7 studio-aware tables'
);

-- ---------------------------------------------------------------------------
-- 6. studio.* permission keys present in the permissions table.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select count(*)::int from public.permissions where key like 'studio.%'$$,
  $$values (5)$$,
  '5 studio.* permission keys exist (simple/advanced/packs/partner_admin/marketplace_publish)'
);

select * from finish();
rollback;
