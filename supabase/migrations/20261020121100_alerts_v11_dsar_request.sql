-- Alerts v1.1 — alert_dsar_request (Data Subject Access Request workflow).
--
-- v1.1 §8 spec: DPO logs each DSAR; system searches cases for the subject
-- identifier; DPO proposes redactions per case; counsel reviews; export
-- generates a watermarked PDF; full process audit-logged with a 30-day
-- GDPR Art. 12 (3) clock. State machine:
--    received → in_legal_review → redacting → fulfilled / rejected_rights / rejected_excessive
--
-- Self-audit:
--   * GDPR Art. 12 (3) — 30-day response window; trigger sets response_due_at
--     = received_at + 30 days at insert. Index on (state, response_due_at)
--     drives the DPO burndown widget.
--   * GDPR Art. 15 (4) — refusal ground when disclosure adversely affects
--     others' rights/freedoms (reporter confidentiality). outcome = rejected_rights.
--   * GDPR Art. 12 (5) — refusal ground for manifestly unfounded/excessive
--     requests. outcome = rejected_excessive with written justification.
--
-- subject_identifier is stored as bytea HMAC (never plaintext) so the DPO
-- can match a request against historical cases without a giant PII column.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_dsar_request (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  subject_type             text not null check (subject_type in ('reporter','accused','witness','other')),
  subject_identifier_hash  bytea not null,
  case_ids                 uuid[] not null default '{}',
  state                    text not null default 'received'
                             check (state in ('received','in_legal_review','redacting','fulfilled','rejected_rights','rejected_excessive')),
  legal_review_notes_encrypted bytea,
  legal_review_notes_key_version integer,
  response_due_at          timestamptz not null,
  outcome                  text,
  outcome_at               timestamptz,
  received_at              timestamptz not null default now(),
  received_by              uuid references auth.users (id) on delete set null,
  updated_at               timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

create index if not exists alert_dsar_due_idx
  on public.alert_dsar_request (state, response_due_at)
  where state in ('received','in_legal_review','redacting');

create index if not exists alert_dsar_subject_idx
  on public.alert_dsar_request (organization_id, subject_identifier_hash);

alter table public.alert_dsar_request enable row level security;

drop policy if exists alert_dsar_request_select on public.alert_dsar_request;
create policy alert_dsar_request_select
  on public.alert_dsar_request for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.auditor')
    )
  );

drop policy if exists alert_dsar_request_write on public.alert_dsar_request;
create policy alert_dsar_request_write
  on public.alert_dsar_request for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.dpo'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.dpo'))
  );

-- Set response_due_at on insert from received_at + 30 days.
create or replace function public.alert_dsar_request_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.received_at is null then
    new.received_at := now();
  end if;
  if new.response_due_at is null then
    new.response_due_at := new.received_at + interval '30 days';
  end if;
  if new.received_by is null then
    new.received_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists alert_dsar_request_before_insert_defaults_tg on public.alert_dsar_request;
create trigger alert_dsar_request_before_insert_defaults_tg
  before insert on public.alert_dsar_request
  for each row execute function public.alert_dsar_request_before_insert_defaults();

-- State transition validation.
create or replace function public.alert_dsar_request_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'alert_dsar_request.organization_id is immutable' using errcode = 'check_violation';
  end if;
  if new.subject_type is distinct from old.subject_type then
    raise exception 'alert_dsar_request.subject_type is immutable' using errcode = 'check_violation';
  end if;
  if new.subject_identifier_hash is distinct from old.subject_identifier_hash then
    raise exception 'alert_dsar_request.subject_identifier_hash is immutable' using errcode = 'check_violation';
  end if;
  if new.received_at is distinct from old.received_at then
    raise exception 'alert_dsar_request.received_at is immutable' using errcode = 'check_violation';
  end if;
  if new.response_due_at is distinct from old.response_due_at then
    raise exception 'alert_dsar_request.response_due_at is immutable' using errcode = 'check_violation';
  end if;

  -- Valid state transitions.
  if new.state is distinct from old.state then
    if old.state in ('fulfilled','rejected_rights','rejected_excessive')
       and new.state not in ('fulfilled','rejected_rights','rejected_excessive') then
      raise exception 'alert_dsar_request cannot revert from terminal state %', old.state
        using errcode = 'check_violation';
    end if;
    if old.state = 'received' and new.state not in ('in_legal_review','rejected_excessive') then
      raise exception 'alert_dsar_request: invalid transition from received → %', new.state
        using errcode = 'check_violation';
    end if;
    if old.state = 'in_legal_review' and new.state not in ('redacting','rejected_rights','rejected_excessive') then
      raise exception 'alert_dsar_request: invalid transition from in_legal_review → %', new.state
        using errcode = 'check_violation';
    end if;
    if old.state = 'redacting' and new.state not in ('fulfilled','rejected_rights') then
      raise exception 'alert_dsar_request: invalid transition from redacting → %', new.state
        using errcode = 'check_violation';
    end if;
    -- Stamp outcome_at when entering terminal state.
    if new.state in ('fulfilled','rejected_rights','rejected_excessive') and new.outcome_at is null then
      new.outcome_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists alert_dsar_request_before_update_lock_tg on public.alert_dsar_request;
create trigger alert_dsar_request_before_update_lock_tg
  before update on public.alert_dsar_request
  for each row execute function public.alert_dsar_request_before_update_lock();

drop trigger if exists alert_dsar_request_set_updated_at on public.alert_dsar_request;
create trigger alert_dsar_request_set_updated_at
  before update on public.alert_dsar_request
  for each row execute function public.set_updated_at();
