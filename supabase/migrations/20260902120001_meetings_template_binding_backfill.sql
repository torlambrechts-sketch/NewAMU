-- Meetings — backfill dataBinding on 15 binding-eligible system templates.
--
-- Why
--   Companion to 20260902120000_meetings_autofill_agenda.sql. Adds
--   `dataBinding` to agenda items where a module hook can supply data,
--   covering every framework (AML, ISO 9001/14001/45001/27001, GDPR,
--   Hovedavtalen, Likestillingsloven) — not just AMU.
--
--   Once meetings are created from these templates after this migration,
--   `useMeetings.createMeeting` will eagerly resolve every binding into
--   `meeting_agenda_items.binding_snapshot`, surfacing graphical data in
--   the new Datapakke tab + the agenda callout.
--
-- Idempotence
--   Each UPDATE rewrites `definition->'agendaItems'` by merging a
--   `{"dataBinding": ...}` object onto the matching item with the `||`
--   operator. `||` overwrites the dataBinding key on re-run, so the
--   migration converges on the same definition every time.
--
--   Templates already carrying bindings (`amu-arsmote-arsrapport`,
--   `amu-konstitueringsmote`) are NOT touched.
--
-- Compliance posture
--   No data deleted; only definitions enriched. Existing meetings'
--   `definition_snapshot` is frozen and not modified — already-signed
--   protocols remain bit-exact identical.

set local search_path = public, pg_catalog;

-- ─── helper: rewrite a single template's agenda items by key → dataBinding ──
-- Implemented inline per-template via a CTE pattern so we don't have to ship
-- a permanent function for a one-shot data migration.

-- ═════════════════════════════════════════════════════════════════════════
--  AML — Arbeidsmiljøloven
-- ═════════════════════════════════════════════════════════════════════════

-- AMU kvartalsmøte Q1 — operativ HMS-status (vernerunder, sykefravær, opplæring, avvik)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'vernerunder' then item || '{"dataBinding":{"source":"vernerunde_findings","window":"last_quarter","presentation":"summary"}}'::jsonb
      when 'sykefravar'  then item || '{"dataBinding":{"source":"sick_leave_stats","window":"last_quarter","presentation":"table"}}'::jsonb
      when 'opplaering'  then item || '{"dataBinding":{"source":"training_completion","window":"last_quarter","presentation":"summary"}}'::jsonb
      when 'avvik'       then item || '{"dataBinding":{"source":"incidents","window":"last_quarter","presentation":"chart"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q1';

-- AMU kvartalsmøte Q2 — arbeidsmiljøundersøkelse + risikobilde + fysisk miljø
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'arbeidsmiljoundersokelse' then item || '{"dataBinding":{"source":"survey_results","window":"last_half_year","presentation":"summary"}}'::jsonb
      when 'ros'                       then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      when 'fysisk_miljo'              then item || '{"dataBinding":{"source":"vernerunde_findings","window":"last_quarter","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q2';

-- AMU kvartalsmøte Q3 — psykososialt, varsling, mobbing
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'psykososial' then item || '{"dataBinding":{"source":"survey_results","window":"last_half_year","presentation":"summary"}}'::jsonb
      when 'varsling'    then item || '{"dataBinding":{"source":"whistleblowing_anonymized","window":"last_quarter","presentation":"summary"}}'::jsonb
      when 'mobbing'     then item || '{"dataBinding":{"source":"whistleblowing_anonymized","window":"last_quarter","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-kvartalsmote-q3';

-- AMU årsrapport Q4 (legacy v1, still active) — full year aggregates
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'composition'          then item || '{"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'sykefravar_arsstats'  then item || '{"dataBinding":{"source":"sick_leave_stats","window":"last_year","presentation":"table"}}'::jsonb
      when 'hendelser'            then item || '{"dataBinding":{"source":"incidents","window":"last_year","presentation":"chart"}}'::jsonb
      when 'opplaering'           then item || '{"dataBinding":{"source":"training_completion","window":"last_year","presentation":"summary"}}'::jsonb
      when 'arbeidsmiljoplan'     then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'amu-arsrapport-q4';

-- Verneombud-møte — operativ vernerunde + sykefravær + opplæring
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'vernerunder' then item || '{"dataBinding":{"source":"vernerunde_findings","window":"last_quarter","presentation":"summary"}}'::jsonb
      when 'avvik'       then item || '{"dataBinding":{"source":"incidents","window":"last_quarter","presentation":"chart"}}'::jsonb
      when 'opplaering'  then item || '{"dataBinding":{"source":"training_completion","window":"last_quarter","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'verneombud-mote';

