-- Anonymized cross-tenant benchmark substrate.
-- GDPR Art. 5(1)(c) dataminimering: kun aggregater per (NACE2, størrelse, måned),
-- aldri rad-nivå tilgang på tvers av tenants. Behandlingsgrunnlag for
-- statistikkformål er GDPR Art. 89; bruker pseudonymiserings-/k-anonymitets-
-- tiltak iht. Personopplysningsloven § 32 og Art. 89 nr. 1.
-- K-anonymitet = 5: bøtter med færre enn 5 bidragende virksomheter
-- droppes før lagring. Org-admin ser kun sin egen NACE+størrelse-bøtte.
-- Refresh kjøres månedlig via pg_cron (2. i hver måned 04:00).

-- ── 1. Snapshot-tabell ─────────────────────────────────────────────────────
create table if not exists public.benchmark_metric_snapshots (
  id              uuid primary key default gen_random_uuid(),
  nace_code_2digit text not null,
  size_band       text not null check (size_band in ('1-9','10-49','50-249','250+')),
  metric          text not null check (metric in (
    'findings_critical_per_org',
    'vernerunder_per_quarter',
    'overdue_actions_pct',
    'course_certificates_per_employee',
    'sjekkliste_completion_pct'
  )),
  period_month    date not null,
  org_count       int not null check (org_count >= 5),
  median_value    numeric not null,
  p25_value       numeric not null,
  p75_value       numeric not null,
  mean_value      numeric not null,
  computed_at     timestamptz not null default now(),
  constraint benchmark_metric_snapshots_unique unique (nace_code_2digit, size_band, metric, period_month)
);

comment on table public.benchmark_metric_snapshots is
  'K-anonymisert benchmark per (NACE2, størrelses-bånd, metric, måned). Kun bøtter med ≥5 bidragende virksomheter lagres. GDPR Art. 5(1)(c) + Art. 89.';
comment on column public.benchmark_metric_snapshots.org_count is
  'Antall bidragende virksomheter i bøtta. Konstraint sikrer k-anonymitet ≥ 5.';

create index if not exists benchmark_metric_snapshots_lookup_idx
  on public.benchmark_metric_snapshots (nace_code_2digit, size_band, metric, period_month desc);

-- ── 2. RLS — alle innloggede brukere kan SELECT (men kun aggregater) ──────
-- Datasettet er per design ikke-personidentifiserende (k≥5). Vi gir authenticated
-- SELECT, mens INSERT/UPDATE/DELETE er reservert for SECURITY DEFINER-funksjonen.
alter table public.benchmark_metric_snapshots enable row level security;

drop policy if exists benchmark_metric_snapshots_select_all on public.benchmark_metric_snapshots;
create policy benchmark_metric_snapshots_select_all
  on public.benchmark_metric_snapshots
  for select
  to authenticated
  using (org_count >= 5);

revoke insert, update, delete on public.benchmark_metric_snapshots from authenticated;
grant select on public.benchmark_metric_snapshots to authenticated;

-- ── 3. Hjelpefunksjoner: NACE2 + size-bånd fra brreg_snapshot ─────────────
create or replace function public.benchmark_nace2_for_org(p_org_id uuid)
returns text
language sql
stable
as $$
  select substring(coalesce(o.brreg_snapshot->'naeringskode1'->>'kode', '') from 1 for 2)
    from public.organizations o
   where o.id = p_org_id
$$;

comment on function public.benchmark_nace2_for_org(uuid) is
  'NACE2-prefix fra brreg_snapshot.naeringskode1.kode (Brønnøysund). Tom streng når orgen ikke har brreg-data.';

