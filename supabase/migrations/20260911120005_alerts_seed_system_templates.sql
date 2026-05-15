-- Alerts module — seed 19 system templates per spec §5.1–5.3.
--
-- 8 AML kap. 2A varslinger (incl. aml-varsel-mot-leder escape-hatch per § 2A-2 (3))
-- 6 GDPR brudd-templates (incl. gdpr-brudd-lavrisiko per Art. 33 (1) no-notification path)
-- 5 HMS / sikkerhet / etisk
--
-- Self-audit (compliance officer POV):
--   * Every template's law_refs[] array uses the canonical paragraph format
--     ('AML § 2A-1', 'GDPR Art. 33', 'Likestillings- og diskriminerings-
--     loven § 26'). The drill-down + planner do exact-string matching.
--   * Likestillingsloven (outdated since 2017) NOT used — Likestillings- og
--     diskrimineringsloven everywhere.
--   * acknowledgement_due_days interpreted as BUSINESS days via the
--     add_business_days helper (20260911120003).
--   * AML retention = 5 years (org policy, no statutory floor).
--     GDPR retention = 5 years (Art. 33 (5) dokumentasjonsplikt).
--     HMS retention = 5 years (generic floor; kjemikalie-eksponering 30y
--     via override per Forskrift om utførelse av arbeid kap. 31).
--   * default_confidentiality_level = 'restricted' for all templates by
--     default; ethical_concern + hms_avvik default to 'standard'.
--
-- Idempotent via primary-key conflict do update — re-running this migration
-- refreshes template definitions to match the spec.

set local search_path = public, pg_catalog;

-- ── 1. AML kap. 2A — Varsling (8 templates) ────────────────────────────────

insert into public.alert_system_templates
  (id, slug, label, description, kind, frameworks, law_refs,
   default_category_slug, default_confidentiality_level, default_retention_years,
   acknowledgement_due_days, investigation_due_days, requires_dpo, allows_anonymous,
   definition, metadata_schema, sort_order)
values
(
  'aml-varsel-generell',
  'aml-varsel-generell',
  'Varsel — generelt kritikkverdig forhold',
  'Varsel etter Arbeidsmiljøloven kap. 2A. Bruk dette skjemaet når forholdet ikke faller inn under en av de mer spesifikke kategoriene (trakassering, korrupsjon, HMS-fare osv.).',
  'whistleblowing',
  array['AML kap. 2A'],
  array['AML § 2A-1','AML § 2A-2','AML § 2A-3','AML § 2A-4','AML § 2A-7'],
  'aml-varsling','restricted',5,
  5, 42, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Du kan varsle anonymt. Etter innsending får du en saksnøkkel — oppbevar den trygt. Du kan også varsle eksternt til Arbeidstilsynet, Økokrim eller advokat (AML § 2A-2 (3)). Unngå å nevne navn på enkeltpersoner med mindre det er nødvendig.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv forholdet','kind','longtext','required',true,'piiHint','medium',
        'helpText','Hva har skjedd? Hvilke regler eller etiske normer mener du er brutt?'),
      jsonb_build_object('key','who_what_where','label','Hvem, hva, hvor','kind','longtext','required',false,'piiHint','high',
        'helpText','Vi anbefaler å unngå navn på enkeltpersoner her med mindre absolutt nødvendig.'),
      jsonb_build_object('key','occurred_at_text','label','Når skjedde det','kind','text','required',false,'piiHint','low',
        'helpText','«Forrige uke», «25. mars 2026», eller «pågående» — fri tekst.')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak til varsleren innen 5 virkedager','isMandatory',true,'lawRef','AML § 2A-3'),
      jsonb_build_object('key','triage','label','Klassifiser saken — internt eller eksternt','isMandatory',true),
      jsonb_build_object('key','noi','label','Vurder taushetsplikt og habilitet','isMandatory',true,'lawRef','AML § 2A-7 (5)'),
      jsonb_build_object('key','plan','label','Lag en undersøkelsesplan','isMandatory',true),
      jsonb_build_object('key','protect','label','Sett tiltak mot gjengjeldelse hvis varsleren er kjent','isMandatory',true,'lawRef','AML § 2A-4')
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',120),
      jsonb_build_object('status','triage','slaHours',336),
      jsonb_build_object('status','investigation','slaHours',1008),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'escalation', jsonb_build_object(
      'onAcknowledgementOverdue', jsonb_build_object('action','notify_committee'),
      'onInvestigationOverdue', jsonb_build_object('action','notify_management')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4','AML § 2A-5'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',false),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  10
),
(
  'aml-varsel-trakassering',
  'aml-varsel-trakassering',
  'Varsel — trakassering eller mobbing',
  'Varsel om trakassering, mobbing eller utilbørlig opptreden i strid med arbeidsmiljølovens krav til psykososialt arbeidsmiljø.',
  'whistleblowing',
  array['AML kap. 2A','Likestillings- og diskrimineringsloven'],
  array['AML § 4-3','AML § 2A-1','Likestillings- og diskrimineringsloven § 13'],
  'aml-varsling','restricted',5,
  5, 42, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Alle ansatte har rett til et arbeidsmiljø fritt for trakassering. Du kan varsle anonymt. Hvis du opplever fysisk fare eller seksuell trakassering, ta kontakt direkte med leder eller verneombud i tillegg til dette varselet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv hendelsen(e)','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','who_what_where','label','Hvor og når','kind','longtext','required',false,'piiHint','high'),
      jsonb_build_object('key','occurred_at_text','label','Periode','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 5 virkedager','isMandatory',true,'lawRef','AML § 2A-3'),
      jsonb_build_object('key','triage','label','Vurder midlertidige tiltak (omplassering, fjernarbeid)','isMandatory',true),
      jsonb_build_object('key','document','label','Dokumenter samtaler nøytralt — ord-mot-ord-saker','isMandatory',true),
      jsonb_build_object('key','protect','label','Tiltak mot gjengjeldelse','isMandatory',true,'lawRef','AML § 2A-4')
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',120),
      jsonb_build_object('status','triage'),
      jsonb_build_object('status','investigation','slaHours',1008),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'escalation', jsonb_build_object(
      'onAcknowledgementOverdue', jsonb_build_object('action','notify_committee'),
      'onInvestigationOverdue', jsonb_build_object('action','notify_management')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',false),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  20
),
(
  'aml-varsel-seksuell-trakassering',
  'aml-varsel-seksuell-trakassering',
  'Varsel — seksuell trakassering',
  'Varsel om seksuell trakassering. Arbeidsgiver har særlig forebyggings- og handlingsplikt etter likestillings- og diskrimineringsloven.',
  'whistleblowing',
  array['AML kap. 2A','Likestillings- og diskrimineringsloven'],
  array['AML § 4-3','Likestillings- og diskrimineringsloven § 13','Likestillings- og diskrimineringsloven § 26'],
  'aml-varsling','confidential',5,
  3, 28, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Du kan varsle anonymt. Arbeidsgiver har plikt til å forebygge og hindre seksuell trakassering, og til å gripe inn raskt når det varsles. Saken behandles med høyeste konfidensialitet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv hendelsen(e)','kind','longtext','required',true,'piiHint','medium')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 3 virkedager','isMandatory',true,'lawRef','AML § 2A-3'),
      jsonb_build_object('key','immediate','label','Iverksett umiddelbare tiltak','isMandatory',true,'lawRef','Likestillings- og diskrimineringsloven § 13'),
      jsonb_build_object('key','separate','label','Sørg for at varsler og innklaget ikke må samhandle','isMandatory',true),
      jsonb_build_object('key','protect','label','Tiltak mot gjengjeldelse','isMandatory',true,'lawRef','AML § 2A-4'),
      jsonb_build_object('key','external','label','Vurder ekstern bistand (psykolog, advokat, bedriftshelsetjeneste)','isMandatory',false)
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',72),
      jsonb_build_object('status','triage'),
      jsonb_build_object('status','investigation','slaHours',672),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'escalation', jsonb_build_object(
      'onAcknowledgementOverdue', jsonb_build_object('action','notify_management'),
      'onInvestigationOverdue', jsonb_build_object('action','notify_management')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4','AML § 2A-5'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  30
),
(
  'aml-varsel-okonomisk-misbruk',
  'aml-varsel-okonomisk-misbruk',
  'Varsel — korrupsjon eller økonomisk misbruk',
  'Varsel om korrupsjon, underslag, bedrageri eller annet økonomisk misbruk.',
  'whistleblowing',
  array['AML kap. 2A','Straffeloven'],
  array['AML § 2A-1 (2)','Straffeloven § 387','Straffeloven § 388','Straffeloven § 389'],
  'aml-varsling','restricted',5,
  5, 56, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Varsel om økonomiske misligheter kan håndteres internt eller meldes til Økokrim. Du kan varsle anonymt. Hvis du mistenker straffbare forhold, vurder å varsle eksternt direkte (AML § 2A-2 (3)).',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv mistanken','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','who_what_where','label','Hvem og hvor','kind','longtext','required',false,'piiHint','high'),
      jsonb_build_object('key','occurred_at_text','label','Periode','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 5 virkedager','isMandatory',true,'lawRef','AML § 2A-3'),
      jsonb_build_object('key','isolate','label','Sikre dokumentasjon mot forspillelse','isMandatory',true),
      jsonb_build_object('key','escalate','label','Vurder om Økokrim eller revisor må kobles inn','isMandatory',true),
      jsonb_build_object('key','protect','label','Tiltak mot gjengjeldelse','isMandatory',true,'lawRef','AML § 2A-4')
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',120),
      jsonb_build_object('status','triage'),
      jsonb_build_object('status','investigation','slaHours',1344),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'escalation', jsonb_build_object(
      'onAcknowledgementOverdue', jsonb_build_object('action','notify_management'),
      'onInvestigationOverdue', jsonb_build_object('action','notify_management')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4','AML § 2A-5'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  40
),
(
  'aml-varsel-hms-fare',
  'aml-varsel-hms-fare',
  'Varsel — fare for liv eller helse (HMS)',
  'Varsel om umiddelbar eller potensiell fare for liv eller helse. For akutt fare, kontakt verneombud direkte og bruk § 6-3 stansingsrett.',
  'whistleblowing',
  array['AML kap. 2A','AML kap. 4','AML kap. 6'],
  array['AML § 2A-1 (2)','AML § 4-1','AML § 6-3'],
  'aml-varsling','restricted',5,
  3, 21, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Ved umiddelbar livsfare: bruk § 6-3 (verneombudets stansingsrett) først. Dette skjemaet brukes for systemfeil, gjentakende farlige forhold, eller mistanke om at tidligere meldte farer ikke er fulgt opp.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv faren','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','who_what_where','label','Hvor — lokasjon, utstyr, prosess','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Når oppstod faren','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 3 virkedager','isMandatory',true),
      jsonb_build_object('key','stop','label','Vurder umiddelbar driftsstans','isMandatory',true,'lawRef','AML § 6-3'),
      jsonb_build_object('key','ros','label','Oppdater ROS-vurdering','isMandatory',true),
      jsonb_build_object('key','vo','label','Involver verneombud','isMandatory',true,'lawRef','AML § 6-2')
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',72),
      jsonb_build_object('status','triage'),
      jsonb_build_object('status','investigation','slaHours',504),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',true,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',true),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  50
),
(
  'aml-varsel-miljo',
  'aml-varsel-miljo',
  'Varsel — miljøkriminalitet',
  'Varsel om miljøkriminalitet eller brudd på forurensningsloven.',
  'whistleblowing',
  array['AML kap. 2A','Forurensningsloven'],
  array['AML § 2A-1 (2)','Forurensningsloven § 78'],
  'aml-varsling','restricted',5,
  5, 56, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Miljøkriminalitet kan meldes eksternt til Miljødirektoratet eller politiet. Du kan varsle anonymt internt via dette skjemaet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv forholdet','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','who_what_where','label','Hvor og hva','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 5 virkedager','isMandatory',true),
      jsonb_build_object('key','contain','label','Iverksett tiltak for å begrense skade','isMandatory',true),
      jsonb_build_object('key','escalate','label','Vurder ekstern melding (Miljødirektoratet, politi)','isMandatory',true,'lawRef','Forurensningsloven § 78')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical']),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',false)
  )),
  60
),
(
  'aml-varsel-gjengjeldelse',
  'aml-varsel-gjengjeldelse',
  'Varsel — gjengjeldelse etter tidligere varsel',
  'Varsel om gjengjeldelse mot deg etter et tidligere varsel. Arbeidsgiver har bevisbyrden for at gjengjeldelse ikke har funnet sted (AML § 2A-4).',
  'whistleblowing',
  array['AML kap. 2A'],
  array['AML § 2A-4','AML § 2A-5'],
  'aml-varsling','confidential',5,
  3, 28, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Gjengjeldelse er forbudt etter AML § 2A-4. Eksempler: endring av arbeidsoppgaver, sosial utfrysing, advarsler, opphør av ansvar, oppsigelse. Bevisbyrden ligger hos arbeidsgiver. Denne saken behandles med høyeste konfidensialitet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv gjengjeldelsen','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når begynte gjengjeldelsen','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 3 virkedager','isMandatory',true),
      jsonb_build_object('key','document','label','Dokumenter den varslede gjengjeldelseshendelsen','isMandatory',true),
      jsonb_build_object('key','reverse','label','Vurder umiddelbar reversering hvis mulig','isMandatory',true,'lawRef','AML § 2A-4'),
      jsonb_build_object('key','external','label','Informer varsler om rett til erstatning','isMandatory',true,'lawRef','AML § 2A-5')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4','AML § 2A-5'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical'])
  )),
  70
),
(
  'aml-varsel-mot-leder',
  'aml-varsel-mot-leder',
  'Varsel — forhold som angår øverste leder eller styret',
  'Varsel når forholdet involverer den normale mottakeren av varsler. Ruter via separat utvalg (alerts.committee_escalated). AML § 2A-2 (3) gir rett til ekstern varsling i slike tilfeller.',
  'whistleblowing',
  array['AML kap. 2A'],
  array['AML § 2A-1','AML § 2A-2 (3)','AML § 2A-7 (5)'],
  'aml-varsling','confidential',5,
  5, 42, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Når forholdet gjelder daglig leder, styreleder eller andre i den normale varslingsmottakskjeden, ruter dette skjemaet saken til et separat utvalg. Du kan også varsle eksternt direkte (AML § 2A-2 (3)) — til Arbeidstilsynet, Økokrim, eller advokat.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv forholdet','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','who_what_where','label','Hvilken funksjon eller rolle gjelder forholdet','kind','longtext','required',true,'piiHint','high'),
      jsonb_build_object('key','occurred_at_text','label','Periode','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','ack','label','Bekreft mottak innen 5 virkedager (varslingsutvalg)','isMandatory',true,'lawRef','AML § 2A-3'),
      jsonb_build_object('key','isolate','label','Den involverte lederen skal ikke ha tilgang til saken','isMandatory',true,'lawRef','AML § 2A-7 (5)'),
      jsonb_build_object('key','external_option','label','Informer varsler om ekstern varslingsrett','isMandatory',true,'lawRef','AML § 2A-2 (3)'),
      jsonb_build_object('key','board','label','Vurder om styret må kobles inn','isMandatory',false),
      jsonb_build_object('key','protect','label','Tiltak mot gjengjeldelse','isMandatory',true,'lawRef','AML § 2A-4')
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true,'lawRefs',array['AML § 2A-4','AML § 2A-5'])
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','select','label','Alvorlighet','required',false,'options',array['low','medium','high','critical'])
  )),
  80
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  kind = excluded.kind,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_category_slug = excluded.default_category_slug,
  default_confidentiality_level = excluded.default_confidentiality_level,
  default_retention_years = excluded.default_retention_years,
  acknowledgement_due_days = excluded.acknowledgement_due_days,
  investigation_due_days = excluded.investigation_due_days,
  requires_dpo = excluded.requires_dpo,
  allows_anonymous = excluded.allows_anonymous,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ── 2. GDPR Art. 33 + 34 — personal-data breach (6 templates) ──────────────

