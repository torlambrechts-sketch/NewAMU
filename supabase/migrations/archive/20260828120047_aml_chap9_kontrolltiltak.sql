-- AML kapittel 9 — Kontrolltiltak overfor arbeidstaker.
--
-- Coverage gap closed:
--   §9-1 stiller saklighetskrav og forholdsmessighetskrav til alle
--   kontrolltiltak (videoovervåking, tidsregistrering, GPS, e-post-
--   innsyn, rusmiddeltest osv.). § 9-2 krever drøfting med tillits-
--   valgte og forhåndsinformasjon. § 9-3 har særregler om innsyn i
--   ansattes e-postkonto. § 9-4/9-5 om helseopplysninger og medisinske
--   undersøkelser.
--
-- Tilsynsfokus: Datatilsynet og Arbeidstilsynet håndhever overlappende.
-- Datatilsynet er hovedtilsyn for selve personvernsiden (GDPR Art. 5/6
-- + § 9-3). Arbeidstilsynet ser på drøftings- og informasjonsplikten
-- (§ 9-2) og forholdsmessigheten (§ 9-1).
--
-- Two artifacts:
--   1. Document tpl-kontrolltiltak-vurdering — formell vurderingsmal
--      å bruke FØR innføring. Strukturert etter §§ 9-1, 9-2 + GDPR
--      Art. 6/35. Inneholder sjekklister for de fem vanligste
--      kontrolltiltakene (kameraovervåking, GPS, tidsreg., e-post,
--      ruskontroll).
--   2. Compliance checklist kontrolltiltak-arsgjennomgang — årlig
--      gjennomgang av alle aktive kontrolltiltak. Risiko: tiltak
--      «vokser» utover saklig grunn over tid eller mister
--      forholdsmessigheten ved organisasjonsendring.
--
-- Self-audit (Datatilsynet / Arbeidstilsynet POV): Pålegg-grunner i
-- praksis er (a) manglende drøfting før innføring (§ 9-2), (b) for
-- bredt formål («generell sikkerhet» — for vagt), og (c) manglende
-- DPIA der personopplysninger behandles. Templatene fanger alle tre.
-- Restrisiko: konkret formålsavgrensning krever juridisk vurdering
-- per tiltak — vi gir struktur, ikke ferdig formålserklæring.

set local search_path = public, pg_catalog;

