-- Meetings — template enrichment (default durations + allmote/personalmote bindings).
--
-- Why
--   Companion to the auto-fill agenda PR. Two enhancements that round out
--   what the new structure unlocks for every template:
--
--     1. Per-item `defaultDurationMinutes` on every active template. Copied
--        into `meeting_agenda_items.duration_minutes` at meeting creation —
--        the chair sees a sensible time budget from day 1 instead of empty
--        cells. Easily overridden per-meeting via the agenda builder.
--
--     2. Two more templates gain bindings where module data adds value:
--        - `allmote` `hms` item → `headcount_and_amu_composition/current`
--        - `personalmote` `hms` item → `headcount_and_amu_composition/current`
--        MUS stays bindings-free (1:1 personnel reviews don't review
--        aggregate org data).
--
-- Compliance posture
--   No data deleted; only definitions enriched. Existing meetings'
--   `definition_snapshot` is frozen and not modified — already-signed
--   protocols remain bit-exact identical. New meetings inherit the
--   enriched definitions via the normal snapshot path.
--
-- Idempotence
--   Each UPDATE rewrites `definition->'agendaItems'` by merging a
--   `{"defaultDurationMinutes": N}` object onto matching items with `||`.
--   `||` overwrites the key on re-run, so the migration converges.

set local search_path = public, pg_catalog;

-- ─── duration-only updates (no new bindings) ──────────────────────────────

-- Helper: each UPDATE is "rewrite agendaItems with case key when ... merge".
-- Per-key durations chosen by Norwegian governance convention:
--   approval / godkjenning   → 5 min
--   eventuelt / sporsmal     → 5 min
--   info / context / strategi → 10 min
--   HMS data review items     → 10-15 min
--   substantive § 9.3 items   → 15-20 min
--   1:1 MUS-style items       → 15-20 min (intimate, longer)

-- ═════════════════════════════════════════════════════════════════════════
--  AML — AMU kvartalsmøter + årsrapport + verneombud
-- ═════════════════════════════════════════════════════════════════════════

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'   then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'vernerunder' then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'sykefravar'  then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'opplaering'  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'avvik'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'major_plans_at_samtykke' then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'eventuelt'   then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q1';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'                then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'arbeidsmiljoundersokelse' then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'ros'                     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'fysisk_miljo'            then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'eventuelt'               then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q2';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'    then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'psykososial' then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'varsling'    then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'mobbing'     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'eventuelt'   then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q3';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'                then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'composition'             then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'arsrapport'              then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'sykefravar_arsstats'     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'hendelser'               then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'opplaering'              then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'arbeidsmiljoplan'        then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'evaluation'              then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'bht_annual_status'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'arbeidstidsordninger_annual' then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'distribution_to_organisations' then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'eventuelt'               then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-arsrapport-q4';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'                  then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'amu_composition'           then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'bht_status'                then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'training_plan'             then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'major_plans_samtykke'      then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'other_plans'               then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'hms_system'                then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'working_hours'             then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'sick_leave_year'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'incidents_year'            then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'ros_year'                  then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'vernerunder_year'          then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'whistleblowing_overview'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'annual_report_vote'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'annual_report_distribution' then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'next_year_plan_vote'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'evaluation'                then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'eventuelt'                 then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-arsmote-arsrapport';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'           then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'composition_verify' then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'chair_election'     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'secretary_role'     then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'function_period'    then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'training_plan'      then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'meeting_calendar'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'handover'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'contact_routines'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'eventuelt'          then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-konstitueringsmote';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'    then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'vernerunder' then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'avvik'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'opplaering'  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'saker_amu'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'eventuelt'   then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'verneombud-mote';

-- ═════════════════════════════════════════════════════════════════════════
--  AML — drøfting + medvirkning (Hovedavtalen + Likestillingsloven)
-- ═════════════════════════════════════════════════════════════════════════

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'      then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'drift'         then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'okonomi'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'organisasjon'  then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'medvirkning'   then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'eventuelt'     then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'bedriftsutvalg';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval' then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'sak'      then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'tiltak'   then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oversikt' then item || '{"defaultDurationMinutes":10}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'varslingsutvalg';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'begrunnelse'           then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'alternativer'          then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'konsekvenser'          then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'synspunkter'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oppfolging'            then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'org_informasjon'       then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'masseoppsigelse_nav'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'individuell_droftelse' then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'drofting-omstilling';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'approval'         then item || '{"defaultDurationMinutes":5}'::jsonb
      when 'lonnskartlegging' then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'kjonnsbalanse'    then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'tilrettelegging'  then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'diskriminering'   then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'redegjorelse'     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'ufrivillig_deltid' then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'drofting-likestilling';

