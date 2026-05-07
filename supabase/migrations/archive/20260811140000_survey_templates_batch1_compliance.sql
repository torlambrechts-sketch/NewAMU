-- Survey template batch 1 — compliance pack (Commit 12 of GLOBAL_SURVEY_PLAN
-- AML/IK extension). Seven identified-attestation templates per
-- SURVEY_TEMPLATE_COVERAGE.md Part 5.
--
-- All seven:
--   - is_system=true, organization_id=NULL (system rows; the conditional
--     audit-trigger pattern from 20260811120100 protects against the NULL-
--     org_id audit log bug).
--   - pack='compliance' → loaded by Survey Commit 6's publish-snapshot
--     trigger to lock questions on publish (compliance evidence shouldn't
--     drift post-publish).
--   - audience='internal', recommend_anonymous=false (identified
--     attestation), recommended_cadence_months=12.
--   - Final item is a respondent_signature (publish-gate validated by
--     surveyRespondValidation.ts when required=true).
--
-- review_status defaults to 'draft' on the per-org survey_org_templates
-- override row (set when provision_survey_baseline_for_org dispatches at
-- pack-license-grant). HMS-rådgiver promotes via direct DB UPDATE or the
-- forthcoming admin Maler tab.
--
-- Idempotent on the catalog text PK (id).

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description,
  source, use_case, category, audience, estimated_minutes,
  recommend_anonymous, scoring_note, law_ref, body, is_active,
  pack, recommended_cadence_months, recommended_anonymity_threshold
) values

-- ── 1) Medvirkningsplikt — årlig bekreftelse (AML §2-3) ─────────────────
(
  'aml-2-3-medvirkningsplikt-attest', null, true,
  'Medvirkningsplikt – årlig bekreftelse',
  'Medvirkningsplikt',
  'Årlig bekreftelse fra hver ansatt om at medvirkningsplikten etter AML §2-3 er forstått, og at varslingskanaler + verneombud er kjent.',
  'AML §2-3', 'compliance attestation', 'compliance', 'internal', 4,
  false,
  'Identifisert. Hver ansatt fyller individuelt; statistikk-fanen viser dekningsgrad per enhet.',
  'AML §2-3',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Forstår jeg medvirkningsplikten min etter AML §2-3?',
                       'type','yes_no','required',true,'law_ref','AML §2-3'),
    jsonb_build_object('id','q2','text','Vet jeg hvem mitt verneombud er og hvordan jeg når dem?',
                       'type','yes_no','required',true,'law_ref','AML §6-1'),
    jsonb_build_object('id','q3','text','Vet jeg hvordan jeg melder avvik?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 7'),
    jsonb_build_object('id','q4','text','Vet jeg hvordan jeg varsler om kritikkverdige forhold?',
                       'type','yes_no','required',true,'law_ref','AML §2A-1'),
    jsonb_build_object('id','q5','text','Hvilke spørsmål eller bekymringer har jeg knyttet til min rolle i HMS?',
                       'type','long_text','required',false),
    jsonb_build_object('id','sig','text','Bekreftelse — jeg har forstått innholdet i denne attesten.',
                       'type','respondent_signature','required',true)
  )),
  true,
  'compliance', 12, null
),

-- ── 2) HMS-modenhet — leder-egenrapport (AML §3-1, IK §3) ──────────────
(
  'aml-3-1-hms-modenhet-leder', null, true,
  'HMS-modenhet – leder-egenrapport',
  'HMS-modenhet',
  'Årlig egenrapport fra hver linjeleder om hvor systematisk HMS-arbeidet er i deres ansvarsområde. Trend over år dokumenterer at internkontrollen fungerer.',
  'AML §3-1, IK-forskriften §3 + §5',
  'leader self-assessment', 'compliance', 'internal', 6,
  false,
  'Identifisert per leder. Aggregert dekningsgrad og snittscore i Statistikk-fanen.',
  'AML §3-1',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Har min enhet gjennomført minst én vernerunde siste 6 måneder?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 7'),
    jsonb_build_object('id','q2','text','Er ROS oppdatert siste 12 måneder for mitt ansvarsområde?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 6'),
    jsonb_build_object('id','q3','text','Er HMS-mål for mitt ansvarsområde dokumentert?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 4'),
    jsonb_build_object('id','q4','text','Har jeg hatt minst én HMS-samtale med teamet siste 12 måneder?',
                       'type','yes_no','required',false),
    jsonb_build_object('id','q5','text','Er avvikshåndtering rutinemessig i bruk i min enhet?',
                       'type','rating_visual','required',true,
                       'anchors', jsonb_build_object('low','Sjelden / aldri','high','Konsekvent / alltid'),
                       'scale', 'scale_5'),
    jsonb_build_object('id','q6','text','Hovedhindring for HMS-arbeid i min enhet (frivillig)',
                       'type','long_text','required',false),
    jsonb_build_object('id','sig','text','Lederens bekreftelse',
                       'type','respondent_signature','required',true)
  )),
  true,
  'compliance', 12, null
),

