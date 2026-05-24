-- 20260924120000_documents_legal_basis_format_normalize.sql
--
-- Purpose: tighten the law-ref strings on document_system_templates so the
-- dashboard drill-down (which does exact-string matching per CLAUDE.md) groups
-- correctly. Two cleanup passes:
--
--   1. Format normalization — historical seed migrations used a mix of
--      `AML §3-1`, `AML §3-1 (2c)`, `IK-f §5 nr. 4` (no space after §) and
--      `AML § 3-1`, `IK-f § 5 nr. 4` (with space). The dashboard groups by
--      exact string, so the variants present today silently split the same
--      § into two buckets. Canonical form is `AML § X-Y` (space after §).
--
--   2. Bad-fit reference cleanup — `tpl-tjenestepensjon-info` references
--      `AML § 3-4`, but § 3-4 is about physical-activity/pulse measures; the
--      tjenestepensjon template is grounded in OTP-loven (Lov om obligatorisk
--      tjenestepensjon). Drop the stray AML ref so the planner doesn't claim
--      OTP coverage of § 3-4.
--
--   3. Likestillings- og diskrimineringsloven coverage on `tpl-aktivitetsplikt`
--      already references Ldl + AML § 4-3; add the AML § 13 family explicitly
--      so the dashboard surfaces this template under each § 13-X drill.
--
-- Idempotent: re-running this migration leaves the rows in the same state.

begin;

-- 1) Replace `AML §X-Y` (no space) with `AML § X-Y` (space) across all rows.
update public.document_system_templates
set legal_basis = (
  select array_agg(
    case
      when ref ~ '^AML §[0-9]' then regexp_replace(ref, '^AML §([0-9])', 'AML § \1')
      when ref ~ '^IK-f §[0-9]' then regexp_replace(ref, '^IK-f §([0-9])', 'IK-f § \1')
      else ref
    end
  )
  from unnest(legal_basis) as t(ref)
)
where exists (
  select 1 from unnest(legal_basis) as t(ref)
  where ref ~ '^AML §[0-9]' or ref ~ '^IK-f §[0-9]'
);

-- 2) Drop the stray AML § 3-4 from tjenestepensjon (OTP-loven covers it).
update public.document_system_templates
set legal_basis = array_remove(legal_basis, 'AML § 3-4')
where slug = 'tpl-tjenestepensjon-info'
  and 'AML § 3-4' = any(legal_basis);

-- 3) Backfill AML § 13 family on tpl-aktivitetsplikt so the dashboard's
--    AML § 13-X drilldowns include this template alongside the Ldl refs.
update public.document_system_templates
set legal_basis = (
  select array(
    select distinct unnest(
      legal_basis || array['AML § 13-1', 'AML § 13-2', 'AML § 13-7']::text[]
    )
  )
)
where slug = 'tpl-aktivitetsplikt';

-- 4) Same format normalisation on per-page wiki_pages.legal_refs so the
--    drilldown groups org-created pages alongside the templates they reference.
update public.wiki_pages
set legal_refs = (
  select array_agg(
    case
      when ref ~ '^AML §[0-9]' then regexp_replace(ref, '^AML §([0-9])', 'AML § \1')
      when ref ~ '^IK-f §[0-9]' then regexp_replace(ref, '^IK-f §([0-9])', 'IK-f § \1')
      else ref
    end
  )
  from unnest(legal_refs) as t(ref)
)
where exists (
  select 1 from unnest(legal_refs) as t(ref)
  where ref ~ '^AML §[0-9]' or ref ~ '^IK-f §[0-9]'
);

commit;

-- Verification queries (manual; comment out before applying in CI):
-- select slug, legal_basis from public.document_system_templates where slug in
--   ('tpl-verneombud','tpl-verneombud-mandat','tpl-avvik','tpl-risikovurdering',
--    'tpl-sysdok-avvik','tpl-tilrettelegging','tpl-seniorpolitikk',
--    'tpl-tjenestepensjon-info','tpl-aktivitetsplikt') order by slug;
