-- Vault references for Maskinporten/gov integration credentials.
--
-- Per-org virksomhetssertifikat private keys live in Supabase Vault
-- (vault.secrets) — never in org_integrations.config. This migration:
--   * Adds vault_secret_name column to org_integrations so each row
--     points at the Vault entry for its private key (PEM PKCS#8).
--     The kid (JWK key id) is still public and stays in config.
--   * Adds a security-definer wrapper public.workflow_read_vault_secret(name)
--     that returns the decrypted secret value, gated on service-role.
--   * Exposes provision RPCs platform admins can call to upsert a Vault
--     secret + the org_integrations row in one go.
--
-- Until this migration shipped the edge functions read keys from env
-- vars (MASKINPORTEN_TT02_PRIVATE_KEY / MASKINPORTEN_PROD_PRIVATE_KEY)
-- — sufficient for one shared TT02 sandbox. For per-org production keys
-- this Vault path is mandatory.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: personvernforordningen art. 32 — passende
--   tekniske tiltak (kryptert key storage). NSM Grunnprinsipper 2.1 —
--   nøkler skal aldri logges eller eksponeres.
--   Restrisiko deferred: HSM-backed signing (NSM Grunnprinsipper 2.4)
--   — Phase E sprint-3.

-- ── 1. Vault extension ──────────────────────────────────────────────────
-- Supabase Cloud ships the vault extension by default. Self-hosted may
-- need supabase/postgres ≥ 15.1.0.79.

create extension if not exists supabase_vault;

-- ── 2. Reference column on org_integrations ─────────────────────────────

alter table public.org_integrations
  add column if not exists vault_secret_name text;

comment on column public.org_integrations.vault_secret_name is
  'Name of the vault.secrets row holding the virksomhetssertifikat PEM PKCS#8 private key for this integration. NULL means the edge function falls back to MASKINPORTEN_*_PRIVATE_KEY env var.';

-- ── 3. Service-role secret reader ───────────────────────────────────────
-- Edge functions call this RPC; auth/role check ensures only service-role
-- can decrypt. Stub for self-hosted clusters where vault is not present:
-- returns null and the caller falls back to env var.

create or replace function public.workflow_read_vault_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_value text;
begin
  if current_user not in ('service_role','supabase_admin','postgres') then
    raise exception 'workflow_read_vault_secret: caller must be service_role';
  end if;
  begin
    select decrypted_secret into v_value
      from vault.decrypted_secrets
     where name = p_name
     limit 1;
  exception when undefined_table then
    -- Vault not installed; caller falls back to env var.
    return null;
  end;
  return v_value;
end;
$$;

revoke all on function public.workflow_read_vault_secret(text) from public;
grant execute on function public.workflow_read_vault_secret(text) to service_role;

-- ── 4. Upsert helper for setup wizards ──────────────────────────────────
-- Platform/org admins call this from the integration setup wizards to
-- store a private-key PEM. The function writes to vault.secrets and the
-- org_integrations row in one transaction.

create or replace function public.workflow_set_vault_secret(
  p_organization_id uuid,
  p_kind            text,
  p_secret_value    text,
  p_secret_name     text default null
)
returns text
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_name text;
  v_id   uuid;
begin
  if not (public.is_org_admin() or public.platform_is_admin()) then
    raise exception 'workflow_set_vault_secret: org_admin or platform_admin required';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id
     and not public.platform_is_admin() then
    raise exception 'cross-org write denied';
  end if;

  v_name := coalesce(p_secret_name, format('workflow.gov.%s.%s', p_organization_id, p_kind));

  begin
    -- Upsert via vault.create_secret + vault.update_secret pattern.
    insert into vault.secrets (name, secret)
    values (v_name, p_secret_value)
    on conflict (name) do update set secret = excluded.secret
    returning id into v_id;
  exception when undefined_table then
    raise exception 'Vault not installed on this cluster — install supabase_vault or use env var fallback';
  end;

  update public.org_integrations
     set vault_secret_name = v_name,
         updated_at = now()
   where organization_id = p_organization_id and kind = p_kind;

  return v_name;
end;
$$;

revoke all on function public.workflow_set_vault_secret(uuid, text, text, text) from public;
grant execute on function public.workflow_set_vault_secret(uuid, text, text, text) to authenticated;

comment on function public.workflow_set_vault_secret(uuid, text, text, text) is
  'Setup-wizard helper. Stores a private-key PEM into Vault keyed as workflow.gov.<org>.<kind> and points org_integrations.vault_secret_name at it. Caller must be org_admin (own org) or platform_admin.';
