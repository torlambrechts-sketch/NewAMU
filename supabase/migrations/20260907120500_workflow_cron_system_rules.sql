-- Wire scheduled workflow_system_rules into workflow_cron_tick().
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 6-1 (verneombud-plikt ≥10 ansatte),
--   AML § 7-1 (AMU-plikt ≥30 ansatte) og IK-f § 5 nr. 8 (systematisk
--   oppfølging) — system-regler `aml-6-1-vo-required-10` og
--   `aml-7-1-amu-required-30` har vært seedet med schedule_cron men aldri
--   plukket opp av tick'eren. § 6-1/§ 7-1-håndhevelsen var papir, ikke kjørt.
--   Restrisiko deferred: timezone-aware cron pr. org (alle uttrykk tolkes UTC).

-- ─── 1. workflow_system_rules — add scheduler bookkeeping columns ──────────
-- System rules already carry schedule_cron (see _122100). Adding the
-- timing columns the tick'er needs, plus a partial index on due rules.

alter table public.workflow_system_rules
  add column if not exists next_run_at       timestamptz,
  add column if not exists last_run_at       timestamptz,
  add column if not exists schedule_timezone text not null default 'Europe/Oslo';

create index if not exists workflow_system_rules_due_idx
  on public.workflow_system_rules (next_run_at)
  where enabled = true and schedule_cron is not null and trigger_type = 'schedule';

-- ─── 2. workflow_cron_tick() — replace, do not append ──────────────────────
-- Existing behavior preserved verbatim for workflow_rules (per-org).
-- NEW: also iterate workflow_system_rules where trigger_type='schedule'.
-- System rules apply universally — for each enabled rule, fan out to every
-- organization. The applies_if_employee_count_gte filter is honored so we
-- don't fire AMU-required-30 reminders against orgs with <30 employees.

create or replace function public.workflow_cron_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  s          record;
  o          record;
  v_count    int := 0;
  v_ctx      jsonb;
  v_sys_ctx  jsonb;
  v_emp_count int;
begin
  -- ── (A) Per-org workflow_rules (unchanged from _20260905120600) ─────────
  for r in
    select id, organization_id, slug, source_module, schedule_cron, next_run_at
      from public.workflow_rules
     where is_active = true
       and schedule_cron is not null
       and (next_run_at is null or next_run_at <= now())
     for update skip locked
  loop
    v_ctx := jsonb_build_object(
      'rule_id', r.id,
      'slug', r.slug,
      'scheduled_at', coalesce(r.next_run_at, now()),
      'fired_at', now()
    );
    begin
      perform public.workflow_dispatch_db_event(
        r.organization_id, r.source_module, 'cron_tick', v_ctx
      );
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (r.organization_id, r.id, r.source_module, 'schedule', 'completed', v_ctx);
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (r.organization_id, r.id, r.source_module, 'schedule', 'failed',
              jsonb_build_object('error', sqlerrm, 'context', v_ctx));
    end;

    update public.workflow_rules
       set last_run_at = now(),
           next_run_at = public.workflow_advance_cron(schedule_cron, now())
     where id = r.id;

    v_count := v_count + 1;
  end loop;

  -- ── (B) Platform-owned workflow_system_rules with schedule_cron ─────────
  -- New: scheduled system rules (e.g. aml-6-1-vo-required-10,
  -- aml-7-1-amu-required-30) fan out to every organization, honoring
  -- applies_if_employee_count_gte.
  for s in
    select id, slug, source_module, schedule_cron, next_run_at,
           actions_json, framework, subcategory, law_refs,
           applies_if_employee_count_gte
      from public.workflow_system_rules
     where enabled = true
       and trigger_type = 'schedule'
       and schedule_cron is not null
       and (next_run_at is null or next_run_at <= now())
     for update skip locked
  loop
    for o in select id as org_id from public.organizations
    loop
      -- Headcount gate: skip orgs below the threshold (system rules use
      -- applies_if_employee_count_gte to encode AML § 6-1 (≥10) / § 7-1 (≥30)).
      if s.applies_if_employee_count_gte is not null then
        select count(*) into v_emp_count
          from public.profiles
         where organization_id = o.org_id;
        if v_emp_count < s.applies_if_employee_count_gte then
          continue;
        end if;
      end if;

      v_sys_ctx := jsonb_build_object(
        'system_rule_id', s.id,
        'system_rule_slug', s.slug,
        'system_rule_framework', s.framework,
        'system_rule_subcategory', s.subcategory,
        'system_rule_law_refs', to_jsonb(s.law_refs),
        'scheduled_at', coalesce(s.next_run_at, now()),
        'fired_at', now()
      );

      begin
        -- Execute the seeded actions directly. We bypass dispatch_db_event
        -- because schedule-trigger system rules don't match on an event name
        -- — they're time-based, so the actions list is the unit of work.
        perform public.workflow_execute_actions(
          o.org_id, null::uuid, s.actions_json, v_sys_ctx
        );
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          o.org_id, null, s.source_module, 'schedule', 'completed',
          v_sys_ctx || jsonb_build_object('source', 'system_rule')
        );
      exception when others then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          o.org_id, null, s.source_module, 'schedule', 'failed',
          v_sys_ctx || jsonb_build_object('source', 'system_rule', 'error', sqlerrm)
        );
      end;
    end loop;

    -- Advance regardless of per-org outcome so a permanently-failing org
    -- doesn't pin a system rule on a hot loop.
    update public.workflow_system_rules
       set last_run_at = now(),
           next_run_at = public.workflow_advance_cron(schedule_cron, now())
     where id = s.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.workflow_cron_tick() to service_role;

comment on function public.workflow_cron_tick() is
  'Polls scheduled workflow_rules (per-org) AND workflow_system_rules (platform-owned, fan-out to every org honoring applies_if_employee_count_gte). Dispatches via workflow_execute_actions for system rules and workflow_dispatch_db_event for per-org rules; advances next_run_at via workflow_advance_cron. Intended for pg_cron every-minute.';
