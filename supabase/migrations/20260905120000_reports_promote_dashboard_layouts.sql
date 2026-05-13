-- Reporting module — promote dashboard_layouts to back both dashboards and reports.
--
-- The dashboard engine is stable across 9 scopes. The legacy report_definitions /
-- report_schedules / report_runs stubs in archive/ were never finished. Rather than
-- maintain a parallel table, this migration adds the reporting concerns
-- (kind, snapshot, share, cover meta, publication) directly onto dashboard_layouts.
-- A row with kind='report' is an immutable, shareable snapshot of a multi-scope
-- dashboard; kind='dashboard' (default) preserves all existing behaviour.
--
-- Self-audit (Arbeidstilsynet POV): closes the "no audit-grade frozen export"
-- påleggsgrunn (AML § 5-1, IK-f § 5 nr. 7 — documented evidence of HMS-work).
-- Restrisiko deferred to v1.1: PAdES digital signature on the rendered PDF.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ---------------------------------------------------------------------------
-- 1. Extend dashboard_layouts with reporting columns
-- ---------------------------------------------------------------------------

alter table public.dashboard_layouts
  add column if not exists kind text not null default 'dashboard'
    check (kind in ('dashboard', 'report', 'report_template'));

alter table public.dashboard_layouts
  add column if not exists report_scopes text[] not null default '{}'::text[];

alter table public.dashboard_layouts
  add column if not exists snapshot_data jsonb;

alter table public.dashboard_layouts
  add column if not exists snapshot_at timestamptz;

alter table public.dashboard_layouts
  add column if not exists share_token text;

alter table public.dashboard_layouts
  add column if not exists share_password_hash text;

alter table public.dashboard_layouts
  add column if not exists share_expires_at timestamptz;

alter table public.dashboard_layouts
  add column if not exists published_at timestamptz;

alter table public.dashboard_layouts
  add column if not exists published_by uuid references auth.users (id) on delete set null;

alter table public.dashboard_layouts
  add column if not exists cover_meta jsonb not null default '{}'::jsonb;

comment on column public.dashboard_layouts.cover_meta is
  'Report cover page metadata. Shape: { title, period_from, period_to, signer_name, signer_role, include_org_logo, included_law_refs[] }.';
comment on column public.dashboard_layouts.report_scopes is
  'For kind=report: additional dashboard scope_ids whose datasets are merged. The primary scope still lives in scope_id.';
comment on column public.dashboard_layouts.snapshot_data is
  'Frozen dataset map captured at publish time. NULL until kind=report rows are published.';

-- Bound snapshot size at 4 MB to keep PDF render time predictable and avoid
-- JSONB pathological cases.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dashboard_layouts_snapshot_size_chk'
  ) then
    alter table public.dashboard_layouts
      add constraint dashboard_layouts_snapshot_size_chk
      check (snapshot_data is null or octet_length(snapshot_data::text) < 4 * 1024 * 1024);
  end if;
end $$;

create unique index if not exists dashboard_layouts_share_token_uniq
  on public.dashboard_layouts (share_token)
  where share_token is not null;

create index if not exists dashboard_layouts_org_kind_published_idx
  on public.dashboard_layouts (organization_id, kind, published_at desc nulls last)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Redefine the update trigger
--    - bump version on any of the new mutating fields
--    - forbid mutation of the frozen surface when published, unless the
--      caller is inside republish_report (sets request.republishing='on')
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_layouts_before_update()
returns trigger
language plpgsql
as $$
declare
  v_republishing boolean := coalesce(nullif(current_setting('request.republishing', true), ''), 'off') = 'on';
