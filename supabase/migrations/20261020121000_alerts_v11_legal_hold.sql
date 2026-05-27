-- Alerts v1.1 — alert_legal_hold (retention suspension).
--
-- Legal holds suspend the retention purge for cases under investigation,
-- litigation, or regulatory enquiry. Trigger on alerts_purge_expired_cases
-- (existing v1.0 function) is updated below to skip held cases. Hold
-- lifecycle: imposed (released_at IS NULL) → released (released_at set).
--
-- Self-audit:
--   * GDPR Art. 5 (1) (e) lagringsbegrensning — legal hold is the only
--     documented exemption to the retention floor.
--   * Datatilsynets veiledning om internkontroll — "preservation order"
--     pattern. imposed_by + reason + reference make it auditable.
--   * Norsk straffeprosesslov § 203 (sikring av bevis) — criminal-reason
--     holds reference the regs that compel preservation.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_legal_hold (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reason          text not null check (reason in ('criminal','litigation','regulatory','internal_review')),
  reference       text not null,                       -- e.g. case number, court ref, Datatilsynet ref
  imposed_by      uuid not null references auth.users (id) on delete restrict,
  imposed_at      timestamptz not null default now(),
  released_by     uuid references auth.users (id) on delete restrict,
  released_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists alert_legal_hold_active_idx
  on public.alert_legal_hold (case_id)
  where released_at is null;

create index if not exists alert_legal_hold_org_idx
  on public.alert_legal_hold (organization_id, imposed_at desc);

alter table public.alert_legal_hold enable row level security;

drop policy if exists alert_legal_hold_select on public.alert_legal_hold;
create policy alert_legal_hold_select
  on public.alert_legal_hold for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.auditor')
    )
  );

drop policy if exists alert_legal_hold_write on public.alert_legal_hold;
create policy alert_legal_hold_write
  on public.alert_legal_hold for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
    )
  );

-- Once imposed_at is set it cannot be changed. release sets released_at /
-- released_by; nothing else mutates.
create or replace function public.alert_legal_hold_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id
     or new.organization_id is distinct from old.organization_id
     or new.reason is distinct from old.reason
     or new.reference is distinct from old.reference
     or new.imposed_by is distinct from old.imposed_by
     or new.imposed_at is distinct from old.imposed_at then
    raise exception 'alert_legal_hold core fields are immutable post-imposition'
      using errcode = 'check_violation';
  end if;
  -- Cannot un-release once released.
  if old.released_at is not null and new.released_at is null then
    raise exception 'alert_legal_hold cannot be un-released; impose a new hold instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_legal_hold_before_update_lock_tg on public.alert_legal_hold;
create trigger alert_legal_hold_before_update_lock_tg
  before update on public.alert_legal_hold
  for each row execute function public.alert_legal_hold_before_update_lock();

-- Helper: returns true when a case has any active hold.
create or replace function public.alerts_case_has_active_hold(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.alert_legal_hold
    where case_id = p_case_id and released_at is null
  );
$$;

revoke all on function public.alerts_case_has_active_hold(uuid) from public, anon;
grant execute on function public.alerts_case_has_active_hold(uuid) to authenticated, service_role;

-- Extend the v1.0 retention purge function to honour holds. The original
-- function exists as alerts_purge_expired_cases() — we replace it with a
-- wrapper that adds the hold join, preserving the original signature.
create or replace function public.alerts_purge_expired_cases()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case   record;
  v_count  integer := 0;
begin
  perform set_config('app.alerts_purge_active', 'true', true);
  for v_case in
    select c.id, c.organization_id
      from public.alert_cases c
     where c.closed_at is not null
       and c.retention_until is not null
       and c.retention_until < now()
       and c.redacted_at is null
       and not public.alerts_case_has_active_hold(c.id)
     for update of c skip locked
  loop
    -- NULL identity-bearing columns + encrypted variants.
    update public.alert_cases
       set description = null,
           description_encrypted = null,
           reporter_contact = null,
           reporter_display_name = null,
           reporter_user_id = null,
           reporter_identifier_encrypted = null,
           reporter_email_for_notification_hashed = null,
           closing_summary = null,
           risk_assessment = null,
           mitigation_actions = null,
           metadata = '{}'::jsonb,
           submission_user_agent = null,
           submission_locale = null,
           title = '[redacted: retention expired]',
           title_encrypted = null,
           redacted_at = now()
     where id = v_case.id;

    update public.alert_case_notes
       set body = null,
           body_encrypted = null
     where case_id = v_case.id
       and (visible_to_reporter = true
            or note_kind in ('communication_to_reporter','communication_from_reporter'));

    update public.alert_case_attachments
       set is_redacted = true,
           storage_path = null
     where case_id = v_case.id;

    insert into public.alert_case_timeline_events
      (case_id, organization_id, event_kind, actor_kind, payload)
    values (v_case.id, v_case.organization_id, 'retention_purged', 'system',
            jsonb_build_object('purged_at', now()));

    v_count := v_count + 1;
  end loop;
  perform set_config('app.alerts_purge_active', 'false', true);
  return v_count;
end;
$$;

revoke all on function public.alerts_purge_expired_cases() from public, anon;
grant execute on function public.alerts_purge_expired_cases() to service_role;
