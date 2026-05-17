-- Studio Builder — extend dashboard_layouts.kind CHECK to accept
-- studio-authored layout kinds.
--
-- The original CHECK was added by _20260905120000_reports_promote_dashboard_layouts.sql
-- (lines 22-24) and limited kind to ('dashboard', 'report', 'report_template').
-- Studio wants to reuse the same table for layout-bearing kinds it owns
-- (Simple-mode preset outputs that produce a layout; pack-bundled layouts
-- that get shipped with a compliance pack). Extending the CHECK avoids
-- building a parallel `studio_layouts` table — substrate audit identified
-- this as the cleanest reuse path (specs/studio-builder.md §2 substrate fix).
--
-- Arbeidstilsynet self-audit:
--   No direct pålegg-grunn. This is a CHECK constraint extension; the
--   underlying audit substrate (cover_meta, snapshot_data, share_token,
--   published_at/_by) is unchanged and continues to power evidence-
--   anchored reports per IK-f § 5 nr. 7.
--   Restrisiko deferred:
--     - Application-layer Zod validator in useDashboardLayout.ts also
--       needs the new kinds in its enum — Task 0.3 (WidgetKindRegistry
--       refactor) updates this since the kind list becomes registry-
--       derived rather than hand-maintained.
--
-- Idempotent — dynamic constraint name discovery + add-if-missing.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. Drop the existing CHECK (whatever its auto-name is)
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
       and t.relname = 'dashboard_layouts'
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%kind%'
       and pg_get_constraintdef(c.oid) ilike '%dashboard%'
  loop
    execute format('alter table public.dashboard_layouts drop constraint %I', v_constraint);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Add the extended CHECK
-- ────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dashboard_layouts_kind_check'
  ) then
    alter table public.dashboard_layouts
      add constraint dashboard_layouts_kind_check
      check (kind in (
        'dashboard',              -- pre-Studio: live dashboard layout
        'report',                 -- pre-Studio: frozen report snapshot
        'report_template',        -- pre-Studio: report template
        'studio_preset_layout',   -- Studio Simple-mode wizard output
        'studio_pack_layout'      -- Studio: pack-bundled layout
      ));
  end if;
end $$;

comment on column public.dashboard_layouts.kind is
  'Layout kind. dashboard | report | report_template are pre-Studio (see _20260905120000). studio_preset_layout (Simple-mode wizard outputs) and studio_pack_layout (layouts bundled in a compliance pack via studio_packs) added by Studio Builder Phase 0 — see specs/studio-builder.md §5 Task 0.5.';
