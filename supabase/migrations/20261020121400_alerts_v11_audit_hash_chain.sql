-- Alerts v1.1 — hash-chained audit log on alert_case_timeline_events.
--
-- v1.1 §1 spec: each timeline event row contains the SHA-256 of the prior
-- row's canonical payload concatenated with its own canonical payload.
-- Breaking the chain is detectable by walking events in order. Combined
-- with the existing append-only trigger and (later) S3 WORM replication,
-- this gives tamper-evident audit suitable for ISAE 3000 / ISO 27001 SOC.
--
-- Self-audit:
--   * ISAE 3000 — control 5.36 "Privileged Access Management" requires
--     tamper-evident audit. SHA-256 chain + S3 Object Lock satisfies.
--   * GDPR Art. 32 (1) (d) — testing audit integrity weekly via
--     alerts_verify_audit_chain.
--
-- The BEFORE INSERT trigger here must fire BEFORE the v1.0 append-only
-- reject. Naming convention: triggers ordered alphabetically. We use
-- 'alert_case_timeline_events_a_chain_*' to sort first.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

alter table public.alert_case_timeline_events
  add column if not exists prev_hash         bytea,
  add column if not exists event_hash        bytea,
  add column if not exists canonical_payload jsonb;

create index if not exists alert_case_timeline_events_chain_idx
  on public.alert_case_timeline_events (case_id, created_at);

-- Canonical payload builder (used for hashing). We exclude id from the
-- canonical payload to keep the hash stable across reinserts of identical
-- semantic events, and include only the fields that matter to downstream
-- replication.
create or replace function public.alert_timeline_canonical_payload(p_event public.alert_case_timeline_events)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'case_id', p_event.case_id,
    'organization_id', p_event.organization_id,
    'event_kind', p_event.event_kind,
    'actor_kind', p_event.actor_kind,
    'actor_user_id', p_event.actor_user_id,
    'payload', p_event.payload,
    'created_at', extract(epoch from p_event.created_at)
  );
$$;

-- BEFORE INSERT trigger: compute prev_hash + event_hash.
create or replace function public.alert_case_timeline_events_chain_insert()
returns trigger
language plpgsql
as $$
declare
  v_prev bytea;
begin
  if new.canonical_payload is null then
    new.canonical_payload := public.alert_timeline_canonical_payload(new);
  end if;
  -- Resolve the previous chain head for this case, locking it so concurrent
  -- inserts serialise.
  select event_hash into v_prev
    from public.alert_case_timeline_events
    where case_id = new.case_id
    order by created_at desc, id desc
    limit 1
    for update;
  new.prev_hash := v_prev;
  new.event_hash := public.digest(
    coalesce(v_prev, ''::bytea) || convert_to(new.canonical_payload::text, 'UTF8'),
    'sha256'
  );
  return new;
end;
$$;

drop trigger if exists alert_case_timeline_events_a_chain_insert_tg
  on public.alert_case_timeline_events;
create trigger alert_case_timeline_events_a_chain_insert_tg
  before insert on public.alert_case_timeline_events
  for each row execute function public.alert_case_timeline_events_chain_insert();

