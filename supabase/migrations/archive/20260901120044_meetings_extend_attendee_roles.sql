-- Meetings — extend meeting_attendees.role enum (H4).
--
-- Why
--   The H0 verification log noted that AML repeatedly references
--   `tillitsvalgte` (chapter 8, 15) and `hovedverneombud` (§ 6-1 fjerde
--   ledd) as distinct roles. The current CHECK constraint on
--   meeting_attendees.role only allows the generic `employee_rep` /
--   `verneombud` values, conflating these legally-distinct roles.
--
--   Drofting templates (per H2) and Q4 årsmøte (per H10) need
--   `tillitsvalgt` as a named role; large-org AMU + verneombud-møter
--   need `hovedverneombud` as a named role.
--
-- Strategy
--   Drop the inline CHECK constraint (auto-named
--   meeting_attendees_role_check) and add a new one with the extended
--   set. Existing rows are unaffected — every existing value still
--   passes.
--
-- Self-audit
--   * The TS PermissionKey union added equivalents in types.ts in the
--     same PR; together the DB + TS surfaces accept the new roles.
--   * No data migration needed — old enum values remain valid; new
--     ones are additive.

set local search_path = public, pg_catalog;

alter table public.meeting_attendees
  drop constraint if exists meeting_attendees_role_check;

alter table public.meeting_attendees
  add constraint meeting_attendees_role_check
  check (role in (
    'chair',
    'secretary',
    'member',
    'observer',
    'guest',
    'verneombud',
    'hovedverneombud',
    'employer_rep',
    'employee_rep',
    'tillitsvalgt'
  ));

-- Verification:
-- expected: constraint exists with the new value list
-- select pg_get_constraintdef(oid)
-- from pg_constraint
-- where conname = 'meeting_attendees_role_check';
