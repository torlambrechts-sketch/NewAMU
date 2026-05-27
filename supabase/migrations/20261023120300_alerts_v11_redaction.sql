-- Alerts v1.1 — alert_redaction (redaction proposals for DSAR responses).
--
-- v1.1 §6 + §8: DSAR redaction tool proposes regions; DPO accepts; export
-- uses the accepted regions to mask content before generating the PDF.
--
-- Self-audit:
--   * GDPR Art. 15 (4) — reporter confidentiality refusal ground requires
--     mechanical evidence of the redaction decision: who, when, why.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_redaction (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dsar_request_id uuid references public.alert_dsar_request (id) on delete set null,
  region_kind     text not null check (region_kind in ('reporter_identity','witness_identity','third_party','internal_deliberation','other')),
  source_field    text not null,                  -- e.g. 'case.title', 'note.body', 'attachment.filename'
  source_row_id   uuid,                             -- the row whose content is masked (note id, attachment id, etc.)
  start_offset    integer,                          -- inclusive char offset (null = entire field)
  end_offset      integer,
  suggested_by    text not null default 'heuristic' check (suggested_by in ('heuristic','dpo','counsel')),
  suggested_at    timestamptz not null default now(),
  accepted_by     uuid references auth.users (id) on delete set null,
  accepted_at     timestamptz,
  rejected_by     uuid references auth.users (id) on delete set null,
  rejected_at     timestamptz,
  reason          text
);

create index if not exists alert_redaction_case_idx
  on public.alert_redaction (case_id);

create index if not exists alert_redaction_dsar_idx
  on public.alert_redaction (dsar_request_id) where dsar_request_id is not null;

alter table public.alert_redaction enable row level security;

drop policy if exists alert_redaction_select on public.alert_redaction;
create policy alert_redaction_select
  on public.alert_redaction for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.auditor')
    )
  );

drop policy if exists alert_redaction_write on public.alert_redaction;
create policy alert_redaction_write
  on public.alert_redaction for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.dpo'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.dpo'))
  );

-- Once accepted_at or rejected_at is set, the row is immutable except for
-- the inverse field (e.g. you can reject an accepted region with reason).
create or replace function public.alert_redaction_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if new.case_id is distinct from old.case_id
     or new.organization_id is distinct from old.organization_id
     or new.region_kind is distinct from old.region_kind
     or new.source_field is distinct from old.source_field
     or new.source_row_id is distinct from old.source_row_id
     or new.start_offset is distinct from old.start_offset
     or new.end_offset is distinct from old.end_offset
     or new.suggested_by is distinct from old.suggested_by
     or new.suggested_at is distinct from old.suggested_at then
    raise exception 'alert_redaction core fields are immutable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_redaction_before_update_lock_tg on public.alert_redaction;
create trigger alert_redaction_before_update_lock_tg
  before update on public.alert_redaction
  for each row execute function public.alert_redaction_before_update_lock();
