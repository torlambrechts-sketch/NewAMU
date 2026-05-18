-- ISO IMS — six new system register types.
--
-- Gaps closed:
--   ISO 45001 §6.1.2  — hazard identification and risk assessment (HIRA)
--   ISO 14001 §6.1.2  — environmental aspects and impacts
--   ISO 14001 §6.1.3 / ISO 45001 §6.1.3 — compliance obligation register (shared)
--   ISO 27001 A.5.9   — information asset register
--   ISO 27001 §6.1.2  — information security risk treatment register
--   ISO 14001 §8.2 / ISO 45001 §8.2 — emergency preparedness register (shared)
--
-- Self-audit:
--   Addressed: field schema covers the mandatory data points for each clause.
--   Restrisiko deferred: automated significance/risk scoring computation,
--   mandatory-field enforcement per-record (done in app layer, not DB).
--   Risk matrix visualization for HIRA ships in Phase 3 (heatmap widget).
--
-- All types seed with is_active=true so provision_registers_baseline_for_org
-- (called on new-org trigger) includes them automatically. Existing orgs
-- receive them via the backfill loop at the bottom of this migration.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- studio_capture_revision() tries to cast the text PK as UUID and fails on
-- system register types (id = 'hira' etc.). Disable user triggers for the
-- duration of these inserts; re-enable immediately after.
alter table public.register_types disable trigger user;

-- ── 1. hira — Hazard Identification and Risk Assessment ───────────────────────
-- ISO 45001:2018 §6.1.2

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'hira', null,
  'Fareidentifikasjon og risikovurdering (HIRA)',
  'Systematisk identifikasjon av farer og vurdering av arbeidsmiljørisiko. Dekker ISO 45001 §6.1.2 og AML §3-1. Hver rad representerer én fare med tilhørende risikovurdering og hierarki av tiltak.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','hazard_description','label','Fare / farekilden','kind','text','required',true,
      'hint','Beskriv faresituasjonen tydelig, f.eks. "Manuell løfting av tunge gjenstander"'),
    jsonb_build_object('key','activity_process','label','Aktivitet / prosess','kind','text','required',true),
    jsonb_build_object('key','hazard_category','label','Farekategori','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','physical',       'label','Fysisk'),
        jsonb_build_object('value','chemical',       'label','Kjemisk'),
        jsonb_build_object('value','biological',     'label','Biologisk'),
        jsonb_build_object('value','ergonomic',      'label','Ergonomisk'),
        jsonb_build_object('value','psychosocial',   'label','Psykososialt'),
        jsonb_build_object('value','electrical',     'label','Elektrisk'),
        jsonb_build_object('value','fire_explosion', 'label','Brann / eksplosjon'),
        jsonb_build_object('value','other',          'label','Annet')
      )),
    jsonb_build_object('key','affected_persons','label','Berørte personer','kind','text',
      'hint','Hvem er eksponert? F.eks. "Lagermedarbeidere", "Besøkende"'),
    jsonb_build_object('key','likelihood_before','label','Sannsynlighet (uten tiltak)','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Usannsynlig'),
        jsonb_build_object('value','2','label','2 — Sjelden'),
        jsonb_build_object('value','3','label','3 — Mulig'),
        jsonb_build_object('value','4','label','4 — Sannsynlig'),
        jsonb_build_object('value','5','label','5 — Nesten sikkert')
      )),
    jsonb_build_object('key','severity','label','Konsekvens','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Ubetydelig'),
        jsonb_build_object('value','2','label','2 — Lav'),
        jsonb_build_object('value','3','label','3 — Moderat'),
        jsonb_build_object('value','4','label','4 — Alvorlig'),
        jsonb_build_object('value','5','label','5 — Katastrofal')
      )),
    jsonb_build_object('key','controls_hierarchy','label','Hierarki av tiltak (gjennomført)','kind','select_multi',
      'hint','ISO 45001 §8.1.2 — velg alle som er implementert',
      'options', jsonb_build_array(
        jsonb_build_object('value','elimination',     'label','1. Eliminering'),
        jsonb_build_object('value','substitution',    'label','2. Substitusjon'),
        jsonb_build_object('value','engineering',     'label','3. Tekniske tiltak'),
        jsonb_build_object('value','administrative',  'label','4. Administrative tiltak'),
        jsonb_build_object('value','ppe',             'label','5. Personlig verneutstyr (PVU)')
      )),
    jsonb_build_object('key','controls_description','label','Beskrivelse av tiltak','kind','text'),
    jsonb_build_object('key','likelihood_after','label','Restrisiko — sannsynlighet','kind','select',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Usannsynlig'),
        jsonb_build_object('value','2','label','2 — Sjelden'),
        jsonb_build_object('value','3','label','3 — Mulig'),
        jsonb_build_object('value','4','label','4 — Sannsynlig'),
        jsonb_build_object('value','5','label','5 — Nesten sikkert')
      )),
    jsonb_build_object('key','responsible','label','Ansvarlig','kind','text'),
    jsonb_build_object('key','review_due','label','Neste gjennomgang','kind','date')
  )),
  array['iso-45001', 'aml']::text[],
  array['iso-45001']::text[],
  12, true, true, 40
) on conflict (id) do nothing;

