-- Fix-up: workflow_cron_tick must skip soft-deleted orgs, and
-- workflow_schedule_reminders must NOT silently fall back to now() when
-- the deadline anchor is missing. Both findings (C-2 / C-4) had the same
-- shape: a tick keeps running against state it should refuse.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 17 (sletting — en slettet tenant
--   må ikke fortsette å motta cron-fanout som etterlater workflow_runs-
--   rader for en "ikke-eksisterende" virksomhet), AML § 5-2 (T-N-varsler
--   for melde-frister må anchored på faktisk eventAt — å bruke now() som
--   anker betyr at deadline beregnes fra cron-tick-tidspunktet, ikke
--   skadetidspunktet → forsinkede meldinger uten varsel), GDPR Art. 33
--   (samme prinsipp for 72t-fristen). IK-f § 5 nr. 4.
--   Restrisiko deferred: deleted_at-kolonnen finnes ikke i public.organi-
--   zations ennå; vi legger den til her uten å re-organisere RLS — eventuelle
--   tenant-slettings-flyt må eksplisitt sette deleted_at før de stoler på
--   filteret. Dette er den minimale endringen som lukker varsels-svikten.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Ensure organizations has a soft-delete marker the cron tick can
--    filter on. Idempotent; no backfill needed (existing rows are live).
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists deleted_at timestamptz;

comment on column public.organizations.deleted_at is
  'Soft-delete marker. workflow_cron_tick + other recurring jobs filter `where deleted_at is null` so suspended tenants stop receiving fan-out. Hard-delete still allowed; this is the lighter weight option.';

