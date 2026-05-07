-- Add pack column to surveys + survey_template_catalog and auto-derive
-- existing values per Q3 of GLOBAL_SURVEY_PLAN. After this migration the
-- pack column is NOT NULL on both tables; new rows must explicitly set it.
--
-- Auto-derivation heuristic (admin can re-tag via Pakker tab once Commit 9
-- ships):
--
--   surveys.survey_type:
--     'external'                                  → vendor
--     'exit'                                      → exit
--     'onboarding'                                → engagement
--     'pulse'                                     → arbeidsmiljo
--     'internal' (and others)                     → title keyword fallback,
--                                                   default engagement
--
--   surveys.title keywords (case-insensitive):
--     leverand% / vendor / bemann% / under-entrep → vendor
--     qps / ark / hms / psyk / arbeidsmiljø       → arbeidsmiljo
--     compliance / åpenhetsl / attest             → compliance
--     exit / sluttsamtale                         → exit
--
--   survey_template_catalog.category:
--     vendor                                      → vendor
--     compliance                                  → compliance
--     safety                                      → arbeidsmiljo
--     wellbeing / engagement / performance        → engagement
--     custom / NULL                               → engagement (default)
--
-- Defensive audit-trigger replacement: survey_template_catalog has
-- organization_id NULL on system rows. The standard hse_audit_trigger
-- writes to hse_audit_log with NOT NULL organization_id and would fail
-- on system-row UPDATEs. Replace with three conditional triggers
-- (insert/update/delete) that fire only when org_id is non-null —
-- same pattern that fixed compliance_requirements in 20260809140000.

-- ── 1. survey_template_catalog audit-trigger fix (defensive) ───────────────

drop trigger if exists survey_template_catalog_audit_tg          on public.survey_template_catalog;
drop trigger if exists survey_template_catalog_audit_insert_tg   on public.survey_template_catalog;
drop trigger if exists survey_template_catalog_audit_update_tg   on public.survey_template_catalog;
drop trigger if exists survey_template_catalog_audit_delete_tg   on public.survey_template_catalog;

create trigger survey_template_catalog_audit_insert_tg
  after insert on public.survey_template_catalog
  for each row when (new.organization_id is not null)
  execute function public.hse_audit_trigger();

create trigger survey_template_catalog_audit_update_tg
  after update on public.survey_template_catalog
  for each row when (coalesce(new.organization_id, old.organization_id) is not null)
  execute function public.hse_audit_trigger();

create trigger survey_template_catalog_audit_delete_tg
  after delete on public.survey_template_catalog
  for each row when (old.organization_id is not null)
  execute function public.hse_audit_trigger();

-- ── 2. Add pack column (nullable for backfill window) ──────────────────────

alter table public.surveys
  add column if not exists pack public.survey_pack;

alter table public.survey_template_catalog
  add column if not exists pack public.survey_pack;

-- ── 3. Auto-derive pack on existing rows ───────────────────────────────────

update public.surveys
set pack = case
  when survey_type = 'external'                                                    then 'vendor'::public.survey_pack
  when survey_type = 'exit'                                                        then 'exit'::public.survey_pack
  when survey_type = 'onboarding'                                                  then 'engagement'::public.survey_pack
  when survey_type = 'pulse'                                                       then 'arbeidsmiljo'::public.survey_pack
  -- Title-based overrides (case-insensitive)
  when title ilike '%leverand%' or title ilike '%vendor%'
       or title ilike '%bemann%' or title ilike '%underentrep%'                    then 'vendor'::public.survey_pack
  when title ilike '%qps%' or title ilike '%ark%' or title ilike '%hms%'
       or title ilike '%psyk%' or title ilike '%arbeidsmilj%'                      then 'arbeidsmiljo'::public.survey_pack
  when title ilike '%compliance%' or title ilike '%åpenhetsl%' or title ilike '%attest%' then 'compliance'::public.survey_pack
  when title ilike '%exit%' or title ilike '%sluttsamtale%'                        then 'exit'::public.survey_pack
  else 'engagement'::public.survey_pack
end
where pack is null;

update public.survey_template_catalog
set pack = case category
  when 'vendor'      then 'vendor'::public.survey_pack
  when 'compliance'  then 'compliance'::public.survey_pack
  when 'safety'      then 'arbeidsmiljo'::public.survey_pack
  when 'wellbeing'   then 'engagement'::public.survey_pack
  when 'engagement'  then 'engagement'::public.survey_pack
  when 'performance' then 'engagement'::public.survey_pack
  when 'custom'      then 'engagement'::public.survey_pack
  else 'engagement'::public.survey_pack
end
where pack is null;

-- ── 4. Lock pack column to NOT NULL ────────────────────────────────────────

alter table public.surveys                 alter column pack set not null;
alter table public.survey_template_catalog alter column pack set not null;

-- ── 5. Indexes for pack-scoped queries ─────────────────────────────────────

create index if not exists surveys_org_pack_status_idx
  on public.surveys (organization_id, pack, status);

create index if not exists survey_template_catalog_pack_active_idx
  on public.survey_template_catalog (pack, is_active);
