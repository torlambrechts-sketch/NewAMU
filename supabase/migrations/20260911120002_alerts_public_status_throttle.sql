-- Alerts module — public status lookup throttle (§4.1 T4).
--
-- public_alert_status RPC is invoked via Edge Function `alerts-public-status`
-- (not direct PostgREST) so we can rate-limit. PostgREST has no throttle
-- primitive; we implement a sliding-window per sha256(ip + daily_salt) at
-- the DB layer.
--
-- The Edge Function is the only caller. It computes the hash and increments
-- attempts; if attempts > 10 within the 1h window, it returns 429 without
-- invoking public_alert_status.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alerts_public_status_throttle (
  ip_hash       text not null,
  window_start  timestamptz not null,
  attempts      integer not null default 1,
  last_attempt  timestamptz not null default now(),
  primary key (ip_hash, window_start)
);

create index if not exists alerts_public_status_throttle_ttl_idx
  on public.alerts_public_status_throttle (last_attempt);

-- RLS not enabled — only service_role writes this table.
-- Reads not policy-gated either; this is operational telemetry, no PII
-- (ip_hash is irreversible without the daily salt).

-- Helper: increment-or-create a throttle row. Returns the current attempt count.
create or replace function public.alerts_record_status_attempt(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_attempts int;
begin
  v_window := date_trunc('hour', now());

  insert into public.alerts_public_status_throttle (ip_hash, window_start, attempts)
  values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start) do update
    set attempts = public.alerts_public_status_throttle.attempts + 1,
        last_attempt = now()
  returning attempts into v_attempts;

  return v_attempts;
end;
$$;

revoke all on function public.alerts_record_status_attempt(text) from public, anon, authenticated;
grant execute on function public.alerts_record_status_attempt(text) to service_role;

-- TTL purge: remove rows older than 24h. Scheduled daily.
create or replace function public.alerts_purge_throttle_old()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.alerts_public_status_throttle
    where last_attempt < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.alerts_purge_throttle_old() from public, anon;
grant execute on function public.alerts_purge_throttle_old() to service_role;