-- ── 2. environmental_aspects — Environmental Aspects and Impacts ───────────────
-- ISO 14001:2015 §6.1.2

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'environmental_aspects', null,
  'Miljøaspekter og -påvirkninger',
  'Register over organisasjonens aktiviteter, produkter og tjenester som kan påvirke miljøet, med signifikansvurdering. Dekker ISO 14001 §6.1.2.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','aspect','label','Miljøaspekt','kind','text','required',true,
      'hint','Hva er elementet i organisasjonens aktivitet/produkt/tjeneste? F.eks. "Kjøretøyutslipp"'),
    jsonb_build_object('key','impact','label','Miljøpåvirkning','kind','text','required',true,
      'hint','Hva er den faktiske eller potensielle endringen i miljøet? F.eks. "Luftforurensning"'),
    jsonb_build_object('key','activity','label','Aktivitet / prosess','kind','text','required',true),
    jsonb_build_object('key','condition','label','Driftstilstand','kind','select',
      'options', jsonb_build_array(
        jsonb_build_object('value','normal',    'label','Normal drift'),
        jsonb_build_object('value','abnormal',  'label','Unormal drift'),
        jsonb_build_object('value','emergency', 'label','Nødssituasjon')
      )),
    jsonb_build_object('key','aspect_type','label','Aspekttype','kind','select',
      'options', jsonb_build_array(
        jsonb_build_object('value','air',       'label','Luftutslipp'),
        jsonb_build_object('value','water',     'label','Vannutslipp'),
        jsonb_build_object('value','waste',     'label','Avfallsgenerering'),
        jsonb_build_object('value','energy',    'label','Energibruk'),
        jsonb_build_object('value','land',      'label','Landbruk'),
        jsonb_build_object('value','noise',     'label','Støy'),
        jsonb_build_object('value','resources', 'label','Ressursbruk'),
        jsonb_build_object('value','other',     'label','Annet')
      )),
    jsonb_build_object('key','scale','label','Omfang (1-5)','kind','select',
      'hint','Hvor stort geografisk/mengdemessig omfang?',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Lokalt/minimalt'),
        jsonb_build_object('value','2','label','2 — Lokalt/moderat'),
        jsonb_build_object('value','3','label','3 — Regionalt'),
        jsonb_build_object('value','4','label','4 — Nasjonalt'),
        jsonb_build_object('value','5','label','5 — Globalt')
      )),
    jsonb_build_object('key','severity_env','label','Alvorlighetsgrad (1-5)','kind','select',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Ubetydelig'),
        jsonb_build_object('value','2','label','2 — Liten'),
        jsonb_build_object('value','3','label','3 — Moderat'),
        jsonb_build_object('value','4','label','4 — Stor'),
        jsonb_build_object('value','5','label','5 — Alvorlig')
      )),
    jsonb_build_object('key','is_significant','label','Signifikant miljøaspekt','kind','boolean',
      'hint','Markeres som signifikant når scale × severity >= 9 eller ved skjønnsmessig vurdering'),
    jsonb_build_object('key','legal_reference','label','Lovkrav / tillatelse','kind','text',
      'hint','F.eks. "Forurensningsloven §7", "Utslippstillatelse 2024-001"'),
    jsonb_build_object('key','control_measures','label','Kontrolltiltak','kind','text'),
    jsonb_build_object('key','responsible','label','Ansvarlig','kind','text')
  )),
  array['iso-14001']::text[],
  array['iso-14001']::text[],
  12, true, true, 50
) on conflict (id) do nothing;

