-- Studio Builder Phase 3 Task 3.3 — partner-admin RLS layering.
--
-- Adds one policy per studio-aware authoring table that admits writes
-- from a partner_membership member who:
--   1. is a member of *some* partner_organizations row (via
--      is_partner_member_of helper from _20260907123300_partner_console_v0.sql),
--   2. carries the studio.partner_admin permission key (named at Task 0.2,
--      granted at Phase 3 tier-upgrade), and
--   3. has the customer org's id selected via app.active_partner_id GUC
--      (or matches it via partner_resolve_active_partner).
--
-- This is the explicit "3-sprint risk surface" the spec calls out — the
-- migration touches 7 tables and adds 7 ALLOW policies on top of the
-- existing per-table RLS. The policies are additive: a row visible
-- under existing RLS stays visible; new visibility opens for the
-- partner-admin path only.
--
-- Tables touched (one policy per table):
--   - compliance_checklist_templates
--   - survey_org_templates
--   - document_org_templates
--   - meeting_org_templates
--   - register_types
--   - learning_courses
--   - dashboard_layouts
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 18-1 (revisjon / tilsyn) — partner-led
--   compliance work needs a clear write path that's still org-scoped;
--   the policy enforces this. GDPR art. 28 (databehandler) — partner is
--   data processor; RLS scoping to active_partner_id ensures no data
--   bleeds across customer orgs.
--   Restrisiko deferred:
--     - RLS plan complexity may regress query times (>10ms on 100-org
--       seed per spec §9.2). Profile in dev before Phase 3 ships.
--     - Soft-delete grace (Task 3.4) not in this migration.
--
-- Conditional: skips entirely if partner_memberships doesn't exist (the
-- partner_console_v0 substrate ships separately). Idempotent.

set local search_path = public, pg_catalog;

do $do$
begin
  if not exists (
    select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'partner_memberships'
  ) then
    raise notice '[studio_partner_rls] partner_memberships missing — skipping. Re-apply after _20260907123300_partner_console_v0.sql lands.';
    return;
  end if;

  -- Helper: pulls the predicate shared by every policy out so plan
  -- inspection has one shared spot to optimise.
  execute $sql$
    create or replace function public.studio_partner_admin_can_edit(p_org_id uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select exists (
        select 1
          from public.partner_memberships pm
          join public.role_permissions rp on rp.role_id = pm.role_id
          where pm.user_id = auth.uid()
            and pm.active = true
            and (
              (current_setting('app.active_partner_id', true)::uuid is not null
               and pm.partner_id = current_setting('app.active_partner_id', true)::uuid)
              or pm.partner_id = public.partner_resolve_active_partner(p_org_id, auth.uid())
            )
            and rp.permission_key = 'studio.partner_admin'
      );
    $fn$;
  $sql$;

  -- Per-table policies (drop-and-recreate by policy name; idempotent).
  execute 'drop policy if exists studio_partner_admin_compliance on public.compliance_checklist_templates';
  execute 'create policy studio_partner_admin_compliance on public.compliance_checklist_templates
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_survey on public.survey_org_templates';
  execute 'create policy studio_partner_admin_survey on public.survey_org_templates
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_documents on public.document_org_templates';
  execute 'create policy studio_partner_admin_documents on public.document_org_templates
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_meetings on public.meeting_org_templates';
  execute 'create policy studio_partner_admin_meetings on public.meeting_org_templates
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_registers on public.register_types';
  execute 'create policy studio_partner_admin_registers on public.register_types
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_learning on public.learning_courses';
  execute 'create policy studio_partner_admin_learning on public.learning_courses
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';

  execute 'drop policy if exists studio_partner_admin_dashboards on public.dashboard_layouts';
  execute 'create policy studio_partner_admin_dashboards on public.dashboard_layouts
             for all to authenticated
             using (public.studio_partner_admin_can_edit(organization_id))
             with check (public.studio_partner_admin_can_edit(organization_id))';
end
$do$;