-- ═════════════════════════════════════════════════════════════════════════
--  AML — drøfting + medvirkning (Hovedavtalen surface)
-- ═════════════════════════════════════════════════════════════════════════

-- Bedriftsutvalg — drift, organisasjon, medvirkning
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'drift'       then item || '{"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'medvirkning' then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'bedriftsutvalg';

-- Varslingsutvalg — anonymisert oversikt + oppfølging
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'sak'      then item || '{"dataBinding":{"source":"whistleblowing_anonymized","window":"last_quarter","presentation":"summary"}}'::jsonb
      when 'oversikt' then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'varslingsutvalg';

-- Drøftingsmøte — omstilling
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'konsekvenser' then item || '{"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'synspunkter'  then item || '{"dataBinding":{"source":"survey_results","window":"last_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'drofting-omstilling';

-- Drøftingsmøte — likestilling (Likestillingsloven § 26 surface)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'kjonnsbalanse'  then item || '{"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}}'::jsonb
      when 'diskriminering' then item || '{"dataBinding":{"source":"survey_results","window":"last_half_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'drofting-likestilling';

-- ═════════════════════════════════════════════════════════════════════════
--  ISO Styringssystem
-- ═════════════════════════════════════════════════════════════════════════

-- ISO 9001 — Ledelsens gjennomgang
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'            then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      when 'audit_results'           then item || '{"dataBinding":{"source":"compliance_checklist_status","window":"last_year","presentation":"summary"}}'::jsonb
      when 'nonconformities'         then item || '{"dataBinding":{"source":"incidents","window":"last_year","presentation":"chart"}}'::jsonb
      when 'risk_opportunity_actions' then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      when 'performance'             then item || '{"dataBinding":{"source":"training_completion","window":"last_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang';

-- ISO 27001 — ISMS-gjennomgang (sub-letter restructure reviewer-gated per H0 log)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'    then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      when 'incidents'       then item || '{"dataBinding":{"source":"incidents","window":"last_year","presentation":"chart"}}'::jsonb
      when 'risk_assessment' then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      when 'controls'        then item || '{"dataBinding":{"source":"compliance_checklist_status","window":"last_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-27001-isms-gjennomgang';

-- ISO 45001 — Ledelsens gjennomgang (HMS-tung — bredeste bindings-sett)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions'      then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      when 'performance'       then item || '{"dataBinding":{"source":"training_completion","window":"last_year","presentation":"summary"}}'::jsonb
      when 'risks'             then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      when 'oh_incidents'      then item || '{"dataBinding":{"source":"incidents","window":"last_year","presentation":"chart"}}'::jsonb
      when 'oh_compliance_eval' then item || '{"dataBinding":{"source":"compliance_checklist_status","window":"last_year","presentation":"summary"}}'::jsonb
      when 'oh_audit_results'  then item || '{"dataBinding":{"source":"vernerunde_findings","window":"last_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang';

-- ISO 14001 — Miljøgjennomgang (miljø-spesifikke målinger forblir manuelle)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'prev_actions' then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      when 'compliance'   then item || '{"dataBinding":{"source":"compliance_checklist_status","window":"last_year","presentation":"summary"}}'::jsonb
      when 'incidents'    then item || '{"dataBinding":{"source":"incidents","window":"last_year","presentation":"chart"}}'::jsonb
      when 'env_audits'   then item || '{"dataBinding":{"source":"compliance_checklist_status","window":"last_year","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'iso-14001-miljogjennomgang';

-- ═════════════════════════════════════════════════════════════════════════
--  GDPR (Personvern)
-- ═════════════════════════════════════════════════════════════════════════

-- GDPR DPIA-gjennomgang — risiko + beslutning
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'risks'    then item || '{"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}}'::jsonb
      when 'decision' then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'gdpr-dpia-gjennomgang';

-- GDPR ROPA-årsgjennomgang — beslutninger fra forrige år (artikkel-30 stats manuelle)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}', (
  select jsonb_agg(
    case item->>'key'
      when 'decisions' then item || '{"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}}'::jsonb
      else item
    end
  )
  from jsonb_array_elements(definition->'agendaItems') item
)),
updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang';

-- ─── Verification ────────────────────────────────────────────────────────
-- select id,
--   (select count(*) from jsonb_array_elements(definition->'agendaItems') i where i ? 'dataBinding') as bindings,
--   jsonb_array_length(definition->'agendaItems') as total_items
-- from public.meeting_system_templates
-- where is_active
-- order by id;
--
-- Expected: 15 templates touched here gain bindings on 2-6 items each.
-- amu-arsmote-arsrapport and amu-konstitueringsmote already had bindings.
-- mus, allmote, personalmote remain 0 bindings (correct — no module data).
