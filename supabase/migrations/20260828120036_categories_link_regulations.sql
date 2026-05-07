-- Two-level taxonomy: link existing per-org category tables to the
-- regulations table (category-architecture §T2).
--
-- Touches four tables that already function as Cat 2 (per-org
-- categories/spaces/groupings):
--   - compliance_checklist_categories
--   - survey_template_categories
--   - learning_categories
--   - wiki_spaces
--
-- Tasks deliberately stay un-normalised — the source-type enum already
-- segments them; resolution to regulation happens in code (T3).
--
-- Backfill mapping per spec §T2 OQ-A2:
--   - compliance pack 'aml-amu'                       → 'aml'
--   - compliance pack 'iso-45001'                     → 'iso-45001'
--   - survey pack 'vendor'                            → 'apenhetsloven'
--   - survey pack 'arbeidsmiljo'                      → 'aml'
--   - survey pack 'compliance'                        → 'ik-f'
--   - survey pack 'engagement' / 'exit'               → null (admin-assigned)
--   - wiki_spaces.category 'hms_handbook' / 'procedure'→ 'ik-f'
--   - wiki_spaces.category 'policy' / 'guide' / 'template_library' → null
--   - learning_categories.slug like 'førstehjelp'/'brann'/'verneombud'/'hms-grunnopplæring' → 'aml'
--
-- Idempotent — safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Add the FK column on each table ────────────────────────────────────
-- The reference is composite (organization_id, regulation_id); the
-- consuming SQL resolves it via a join + per-org filter rather than a
-- formal FK because PostgreSQL doesn't support multi-column FKs against
-- a primary key whose first column would be redundant in the local
-- table. Instead we add a CHECK trigger to enforce same-org coherence.

alter table public.compliance_checklist_categories
  add column if not exists regulation_id text;

alter table public.survey_template_categories
  add column if not exists regulation_id text;

alter table public.learning_categories
  add column if not exists regulation_id text;

alter table public.wiki_spaces
  add column if not exists regulation_id text;

-- ── 2. Same-org coherence trigger ─────────────────────────────────────────
-- Catches the only realistic foot-gun: assigning a regulation_id that
-- belongs to a different org (or doesn't exist).

create or replace function public.regulation_id_must_match_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.regulation_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.regulations
    where id = new.regulation_id
      and organization_id = new.organization_id
      and deleted_at is null
  ) then
    raise exception 'regulation_id % does not exist for org %', new.regulation_id, new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_checklist_categories_reg_check on public.compliance_checklist_categories;
create trigger compliance_checklist_categories_reg_check
  before insert or update of regulation_id on public.compliance_checklist_categories
  for each row execute function public.regulation_id_must_match_org();

drop trigger if exists survey_template_categories_reg_check on public.survey_template_categories;
create trigger survey_template_categories_reg_check
  before insert or update of regulation_id on public.survey_template_categories
  for each row execute function public.regulation_id_must_match_org();

drop trigger if exists learning_categories_reg_check on public.learning_categories;
create trigger learning_categories_reg_check
  before insert or update of regulation_id on public.learning_categories
  for each row execute function public.regulation_id_must_match_org();

drop trigger if exists wiki_spaces_reg_check on public.wiki_spaces;
create trigger wiki_spaces_reg_check
  before insert or update of regulation_id on public.wiki_spaces
  for each row execute function public.regulation_id_must_match_org();

-- ── 3. Backfill: compliance_checklist_categories ──────────────────────────
-- Pack maps directly to regulation. Existing categories carry a `pack`
-- column (per migration 20260828120022); the mapping is one-to-one.

update public.compliance_checklist_categories
   set regulation_id = case pack
     when 'aml-amu'    then 'aml'
     when 'iso-45001'  then 'iso-45001'
     else null
   end
 where regulation_id is null
   and pack is not null;

-- ── 4. Backfill: survey_template_categories ───────────────────────────────

update public.survey_template_categories
   set regulation_id = case pack
     when 'vendor'       then 'apenhetsloven'
     when 'arbeidsmiljo' then 'aml'
     when 'compliance'   then 'ik-f'
     else null  -- engagement, exit → admin-assigned
   end
 where regulation_id is null
   and pack is not null;

-- ── 5. Backfill: wiki_spaces ──────────────────────────────────────────────

update public.wiki_spaces
   set regulation_id = case category
     when 'hms_handbook' then 'ik-f'
     when 'procedure'    then 'ik-f'
     else null
   end
 where regulation_id is null;

-- ── 6. Backfill: learning_categories ──────────────────────────────────────
-- Heuristic via slug — the seeded slugs from migration 20260828120029
-- (HMS-grunnopplæring, brann, førstehjelp, verneombud, onboarding)
-- mostly trace back to AML competence requirements.

update public.learning_categories
   set regulation_id = 'aml'
 where regulation_id is null
   and slug in ('hms-grunnopplaring', 'brann', 'forstehjelp', 'verneombud', 'onboarding');
