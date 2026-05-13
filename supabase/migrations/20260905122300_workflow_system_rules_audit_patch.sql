-- Patch system rules based on dual audit (compliance officer +
-- Arbeidstilsynet inspector). Eight changes:
--
--   1. AML § 5-2 — wire actual gov-action chain instead of stopping
--      at a manual task. Now: task → notification → request_approval
--      → rapporter_alvorlig_skade_arbeidstilsynet.
--   2. AML § 6-1 — replace log_only stub with real verification task.
--   3. AML § 7-1 — replace log_only stub with real verification task.
--   4. AML § 4-1 — new rule for generelle krav (ROS-funn kritisk).
--   5. AML § 4-4 — new rule for fysisk arbeidsmiljø (lys/støy/klima).
--   6. AML § 3-3 — new rule for bedriftshelsetjeneste-pliktig sak.
--   7. AML § 12-4 — new rule for fødselspermisjon.
--   8. AML § 10-4 / § 10-8 — new rule for hviletid + alminnelig arbeidstid.
--   9. IK-f § 5 nr. 1 — new rule for faremapping.
--  10. IK-f § 5 nr. 6 — new rule for ROS-handlingsplan.
--
-- Audits documented in commit message + ROADMAP.

-- 1. AML § 5-2 — actual gov-action chain.
update public.workflow_system_rules
   set actions_json = '[
     {"type":"create_task","title":"24t-frist: vurder og bekreft Arbeidstilsynet-melding (AML § 5-2)","assignee":"Daglig leder","ownerRole":"daglig_leder","dueInDays":1,"module":"inspection","sourceType":"§5-2"},
     {"type":"send_notification","title":"§ 5-2 trigger","body":"Alvorlig personskade — 24-timers innmeldings-frist løper.","category":"compliance"},
     {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft Arbeidstilsynet-melding (AML § 5-2) sendes — kan ikke trekkes tilbake.","escalateAfterHours":6,"escalateToRole":"hms_leder"},
     {"type":"rapporter_alvorlig_skade_arbeidstilsynet","melderRolle":"arbeidsgiver","reminderHoursBeforeDeadline":[12,4,1]}
   ]'::jsonb,
   updated_at = now()
 where slug = 'aml-5-2-arbeidstilsynet-24h';

-- 2. AML § 6-1 — real task, not log_only.
update public.workflow_system_rules
   set actions_json = '[
     {"type":"create_task","title":"Verifiser at verneombud er valgt og opplært (AML § 6-1)","assignee":"HR","ownerRole":"HR","dueInDays":30,"module":"tasks","sourceType":"§6-1"}
   ]'::jsonb,
   updated_at = now()
 where slug = 'aml-6-1-vo-required-10';

-- 3. AML § 7-1 — real task, not log_only.
update public.workflow_system_rules
   set actions_json = '[
     {"type":"create_task","title":"Verifiser at AMU er etablert og holder lovpålagte møter (AML § 7-1, § 7-2)","assignee":"HR","ownerRole":"HR","dueInDays":30,"module":"tasks","sourceType":"§7-1"}
   ]'::jsonb,
   updated_at = now()
 where slug = 'aml-7-1-amu-required-30';

-- 4-10. New rules from audit gaps.
insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory, description, rationale,
  source_module, trigger_type, trigger_event_name, trigger_on,
  condition_json, actions_json, law_refs, frameworks, pdca_phase, enabled, notes
) values
('aml-4-1-general-environment','AML','Kap. 4 — Krav til arbeidsmiljøet',4,'AML § 4-1 — Generelle krav til arbeidsmiljøet',
 'Kritisk risiko registrert i ROS → automatisk AMU-sak + tiltaksplan med 30-dagers frist.',
 'AML § 4-1: «Arbeidsmiljøet i virksomheten skal være fullt forsvarlig.» Generelt krav som dekker både psykososialt, fysisk og organisatorisk miljø.',
 'ros','db_event','ON_ROS_CRITICAL_RISK','both','{"match":"always"}'::jsonb,
 '[{"type":"add_amu_agenda_item","agendaItem":"Kritisk risiko — AML § 4-1","priority":"kritisk"},{"type":"create_task","title":"Tiltak for kritisk risiko","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":30,"module":"ros","sourceType":"§4-1"}]'::jsonb,
 ARRAY['AML § 4-1'],ARRAY['aml-amu'],'plan',true,null),
('aml-4-4-physical-environment','AML','Kap. 4 — Krav til arbeidsmiljøet',4,'AML § 4-4 — Fysisk arbeidsmiljø',
 'Ergonomi/støy/klima-funn registrert → ROS + tiltak.',
 'AML § 4-4: arbeidsmiljøet skal være fullt forsvarlig ut fra hensyn til fysiske faktorer. Tilsynet ber rutinemessig om dokumentasjon på lys/støy/klima-målinger.',
 'inspection','db_event','finding_high','insert','{"match":"field_equals","path":"category","value":"fysisk_miljo"}'::jsonb,
 '[{"type":"create_ros_draft","template":"fysisk arbeidsmiljø","linkSource":true},{"type":"create_task","title":"Behandle fysisk miljø-funn","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":21,"module":"inspection","sourceType":"§4-4"}]'::jsonb,
 ARRAY['AML § 4-4'],ARRAY['aml-amu'],'do',true,null),
