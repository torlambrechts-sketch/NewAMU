-- AML kapittel 16 (Virksomhetsoverdragelse) + kapittel 18 (Tilsyn).
--
-- Coverage gap closed:
--   § 16-1 til § 16-7 — virksomhetsoverdragelse: rettighets-/pliktoverføring,
--     drøfting og informasjon, reservasjons- og valgrett, oppsigelsesvern.
--   Kapittel 18 — Arbeidstilsynets tilsyn, pålegg og reaksjoner.
--
-- Three artifacts:
--   1. Document tpl-virksomhetsoverdragelse-rutine — prosedyre + brev-
--      mal til ansatte (informasjon + reservasjonsrett).
--   2. Compliance checklist virksomhetsoverdragelse-sjekk — sjekkliste
--      til bruk ved konkret overdragelse (ikke recurring).
--   3. Register type aml_18_tilsynssaker — register for å spore tilsyn,
--      pålegg, frister og lukking.
--
-- Self-audit (Arbeidstilsynet POV): § 16 håndheves i hovedsak via
-- søksmål, ikke direkte pålegg, men § 16-5 informasjon og drøfting er
-- en lovpålagt prosess som regelmessig bryter — særlig fristen for
-- forhåndsinformasjon. Tilsynssaks-registret er ikke pålagt som sådan,
-- men gir bevis-trail og styrer påleggsoppfølging — kritisk for
-- sjekkliste-pakken under § 18.

set local search_path = public, pg_catalog;

