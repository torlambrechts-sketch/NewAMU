-- AML kapittel 5 — Registrerings- og meldeplikt om personskader.
--
-- Coverage gap closed:
--   § 5-1 plikt til å registrere skader og sykdommer.
--   § 5-2 arbeidsgivers varslings- og meldeplikt (Arbeidstilsynet ved
--   alvorlig skade/dødsfall; politi).
--   § 5-3 arbeidstakers melde- og opplysningsplikt.
--   FOR-1958-12-19-1 / FOR-2007-04-26-462 — folketrygdens skjema for
--   melding til NAV.
--
-- Two artifacts:
--   1. Register type aml_5_personskade — strukturert register over
--      personskader. Felter dekker både RTV-skjemaet (NAV) og § 5-2-
--      varslingen til Arbeidstilsynet, slik at registret kan brukes
--      som primærkilde ved tilsyn.
--   2. Compliance checklist personskade-melderutiner — kvartalsvis
--      kontroll av at faktisk inntrufne skader er registrert,
--      undersøkt og meldt innenfor frister.
--
-- Self-audit (Arbeidstilsynet POV): Tilsynet ber rutinemessig om
-- skadestatistikk siste 3 år. Pålegg-grunner i praksis: (a) underregi-
-- strering — særlig nesten-ulykker og psykiske belastningsskader, (b)
-- sen § 5-2-varsling ved alvorlig skade (krav: «snarest mulig»), (c)
-- ingen rotårsaksanalyse. Templatene treffer alle tre. Restrisiko:
-- yrkessykdomsmeldinger (særlig FOR-1997-03-11-220) varierer fra
-- bransje til bransje — register-type-feltet «sykdom_kategori» er
-- valgfritt, ikke uttømmende.

set local search_path = public, pg_catalog;

