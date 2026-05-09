-- Workflow template catalog + 8 AML system templates
-- Introduces: workflow_template_catalog — system-level workflow blueprints that
-- admins can instantiate for their org with one click ("Bruk denne malen").
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 (2) e, IK § 5 nr. 6–7 — readymade
--   workflows covering mandatory follow-up chains (avvik, SJA, IA-plan,
--   AMU, sertifikat) eliminate the most common audit finding: "no documented
--   procedure for following up critical incidents."
--   Restrisiko deferred: per-template customisation UI (v1.1 roadmap).

create table if not exists public.workflow_template_catalog (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  description         text not null default '',
  source_module       text not null,
  trigger_event_name  text not null,
  condition_json      jsonb not null default '{"match":"always"}'::jsonb,
  actions_json        jsonb not null default '[]'::jsonb,
  law_refs            text[] not null default '{}',
  category            text not null default 'hms',
  is_system           boolean not null default true,
  created_at          timestamptz not null default now()
);

comment on column public.workflow_template_catalog.condition_json is
  'WorkflowCondition — same shape as workflow_rules.condition_json';
comment on column public.workflow_template_catalog.actions_json is
  'WorkflowAction[] — same shape as workflow_rules.actions_json';

-- ── 8 AML system templates ────────────────────────────────────────────────────

insert into public.workflow_template_catalog
  (slug, name, description, source_module, trigger_event_name, condition_json, actions_json, law_refs, category)
values

-- 1. Kritisk avvik → AMU + ROS
(
  'kritisk-avvik-amu-ros',
  'Kritisk avvik → AMU + ROS-utkast',
  'Klassifiseres et avvik som kritisk, varsles AMU-leder via e-post, opprettes ROS-utkast og tildeles verneombud.',
  'hse',
  'ON_AVVIK_CREATED',
  '{"match":"field_equals","field":"severity","value":"kritisk"}'::jsonb,
  '[
    {"type":"send_email","to":"amu-leder","subject":"Kritisk avvik registrert","template":"kritisk-avvik.eml"},
    {"type":"create_ros_draft","template":"standard 5×5","linkSource":true},
    {"type":"create_task_item","pack":"hms","sourceCategory":"avvik","pdcaPhase":"do","title":"Tildel verneombud for avviket","priority":"high","dueInDays":1}
  ]'::jsonb,
  ARRAY['AML § 3-1 (2) e','IK-f § 5 nr. 7'],
  'hms'
),

-- 2. Avvik forfalt → purr ansvarlig
(
  'avvik-forfalt-purr',
  'Avvik forfalt → purr ansvarlig',
  'Sender påminnelse på e-post og push-varsel til ansvarlig når avvik ikke er lukket innen fristen.',
  'hse',
  'ON_AVVIK_OVERDUE',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"send_notification","audience":"assignee","title":"Avvik forfalt","body":"Du har et avvik som ikke er lukket innen fristen."},
    {"type":"send_email","to":"assignee","subject":"Påminnelse: avvik forfalt","template":"avvik-purr.eml"}
  ]'::jsonb,
  ARRAY['AML § 3-1 (2) e'],
  'hms'
),

-- 3. ROS skår ≥ 12 → tiltaksprosjekt
(
  'ros-hoey-risiko-tiltak',
  'ROS skår ≥ 12 → tiltaksprosjekt',
  'Overstiger risikoskåren 12 i en ROS-analyse, opprettes et PDCA-tiltaksprosjekt automatisk.',
  'internal_control',
  'ON_ROS_SCORE_HIGH',
  '{"match":"field_equals","field":"risk_score_gte","value":"12"}'::jsonb,
  '[
    {"type":"create_task_item","pack":"hms","sourceCategory":"ros","pdcaPhase":"plan","title":"PDCA-tiltaksprosjekt for høy-risiko ROS","priority":"high","dueInDays":14}
  ]'::jsonb,
  ARRAY['IK-f § 5 nr. 6','ISO 45001 · 6.1.2'],
  'ros'
),

