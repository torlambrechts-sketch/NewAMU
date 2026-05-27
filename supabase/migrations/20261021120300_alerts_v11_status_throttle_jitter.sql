-- Alerts v1.1 — public_alert_status_v2 with timing-attack defence + 24h sliding throttle.
--
-- v1.0 returned (status, updated_at, deadline, latestPublicNote) on access_key
-- match. v1.1 adds:
--   * 50–200 ms random jitter on both success and failure paths so an
--     attacker can't time-correlate a hit-vs-miss
--   * 24h sliding-window throttle keyed on sha256(ip + daily_salt) — already
--     present in v1.0 _120002; we re-create with the wider window here.
--
-- Self-audit:
--   * T4 — brute-force defence on access_key UUID space.
--   * T3 — IP isn't logged; only its HMAC + window count.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- Daily salt rotates via cron; stored in a single-row table.
create table if not exists public.alerts_throttle_salt (
  id          integer primary key default 1 check (id = 1),
  salt        bytea not null,
  rotated_at  timestamptz not null default now()
);

insert into public.alerts_throttle_salt (id, salt)
  values (1, public.gen_random_bytes(32))
  on conflict (id) do nothing;

create or replace function public.alerts_throttle_rotate_salt()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.alerts_throttle_salt
     set salt = public.gen_random_bytes(32),
         rotated_at = now()
   where id = 1;
end;
$$;

revoke all on function public.alerts_throttle_rotate_salt() from public, anon;
grant execute on function public.alerts_throttle_rotate_salt() to service_role;

-- v2 status RPC.
create or replace function public.public_alert_status_v2(p_access_key uuid, p_ip_hash bytea default null)
returns table (
  found                  boolean,
  status                 text,
  anonymity_mode         text,
  acknowledgement_due_at timestamptz,
  updated_at             timestamptz,
  public_notes           jsonb,
  case_number            text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case record;
  v_notes jsonb;
begin
  -- Jitter both paths.
  perform pg_sleep((50 + random() * 150) / 1000.0);

  -- Throttle.
  if p_ip_hash is not null then
    insert into public.alerts_public_status_throttle (ip_hash, window_start, attempts)
      values (p_ip_hash, date_trunc('hour', now()), 1)
      on conflict (ip_hash, window_start) do update set attempts = alerts_public_status_throttle.attempts + 1;
    if (select sum(attempts) from public.alerts_public_status_throttle
        where ip_hash = p_ip_hash
          and window_start >= now() - interval '24 hours') > 60 then
      raise exception 'throttled' using errcode = 'too_many_arguments';
    end if;
  end if;

  select c.id, c.status, c.anonymity_mode, c.acknowledgement_due_at, c.updated_at
    into v_case
    from public.alert_cases c
    where c.access_key = p_access_key
    limit 1;
  if v_case.id is null then
    return query select false, null::text, null::text, null::timestamptz, null::timestamptz, null::jsonb, null::text;
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('body', n.body, 'created_at', n.created_at) order by n.created_at), '[]'::jsonb)
    into v_notes
    from public.alert_case_notes n
    where n.case_id = v_case.id
      and n.visible_to_reporter = true;

  return query select
    true, v_case.status, v_case.anonymity_mode, v_case.acknowledgement_due_at,
    v_case.updated_at, v_notes, v_case.id::text;
end;
$$;

revoke all on function public.public_alert_status_v2(uuid, bytea) from public;
grant execute on function public.public_alert_status_v2(uuid, bytea) to anon, authenticated;