-- ── 3) Arbeidsgivers HMS-opplæring — årsattest (AML §3-5) ──────────────
(
  'aml-3-5-arbeidsgivers-hms-attest', null, true,
  'Arbeidsgivers HMS-opplæring – årsattest',
  'HMS-opplæring (årlig)',
  'Årsattest fra hver leder med arbeidsgiveransvar om gjennomført HMS-opplæring (AML §3-5). Komplementerer den eksisterende sjekklisten arbeidsgivers-hms-opplaering — sjekkliste = ett enkelt signert dokument; survey = årlig sweep med dekningsgrad-oversikt på tvers av ledere.',
  'AML §3-5', 'compliance attestation', 'compliance', 'internal', 5,
  false,
  'Identifisert per leder. Statistikk-fanen viser hvilke ledere som mangler attestasjon.',
  'AML §3-5',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Hvilken HMS-opplæring har jeg gjennomført siste 24 måneder?',
                       'type','long_text','required',true,'law_ref','AML §3-5'),
    jsonb_build_object('id','q2','text','Når ble opplæringen sist fornyet?',
                       'type','datetime','required',true),
    jsonb_build_object('id','q3','text','Last opp kursbevis (frivillig, men anbefalt)',
                       'type','photo','required',false),
    jsonb_build_object('id','q4','text','Er det endringer i regelverk eller risikobilde som krever ny opplæring?',
                       'type','yes_no','required',true),
    jsonb_build_object('id','sig','text','Bekreftelse fra arbeidsgiver / leder',
                       'type','respondent_signature','required',true,'law_ref','AML §3-5')
  )),
  true,
  'compliance', 12, null
),

-- ── 4) Verneombud — kjent og aktivt (AML §6-1) ─────────────────────────
(
  'aml-6-1-verneombud-bekreftelse', null, true,
  'Verneombud – kjent og aktivt',
  'VO-bekreftelse',
  'Årlig identifisert bekreftelse fra ansatte om at verneombudet er kjent og aktivt synlig i deres område. Komplementerer eksisterende verneombud-årsrapport-sjekkliste.',
  'AML §6-1', 'compliance attestation', 'compliance', 'internal', 3,
  false,
  'Identifisert. Aggregert per avdeling i Statistikk-fanen — viser områder uten kjent VO.',
  'AML §6-1',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Jeg vet hvem mitt verneombud er.',
                       'type','yes_no','required',true,'law_ref','AML §6-1'),
    jsonb_build_object('id','q2','text','Verneombudet har vært aktivt det siste året (synlig, deltatt i runder, formidlet saker).',
                       'type','yes_no','required',true,'law_ref','AML §6-2'),
    jsonb_build_object('id','q3','text','Jeg har kontakt-info til verneombudet.',
                       'type','yes_no','required',true),
    jsonb_build_object('id','q4','text','Hvis nei på noen av punktene over — hvilke, og hva trenger du?',
                       'type','long_text','required',false),
    jsonb_build_object('id','sig','text','Bekreftelse',
                       'type','respondent_signature','required',true)
  )),
  true,
  'compliance', 12, null
),

-- ── 5) Internkontroll — leders egenkontroll (IK §5 nr. 8) ──────────────
(
  'ik-5-8-internkontroll-egenkontroll', null, true,
  'Internkontroll – leders egenkontroll',
  'IK-egenkontroll',
  'Årlig leder-egenkontroll av at internkontrollen fungerer som forutsatt i deres ansvarsområde. Komplementerer den eksisterende sjekklisten internkontroll-arsgjennomgang — sjekkliste = ett organisasjons-bredt signert dokument; survey = leder-by-leder for dekningsgrad-oversikt.',
  'IK-forskriften §5 nr. 8',
  'leader self-control', 'compliance', 'internal', 5,
  false,
  'Identifisert per leder. Aggregert per enhet i Statistikk-fanen.',
  'IK-forskriften §5 nr. 8',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Er HMS-mål for mitt ansvarsområde nådd siste år?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 4'),
    jsonb_build_object('id','q2','text','Er ROS oppdatert?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 6'),
    jsonb_build_object('id','q3','text','Er rutiner for avvik faktisk fulgt?',
                       'type','yes_no','required',true,'law_ref','IK-forskriften §5 nr. 7'),
    jsonb_build_object('id','q4','text','Er VO-samarbeid og AMU-deltakelse aktiv i mitt område?',
                       'type','yes_no','required',true,'law_ref','AML §6 + §7'),
    jsonb_build_object('id','q5','text','Hva er det største forbedringsområdet for neste år?',
                       'type','long_text','required',true),
    jsonb_build_object('id','sig','text','Bekreftelse fra leder',
                       'type','respondent_signature','required',true,'law_ref','IK-forskriften §5 nr. 8')
  )),
  true,
  'compliance', 12, null
),

