-- Alerts v1.1 — alert_accused (first-class entity).
--
-- v1.1 spec §2 promotes the accused from "free-text inside a note" to a
-- first-class row so it can be linked to interview records, right-of-reply
-- can be tracked, and DSAR redaction can mask the accused identity
-- consistently.
--
-- Self-audit:
--   * AML § 2A-4 prohibition on retaliation — accused's right to be heard
--     (notified_at, right_of_reply_encrypted) recorded as evidence the
--     committee gave them an opportunity to respond.
--   * GDPR Art. 5 (1) (a) lawfulness — explicit row makes the legal basis
--     (legitimate interest § 6 (1) (f)) auditable per accused, not buried
--     in notes.
--   * GDPR Art. 32 — display_name_encrypted + right_of_reply_encrypted use
--     the same envelope encryption as reporter identity.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_accused (
  id                       uuid primary key default gen_random_uuid(),
  case_id                  uuid not null references public.alert_cases (id) on delete cascade,
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  display_name_encrypted   bytea not null,
  display_name_key_version integer not null default 1,
  role_or_title            text,                       -- e.g. 'Avdelingsleder', 'Daglig leder'
  reporter_relationship    text,                       -- e.g. 'overordnet', 'kollega', 'samarbeidspartner'
  notified_at              timestamptz,
  notification_method      text,                       -- 'email','phone','in_person','letter'
  right_of_reply_encrypted bytea,
  right_of_reply_key_version integer,
  right_of_reply_received_at timestamptz,
  redacted_at              timestamptz,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists alert_accused_case_idx
  on public.alert_accused (case_id)
  where redacted_at is null;

alter table public.alert_accused enable row level security;

drop policy if exists alert_accused_select on public.alert_accused;
create policy alert_accused_select
  on public.alert_accused for select
  to authenticated
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
  );

drop policy if exists alert_accused_write on public.alert_accused;
create policy alert_accused_write
  on public.alert_accused for all
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
    )
  );

-- ── Lock trigger: display_name_encrypted immutable from insert (identity
--    protection). right_of_reply_encrypted mutable until the case closes.
create or replace function public.alert_accused_before_update_lock()
returns trigger
language plpgsql
as $$
declare
  v_closed_at timestamptz;
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id then
    raise exception 'alert_accused.case_id is immutable' using errcode = 'check_violation';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'alert_accused.organization_id is immutable' using errcode = 'check_violation';
  end if;
  if new.display_name_encrypted is distinct from old.display_name_encrypted then
    raise exception 'alert_accused.display_name_encrypted is immutable from insert' using errcode = 'check_violation';
  end if;
  if new.display_name_key_version is distinct from old.display_name_key_version then
    raise exception 'alert_accused.display_name_key_version is immutable' using errcode = 'check_violation';
  end if;
  select c.closed_at into v_closed_at
    from public.alert_cases c
    where c.id = new.case_id;
  if v_closed_at is not null then
    if new.right_of_reply_encrypted is distinct from old.right_of_reply_encrypted then
      raise exception 'alert_accused.right_of_reply_encrypted is immutable post-close' using errcode = 'check_violation';
    end if;
    if new.notified_at is distinct from old.notified_at then
      raise exception 'alert_accused.notified_at is immutable post-close' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists alert_accused_before_update_lock_tg on public.alert_accused;
create trigger alert_accused_before_update_lock_tg
  before update on public.alert_accused
  for each row execute function public.alert_accused_before_update_lock();

drop trigger if exists alert_accused_set_updated_at on public.alert_accused;
create trigger alert_accused_set_updated_at
  before update on public.alert_accused
  for each row execute function public.set_updated_at();
