-- B-1 fix: workflow_set_vault_secret must UPSERT, not UPDATE-only.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 — automatiserte tiltak må
--   bevise at kontrollen er på plass. Originalfunksjonen i _121600
--   skrev nøkkelen til Vault og kjørte deretter en UPDATE mot
--   org_integrations som silent no-op'er hvis raden ikke fantes ennå.
--   Setup-veiviseren (AltinnSetup steg 2) kalte denne FØR upsert av
--   raden, så vault_secret_name forble NULL og prod-innsending feilet
--   med "No Maskinporten private key" lenge etter at wizarden rapporterte
--   grønn status. Vi gjør funksjonen idempotent UPSERT og verifiserer
--   skrivingen post-write.
--   Restrisiko deferred: per-org HSM-backed signing (NSM 2.4) — Phase E.

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
  if not (public.is_org_admin() or public.platform_is_admin()) then
    raise exception 'workflow_set_vault_secret: org_admin or platform_admin required';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id
     and not public.platform_is_admin() then
    raise exception 'cross-org write denied';
  end if;

  v_name := coalesce(p_secret_name, format('workflow.gov.%s.%s', p_organization_id, p_kind));

  begin
    -- Upsert into Vault. Name is unique so the do-update branch covers
    -- key-rotation: same name, new secret value, same id.
    insert into vault.secrets (name, secret)
    values (v_name, p_secret_value)
    on conflict (name) do update set secret = excluded.secret
    returning id into v_id;
  exception when undefined_table then
    raise exception 'Vault not installed on this cluster — install supabase_vault or use env var fallback';
  end;

  -- Idempotent UPSERT: if the wizard called us BEFORE persisting the
  -- org_integrations row, this creates a placeholder so vault_secret_name
  -- is never lost. The wizard's later upsert just overwrites display
  -- fields without clobbering vault_secret_name.
  insert into public.org_integrations (
    organization_id, kind, vault_secret_name, enabled, environment, requires_external_activation
  ) values (
    p_organization_id, p_kind, v_name, false, 'tt02', true
  )
  on conflict (organization_id, kind) do update set
    vault_secret_name = excluded.vault_secret_name,
    updated_at = now();

  -- Verify the write landed on a row, fail loudly if not — keeps the
  -- wizard from reporting green when the link is broken.
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
  'Setup-wizard helper (B-1 fix). UPSERTs into Vault and into org_integrations atomically so the wizard cannot race the row-upsert; verifies vault_secret_name is non-null post-write. Caller must be org_admin (own org) or platform_admin.';