-- ── 1. Register type: aml_5_personskade ───────────────────────────────────

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, aml_paragraphs,
  default_review_cadence_months, is_active, is_system, position
) values (
  'aml_5_personskade',
  null,
  'Personskaderegister',
  'Lovpålagt register over arbeidsulykker, personskader og arbeidsrelaterte sykdommer etter AML §§ 5-1 og 5-2. Dekker både NAV-skademelding og varsling til Arbeidstilsynet.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key','case_id','label','Saks-ID','kind','text','required',true,'hint','Intern saksreferanse'),
      jsonb_build_object('key','incident_at','label','Tidspunkt for hendelse','kind','date','required',true),
      jsonb_build_object('key','reported_at','label','Meldt internt','kind','date','required',true),
      jsonb_build_object('key','injured_name','label','Skadelidt — navn','kind','text','required',true),
      jsonb_build_object('key','injured_role','label','Stilling / rolle','kind','text'),
      jsonb_build_object('key','injured_employment_type','label','Tilknytning','kind','select',
        'options', jsonb_build_array(
          jsonb_build_object('value','employee','label','Fast ansatt'),
          jsonb_build_object('value','temporary','label','Midlertidig ansatt'),
          jsonb_build_object('value','hired','label','Innleid'),
          jsonb_build_object('value','contractor','label','Underleverandør'),
          jsonb_build_object('value','student','label','Lærling / elev / praktikant'),
          jsonb_build_object('value','other','label','Annet'))),
      jsonb_build_object('key','location','label','Hendelsessted','kind','text','required',true),
      jsonb_build_object('key','department','label','Avdeling','kind','text'),
      jsonb_build_object('key','description','label','Beskrivelse av hendelsen','kind','text','required',true,
        'hint','Hva skjedde, hvilke arbeidsoperasjoner pågikk, sekvens.'),
      jsonb_build_object('key','injury_type','label','Skadetype','kind','select','required',true,
        'options', jsonb_build_array(
          jsonb_build_object('value','cut','label','Kutt / sårskade'),
          jsonb_build_object('value','fracture','label','Brudd'),
          jsonb_build_object('value','burn','label','Brannskade'),
          jsonb_build_object('value','crush','label','Klem-/knusningsskade'),
          jsonb_build_object('value','strain','label','Belastnings-/forstuvningsskade'),
          jsonb_build_object('value','chemical','label','Kjemisk eksponering'),
          jsonb_build_object('value','electrical','label','Elektrisk skade'),
          jsonb_build_object('value','fall','label','Fall — samme nivå'),
          jsonb_build_object('value','fall_height','label','Fall — fra høyde'),
          jsonb_build_object('value','psychosocial','label','Psykisk / belastning'),
          jsonb_build_object('value','occupational_disease','label','Yrkessykdom'),
          jsonb_build_object('value','near_miss','label','Nesten-ulykke (ingen fysisk skade)'),
          jsonb_build_object('value','other','label','Annet'))),
      jsonb_build_object('key','severity','label','Alvorlighetsgrad','kind','select','required',true,
        'hint','Avgjør § 5-2-varsel og NAV-melding.',
        'options', jsonb_build_array(
          jsonb_build_object('value','near_miss','label','Nestenulykke — ingen skade'),
          jsonb_build_object('value','minor','label','Mindre — ingen fravær eller medisinsk behandling'),
          jsonb_build_object('value','medical','label','Medisinsk behandling — uten fravær'),
          jsonb_build_object('value','lost_time','label','Fraværsskade — minst 1 dag'),
          jsonb_build_object('value','serious','label','Alvorlig skade'),
          jsonb_build_object('value','fatal','label','Dødsfall'))),
      jsonb_build_object('key','body_part','label','Skadet kroppsdel','kind','select_multi',
        'options', jsonb_build_array(
          jsonb_build_object('value','head','label','Hode'),
          jsonb_build_object('value','eye','label','Øye'),
          jsonb_build_object('value','torso','label','Overkropp / rygg'),
          jsonb_build_object('value','arm_hand','label','Arm / hånd'),
          jsonb_build_object('value','leg_foot','label','Ben / fot'),
          jsonb_build_object('value','internal','label','Indre organer'),
          jsonb_build_object('value','psyche','label','Psyke'),
          jsonb_build_object('value','other','label','Annet'))),
      jsonb_build_object('key','immediate_action','label','Førstehjelp / tiltak iverksatt','kind','text'),
      jsonb_build_object('key','medical_treatment','label','Medisinsk behandling','kind','select',
        'options', jsonb_build_array(
          jsonb_build_object('value','none','label','Ingen'),
          jsonb_build_object('value','first_aid','label','Førstehjelp'),
          jsonb_build_object('value','gp','label','Lege / fastlege'),
          jsonb_build_object('value','er','label','Akuttmottak'),
          jsonb_build_object('value','hospital','label','Innleggelse'))),
      jsonb_build_object('key','sick_leave_days','label','Fraværsdager (estimat)','kind','number'),
      jsonb_build_object('key','arbeidstilsynet_varsel','label','Varslet Arbeidstilsynet (§ 5-2)','kind','boolean',
        'hint','Påkrevd ved dødsfall eller alvorlig skade — snarest mulig.'),
      jsonb_build_object('key','arbeidstilsynet_varsel_at','label','Tidspunkt for varsel','kind','date'),
      jsonb_build_object('key','politi_varsel','label','Varslet politiet','kind','boolean',
        'hint','Påkrevd ved dødsfall.'),
      jsonb_build_object('key','nav_skademelding','label','NAV — skademelding sendt','kind','boolean',
        'hint','Folketrygdloven § 13-14 — yrkesskade med fraværsrisiko.'),
      jsonb_build_object('key','nav_skademelding_at','label','Tidspunkt for NAV-melding','kind','date'),
      jsonb_build_object('key','rotarsak','label','Rotårsaksanalyse','kind','text',
        'hint','Bakenforliggende årsak — ikke bare den umiddelbare. Krav for alvorlige hendelser.'),
      jsonb_build_object('key','tiltak','label','Iverksatte tiltak','kind','text',
        'hint','Konkret, med ansvar og frist.'),
      jsonb_build_object('key','tiltak_status','label','Tiltaksstatus','kind','select',
        'options', jsonb_build_array(
          jsonb_build_object('value','planned','label','Planlagt'),
          jsonb_build_object('value','in_progress','label','Pågår'),
          jsonb_build_object('value','done','label','Gjennomført'),
          jsonb_build_object('value','verified','label','Effekt verifisert'))),
      jsonb_build_object('key','vo_informert','label','Verneombud informert','kind','boolean'),
      jsonb_build_object('key','amu_orientert','label','AMU orientert','kind','boolean'),
      jsonb_build_object('key','closed_at','label','Sak lukket','kind','date'),
      jsonb_build_object('key','attachments','label','Dokumenter','kind','doc_ref',
        'hint','Lenke fotos, undersøkelsesrapport, legeerklæring, NAV-skjema, varslingsbekreftelse.')
    )
  ),
  array['aml','folketrygdloven']::text[],
  array['aml-amu']::text[],
  array['AML § 5-1','AML § 5-2','AML § 5-3']::text[],
  null,
  true, true, 40
)
on conflict (id) do update set
  metadata_schema = excluded.metadata_schema,
  regulation_ids = excluded.regulation_ids,
  pack_slugs = excluded.pack_slugs,
  aml_paragraphs = excluded.aml_paragraphs,
  description = excluded.description,
  position = excluded.position;

