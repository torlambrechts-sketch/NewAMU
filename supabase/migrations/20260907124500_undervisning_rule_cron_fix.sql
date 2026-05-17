-- Fix-up: undervisning.skolestart_hms_runde missing schedule_cron.
--
-- _123100 (sector pack undervisning) declared the rule with
-- trigger_type='schedule' but no schedule_cron value. The cron-dispatch
-- tick (_120500_workflow_cron_system_rules + _121400) filters
-- `schedule_cron is not null` so the rule never fires.
--
-- Intent: 15. august kl. 09:00 årlig — verneunde med fokus på elevenes
-- skolemiljø før første skoledag (rationale-tekst i seed-en).
--
-- Arbeidstilsynet/Statsforvalter self-audit:
--   Pålegg-grunner addressed: Opplæringsloven § 9 A-2 (sikkert og helsefremmende
--   miljø ved skolestart), AML § 4-1 (forsvarlig arbeidsmiljø ved arbeids-
--   plassen "skole"). En regel som er deklarert men aldri fyrer er
--   verre enn ingen regel — ingen audit-trail viser at internkontroll-
--   systemet skulle ha hatt en kontroll.
--   Restrisiko deferred: cron-uttrykket bruker server-UTC; 09:00 lokal
--   tid kan slå inn på 08:00 UTC i sommertid. Akseptert som v0 — kommer
--   med pg_cron timezone-helper i en separat migrasjon.

set local search_path = public, pg_catalog;

do $$
declare
  v_target_tbl text;
begin
  -- Determine which catalog table holds the rule. Both schemas have
  -- `slug text` and `schedule_cron text` so the update is identical.
  if exists (
    select 1 from public.workflow_system_rules
     where slug = 'undervisning.skolestart_hms_runde'
        or slug = 'undervisning-skolestart-hms-runde'
  ) then
    v_target_tbl := 'workflow_system_rules';
  elsif exists (
    select 1 from public.workflow_rule_catalog
     where slug = 'undervisning.skolestart_hms_runde'
        or slug = 'undervisning-skolestart-hms-runde'
  ) then
    v_target_tbl := 'workflow_rule_catalog';
  else
    raise notice 'undervisning_rule_cron_fix: slug not found in workflow_system_rules nor workflow_rule_catalog — nothing to fix';
    return;
  end if;

  if v_target_tbl = 'workflow_system_rules' then
    update public.workflow_system_rules
       set schedule_cron = '0 9 15 8 *',
           updated_at    = now()
     where slug in ('undervisning.skolestart_hms_runde',
                    'undervisning-skolestart-hms-runde')
       and (schedule_cron is null or schedule_cron = '');
  else
    update public.workflow_rule_catalog
       set schedule_cron = '0 9 15 8 *',
           updated_at    = now()
     where slug in ('undervisning.skolestart_hms_runde',
                    'undervisning-skolestart-hms-runde')
       and (schedule_cron is null or schedule_cron = '');
  end if;

  raise notice 'undervisning_rule_cron_fix: set schedule_cron=0 9 15 8 * on %', v_target_tbl;
end$$;
