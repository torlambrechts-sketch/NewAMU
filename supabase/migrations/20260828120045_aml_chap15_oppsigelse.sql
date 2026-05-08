-- AML kapittel 15 — Opphør av arbeidsforhold.
--
-- Coverage gap closed:
--   §15-1 plikt til å drøfte oppsigelse med arbeidstaker og tillitsvalgt
--   før vedtak — en av de vanligste pålegg-grunnene ved tilsyn.
--   §15-4 formkrav til oppsigelse.
--   §15-15 plikt til å gi sluttattest med innhold som beskrevet.
--
-- Three artifacts:
--   1. Document tpl-droftelsessamtale — prosedyre + agendamal for
--      § 15-1 drøftelsen. Inneholder fullstendig sjekkliste for hva som
--      må dekkes før vedtak om oppsigelse.
--   2. Document tpl-sluttattest — mal for § 15-15-attest.
--   3. Compliance checklist oppsigelse-droftelse — å fylle ut FØR det
--      treffes vedtak. Kobler sammen § 15-1, § 15-4 og § 15-7 saklighet.
--
-- Self-audit (Arbeidstilsynet POV): § 15-1-brudd håndheves via søksmål
-- fra arbeidstaker, ikke direkte pålegg fra Arbeidstilsynet, men
-- formfeil etter § 15-4 og manglende sluttattest § 15-15 er
-- pålegg-grunner. Sjekklisten er bevis-trail for at drøftelsen er
-- gjennomført forsvarlig.

set local search_path = public, pg_catalog;

