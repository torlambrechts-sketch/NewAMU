-- Survey template batch 2 — arbeidsmiljo + vendor + engagement packs
-- (Commit 13 of GLOBAL_SURVEY_PLAN AML/IK extension). Nine templates per
-- SURVEY_TEMPLATE_COVERAGE.md Part 5.
--
-- Anonymous templates default to k=5 from the pack; aml-13-likebehandling
-- and aml-9-kontrolltiltak override to k=3 for small-team realism (per
-- Decision F + the dossier).
--
-- Vendor templates use respondent_signature + photo items; identified
-- recipients via the vendors table + the XOR invitation refactor from
-- Survey Commit 5.
--
-- engagement templates carry no AML/IK clause grounding (HR practice);
-- listed in the dossier as such.

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description,
  source, use_case, category, audience, estimated_minutes,
  recommend_anonymous, scoring_note, law_ref, body, is_active,
  pack, recommended_cadence_months, recommended_anonymity_threshold
) values

-- ── 1) arbeidsmiljo: Medvirkning og tilrettelegging (AML §4-2 + IK §5 nr.3) ──
(
  'aml-4-2-medvirkning', null, true,
  'Medvirkning og tilrettelegging',
  'Medvirkning',
  'Halvårlig kartlegging av om ansatte opplever at de medvirker i beslutninger og at arbeidet er tilrettelagt.',
  'AML §4-2, IK-forskriften §5 nr. 3', 'arbeidsmiljø-måling',
  'safety', 'internal', 4,
  true,
  'Anonymisert. Aggregert per enhet med k=5 terskel.',
  'AML §4-2',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Føler jeg at jeg medvirker i beslutninger som påvirker mitt arbeid?',
                       'type','likert_scale','required',true,'law_ref','AML §4-2 (1)','scale','likert_5'),
    jsonb_build_object('id','q2','text','Er arbeidet tilrettelagt for min kompetanse og mine forutsetninger?',
                       'type','likert_scale','required',true,'law_ref','AML §4-2 (2)','scale','likert_5'),
    jsonb_build_object('id','q3','text','Får jeg utviklingsmuligheter (kurs, nye oppgaver, ansvar)?',
                       'type','likert_scale','required',true,'law_ref','AML §4-2 (3)','scale','likert_5'),
    jsonb_build_object('id','q4','text','Hvordan kan medvirkningen bedres i din enhet? (frivillig)',
                       'type','long_text','required',false)
  )),
  true,
  'arbeidsmiljo', 6, null
),

-- ── 2) arbeidsmiljo: Arbeidstid + belastning + restitusjon (AML kap 10) ─────
(
  'aml-10-arbeidstid-belastning', null, true,
  'Arbeidstid, belastning og restitusjon',
  'Arbeidstid-puls',
  'Kvartalsvis pulsmåling av faktisk arbeidstid, overtid, restitusjon og opplevd belastning.',
  'AML kap 10, AML §4-3', 'arbeidsmiljø-puls',
  'safety', 'internal', 3,
  true,
  'Anonymisert. Trend per kvartal er sterk dokumentasjon for tilsyn.',
  'AML §10',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Jobber jeg vanligvis innenfor avtalt arbeidstid?',
                       'type','yes_no','required',true,'law_ref','AML §10-4'),
    jsonb_build_object('id','q2','text','Hvor ofte må jeg arbeide overtid?',
                       'type','single_select','required',true,'law_ref','AML §10-6',
                       'options', jsonb_build_array('Aldri','Sjeldent','Månedlig','Ukentlig','Daglig')),
    jsonb_build_object('id','q3','text','Får jeg tilstrekkelig restitusjon (døgnhvile, ukehvile)?',
                       'type','likert_scale','required',true,'law_ref','AML §10-8','scale','likert_5'),
    jsonb_build_object('id','q4','text','Opplever jeg arbeidsbelastningen som forsvarlig?',
                       'type','likert_scale','required',true,'law_ref','AML §4-3','scale','likert_5'),
    jsonb_build_object('id','q5','text','Kommentarer om belastning eller arbeidstid (frivillig)',
                       'type','long_text','required',false)
  )),
  true,
  'arbeidsmiljo', 3, null
),