-- Mirror to existing orgs via the standard provision function.
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.provision_registers_baseline_for_org(v_org_id);
  end loop;
end $$;

-- ── 2. Compliance checklist: personskade-melderutiner ─────────────────────

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      law_refs, is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      v_org_id,
      'aml-amu',
      'personskade-kvartalsgjennomgang',
      'Personskader — kvartalsvis melderutinekontroll',
      'Kvartalsvis kontroll av at AML §§ 5-1, 5-2 og 5-3 er praktisert: alle hendelser registrert, alvorlige skader varslet rettidig til Arbeidstilsynet, og NAV-skademelding sendt der det kreves.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','register_komplett','prompt','Er alle registrerte skader/sykdommer i siste kvartal lagt inn i personskaderegistret med fullstendig informasjon?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 5-1','severity_default','critical'),
        jsonb_build_object('key','nesten_ulykker','prompt','Er nesten-ulykker (uten fysisk skade) også registrert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 5-1 + IK-f § 5','severity_default','high',
                           'help','Underregistrering av nesten-ulykker er typisk pålegg-grunn — gir tapt læring.'),
        jsonb_build_object('key','varsel_alvorlig','prompt','Er alle alvorlige skader / dødsfall varslet til Arbeidstilsynet snarest mulig (§ 5-2)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 5-2','severity_default','critical'),
        jsonb_build_object('key','politi_dødsfall','prompt','Er politiet varslet ved dødsfall?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 5-2','severity_default','critical'),
        jsonb_build_object('key','nav_melding','prompt','Er det sendt skademelding til NAV for skader som omfattes av folketrygdloven § 13-14?',
                           'type','yes_no_na','required',true,
                           'law_ref','Folketrygdloven § 13-14','severity_default','high'),
        jsonb_build_object('key','rotaarsak','prompt','Er det utført rotårsaksanalyse for alvorlige hendelser i kvartalet?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 7','severity_default','high'),
        jsonb_build_object('key','tiltak_dokumentert','prompt','Er konkrete forebyggende tiltak iverksatt og dokumentert med ansvar og frist?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-1 + IK-f § 5','severity_default','high'),
        jsonb_build_object('key','tiltak_effekt','prompt','Er effekten av tidligere tiltak verifisert (lukket etter dokumentert effekt)?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 7','severity_default','medium'),
        jsonb_build_object('key','vo_informert','prompt','Er verneombud informert om alle hendelser?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 6-2','severity_default','high'),
        jsonb_build_object('key','amu_orientert','prompt','Er AMU orientert med statistikk og trender for kvartalet?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 7-2 (e)','severity_default','medium'),
        jsonb_build_object('key','arbeidstaker_medvirkning','prompt','Har arbeidstakere som har vært involvert deltatt i etter-arbeidet (medvirkning)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 5-3','severity_default','medium'),
        jsonb_build_object('key','statistikk_trend','prompt','Vurderer statistikken (frekvens / alvorlighet / type) en negativ trend som krever overordnet tiltak?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-1 (2c)','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / særlige forhold','type','text','required',false),
        jsonb_build_object('key','sign_hms','prompt','HMS-leders signatur','type','signature','required',true),
        jsonb_build_object('key','sign_vo','prompt','Verneombudets signatur','type','signature','required',true)
      )),
      array['AML § 5-1','AML § 5-2','AML § 5-3','Folketrygdloven § 13-14']::text[],
      true, false, true, 'draft', 'kvartalsvis'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