begin
  if old.published_at is not null and not v_republishing then
    if new.layout         is distinct from old.layout
       or new.filters     is distinct from old.filters
       or new.report_scopes is distinct from old.report_scopes
       or new.cover_meta  is distinct from old.cover_meta
       or new.snapshot_data is distinct from old.snapshot_data then
      raise exception 'published report layout is immutable (id=%); use republish_report', old.id
        using errcode = 'restrict_violation';
    end if;
  end if;

  if new.layout         is distinct from old.layout
     or new.filters     is distinct from old.filters
     or new.name        is distinct from old.name
     or new.description is distinct from old.description
     or new.is_default  is distinct from old.is_default
     or new.report_scopes is distinct from old.report_scopes
     or new.cover_meta  is distinct from old.cover_meta
     or new.snapshot_data is distinct from old.snapshot_data then
    new.version := old.version + 1;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS extension — permit public read via redeem_share_token
--
-- The redeem RPC sets request.share_token, then this additive permissive
-- policy lets the same session SELECT the row. Anonymous access without the
-- RPC sees nothing (GUC is null → policy short-circuits).
-- ---------------------------------------------------------------------------

drop policy if exists dashboard_layouts_select_share on public.dashboard_layouts;
create policy dashboard_layouts_select_share
  on public.dashboard_layouts for select
  to anon, authenticated
  using (
    kind = 'report'
    and share_token is not null
    and (share_expires_at is null or share_expires_at > now())
    and current_setting('request.share_token', true) is not null
    and current_setting('request.share_token', true) = share_token
  );

-- ---------------------------------------------------------------------------
-- 4. Snapshot history — append-only audit chain for republished reports
-- ---------------------------------------------------------------------------

create table if not exists public.dashboard_layout_snapshot_history (
  id               uuid primary key default gen_random_uuid(),
  layout_id        uuid not null references public.dashboard_layouts (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  version          integer not null,
  snapshot_data    jsonb not null,
  cover_meta       jsonb not null default '{}'::jsonb,
  published_at     timestamptz not null,
  published_by     uuid references auth.users (id) on delete set null,
  signature_status text not null default 'unsigned',
  archived_at      timestamptz not null default now()
);

create index if not exists dashboard_layout_snapshot_history_layout_idx
  on public.dashboard_layout_snapshot_history (layout_id, archived_at desc);

alter table public.dashboard_layout_snapshot_history enable row level security;

drop policy if exists dashboard_layout_snapshot_history_select on public.dashboard_layout_snapshot_history;
create policy dashboard_layout_snapshot_history_select
  on public.dashboard_layout_snapshot_history for select
  to authenticated
  using (organization_id = public.current_org_id());

grant select on public.dashboard_layout_snapshot_history to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Share attempt log — IP-based rate-limit for redeem_share_token
-- ---------------------------------------------------------------------------

create table if not exists public.report_share_attempts (
  id           bigserial primary key,
  token        text not null,
  ip           inet,
  attempted_at timestamptz not null default now(),
  outcome      text not null check (outcome in ('ok', 'password_required', 'password_incorrect', 'expired', 'not_found', 'rate_limited'))
);

create index if not exists report_share_attempts_token_time_idx
  on public.report_share_attempts (token, attempted_at desc);

create index if not exists report_share_attempts_ip_time_idx
  on public.report_share_attempts (ip, attempted_at desc)
  where ip is not null;

alter table public.report_share_attempts enable row level security;
-- Intentionally no policies: only the security-definer RPC writes/reads this.

-- ---------------------------------------------------------------------------
-- 6. Promote legacy schedule stubs onto layouts
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'report_schedules') then
    alter table public.report_schedules alter column report_definition_id drop not null;

    alter table public.report_schedules
      add column if not exists report_layout_id uuid references public.dashboard_layouts (id) on delete cascade;
    alter table public.report_schedules
      add column if not exists recipients jsonb not null default '[]'::jsonb;
    alter table public.report_schedules
      add column if not exists last_dispatched_at timestamptz;
    alter table public.report_schedules
      add column if not exists next_run_at timestamptz;
    alter table public.report_schedules
      add column if not exists webhook_url text;
    alter table public.report_schedules
      add column if not exists webhook_secret text;

    if not exists (select 1 from pg_constraint where conname = 'report_schedules_target_one_chk') then
      alter table public.report_schedules
        add constraint report_schedules_target_one_chk
        check (
          (report_definition_id is not null and report_layout_id is null)
          or (report_definition_id is null and report_layout_id is not null)
        );
    end if;

    create index if not exists report_schedules_next_run_idx
      on public.report_schedules (next_run_at)
      where enabled = true;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'report_runs') then
    alter table public.report_runs
      add column if not exists report_layout_id uuid references public.dashboard_layouts (id) on delete set null;
    alter table public.report_runs
      add column if not exists schedule_id uuid references public.report_schedules (id) on delete set null;
    alter table public.report_runs
      add column if not exists channel text;
    alter table public.report_runs
      add column if not exists status text;
    alter table public.report_runs
      add column if not exists error_text text;

    create index if not exists report_runs_layout_idx
      on public.report_runs (report_layout_id, run_at desc)
      where report_layout_id is not null;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'report_definitions') then
    comment on table public.report_definitions is
      'DEPRECATED. Custom report builder is being retired in favour of dashboard_layouts.kind=report. No new inserts expected; kept for legacy reads only.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. publish_report — atomic publish with snapshot + share token
