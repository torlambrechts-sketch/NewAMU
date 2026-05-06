-- Add nav_pinned flag to compliance_checklist_templates.
--
-- A template with nav_pinned=true is rendered as its own first-class entry
-- in the "Sjekklister" sidebar group. Customers (or platform admins) toggle
-- this from the admin Maler tab to surface their key checklists.
--
-- Default false. Seeded baseline templates are flipped to true below so a
-- fresh org boots with two pinned entries (Vernerunde + ISO internrevisjon).

alter table public.compliance_checklist_templates
  add column if not exists nav_pinned boolean not null default false;

create index if not exists compliance_checklist_templates_org_pack_pinned_idx
  on public.compliance_checklist_templates (organization_id, pack, nav_pinned)
  where nav_pinned = true and is_active = true and deleted_at is null;

-- Pin the two seeded baseline templates (per active org) so the sidebar is
-- non-empty out of the box. Idempotent — repeated runs are a no-op.
update public.compliance_checklist_templates
set nav_pinned = true
where slug in ('vernerunde-standard', 'iso-45001-internal-audit')
  and nav_pinned = false;
