-- AML kapittel 8 — Informasjon og drøfting.
--
-- Coverage gap closed:
--   §§ 8-1, 8-2, 8-3 — Plikt til informasjon og drøfting med tillits-
--   valgte for virksomheter med minst 50 ansatte. Konfidensialitet for
--   visse opplysninger.
--
-- To artifacts:
--   1. Document tpl-info-drofting-rutine — rutine for hva som
--      informeres / drøftes, frekvens, formkrav.
--   2. Compliance checklist info-drofting-arsgjennomgang — årlig
--      kontroll av at praksis er i tråd med kravet.
--
-- Self-audit: § 8 håndheves ikke direkte av Arbeidstilsynet i samme
-- grad som de fleste andre kapitler — tvist håndteres av tvisteløsnings-
-- nemnda. Men plikten er reell og brudd kan være saklig grunn for at
-- en fagforening reiser sak. Sjekklisten er primært bevis-trail.

set local search_path = public, pg_catalog;

-- ── 1. Document: info-drofting-rutine ─────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-info-drofting-rutine',
  'tpl-info-drofting-rutine',
  'Informasjon og drøfting med tillitsvalgte — rutine',
  'Lovpålagt rutine for informasjon og drøfting med tillitsvalgte etter AML kap. 8 (gjelder virksomheter med minst 50 ansatte).',
  'procedure',
  array['AML § 8-1', 'AML § 8-2', 'AML § 8-3']::text[],
  jsonb_build_object(
    'title','Informasjon og drøfting',
    'summary','Hvordan vi praktiserer den lovpålagte plikten til informasjon og drøfting med tillitsvalgte etter AML kap. 8.',
    'status','draft',
    'template','standard',
    'legalRefs', jsonb_build_array('AML § 8-1','AML § 8-2','AML § 8-3'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','info',
        'text','Plikten gjelder for virksomheter som «jevnlig sysselsetter» minst 50 arbeidstakere. Plikten er supplerende til særskilte drøftingskrav i §§ 14-9, 15-1, 16-5 mv.'),
      jsonb_build_object('kind','heading','level',1,'text','Informasjon og drøfting'),
      jsonb_build_object('kind','heading','level',2,'text','1. Hva skal informeres og drøftes?'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Tema</th><th>Form</th><th>Frekvens</th></tr></thead><tbody><tr><td>Virksomhetens nåværende og forventede utvikling</td><td>Informasjon</td><td>Årlig som minimum</td></tr><tr><td>Sysselsettingssituasjonen — særlig forventede endringer</td><td>Informasjon + drøfting</td><td>Halvårlig + ad hoc</td></tr><tr><td>Beslutninger som kan medføre vesentlig endring i arbeidsorganisering eller ansettelsesforhold</td><td>Drøfting før beslutning</td><td>Ad hoc</td></tr><tr><td>Nedbemanning, virksomhetsoverdragelse, omorganisering</td><td>Drøfting før beslutning</td><td>Ad hoc</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Praktisk gjennomføring'),
      jsonb_build_object('kind','text','body',
        '<ol><li><strong>Faste møter</strong> — minst halvårlig fellesmøte mellom ledelsen og tillitsvalgte, med fast saksliste som dekker temaene over.</li><li><strong>Skriftlig informasjon</strong> sendes minst 5 virkedager før møtet.</li><li><strong>Drøfting</strong> innebærer reell mulighet til å påvirke beslutningen — informasjonen må være konkret og fullstendig nok til at tillitsvalgte kan uttrykke synspunkter og foreslå endringer.</li><li><strong>Protokoll</strong> føres og signeres.</li><li><strong>Ad hoc-saker</strong>: ved planlagte vesentlige endringer kontakter daglig leder tillitsvalgte uten unødig opphold.</li></ol>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Konfidensialitet — § 8-3'),
      jsonb_build_object('kind','text','body',
        '<p>Tillitsvalgte og deres rådgivere har taushetsplikt om opplysninger som arbeidsgiver av hensyn til virksomhetens interesser uttrykkelig har gitt som fortrolig. Brudd kan medføre erstatningsansvar.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Tvist'),
      jsonb_build_object('kind','text','body',
        '<p>Tvist om informasjons- eller drøftingsplikten avgjøres av Bedriftsdemokratinemnda eller, ved tvist om innholdet, av domstolene etter tariffavtale.</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 8-1','description','Plikt til informasjon og drøfting','url','https://lovdata.no/lov/2005-06-17-62/§8-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 8-2','description','Gjennomføring','url','https://lovdata.no/lov/2005-06-17-62/§8-2'),
      jsonb_build_object('kind','law_ref','ref','AML § 8-3','description','Konfidensialitet','url','https://lovdata.no/lov/2005-06-17-62/§8-3')
    )
  ),
  110
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Compliance checklist: info-drofting-arsgjennomgang ─────────────────

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
      'info-drofting-arsgjennomgang',
      'Informasjon og drøfting — årlig gjennomgang',
      'Årlig kontroll av at AML kap. 8 informasjons- og drøftingsplikten er praktisert: faste møter avholdt, vesentlige beslutninger drøftet før vedtak, og protokoll dokumentert.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','omfattes','prompt','Er det avklart om virksomheten omfattes av plikten (≥50 arbeidstakere)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-1','severity_default','medium'),
        jsonb_build_object('key','faste_moter','prompt','Er det avholdt minimum to fellesmøter mellom ledelsen og tillitsvalgte siste 12 mnd.?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-1','severity_default','high'),
        jsonb_build_object('key','informasjon_skriftlig','prompt','Er skriftlig informasjon sendt ut senest 5 virkedager før møtene?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-2','severity_default','medium'),
        jsonb_build_object('key','utvikling','prompt','Er virksomhetens utvikling og forventede sysselsettingssituasjon presentert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-2 (a, b)','severity_default','high'),
        jsonb_build_object('key','vesentlige_beslutninger','prompt','Er vesentlige beslutninger som påvirker arbeidsforhold drøftet før vedtak?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-2 (c)','severity_default','critical'),
        jsonb_build_object('key','protokoll','prompt','Er det ført protokoll fra hvert møte, signert av begge parter?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-2','severity_default','high'),
        jsonb_build_object('key','konfidensialitet','prompt','Er konfidensialitetsmerking brukt korrekt — og taushetsplikten kommunisert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-3','severity_default','medium'),
        jsonb_build_object('key','tvister','prompt','Har det vært tvister eller innsigelser fra tillitsvalgte siste 12 mnd.?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 8-1','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner og forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_dl','prompt','Daglig leders signatur','type','signature','required',true),
        jsonb_build_object('key','sign_tv','prompt','Tillitsvalgts signatur','type','signature','required',true)
      )),
      array['AML § 8-1','AML § 8-2','AML § 8-3']::text[],
      true, false, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