insert into public.alert_system_templates
  (id, slug, label, description, kind, frameworks, law_refs,
   default_category_slug, default_confidentiality_level, default_retention_years,
   acknowledgement_due_days, investigation_due_days, requires_dpo, allows_anonymous,
   definition, metadata_schema, sort_order)
values
(
  'gdpr-brudd-konfidensialitet',
  'gdpr-brudd-konfidensialitet',
  'GDPR-brudd — uautorisert tilgang (konfidensialitet)',
  'Brudd på konfidensialitet — uautorisert tilgang til, eller utlevering av, personopplysninger. 72-timersfristen til Datatilsynet starter ved kjennskap.',
  'gdpr_breach',
  array['GDPR','Personopplysningsloven'],
  array['GDPR Art. 33','GDPR Art. 34','GDPR Art. 32','Personopplysningsloven § 1'],
  'gdpr-brudd','restricted',5,
  1, 3, true, false,
  jsonb_build_object(
    'preparationGuidance', '72-timersfristen til Datatilsynet starter ved kjennskap. DPO må varsles umiddelbart.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bruddet','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når oppstod / ble oppdaget','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','contain','label','Iverksett tiltak for å begrense skade','isMandatory',true,'lawRef','GDPR Art. 32'),
      jsonb_build_object('key','assess','label','Vurder risiko for de registrerte','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','notify_dt','label','Meld til Datatilsynet innen 72 timer','isMandatory',true,'lawRef','GDPR Art. 33'),
      jsonb_build_object('key','notify_subjects','label','Vurder varsling til berørte (Art. 34) ved høy risiko','isMandatory',true,'lawRef','GDPR Art. 34'),
      jsonb_build_object('key','document','label','Dokumenter bruddet etter Art. 33 (5)','isMandatory',true,'lawRef','GDPR Art. 33 (5)')
    ),
    'workflowStages', jsonb_build_array(
      jsonb_build_object('status','received','slaHours',24,'requiresRoles',array['dpo']),
      jsonb_build_object('status','triage','slaHours',48),
      jsonb_build_object('status','investigation','slaHours',72),
      jsonb_build_object('status','internal_review'),
      jsonb_build_object('status','closed')
    ),
    'externalReporting', jsonb_build_object('target','datatilsynet','deadlineHours',72,'lawRef','GDPR Art. 33'),
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',false),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_categories','kind','affected_categories','label','Kategorier av berørte data','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',false)
  )),
  110
),
(
  'gdpr-brudd-integritet',
  'gdpr-brudd-integritet',
  'GDPR-brudd — endring/korrupsjon (integritet)',
  'Brudd på integritet — utilsiktet endring eller korrupsjon av personopplysninger.',
  'gdpr_breach',
  array['GDPR'],
  array['GDPR Art. 33','GDPR Art. 32 (1) (b)'],
  'gdpr-brudd','restricted',5,
  1, 3, true, false,
  jsonb_build_object(
    'preparationGuidance', '72-timersfristen starter ved kjennskap. Vurder om endringene er reversible.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bruddet','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','restore','label','Vurder gjenoppretting fra sikkerhetskopi','isMandatory',true),
      jsonb_build_object('key','assess','label','Vurder risiko for de registrerte','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','notify_dt','label','Meld til Datatilsynet innen 72 timer','isMandatory',true,'lawRef','GDPR Art. 33')
    ),
    'externalReporting', jsonb_build_object('target','datatilsynet','deadlineHours',72,'lawRef','GDPR Art. 33'),
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',false),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false)
  )),
  120
),
(
  'gdpr-brudd-tilgjengelighet',
  'gdpr-brudd-tilgjengelighet',
  'GDPR-brudd — tap eller utilgjengelighet',
  'Brudd på tilgjengelighet — tap, utilgjengelighet eller utilsiktet sletting av personopplysninger.',
  'gdpr_breach',
  array['GDPR'],
  array['GDPR Art. 33','GDPR Art. 32 (1) (b)'],
  'gdpr-brudd','restricted',5,
  1, 3, true, false,
  jsonb_build_object(
    'preparationGuidance', 'Vurder om dataene kan gjenopprettes fra backup. Hvis ikke, og risikoen er høy, varsle berørte (Art. 34).',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bruddet','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','backup','label','Sjekk sikkerhetskopi og gjenopprettingsmuligheter','isMandatory',true),
      jsonb_build_object('key','assess','label','Vurder risiko for de registrerte','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','notify_dt','label','Meld til Datatilsynet innen 72 timer','isMandatory',true,'lawRef','GDPR Art. 33')
    ),
    'externalReporting', jsonb_build_object('target','datatilsynet','deadlineHours',72,'lawRef','GDPR Art. 33'),
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',false),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false)
  )),
  130
),
(
  'gdpr-brudd-leverandor',
  'gdpr-brudd-leverandor',
  'GDPR-brudd — databehandler-hendelse',
  'Brudd hos en databehandler (sub-processor) som behandler personopplysninger på vegne av virksomheten. Databehandler har varslingsplikt til behandlingsansvarlig.',
  'gdpr_breach',
  array['GDPR'],
  array['GDPR Art. 28','GDPR Art. 33 (2)'],
  'gdpr-brudd','restricted',5,
  1, 3, true, false,
  jsonb_build_object(
    'preparationGuidance', 'Databehandler skal varsle behandlingsansvarlig "uten ugrunnet opphold" etter Art. 33 (2). 72-timersfristen til Datatilsynet starter når behandlingsansvarlig får kjennskap til bruddet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bruddet — hvilken databehandler, hvilken tjeneste','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når ble vi varslet av databehandler','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','contract','label','Sjekk databehandleravtalen — varslingsklausul + ansvar','isMandatory',true,'lawRef','GDPR Art. 28'),
      jsonb_build_object('key','assess','label','Vurder risiko for de registrerte','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','notify_dt','label','Meld til Datatilsynet innen 72 timer','isMandatory',true,'lawRef','GDPR Art. 33'),
      jsonb_build_object('key','review_processor','label','Vurder om databehandleren fortsatt bør benyttes','isMandatory',false)
    ),
    'externalReporting', jsonb_build_object('target','datatilsynet','deadlineHours',72,'lawRef','GDPR Art. 33'),
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',false),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false),
    jsonb_build_object('key','processor_name','kind','text','label','Databehandler','required',true)
  )),
  140
),
(
  'gdpr-brudd-feilsending',
  'gdpr-brudd-feilsending',
  'GDPR-brudd — feilsendt e-post eller dokument',
  'Den vanligste brudd-kategorien: utilsiktet utlevering av personopplysninger via feilsendt e-post, brev eller filvedlegg.',
  'gdpr_breach',
  array['GDPR','Personopplysningsloven'],
  array['GDPR Art. 33','Personopplysningsloven § 1'],
  'gdpr-brudd','restricted',5,
  1, 3, true, true,
  jsonb_build_object(
    'preparationGuidance', 'Hvis du har sendt en e-post eller et dokument med personopplysninger til feil mottaker, meld det her. Du bidrar til vår dokumentasjonsplikt — det er ikke for å straffe deg.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Hva skjedde — hvilken kanal, hvilken type data','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','recall','label','Forsøk å trekke tilbake / be om sletting','isMandatory',true),
      jsonb_build_object('key','assess','label','Vurder risiko for de registrerte','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','notify_dt','label','Meld til Datatilsynet innen 72 timer hvis risiko','isMandatory',true,'lawRef','GDPR Art. 33')
    ),
    'externalReporting', jsonb_build_object('target','datatilsynet','deadlineHours',72,'lawRef','GDPR Art. 33'),
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',false),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false)
  )),
  150
),
(
  'gdpr-brudd-lavrisiko',
  'gdpr-brudd-lavrisiko',
  'GDPR-brudd — lav risiko, ikke meldepliktig',
  'Brudd som etter Art. 33 (1) "ikke sannsynlig medfører risiko for de registrertes rettigheter og friheter". Registreres for dokumentasjonsplikten (Art. 33 (5)) uten varsel til Datatilsynet.',
  'gdpr_breach',
  array['GDPR'],
  array['GDPR Art. 33 (1)','GDPR Art. 33 (5)'],
  'gdpr-brudd','restricted',5,
  1, null, true, false,
  jsonb_build_object(
    'preparationGuidance', 'Bruk dette kun etter DPO har vurdert at risikoen er lav. Saken registreres for dokumentasjon, men 72-timersfristen er ikke aktivert.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bruddet','kind','longtext','required',true,'piiHint','medium'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','document','label','Dokumenter risikovurdering — hvorfor lav risiko','isMandatory',true,'lawRef','GDPR Art. 33 (1)'),
      jsonb_build_object('key','retain','label','Behold dokumentasjon i ROPA / brudd-register','isMandatory',true,'lawRef','GDPR Art. 33 (5)')
    ),
    'externalReporting', null,
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',true,'options',array['low']),
    jsonb_build_object('key','breach_type','kind','breach_type','label','Brudd-type','required',true),
    jsonb_build_object('key','affected_subjects_estimate','kind','number','label','Antall berørte (estimat)','required',false)
  )),
  160
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  kind = excluded.kind,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_category_slug = excluded.default_category_slug,
  default_confidentiality_level = excluded.default_confidentiality_level,
  default_retention_years = excluded.default_retention_years,
  acknowledgement_due_days = excluded.acknowledgement_due_days,
  investigation_due_days = excluded.investigation_due_days,
  requires_dpo = excluded.requires_dpo,
  allows_anonymous = excluded.allows_anonymous,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ── 3. HMS / sikkerhet / etisk (5 templates) ───────────────────────────────

