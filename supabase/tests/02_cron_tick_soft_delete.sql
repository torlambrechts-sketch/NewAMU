-- Invariant: workflow_cron_tick() filters organizations.deleted_at IS NULL
-- so a soft-deleted tenant stops receiving system-rule fan-out.
-- Covers _20260907121400_workflow_cron_org_filter.sql.
--
-- The filter column is `public.organizations.deleted_at` (added in
-- the same migration). The cron loop joins on it for the per-org
-- workflow_rules path AND filters `select id from organizations
-- where deleted_at is null` in the system-rule fan-out.

begin;
select plan(3);

set local role postgres;

-- Fixture: one org + one platform system rule that fires every minute.
do $$
declare
  v_org uuid := public.setup_test_org('cron-soft-delete');
  v_sys uuid;
begin
  -- Use a unique slug so we can grep workflow_runs for this rule only.
  insert into public.workflow_system_rules (
    slug, framework, category, subcategory,
    description, rationale, source_module,
    trigger_type, schedule_cron,
    actions_json, enabled
  ) values (
    'pgtap.cron-soft-delete', 'pgtap', 'test', 'cron',
    'pgtap cron fixture', 'pgtap', 'pgtap',
    'schedule', '* * * * *',
    '[]'::jsonb, true
  )
  on conflict (slug) do update set enabled = true, schedule_cron = '* * * * *'
  returning id into v_sys;

  perform set_config('pgtap.org',  v_org::text, true);
  perform set_config('pgtap.sys',  v_sys::text, true);

  -- Ensure no leftover deleted_at from a previous half-completed run.
  update public.organizations set deleted_at = null where id = v_org;

  -- Force the system rule to be eligible immediately.
  update public.workflow_system_rules set next_run_at = null, last_run_at = null
   where id = v_sys;
end$$;

-- (1) Active org: tick produces a workflow_runs row tagged with this slug.
select public.workflow_cron_tick();
select isnt(
  (
    select count(*)::int from public.workflow_runs r
     where r.organization_id = current_setting('pgtap.org')::uuid
       and r.detail->>'system_rule_slug' = 'pgtap.cron-soft-delete'
  ),
  0,
  'active org: cron tick fires the system rule'
);

-- (2) Soft-delete + reset the rule's schedule → next tick must skip.
update public.organizations
   set deleted_at = now()
 where id = current_setting('pgtap.org')::uuid;
update public.workflow_system_rules
   set next_run_at = null, last_run_at = null
 where id = current_setting('pgtap.sys')::uuid;

-- Snapshot the count of fired runs BEFORE the tick, then run the tick,
-- then confirm the count is unchanged.
select set_config('pgtap.before',
  (
    select count(*)::text from public.workflow_runs r
     where r.organization_id = current_setting('pgtap.org')::uuid
       and r.detail->>'system_rule_slug' = 'pgtap.cron-soft-delete'
  ),
  true
);
select public.workflow_cron_tick();
select is(
  (
    select count(*)::int from public.workflow_runs r
     where r.organization_id = current_setting('pgtap.org')::uuid
       and r.detail->>'system_rule_slug' = 'pgtap.cron-soft-delete'
  ),
  current_setting('pgtap.before')::int,
  'soft-deleted org: cron tick produces no new dispatch'
);

-- (3) Re-activate → fan-out resumes.
update public.organizations
   set deleted_at = null
 where id = current_setting('pgtap.org')::uuid;
update public.workflow_system_rules
   set next_run_at = null, last_run_at = null
 where id = current_setting('pgtap.sys')::uuid;

select set_config('pgtap.before',
  (
    select count(*)::text from public.workflow_runs r
     where r.organization_id = current_setting('pgtap.org')::uuid
       and r.detail->>'system_rule_slug' = 'pgtap.cron-soft-delete'
  ),
  true
);
select public.workflow_cron_tick();
select cmp_ok(
  (
    select count(*)::int from public.workflow_runs r
     where r.organization_id = current_setting('pgtap.org')::uuid
       and r.detail->>'system_rule_slug' = 'pgtap.cron-soft-delete'
  ),
  '>',
  current_setting('pgtap.before')::int,
  'reactivated org: cron tick fires again'
);

select * from finish();
rollback;
