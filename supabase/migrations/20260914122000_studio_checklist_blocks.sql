-- Studio visual editor support for compliance_checklist_templates.
--
-- Adds studio_blocks (jsonb) to store the block tree produced by the Studio
-- checklist editor (kind: 'section' | 'checklist_item').  The existing
-- definition.items[] column remains the canonical execution payload and is
-- re-derived from studio_blocks on every save (same pattern as
-- 20260914121100_studio_survey_blocks.sql for surveys).
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

ALTER TABLE compliance_checklist_templates
  ADD COLUMN IF NOT EXISTS studio_blocks jsonb;

COMMENT ON COLUMN compliance_checklist_templates.studio_blocks IS
  'Visual editor block tree written by Studio. Array of objects with
   kind: "section" | "checklist_item".
   Section shape: {id, kind:"section", title, description?}.
   Item shape:    {id, kind:"checklist_item", key, prompt, itemType,
                   required, severity_default?, law_ref?, iso_clause?, help?}.
   Null for pre-Studio templates; useChecklistStudio falls back to
   definition.items when null or empty. definition.items is always the
   canonical execution payload and is re-derived from studio_blocks on save.';