insert into public.alert_system_templates
  (id, slug, label, description, kind, frameworks, law_refs,
   default_category_slug, default_confidentiality_level, default_retention_years,
   acknowledgement_due_days, investigation_due_days, requires_dpo, allows_anonymous,
   definition, metadata_schema, sort_order)
values
(
  'hms-avvik-personskade',
  'hms-avvik-personskade',
  'HMS-avvik — personskade eller nestenulykke',
  'Rapportering av personskader, nestenulykker eller arbeidsrelaterte sykdomstilfeller. Yrkesskade-relaterte saker bør oppbevares lenger enn standard 5 år.',
  'hms_incident',
  array['AML','IK-f','Folketrygdloven'],
  array['AML § 4-1','AML § 5-1','Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (Internkontrollforskriften) § 5'],
  'hms-avvik','standard',5,
  3, 21, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Alle personskader skal registreres. Ved akutt skade — sørg for førstehjelp først, registrer etterpå. Nestenulykker er like viktige som faktiske skader for ROS-arbeidet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Hva skjedde','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','who_what_where','label','Hvor og hvilket utstyr','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','immediate','label','Sørg for medisinsk oppfølging hvis nødvendig','isMandatory',true),
      jsonb_build_object('key','report_nav','label','Yrkesskade-melding til NAV ved alvorlig skade','isMandatory',false),
      jsonb_build_object('key','ros','label','Oppdater ROS-vurdering','isMandatory',true,'lawRef','AML § 4-1'),
      jsonb_build_object('key','vo','label','Informer verneombud','isMandatory',true,'lawRef','AML § 6-2')
    ),
    'externalReporting', null,
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',true),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',true),
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  210
),
(
  'hms-avvik-yrkeshygiene',
  'hms-avvik-yrkeshygiene',
  'HMS-avvik — yrkeshygiene (støy, kjemikalier, ergonomi)',
  'Avvik som gjelder fysiske arbeidsforhold: støy, kjemikalier, stråling, dårlig inneklima, ergonomi. Kjemikalie-eksponering krever 30 års oppbevaring (Forskrift om utførelse av arbeid kap. 31).',
  'hms_incident',
  array['AML','Forskrift om utførelse av arbeid'],
  array['AML § 4-4','Forskrift om utførelse av arbeid kap. 31'],
  'hms-avvik','standard',5,
  3, 28, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Yrkeshygieniske avvik kan ha langvarige konsekvenser. For kjemikalie-eksponering: utvid retention til 30 år via mal-innstilling.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv eksponeringen / forholdet','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','who_what_where','label','Hvor og hva','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Periode','kind','text','required',false,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','measure','label','Måle eksponering hvis mulig','isMandatory',true),
      jsonb_build_object('key','medical','label','Vurder helseundersøkelse','isMandatory',false),
      jsonb_build_object('key','ros','label','Oppdater ROS-vurdering','isMandatory',true,'lawRef','AML § 4-4')
    ),
    'externalReporting', null,
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',true),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',true),
    jsonb_build_object('key','exposure_type','kind','select','label','Eksponeringstype','required',false,
      'options',array['støy','kjemikalier','stråling','inneklima','ergonomi','annet'])
  )),
  220
),
(
  'sikkerhet-hendelse-fysisk',
  'sikkerhet-hendelse-fysisk',
  'Sikkerhetshendelse — fysisk (innbrudd, hærverk)',
  'Fysiske sikkerhetshendelser: innbrudd, hærverk, tyveri, uautorisert tilgang til lokaler.',
  'security_incident',
  array['Internkontroll','NS-ISO 27001'],
  array['Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (Internkontrollforskriften) § 5','NS-ISO 27001 § 16'],
  'sikkerhet','restricted',5,
  3, 14, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Ved akutt hendelse — kontakt politi/vakttjeneste først, registrer etterpå.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Hva skjedde','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','who_what_where','label','Hvor','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','secure','label','Sikre åstedet for bevis','isMandatory',true),
      jsonb_build_object('key','police','label','Vurder politianmeldelse','isMandatory',false),
      jsonb_build_object('key','insurance','label','Vurder forsikringsmelding','isMandatory',false)
    ),
    'externalReporting', null,
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',true),
    jsonb_build_object('key','location','kind','location','label','Lokasjon','required',true)
  )),
  310
),
(
  'sikkerhet-hendelse-it',
  'sikkerhet-hendelse-it',
  'Sikkerhetshendelse — IT/cyber (utenom GDPR)',
  'IT-sikkerhetshendelser uten personopplysninger involvert: phishing-forsøk, malware, uautorisert tilgang til systemer.',
  'security_incident',
  array['NS-ISO 27001','NSM grunnprinsipper'],
  array['NS-ISO 27001 § 16'],
  'sikkerhet','restricted',5,
  1, 7, false, false,
  jsonb_build_object(
    'preparationGuidance', 'IT-hendelser med personopplysninger skal heller meldes via en gdpr-brudd-mal.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Hva skjedde','kind','longtext','required',true,'piiHint','low'),
      jsonb_build_object('key','occurred_at_text','label','Når','kind','text','required',true,'piiHint','low')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','isolate','label','Isoler berørte systemer','isMandatory',true),
      jsonb_build_object('key','forensic','label','Bevar logger / forensisk materiale','isMandatory',true),
      jsonb_build_object('key','assess_pii','label','Verifiser at ingen personopplysninger ble eksponert (ellers eskaler til gdpr-brudd)','isMandatory',true)
    ),
    'externalReporting', null,
    'retaliationProtection', null
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','severity','kind','severity','label','Alvorlighet','required',true),
    jsonb_build_object('key','system_name','kind','text','label','Berørt system','required',false)
  )),
  320
),
(
  'etisk-bekymring',
  'etisk-bekymring',
  'Etisk bekymring — uten klart kritikkverdig forhold',
  'Etiske bekymringer som ikke når terskelen for varsel etter AML kap. 2A, men hvor du ønsker at ledelsen skal være kjent med forholdet.',
  'ethical_concern',
  array['Org-spesifikk etikkpolicy'],
  array[]::text[],
  'etisk','standard',5,
  10, 60, false, true,
  jsonb_build_object(
    'preparationGuidance', 'Bruk dette skjemaet hvis du opplever noe som strider mot virksomhetens etiske retningslinjer, men ikke er et lovbrudd. For lovbrudd: bruk varsel-malene i stedet.',
    'publicFormFields', jsonb_build_array(
      jsonb_build_object('key','title','label','Kort tittel','kind','text','required',true,'piiHint','low'),
      jsonb_build_object('key','description','label','Beskriv bekymringen','kind','longtext','required',true,'piiHint','medium')
    ),
    'committeeChecklistItems', jsonb_build_array(
      jsonb_build_object('key','review','label','Vurder mot etikk-policy','isMandatory',true),
      jsonb_build_object('key','feedback','label','Gi tilbakemelding til melder','isMandatory',true)
    ),
    'externalReporting', null,
    'retaliationProtection', jsonb_build_object('enabled',true)
  ),
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','department','kind','department','label','Avdeling','required',false)
  )),
  410
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  kind = excluded.kind,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_category_slug = excluded.default_category_slug,
  default_confidentiality_level = excluded.default_confidentiality_level,
  default_retention_years = excluded.default_retention_years,
  acknowledgement_due_days = excluded.acknowledgement_due_days,
  investigation_due_days = excluded.investigation_due_days,
  requires_dpo = excluded.requires_dpo,
  allows_anonymous = excluded.allows_anonymous,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ── 4. Re-run provisioning for every org so the new templates get settings ──

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_alerts_baseline_for_org(v_org.id);
  end loop;
end $$;