-- ── 3. legal_compliance — Legal and Compliance Obligations Register ────────────
-- ISO 14001:2015 §6.1.3 + ISO 45001:2018 §6.1.3

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'legal_compliance', null,
  'Lov- og kravregister',
  'Register over alle bindende forpliktelser (lover, forskrifter, tillatelser, avtaler) som gjelder for organisasjonens miljø- og HMS-arbeid. Dekker ISO 14001 §6.1.3 og ISO 45001 §6.1.3.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','requirement_name','label','Krav / lov','kind','text','required',true,
      'hint','F.eks. "Arbeidsmiljøloven", "REACH-forordningen", "Kommunal utslippstillatelse"'),
    jsonb_build_object('key','requirement_type','label','Type','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','law',         'label','Lov / forskrift'),
        jsonb_build_object('value','permit',      'label','Tillatelse / konsesjon'),
        jsonb_build_object('value','agreement',   'label','Avtale / kontrakt'),
        jsonb_build_object('value','standard',    'label','Standard / bransjenorm'),
        jsonb_build_object('value','voluntary',   'label','Frivillig forpliktelse')
      )),
    jsonb_build_object('key','issuing_authority','label','Utstedende myndighet','kind','text',
      'hint','F.eks. "Arbeidstilsynet", "Miljødirektoratet", "Datatilsynet"'),
    jsonb_build_object('key','applicability','label','Hva gjelder kravet?','kind','text','required',true,
      'hint','Beskriv hvilke aktiviteter/prosesser/aspekter kravet dekker'),
    jsonb_build_object('key','standard_category','label','Gjelder for','kind','select_multi',
      'options', jsonb_build_array(
        jsonb_build_object('value','hms',         'label','HMS (45001)'),
        jsonb_build_object('value','environment', 'label','Miljø (14001)'),
        jsonb_build_object('value','quality',     'label','Kvalitet (9001)'),
        jsonb_build_object('value','isms',        'label','Informasjonssikkerhet (27001)')
      )),
    jsonb_build_object('key','compliance_status','label','Etterlevingsstatus','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','compliant',     'label','Etterleves'),
        jsonb_build_object('value','partial',       'label','Delvis etterlevet'),
        jsonb_build_object('value','non_compliant', 'label','Ikke etterlevet'),
        jsonb_build_object('value','not_assessed',  'label','Ikke vurdert')
      )),
    jsonb_build_object('key','compliance_evidence','label','Dokumentasjon / bevis','kind','text'),
    jsonb_build_object('key','last_evaluation_at','label','Sist evaluert','kind','date'),
    jsonb_build_object('key','next_evaluation_at','label','Neste evaluering','kind','date'),
    jsonb_build_object('key','responsible','label','Ansvarlig','kind','text')
  )),
  array['iso-14001', 'iso-45001', 'aml']::text[],
  array['iso-14001', 'iso-45001']::text[],
  12, true, true, 60
) on conflict (id) do nothing;

