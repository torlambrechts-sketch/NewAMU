-- B-2 fix: rule `aml-5-2-politi-parallel` referenced a non-existent column.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 5-2 første ledd — varsling av nærmeste
--   politimyndighet ved alvorlig personskade. Regelen seedet i _122100
--   matchet `payload.category = 'alvorlig_personskade'`, men
--   inspection_findings har ingen `category`-kolonne, og emitteren bygger
--   payloaden via `to_jsonb(NEW)`. Resultat: regelen fyrte aldri og
--   politi-leg-varselet kom aldri ut. Vi flytter matching til `severity =
--   'critical'` som faktisk finnes på inspection_findings.
--   Restrisiko deferred: vi mister evnen til å skille «alvorlig
--   personskade» fra andre «critical»-funn. Hvis Arbeidstilsynets
--   rapporteringstaksonomi krever finere granularitet skal en oppfølger
--   legge til inspection_findings.category + en kategorisert backfill.

update public.workflow_system_rules
   set condition_json = '{"match":"field_equals","path":"severity","value":"critical"}'::jsonb,
       updated_at = now()
 where slug = 'aml-5-2-politi-parallel';

-- Audit-spor i notes-feltet: en fremtidig sprint kan trygt strenge
-- betingelsen ved å sjekke om inspection_findings har fått category-
-- kolonnen og bytte tilbake til en mer presis match.
update public.workflow_system_rules
   set notes = coalesce(notes,'') ||
               E'\n[2026-09-07] B-2 patch: condition path migrated from'
               || ' nonexistent inspection_findings.category to severity=critical.'
               || ' Re-narrow when/if a category column is introduced.',
       updated_at = now()
 where slug = 'aml-5-2-politi-parallel';
