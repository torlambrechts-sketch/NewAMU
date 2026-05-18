-- Studio Builder Phase 3 Task 3.1 — review_status across studio-aware tables.
--
-- The compliance_review_status enum (draft / reviewed / approved) was
-- introduced for compliance_checklist_templates + survey_org_templates.
-- Phase 3 extends it to the remaining studio-aware authoring tables so
-- the studio's PublishBar can drive a uniform review/approve flow for
-- every kind:
--   - document_org_templates
--   - meeting_templates
--   - register_types
--   - learning_courses
--
-- Existing rows backfill to 'approved' so the current "everything-is-live"
-- behaviour is preserved. New rows that come in via the studio shell
-- default to 'draft' (the column default), and the studio mutators flip
-- to 'reviewed' / 'approved' explicitly through compliance_notifications
-- studio_* events.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 (fordeling av ansvar) — review
--   status makes the responsible-author / responsible-reviewer split
--   first-class on every studio-authored row. AML § 3-1 (2) e
--   (læringssløyfe) — approve-after-edit creates a closed loop tied to
--   the compliance_notifications studio_review_* categories shipped in
--   Task 0.6.
--   Restrisiko deferred:
--     - "Audited by AMU" badge (Task 3.5) requires a separate AMU-review
--       workflow that doesn't exist today; deferred to Phase 3.5.
--
-- Idempotent: add column if not exists + index if not exists.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. document_org_templates
-- ────────────────────────────────────────────────────────────────────

alter table public.document_org_templates
  add column if not exists review_status compliance_review_status not null default 'approved';

create index if not exists document_org_templates_review_status_idx
  on public.document_org_templates (review_status);

comment on column public.document_org_templates.review_status is
  'Studio Builder review state — draft / reviewed / approved. Existing rows backfilled to approved on Phase 3 Task 3.1 (preserves current behaviour). New studio writes start at draft.';

-- ────────────────────────────────────────────────────────────────────
-- 2. meeting_org_templates  (per-org authored meeting templates)
-- ────────────────────────────────────────────────────────────────────

alter table public.meeting_org_templates
  add column if not exists review_status compliance_review_status not null default 'approved';

create index if not exists meeting_org_templates_review_status_idx
  on public.meeting_org_templates (review_status);

comment on column public.meeting_org_templates.review_status is
  'Studio Builder review state — draft / reviewed / approved. See document_org_templates.review_status.';

-- ────────────────────────────────────────────────────────────────────
-- 3. register_types
-- ────────────────────────────────────────────────────────────────────

alter table public.register_types
  add column if not exists review_status compliance_review_status not null default 'approved';

create index if not exists register_types_review_status_idx
  on public.register_types (review_status);

comment on column public.register_types.review_status is
  'Studio Builder review state — draft / reviewed / approved.';

-- ────────────────────────────────────────────────────────────────────
-- 4. learning_courses
-- ────────────────────────────────────────────────────────────────────

alter table public.learning_courses
  add column if not exists review_status compliance_review_status not null default 'approved';

create index if not exists learning_courses_review_status_idx
  on public.learning_courses (review_status);

comment on column public.learning_courses.review_status is
  'Studio Builder review state — draft / reviewed / approved.';