-- ── 4. iso_asset_register — Information Asset Register ────────────────────────
-- ISO 27001:2022 A.5.9

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'iso_asset_register', null,
  'Informasjonseiendelsregister',
  'Inventar over organisasjonens informasjonseiendeler med eiere, klassifisering og CIA-vurdering (konfidensialitet, integritet, tilgjengelighet). Dekker ISO 27001:2022 A.5.9.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','asset_name','label','Eiendelsnavn','kind','text','required',true,
      'hint','F.eks. "Kundebase", "HR-system", "Kildekode"'),
    jsonb_build_object('key','asset_type','label','Eiendelstype','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','data',          'label','Data / informasjon'),
        jsonb_build_object('value','software',      'label','Programvare'),
        jsonb_build_object('value','hardware',      'label','Maskinvare'),
        jsonb_build_object('value','service',       'label','Tjeneste / cloud'),
        jsonb_build_object('value','people',        'label','Mennesker / kompetanse'),
        jsonb_build_object('value','facility',      'label','Lokaler'),
        jsonb_build_object('value','intangible',    'label','Immateriell rettighet')
      )),
    jsonb_build_object('key','owner','label','Eier','kind','text','required',true,
      'hint','Person eller rolle ansvarlig for eiendelen'),
    jsonb_build_object('key','location','label','Lagringslokasjon','kind','text',
      'hint','F.eks. "AWS eu-north-1", "Serverrom Oslo", "Skrivebord 3.etg"'),
    jsonb_build_object('key','classification','label','Klassifisering','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','public',        'label','Offentlig'),
        jsonb_build_object('value','internal',      'label','Intern'),
        jsonb_build_object('value','confidential',  'label','Konfidensiell'),
        jsonb_build_object('value','restricted',    'label','Strengt konfidensiell')
      )),
    jsonb_build_object('key','confidentiality','label','Konfidensialitet (C)','kind','select',
      'hint','Konsekvens ved uautorisert tilgang',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Lav'),
        jsonb_build_object('value','2','label','2 — Middels'),
        jsonb_build_object('value','3','label','3 — Høy')
      )),
    jsonb_build_object('key','integrity','label','Integritet (I)','kind','select',
      'hint','Konsekvens ved uautorisert endring',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Lav'),
        jsonb_build_object('value','2','label','2 — Middels'),
        jsonb_build_object('value','3','label','3 — Høy')
      )),
    jsonb_build_object('key','availability','label','Tilgjengelighet (A)','kind','select',
      'hint','Konsekvens ved bortfall av tilgang',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Lav'),
        jsonb_build_object('value','2','label','2 — Middels'),
        jsonb_build_object('value','3','label','3 — Høy')
      )),
    jsonb_build_object('key','personal_data','label','Inneholder personopplysninger','kind','boolean'),
    jsonb_build_object('key','gdpr_basis','label','Behandlingsgrunnlag (GDPR)','kind','text',
      'hint','Fyll ut dersom eiendelen behandler personopplysninger')
  )),
  array['iso-27001', 'gdpr']::text[],
  array['iso-27001']::text[],
  12, true, true, 70
) on conflict (id) do nothing;

-- ── 5. iso_risk_treatment — Information Security Risk Treatment ────────────────
-- ISO 27001:2022 §6.1.2 + §6.1.3

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'iso_risk_treatment', null,
  'Informasjonssikkerhetsrisiko',
  'Risikovurdering og behandlingsplan for informasjonssikkerhetsrisikoer — eiendel × trussel × sårbarhet. Dekker ISO 27001 §6.1.2 og §6.1.3.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','risk_title','label','Risikobeskrivelse','kind','text','required',true,
      'hint','F.eks. "Uautorisert tilgang til kundedata via phishing"'),
    jsonb_build_object('key','affected_asset','label','Berørt eiendel','kind','text','required',true,
      'hint','Referanse til informasjonseiendelsregisteret'),
    jsonb_build_object('key','threat','label','Trussel','kind','text','required',true,
      'hint','F.eks. "Phishing", "Insider-trussel", "Brann i datasenter"'),
    jsonb_build_object('key','vulnerability','label','Sårbarhet','kind','text',
      'hint','F.eks. "Manglende MFA", "Utdatert programvare"'),
    jsonb_build_object('key','likelihood_before','label','Sannsynlighet (uten tiltak)','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Svært lav'),
        jsonb_build_object('value','2','label','2 — Lav'),
        jsonb_build_object('value','3','label','3 — Middels'),
        jsonb_build_object('value','4','label','4 — Høy'),
        jsonb_build_object('value','5','label','5 — Svært høy')
      )),
    jsonb_build_object('key','impact','label','Konsekvens','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Ubetydelig'),
        jsonb_build_object('value','2','label','2 — Liten'),
        jsonb_build_object('value','3','label','3 — Moderat'),
        jsonb_build_object('value','4','label','4 — Stor'),
        jsonb_build_object('value','5','label','5 — Katastrofal')
      )),
    jsonb_build_object('key','treatment_option','label','Behandlingsvalg','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','mitigate',  'label','Reduser (implementer kontroll)'),
        jsonb_build_object('value','accept',    'label','Aksepter'),
        jsonb_build_object('value','transfer',  'label','Overfør (forsikring / leverandør)'),
        jsonb_build_object('value','avoid',     'label','Unngå (avslutt aktivitet)')
      )),
    jsonb_build_object('key','annex_a_controls','label','Relevante Annex A-kontroller','kind','text',
      'hint','F.eks. "A.8.5, A.5.17" — referanse til SoA'),
    jsonb_build_object('key','residual_likelihood','label','Restrisiko — sannsynlighet','kind','select',
      'options', jsonb_build_array(
        jsonb_build_object('value','1','label','1 — Svært lav'),
        jsonb_build_object('value','2','label','2 — Lav'),
        jsonb_build_object('value','3','label','3 — Middels'),
        jsonb_build_object('value','4','label','4 — Høy'),
        jsonb_build_object('value','5','label','5 — Svært høy')
      )),
    jsonb_build_object('key','risk_owner','label','Risikoeier','kind','text','required',true),
    jsonb_build_object('key','treatment_deadline','label','Behandlingsfrist','kind','date')
  )),
  array['iso-27001']::text[],
  array['iso-27001']::text[],
  12, true, true, 80
) on conflict (id) do nothing;