('aml-3-3-bedriftshelsetjeneste','AML','Kap. 3 — Virkemidler i arbeidsmiljøarbeidet',3,'AML § 3-3 — Bedriftshelsetjeneste',
 'Yrkeshelse-relatert hendelse → BHT-konsultasjons-oppgave for sektorpliktige org.',
 'AML § 3-3 + forskrift om organisering, ledelse og medvirkning kap. 13: visse bransjer (helse, bygg, transport, prosessindustri) har pliktig BHT.',
 'inspection','db_event','finding_high','insert','{"match":"field_equals","path":"category","value":"yrkeshelse"}'::jsonb,
 '[{"type":"create_task","title":"BHT-konsultasjon for yrkeshelsesak","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":14,"module":"inspection","sourceType":"§3-3"}]'::jsonb,
 ARRAY['AML § 3-3'],ARRAY['aml-amu'],'check',true,'BHT-plikt gjelder kun for sektorer i forskrift om organisering, ledelse og medvirkning.'),
('aml-12-4-maternity-leave','AML','Kap. 12 — Rett til permisjon',12,'AML § 12-4 — Fødselspermisjon',
 'Søknad om fødselspermisjon → automatisk bekreftelse + sykmelding-overlevering til NAV.',
 'AML § 12-4: lovfestet permisjonsrett. NAV-koordinering er kritisk for ytelsesutbetaling.',
 'tasks','db_event','ON_TASK_CREATED','insert','{"match":"field_equals","path":"sourceType","value":"maternity_leave_request"}'::jsonb,
 '[{"type":"create_task","title":"Bekreft § 12-4 fødselspermisjon + NAV-melding","assignee":"HR","ownerRole":"HR","dueInDays":3,"module":"tasks","sourceType":"§12-4"}]'::jsonb,
 ARRAY['AML § 12-4','Folketrygdloven § 14-9'],ARRAY['aml-amu'],'do',true,null),
('aml-10-rest-time-validation','AML','Kap. 10 — Arbeidstid',10,'AML § 10-4 og § 10-8 — Alminnelig arbeidstid og hviletid',
 'Hviletid under 11t/24t eller arbeidstid over 40t/uke → varsel + dokumentasjonskrav.',
 'AML § 10-4 (alminnelig arbeidstid 40t/uke), § 10-8 (11t hviletid/24t, 35t sammenhengende/7 dager). Brudd er straffbart jf. § 19-1.',
 'tasks','db_event','ON_TASK_CREATED','insert','{"match":"field_equals","path":"sourceType","value":"rest_time_breach"}'::jsonb,
 '[{"type":"send_notification","title":"§ 10-4/§ 10-8 brudd","body":"Alminnelig arbeidstid eller hviletid overskredet.","category":"compliance"},{"type":"create_task","title":"Dokumenter unntak/avvik § 10-4/§ 10-8","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":3,"module":"tasks","sourceType":"§10-4"}]'::jsonb,
 ARRAY['AML § 10-4','AML § 10-8'],ARRAY['aml-amu'],'check',true,null),
('ikf-5-1-hazard-mapping','IK-f','IK-forskriften § 5 — Plikter i internkontrollen',100,'IK-f § 5 nr. 1 — Kartlegge farer og problemer',
 'Ny avdeling/lokasjon registrert → ROS-utkast + faremapping-oppgave.',
 'IK-f § 5 nr. 1: «kartlegge farer og problemer og på denne bakgrunn vurdere risikoforholdene i virksomheten». Tilsynet starter alltid med å spørre om kartlegging.',
 'tasks','db_event','ON_TASK_CREATED','insert','{"match":"field_equals","path":"sourceType","value":"new_location"}'::jsonb,
 '[{"type":"create_ros_draft","template":"faremapping","linkSource":true},{"type":"create_task","title":"Kartlegge farer for ny lokasjon (IK-f § 5 nr. 1)","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":30,"module":"ros","sourceType":"IK-f § 5-1"}]'::jsonb,
 ARRAY['IK-f § 5 nr. 1'],ARRAY['aml-amu','iso-45001'],'plan',true,null),
('ikf-5-6-ros-and-action-plan','IK-f','IK-forskriften § 5 — Plikter i internkontrollen',100,'IK-f § 5 nr. 6 — Risikovurdering og handlingsplan',
 'ROS godkjent uten tilhørende handlingsplan → påminnelse + plikt til § 5 nr. 6-plan innen 14 dager.',
 'IK-f § 5 nr. 6: «utarbeide planer og iverksette tiltak for å redusere risikoforholdene.» Tilsynet ber alltid om: 1) ROS, 2) handlingsplan, 3) frister, 4) ansvar.',
 'ros','db_event','ON_ROS_APPROVED','insert','{"match":"always"}'::jsonb,
 '[{"type":"create_task","title":"Lag handlingsplan for ROS-funn (IK-f § 5 nr. 6)","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":14,"module":"action_plan","sourceType":"IK-f § 5-6"}]'::jsonb,
 ARRAY['IK-f § 5 nr. 6'],ARRAY['aml-amu','iso-45001'],'plan',true,null)
on conflict (slug) do update set
  framework=excluded.framework, category=excluded.category, category_order=excluded.category_order,
  subcategory=excluded.subcategory, description=excluded.description, rationale=excluded.rationale,
  source_module=excluded.source_module, trigger_type=excluded.trigger_type,
  trigger_event_name=excluded.trigger_event_name, trigger_on=excluded.trigger_on,
  condition_json=excluded.condition_json, actions_json=excluded.actions_json,
  law_refs=excluded.law_refs, frameworks=excluded.frameworks,
  pdca_phase=excluded.pdca_phase, enabled=excluded.enabled, notes=excluded.notes, updated_at=now();
