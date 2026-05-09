-- Survey nav_pinned recovery — re-pin every system survey_org_templates
-- row regardless of updated_at heuristics.
--
-- Why this is needed despite the existing _120031 bundle:
-- _120031's force-pin was conservative: it only flipped rows where
-- `updated_at <= created_at + interval '1 second'` to protect admin
-- un-pin choices. In practice that gate skipped any row that had been
-- touched by intervening migrations / triggers / re-provisions, even
-- when no admin ever clicked anything. Result on customer DBs:
-- survey_org_templates rows exist with nav_pinned=false, so:
--   - SurveyHubLanding still shows them (its "Festet" badge is just
--     `!!pinnedRow`, not nav_pinned=true)
--   - useSurveyNav (sidebar) filters on nav_pinned=true and returns
--     an empty list → no template entries in the sidebar
-- which is exactly what users report ("hub shows the templates,
-- sidebar is empty").
--
-- This migration drops the updated_at heuristic. It pins every
-- is_system override row that isn't explicitly soft-deleted or set
-- inactive. Admin choices made AFTER this migration runs are
-- preserved (the existing nav_pinned column stays writable from the
-- Maler admin tab). One-shot recovery; safe to re-apply (idempotent
-- because the SET expression is a no-op on already-true rows).

set local search_path = public, pg_catalog;

update public.survey_org_templates ot
   set nav_pinned = true
  from public.survey_template_catalog c
 where ot.catalog_id = c.id
   and c.is_system = true
   and c.organization_id is null
   and ot.is_active = true
   and ot.deleted_at is null
   and ot.nav_pinned = false;
