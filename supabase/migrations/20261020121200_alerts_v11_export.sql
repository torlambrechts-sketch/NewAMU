-- Alerts v1.1 — alert_export (export audit trail).
--
-- v1.1 §2 spec: every export of case content (full PDF, audit log, redacted
-- disclosure to DSAR requester, evidence ZIP for external investigator) is
-- logged with the recipient, the purpose, and a SHA-256 of the bytes that
-- were sent. Lets the org reconstruct the disclosure trail in a later DSAR
-- or compliance audit.
--
-- Self-audit:
--   * GDPR Art. 5 (2) accountability — exports are processing acts;
--     dokumentasjonsplikt for tilsynsmyndighet.
--   * Forskrift om utførelse av arbeid kap. 31 — chain-of-custody on
--     evidence shared with external investigator.
--
-- Insert-only by design; no UPDATE/DELETE allowed.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_export (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid references public.alert_cases (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  exported_by     uuid not null references auth.users (id) on delete restrict,
  export_type     text not null check (export_type in (
                    'full_case_pdf','audit_log','redacted_disclosure','evidence_zip','dsar_response')),
  purpose         text not null,
  recipient       text not null,                       -- email, agency, or 'self' for ops use
  file_hash       bytea,                               -- sha256 of exported bytes
  file_size       bigint,
  expires_at      timestamptz,                          -- when the signed URL no longer works
  dsar_request_id uuid references public.alert_dsar_request (id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists alert_export_case_idx
  on public.alert_export (case_id, created_at desc);

create index if not exists alert_export_dsar_idx
  on public.alert_export (dsar_request_id)
  where dsar_request_id is not null;

create index if not exists alert_export_org_idx
  on public.alert_export (organization_id, created_at desc);

alter table public.alert_export enable row level security;

drop policy if exists alert_export_select on public.alert_export;
create policy alert_export_select
  on public.alert_export for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.auditor')
    )
  );

drop policy if exists alert_export_insert on public.alert_export;
create policy alert_export_insert
  on public.alert_export for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exported_by = auth.uid()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
    )
  );

-- No update, no delete.
create or replace function public.alert_export_block_mutation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'alert_export is append-only (TG_OP=%)', TG_OP
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists alert_export_no_upd on public.alert_export;
create trigger alert_export_no_upd
  before update on public.alert_export
  for each row execute function public.alert_export_block_mutation();

drop trigger if exists alert_export_no_del on public.alert_export;
create trigger alert_export_no_del
  before delete on public.alert_export
  for each row execute function public.alert_export_block_mutation();
