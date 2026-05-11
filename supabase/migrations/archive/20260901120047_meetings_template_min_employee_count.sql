-- Meetings — minimum_employee_count template-level field (H8).
--
-- Why
--   Several lov-grunnede meeting types only kick in above an employee-
--   count threshold:
--    * AML § 7-1 (post-2024 lov 17 mars 2023 nr. 3): AMU mandatory at
--      30+ ansatte. Verified live on lovdata in H0.
--    * Hovedavtalen LO-NHO § 9-3: bedriftsutvalg at 100+ ansatte.
--      Marked 🟡 in H0 — training-knowledge only, paywall blocked
--      WebFetch. Apply tentatively; reviewer task remains open.
--   Surfacing the threshold lets new orgs see at a glance whether a
--   given template applies to them.
--
-- Strategy
--   Additive integer column on both meeting_system_templates and
--   meeting_org_templates. null = no threshold; integer = required
--   minimum headcount. UI reads org.members.length and shows a
--   warning badge on tiles where below threshold.

set local search_path = public, pg_catalog;

alter table public.meeting_system_templates
  add column if not exists minimum_employee_count integer;

alter table public.meeting_org_templates
  add column if not exists minimum_employee_count integer;

comment on column public.meeting_system_templates.minimum_employee_count is
  'Minimum employee count for this meeting type to be lov-mandated. '
  'null = no threshold (e.g. internal/ISO templates). UI surfaces a warning '
  'badge when current org headcount falls below this number.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Backfill — known thresholds                                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- AMU cycle (mandatory at 30+ per AML § 7-1, post-2024-01-01).
update public.meeting_system_templates
set minimum_employee_count = 30,
    updated_at = now()
where id in (
        'amu-kvartalsmote-q1',
        'amu-kvartalsmote-q2',
        'amu-kvartalsmote-q3',
        'amu-arsrapport-q4'
      )
  and minimum_employee_count is distinct from 30;

-- Bedriftsutvalg (Hovedavtalen § 9-3 — 100+ ansatte per training-knowledge,
-- H0 yellow-flagged; reviewer to confirm).
update public.meeting_system_templates
set minimum_employee_count = 100,
    updated_at = now()
where id = 'bedriftsutvalg'
  and minimum_employee_count is distinct from 100;

-- Likestillingsloven § 26a — lønnskartlegging at 50+ private + on-request
-- 20-50. Surface 50 as the threshold; the «20-50 etter forespørsel»
-- nuance lives in the description text.
update public.meeting_system_templates
set minimum_employee_count = 50,
    updated_at = now()
where id = 'drofting-likestilling'
  and minimum_employee_count is distinct from 50;

-- Verification:
-- expected: 4 AMU rows = 30; bedriftsutvalg = 100; drofting-likestilling = 50
-- select id, minimum_employee_count
-- from public.meeting_system_templates
-- where minimum_employee_count is not null
-- order by minimum_employee_count desc;