create or replace function public.benchmark_size_band_for_org(p_org_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v_fte int;
begin
  -- Foretrekk faktisk antall registrerte brukere; faller tilbake til
  -- brreg.antallAnsatte hvis profiles-tabellen er tom for orgen.
  select count(*) into v_fte
    from public.profiles
   where organization_id = p_org_id;
  if coalesce(v_fte, 0) = 0 then
    select coalesce((o.brreg_snapshot->>'antallAnsatte')::int, 0) into v_fte
      from public.organizations o
     where o.id = p_org_id;
  end if;
  if v_fte is null or v_fte <= 0 then return null; end if;
  if v_fte < 10 then return '1-9'; end if;
  if v_fte < 50 then return '10-49'; end if;
  if v_fte < 250 then return '50-249'; end if;
  return '250+';
end;
$$;

comment on function public.benchmark_size_band_for_org(uuid) is
  'Størrelses-bånd basert på antall profiles, fallback til brreg.antallAnsatte. Returnerer null når ukjent.';

-- ── 4. Refresh-funksjon (SECURITY DEFINER) ────────────────────────────────
create or replace function public.benchmark_refresh_tick()
returns table (rows_written int, buckets_dropped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', now())::date;
  v_quarter_start date := date_trunc('quarter', now())::date;
  v_quarter_end   date := (date_trunc('quarter', now()) + interval '3 month')::date;
  v_rows_written int := 0;
  v_buckets_dropped int := 0;
begin
  -- Bygg per-org metric-verdier inn i en temp-tabell, så aggreger per bøtte.
  -- Hver beregning er bevisst best-effort: tabeller som mangler i et miljø
  -- (legacy / nedlagt) gir 0 i stedet for å sprenge hele refreshen.
  create temporary table tmp_org_metrics (
    org_id uuid,
    nace2 text,
    size_band text,
    metric text,
    value numeric
  ) on commit drop;

  -- Metric 1: findings_critical_per_org — antall kritiske funn siste 90 dager
  begin
    insert into tmp_org_metrics (org_id, nace2, size_band, metric, value)
    select o.id,
           public.benchmark_nace2_for_org(o.id),
           public.benchmark_size_band_for_org(o.id),
           'findings_critical_per_org',
           coalesce((
             select count(*)::numeric
               from public.inspection_findings f
              where f.organization_id = o.id
                and f.severity = 'critical'
                and f.created_at >= (now() - interval '90 days')
           ), 0)
      from public.organizations o;
  exception when undefined_table then
    null; -- inspection_findings finnes ikke i dette miljøet
  end;

  -- Metric 2: vernerunder_per_quarter — signerte sjekklister i inneværende kvartal
  begin
    insert into tmp_org_metrics (org_id, nace2, size_band, metric, value)
    select o.id,
           public.benchmark_nace2_for_org(o.id),
           public.benchmark_size_band_for_org(o.id),
           'vernerunder_per_quarter',
           coalesce((
             select count(*)::numeric
               from public.compliance_checklist_executions e
              where e.organization_id = o.id
                and e.signed_at is not null
                and e.signed_at >= v_quarter_start
                and e.signed_at < v_quarter_end
           ), 0)
      from public.organizations o;
  exception when undefined_table then
    null;
  end;

  -- Metric 3: overdue_actions_pct — andel tasks som er overdue (open + due_at < now)
  begin
    insert into tmp_org_metrics (org_id, nace2, size_band, metric, value)
    select o.id,
           public.benchmark_nace2_for_org(o.id),
           public.benchmark_size_band_for_org(o.id),
           'overdue_actions_pct',
           coalesce((
             with t as (
               select count(*) filter (
                        where status in ('todo','in_progress')
                          and due_at is not null
                          and due_at < now()
                      ) as overdue,
                      count(*) filter (where status in ('todo','in_progress')) as open
                 from public.tasks
                where organization_id = o.id
             )
             select case when (open + 0) > 0 then round((overdue::numeric / open::numeric) * 100, 2) else 0 end
               from t
           ), 0)
      from public.organizations o;
  exception when undefined_table then
    null;
  end;

  -- Metric 4: course_certificates_per_employee — siste 365 dager / FTE
  begin
    insert into tmp_org_metrics (org_id, nace2, size_band, metric, value)
    select o.id,
           public.benchmark_nace2_for_org(o.id),
           public.benchmark_size_band_for_org(o.id),
           'course_certificates_per_employee',
           coalesce((
             with c as (
               select count(*) as certs
                 from public.learning_certificates
                where organization_id = o.id
                  and issued_at >= (now() - interval '365 days')
             ), p as (
               select greatest(count(*), 1) as fte
                 from public.profiles
                where organization_id = o.id
             )
             select round(c.certs::numeric / p.fte::numeric, 3) from c, p
           ), 0)
      from public.organizations o;
  exception when undefined_table then
    null;
  end;

  -- Metric 5: sjekkliste_completion_pct — signerte / planlagte siste 90d
  begin
    insert into tmp_org_metrics (org_id, nace2, size_band, metric, value)
    select o.id,
           public.benchmark_nace2_for_org(o.id),
           public.benchmark_size_band_for_org(o.id),
           'sjekkliste_completion_pct',
           coalesce((
             with t as (
               select count(*) filter (where signed_at is not null) as signed,
                      count(*) as total
                 from public.compliance_checklist_executions
                where organization_id = o.id
                  and (scheduled_for is null or scheduled_for >= (now() - interval '90 days'))
             )
             select case when total > 0 then round((signed::numeric / total::numeric) * 100, 2) else 0 end
               from t
           ), 0)
      from public.organizations o;
  exception when undefined_table then
    null;
  end;

  -- Aggregér per bøtte, dropp <5, UPSERT.
  with bucketed as (
    select nace2,
           size_band,
           metric,
           count(*) as org_count,
           percentile_cont(0.50) within group (order by value) as median_value,
           percentile_cont(0.25) within group (order by value) as p25_value,
           percentile_cont(0.75) within group (order by value) as p75_value,
           avg(value) as mean_value
      from tmp_org_metrics
     where nace2 is not null and nace2 <> ''
       and size_band is not null
     group by nace2, size_band, metric
  ),
  k_safe as (
    select * from bucketed where org_count >= 5
  ),
  k_dropped as (
    select count(*) as n from bucketed where org_count < 5
  ),
  upserted as (
    insert into public.benchmark_metric_snapshots (
      nace_code_2digit, size_band, metric, period_month,
      org_count, median_value, p25_value, p75_value, mean_value, computed_at
    )
    select nace2, size_band, metric, v_month_start,
           org_count, median_value, p25_value, p75_value, mean_value, now()
      from k_safe
    on conflict (nace_code_2digit, size_band, metric, period_month) do update set
      org_count    = excluded.org_count,
      median_value = excluded.median_value,
      p25_value    = excluded.p25_value,
      p75_value    = excluded.p75_value,
      mean_value   = excluded.mean_value,
      computed_at  = excluded.computed_at
    returning 1
  )
  select (select count(*) from upserted), (select n from k_dropped)
    into v_rows_written, v_buckets_dropped;

  return query select v_rows_written, v_buckets_dropped;
end;
$$;

comment on function public.benchmark_refresh_tick() is
  'Beregner alle benchmark-metrikker for inneværende måned, dropper k<5 bøtter, og UPSERT-er. SECURITY DEFINER, idempotent, kjøres månedlig via pg_cron.';

revoke all on function public.benchmark_refresh_tick() from public;
grant execute on function public.benchmark_refresh_tick() to service_role;

-- ── 5. Org-admin RPC: org-egen verdi + matchende bench-bøtte ──────────────
create or replace function public.get_my_org_benchmark(
  p_org_id uuid,
  p_metric text,
  p_periods int default 6
)
returns table (
  period_month date,
  org_value numeric,
  bench_median numeric,
  bench_p25 numeric,
  bench_p75 numeric,
  bench_mean numeric,
  bench_org_count int,
  nace_code_2digit text,
  size_band text,
  k_anon_ok boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nace2 text;
  v_band  text;
begin
  -- Org-admin gate: brukeren må være admin i organisasjonen de spør om.
  if p_org_id <> public.current_org_id() then
    raise exception 'forbidden: kan kun hente benchmark for egen organisasjon';
  end if;
  if not public.is_org_admin() then
    raise exception 'forbidden: krever org-admin';
  end if;
  if p_metric not in (
    'findings_critical_per_org','vernerunder_per_quarter','overdue_actions_pct',
    'course_certificates_per_employee','sjekkliste_completion_pct'
  ) then
    raise exception 'ukjent metric: %', p_metric;
  end if;

  v_nace2 := public.benchmark_nace2_for_org(p_org_id);
  v_band  := public.benchmark_size_band_for_org(p_org_id);

  return query
    with months as (
      select (date_trunc('month', now()) - (n || ' month')::interval)::date as m
        from generate_series(0, greatest(p_periods, 1) - 1) n
    ),
    org_vals as (
      -- Beregn organisasjonens egen verdi for hver måned. Vi forenkler ved
      -- å returnere én "siste-90d" snapshot per metric — UI viser én tall +
      -- bench-bånd, ikke en full historisk serie. Historiske bøtter kommer
      -- fra snapshot-tabellen direkte.
      select m.m as period_month,
             case p_metric
               when 'findings_critical_per_org' then (
                 select count(*)::numeric from public.inspection_findings
                  where organization_id = p_org_id and severity = 'critical'
                    and created_at >= (m.m - interval '90 days')
                    and created_at <  (m.m + interval '1 month')
               )
               when 'vernerunder_per_quarter' then (
                 select count(*)::numeric from public.compliance_checklist_executions
                  where organization_id = p_org_id and signed_at is not null
                    and signed_at >= date_trunc('quarter', m.m)
                    and signed_at <  (date_trunc('quarter', m.m) + interval '3 month')
               )
               when 'overdue_actions_pct' then (
                 with t as (
                   select count(*) filter (
                            where status in ('todo','in_progress') and due_at is not null and due_at < (m.m + interval '1 month')
                          ) as overdue,
                          count(*) filter (where status in ('todo','in_progress')) as open
                     from public.tasks where organization_id = p_org_id
                 )
                 select case when open > 0 then round((overdue::numeric / open::numeric) * 100, 2) else 0 end from t
               )
               when 'course_certificates_per_employee' then (
                 with c as (
                   select count(*) as certs from public.learning_certificates
                    where organization_id = p_org_id
                      and issued_at >= (m.m - interval '365 days')
                      and issued_at <  (m.m + interval '1 month')
                 ), p as (
                   select greatest(count(*), 1) as fte from public.profiles where organization_id = p_org_id
                 )
                 select round(c.certs::numeric / p.fte::numeric, 3) from c, p
               )
               when 'sjekkliste_completion_pct' then (
                 with t as (
                   select count(*) filter (where signed_at is not null) as signed,
                          count(*) as total
                     from public.compliance_checklist_executions
                    where organization_id = p_org_id
                      and (scheduled_for is null
                           or (scheduled_for >= (m.m - interval '90 days') and scheduled_for < (m.m + interval '1 month')))
                 )
                 select case when total > 0 then round((signed::numeric / total::numeric) * 100, 2) else 0 end from t
               )
               else 0::numeric
             end as org_value
        from months m
    )
    select ov.period_month,
           coalesce(ov.org_value, 0)::numeric                as org_value,
           bs.median_value                                   as bench_median,
           bs.p25_value                                      as bench_p25,
           bs.p75_value                                      as bench_p75,
           bs.mean_value                                     as bench_mean,
           bs.org_count                                      as bench_org_count,
           v_nace2                                           as nace_code_2digit,
           v_band                                            as size_band,
           (bs.org_count is not null and bs.org_count >= 5)  as k_anon_ok
      from org_vals ov
      left join public.benchmark_metric_snapshots bs
             on bs.metric           = p_metric
            and bs.nace_code_2digit = v_nace2
            and bs.size_band        = v_band
            and bs.period_month     = ov.period_month
      order by ov.period_month desc;
exception
  when undefined_table then
    return; -- noen kildetabeller mangler i dette miljøet
end;
$$;

comment on function public.get_my_org_benchmark(uuid, text, int) is
  'Returnerer organisasjonens egen metric-verdi sammen med matchende benchmark-bøtte (NACE2 + størrelse). Krever org-admin og p_org_id == current_org_id().';

revoke all on function public.get_my_org_benchmark(uuid, text, int) from public;
grant execute on function public.get_my_org_benchmark(uuid, text, int) to authenticated;

-- ── 6. pg_cron — månedlig refresh (2. i hver måned 04:00) ─────────────────
do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'benchmark_refresh_monthly')
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
      'benchmark_refresh_monthly',
      '0 4 2 * *',
      $cmd$select public.benchmark_refresh_tick();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule public.benchmark_refresh_tick() externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule public.benchmark_refresh_tick() externally';
end
$cron$;
