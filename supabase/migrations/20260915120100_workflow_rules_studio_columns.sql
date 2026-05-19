-- Add Studio-authoring columns and a workflows.compose write policy to
-- workflow_rules so template authors (workflows.compose) can save their own
-- org templates without needing full workflows.manage access.
--
-- Gaps closed:
--   1. deleted_at — soft-delete for org templates (Studio list page filters
--      is('deleted_at', null); hard-delete still works via workflows.manage).
--   2. pack / cadence_hint — mirror the same metadata fields present on
--      survey_template_catalog and compliance_checklist_templates so the
--      gap-and-audit planner (ROADMAP §5) can group rules by compliance pack
--      and cadence recommendation.
--   3. RLS policy for workflows.compose — the existing write policy only
--      allows workflows.manage. Studio authors with only workflows.compose
--      cannot save templates, which makes the Studio editor non-functional
--      for non-admin users. New policy scopes to is_template=true rows only
--      so composers can't touch live operational rules.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 (organisering av systematisk HMS-
--   arbeid). Manglende skrivetilgang for rules-forfattere er et praktisk
--   hindrer for systematisk dokumentasjon. Ingen pålegg-risiko for de nye
--   kolonnene i seg selv.
--   Restrisiko deferred: pack/cadence_hint er frie tekstfelt uten enum-
--   validering — semantisk konsistens avhenger av UI-dropdowns.

alter table public.workflow_rules
  add column if not exists deleted_at   timestamptz,
  add column if not exists pack         text,
  add column if not exists cadence_hint text;

comment on column public.workflow_rules.deleted_at is
  'Soft-delete marker. Studio list page filters where deleted_at is null. workflows.manage can hard-delete; composers soft-delete via Studio.';
comment on column public.workflow_rules.pack is
  'Compliance pack grouping: aml-amu | iso-45001 | gdpr. Mirrors workflow_rule_catalog.pack. NULL = unpacked.';
comment on column public.workflow_rules.cadence_hint is
  'Suggested review cadence: arlig | halvarlig | kvartalsvis | ad_hoc. Free text — UI enforces the enum.';

-- Index for Studio list page (.is('deleted_at', null) filter on org templates)
create index if not exists workflow_rules_active_templates_idx
  on public.workflow_rules (organization_id, is_template, deleted_at)
  where is_template = true;

-- Allow workflows.compose to INSERT/UPDATE/DELETE their own org templates.
-- Scoped to is_template=true so composers cannot touch live operational rules.
-- The existing workflow_rules_write_manage policy covers non-template rules
-- for workflows.manage / org admins.
drop policy if exists "workflow_rules_write_compose_templates" on public.workflow_rules;
create policy "workflow_rules_write_compose_templates"
  on public.workflow_rules for all
  using (
    organization_id = public.current_org_id()
    and is_template = true
    and public.user_has_permission('workflows.compose')
  )
  with check (
    organization_id = public.current_org_id()
    and is_template = true
    and public.user_has_permission('workflows.compose')
  );
