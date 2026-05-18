-- Studio Builder — set_studio_partner_context RPC.
--
-- The Phase 3.2 PartnerOrgSwitcher persists the active customer org
-- to localStorage on the client. RLS policies on studio-aware tables
-- (Task 3.3) read `app.active_partner_id` GUC OR fall back to
-- partner_resolve_active_partner(). The GUC is per-transaction only,
-- so this RPC is a thin setter the client calls right after a switch
-- so any immediate RPC inside the same connection sees the value.
--
-- Naming: `set_studio_partner_context` mirrors the existing
-- partner_resolve_active_partner helper.
--
-- Security: SECURITY DEFINER + validates the caller actually has a
-- membership in the requested partner (so a hostile client can't lie
-- and elevate to a partner they're not a member of).
--
-- Conditional on partner_memberships existing. Idempotent.

set local search_path = public, pg_catalog;

do $do$
begin
  if not exists (
    select 1 from information_schema.tables
      where table_schema='public' and table_name='partner_memberships'
  ) then
    raise notice '[studio_partner_session_context] partner_memberships missing — skipping.';
    return;
  end if;

  execute $sql$
    create or replace function public.set_studio_partner_context(p_partner_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      v_ok boolean;
    begin
      -- Verify the caller has at least one ACTIVE membership in the
      -- requested partner. Without this, anyone could set the GUC and
      -- bypass RLS.
      select exists (
        select 1 from public.partner_memberships
          where user_id = auth.uid()
            and partner_id = p_partner_id
            and active = true
      ) into v_ok;
      if not v_ok then
        raise exception 'No active partner_membership in partner % for user %.', p_partner_id, auth.uid()
          using errcode = 'P0001';
      end if;

      perform set_config('app.active_partner_id', p_partner_id::text, false);
    end;
    $fn$;
  $sql$;

  execute 'grant execute on function public.set_studio_partner_context(uuid) to authenticated';
end
$do$;
