-- Extend task_pack enum to include the three new ISO packs.
--
-- IsoGapAnalysisSessionPage passes pack = session.standard when creating
-- CAPA tasks from gap clauses. Without these values the DB rejects the
-- insert, causing silent failures in "Opprett tiltak".
--
-- Must run outside a transaction (ADD VALUE restriction on Postgres enums).
-- Idempotent: IF NOT EXISTS prevents errors on re-run.

set local search_path = public, pg_catalog;

ALTER TYPE public.task_pack ADD VALUE IF NOT EXISTS 'iso-9001';
ALTER TYPE public.task_pack ADD VALUE IF NOT EXISTS 'iso-14001';
ALTER TYPE public.task_pack ADD VALUE IF NOT EXISTS 'iso-27001';