-- ── 3) arbeidsmiljo: Likebehandling og inkludering (AML §13-1) ─────────────
(
  'aml-13-likebehandling', null, true,
  'Likebehandling og inkludering',
  'D&I',
  'Årlig anonym kartlegging av opplevd diskriminering og inkluderende kultur. Lavere k-terskel (3) for at små avdelinger skal kunne se egne resultater.',
  'AML §13-1, §4-3 (3)', 'arbeidsmiljø-måling',
  'safety', 'internal', 5,
  true,
  'Anonymisert med k=3. Frivillige fritekstkommentarer kan inneholde personidentifiserende særlige kategorier — UI-hint om å ikke skrive helseopplysninger.',
  'AML §13-1',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Har du opplevd diskriminering på din arbeidsplass siste 12 måneder?',
                       'type','yes_no','required',true,'law_ref','AML §13-1'),
    jsonb_build_object('id','q2','text','Hvis ja — hva slags? (flerevalg)',
                       'type','multi_select','required',false,'law_ref','AML §13-1',
                       'options', jsonb_build_array('Politisk syn','Medlemskap i organisasjon','Kjønn','Alder','Etnisitet','Funksjonsevne','Legning','Religion','Annet')),
    jsonb_build_object('id','q3','text','Føler du at virksomheten aktivt arbeider mot diskriminering?',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q4','text','Har du hørt om eller observert mobbing eller utilbørlig opptreden?',
                       'type','yes_no','required',true,'law_ref','AML §4-3 (3)'),
    jsonb_build_object('id','q5','text','Frivillige kommentarer (skriv ikke personidentifiserende helseopplysninger)',
                       'type','long_text','required',false)
  )),
  true,
  'arbeidsmiljo', 12, 3
),

-- ── 4) arbeidsmiljo: Kontrolltiltak — opplevd forsvarlighet (AML §9-1) ─────
(
  'aml-9-kontrolltiltak-opplevelse', null, true,
  'Kontrolltiltak – opplevd forsvarlighet',
  'Kontrolltiltak',
  'Årlig anonym vurdering av om kontrolltiltakene som påvirker arbeidstakerne oppleves som forholdsmessige (AML §9-1). Lavere k-terskel for små teams.',
  'AML §9-1, §9-2', 'arbeidsmiljø-måling',
  'safety', 'internal', 3,
  true,
  'Anonymisert med k=3. Trigger ved nye kontrolltiltak eller endringer.',
  'AML §9-1',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Har du fått informasjon om kontrolltiltakene som påvirker deg?',
                       'type','yes_no','required',true,'law_ref','AML §9-2 (2)'),
    jsonb_build_object('id','q2','text','Oppleves kontrolltiltakene som forholdsmessige (proporsjonale)?',
                       'type','likert_scale','required',true,'law_ref','AML §9-1 (1)','scale','likert_5'),
    jsonb_build_object('id','q3','text','Oppleves kontrolltiltakene som uforsvarlig belastende?',
                       'type','yes_no','required',true,'law_ref','AML §9-1 (1)'),
    jsonb_build_object('id','q4','text','Hvilke kontrolltiltak er du særlig opptatt av? (frivillig)',
                       'type','long_text','required',false)
  )),
  true,
  'arbeidsmiljo', 12, 3
),

-- ── 5) arbeidsmiljo: Opplæring og kunnskap (IK §5 nr. 2) ───────────────────
(
  'ik-5-2-opplaering-effekt', null, true,
  'Opplæring og kunnskap (effekt)',
  'Opplæring-puls',
  'Årlig kartlegging av om ansatte opplever at de har fått tilstrekkelig opplæring og informasjon ved endringer.',
  'IK-forskriften §5 nr. 2', 'arbeidsmiljø-måling',
  'safety', 'internal', 3,
  true,
  'Anonymisert. Trend per år.',
  'IK-forskriften §5 nr. 2',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Har jeg fått tilstrekkelig opplæring til å utføre arbeidet sikkert?',
                       'type','likert_scale','required',true,'law_ref','IK-forskriften §5 nr. 2','scale','likert_5'),
    jsonb_build_object('id','q2','text','Får jeg informasjon ved endringer i rutiner eller utstyr?',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q3','text','Hva slags opplæring savner du? (frivillig)',
                       'type','long_text','required',false)
  )),
  true,
  'arbeidsmiljo', 12, null
),

-- ── 6) vendor: Arbeidsforhold-attest (AML §2-2) ────────────────────────────
(
  'vendor-arbeidsforhold-attest', null, true,
  'Leverandør – arbeidsforhold på vår plass',
  'Arbeidsforhold-attest',
  'Bekreftelse fra leverandør om at deres ansatte som arbeider på vår virksomhet har skriftlig arbeidsavtale, arbeidstid innenfor AML kap. 10, og dokumentert HMS-policy.',
  'AML §2-2 + §14-5/§14-6', 'vendor attestation',
  'vendor', 'external', 8,
  false,
  'Identifisert (vendor recipient). Låses på publisering — leverandørbevis skal ikke endres etter publisering.',
  'AML §2-2',
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Bekrefter dere at deres ansatte som arbeider på vår plass har skriftlig arbeidsavtale per AML §14-5 og §14-6?',
                       'type','yes_no','required',true,'law_ref','AML §14-5'),
    jsonb_build_object('id','q2','text','Bekrefter dere at arbeidstid følger AML kap. 10 for våre prosjekter?',
                       'type','yes_no','required',true,'law_ref','AML §10'),
    jsonb_build_object('id','q3','text','Last opp utdrag fra arbeidsavtale-mal',
                       'type','photo','required',true),
    jsonb_build_object('id','q4','text','Last opp HMS-policy',
                       'type','photo','required',true),
    jsonb_build_object('id','q5','text','Last opp BRREG-firmaattest',
                       'type','photo','required',true),
    jsonb_build_object('id','q6','text','Kommentar (frivillig)',
                       'type','long_text','required',false),
    jsonb_build_object('id','sig','text','Bekreftelse fra leverandør',
                       'type','respondent_signature','required',true)
  )),
  true,
  'vendor', null, null
),