-- ── 1. Document: virksomhetsoverdragelse-rutine ───────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-virksomhetsoverdragelse-rutine',
  'tpl-virksomhetsoverdragelse-rutine',
  'Virksomhetsoverdragelse — rutine og brevmal',
  'Prosedyre + informasjonsbrev-mal etter AML kap. 16 ved overdragelse av virksomhet eller del av virksomhet.',
  'procedure',
  array['AML § 16-1','AML § 16-2','AML § 16-3','AML § 16-4','AML § 16-5','AML § 16-6','AML § 16-7']::text[],
  jsonb_build_object(
    'title','Virksomhetsoverdragelse — rutine',
    'summary','Slik gjennomfører vi en virksomhetsoverdragelse i tråd med AML kap. 16 og direktiv 2001/23/EF.',
    'status','draft','template','standard',
    'legalRefs', jsonb_build_array('AML § 16-1','AML § 16-2','AML § 16-5'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Manglende informasjon eller drøftelse etter § 16-5 kan føre til erstatningskrav. Frister er korte — start prosessen i god tid.'),
      jsonb_build_object('kind','heading','level',1,'text','Virksomhetsoverdragelse'),
      jsonb_build_object('kind','heading','level',2,'text','1. Anvendelsesområde'),
      jsonb_build_object('kind','text','body','<p>Kapittel 16 gjelder ved overdragelse av en virksomhet eller del av virksomhet til en annen arbeidsgiver. Formen kan være salg, fusjon, fisjon, outsourcing eller insourcing der det skjer overgang av en selvstendig økonomisk enhet som beholder sin identitet.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Rettighets-/pliktoverføring (§ 16-2)'),
      jsonb_build_object('kind','text','body','<p>Tidligere arbeidsgivers rettigheter og plikter overføres til den nye. Det gjelder også tariffavtale med mindre ny arbeidsgiver senest tre uker etter overdragelsen skriftlig erklærer overfor fagforeningen at den ikke vil bli bundet.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Pensjon (§ 16-2 (3))'),
      jsonb_build_object('kind','text','body','<p>Tjenestepensjonsrettigheter overføres med mindre ny arbeidsgiver velger å gjøre allerede eksisterende pensjonsordning gjeldende.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Reservasjonsrett (§ 16-3)'),
      jsonb_build_object('kind','text','body','<p>Arbeidstaker kan motsette seg at arbeidsforholdet overføres til ny arbeidsgiver. Frist for å reservere seg: en frist arbeidsgiver fastsetter, ikke kortere enn 14 dager etter at informasjon er gitt.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Valgrett (rettspraksis)'),
      jsonb_build_object('kind','text','body','<p>Ved stor ulempe for arbeidstaker kan denne ha valgrett — å fortsette i sitt opprinnelige arbeidsforhold hos overdrager. Vurderes konkret.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Vern mot oppsigelse (§ 16-4)'),
      jsonb_build_object('kind','text','body','<p>Overdragelsen i seg selv er ikke saklig grunn for oppsigelse fra noen av arbeidsgiverne. Saklig grunn må knyttes til andre forhold.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Informasjon og drøftelse (§ 16-5)'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Plikt</th><th>Frist</th></tr></thead><tbody><tr><td>Informasjon til tillitsvalgte (årsak, dato, juridiske/økonomiske/sosiale konsekvenser, planlagte tiltak)</td><td>Så tidlig som mulig</td></tr><tr><td>Drøftelse med tillitsvalgte</td><td>Så tidlig som mulig før overdragelsen</td></tr><tr><td>Informasjon til hver enkelt arbeidstaker</td><td>Så tidlig som mulig — minst om reservasjonsrett, dato og rettsvirkninger</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','8. Brevmal — informasjon til ansatt'),
      jsonb_build_object('kind','text','body',
        '<p style="border:1px solid #ddd;padding:12px"><em>Til [navn]</em></p><p>Vi informerer om at [virksomhet/del] overdras til [ny arbeidsgiver] med virkning fra [dd.mm.åååå]. Etter AML kap. 16 vil ditt arbeidsforhold overføres til [ny arbeidsgiver] med samme rettigheter og plikter — herunder lønn, ansiennitet, ferie og pensjon.</p><p>Tariffavtale: [overføres / ny arbeidsgiver vil senest tre uker etter overdragelse meddele om binding].</p><p>Du har rett til å reservere deg mot at arbeidsforholdet overføres. Reservasjon må gis skriftlig til [kontaktperson] innen [dd.mm.åååå] — minst 14 dager fra dette brev. Reservasjon medfører at arbeidsforholdet anses opphørt på overdragelsesdatoen.</p><p>Drøftelser med tillitsvalgte er holdt [dato]. Spørsmål kan rettes til [HR-kontakt].</p><p>Med vennlig hilsen, [Arbeidsgiver]</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 16-1','description','Anvendelsesområde','url','https://lovdata.no/lov/2005-06-17-62/§16-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 16-2','description','Rettighets-/pliktoverføring','url','https://lovdata.no/lov/2005-06-17-62/§16-2'),
      jsonb_build_object('kind','law_ref','ref','AML § 16-3','description','Reservasjonsrett','url','https://lovdata.no/lov/2005-06-17-62/§16-3'),
      jsonb_build_object('kind','law_ref','ref','AML § 16-5','description','Informasjon og drøftelse','url','https://lovdata.no/lov/2005-06-17-62/§16-5')
    )
  ),
  130
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Compliance checklist: virksomhetsoverdragelse-sjekk ────────────────

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
      'virksomhetsoverdragelse-sjekk',
      'Virksomhetsoverdragelse — gjennomføringssjekk',
      'Sjekkliste til bruk ved konkret overdragelse — bekrefter at AML §§ 16-2 til 16-5 er ivaretatt før, under og etter transaksjonen.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','omfattes','prompt','Er det avklart at transaksjonen omfattes av kap. 16 (selvstendig økonomisk enhet, identitet bevart)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-1','severity_default','critical'),
        jsonb_build_object('key','tv_info','prompt','Er tillitsvalgte informert så tidlig som mulig — om årsak, dato, konsekvenser og tiltak?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-5 (1)','severity_default','critical'),
        jsonb_build_object('key','tv_drofting','prompt','Er det gjennomført drøftelse med tillitsvalgte før overdragelsen?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-5 (2)','severity_default','critical'),
        jsonb_build_object('key','arb_info','prompt','Har hver enkelt arbeidstaker fått skriftlig informasjon om dato, rettsvirkninger og reservasjonsrett?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-5 (3)','severity_default','critical'),
        jsonb_build_object('key','reservasjonsfrist','prompt','Er det fastsatt en rimelig reservasjonsfrist på minst 14 dager?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-3','severity_default','high'),
        jsonb_build_object('key','tariffavtale','prompt','Er ny arbeidsgivers tariff-binding avklart (eller fristen for å erklære overfor fagforening notert)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-2 (2)','severity_default','high'),
        jsonb_build_object('key','pensjon','prompt','Er pensjonsordningen avklart — videreføres eller endres?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-2 (3)','severity_default','high'),
        jsonb_build_object('key','oppsigelser','prompt','Er det bekreftet at ingen er sagt opp på grunn av selve overdragelsen?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-4','severity_default','critical'),
        jsonb_build_object('key','dokumenter_overlevert','prompt','Er ansattlister, arbeidsavtaler og personalmapper overlevert ny arbeidsgiver i tråd med GDPR?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 6 + AML § 16-2','severity_default','high'),
        jsonb_build_object('key','reservasjoner','prompt','Er reservasjoner registrert og håndtert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 16-3','severity_default','high'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner','type','text','required',false),
        jsonb_build_object('key','sign_overdrager','prompt','Overdragers signatur','type','signature','required',true),
        jsonb_build_object('key','sign_erverver','prompt','Ny arbeidsgivers signatur','type','signature','required',false)
      )),
      array['AML § 16-1','AML § 16-2','AML § 16-3','AML § 16-4','AML § 16-5']::text[],
      true, false, true, 'draft', 'ad_hoc'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;

