-- Bump verneombud-mote cadence from quarterly to monthly per Arbeidstilsynets
-- veileder. Compliance review flagged the quarterly hint as too lax for
-- regular dialogue between verneombud and HMS-leder.
--
-- Self-audit: AML § 6-2 doesn't specify a cadence, but Arbeidstilsynets
-- "Veileder om verneombud" recommends månedlige kontaktmøter. Conservative
-- bump — orgs can still hold them quarterly without violating the law,
-- but the cadence-warning panel will now flag the gap correctly.

set local search_path = public, pg_catalog;

update public.meeting_system_templates
   set cadence_hint = 'monthly',
       updated_at = now()
 where id = 'verneombud-mote'
   and cadence_hint <> 'monthly';
