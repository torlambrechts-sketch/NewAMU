-- workflow_set_vault_secret — require integrations.cert_rotate (P1).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: NSM Grunnprinsipper 2.4 + IK-f § 5 nr. 7.
--   The prior gate (`is_org_admin OR platform_is_admin`) was looser than
--   the gate on workflow_record_cert_rotation (which requires
--   integrations.cert_rotate). An attacker with org_admin but without
--   cert_rotate could push a new PEM to Vault, then the rotation RPC
--   would reject — leaving Vault desynced from org_integrations.signing_kid
--   and breaking all Maskinporten signing for the regulator. Tighten the
--   Vault gate to match: platform_admin OR integrations.cert_rotate.
--   Restrisiko deferred: cross-signing of two KIDs during rotation
--   window (Digdir-side coordination) — sprint-4.

set local search_path = public, pg_catalog;

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
  v_name  text;
  v_id    uuid;
  v_check text;
begin
  -- Strictly tighter than the previous is_org_admin shortcut: only
  -- platform admins OR explicit integrations.cert_rotate holders can
  -- write into Vault. The CertRotationPage UI already gates the wizard
  -- on the same permission, so legitimate flow is unaffected.
  if not (
    public.platform_is_admin()
    or public.user_has_permission('integrations.cert_rotate', auth.uid())
  ) then
    raise exception 'integrations.cert_rotate permission required'
      using errcode = '42501';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id
     and not public.platform_is_admin() then
    raise exception 'cross-org write denied';
  end if;

  v_name := coalesce(p_secret_name, format('workflow.gov.%s.%s', p_organization_id, p_kind));

  begin
    insert into vault.secrets (name, secret)
    values (v_name, p_secret_value)
    on conflict (name) do update set secret = excluded.secret
    returning id into v_id;
  exception when undefined_table then
    raise exception 'Vault not installed on this cluster — install supabase_vault or use env var fallback';
  end;

  insert into public.org_integrations (
    organization_id, kind, vault_secret_name, enabled, environment, requires_external_activation
  ) values (
    p_organization_id, p_kind, v_name, false, 'tt02', true
  )
  on conflict (organization_id, kind) do update set
    vault_secret_name = excluded.vault_secret_name,
    updated_at = now();

  select vault_secret_name into v_check
    from public.org_integrations
   where organization_id = p_organization_id
     and kind = p_kind;
  if v_check is null then
    raise exception 'workflow_set_vault_secret: org_integrations row not updated'
      using errcode = 'internal_error';
  end if;

  return v_name;
end;
$$;

revoke all on function public.workflow_set_vault_secret(uuid, text, text, text) from public;
grant execute on function public.workflow_set_vault_secret(uuid, text, text, text) to authenticated;

comment on function public.workflow_set_vault_secret(uuid, text, text, text) is
  'Setup-wizard helper. UPSERTs into Vault and into org_integrations atomically. Permission tightened 2026-09-07 _126800: now requires platform_admin OR integrations.cert_rotate — matches the gate on workflow_record_cert_rotation so Vault writes cannot leave org_integrations.signing_kid desynced.';

do $$
begin
  raise notice 'workflow_set_vault_secret re-issued with integrations.cert_rotate gate.';
end
$$;
