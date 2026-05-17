-- Studio Builder — extend compliance_notifications to carry Studio events.
--
-- The original category CHECK (archive/_20260904120100_compliance_notifications_phase5_sprint2.sql
-- lines 26-35) limited categories to 8 compliance-only values, and the
-- table has no structured payload column at all — studio events would
-- have nowhere to live without schema changes.
--
-- This migration:
--   1. Extends the category CHECK with 6 new studio_* categories.
--   2. Adds a `payload jsonb` column for structured event data.
--   3. Adds an index on (category, created_at desc) so studio category
--      filters perform well on dashboards.
--
-- Studio-side categories (with payload shapes):
--   studio_review_requested        { row_id, scope_id, kind_id, reviewer_role }
--   studio_review_approved         { row_id, scope_id, kind_id, approver_id }
--   studio_review_rejected         { row_id, scope_id, kind_id, reviewer_id, note }
--   studio_pack_published          { pack_slug, pack_semver, published_by }
--   studio_partner_grant_granted   { partner_id, client_org_id, granted_by }
--   studio_partner_grant_revoked   { partner_id, client_org_id, revoked_by, grace_until }
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 (fordeling av ansvar). Reuses
--   the single in-app inbox (compliance_notifications) for Studio review-
--   and-approve workflow instead of building a parallel notifications
--   surface; AML § 3-1 (2) e (læringssløyfe — when content changes, the
--   responsible role gets told). Personvernforordningen art. 32 — payload
--   is structured jsonb, not free-text, so PII never bleeds into bodies.
--   Restrisiko deferred:
--     - Email delivery: the existing `email_sent_at` column carries the
--       state; the SMTP edge function picks up studio_* rows in the same
--       sweep as compliance_*. No new wiring needed.
--     - Retention: studio_* rows follow the same retention policy as
--       compliance_* rows. Revisit if Phase 4 marketplace adds N×10x more
--       volume per org.
--
-- Idempotent — dynamic CHECK name discovery + add-if-missing.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. Drop the existing category CHECK (auto-named in the source migration)
-- ────────────────────────────────────────────────────────────────────

do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'compliance_notifications'
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%category%'
  loop
    execute format('alter table public.compliance_notifications drop constraint %I', v_constraint);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Add the extended category CHECK
-- ────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compliance_notifications_category_check'
  ) then
    alter table public.compliance_notifications
      add constraint compliance_notifications_category_check
      check (category in (
        -- Pre-Studio (existing 8)
        'requirement_assigned',
        'requirement_due_soon',
        'requirement_overdue',
        'breach_active',
        'breach_overdue',
        'subject_request_due_soon',
        'subject_request_overdue',
        'general',
        -- Studio Builder (new 6)
        'studio_review_requested',
        'studio_review_approved',
        'studio_review_rejected',
        'studio_pack_published',
        'studio_partner_grant_granted',
        'studio_partner_grant_revoked'
      ));
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. Add payload jsonb column
-- ────────────────────────────────────────────────────────────────────

alter table public.compliance_notifications
  add column if not exists payload jsonb not null default '{}'::jsonb;

comment on column public.compliance_notifications.payload is
  'Structured payload for studio events. Per category shape:
   studio_review_requested        → { row_id, scope_id, kind_id, reviewer_role }
   studio_review_approved         → { row_id, scope_id, kind_id, approver_id }
   studio_review_rejected         → { row_id, scope_id, kind_id, reviewer_id, note }
   studio_pack_published          → { pack_slug, pack_semver, published_by }
   studio_partner_grant_granted   → { partner_id, client_org_id, granted_by }
   studio_partner_grant_revoked   → { partner_id, client_org_id, revoked_by, grace_until }
   Empty {} for pre-Studio categories.';

-- ────────────────────────────────────────────────────────────────────
-- 4. Category-filtered recency index
-- ────────────────────────────────────────────────────────────────────

create index if not exists cn_category_recent_idx
  on public.compliance_notifications (category, created_at desc);