-- ---------------------------------------------------------------------------

create or replace function public.publish_report(
  p_id                  uuid,
  p_expected_version    int,
  p_snapshot            jsonb,
  p_share_password      text default null,
  p_share_expires_at    timestamptz default null
) returns table (ok boolean, share_token text, new_version int, err text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid       uuid := auth.uid();
  v_org       uuid := public.current_org_id();
  v_token     text;
  v_pwd_hash  text;
  v_new_ver   int;
  v_kind      text;
begin
  if v_uid is null then
    return query select false, null::text, null::int, 'not_authenticated'::text;
    return;
  end if;
  if not public.user_has_permission('reports.manage', v_uid) then
    return query select false, null::text, null::int, 'forbidden'::text;
    return;
  end if;

  select kind into v_kind from public.dashboard_layouts where id = p_id and organization_id = v_org;
  if v_kind is null then
    return query select false, null::text, null::int, 'not_found'::text;
    return;
  end if;
  if v_kind <> 'report' then
    return query select false, null::text, null::int, 'wrong_kind'::text;
    return;
  end if;
  if p_snapshot is null then
    return query select false, null::text, null::int, 'snapshot_required'::text;
    return;
  end if;
  if octet_length(p_snapshot::text) >= 4 * 1024 * 1024 then
    return query select false, null::text, null::int, 'snapshot_too_large'::text;
    return;
  end if;

  -- 24-char base64url, 144 bits of entropy
  v_token := rtrim(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_'), '=');
  v_pwd_hash := case
    when p_share_password is null or length(p_share_password) = 0 then null
    else crypt(p_share_password, gen_salt('bf'))
  end;

  update public.dashboard_layouts d
  set
    snapshot_data       = p_snapshot,
    snapshot_at         = now(),
    share_token         = v_token,
    share_password_hash = v_pwd_hash,
    share_expires_at    = p_share_expires_at,
    published_at        = now(),
    published_by        = v_uid
  where d.id = p_id
    and d.organization_id = v_org
    and d.version = p_expected_version
    and d.published_at is null
  returning d.version into v_new_ver;

  if v_new_ver is null then
    return query select false, null::text, null::int, 'stale_or_already_published'::text;
    return;
  end if;

  return query select true, v_token, v_new_ver, null::text;
end;
$$;

grant execute on function public.publish_report(uuid, int, jsonb, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. republish_report — archive the existing snapshot, replace with a new one
-- ---------------------------------------------------------------------------

create or replace function public.republish_report(
  p_id                  uuid,
  p_expected_version    int,
  p_snapshot            jsonb,
  p_share_password      text default null,
  p_share_expires_at    timestamptz default null,
  p_regenerate_token    boolean default false
) returns table (ok boolean, share_token text, new_version int, err text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid       uuid := auth.uid();
  v_org       uuid := public.current_org_id();
  v_row       public.dashboard_layouts;
  v_token     text;
  v_pwd_hash  text;
  v_new_ver   int;
begin
  if v_uid is null then
    return query select false, null::text, null::int, 'not_authenticated'::text;
    return;
  end if;
  if not public.user_has_permission('reports.manage', v_uid) then
    return query select false, null::text, null::int, 'forbidden'::text;
    return;
  end if;
  if p_snapshot is null then
    return query select false, null::text, null::int, 'snapshot_required'::text;
    return;
  end if;
  if octet_length(p_snapshot::text) >= 4 * 1024 * 1024 then
    return query select false, null::text, null::int, 'snapshot_too_large'::text;
    return;
  end if;

  select * into v_row
  from public.dashboard_layouts
  where id = p_id and organization_id = v_org
  for update;

  if not found then
    return query select false, null::text, null::int, 'not_found'::text;
    return;
  end if;
  if v_row.kind <> 'report' then
    return query select false, null::text, null::int, 'wrong_kind'::text;
    return;
  end if;
  if v_row.published_at is null then
    return query select false, null::text, null::int, 'not_published'::text;
    return;
  end if;
  if v_row.version <> p_expected_version then
    return query select false, null::text, null::int, 'stale_version'::text;
    return;
  end if;

  insert into public.dashboard_layout_snapshot_history (
    layout_id, organization_id, version, snapshot_data, cover_meta, published_at, published_by
  ) values (
    v_row.id, v_row.organization_id, v_row.version,
    v_row.snapshot_data, v_row.cover_meta, v_row.published_at, v_row.published_by
  );

  v_token := case
    when p_regenerate_token or v_row.share_token is null
      then rtrim(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_'), '=')
    else v_row.share_token
  end;

  v_pwd_hash := case
    when p_share_password is null then v_row.share_password_hash
    when length(p_share_password) = 0 then null
    else crypt(p_share_password, gen_salt('bf'))
  end;

  -- Bypass the published-immutable guard for this update
  perform set_config('request.republishing', 'on', true);

  update public.dashboard_layouts d
  set
    snapshot_data       = p_snapshot,
    snapshot_at         = now(),
    share_token         = v_token,
    share_password_hash = v_pwd_hash,
    share_expires_at    = p_share_expires_at,
    published_at        = now(),
    published_by        = v_uid
  where d.id = p_id
    and d.organization_id = v_org
  returning d.version into v_new_ver;

  perform set_config('request.republishing', 'off', true);

  return query select true, v_token, v_new_ver, null::text;
end;
$$;

grant execute on function public.republish_report(uuid, int, jsonb, text, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. unpublish_report — clear share fields, archive snapshot, keep the draft
-- ---------------------------------------------------------------------------

create or replace function public.unpublish_report(
  p_id               uuid,
  p_expected_version int
) returns table (ok boolean, new_version int, err text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid     uuid := auth.uid();
  v_org     uuid := public.current_org_id();
  v_row     public.dashboard_layouts;
  v_new_ver int;
begin
  if v_uid is null then
    return query select false, null::int, 'not_authenticated'::text;
    return;
  end if;
  if not public.user_has_permission('reports.manage', v_uid) then
    return query select false, null::int, 'forbidden'::text;
    return;
  end if;

  select * into v_row
  from public.dashboard_layouts
  where id = p_id and organization_id = v_org
  for update;

  if not found then
    return query select false, null::int, 'not_found'::text;
    return;
  end if;
  if v_row.published_at is null then
    return query select false, null::int, 'not_published'::text;
    return;
  end if;
  if v_row.version <> p_expected_version then
    return query select false, null::int, 'stale_version'::text;
    return;
  end if;

  insert into public.dashboard_layout_snapshot_history (
    layout_id, organization_id, version, snapshot_data, cover_meta, published_at, published_by
  ) values (
    v_row.id, v_row.organization_id, v_row.version,
    coalesce(v_row.snapshot_data, '{}'::jsonb), v_row.cover_meta,
    v_row.published_at, v_row.published_by
  );

  perform set_config('request.republishing', 'on', true);

  update public.dashboard_layouts d
  set
    snapshot_data       = null,
    snapshot_at         = null,
    share_token         = null,
    share_password_hash = null,
    share_expires_at    = null,
    published_at        = null,
    published_by        = null
  where d.id = p_id
    and d.organization_id = v_org
  returning d.version into v_new_ver;

  perform set_config('request.republishing', 'off', true);

  return query select true, v_new_ver, null::text;
end;
$$;

grant execute on function public.unpublish_report(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. redeem_share_token — public read entry point with bcrypt + rate-limit
--
-- Granted to anon. pg_sleep(0.2) blunts timing oracles on the password path.
-- 10 attempts per IP per minute trigger an early rate-limit reject.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_share_token(
  p_token    text,
  p_password text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row        public.dashboard_layouts;
  v_ip         inet;
  v_ip_text    text;
  v_recent_n   int;
  v_outcome    text;
begin
  if p_token is null or length(p_token) < 8 then
    return jsonb_build_object('ok', false, 'err', 'not_found');
  end if;

  -- Best-effort IP extraction from PostgREST request headers
  begin
    v_ip_text := split_part(coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ''), ',', 1);
    if v_ip_text is not null and length(trim(v_ip_text)) > 0 then
      v_ip := trim(v_ip_text)::inet;
    end if;
  exception when others then
    v_ip := null;
  end;

  perform pg_sleep(0.2);

  if v_ip is not null then
    select count(*) into v_recent_n
    from public.report_share_attempts
    where ip = v_ip
      and attempted_at > now() - interval '1 minute';
    if v_recent_n > 10 then
      insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'rate_limited');
      return jsonb_build_object('ok', false, 'err', 'rate_limited');
    end if;
  end if;

  select * into v_row
  from public.dashboard_layouts
  where share_token = p_token
    and kind = 'report'
    and deleted_at is null;

  if not found then
    insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'not_found');
    return jsonb_build_object('ok', false, 'err', 'not_found');
  end if;

  if v_row.share_expires_at is not null and v_row.share_expires_at <= now() then
    insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'expired');
    return jsonb_build_object('ok', false, 'err', 'expired');
  end if;

  if v_row.share_password_hash is not null then
    if p_password is null or length(p_password) = 0 then
      insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'password_required');
      return jsonb_build_object('ok', false, 'err', 'password_required');
    end if;
    if crypt(p_password, v_row.share_password_hash) <> v_row.share_password_hash then
      insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'password_incorrect');
      return jsonb_build_object('ok', false, 'err', 'password_incorrect');
    end if;
  end if;

  insert into public.report_share_attempts (token, ip, outcome) values (p_token, v_ip, 'ok');
  perform set_config('request.share_token', p_token, true);

  return jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'id',               v_row.id,
      'name',             v_row.name,
      'description',      v_row.description,
      'scope_id',         v_row.scope_id,
      'report_scopes',    to_jsonb(v_row.report_scopes),
      'layout',           v_row.layout,
      'filters',          v_row.filters,
      'snapshot_data',    v_row.snapshot_data,
      'cover_meta',       v_row.cover_meta,
      'published_at',     v_row.published_at,
      'snapshot_at',      v_row.snapshot_at,
      'share_expires_at', v_row.share_expires_at
    )
  );
end;
$$;

grant execute on function public.redeem_share_token(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Seed module permissions for the new reporting surfaces
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.reports'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'reports.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
