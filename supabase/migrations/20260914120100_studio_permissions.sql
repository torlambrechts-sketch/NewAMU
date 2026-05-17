-- Studio Builder — register the 5 studio.* permission keys.
--
-- Permission ladder (per specs/studio-builder.md §3 + §11):
--   studio.simple             → Pro tier and above; edit own-org content via Simple mode
--   studio.advanced           → platform admins only in Phase 0–2; opens to Enterprise/Partner in Phase 3
--   studio.packs              → Enterprise/Partner; author org-specific compliance packs
--   studio.partner_admin      → Partner tier; delegated admin across N client orgs
--   studio.marketplace_publish → Marketplace contributor; publish packs to the catalog (Phase 4)
--
-- In Phase 0 we grant only studio.simple (to org admin + manager roles)
-- and leave the other 4 reserved. Platform admins bypass studio.advanced
-- via the existing `isAdmin || can(...)` pattern in useOrgSetupContext,
-- so studio.advanced is not granted via role_permissions in this phase.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 (fordeling av ansvar). Studio
--   authoring touches compliance content directly — a single permission
--   key would over-grant. Five-key ladder lets RLS distinguish read
--   (studio.simple) from edit (studio.advanced) from pack authoring
--   (studio.packs) from multi-tenant partner admin
--   (studio.partner_admin) from marketplace publishing
--   (studio.marketplace_publish). Personvernforordningen art. 5(1)(c)
--   minimerings-prinsippet — only as much access as the role needs.
--   Restrisiko deferred:
--     - studio.packs and studio.partner_admin are reserved but not yet
--       granted; tier-rollout flow (Phase 3) adds the role mappings.
--     - studio.marketplace_publish — Phase 4 (deferred per §3 anti-features).
--
-- Idempotent — `on conflict (role_id, permission_key) do nothing`.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. Grant studio.simple to existing admin + manager roles
-- ────────────────────────────────────────────────────────────────────
-- Broader than workflows.* on purpose: any user who can administer
-- compliance content in their org should at least *see* /studio. Edit
-- gating happens inside the studio at the kind-registry mutator level.

insert into public.role_permissions (role_id, permission_key)
select rd.id, k
  from public.role_definitions rd
  cross join (values
    ('studio.simple')
  ) as v(k)
 where rd.slug in ('admin', 'manager')
on conflict (role_id, permission_key) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- 2. Extend seed_default_roles_for_org so new orgs inherit the grant
-- ────────────────────────────────────────────────────────────────────
-- Pattern mirrors _20260905120900_workflow_permissions.sql §2: re-define
-- the org-bootstrap function so new orgs get the new keys automatically.
-- We use create or replace + a dynamic append so we don't have to know
-- the function's current body; the new permissions are added via the
-- same `on conflict` insert at the end.

create or replace function public.studio_seed_default_studio_permissions(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_permissions (role_id, permission_key)
  select rd.id, k
    from public.role_definitions rd
    cross join (values
      ('studio.simple')
    ) as v(k)
   where rd.slug in ('admin', 'manager')
     and (rd.organization_id = p_org_id or rd.organization_id is null)
  on conflict (role_id, permission_key) do nothing;
end;
$$;

grant execute on function public.studio_seed_default_studio_permissions(uuid) to authenticated;

comment on function public.studio_seed_default_studio_permissions(uuid) is
  'Studio Builder — grant studio.simple to admin+manager roles for a given org. Called by org-bootstrap flow. Other studio.* keys remain reserved until tier rollout.';
