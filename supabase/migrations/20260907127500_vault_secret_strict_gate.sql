-- workflow_set_vault_secret — restore the strict permission contract.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: closes a regression in _126800 that called the
--   non-strict `user_has_permission()` helper, which short-circuits on
--   `is_org_admin` (see archive/20260402120000_rbac_invites.sql:132). _120200
--   introduced `user_has_permission_strict` precisely for this case. After
--   this migration, org-admins without an explicit `integrations.cert_rotate`
--   grant can no longer overwrite Maskinporten Vault secrets — the only way
--   in is platform_admin or the explicit permission. Spec note: an earlier
--   synthesis-report mentioned "7 missing system rules" for P1-#24; the
--   correct count shipped in _122100 is 5 (ARP §26 yearly, AMU §7-2
--   årsrapport, politi-parallel §5-2, GDPR Art. 30 ROPA, GDPR Art. 35
--   DPIA-on-publish) — no further rules needed, the "7" was a typo.
--   Restrisiko deferred: cross-signing of two KIDs during rotation window
--   (Digdir-side coordination) — sprint-4.

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
  -- Strict gate: platform admins OR explicit integrations.cert_rotate
  -- holders only. `user_has_permission_strict` skips the is_org_admin
  -- shortcut, matching the gate on workflow_record_cert_rotation so a
  -- Vault write cannot leave org_integrations.signing_kid desynced.
  if not (
    public.platform_is_admin()
    or public.user_has_permission_strict('integrations.cert_rotate', auth.uid())
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
  'Setup-wizard helper. UPSERTs into Vault and into org_integrations atomically. Permission re-tightened 2026-09-07 _127500: requires platform_admin OR user_has_permission_strict(integrations.cert_rotate) — the strict variant skips the is_org_admin shortcut, restoring the contract _120200 established. _126800 accidentally used the non-strict helper.';

do $$
declare
  v_helper_exists boolean;
  v_uses_strict   boolean;
begin
  select exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'user_has_permission_strict'
  ) into v_helper_exists;
  if not v_helper_exists then
    raise exception 'user_has_permission_strict not in scope — _120200 must run before _127500';
  end if;

  select pg_get_functiondef(p.oid) like '%user_has_permission_strict%'
    into v_uses_strict
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'workflow_set_vault_secret'
   limit 1;
  if not coalesce(v_uses_strict, false) then
    raise exception 'workflow_set_vault_secret body does NOT reference user_has_permission_strict — fix-up failed';
  end if;

  raise notice 'workflow_set_vault_secret now gated by user_has_permission_strict(integrations.cert_rotate). Org-admin shortcut removed.';
end
$$;