-- ── 1. Document: kontrolltiltak-vurdering ─────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-kontrolltiltak-vurdering',
  'tpl-kontrolltiltak-vurdering',
  'Kontrolltiltak — saklighets- og forholdsmessighetsvurdering',
  'Lovpålagt vurderingsmal som skal være ferdig før innføring av et kontrolltiltak, jf. AML §§ 9-1 og 9-2.',
  'procedure',
  array['AML § 9-1', 'AML § 9-2', 'AML § 9-3', 'GDPR Art. 6', 'GDPR Art. 35']::text[],
  jsonb_build_object(
    'title', 'Kontrolltiltak — vurdering før innføring',
    'summary', 'Strukturert vurderingsmal etter AML kapittel 9 og personvernregelverket. Skal være signert og drøftet med tillitsvalgte før kontrolltiltaket innføres.',
    'status', 'draft',
    'template', 'standard',
    'legalRefs', jsonb_build_array('AML § 9-1', 'AML § 9-2', 'AML § 9-3', 'GDPR Art. 6'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Vurderingen skal være ferdig FØR tiltaket innføres. Kontrolltiltak innført uten saklighetsvurdering og drøfting kan kreves stanset, og personopplysninger samlet inn under slikt tiltak kan ikke brukes som grunnlag for personalreaksjoner.'),
      jsonb_build_object('kind','heading','level',1,'text','Kontrolltiltak — vurdering før innføring'),
      jsonb_build_object('kind','heading','level',2,'text','1. Identifikasjon av tiltaket'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Felt</th><th>Innhold</th></tr></thead><tbody><tr><td>Tiltakstype</td><td>[Kameraovervåking / GPS / tidsreg. / e-post-innsyn / ruskontroll / IT-logging / annet]</td></tr><tr><td>Formål</td><td>[Konkret — IKKE «sikkerhet generelt»]</td></tr><tr><td>Omfang (hvem, når, hvor)</td><td>[Avgrenset til arbeidstakere/areal/tidsrom]</td></tr><tr><td>Behandlingsansvarlig</td><td>[Navn]</td></tr><tr><td>Innføringsdato</td><td>[dd.mm.åååå]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Saklighetsvurdering (§ 9-1 (1))'),
      jsonb_build_object('kind','text','body',
        '<p><strong>Spørsmål:</strong> Har tiltaket en saklig grunn i virksomhetens forhold?</p><ul><li>Hvilken konkret risiko, problem eller behov er bakgrunnen?</li><li>Har vi data eller dokumentasjon som underbygger behovet?</li><li>Finnes det mindre inngripende alternativer som dekker samme behov?</li></ul><p><strong>Konklusjon:</strong> [Saklig grunn dokumentert / Ikke dokumentert — må stoppes]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Forholdsmessighetsvurdering (§ 9-1 (1))'),
      jsonb_build_object('kind','text','body',
        '<p><strong>Spørsmål:</strong> Innebærer tiltaket en uforholdsmessig belastning for arbeidstakerne?</p><table><thead><tr><th>Vurderingstema</th><th>Vurdering</th></tr></thead><tbody><tr><td>Inngripende grad</td><td>[Lav / Middels / Høy] — begrunn</td></tr><tr><td>Hvor mye personopplysninger genereres?</td><td>[Mengde og kategori]</td></tr><tr><td>Lagringstid</td><td>[Dager / uker / måneder] — kortest mulig</td></tr><tr><td>Hvem får tilgang?</td><td>[Avgrenset rolle, tjenstlig behov]</td></tr><tr><td>Aggregering / overvåking over tid</td><td>[Ja/Nei — risiko for profilering]</td></tr><tr><td>Konsekvens for ansatt ved funn</td><td>[Adferdsregulering, samtale, sanksjon]</td></tr></tbody></table><p><strong>Konklusjon:</strong> [Forholdsmessig / Tiltaket må snevres inn]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Drøftings- og informasjonsplikt (§ 9-2)'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Plikt</th><th>Status</th></tr></thead><tbody><tr><td>Drøftet med tillitsvalgte / arbeidstakerrepresentanter</td><td>[dato] — referat lagret</td></tr><tr><td>Behandlet i AMU</td><td>[dato]</td></tr><tr><td>Informasjon til berørte arbeidstakere før innføring</td><td>[dato + form: skriftlig / møte]</td></tr><tr><td>Informasjon inneholder formål, konsekvenser, antatt varighet</td><td>[Ja / Nei]</td></tr><tr><td>Evaluering planlagt</td><td>[Etter X mnd. — ansvar: navn]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Personvern (GDPR)'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Felt</th><th>Innhold</th></tr></thead><tbody><tr><td>Behandlingsgrunnlag (Art. 6)</td><td>[Berettiget interesse / rettslig forpliktelse / samtykke (sjelden gyldig i arbeidsforhold) — begrunn]</td></tr><tr><td>Behandlingsprotokoll (Art. 30)</td><td>[Oppdatert — lenke]</td></tr><tr><td>DPIA krevd (Art. 35)?</td><td>[Ja/Nei] — Ved omfattende eller systematisk overvåking, særlige kategorier eller stor risiko: alltid Ja.</td></tr><tr><td>DPIA gjennomført</td><td>[Ja — vedlegg / Nei — begrunn]</td></tr><tr><td>Restrisiko etter tiltak</td><td>[Lav/Middels/Høy]</td></tr><tr><td>Personvernombudet konsultert</td><td>[Ja — dato]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Særregler — innsyn i e-post (§ 9-3)'),
      jsonb_build_object('kind','text','body',
        '<p>Forskrift om arbeidsgivers innsyn i e-postkasse mv. (FOR-2018-07-02-1107) gjelder. Innsyn er bare lovlig dersom (a) det er nødvendig for å ivareta den daglige driften eller andre berettigede interesser ved virksomheten, eller (b) ved begrunnet mistanke om at bruken av e-postkassen medfører grovt brudd på pliktene som følger av arbeidsforholdet, eller kan gi grunnlag for oppsigelse eller avskjed. Arbeidstakeren skal varsles før innsyn — så langt det er praktisk mulig.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Konklusjon og signering'),
      jsonb_build_object('kind','text','body',
        '<p><strong>Saklig grunn:</strong> [Ja/Nei] — <strong>Forholdsmessig:</strong> [Ja/Nei] — <strong>Drøftet:</strong> [Ja/Nei] — <strong>GDPR-grunnlag:</strong> [Ja/Nei]</p><p>Tiltaket [innføres / innføres ikke / innføres med følgende endringer:]</p><p>Behandlingsansvarlig: ____________________ Dato: __________</p><p>Tillitsvalgt (drøfting): ____________________ Dato: __________</p><p>Verneombud: ____________________ Dato: __________</p>'),
      jsonb_build_object('kind','heading','level',2,'text','8. Evaluering (etter X mnd.)'),
      jsonb_build_object('kind','text','body',
        '<p>Det skal jevnlig evalueres om vilkårene fortsatt er til stede (§ 9-2 (3)). Sett dato: [dd.mm.åååå].</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 9-1','description','Vilkår for kontrolltiltak','url','https://lovdata.no/lov/2005-06-17-62/§9-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 9-2','description','Drøfting og informasjon ved innføring','url','https://lovdata.no/lov/2005-06-17-62/§9-2'),
      jsonb_build_object('kind','law_ref','ref','AML § 9-3','description','Innsyn i e-post mv.','url','https://lovdata.no/lov/2005-06-17-62/§9-3'),
      jsonb_build_object('kind','law_ref','ref','GDPR Art. 35','description','Vurdering av personvernkonsekvenser (DPIA)','url','https://lovdata.no/forskrift/2018-07-02-1107')
    )
  ),
  80
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Compliance checklist: kontrolltiltak-arsgjennomgang ────────────────

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
      'kontrolltiltak-arsgjennomgang',
      'Kontrolltiltak — årlig gjennomgang',
      'Årlig kontroll av at alle aktive kontrolltiltak fortsatt har saklig grunn, er forholdsmessige og er forsvarlig dokumentert (AML §§ 9-1, 9-2). Identifiserer tiltak som har «vokst» utover opprinnelig formål.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','tiltaksoversikt','prompt','Er det en oppdatert oversikt over alle aktive kontrolltiltak (kamera, GPS, tidsreg., logging, e-post-innsyn, rusmiddeltest)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-1','severity_default','high',
                           'help','Oversikten skal omfatte tiltak innført av leverandører/IT også.'),
        jsonb_build_object('key','vurderingsmal_lagt','prompt','Foreligger det skriftlig saklighets- og forholdsmessighetsvurdering for hvert tiltak?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-1 (1)','severity_default','critical'),
        jsonb_build_object('key','formal_avgrenset','prompt','Er formålet for hvert tiltak konkret avgrenset (ikke «generell sikkerhet»)?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 5 + AML § 9-1','severity_default','high'),
        jsonb_build_object('key','drofting_dok','prompt','Er drøftingen med tillitsvalgte / AMU dokumentert (referat) for hvert tiltak?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-2 (1)','severity_default','critical'),
        jsonb_build_object('key','info_arbeidstakere','prompt','Har berørte arbeidstakere fått skriftlig informasjon om formål, omfang og varighet?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-2 (2)','severity_default','high'),
        jsonb_build_object('key','dpia','prompt','Er DPIA (Art. 35) gjennomført der det kreves?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 35','severity_default','high'),
        jsonb_build_object('key','behandlingsgrunnlag','prompt','Er behandlingsgrunnlaget etter GDPR Art. 6 dokumentert i behandlingsprotokollen?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 6 + 30','severity_default','high'),
        jsonb_build_object('key','tilgang','prompt','Er tilgangen til kontrolldata begrenset til personer med tjenstlig behov?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-1 + GDPR Art. 32','severity_default','high'),
        jsonb_build_object('key','lagringstid','prompt','Er lagringstid satt så kort som mulig og dokumentert?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 5 (1) e','severity_default','high'),
        jsonb_build_object('key','epost_innsyn','prompt','Hvis det har vært innsyn i ansattes e-post: er forskriftens vilkår oppfylt og varsel gitt?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 9-3 + FOR-2018-07-02-1107','severity_default','critical'),
        jsonb_build_object('key','evaluering','prompt','Er det utført løpende evaluering av om vilkårene fortsatt er til stede?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-2 (3)','severity_default','medium'),
        jsonb_build_object('key','utgatte','prompt','Er kontrolltiltak som ikke lenger har saklig grunn avviklet?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 9-1','severity_default','high'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_dpo','prompt','Personvernombudets signatur (eller behandlingsansvarlig)','type','signature','required',true),
        jsonb_build_object('key','sign_tv','prompt','Tillitsvalgt / verneombud — signatur','type','signature','required',true)
      )),
      array['AML § 9-1','AML § 9-2','AML § 9-3','GDPR Art. 6','GDPR Art. 35']::text[],
      true, false, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
