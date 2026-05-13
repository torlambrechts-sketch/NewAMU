-- Add the compliance metadata that turns workflow_rules into an artefact
-- the gap-and-audit planner (ROADMAP §5) can read.
--
-- Every other template surface (compliance_checklist_templates,
-- survey_template_catalog, document_system_templates, register_types,
-- learning_courses, meeting_system_templates) already carries law_refs[];
-- workflow_rules was the gap. Add law_refs, frameworks, confidentiality,
-- i18n names/descriptions, and an idempotency_template so gov-action runs
-- can dedupe against the regulator.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 5-1, § 3-1 (krav til dokumentasjon
--   av lovgrunnlag for HMS-tiltak). Uten law_refs på en regel kan tilsynet
--   ikke se hvilken §§ tiltaket implementerer.
--   Restrisiko deferred: planneren leser kun law_refs som tekst — semantisk
--   mapping mellom §§ og pålegg-grunn ligger fortsatt i mennesker.

alter table public.workflow_rules
  add column if not exists law_refs            text[] not null default '{}',
  add column if not exists frameworks          text[] not null default '{}',
  add column if not exists confidentiality_level text not null default 'standard'
    check (confidentiality_level in ('standard','restricted','confidential')),
  add column if not exists name_i18n           jsonb,
  add column if not exists description_i18n    jsonb,
  add column if not exists idempotency_template text,
  add column if not exists catalog_slug        text,
  add column if not exists catalog_version     int  not null default 0,
  add column if not exists last_reviewed_at    timestamptz,
  add column if not exists last_reviewed_by    uuid references public.profiles (id),
  add column if not exists next_review_due     date;

comment on column public.workflow_rules.law_refs is
  'Exact legal citations the rule implements. CLAUDE.md format: ''AML § 5-2'', ''GDPR Art. 33'', ''IK-f § 5 nr. 7''. Gap-and-audit planner does exact-string matching.';
comment on column public.workflow_rules.frameworks is
  'Higher-level framework tags: aml-amu, iso-45001, gdpr, hovedavtalen, likestillingsloven.';
comment on column public.workflow_rules.confidentiality_level is
  'Mirrors meetings.confidentiality_level. Restricted/confidential runs hide payload from users without workflows.view_confidential.';
comment on column public.workflow_rules.name_i18n is
  '{ "nb": "Navn på norsk", "en": "English fallback" }. Norwegian primary per house style; English for screen readers and international staff.';
comment on column public.workflow_rules.idempotency_template is
  'Template string (uses {{org_id}}, {{rule_id}}, {{run_id}}, {{event_name}}) hashed to dedupe gov submissions on queue retry.';
comment on column public.workflow_rules.catalog_slug is
  'Foreign-key-ish reference to workflow_rule_catalog.slug when the rule was installed from the system library. NULL for hand-authored rules.';
comment on column public.workflow_rules.catalog_version is
  'Version of the catalog template the rule was installed from. Lets the UI surface "an update is available" without auto-overwriting org edits.';

-- Backfill law_refs for the four templates seeded by
-- workflow_seed_compliance_templates (the AML/IK-f starter pack). The new
-- catalog (_120200) will supersede these, but until it does they should
-- still show up in the gap planner.
update public.workflow_rules
   set law_refs = '{AML § 5-2}'
 where slug = 'aml_52_critical_incident'
   and (law_refs is null or law_refs = '{}');

update public.workflow_rules
   set law_refs = '{AML § 4-6}'
 where slug = 'sick_leave_followup'
   and (law_refs is null or law_refs = '{}');

update public.workflow_rules
   set law_refs = '{AML § 2A-7}'
 where slug = 'whistle_received'
   and (law_refs is null or law_refs = '{}');

update public.workflow_rules
   set law_refs = '{AML § 7-2}'
 where slug = 'amu_minutes_published'
   and (law_refs is null or law_refs = '{}');

-- Index for the gap planner (exact array containment query).
create index if not exists workflow_rules_law_refs_gin_idx
  on public.workflow_rules using gin (law_refs);

create index if not exists workflow_rules_frameworks_gin_idx
  on public.workflow_rules using gin (frameworks);

-- Confidentiality filter for the run-history panel.
create index if not exists workflow_rules_conf_idx
  on public.workflow_rules (organization_id, confidentiality_level);
