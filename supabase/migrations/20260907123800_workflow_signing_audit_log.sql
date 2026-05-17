-- Workflow signing audit log — append-only forensic trail for every
-- gov-bound signature (Maskinporten JWT-bearer-grants today, evidence
-- manifests next).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: NSM Grunnprinsipper (Beskytte og Oppdage —
--   sporbar bruk av kryptografisk nøkkel­materiale) + IK-f § 5 nr. 7
--   (systematisk overvåking og gjennomgang). Hver signering mot
--   Altinn / Arbeidstilsynet / Datatilsynet / NAV må kunne knyttes
--   tilbake til en KID, et tids­punkt og et hash av input­et — uten
--   logging er signaturen ubrukelig som bevis i en pålegg­sak.
--   Restrisiko deferred: vi lagrer ikke selve signaturen (kun
--   sha256(signing_input)) — hvis en motpart bestrider en innsending
--   må vi kunne reprodusere assertion-en fra workflow_runs.input_snapshot
--   og re-signere for sammenligning. Akseptert siden å lagre signaturen
--   ville være redundant med Maskinporten-loggene hos Digdir.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ── 1. Table ─────────────────────────────────────────────────────────────

create table if not exists public.workflow_signing_audit_log (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  kind                     text not null check (kind in ('altinn','regint','datatilsynet','nav','evidence')),
  adapter                  text not null check (adapter in (
    'vault_pem','hsm_stub','aws_cloudhsm','azure_keyvault_hsm','buypass_hsm','stub'
  )),
  signed_at                timestamptz not null default now(),
  public_key_kid           text,
  cert_serial              text,
  cert_expires_at          timestamptz,
  intent                   text not null,
  sha256_of_signed_input   text not null
);

create index if not exists workflow_signing_audit_log_org_idx
  on public.workflow_signing_audit_log (organization_id, signed_at desc);

create index if not exists workflow_signing_audit_log_kind_idx
  on public.workflow_signing_audit_log (organization_id, kind, signed_at desc);

create index if not exists workflow_signing_audit_log_kid_idx
  on public.workflow_signing_audit_log (public_key_kid, signed_at desc);

comment on table public.workflow_signing_audit_log is
  'Append-only audit trail. One row per gov signature (Maskinporten JWT or evidence manifest). Writes are service-role only; reads are gated on org membership. NSM/IK-f forensic requirement.';
comment on column public.workflow_signing_audit_log.adapter is
  'Signer.kind that produced the signature. Matches the discriminant in supabase/functions/_shared/signing/types.ts.';
comment on column public.workflow_signing_audit_log.intent is
  'Free-form purpose tag — e.g. maskinporten_jwt_bearer_grant, evidence_manifest_signature.';
comment on column public.workflow_signing_audit_log.sha256_of_signed_input is
  'sha256 over the exact bytes passed to Signer.sign(). Lets us prove (jointly with workflow_runs.input_snapshot) what was attested without storing the signature itself.';

-- ── 2. RLS ───────────────────────────────────────────────────────────────

alter table public.workflow_signing_audit_log enable row level security;

-- service_role writes (edge functions only)
drop policy if exists workflow_signing_audit_log_service_insert on public.workflow_signing_audit_log;
create policy workflow_signing_audit_log_service_insert
  on public.workflow_signing_audit_log
  for insert
  to service_role
  with check (true);

-- org members read (so the platform UI can render a signature history)
drop policy if exists workflow_signing_audit_log_org_select on public.workflow_signing_audit_log;
create policy workflow_signing_audit_log_org_select
  on public.workflow_signing_audit_log
  for select
  using (organization_id = public.current_org_id());

-- ── 3. Append-only triggers ──────────────────────────────────────────────

create or replace function public.trg_workflow_signing_audit_log_deny_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workflow_signing_audit_log is append-only; update denied for row %', old.id;
end;
$$;

drop trigger if exists workflow_signing_audit_log_deny_update on public.workflow_signing_audit_log;
create trigger workflow_signing_audit_log_deny_update
  before update on public.workflow_signing_audit_log
  for each row execute function public.trg_workflow_signing_audit_log_deny_update();

create or replace function public.trg_workflow_signing_audit_log_deny_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workflow_signing_audit_log is append-only; delete denied for row %', old.id;
end;
$$;

drop trigger if exists workflow_signing_audit_log_deny_delete on public.workflow_signing_audit_log;
create trigger workflow_signing_audit_log_deny_delete
  before delete on public.workflow_signing_audit_log
  for each row execute function public.trg_workflow_signing_audit_log_deny_delete();

-- ── 4. Grants ────────────────────────────────────────────────────────────

grant select on public.workflow_signing_audit_log to authenticated;
grant insert, select on public.workflow_signing_audit_log to service_role;