-- 4. Funn vernerunde → oppgave
(
  'vernerunde-funn-oppgave',
  'Funn vernerunde → oppgave til leder',
  'Registreres et funn under en vernerunde, opprettes en oppgave til linjeleder med 7 dagers frist.',
  'hse',
  'ON_FINDING_REGISTERED',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task_item","pack":"hms","sourceCategory":"vernerunde","pdcaPhase":"do","title":"Behandle funn fra vernerunde","priority":"medium","dueInDays":7}
  ]'::jsonb,
  ARRAY['AML § 3-1 (2) e','AML § 6-2'],
  'hms'
),

-- 5. 4 uker sykmeldt → §4-6 plan
(
  'sykefravær-4uker-ia-plan',
  '4 uker sykmeldt → §4-6 oppfølgingsplan',
  'Registreres 4 uker sammenhengende sykefravær, opprettes automatisk en oppgave for oppfølgingsplan etter AML § 4-6.',
  'hse',
  'ON_SICKNESS_4WEEKS',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task_item","pack":"hms","sourceCategory":"sykefravær","pdcaPhase":"plan","title":"Utarbeid §4-6 oppfølgingsplan","priority":"high","dueInDays":3},
    {"type":"send_email","to":"hr","subject":"§4-6 oppfølgingsplan skal utarbeides","template":"ia-plan-påminnelse.eml"}
  ]'::jsonb,
  ARRAY['AML § 4-6'],
  'ia'
),

-- 6. Lav score arbeidsmiljøundersøkelse → AMU-sak
(
  'survey-lav-score-amu',
  'Lav score arbeidsmiljø → AMU-sak',
  'Skårer en arbeidsmiljøundersøkelse under 3,0, legges saken automatisk på neste AMU-dagsorden.',
  'org_health',
  'ON_SURVEY_COMPLETED',
  '{"match":"field_equals","field":"average_score_lt","value":"3.0"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"Gjennomgang av arbeidsmiljøundersøkelse — lav skår","priority":"høy"}
  ]'::jsonb,
  ARRAY['AML § 4-2','AML § 7-2 (2) b'],
  'amu'
),

-- 7. Sertifikat utløper → påmeld kurs
(
  'sertifikat-utloper-kurs',
  'Sertifikat utløper → meld på kurs',
  'Utløper et kursbevis innen 30 dager, opprettes en oppgave om å melde den ansatte på fornyelseskurs.',
  'learning',
  'ON_CERTIFICATE_ISSUED',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task_item","pack":"hms","sourceCategory":"opplaering","pdcaPhase":"do","title":"Meld ansatt på fornyelseskurs","priority":"medium","dueInDays":21}
  ]'::jsonb,
  ARRAY['AML § 3-4','AML § 3-5'],
  'opplæring'
),

-- 8. Oppgave forfalt → eskalering til leder
(
  'oppgave-forfalt-eskalering',
  'Oppgave forfalt → eskalering til leder',
  'Er en oppgave ikke fullført innen fristen, varsles linjeleder og oppgaven markeres som eskalert.',
  'tasks',
  'ON_TASK_OVERDUE_MARKED',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"send_notification","audience":"leder","title":"Oppgave forfalt","body":"En oppgave har passert fristen uten å bli fullført."},
    {"type":"send_email","to":"leder","subject":"Eskalering: oppgave forfalt","template":"oppgave-eskalering.eml"}
  ]'::jsonb,
  ARRAY['AML § 3-1 (2) e'],
  'oppgaver'
)

on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  source_module      = excluded.source_module,
  trigger_event_name = excluded.trigger_event_name,
  condition_json     = excluded.condition_json,
  actions_json       = excluded.actions_json,
  law_refs           = excluded.law_refs,
  category           = excluded.category;
