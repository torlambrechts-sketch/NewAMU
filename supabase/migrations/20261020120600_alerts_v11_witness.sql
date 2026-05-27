-- Alerts v1.1 — alert_witness (first-class entity).
--
-- Witness records track non-anonymous interviewees in an investigation.
-- Distinct from accused (no right-of-reply) and distinct from notes
-- (structured fields for interview tracking). display_name is nullable to
-- support anonymous witnesses that opted into testimony without identity.
--
-- Self-audit:
--   * AML § 2A-7 (5) — same identity-protection contract as the reporter.
--   * Forskrift om utførelse av arbeid § 6 (intervju ved psykososialt
--     arbeidsmiljø) — interview_at + interview_step_id ties the testimony
--     to a concrete interview record (added in Phase 3).
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_witness (
  id                       uuid primary key default gen_random_uuid(),
  case_id                  uuid not null references public.alert_cases (id) on delete cascade,
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  display_name_encrypted   bytea,                      -- null for anonymous witnesses
  display_name_key_version integer,
  role_or_title            text,
  relationship_to_case     text,                       -- 'kollega','samarbeidspartner','tilskuer'
  interview_at             timestamptz,
  interview_step_id        uuid,                       -- FK added in 20261022120000 (alert_interview)
  consented                boolean not null default false,
  consent_recorded_at      timestamptz,
  redacted_at              timestamptz,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists alert_witness_case_idx
  on public.alert_witness (case_id)
  where redacted_at is null;

create index if not exists alert_witness_interview_step_idx
  on public.alert_witness (interview_step_id)
  where interview_step_id is not null;

alter table public.alert_witness enable row level security;

drop policy if exists alert_witness_select on public.alert_witness;
create policy alert_witness_select
  on public.alert_witness for select
  to authenticated
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
  );

drop policy if exists alert_witness_write on public.alert_witness;
create policy alert_witness_write
  on public.alert_witness for all
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

-- Append-only deletes blocked except during purge.
create or replace function public.alert_witness_block_delete()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return old;
  end if;
  raise exception 'alert_witness rows cannot be deleted (use redacted_at)'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists alert_witness_block_delete_tg on public.alert_witness;
create trigger alert_witness_block_delete_tg
  before delete on public.alert_witness
  for each row execute function public.alert_witness_block_delete();

-- display_name immutable from insert (identity protection).
create or replace function public.alert_witness_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id then
    raise exception 'alert_witness.case_id is immutable' using errcode = 'check_violation';
  end if;
  if new.display_name_encrypted is distinct from old.display_name_encrypted then
    raise exception 'alert_witness.display_name_encrypted is immutable from insert' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_witness_before_update_lock_tg on public.alert_witness;
create trigger alert_witness_before_update_lock_tg
  before update on public.alert_witness
  for each row execute function public.alert_witness_before_update_lock();

drop trigger if exists alert_witness_set_updated_at on public.alert_witness;
create trigger alert_witness_set_updated_at
  before update on public.alert_witness
  for each row execute function public.set_updated_at();
