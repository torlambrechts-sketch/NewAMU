-- Alerts v1.1 — alert_break_glass_session (emergency access workflow).
--
-- v1.1 §1 spec: when normal handlers are implicated (e.g. they ARE the
-- accused), the org needs an emergency override. Two-person approval +
-- 72h auto-expire + every read logged + hard-alert to all admin/dpo/
-- committee users.
--
-- Self-audit:
--   * AML § 2A-2 (3) — when the standard committee can't be trusted,
--     escape-hatch authority must exist. board_escalation initiates;
--     a different board_escalation user approves.
--   * ISAE 3000 / ISO 27001 A.5.36 — privileged access logging.
--
-- Active sessions are visible to alert_cases_select RLS via the helper
-- alerts_break_glass_active_for() called from the policy (added in
-- _121600_alerts_v11_roles.sql so the RLS extension lands with the rest of
-- the role expansion).
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_break_glass_session (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  initiated_by             uuid not null references auth.users (id) on delete restrict,
  justification_encrypted  bytea not null,
  justification_key_version integer not null default 1,
  approved_by              uuid references auth.users (id) on delete restrict,
  approved_at              timestamptz,
  state                    text not null default 'pending'
                             check (state in ('pending','active','expired','denied','revoked')),
  initiated_at             timestamptz not null default now(),
  expires_at               timestamptz,
  revoked_at               timestamptz,
  revoked_by               uuid references auth.users (id) on delete restrict,
  revoke_reason            text,
  metadata                 jsonb not null default '{}'::jsonb
);

create index if not exists alert_break_glass_active_idx
  on public.alert_break_glass_session (organization_id, initiated_by, state)
  where state = 'active';

create index if not exists alert_break_glass_pending_idx
  on public.alert_break_glass_session (organization_id, initiated_at desc)
  where state = 'pending';

alter table public.alert_break_glass_session enable row level security;

drop policy if exists alert_break_glass_session_select on public.alert_break_glass_session;
create policy alert_break_glass_session_select
  on public.alert_break_glass_session for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.board_escalation')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.auditor')
      or initiated_by = auth.uid()
    )
  );

drop policy if exists alert_break_glass_session_insert on public.alert_break_glass_session;
create policy alert_break_glass_session_insert
  on public.alert_break_glass_session for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and initiated_by = auth.uid()
    and public.user_has_permission('alerts.board_escalation')
  );

drop policy if exists alert_break_glass_session_update on public.alert_break_glass_session;
create policy alert_break_glass_session_update
  on public.alert_break_glass_session for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.board_escalation'))
  )
  with check (
    organization_id = public.current_org_id()
  );

-- State transition trigger: pending → active (when approved_by set);
-- active → expired (via cron); active/pending → denied/revoked (manual).
create or replace function public.alert_break_glass_session_before_update_validate()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'alert_break_glass_session.organization_id is immutable' using errcode = 'check_violation';
  end if;
  if new.initiated_by is distinct from old.initiated_by then
    raise exception 'alert_break_glass_session.initiated_by is immutable' using errcode = 'check_violation';
  end if;
  if new.justification_encrypted is distinct from old.justification_encrypted then
    raise exception 'alert_break_glass_session.justification_encrypted is immutable' using errcode = 'check_violation';
  end if;
  if new.initiated_at is distinct from old.initiated_at then
    raise exception 'alert_break_glass_session.initiated_at is immutable' using errcode = 'check_violation';
  end if;
  -- approved_by must be different from initiated_by (two-person rule).
  if new.approved_by is not null and new.approved_by = new.initiated_by then
    raise exception 'alert_break_glass_session: two-person rule — approver must differ from initiator'
      using errcode = 'check_violation';
  end if;
  -- When activating, set expires_at if not provided.
  if new.state = 'active' and old.state = 'pending' and new.expires_at is null then
    new.expires_at := coalesce(new.approved_at, now()) + interval '72 hours';
  end if;
  -- Terminal states are sticky.
  if old.state in ('expired','denied','revoked') and new.state <> old.state then
    raise exception 'alert_break_glass_session: cannot revert from terminal state %', old.state
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_break_glass_session_before_update_validate_tg on public.alert_break_glass_session;
create trigger alert_break_glass_session_before_update_validate_tg
  before update on public.alert_break_glass_session
  for each row execute function public.alert_break_glass_session_before_update_validate();

-- Helper: returns the org_id of any active break-glass session for the
-- calling user. Used in alert_cases_select RLS to grant org-wide read.
create or replace function public.alerts_break_glass_active_for(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select s.organization_id
    from public.alert_break_glass_session s
    where s.initiated_by = p_user_id
      and s.state = 'active'
      and s.expires_at > now()
    order by s.approved_at desc
    limit 1;
$$;

revoke all on function public.alerts_break_glass_active_for(uuid) from public, anon;
grant execute on function public.alerts_break_glass_active_for(uuid) to authenticated, service_role;

-- Cron-callable expirer.
create or replace function public.alerts_break_glass_expire_sessions()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.alert_break_glass_session
       set state = 'expired'
     where state = 'active'
       and expires_at < now()
     returning 1
  )
  select count(*) into v_count from expired;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.alerts_break_glass_expire_sessions() from public, anon;
grant execute on function public.alerts_break_glass_expire_sessions() to service_role;
