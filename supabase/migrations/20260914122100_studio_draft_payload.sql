-- Studio Builder Phase 0/2a — studio_draft_payload column + 24h TTL.
--
-- Spec §3 decision: "Per-row draft column studio_draft_payload jsonb
-- on each studio-aware table. Autosave every 10s during editing or on
-- blur. Server-side TTL of 24h after which drafts are purged."
--
-- This migration adds the column to every studio-aware authoring
-- table that doesn't already carry it. The useAutosave hook (Phase 2a)
-- writes to this column from the embedder; the
-- purge_stale_studio_drafts() helper sweeps abandoned drafts older
-- than 24h.
--
-- Tables touched (column added if missing):
--   - compliance_checklist_templates
--   - survey_org_templates
--   - document_org_templates
--   - meeting_org_templates
--   - register_types
--   - learning_courses
--   - dashboard_layouts
--
-- studio_pack_drafts already has draft_payload; we don't touch it.
-- meetings + surveys are runtime rows, not authoring rows — they
-- get the column anyway for symmetry with the embedder contract.
--
-- Arbeidstilsynet self-audit:
--   IK-f § 5 nr. 7 — abandoned drafts purged after 24h prevent stale
--   half-written content surviving in audit-relevant tables.
--   GDPR art. 5 (1)(e) — data minimisation.
--
-- Idempotent.

set local search_path = public, pg_catalog;

do $do$
declare
  v_tables text[] := array[
    'compliance_checklist_templates',
    'survey_org_templates',
    'document_org_templates',
    'meeting_org_templates',
    'register_types',
    'learning_courses',
    'dashboard_layouts'
  ];
  v_table text;
begin
  foreach v_table in array v_tables
  loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=v_table) then
      execute format(
        'alter table public.%I add column if not exists studio_draft_payload jsonb',
        v_table
      );
      execute format(
        'alter table public.%I add column if not exists studio_draft_at timestamptz',
        v_table
      );
      execute format(
        'create index if not exists %I on public.%I (studio_draft_at) where studio_draft_payload is not null',
        v_table || '_studio_draft_idx', v_table
      );
    end if;
  end loop;
end
$do$;

-- ────────────────────────────────────────────────────────────────────
-- purge_stale_studio_drafts() — 24h-old drafts that never published
-- ────────────────────────────────────────────────────────────────────

create or replace function public.purge_stale_studio_drafts()
returns table(row_table text, purged_count integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tables text[] := array[
    'compliance_checklist_templates',
    'survey_org_templates',
    'document_org_templates',
    'meeting_org_templates',
    'register_types',
    'learning_courses',
    'dashboard_layouts'
  ];
  v_table text;
  v_count integer;
begin
  foreach v_table in array v_tables
  loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=v_table) then
      execute format(
        'update public.%I set studio_draft_payload = null, studio_draft_at = null
           where studio_draft_at is not null and studio_draft_at < now() - interval ''24 hours''',
        v_table
      );
      get diagnostics v_count = row_count;
      row_table := v_table;
      purged_count := v_count;
      return next;
    end if;
  end loop;
end;
$fn$;

comment on function public.purge_stale_studio_drafts is
  'Studio Builder — clears studio_draft_payload + studio_draft_at on rows where the draft is >24h stale. Returns per-table purge count. Wired via pg_cron (studio_purge_stale_drafts).';

-- ────────────────────────────────────────────────────────────────────
-- pg_cron registration — daily 03:30 UTC
-- ────────────────────────────────────────────────────────────────────

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'studio_purge_stale_drafts';
    perform cron.schedule(
      'studio_purge_stale_drafts',
      '30 3 * * *',
      $cmd$ select count(*) from public.purge_stale_studio_drafts(); $cmd$
    );
  else
    raise notice '[studio_draft_payload] pg_cron missing — call purge_stale_studio_drafts() from an external scheduler.';
  end if;
end
$do$;