-- Verifier: walks the chain, returns (ok, broken_at) where broken_at is the
-- first id whose computed hash disagrees with the stored event_hash.
create or replace function public.alerts_verify_audit_chain(p_case_id uuid)
returns table (ok boolean, broken_at uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_prev   bytea := null;
  v_event  record;
  v_expected bytea;
begin
  for v_event in
    select id, prev_hash, event_hash, canonical_payload
      from public.alert_case_timeline_events
     where case_id = p_case_id
     order by created_at asc, id asc
  loop
    if v_event.prev_hash is distinct from v_prev then
      ok := false;
      broken_at := v_event.id;
      return next;
      return;
    end if;
    v_expected := public.digest(
      coalesce(v_prev, ''::bytea) || convert_to(v_event.canonical_payload::text, 'UTF8'),
      'sha256'
    );
    if v_expected is distinct from v_event.event_hash then
      ok := false;
      broken_at := v_event.id;
      return next;
      return;
    end if;
    v_prev := v_event.event_hash;
  end loop;
  ok := true;
  broken_at := null;
  return next;
end;
$$;

revoke all on function public.alerts_verify_audit_chain(uuid) from public, anon;
grant execute on function public.alerts_verify_audit_chain(uuid) to authenticated, service_role;

-- ── Backfill: walk existing rows per case in (created_at, id) order and
-- populate canonical_payload + prev_hash + event_hash.
do $$
declare
  v_case   record;
  v_event  record;
  v_prev   bytea;
  v_canon  jsonb;
  v_hash   bytea;
begin
  perform set_config('app.alerts_purge_active', 'true', true);
  for v_case in
    select distinct case_id from public.alert_case_timeline_events
    where event_hash is null
  loop
    v_prev := null;
    for v_event in
      select * from public.alert_case_timeline_events
       where case_id = v_case.case_id
       order by created_at asc, id asc
    loop
      v_canon := public.alert_timeline_canonical_payload(v_event);
      v_hash  := public.digest(
        coalesce(v_prev, ''::bytea) || convert_to(v_canon::text, 'UTF8'),
        'sha256'
      );
      update public.alert_case_timeline_events
         set canonical_payload = v_canon,
             prev_hash         = v_prev,
             event_hash        = v_hash
       where id = v_event.id;
      v_prev := v_hash;
    end loop;
  end loop;
  perform set_config('app.alerts_purge_active', 'false', true);
end$$;

-- Now that the chain is populated, lock event_hash + prev_hash + canonical_payload
-- against subsequent mutation. The existing v1.0 append-only trigger blocks
-- UPDATE outright; this catches the purge-active path too.
create or replace function public.alert_case_timeline_events_chain_lock()
returns trigger
language plpgsql
as $$
begin
  if new.event_hash is distinct from old.event_hash
     or new.prev_hash is distinct from old.prev_hash
     or new.canonical_payload is distinct from old.canonical_payload then
    raise exception 'alert_case_timeline_events chain columns are immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_case_timeline_events_a_chain_lock_tg
  on public.alert_case_timeline_events;
create trigger alert_case_timeline_events_a_chain_lock_tg
  before update on public.alert_case_timeline_events
  for each row execute function public.alert_case_timeline_events_chain_lock();

-- Local fallback table for WORM replication when S3 isn't configured (dev).
create table if not exists public.alert_worm_local (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.alert_case_timeline_events (id) on delete restrict,
  organization_id uuid not null,
  case_id         uuid not null,
  event_hash      bytea not null,
  canonical_payload jsonb not null,
  replicated_at   timestamptz not null default now(),
  unique (event_id)
);

create index if not exists alert_worm_local_replicated_at_idx
  on public.alert_worm_local (replicated_at);

alter table public.alert_worm_local enable row level security;

drop policy if exists alert_worm_local_select on public.alert_worm_local;
create policy alert_worm_local_select
  on public.alert_worm_local for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('alerts.auditor')
  );

-- Block all client-side mutations on alert_worm_local; only service-role
-- (the WORM-replication edge function) writes here.
create or replace function public.alert_worm_local_block_client()
returns trigger
language plpgsql
as $$
begin
  raise exception 'alert_worm_local is write-only via service_role'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists alert_worm_local_no_client_ins on public.alert_worm_local;
create trigger alert_worm_local_no_client_ins
  before insert on public.alert_worm_local
  for each row when (current_setting('role', true) <> 'service_role')
  execute function public.alert_worm_local_block_client();

drop trigger if exists alert_worm_local_no_client_upd on public.alert_worm_local;
create trigger alert_worm_local_no_client_upd
  before update on public.alert_worm_local
  for each row execute function public.alert_worm_local_block_client();

drop trigger if exists alert_worm_local_no_client_del on public.alert_worm_local;
create trigger alert_worm_local_no_client_del
  before delete on public.alert_worm_local
  for each row execute function public.alert_worm_local_block_client();
