-- Survey provision bundle — parallel to migration 20260828120020 for compliance.
--
-- Why:
-- Survey templates only appear in the sidebar when the per-org override row
-- (`survey_org_templates`) has `nav_pinned = true`. Provisioning happens via
-- `provision_survey_baseline_for_org`, which is fired by:
--   1. The trigger on `survey_packs` insert/update (pack licensing); and
--   2. Per-batch `do $$ ... loop ... perform provision ... end $$` blocks at
--      the end of each survey templates batch migration.
--
-- Two failure modes were observed in deployed databases:
--   - Orgs that already had `survey_packs.is_active = true` *before* the
--     provision trigger landed (Aug 11 batches) never got templates
--     mirrored into `survey_org_templates` — the trigger fires on
--     insert/update, not on the "row is already active" steady state.
--   - A version of the schema briefly defaulted `nav_pinned` to `false`,
--     so manually-inserted org_templates rows from that window are
--     orphaned without sidebar visibility.
--
-- This migration is idempotent and additive:
--   1. Re-runs provision for every active (org, pack) — relies on the
--      `(organization_id, catalog_id)` unique constraint to skip
--      already-provisioned templates so admin nav_pinned choices are
--      preserved.
--   2. Force-pins survey_org_templates rows where catalog references an
--      `is_system = true` template AND no admin has explicitly toggled the
--      pin — heuristic via the `updated_at` matching the row's `created_at`
--      (i.e. only pristine provisioned rows are updated; rows the admin
--      touched stay untouched).
--
-- Mirrors compliance bundle's idempotency contract — safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Re-provision every active (org, pack) ──────────────────────────────

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.survey_packs
    where is_active = true
      and deleted_at is null
  loop
    perform public.provision_survey_baseline_for_org(
      v_pack.organization_id, v_pack.slug
    );
  end loop;
end $$;

-- ── 2. Force-pin pristine system overrides ────────────────────────────────
-- Only flip rows that look untouched since creation (`updated_at` within
-- one second of `created_at`) — protects deliberate admin unpins. The
-- `is_system` filter on the underlying catalog row keeps this from
-- promoting customer-owned templates by accident.

update public.survey_org_templates ot
set nav_pinned = true
from public.survey_template_catalog c
where ot.catalog_id = c.id
  and c.is_system = true
  and c.organization_id is null
  and ot.is_active = true
  and ot.deleted_at is null
  and ot.nav_pinned = false
  and ot.updated_at <= ot.created_at + interval '1 second';
