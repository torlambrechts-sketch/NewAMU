-- Tag platform-shipped templates as system so we can:
--   1. Ship more baseline templates over time via seed migrations,
--   2. Let admins enable/disable a system template (via is_active),
--   3. Distinguish system rows from customer-authored rows in the admin UI.
--
-- "System" is a provenance flag, not a permission flag. Customers can still
-- toggle is_active on a system template (disable it for their org) — they
-- just cannot hard-delete it. Custom templates have is_system=false and
-- can be soft-deleted via deleted_at.

alter table public.compliance_checklist_templates
  add column if not exists is_system boolean not null default false;

create index if not exists compliance_checklist_templates_org_system_idx
  on public.compliance_checklist_templates (organization_id, is_system, is_active)
  where deleted_at is null;

-- Mark the two baseline templates as system across every org (idempotent).
update public.compliance_checklist_templates
set is_system = true
where slug in ('vernerunde-standard', 'iso-45001-internal-audit')
  and is_system = false;

-- Block hard-deletes of system rows. Soft-delete via deleted_at is allowed.
create or replace function public.compliance_checklist_templates_block_system_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'Systemmal % kan ikke slettes; bruk is_active=false for å deaktivere.', old.slug
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists compliance_checklist_templates_block_system_delete_tg
  on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_block_system_delete_tg
  before delete on public.compliance_checklist_templates
  for each row execute function public.compliance_checklist_templates_block_system_delete();
