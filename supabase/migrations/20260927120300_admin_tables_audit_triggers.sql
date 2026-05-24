-- Compliance gap closure: 12 admin-relevant tables that the Klarert
-- Admin shell writes to had no hse_audit_log trigger. That meant
-- creating a user role, toggling an integration, adding a location,
-- or inviting a user produced NO audit record — admins viewing
-- Admin → Audit-logg saw nothing for those actions.
--
-- AML § 5-1 (dokumentasjon av HMS-arbeid) + IK-forskriften § 5 nr. 8
-- (sporbarhet) require these to be auditable. This migration attaches
-- the existing hse_audit_trigger() — the same trigger function that
-- already covers inspection_rounds / inspection_findings /
-- deviations / compliance_packs / internal_packs etc. — to the
-- remaining admin-touched tables.
--
-- Performance impact: each INSERT/UPDATE/DELETE writes one row to
-- hse_audit_log with a JSONB snapshot. For admin tables this is
-- low-volume traffic; even user_roles (the highest-rate of these)
-- is bounded by org size. Existing indexes on
-- hse_audit_log(organization_id, table_name, changed_at) keep reads
-- fast for the Audit-logg-seksjonen.

drop trigger if exists organizations_audit_tg on public.organizations;
create trigger organizations_audit_tg
  after insert or update or delete on public.organizations
  for each row execute function public.hse_audit_trigger();

drop trigger if exists locations_audit_tg on public.locations;
create trigger locations_audit_tg
  after insert or update or delete on public.locations
  for each row execute function public.hse_audit_trigger();

drop trigger if exists departments_audit_tg on public.departments;
create trigger departments_audit_tg
  after insert or update or delete on public.departments
  for each row execute function public.hse_audit_trigger();

drop trigger if exists role_definitions_audit_tg on public.role_definitions;
create trigger role_definitions_audit_tg
  after insert or update or delete on public.role_definitions
  for each row execute function public.hse_audit_trigger();

drop trigger if exists role_permissions_audit_tg on public.role_permissions;
create trigger role_permissions_audit_tg
  after insert or update or delete on public.role_permissions
  for each row execute function public.hse_audit_trigger();

drop trigger if exists user_roles_audit_tg on public.user_roles;
create trigger user_roles_audit_tg
  after insert or update or delete on public.user_roles
  for each row execute function public.hse_audit_trigger();

drop trigger if exists invitations_audit_tg on public.invitations;
create trigger invitations_audit_tg
  after insert or update or delete on public.invitations
  for each row execute function public.hse_audit_trigger();

drop trigger if exists org_integrations_audit_tg on public.org_integrations;
create trigger org_integrations_audit_tg
  after insert or update or delete on public.org_integrations
  for each row execute function public.hse_audit_trigger();

drop trigger if exists workflow_rules_audit_tg on public.workflow_rules;
create trigger workflow_rules_audit_tg
  after insert or update or delete on public.workflow_rules
  for each row execute function public.hse_audit_trigger();

drop trigger if exists document_org_template_settings_audit_tg on public.document_org_template_settings;
create trigger document_org_template_settings_audit_tg
  after insert or update or delete on public.document_org_template_settings
  for each row execute function public.hse_audit_trigger();

drop trigger if exists meeting_org_template_settings_audit_tg on public.meeting_org_template_settings;
create trigger meeting_org_template_settings_audit_tg
  after insert or update or delete on public.meeting_org_template_settings
  for each row execute function public.hse_audit_trigger();

drop trigger if exists register_org_settings_audit_tg on public.register_org_settings;
create trigger register_org_settings_audit_tg
  after insert or update or delete on public.register_org_settings
  for each row execute function public.hse_audit_trigger();
