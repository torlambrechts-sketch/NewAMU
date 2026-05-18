-- Studio: Add studio_blocks column to survey_template_catalog
--
-- Gap closed: The survey template catalog stores questions as a flat array in
-- `body.questions[]`. The Klarert Studio editor needs a richer block model
-- that includes section headings and branching rules alongside questions.
--
-- studio_blocks stores a StudioBlock[] (see modules/studio/types.ts). On each
-- save the editor also writes body.questions from the question blocks so
-- existing consumers (SurveyOrgTemplateEditorPage, useSurvey) keep working.
--
-- Restrisiko deferred: no back-fill — templates created before Studio have
-- NULL studio_blocks and the editor initialises them from body.questions on
-- first open.

alter table survey_template_catalog
  add column if not exists studio_blocks jsonb;

comment on column survey_template_catalog.studio_blocks is
  'StudioBlock[] — [{id, kind: "section"|"question"|"branch", ...}]. '
  'NULL until the template is first opened in Klarert Studio. '
  'On save the editor derives body.questions from question blocks for backward compat.';
