-- Partner Console — RLS hardening (firm creation + onboarding + time-entry guard).
--
-- _123300_partner_console_v0 ships three RLS gaps:
--   (C-10) partner_organizations_admin_insert with check=true lets ANY
--   authenticated user create a partner firm — multi-tenant attack
--   surface (squat the namespace, lure others into joining).
--   (C-11) partner_memberships_admin_write has a bootstrap exception
--   that lets the first row INTO a brand-new partner_id be inserted
--   by ANYONE. Combined with C-10, anyone can self-elevate to admin
--   on a fresh-created firm.
--   (extra) partner_time_entries_insert allowed cross-partner /
--   cross-org inserts as long as the caller is a member of the
--   stated partner — they could insert against an organization_id
--   they don't have a membership row for.
--
-- Fix:
--   1. partner_organizations insert restricted to platform_is_admin().
--   2. partner_memberships bootstrap exception dropped; first admin must
--      be created via a new SECURITY DEFINER RPC partner_onboard_firm()
--      that platform_is_admin() can call.
--   3. partner_time_entries_insert WITH CHECK adds membership row
--      coverage for (partner_id, organization_id, user_id).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: IK-f § 5 nr. 4 (forsvarlig rollefordeling),
--   AML § 14-1 jf. § 14-2 (ulovlig innleie kan ikke skjules ved at konsulent
--   tikker timer mot egen org), personopplysningsloven § 12 (multi-
--   tenant integritet — varslere/sykefraværsoppfølging må ikke kunne
--   leaks-es via en falskt opprettet partner-firm).
--   Restrisiko deferred: platform_admin er ennå en manuell rolle (rad
--   i platform_admins). Selvbetjent onboarding av nye partner-firm krever
--   en signup-wizard som er P3. v0 forventer at vi onboarder partnere
--   manuelt via service_role + platform_admin_assign-pattern.

set local search_path = public, pg_catalog;

-- ── 1. partner_organizations insert: platform admin only ────────────────
drop policy if exists partner_organizations_admin_insert on public.partner_organizations;
create policy partner_organizations_admin_insert
  on public.partner_organizations for insert
  to authenticated
  with check (public.platform_is_admin());

-- ── 2. partner_memberships write: drop bootstrap exception ──────────────
drop policy if exists partner_memberships_admin_write on public.partner_memberships;
create policy partner_memberships_admin_write
  on public.partner_memberships for all
  to authenticated
  using (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('admin', 'manager')
    )
  );

-- ── 3. partner_time_entries insert: gate on membership row ──────────────
drop policy if exists partner_time_entries_insert on public.partner_time_entries;
create policy partner_time_entries_insert
  on public.partner_time_entries for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_partner_member_of(partner_id, auth.uid())
    and exists (
      select 1
        from public.partner_memberships m
       where m.partner_id     = partner_time_entries.partner_id
         and m.organization_id = partner_time_entries.organization_id
         and m.user_id        = auth.uid()
         and m.active         = true
    )
  );

-- ── 4. Onboarding RPC for the first admin row ───────────────────────────
-- Replaces the bootstrap exception. Platform admin creates the partner
-- firm and the seed admin user atomically.
create or replace function public.partner_onboard_firm(
  p_name text,
  p_billing_email text,
  p_admin_user_id uuid,
  p_default_hourly_rate numeric default 1350.00
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.platform_is_admin() then
    raise exception 'partner_onboard_firm: caller must be platform_admin';
  end if;
  if p_admin_user_id is null then
    raise exception 'partner_onboard_firm: admin_user_id required';
  end if;
  if not exists (select 1 from public.profiles where id = p_admin_user_id) then
    raise exception 'partner_onboard_firm: admin_user_id % not found in profiles', p_admin_user_id;
  end if;

  insert into public.partner_organizations (
    name, default_hourly_rate, billing_email
  ) values (
    p_name, coalesce(p_default_hourly_rate, 1350.00), p_billing_email
  )
  returning id into v_partner_id;

  -- Seed admin membership. The admin's organization_id field on
  -- partner_memberships is the customer org that the admin will
  -- subsequently grant to consultants — we pick the admin's own home
  -- org as a sentinel (the admin can have many customer-org memberships
  -- added later; this initial row is the "I am admin of partner X"
  -- claim).
  insert into public.partner_memberships (
    partner_id, organization_id, user_id, role, active
  )
  select v_partner_id,
         coalesce(p.organization_id, p.id),  -- fallback: profile-self as org sentinel
         p_admin_user_id,
         'admin',
         true
    from public.profiles p
   where p.id = p_admin_user_id;

  return v_partner_id;
end;
$$;

revoke all on function public.partner_onboard_firm(text, text, uuid, numeric) from public;
grant execute on function public.partner_onboard_firm(text, text, uuid, numeric)
  to authenticated, service_role;

comment on function public.partner_onboard_firm(text, text, uuid, numeric) is
  'Platform-admin-only RPC to bootstrap a new partner firm + seed admin membership. Replaces the bootstrap exception previously baked into partner_memberships_admin_write.';
