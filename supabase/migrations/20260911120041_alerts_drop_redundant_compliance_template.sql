-- Phase F4 follow-up — soft-delete the redundant compliance checklist
-- 'varsling-handtering-logg' (Varslingssak – håndteringslogg).
--
-- Its purpose (per-case handling log) is now fully covered by:
--   * alert_cases (the case row itself)
--   * alert_case_timeline_events (immutable timeline)
--   * alert_case_notes (append-only journal)
--   * alert_system_templates.definition.committeeChecklistItems
--     (per-template checklist with mandatory flags + lawRefs)
--
-- The checklist row remains in the table as soft-deleted (deleted_at set)
-- so any historical execution rows in compliance_checklist_executions
-- referencing it keep their FK valid. The admin Maler list filters
-- deleted_at is null, so it disappears from the UI.
--
-- Idempotent.

set local search_path = public, pg_catalog;

update public.compliance_checklist_templates
   set deleted_at = coalesce(deleted_at, now())
 where slug = 'varsling-handtering-logg'
   and deleted_at is null;
