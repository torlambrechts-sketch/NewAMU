-- Fix: compliance_template_requirements_audit_tg fires hse_audit_trigger(),
-- which writes `(v_new->>'id')::uuid` into hse_audit_log.record_id (NOT NULL).
-- compliance_template_requirements has a composite PK (template_id, requirement_id)
-- with no surrogate id column, so the cast returns NULL → 23502 violation.
--
-- Fix A: replace the generic audit trigger on the junction table with a
-- specialised one that uses template_id as the record anchor.
--
-- Fix B (belt-and-suspenders): make hse_audit_log.record_id nullable so that
-- any future junction table added without a surrogate id doesn't silently
-- break provisioning. Existing queries that filter by record_id are
-- unaffected — NULL rows simply don't match an equality filter.

set local search_path = public, pg_catalog;

-- ── A. Replace the audit trigger on the junction table ────────────────────

drop trigger if exists compliance_template_requirements_audit_tg
  on public.compliance_template_requirements;

-- Dedicated audit function for junction rows: uses template_id as record_id
-- so the audit log retains a navigable anchor without needing a surrogate id.
create or replace function public.compliance_template_requirements_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  insert into public.hse_audit_log
    (organization_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (
    coalesce(
      (v_new->>'organization_id')::uuid,
      (v_old->>'organization_id')::uuid
    ),
    TG_TABLE_NAME,
    -- Junction has no surrogate id; anchor on template_id.
    coalesce(
      (v_new->>'template_id')::uuid,
      (v_old->>'template_id')::uuid
    ),
    TG_OP,
    auth.uid(),
    case TG_OP when 'INSERT' then null else v_old end,
    case TG_OP when 'DELETE' then null else v_new end
  );
  return coalesce(new, old);
end $$;

create trigger compliance_template_requirements_audit_tg
  after insert or update or delete on public.compliance_template_requirements
  for each row execute function public.compliance_template_requirements_audit();

-- ── B. Make record_id nullable as a safety net ────────────────────────────

alter table public.hse_audit_log
  alter column record_id drop not null;
