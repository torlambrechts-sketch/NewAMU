-- compliance_plan_items.project_id — link to task_projects.
--
-- Phase 2 of the Tasks-module alignment for internkontroll. The
-- module's Prosjekter section previously grouped plan-items by the
-- free-text `milestone` column, which meant a project created in
-- Oppgavestyring (with PDCA / Kanban methodology, dates, leads,
-- law_refs[]) had no way to surface on the internkontroll page.
--
-- Adding a nullable FK to `task_projects` lets us:
--   1. Render Prosjekter directly from `task_projects` instead of
--      reinventing the concept as derived data.
--   2. Carry the project link onto the bridge `task_items` row so
--      the same tiltak appears on the TaskProjectBoard.
--   3. Keep `milestone` as a text fallback so existing data + ad-hoc
--      grouping still works during the transition.
--
-- ON DELETE SET NULL: if a project is removed we don't want to cascade-
-- delete the underlying plan-items — they outlive the initiative.
--
-- Self-revisjon (Arbeidstilsynet POV):
--   - AML § 3-1 (2) c krever ansvarsfordeling. Projects are the
--     coarsest accountability container; linking plan-items to a
--     project + the lead_user_id on task_projects makes the chain
--     visible to tilsyn without parsing strings.
--   - IK-f § 5 nr. 6 krever oversikt over tiltak. A project_id
--     gives the auditor a single anchor for related closure work
--     across paragraphs.

set local search_path = public, pg_catalog;

alter table public.compliance_plan_items
  add column if not exists project_id uuid;

-- Add FK separately to keep `add column if not exists` idempotent.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'compliance_plan_items'
      and constraint_name = 'compliance_plan_items_project_id_fkey'
  ) then
    alter table public.compliance_plan_items
      add constraint compliance_plan_items_project_id_fkey
      foreign key (project_id) references public.task_projects (id)
      on delete set null;
  end if;
end $$;

create index if not exists compliance_plan_items_project_id_idx
  on public.compliance_plan_items (organization_id, project_id)
  where deleted_at is null and project_id is not null;

comment on column public.compliance_plan_items.project_id is
  'Optional link to public.task_projects(id). Drives the Prosjekter '
  'section on /overview/internkontroll and lets the bridge task_items '
  'row inherit project_id so the same tiltak appears on the project board.';
