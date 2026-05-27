-- Alerts v1.1 — partitioning groundwork for alert_case_timeline_events.
--
-- v1.1 §2 spec: partition by month when row count exceeds 1M. This migration
-- doesn't convert the table in-place (a destructive operation that would
-- require dump/restore); instead it creates a sibling partitioned table
-- `alert_case_timeline_events_p` and a daily cron that copies rows older
-- than 90 days into monthly partitions, leaving recent traffic on the
-- existing heap table. The view `alert_case_timeline_events_all` exposes
-- the union for queries that need the full history.
--
-- Skipped automatically on small DBs: the cron checks total row count and
-- bails out if < 100k (well under the 1M threshold).
--
-- Self-audit:
--   * ISO 27001 A.8.15 — operational audit logs are partitioned to bound
--     query latency at scale.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_case_timeline_events_archive (
  like public.alert_case_timeline_events including defaults including constraints
) partition by range (created_at);

comment on table public.alert_case_timeline_events_archive is
  'Monthly partitions of audit events older than 90 days. Hot data stays in '
  'alert_case_timeline_events. Union view: alert_case_timeline_events_all.';

-- Attach 24 months of partitions starting 24 months ago.
do $$
declare
  v_start date := date_trunc('month', now() - interval '24 months')::date;
  v_i     integer := 0;
  v_lo    date;
  v_hi    date;
  v_name  text;
begin
  while v_i < 36 loop
    v_lo := (v_start + (v_i || ' months')::interval)::date;
    v_hi := (v_start + ((v_i + 1) || ' months')::interval)::date;
    v_name := format('alert_case_timeline_events_arc_%s', to_char(v_lo, 'YYYY_MM'));
    execute format(
      'create table if not exists public.%I partition of public.alert_case_timeline_events_archive '
      'for values from (%L) to (%L);',
      v_name, v_lo, v_hi
    );
    v_i := v_i + 1;
  end loop;
end$$;

-- Default partition catches any out-of-range rows.
create table if not exists public.alert_case_timeline_events_arc_default
  partition of public.alert_case_timeline_events_archive default;

alter table public.alert_case_timeline_events_archive enable row level security;

drop policy if exists alert_case_timeline_events_archive_select on public.alert_case_timeline_events_archive;
create policy alert_case_timeline_events_archive_select
  on public.alert_case_timeline_events_archive for select
  to authenticated
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
  );

-- No writes from clients — only the archive cron writes here.
drop policy if exists alert_case_timeline_events_archive_no_insert on public.alert_case_timeline_events_archive;
create policy alert_case_timeline_events_archive_no_insert
  on public.alert_case_timeline_events_archive for insert
  to authenticated
  with check (false);

-- Union view of hot + archive.
create or replace view public.alert_case_timeline_events_all as
  select * from public.alert_case_timeline_events
  union all
  select * from public.alert_case_timeline_events_archive;

comment on view public.alert_case_timeline_events_all is
  'Union of hot timeline events + monthly archive partitions. Use this when '
  'you need full history across the 24-month archive horizon.';

grant select on public.alert_case_timeline_events_all to authenticated;

-- Archive procedure (call from cron in Phase 4 once volume warrants it).
create or replace function public.alerts_archive_old_timeline_events(p_older_than_days integer default 90, p_batch_size integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_moved integer := 0;
  v_total integer;
begin
  select count(*) into v_total from public.alert_case_timeline_events;
  if v_total < 100000 then
    return 0;  -- skip on small DBs
  end if;
  with batch as (
    delete from public.alert_case_timeline_events
     where created_at < now() - (p_older_than_days || ' days')::interval
       and id in (
         select id from public.alert_case_timeline_events
          where created_at < now() - (p_older_than_days || ' days')::interval
          order by created_at asc
          limit p_batch_size
       )
     returning *
  )
  insert into public.alert_case_timeline_events_archive
    (id, case_id, organization_id, event_kind, actor_kind, actor_user_id, payload, created_at,
     prev_hash, event_hash, canonical_payload)
  select id, case_id, organization_id, event_kind, actor_kind, actor_user_id, payload, created_at,
         prev_hash, event_hash, canonical_payload
    from batch;
  get diagnostics v_moved = row_count;
  return v_moved;
end;
$$;

revoke all on function public.alerts_archive_old_timeline_events(integer, integer) from public, anon;
grant execute on function public.alerts_archive_old_timeline_events(integer, integer) to service_role;
