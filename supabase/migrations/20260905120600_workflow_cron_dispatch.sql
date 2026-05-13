-- Wire pg_cron against workflow_rules.schedule_cron so scheduled rules
-- actually fire. The column has existed since
-- _20260618150000_workflow_db_events.sql but nothing read it; this migration
-- closes the loop:
--   1. Adds next_run_at + last_run_at columns to workflow_rules
--   2. Adds a parsing function (validates the cron expression + bumps
--      next_run_at via a tiny cron evaluator built on date_trunc + intervals
--      — full cron grammar isn't needed for the v1 set: minutely / hourly /
--      daily / weekly / monthly, with optional list/range fields)
--   3. Exposes workflow_cron_tick() that the pg_cron job calls every minute;
--      it iterates rules where next_run_at <= now() AND is_active, dispatches
--      via workflow_dispatch_db_event(), and pushes next_run_at forward
--   4. Registers the pg_cron job idempotently
--
-- Builder lints user-supplied cron at submit; minimum frequency is 5 min so
-- the platform isn't a self-inflicted DDoS.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 6 + nr. 7 — periodisk gjennomgang
--   må kunne planlegges og kjøres systematisk. AML § 7-2 — AMU årlige rytmer.
--   Restrisiko deferred: timezone-aware cron pr org kommer i Phase C
--   (today: alle cron-uttrykk evalueres som UTC).

alter table public.workflow_rules
  add column if not exists next_run_at  timestamptz,
  add column if not exists last_run_at  timestamptz,
  add column if not exists schedule_timezone text not null default 'Europe/Oslo';

create index if not exists workflow_rules_due_idx
  on public.workflow_rules (next_run_at)
  where is_active = true and schedule_cron is not null;

-- Tiny cron advancer for the v1 grammars we support. Returns the next
-- timestamp after p_from that matches p_expr. Supports:
--   '* * * * *'           — every minute (will be rejected by builder)
--   '*/N * * * *'         — every N minutes (min 5 enforced upstream)
--   'M H * * *'           — daily at H:M
--   'M H * * D'           — weekly on day D (0=sun) at H:M
--   'M H D * *'           — monthly on day D at H:M
--   'M H D MM *'          — yearly on date D/MM at H:M
-- Unsupported grammars raise; the builder validates before save.
create or replace function public.workflow_advance_cron(
  p_expr text,
  p_from timestamptz
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_parts text[];
  v_min text; v_hr text; v_dom text; v_mon text; v_dow text;
  v_minute_step int;
  v_minute int;
  v_hour   int;
  v_day    int;
  v_month  int;
  v_dow_t  int;
  v_next   timestamptz;
  v_at     timestamptz := coalesce(p_from, now());
begin
  if p_expr is null then return null; end if;
  v_parts := regexp_split_to_array(trim(p_expr), '\s+');
  if array_length(v_parts, 1) <> 5 then
    raise exception 'Cron must have 5 fields: % ', p_expr;
  end if;
  v_min := v_parts[1]; v_hr := v_parts[2]; v_dom := v_parts[3];
  v_mon := v_parts[4]; v_dow := v_parts[5];

  -- */N minutely
  if v_min like '*/%' and v_hr = '*' and v_dom = '*' and v_mon = '*' and v_dow = '*' then
    v_minute_step := nullif(substring(v_min from 3), '')::int;
    if v_minute_step is null or v_minute_step < 1 then
      raise exception 'Bad minute step: %', v_min;
    end if;
    if v_minute_step < 5 then
      raise exception 'Minimum cron frequency is 5 minutes (got %)', v_minute_step;
    end if;
    v_next := date_trunc('minute', v_at) + (v_minute_step || ' minutes')::interval;
    while extract(minute from v_next)::int % v_minute_step <> 0 loop
      v_next := v_next + interval '1 minute';
    end loop;
    return v_next;
  end if;

  -- Numeric fixed-time cases (daily / weekly / monthly / yearly).
  if v_min !~ '^[0-9]+$' or v_hr !~ '^[0-9]+$' then
    raise exception 'Unsupported cron expression: %', p_expr;
  end if;
  v_minute := v_min::int;
  v_hour   := v_hr::int;

  -- Yearly: M H D MM *
  if v_mon !~ '^\*$' and v_dom !~ '^\*$' and v_dow = '*' then
    if v_dom !~ '^[0-9]+$' or v_mon !~ '^[0-9]+$' then
      raise exception 'Unsupported cron expression: %', p_expr;
    end if;
    v_day   := v_dom::int;
    v_month := v_mon::int;
    v_next := make_timestamptz(extract(year from v_at)::int, v_month, v_day, v_hour, v_minute, 0, 'UTC');
    if v_next <= v_at then
      v_next := make_timestamptz(extract(year from v_at)::int + 1, v_month, v_day, v_hour, v_minute, 0, 'UTC');
    end if;
    return v_next;
  end if;

  -- Monthly: M H D * *
  if v_dom !~ '^\*$' and v_mon = '*' and v_dow = '*' then
    if v_dom !~ '^[0-9]+$' then
      raise exception 'Unsupported cron expression: %', p_expr;
    end if;
    v_day := v_dom::int;
    v_next := make_timestamptz(extract(year from v_at)::int, extract(month from v_at)::int, v_day, v_hour, v_minute, 0, 'UTC');
    if v_next <= v_at then
      v_next := v_next + interval '1 month';
    end if;
    return v_next;
  end if;

  -- Weekly: M H * * D
  if v_dom = '*' and v_mon = '*' and v_dow !~ '^\*$' then
    if v_dow !~ '^[0-7]$' then
      raise exception 'Unsupported cron expression: %', p_expr;
    end if;
    v_dow_t := v_dow::int;
    -- ISO: 0/7 = sunday; postgres extract(dow) uses 0=sun..6=sat
    if v_dow_t = 7 then v_dow_t := 0; end if;
    v_next := date_trunc('day', v_at) + make_interval(hours => v_hour, mins => v_minute);
    while extract(dow from v_next)::int <> v_dow_t or v_next <= v_at loop
      v_next := v_next + interval '1 day';
    end loop;
    return v_next;
  end if;

  -- Daily: M H * * *
  if v_dom = '*' and v_mon = '*' and v_dow = '*' then
    v_next := date_trunc('day', v_at) + make_interval(hours => v_hour, mins => v_minute);
    if v_next <= v_at then
      v_next := v_next + interval '1 day';
    end if;
    return v_next;
  end if;

  raise exception 'Unsupported cron expression: %', p_expr;
end;
$$;

-- workflow_cron_tick(): polls due rules, dispatches, advances next_run_at.
-- Idempotent: each rule's advancement is independent; on failure the run is
-- logged and next_run_at is still advanced (so a permanently-failing rule
-- doesn't pile up and DoS the dispatcher).
create or replace function public.workflow_cron_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_ctx jsonb;
begin
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

  return v_count;
end;
$$;

grant execute on function public.workflow_cron_tick() to service_role;

comment on function public.workflow_cron_tick() is
  'Polls workflow_rules where schedule_cron is set + next_run_at is due, dispatches via workflow_dispatch_db_event(), advances next_run_at. Intended for pg_cron every-minute.';

-- pg_cron job: every minute. Pattern lifted from
-- archive/20260701120000_wiki_retention_framework.sql so the project stays
-- consistent.
do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_cron_tick')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_cron_tick',
      '* * * * *',
      $cmd$select public.workflow_cron_tick();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule public.workflow_cron_tick() externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule public.workflow_cron_tick() externally';
end
$cron$;
