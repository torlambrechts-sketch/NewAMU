-- Survey module adjustments — Commit 10 of GLOBAL_SURVEY_PLAN extension.
-- Three small column additions + one constraint relaxation that the next
-- two commits' template content depends on.
--
-- (A) law_ref text on org_survey_questions — free-text legal reference per
--     question, parallel to the existing mandatory_law enum. Going forward,
--     templates use law_ref ('AML §3-5' / 'IK-forskriften §5 nr.8' /
--     'Åpenhetsloven §4') for consistency with compliance_checklist items
--     where law_ref is also free text. mandatory_law stays for backward
--     compatibility but the CHECK constraint is dropped so any string can
--     be stored — the constraint was about to grow indefinitely as we add
--     surveys covering more clauses.
--
-- (B) recommended_cadence_months int on survey_template_catalog — platform
--     recommendation for the admin UI to prefill on survey creation.
--     Optional (NULL = no recommendation, customer chooses).
--
-- (F) recommended_anonymity_threshold int on survey_template_catalog —
--     overrides the pack default (default_anonymity_threshold) for templates
--     where a smaller team-realism threshold matters (e.g. discrimination
--     and surveillance-perception surveys where k=5 routinely fails). NULL
--     means "use pack default."

-- ── (A) law_ref column on questions + relaxed mandatory_law constraint ─────

alter table public.org_survey_questions
  add column if not exists law_ref text;

alter table public.org_survey_questions
  drop constraint if exists org_survey_questions_mandatory_law_check;

-- ── (B) catalog: recommended cadence (months) ──────────────────────────────

alter table public.survey_template_catalog
  add column if not exists recommended_cadence_months int
    check (recommended_cadence_months is null or recommended_cadence_months between 1 and 36);

-- ── (F) catalog: recommended anonymity threshold (override pack default) ───

alter table public.survey_template_catalog
  add column if not exists recommended_anonymity_threshold int
    check (
      recommended_anonymity_threshold is null
      or recommended_anonymity_threshold between 1 and 100
    );