-- ── 6. emergency_preparedness — Emergency Preparedness ───────────────────────
-- ISO 14001:2015 §8.2 + ISO 45001:2018 §8.2

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'emergency_preparedness', null,
  'Beredskapsscenarioer',
  'Register over identifiserte nødssituasjoner og beredskapsplaner, inkludert øvelseshistorikk. Dekker ISO 14001 §8.2 og ISO 45001 §8.2.',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('key','scenario','label','Scenario','kind','text','required',true,
      'hint','F.eks. "Brann i produksjonshall", "Kjemikaliesøl", "IT-sammenbrudd"'),
    jsonb_build_object('key','scenario_type','label','Type scenario','kind','select','required',true,
      'options', jsonb_build_array(
        jsonb_build_object('value','fire',         'label','Brann'),
        jsonb_build_object('value','chemical',     'label','Kjemikalie / farlig stoff'),
        jsonb_build_object('value','natural',      'label','Naturhendelse'),
        jsonb_build_object('value','it_outage',    'label','IT-bortfall'),
        jsonb_build_object('value','power',        'label','Strømbrudd'),
        jsonb_build_object('value','pandemic',     'label','Pandemi'),
        jsonb_build_object('value','evacuation',   'label','Evakuering'),
        jsonb_build_object('value','other',        'label','Annet')
      )),
    jsonb_build_object('key','standard_scope','label','Gjelder for standard','kind','select_multi',
      'options', jsonb_build_array(
        jsonb_build_object('value','iso-14001','label','ISO 14001 (miljø)'),
        jsonb_build_object('value','iso-45001','label','ISO 45001 (HMS)')
      )),
    jsonb_build_object('key','response_plan_exists','label','Beredskapsplan dokumentert','kind','boolean','required',true),
    jsonb_build_object('key','response_plan_ref','label','Referanse til beredskapsplan','kind','text',
      'hint','Dokumentnavn eller lenke i Dokumenter-modulen'),
    jsonb_build_object('key','responsible','label','Ansvarlig','kind','text','required',true),
    jsonb_build_object('key','drill_required','label','Øvelse påkrevd','kind','boolean'),
    jsonb_build_object('key','last_drill_at','label','Dato for siste øvelse','kind','date'),
    jsonb_build_object('key','drill_notes','label','Øvelsesnotater / funn','kind','text')
  )),
  array['iso-14001', 'iso-45001', 'aml']::text[],
  array['iso-14001', 'iso-45001']::text[],
  12, true, true, 90
) on conflict (id) do nothing;

alter table public.register_types enable trigger user;

-- ── 7. Backfill existing orgs ─────────────────────────────────────────────────
-- provision_registers_baseline_for_org selects all active system types and
-- inserts register_org_settings rows. New types added above will appear for
-- all existing orgs after this loop.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_registers_baseline_for_org(v_org.id);
  end loop;
end $$;
