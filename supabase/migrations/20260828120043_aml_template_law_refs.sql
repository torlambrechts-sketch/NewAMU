-- AML coverage — promote `law_refs text[]` to template-level on every
-- module that ships templates. Today the law_ref signal lives in three
-- places that don't compose cleanly:
--   - compliance: per-item `law_ref` inside the `definition` JSONB
--   - survey:     single `law_ref text` on the catalog row
--   - register:   `regulation_ids text[]` (frameworks, not paragraphs)
--   - documents:  `legal_basis text[]` already at template level (no-op)
--   - learning:   `law_refs jsonb` already at course level (no-op)
--
-- The /compliance/arbeidsmiljoloven dashboard wants a flat per-template
-- view of "which AML paragraph(s) does this template touch?" so the AML
-- Modules grid can light up coverage and the AML Outstanding Tasks
-- table can filter by §. Filtering through a JSONB array of items
-- (compliance) or a single string column (survey) is awkward.
--
-- This migration adds `law_refs text[] not null default '{}'` to every
-- table that doesn't already have a paragraph-level array, plus
-- `aml_paragraphs text[] not null default '{}'` to register_types as a
-- supplement to the framework-level `regulation_ids` (a register can
-- target frameworks like "REACH" *and* paragraphs like "AML §4-5").
--
-- Format convention (matches existing strings in the codebase):
--   'AML § 4-3'         — Arbeidsmiljøloven, paragraph 4-3
--   'AML § 2A-1'        — Kapittel 2A, paragraph 1
--   'IK-f § 5 nr. 7'    — Internkontrollforskriften
--   'Likestillings- og diskrimineringsloven § 26'
--
-- Idempotent: every column add uses `if not exists`.

set local search_path = public, pg_catalog;

-- ── 1. compliance_checklist_templates ─────────────────────────────────────

alter table public.compliance_checklist_templates
  add column if not exists law_refs text[] not null default '{}'::text[];

comment on column public.compliance_checklist_templates.law_refs is
  $c$AML / forskrift paragraphs this template covers, e.g.
  array['AML § 6-2', 'AML § 4-1']. Used by the AML dashboard to
  light up Modules grid coverage. Per-item law_ref inside `definition`
  remains the source for sub-question level drill-down.$c$;

create index if not exists compliance_checklist_templates_law_refs_idx
  on public.compliance_checklist_templates using gin (law_refs);

-- ── 2. survey_template_catalog ────────────────────────────────────────────

alter table public.survey_template_catalog
  add column if not exists law_refs text[] not null default '{}'::text[];

comment on column public.survey_template_catalog.law_refs is
  $c$Multi-paragraph version of the existing `law_ref text` column.
  Where `law_ref` carries the primary anchor for legacy callers,
  `law_refs` enumerates every paragraph the template touches so the
  AML dashboard can compute coverage. Backfill below copies `law_ref`
  into `law_refs` so no surface that reads either column breaks.$c$;

create index if not exists survey_template_catalog_law_refs_idx
  on public.survey_template_catalog using gin (law_refs);

-- Backfill: lift the single law_ref string into the array so existing
-- catalog rows surface in coverage views from day one.
update public.survey_template_catalog
set law_refs = array[law_ref]
where law_ref is not null
  and law_ref <> ''
  and (law_refs is null or law_refs = '{}'::text[]);

-- ── 3. survey_org_templates ───────────────────────────────────────────────
-- Org-level override layer for surveys. Mirrors compliance pattern: the
-- override row carries its own law_refs so an admin can re-anchor a
-- catalog row when localising it.

alter table public.survey_org_templates
  add column if not exists law_refs text[] not null default '{}'::text[];

comment on column public.survey_org_templates.law_refs is
  $c$Override of the catalog row's law_refs. NULL/empty inherits from
  the catalog. Lets an admin add org-specific paragraph anchors (e.g.
  ARP-bilaget when running the medvirkning survey).$c$;

create index if not exists survey_org_templates_law_refs_idx
  on public.survey_org_templates using gin (law_refs);

-- ── 4. register_types ─────────────────────────────────────────────────────
-- Register types already carry `regulation_ids text[]` for framework
-- membership (`aml`, `iso-14001`, `reach`). Add a paragraph-level
-- aml_paragraphs[] for the dashboard's drill-down.

alter table public.register_types
  add column if not exists aml_paragraphs text[] not null default '{}'::text[];

comment on column public.register_types.aml_paragraphs is
  $c$Specific AML paragraphs this register type fulfils, e.g.
  array['AML § 4-5'] for the chemicals register. Distinct from
  regulation_ids (frameworks) so the AML dashboard can drill into a
  paragraph cell and find every register type that satisfies it.$c$;

create index if not exists register_types_aml_paragraphs_idx
  on public.register_types using gin (aml_paragraphs);

-- Backfill the three system register types so the AML dashboard
-- doesn't have to wait for the next provision pass.
update public.register_types
set aml_paragraphs = array['AML § 4-5']
where id = 'chemicals'
  and (aml_paragraphs is null or aml_paragraphs = '{}'::text[]);

update public.register_types
set aml_paragraphs = array['AML § 2-2']
where id = 'external_suppliers'
  and (aml_paragraphs is null or aml_paragraphs = '{}'::text[]);

-- gdpr_processing_activities is GDPR-only — no AML anchor.