-- ── 6) Åpenhetsloven — intern aktsomhetsattest ─────────────────────────
(
  'apenhetsloven-aktsomhet-internal', null, true,
  'Åpenhetsloven – intern aktsomhetsattest',
  'Åpenhetsloven (intern)',
  'Årlig intern attestasjon fra innkjøp/ledelse om at aktsomhetsvurderinger etter Åpenhetsloven §4 er gjennomført, dokumentert og publisert innen 30. juni.',
  'Åpenhetsloven §4–§6',
  'compliance attestation', 'compliance', 'internal', 6,
  false,
  'Identifisert. Komplementerer den eksterne leverandør-undersøkelsen ext-apenhetsloven; surveyen her dokumenterer at vi selv har gjennomført aktsomhet på leverandørkjeden.',
  'Åpenhetsloven §4',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Har vi kartlagt våre leverandørkjeder siste 12 måneder?',
                       'type','yes_no','required',true,'law_ref','Åpenhetsloven §4 (a)'),
    jsonb_build_object('id','q2','text','Har vi vurdert risiko for menneskerettighets- eller arbeidsforholdsbrudd?',
                       'type','yes_no','required',true,'law_ref','Åpenhetsloven §4 (b)'),
    jsonb_build_object('id','q3','text','Er aktsomhetsrapport publisert eller klar til publisering innen 30. juni?',
                       'type','yes_no','required',true,'law_ref','Åpenhetsloven §5'),
    jsonb_build_object('id','q4','text','Har vi behandlet eventuelle henvendelser etter §6?',
                       'type','yes_no','required',true,'law_ref','Åpenhetsloven §6'),
    jsonb_build_object('id','q5','text','Kommentar (frivillig)',
                       'type','long_text','required',false),
    jsonb_build_object('id','sig','text','Bekreftelse fra ansvarlig (innkjøp / ledelse)',
                       'type','respondent_signature','required',true)
  )),
  true,
  'compliance', 12, null
),

-- ── 7) GDPR — personvern-attest ────────────────────────────────────────
(
  'gdpr-personvern-attest', null, true,
  'GDPR – personvern-attest',
  'GDPR-attest',
  'Årlig intern attestasjon fra DPO eller personvernansvarlig at personvernrutiner er ivaretatt og dokumentert.',
  'GDPR Art. 5/24/30', 'compliance attestation', 'compliance', 'internal', 6,
  false,
  'Identifisert. Datatilsynet etterspør tilsvarende dokumentasjon ved tilsyn.',
  'GDPR Art. 5',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Er personvernerklæring oppdatert siste 12 måneder?',
                       'type','yes_no','required',true,'law_ref','GDPR Art. 13/14'),
    jsonb_build_object('id','q2','text','Er behandlingsoversikt (Art. 30) oppdatert?',
                       'type','yes_no','required',true,'law_ref','GDPR Art. 30'),
    jsonb_build_object('id','q3','text','Har vi gjennomført DPIA der pålagt?',
                       'type','yes_no','required',true,'law_ref','GDPR Art. 35'),
    jsonb_build_object('id','q4','text','Er ansatte trent i personvern?',
                       'type','yes_no','required',true),
    jsonb_build_object('id','q5','text','Har vi behandlet henvendelser fra registrerte (innsyn, retting, sletting)?',
                       'type','yes_no','required',true,'law_ref','GDPR Kap. III'),
    jsonb_build_object('id','sig','text','Bekreftelse fra DPO / personvernansvarlig',
                       'type','respondent_signature','required',true)
  )),
  true,
  'compliance', 12, null
)

on conflict (id) do nothing;

-- ── Provision newly-added templates into existing orgs ──────────────────
-- Each org with the compliance pack licensed gets survey_org_templates
-- rows for the new system templates. Idempotent via PK conflict in the
-- provision function.
do $$
declare v_pack record;
begin
  for v_pack in
    select organization_id, slug from public.survey_packs
    where is_active = true and deleted_at is null and slug = 'compliance'
  loop
    perform public.provision_survey_baseline_for_org(v_pack.organization_id, v_pack.slug);
  end loop;
end $$;
