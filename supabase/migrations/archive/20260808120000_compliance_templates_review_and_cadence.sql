-- Template review tracking + cadence hint.
--
-- review_status — provenance flag for legal-review state. Templates authored
--   by Claude / platform start at 'draft'. An HMS-rådgiver / compliance
--   officer marks 'reviewed' after content review, then 'approved' once the
--   template is judged acceptable for production use. Customers can use
--   'draft' templates but the admin UI surfaces the status as a badge so
--   it's unambiguous what is and isn't expert-verified.
--
-- cadence_hint — non-binding human-readable cadence suggestion shown in the
--   admin (e.g. "kvartalsvis", "årlig", "ved endring", "månedlig"). Not a
--   scheduler trigger; that lands when (if) we add a scheduling layer.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_review_status') then
    create type public.compliance_review_status as enum ('draft', 'reviewed', 'approved');
  end if;
end $$;

alter table public.compliance_checklist_templates
  add column if not exists review_status public.compliance_review_status not null default 'draft';

alter table public.compliance_checklist_templates
  add column if not exists cadence_hint text;

create index if not exists compliance_checklist_templates_review_status_idx
  on public.compliance_checklist_templates (review_status)
  where deleted_at is null;

-- Existing baseline templates were authored by the platform but have not
-- been independently reviewed. Mark explicitly so the admin badge reflects
-- reality.
update public.compliance_checklist_templates
set review_status = 'draft'
where review_status is null
  or review_status = 'draft'; -- no-op for fresh installs; explicit for clarity
