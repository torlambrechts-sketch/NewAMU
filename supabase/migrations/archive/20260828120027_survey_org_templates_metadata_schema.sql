-- Survey org-templates: metadata_schema column.
--
-- Per spec OQ-1: attaches to survey_org_templates (org-curated), not
-- survey_template_catalog. Catalog rows still seed defaults via the
-- provisioning flow; per-org overrides decide which fields surface
-- on the org's survey instances.
--
-- Schema shape (mirroring compliance_checklist_templates.metadata_schema):
--   { "fields": [
--       { "key": "location",     "kind": "location",     "required": true },
--       { "key": "participants", "kind": "participants", "required": true },
--       { "key": "evaluation_period", "kind": "text", "label": "Evalueringsperiode", "required": false }
--     ]
--   }
-- Built-in kinds (location, department, team, participants) bind to the
-- typed FK columns added in 20260828120026. Free-form kinds (text /
-- number / select) land in surveys.metadata under their declared key.

set local search_path = public, pg_catalog;

alter table public.survey_org_templates
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

comment on column public.survey_org_templates.metadata_schema is
  $c$Field declarations driving the survey instance metadata editor.
  Same shape as compliance_checklist_templates.metadata_schema. Built-in
  kinds (location, department, team, participants) bind to typed FK
  columns on surveys; free-form kinds (text, number, select) land in
  surveys.metadata under their declared key.$c$;