-- ── 7) vendor: Prosjekt-sluttattest ───────────────────────────────────────
(
  'vendor-prosjekt-sluttattest', null, true,
  'Leverandør – prosjekt-sluttattest',
  'Prosjekt-slutt',
  'Prosjekt-sluttattest fra leverandør med læringspunkter, eventuelle avvik, og bekreftelse av kontraktsoppfyllelse.',
  '(kontraktsoppfølging)', 'vendor attestation',
  'vendor', 'external', 6,
  false,
  'Identifisert. Låses på publisering.',
  null,
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Er prosjektet levert i tråd med kontrakten?',
                       'type','yes_no','required',true),
    jsonb_build_object('id','q2','text','Forekom det HMS-avvik eller hendelser?',
                       'type','yes_no','required',true,'law_ref','AML §5-1'),
    jsonb_build_object('id','q3','text','Hvis ja — beskriv',
                       'type','long_text','required',false),
    jsonb_build_object('id','q4','text','Læringspunkter for fremtidige prosjekter',
                       'type','long_text','required',true),
    jsonb_build_object('id','q5','text','Vil dere ta på dere lignende oppdrag for oss igjen?',
                       'type','yes_no','required',false),
    jsonb_build_object('id','sig','text','Bekreftelse fra leverandør',
                       'type','respondent_signature','required',true)
  )),
  true,
  'vendor', null, null
),

-- ── 8) engagement: Leder-360 ───────────────────────────────────────────────
(
  'leadership-360', null, true,
  'Leder-360',
  'Leder-360',
  'Halvårlig 360-tilbakemelding på lederskap fra direkte rapporterende. Anonym, aggregert per leder med k=5.',
  'HR-praksis (ramme: AML §4-2 (3) utviklingsmuligheter)',
  'leader feedback', 'engagement', 'internal', 6,
  true,
  'Anonymisert. Aggregert per leder.',
  null,
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','Lederen min gir tydelig retning og mål.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q2','text','Lederen min gir konstruktive tilbakemeldinger.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q3','text','Lederen min følger opp HMS-saker når de oppstår.',
                       'type','likert_scale','required',true,'scale','likert_5','law_ref','AML §3-1'),
    jsonb_build_object('id','q4','text','Lederen min legger til rette for medvirkning og utvikling.',
                       'type','likert_scale','required',true,'scale','likert_5','law_ref','AML §4-2'),
    jsonb_build_object('id','q5','text','Hva er styrkene til lederen din?',
                       'type','long_text','required',false),
    jsonb_build_object('id','q6','text','Hva ønsker du at lederen din gjør annerledes?',
                       'type','long_text','required',false)
  )),
  true,
  'engagement', 6, null
),

-- ── 9) engagement: Team-puls kvartal ───────────────────────────────────────
(
  'team-pulse-kvartal', null, true,
  'Team-puls (kvartal)',
  'Team-puls',
  'Kort kvartalsvis puls — fem spørsmål om team-helse, energi, retning og samarbeid.',
  'HR-praksis', 'team pulse', 'engagement', 'internal', 2,
  true,
  'Anonymisert. Trend per kvartal.',
  null,
  jsonb_build_object('version', 1, 'questions', jsonb_build_array(
    jsonb_build_object('id','q1','text','I dette teamet har jeg energien jeg trenger.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q2','text','Jeg vet hva jeg skal jobbe med denne uken.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q3','text','Jeg får støtte fra teamet når jeg trenger det.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q4','text','Jeg har mulighet til å bruke styrkene mine.',
                       'type','likert_scale','required',true,'scale','likert_5'),
    jsonb_build_object('id','q5','text','En ting som ville gjort uken min bedre? (frivillig)',
                       'type','long_text','required',false)
  )),
  true,
  'engagement', 3, null
)

on conflict (id) do nothing;

-- ── Provision newly-added templates into existing orgs ─────────────────────
do $$
declare v_pack record;
begin
  for v_pack in
    select organization_id, slug from public.survey_packs
    where is_active = true and deleted_at is null
      and slug in ('arbeidsmiljo', 'vendor', 'engagement')
  loop
    perform public.provision_survey_baseline_for_org(v_pack.organization_id, v_pack.slug);
  end loop;
end $$;