-- ═════════════════════════════════════════════════════════════════════════
--  ISO Styringssystem (9.3 management reviews — substantive)
-- ═════════════════════════════════════════════════════════════════════════

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'             then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'context'                  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'performance'              then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'customer'                 then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'quality_objectives'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'audit_results'            then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'resources'                then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'opportunities'            then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decisions'                then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'process_performance'      then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'nonconformities'          then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'monitoring_measurement'   then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'external_providers'       then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'risk_opportunity_actions' then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'    then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'context'         then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'info_security'   then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'incidents'       then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'risk_assessment' then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'controls'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'resources'       then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decisions'       then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-27001-isms-gjennomgang';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'context'             then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'policy'              then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'performance'         then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'consultation'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'risks'               then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'resources'           then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decisions'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oh_incidents'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oh_monitoring'       then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'oh_compliance_eval'  then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oh_audit_results'    then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'oh_communications'   then item || '{"defaultDurationMinutes":10}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'        then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'context'             then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'performance'         then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'compliance'          then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'incidents'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'resources'           then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decisions'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'env_audits'          then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'env_monitoring'      then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'env_communications'  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'env_improvement'     then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-14001-miljogjennomgang';

-- ═════════════════════════════════════════════════════════════════════════
--  GDPR
-- ═════════════════════════════════════════════════════════════════════════

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'purpose'             then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'necessity'           then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'risks'               then item || '{"defaultDurationMinutes":20}'::jsonb
      when 'measures'            then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'residual'            then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decision'            then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'dpo_advice'          then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'data_subject_views'  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'code_of_conduct'     then item || '{"defaultDurationMinutes":5}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'gdpr-dpia-gjennomgang';

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'new_activities'     then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'updated_activities' then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'retention'          then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'processors'         then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'transfers'          then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'decisions'          then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'data_categories'    then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'joint_controllers'  then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'security_measures'  then item || '{"defaultDurationMinutes":15}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang';

-- ═════════════════════════════════════════════════════════════════════════
--  Personalsamtaler + allmøte — add headcount binding to hms, plus durations
-- ═════════════════════════════════════════════════════════════════════════

-- Allmøte gains `headcount_and_amu_composition` on the hms item so the chair
-- can show real numbers at the all-hands instead of paraphrasing.
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'strategi' then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'drift'    then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'hms'      then item || '{"defaultDurationMinutes":15,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'sporsmal' then item || '{"defaultDurationMinutes":10}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'allmote';

-- Personalmøte (smaller dept-level all-hands) — same treatment on hms.
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'info'     then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'hms'      then item || '{"defaultDurationMinutes":15,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'sporsmal' then item || '{"defaultDurationMinutes":10}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'personalmote';

-- MUS stays bindings-free (1:1 personnel reviews don't review aggregate
-- module data) — but the items still get sensible durations.
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'trivsel'   then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'mal'       then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'utvikling' then item || '{"defaultDurationMinutes":15}'::jsonb
      when 'hms'       then item || '{"defaultDurationMinutes":10}'::jsonb
      when 'varsling'  then item || '{"defaultDurationMinutes":10}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'mus';

-- ─── Verification ────────────────────────────────────────────────────────
-- Expected: every active template has 1+ item with defaultDurationMinutes
-- after this migration. allmote + personalmote each gain a binding (so
-- their binding-count goes from 0 to 1).
--
-- select id,
--   (select count(*) from jsonb_array_elements(definition->'agendaItems') i
--      where i ? 'defaultDurationMinutes') as items_with_duration,
--   (select count(*) from jsonb_array_elements(definition->'agendaItems') i
--      where i ? 'dataBinding') as bindings,
--   jsonb_array_length(definition->'agendaItems') as total
-- from public.meeting_system_templates
-- where is_active
-- order by id;
