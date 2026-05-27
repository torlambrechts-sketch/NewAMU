-- Alerts v1.1 — per-org envelope-encryption key material.
--
-- Implements the v1.1 spec §1 key hierarchy:
--   External KMS → Per-org KEK → Per-org DEK (wrapped) → Per-record encryption
-- The KEK is held by Supabase Vault (or an external KMS in enterprise tier);
-- only the wrapped DEK lives in this table. The wrapped DEK is unwrapped by
-- a SECURITY DEFINER helper that calls Vault; the unwrapped DEK is never
-- persisted outside the request scope.
--
-- Self-audit:
--   * GDPR Art. 32 (1) (a) krypterings-tiltak — per-org isolated DEKs make
--     cross-tenant decrypts impossible even with full DB access.
--   * Datatilsynets veiledning om sikkerhetstiltak — wrap KEK in Vault so
--     compromise of an offline DB backup doesn't compromise the plaintext.
--
-- Storage format for ciphertext columns (applied uniformly across alerts
-- tables that follow): version(1) || nonce(24) || ciphertext(>=16).
-- 24-byte nonce = XChaCha20-Poly1305-IETF. Version byte = 0x01 for v1.1.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

create table if not exists public.alert_org_key (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  kek_provider      text not null default 'supabase_vault'
                      check (kek_provider in ('supabase_vault','aws_kms','azure_keyvault','gcp_kms','customer_managed')),
  kms_key_id        text not null,                   -- Vault key name or KMS ARN
  wrapped_dek       bytea not null,                  -- DEK encrypted by the KEK
  dek_version       integer not null default 1,
  rotated_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  notes             text
);

create index if not exists alert_org_key_version_idx
  on public.alert_org_key (organization_id, dek_version);

alter table public.alert_org_key enable row level security;

-- Read: alerts.committee + alerts.committee_confidential + alerts.dpo.
-- Anyone who needs to decrypt case content needs to fetch the wrapped DEK.
drop policy if exists alert_org_key_select on public.alert_org_key;
create policy alert_org_key_select
  on public.alert_org_key for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
      or public.user_has_permission('alerts.dpo')
    )
  );

-- Write: org-admin only. Bootstrap uses SECURITY DEFINER helper below.
drop policy if exists alert_org_key_write on public.alert_org_key;
create policy alert_org_key_write
  on public.alert_org_key for all
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

drop trigger if exists alert_org_key_set_updated_at on public.alert_org_key;
create trigger alert_org_key_set_updated_at
  before update on public.alert_org_key
  for each row execute function public.set_updated_at();

-- ── Helper: provision a fresh DEK for an org. Idempotent — re-running
-- rotates the key (writes a new wrapped_dek with bumped version).
create or replace function public.alerts_provision_org_key(
  p_org_id     uuid,
  p_kms_key_id text,
  p_wrapped_dek bytea,
  p_kek_provider text default 'supabase_vault'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_new_version integer;
begin
  if not public.is_org_admin() then
    raise exception 'alerts_provision_org_key requires org-admin role'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.alert_org_key as k
    (organization_id, kek_provider, kms_key_id, wrapped_dek, dek_version)
  values (p_org_id, p_kek_provider, p_kms_key_id, p_wrapped_dek, 1)
  on conflict (organization_id) do update
    set kek_provider = excluded.kek_provider,
        kms_key_id   = excluded.kms_key_id,
        wrapped_dek  = excluded.wrapped_dek,
        dek_version  = k.dek_version + 1,
        rotated_at   = now()
  returning dek_version into v_new_version;
  return v_new_version;
end;
$$;

revoke all on function public.alerts_provision_org_key(uuid, text, bytea, text) from public, anon;
grant execute on function public.alerts_provision_org_key(uuid, text, bytea, text) to authenticated, service_role;

-- ── Helper: fetch wrapped DEK for the calling user's org. Returns nothing
-- when no key exists (caller falls back to plaintext columns for legacy rows).
create or replace function public.alerts_current_org_key()
returns table (
  organization_id uuid,
  kek_provider   text,
  kms_key_id     text,
  wrapped_dek    bytea,
  dek_version    integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
    select k.organization_id, k.kek_provider, k.kms_key_id, k.wrapped_dek, k.dek_version
      from public.alert_org_key k
     where k.organization_id = public.current_org_id();
end;
$$;

revoke all on function public.alerts_current_org_key() from public, anon;
grant execute on function public.alerts_current_org_key() to authenticated;