create index if not exists organizations_active_idx
  on public.organizations (id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. workflow_cron_tick — same body as _120500 but the system-rule fan-out
--    loop filters out soft-deleted orgs. Per-org workflow_rules loop is
--    unaffected because deleting/suspending an org should already cascade
--    its rules (RESTRICT FK from _120900 actually blocks delete now, but
--    a soft-delete shouldn't cascade — the rule rows persist for audit).
-- ---------------------------------------------------------------------------
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
  -- (A) Per-org workflow_rules. Filter out rules belonging to soft-deleted
  --     orgs so a re-activated tenant resumes cleanly without firing the
  --     cron debt accumulated during the dormant period.
  for r in
    select wr.id, wr.organization_id, wr.slug, wr.source_module,
           wr.schedule_cron, wr.next_run_at
      from public.workflow_rules wr
      join public.organizations o on o.id = wr.organization_id
     where wr.is_active = true
       and wr.schedule_cron is not null
       and (wr.next_run_at is null or wr.next_run_at <= now())
       and o.deleted_at is null
     for update of wr skip locked
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

  -- (B) Platform-owned workflow_system_rules with schedule_cron — fan out
  --     to every LIVE org honoring applies_if_employee_count_gte.
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
    for o in
      select id as org_id
        from public.organizations
       where deleted_at is null
    loop
      -- Headcount gate.
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
  'Polls scheduled workflow_rules (per-org) AND workflow_system_rules (platform-owned). Both loops filter organizations.deleted_at is null so soft-deleted tenants stop receiving fan-out. Dispatches via workflow_execute_actions / workflow_dispatch_db_event; advances next_run_at via workflow_advance_cron. Intended for pg_cron every-minute.';

-- ---------------------------------------------------------------------------
-- 3. workflow_schedule_reminders — refuse to schedule when the anchor is
--    missing. The original (lines 303-310 of _120600) silently fell back
--    to now() and logged a NOTICE — that fall-back means T-48/T-24/T-2
--    reminders are computed from the cron-tick wall-clock, not from the
--    actual GDPR/AML aware-time, which can place T-48 in the past while
--    the deadline is still ~48h out.
--
--    Body is identical to _120600 except the anchor-missing branch now:
--    inserts a `failed` workflow_runs row with detail.reason and
--    returns 0 immediately. Callers can grep workflow_runs for
--    'missing_reminder_anchor' to surface broken catalogs.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_schedule_reminders(
  p_org           uuid,
  p_run_id        uuid,
  p_rule_id       uuid,
  p_action        jsonb,
  p_anchor        timestamptz,
  p_role_or_user  text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours_arr    jsonb;
  v_deadline_hrs numeric;
  v_deadline     timestamptz;
  v_hr           numeric;
  v_reminder_at  timestamptz;
  v_key          text;
  v_scheduled    int := 0;
  v_action_type  text;
begin
  if p_anchor is null then
    -- Hard fail: log a failed workflow_runs row so the next reviewer can
    -- find catalogs whose gov-action emit forgot awareAt/eventAt. NO
    -- silent fall-back to now() — the entire point of T-N reminders is
    -- to anchor on the regulatory event, not on cron wall-clock.
    begin
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        p_org, p_rule_id, coalesce(p_action->>'sourceModule', 'workflow'),
        'schedule_reminders', 'failed',
        jsonb_build_object(
          'reason', 'missing_reminder_anchor',
          'action', p_action,
          'role_or_user', p_role_or_user,
          'parent_run_id', p_run_id
        )
      );
    exception when others then
      -- Even the failure-log path must not propagate; just NOTICE.
      raise notice 'workflow_schedule_reminders: anchor missing AND failed to log failure for run % (%)',
        p_run_id, sqlerrm;
    end;
    return 0;
  end if;

  v_hours_arr := p_action->'reminderHoursBeforeDeadline';
  if v_hours_arr is null or jsonb_typeof(v_hours_arr) <> 'array'
     or jsonb_array_length(v_hours_arr) = 0 then
    return 0;
  end if;

  v_deadline_hrs := nullif(p_action->>'deadlineHours', '')::numeric;
  if v_deadline_hrs is null then
    raise notice 'workflow_schedule_reminders: deadlineHours missing for run %, skipping', p_run_id;
    return 0;
  end if;

  v_action_type := coalesce(p_action->>'type', 'gov_action');
  v_deadline    := p_anchor + (v_deadline_hrs || ' hours')::interval;

  for v_hr in select (value::text)::numeric
                from jsonb_array_elements(v_hours_arr)
  loop
    v_reminder_at := v_deadline - (v_hr || ' hours')::interval;
    if v_reminder_at <= now() then
      continue;
    end if;

    v_key := encode(
      public.digest(
        coalesce(p_run_id::text, '') || '|' ||
        coalesce(p_rule_id::text, '') || '|' ||
        v_action_type || '|' ||
        v_hr::text || '|reminder',
        'sha256'
      ),
      'hex'
    );

    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, status, execute_after,
      idempotency_key
    ) values (
      p_org, p_rule_id, 'send_notification',
      jsonb_build_object(
        'type',                 'send_notification',
        'title',                'Frist nærmer seg',
        'message',              'Reguleringsfrist om ' || v_hr::text ||
                                ' timer for ' || v_action_type || '.',
        'toRole',               p_role_or_user,
        'reminderHoursBefore',  v_hr,
        'deadline',             v_deadline,
        'parentActionType',     v_action_type,
        'run_id',               p_run_id,
        'rule_id',              p_rule_id
      ),
      'pending',
      v_reminder_at,
      v_key
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing;

    v_scheduled := v_scheduled + 1;
  end loop;

  return v_scheduled;
end;
$$;

grant execute on function public.workflow_schedule_reminders(
  uuid, uuid, uuid, jsonb, timestamptz, text
) to service_role;

comment on function public.workflow_schedule_reminders(
  uuid, uuid, uuid, jsonb, timestamptz, text
) is
  'Plans T-N hours-before-deadline reminders for a gov action. Returns 0 + inserts a failed workflow_runs row when the anchor is missing (no silent now() fall-back — AML § 5-2 / GDPR Art. 33 require anchoring to the regulatory event). Idempotent via (run_id|rule_id|action_type|N) sha256 key.';

do $$
begin
  raise notice 'workflow_cron_tick filters soft-deleted orgs; workflow_schedule_reminders no longer falls back to now().';
end
$$;
