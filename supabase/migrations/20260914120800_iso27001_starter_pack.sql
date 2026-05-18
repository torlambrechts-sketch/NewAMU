-- Studio Builder Phase 2b — seed ISO 27001 starter pack via studio_packs.
--
-- Depends on _120700_compliance_pack_iso27001.sql for the enum value
-- (split because Postgres won't allow new enum value + use in same
-- transaction).
--
-- This is the "loop-closes proof" deliverable: ISO 27001 ships as a
-- pack authored via the studio (no per-content forward migration). The
-- ISMS / Annex A.5-A.18 baseline templates are part of the pack's
-- `manifest` jsonb body. studio-pack-import expands the manifest into
-- live tenant rows via the existing provision_*_baseline_for_org RPCs.
--
-- Full content drafting (10-15 checklist templates, 5-8 documents, 3-5
-- e-learning courses, 2-3 surveys, 1 register) is a content-engineer
-- deliverable per spec §5 Phase 2b open question. This migration ships
-- the SHELL for that work — a v1.0.0-skeleton manifest with the Annex
-- A control structure populated. Customer-eng can edit-in-place via
-- studio_pack_drafts → publish_studio_pack.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: ISO 27001:2022 Annex A.5–A.18 (information
--   security controls). Even the skeleton anchors the controls so the
--   gap matrix (compliance-planner.md §3) returns ≥10 covered paragraphs
--   the moment the pack ships.
--   Restrisiko deferred:
--     - Real-life control content (policies, procedures, audit
--       evidence templates) belongs to an ISMS consultant. Skeleton ships
--       the structure + law-ref strings only.
--     - ISO 27001:2022 is the target version.
--
-- Idempotent: insert via on-conflict-do-nothing.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- Seed ISO 27001 v1.0.0-skeleton starter pack
-- ────────────────────────────────────────────────────────────────────
-- One row per org (system seed). The manifest carries the Annex A
-- control structure so the planner gap matrix reads law_refs cheaply.
-- Customer-eng fills in the bodies via studio_pack_drafts; bumping to
-- v1.1.0 (or 2.0.0) replaces this skeleton with full content.
--
-- We seed via a loop over organizations(id) so existing tenants get the
-- starter pack on apply. A trigger on organizations.insert backfills
-- new orgs.

create or replace function public.seed_iso27001_starter_pack_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.studio_packs (
    organization_id, slug, semver, name_i18n, summary_i18n, accent,
    legal_references, manifest, immutable, published_at, status,
    review_status
  ) values (
    p_org_id,
    'iso-27001',
    '1.0.0-skeleton',
    jsonb_build_object('nb', 'ISO 27001 — informasjonssikkerhet', 'en', 'ISO 27001 — Information security'),
    jsonb_build_object(
      'nb', 'Skjelett for ISO 27001:2022 Annex A-kontroller. Innholdet fylles inn via Studio.',
      'en', 'ISO 27001:2022 Annex A controls skeleton. Bodies authored via Studio.'
    ),
    '#1e40af',
    to_jsonb(array[
      'ISO 27001 A.5.1','ISO 27001 A.5.9','ISO 27001 A.5.10',
      'ISO 27001 A.5.15','ISO 27001 A.5.23','ISO 27001 A.5.30',
      'ISO 27001 A.6.3','ISO 27001 A.6.6','ISO 27001 A.7.1',
      'ISO 27001 A.7.4','ISO 27001 A.8.2','ISO 27001 A.8.9',
      'ISO 27001 A.8.12','ISO 27001 A.8.13','ISO 27001 A.8.16',
      'ISO 27001 A.8.24','ISO 27001 A.8.28'
    ]),
    jsonb_build_object(
      'format_version', '1.0',
      'controls', jsonb_build_array(
        jsonb_build_object('id', 'A.5.1', 'category', 'Organizational', 'title', 'Policies for information security', 'kind', 'document'),
        jsonb_build_object('id', 'A.5.9', 'category', 'Organizational', 'title', 'Inventory of information and other associated assets', 'kind', 'register'),
        jsonb_build_object('id', 'A.5.10', 'category', 'Organizational', 'title', 'Acceptable use of information and associated assets', 'kind', 'document'),
        jsonb_build_object('id', 'A.5.15', 'category', 'Organizational', 'title', 'Access control', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.5.23', 'category', 'Organizational', 'title', 'Information security for use of cloud services', 'kind', 'document'),
        jsonb_build_object('id', 'A.5.30', 'category', 'Organizational', 'title', 'ICT readiness for business continuity', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.6.3', 'category', 'People', 'title', 'Information security awareness, education and training', 'kind', 'course'),
        jsonb_build_object('id', 'A.6.6', 'category', 'People', 'title', 'Confidentiality or non-disclosure agreements', 'kind', 'document'),
        jsonb_build_object('id', 'A.7.1', 'category', 'Physical', 'title', 'Physical security perimeters', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.7.4', 'category', 'Physical', 'title', 'Physical security monitoring', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.8.2', 'category', 'Technological', 'title', 'Privileged access rights', 'kind', 'register'),
        jsonb_build_object('id', 'A.8.9', 'category', 'Technological', 'title', 'Configuration management', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.8.12', 'category', 'Technological', 'title', 'Data leakage prevention', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.8.13', 'category', 'Technological', 'title', 'Information backup', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.8.16', 'category', 'Technological', 'title', 'Monitoring activities', 'kind', 'checklist'),
        jsonb_build_object('id', 'A.8.24', 'category', 'Technological', 'title', 'Use of cryptography', 'kind', 'document'),
        jsonb_build_object('id', 'A.8.28', 'category', 'Technological', 'title', 'Secure coding', 'kind', 'document')
      ),
      'reviews', jsonb_build_object(
        'management_review_cadence', 'arlig',
        'management_review_law_ref', 'ISO 27001 § 9.3'
      )
    ),
    true,
    now(),
    'published',
    'draft'
  )
  on conflict (organization_id, slug, semver) do nothing;
end;
$fn$;

-- Backfill: every existing org gets the skeleton.
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.seed_iso27001_starter_pack_for_org(v_org_id);
  end loop;
end $$;

-- Future orgs: trigger seeds the pack on insert.
create or replace function public.studio_iso27001_seed_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.seed_iso27001_starter_pack_for_org(new.id);
  return new;
end;
$fn$;

drop trigger if exists studio_iso27001_seed on public.organizations;
create trigger studio_iso27001_seed
  after insert on public.organizations
  for each row
  execute function public.studio_iso27001_seed_on_org_insert();