-- ── 3. Register type: aml_18_tilsynssaker ─────────────────────────────────
-- Sporing av tilsynsbesøk, pålegg og lukking. Ikke lovpålagt
-- struktur som sådan, men kritisk for å håndtere kapittel 18-prosessen.

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, aml_paragraphs,
  default_review_cadence_months, is_active, is_system, position
) values (
  'aml_18_tilsynssaker',
  null,
  'Tilsyns- og påleggsregister',
  'Register for tilsynsbesøk, pålegg og oppfølging fra Arbeidstilsynet og andre tilsynsmyndigheter (kapittel 18 + sektorlover).',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key','case_id','label','Saks-ID','kind','text','required',true),
      jsonb_build_object('key','authority','label','Tilsynsmyndighet','kind','select','required',true,
        'options', jsonb_build_array(
          jsonb_build_object('value','arbeidstilsynet','label','Arbeidstilsynet'),
          jsonb_build_object('value','datatilsynet','label','Datatilsynet'),
          jsonb_build_object('value','dsb','label','DSB / branntilsyn'),
          jsonb_build_object('value','helsetilsynet','label','Helsetilsynet'),
          jsonb_build_object('value','statens_jernbanetilsyn','label','Statens jernbanetilsyn'),
          jsonb_build_object('value','sjøfartsdir','label','Sjøfartsdirektoratet'),
          jsonb_build_object('value','luftfartstilsynet','label','Luftfartstilsynet'),
          jsonb_build_object('value','annet','label','Annet'))),
      jsonb_build_object('key','visit_type','label','Type tilsyn','kind','select','required',true,
        'options', jsonb_build_array(
          jsonb_build_object('value','onsite','label','Stedlig tilsyn'),
          jsonb_build_object('value','document','label','Dokumenttilsyn'),
          jsonb_build_object('value','revisjon','label','Revisjon'),
          jsonb_build_object('value','varslet','label','Varslet inspeksjon'),
          jsonb_build_object('value','uvarsla','label','Uvarslet inspeksjon'),
          jsonb_build_object('value','klage','label','Etter klage / tips'))),
      jsonb_build_object('key','visited_at','label','Tilsynsdato','kind','date','required',true),
      jsonb_build_object('key','reference','label','Tilsynets saksnummer','kind','text'),
      jsonb_build_object('key','inspectors','label','Tilsynspersonell','kind','text'),
      jsonb_build_object('key','attendees','label','Til stede fra virksomheten','kind','text'),
      jsonb_build_object('key','focus_areas','label','Tilsynstema','kind','text','hint','F.eks. arbeidstid, vern, kjemikalier, varsling.'),
      jsonb_build_object('key','observations','label','Observasjoner','kind','text','hint','Kort sammendrag av tilsynets funn.'),
      jsonb_build_object('key','outcome','label','Utfall','kind','select','required',true,
        'options', jsonb_build_array(
          jsonb_build_object('value','ingen_pålegg','label','Ingen pålegg'),
          jsonb_build_object('value','varsel_pålegg','label','Varsel om pålegg (§ 18-6)'),
          jsonb_build_object('value','pålegg','label','Pålegg gitt'),
          jsonb_build_object('value','tvangsmulkt','label','Pålegg + tvangsmulkt (§ 18-7)'),
          jsonb_build_object('value','stansing','label','Stansingsvedtak (§ 18-8)'),
          jsonb_build_object('value','overtredelsesgebyr','label','Overtredelsesgebyr (§ 18-10)'),
          jsonb_build_object('value','anmeldelse','label','Politianmeldelse'),
          jsonb_build_object('value','pågår','label','Saken pågår'))),
      jsonb_build_object('key','order_count','label','Antall pålegg','kind','number'),
      jsonb_build_object('key','order_summary','label','Sammendrag av pålegg','kind','text'),
      jsonb_build_object('key','deadline','label','Frist for retting','kind','date'),
      jsonb_build_object('key','responsible','label','Ansvarlig hos oss','kind','text','required',true),
      jsonb_build_object('key','remediation_plan','label','Plan for retting','kind','text'),
      jsonb_build_object('key','remediation_done_at','label','Retting bekreftet','kind','date'),
      jsonb_build_object('key','closure_letter','label','Avslutningsbrev mottatt','kind','boolean'),
      jsonb_build_object('key','closure_at','label','Sak avsluttet','kind','date'),
      jsonb_build_object('key','klage_filed','label','Klaget på vedtak','kind','boolean','hint','§ 18-6 (3) klagefrist 3 uker.'),
      jsonb_build_object('key','attachments','label','Dokumenter','kind','doc_ref',
        'hint','Lenke pålegg, varsel, dokumentasjon på retting, korrespondanse.')
    )
  ),
  array['aml']::text[],
  array['aml-amu']::text[],
  array['AML § 18-1','AML § 18-6','AML § 18-7','AML § 18-8','AML § 18-10']::text[],
  null,
  true, true, 50
)
on conflict (id) do update set
  metadata_schema = excluded.metadata_schema,
  regulation_ids = excluded.regulation_ids,
  pack_slugs = excluded.pack_slugs,
  aml_paragraphs = excluded.aml_paragraphs,
  description = excluded.description,
  position = excluded.position;

-- Mirror to existing orgs.
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.provision_registers_baseline_for_org(v_org_id);
  end loop;
end $$;