-- ── 1. Document: drøftelsessamtale ────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-droftelsessamtale',
  'tpl-droftelsessamtale',
  'Drøftelsessamtale før oppsigelse — prosedyre og agendamal',
  'Lovpålagt drøftelse med arbeidstaker og tillitsvalgt før det treffes vedtak om oppsigelse, jf. AML § 15-1.',
  'procedure',
  array['AML § 15-1', 'AML § 15-4', 'AML § 15-7']::text[],
  jsonb_build_object(
    'title', 'Drøftelsessamtale før oppsigelse',
    'summary', 'Slik gjennomfører vi den lovpålagte drøftelsen etter AML § 15-1 — formålet er å sikre at vedtaket er forsvarlig og bygger på et fullstendig grunnlag.',
    'status', 'draft',
    'template', 'standard',
    'legalRefs', jsonb_build_array('AML § 15-1', 'AML § 15-4', 'AML § 15-7'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Drøftelse skal alltid avholdes før vedtak om oppsigelse, så sant det ikke er praktisk umulig. Manglende drøftelse kan i seg selv gjøre oppsigelsen ugyldig (§ 15-1).'),
      jsonb_build_object('kind','heading','level',1,'text','Drøftelsessamtale etter AML § 15-1'),
      jsonb_build_object('kind','heading','level',2,'text','Når gjelder plikten?'),
      jsonb_build_object('kind','text','body',
        '<p>Plikten gjelder før <strong>arbeidsgiver fatter beslutning om oppsigelse</strong>. Det betyr at samtalen må holdes i god tid før vedtaksbrevet sendes — ikke samtidig, og ikke etter. Drøftelsen omfatter både grunnlaget for oppsigelsen og eventuelle utvalgskriterier ved nedbemanning.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','Hvem deltar?'),
      jsonb_build_object('kind','text','body',
        '<ul><li><strong>Arbeidstakeren</strong> — har rett til å la seg bistå av en tillitsvalgt eller annen rådgiver.</li><li><strong>Arbeidsgiverrepresentant</strong> — typisk nærmeste leder + HR.</li><li><strong>Tillitsvalgt</strong> — drøftes også med tillitsvalgt der det er aktuelt.</li><li><strong>Referent</strong> — fører protokoll. Bør være annen enn beslutningstaker.</li></ul>'),
      jsonb_build_object('kind','heading','level',2,'text','Forhåndsvarsel og innkalling'),
      jsonb_build_object('kind','text','body',
        '<p>Arbeidstakeren skal ha rimelig tid til å forberede seg. Vi sender skriftlig innkalling minst <strong>5 virkedager</strong> før samtalen, med:</p><ol><li>tema for drøftelsen</li><li>de faktiske forhold som ligger til grunn (uten konklusjon)</li><li>oversikt over relevante dokumenter</li><li>opplysning om retten til å la seg bistå</li><li>tid og sted</li></ol>'),
      jsonb_build_object('kind','heading','level',2,'text','Agenda for samtalen'),
      jsonb_build_object('kind','text','body',
        '<ol><li><strong>Innledning</strong> — formål, ramme, taushetsplikt.</li><li><strong>Arbeidsgivers framstilling</strong> — saklig grunn (§ 15-7), faktagrunnlag, bevismateriale.</li><li><strong>Arbeidstakers framstilling</strong> — innsigelser, kontekst, forklaring.</li><li><strong>Drøftelse av alternativer</strong> — annet passende arbeid (§ 15-7 (2)), tilrettelegging, omplassering, kompetansetiltak.</li><li><strong>Drøftelse av utvalgskriterier</strong> ved nedbemanning — ansiennitet, kompetanse, sosiale hensyn.</li><li><strong>Konsekvensvurdering</strong> for arbeidstakeren — sosiale forhold, økonomi, helse.</li><li><strong>Konklusjon</strong> — arbeidsgiver tar saken med seg til endelig vurdering. <em>Vedtak treffes ikke i samtalen.</em></li><li><strong>Oppsummering og signering</strong> av protokoll.</li></ol>'),
      jsonb_build_object('kind','heading','level',2,'text','Protokoll'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Felt</th><th>Innhold</th></tr></thead><tbody><tr><td>Dato og sted</td><td>[dd.mm.åååå] — [adresse]</td></tr><tr><td>Til stede</td><td>[Arbeidstaker, evt. tillitsvalgt, arbeidsgiver, referent]</td></tr><tr><td>Sak</td><td>Drøftelse iht. AML § 15-1 — [stilling]</td></tr><tr><td>Arbeidsgivers grunnlag</td><td>[Sammendrag — saklig grunn]</td></tr><tr><td>Arbeidstakers innsigelser</td><td>[Sammendrag]</td></tr><tr><td>Drøftelse av annet passende arbeid</td><td>[§ 15-7 (2)]</td></tr><tr><td>Konklusjon</td><td>Saken tas med til endelig vurdering. Vedtak meddeles innen [dato].</td></tr><tr><td>Signaturer</td><td>Arbeidsgiver / arbeidstaker / referent / tillitsvalgt</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','Etter samtalen'),
      jsonb_build_object('kind','text','body',
        '<ol><li>Arbeidstakeren får protokollen til gjennomsyn og signering.</li><li>Endelig vurdering gjøres etter samtalen — ikke i samtalen.</li><li>Vedtak om oppsigelse meddeles skriftlig (§ 15-4) og skal personlig overleveres eller sendes rekommandert.</li><li>Vedtaksbrevet skal opplyse om retten til å kreve forhandling, retten til å reise søksmål, fristene, og retten til å fortsette i stillingen.</li></ol>'),
      jsonb_build_object('kind','law_ref','ref','AML § 15-1','description','Drøftelse før beslutning om oppsigelse','url','https://lovdata.no/lov/2005-06-17-62/§15-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 15-4','description','Formkrav til oppsigelse','url','https://lovdata.no/lov/2005-06-17-62/§15-4'),
      jsonb_build_object('kind','law_ref','ref','AML § 15-7','description','Vern mot usaklig oppsigelse','url','https://lovdata.no/lov/2005-06-17-62/§15-7')
    )
  ),
  60
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Document: sluttattest mal ──────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-sluttattest',
  'tpl-sluttattest',
  'Sluttattest — mal',
  'Standardisert sluttattest etter AML § 15-15. Skal gis til alle som slutter, uten å vente på forespørsel.',
  'template_library',
  array['AML § 15-15']::text[],
  jsonb_build_object(
    'title', 'Sluttattest',
    'summary', 'Lovpålagt sluttattest med minimumsinnhold etter AML § 15-15.',
    'status', 'draft',
    'template', 'standard',
    'legalRefs', jsonb_build_array('AML § 15-15'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','info',
        'text','Arbeidsgiver skal gi skriftlig sluttattest til alle ansatte som slutter, uavhengig av oppsigelsesgrunn.'),
      jsonb_build_object('kind','heading','level',1,'text','SLUTTATTEST'),
      jsonb_build_object('kind','text','body',
        '<p style="font-size:14px;line-height:1.6"><strong>[Virksomhetens navn]</strong> bekrefter herved at:</p><p style="font-size:14px;line-height:1.6"><strong>[Fullt navn]</strong>, født [dd.mm.åååå], fødselsnr. [valgfritt — eller utelat]</p><p>har vært ansatt hos oss i perioden:</p><p><strong>[Startdato] — [Sluttdato]</strong></p><p>i stillingen som <strong>[Stillingsbenevnelse]</strong>.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','Arbeidsoppgaver'),
      jsonb_build_object('kind','text','body',
        '<p>[Beskriv hovedansvarsområder, faglig innhold og evt. spesialiserte oppgaver. 1–4 setninger. Saklig formulering.]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','Sluttårsak'),
      jsonb_build_object('kind','text','body',
        '<p>[Vanligvis: «egen oppsigelse», «avslutning av åremål», «avtalt sluttdato». Arbeidstakeren har rett til å be om at sluttårsak ikke spesifiseres ut over dette. Ved oppsigelse fra arbeidsgivers side: oppgi nøytralt grunnlag.]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','Vurderinger (frivillig)'),
      jsonb_build_object('kind','text','body',
        '<p><em>Etter AML § 15-15 har arbeidstakeren rett til en utvidet attest med vurdering av arbeidet og tjenesteforholdet — dersom arbeidstakeren krever det.</em></p><p>[Eventuell utvidet vurdering legges her etter forespørsel fra arbeidstakeren.]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','Sted og dato'),
      jsonb_build_object('kind','text','body',
        '<p>[Sted], [dd.mm.åååå]</p><p>_____________________________<br/>[Navn på undertegnende]<br/>[Stilling]<br/>[Virksomhetens navn]</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 15-15','description','Plikt til å gi sluttattest','url','https://lovdata.no/lov/2005-06-17-62/§15-15')
    )
  ),
  61
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 3. Compliance checklist: oppsigelse-droftelse ─────────────────────────
-- Sjekkliste FØR det treffes vedtak om oppsigelse. Brukes som
-- bevis-trail at drøftelsen er gjennomført forsvarlig.

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
      'oppsigelse-droftelse-sjekk',
      'Drøftelse før oppsigelse — sjekkliste',
      'Sjekkliste som fylles ut FØR vedtak om oppsigelse treffes — verifiserer at AML § 15-1 (drøftelsesplikt), § 15-4 (formkrav) og § 15-7 (saklighetskrav) er ivaretatt.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','sak_grunnlag','prompt','Er det skrevet ned saklig grunn for oppsigelsen før samtalen?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-7','severity_default','critical',
                           'help','Saklig grunn må foreligge — i arbeidstakers, virksomhetens eller arbeidsgivers forhold.'),
        jsonb_build_object('key','annet_arbeid','prompt','Er det vurdert om det finnes annet passende arbeid (§ 15-7 (2))?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-7 (2)','severity_default','critical',
                           'help','Krav ved oppsigelse pga. virksomhetens forhold (nedbemanning).'),
        jsonb_build_object('key','tilrettelegging','prompt','Ved oppsigelse av sykmeldt: er § 4-6 tilretteleggingsplikten dokumentert oppfylt?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 4-6 + § 15-8','severity_default','high'),
        jsonb_build_object('key','innkalling','prompt','Er skriftlig innkalling sendt minst 5 virkedager før samtalen, med tema og rett til å la seg bistå?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1','severity_default','high'),
        jsonb_build_object('key','forhandsvarsel','prompt','Er arbeidstakeren informert om de faktiske forhold som vurderes (uten konklusjon)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1','severity_default','high'),
        jsonb_build_object('key','tillitsvalgt','prompt','Er drøftelse også gjennomført med tillitsvalgt (der dette er aktuelt)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1 (1)','severity_default','high'),
        jsonb_build_object('key','utvalgskrit','prompt','Ved nedbemanning: er utvalgskriteriene drøftet og dokumentert (ansiennitet, kompetanse, sosiale hensyn)?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 15-1 + Hovedavtalen','severity_default','high'),
        jsonb_build_object('key','konsekvens','prompt','Er konsekvensene for arbeidstakeren (sosiale, økonomiske, helse) drøftet?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1','severity_default','medium'),
        jsonb_build_object('key','protokoll','prompt','Er det ført protokoll fra samtalen, signert av begge parter?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1','severity_default','high'),
        jsonb_build_object('key','vedtak_pause','prompt','Bekreft at vedtak ikke ble truffet i selve samtalen (krav til reell ny vurdering før vedtak).',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-1','severity_default','critical'),
        jsonb_build_object('key','formkrav','prompt','Er det utformet skriftlig oppsigelsesbrev som oppfyller § 15-4 (rett til forhandling, søksmål, frister, retten til å stå i stilling)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-4','severity_default','critical'),
        jsonb_build_object('key','overlevering','prompt','Skal oppsigelsesbrevet overleveres personlig eller sendes rekommandert?',
                           'type','single_select','required',true,
                           'law_ref','AML § 15-4 (2)','severity_default','high'),
        jsonb_build_object('key','sluttattest_planlagt','prompt','Er sluttattest etter § 15-15 forberedt (mal valgt, sluttdato, oppgaver)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 15-15','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Kommentarer / særlige forhold','type','text','required',false),
        jsonb_build_object('key','sign_hr','prompt','HR-ansvarliges signatur','type','signature','required',true),
        jsonb_build_object('key','sign_leder','prompt','Beslutningstakers signatur','type','signature','required',true)
      )),
      array['AML § 15-1','AML § 15-4','AML § 15-7','AML § 15-15']::text[],
      true, false, true, 'draft', 'ad_hoc'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
