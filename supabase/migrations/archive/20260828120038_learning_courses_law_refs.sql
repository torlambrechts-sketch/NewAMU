-- Learning courses: law_refs column for the new "Lovverk" tab on the
-- course builder (specs/elearning-course-builder-redesign.md, T2).
--
-- Stores the codes (strings) the author has linked to a course from
-- `LEARNING_MODULE_LEGAL_REFERENCES` (see
-- `src/components/learning/learningLegalReferences.tsx`). The codes are
-- canonical (`"AML § 3-2"`, `"IK-forskriften § 5 nr. 2"`, etc.) so the
-- UI can resolve label + body text from the library at render time.
--
-- Idempotent: `add column if not exists`; default is an empty array so
-- existing rows pick up a sensible value without a backfill loop.

set local search_path = public, pg_catalog;

alter table public.learning_courses
  add column if not exists law_refs jsonb not null default '[]'::jsonb;

comment on column public.learning_courses.law_refs is
  'Array of canonical law-reference codes linked to this course (e.g. ["AML § 3-2", "IK-forskriften § 5 nr. 2"]). Drives the Lovverk tab in the course builder; falls back to the global LEARNING_MODULE_LEGAL_REFERENCES list when empty.';
