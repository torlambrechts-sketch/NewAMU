-- AML kap. 12 (Permisjon) + kap. 14 (Ansettelse) + § 14A (Konkurranseklausul)
--
-- Coverage gap closed:
--   § 12-1..§ 12-15 — permisjonsrettigheter (svangerskap, fødsel, omsorg,
--     utdanning, militærtjeneste, sykdom egen/familie, religiøs).
--   § 14-5 til 14-7 — skriftlig arbeidsavtale + minimumsinnhold.
--   § 14-9 — midlertidig ansettelse, vilkår.
--   § 14-12 — innleie fra bemanningsforetak.
--   § 14-12a — likebehandlingsprinsippet for innleide.
--   § 14A — konkurransebegrensende avtaler (kap. 14 A, fra 1.1.2016).
--
-- Five artifacts (alt i én migrasjon for å holde tema sammen):
--   1. Document tpl-ansettelsesavtale-mal — § 14-6 minimumsinnhold-mal.
--   2. Document tpl-midlertidig-vurdering — § 14-9 vurderingsmal.
--   3. Document tpl-konkurranseklausul-vurdering — § 14A-1 til § 14A-5
--      vurderingsmal (gyldighetsvilkår + erstatning).
--   4. Document tpl-permisjonsoversikt — sammendrag av rettigheter etter
--      kap. 12 (svangerskap, fødsel, omsorg, utdanning, mv.).
--   5. Compliance checklist innleie-arsgjennomgang — § 14-12 / § 14-12a
--      kvartalsvis kontroll: dekningsgrunnlag, likebehandling, drøftelse.
--
-- Self-audit (Arbeidstilsynet POV): § 14-9 misbruk av midlertidig
-- ansettelse er hovedfokus. § 14-12 innleie kontrolleres ofte i bygg,
-- transport og verft. § 14A-konkurranseklausuler er domstolssak,
-- ikke tilsyn — men feil utforming utløser erstatning. Templatene
-- gir struktur for å unngå standard-tabber: utløp-dato på midlertidige
-- (§ 14-9 (5)), tre-måneders skriftlighet på § 14A, og likebehandlings-
-- protokoll for innleide.

set local search_path = public, pg_catalog;

-- ── 1. Document: ansettelsesavtale-mal ────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-ansettelsesavtale-mal',
  'tpl-ansettelsesavtale-mal',
  'Ansettelsesavtale — mal med minimumsinnhold',
  'Skriftlig ansettelsesavtale med innhold som dekker minimumskravene i AML § 14-6.',
  'template_library',
  array['AML § 14-5', 'AML § 14-6', 'AML § 14-7']::text[],
  jsonb_build_object(
    'title','Ansettelsesavtale','summary','Mal med § 14-6 minimumsinnhold.',
    'status','draft','template','standard',
    'legalRefs', jsonb_build_array('AML § 14-5','AML § 14-6'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','heading','level',1,'text','Arbeidsavtale'),
      jsonb_build_object('kind','heading','level',2,'text','1. Partene'),
      jsonb_build_object('kind','text','body','<p>Mellom <strong>[Arbeidsgiver — fullt navn, org.nr., adresse]</strong> (heretter «arbeidsgiver») og <strong>[Arbeidstaker — fullt navn, fødselsnr., adresse]</strong> (heretter «arbeidstaker») er det inngått følgende avtale:</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Arbeidsplass'),
      jsonb_build_object('kind','text','body','<p>Arbeidsstedet er <strong>[adresse / fast sted]</strong>. Hvis det ikke er noe fast eller hovedsakelig sted: <em>«Arbeidet utføres på forskjellige steder.»</em> Forventet reisevirksomhet: [omfang].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Stilling og arbeidsoppgaver'),
      jsonb_build_object('kind','text','body','<p>Stillingsbenevnelse: <strong>[ ]</strong>. Hovedansvarsområder: [beskrivelse]. Arbeidsgiver kan tildele andre arbeidsoppgaver innenfor det som naturlig hører inn under stillingen (styringsrett).</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Tiltredelsesdato'),
      jsonb_build_object('kind','text','body','<p>Arbeidet starter <strong>[dd.mm.åååå]</strong>.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Ansettelsesform og varighet'),
      jsonb_build_object('kind','text','body','<p>[Velg ett:]</p><ul><li><strong>Fast ansettelse</strong> — uten avtalt sluttdato.</li><li><strong>Midlertidig ansettelse</strong> i medhold av AML § 14-9 (1) bokstav [a/b/c/d/e]. Avtalen utløper [dd.mm.åååå] eller når [arbeidet er fullført / behovet opphører].</li></ul>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Prøvetid'),
      jsonb_build_object('kind','text','body','<p>Arbeidstakeren ansettes på prøve i <strong>[X] måneder</strong> (maksimalt 6 mnd., AML § 15-6). I prøvetiden gjelder <strong>14 dagers</strong> oppsigelsesfrist for begge parter.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Lønn og lønnsutbetaling'),
      jsonb_build_object('kind','text','body','<p>Brutto månedslønn: <strong>kr [ ]</strong>. Lønn utbetales den <strong>[15. / 25.]</strong> i måneden. Andre ytelser: [bonus/feriepenger/godtgjørelser].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','8. Arbeidstid'),
      jsonb_build_object('kind','text','body','<p>Alminnelig arbeidstid: <strong>[X]</strong> timer pr. uke (full stilling = 100 %). Stillingsprosent: <strong>[ %]</strong>. Daglig arbeidstid: kl. [hh:mm]–[hh:mm] med pause [varighet]. Eventuell skift-/turnusplan vedlegges.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','9. Ferie'),
      jsonb_build_object('kind','text','body','<p>Ferie og feriepenger etter ferieloven og AML kap. 12. Avtalt ferielengde: [25 virkedager / 5 uker / 5 uker + senior].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','10. Oppsigelsesfrister'),
      jsonb_build_object('kind','text','body','<p>Etter prøvetid gjelder oppsigelsesfristene i AML § 15-3, p.t. minst 1 måned. Arbeidsgiver og arbeidstaker kan avtale lengre frister.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','11. Tariffavtale, pensjon og forsikringer'),
      jsonb_build_object('kind','text','body','<p>[Virksomheten er bundet av tariffavtale med [forbund]. / Virksomheten er ikke tariffbundet.] Pensjonsordning: se egen informasjon (OTP-loven). Yrkesskadeforsikring tegnet i [selskap].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','12. Reglement, taushetsplikt og personvern'),
      jsonb_build_object('kind','text','body','<p>Arbeidstaker er kjent med og forplikter seg til virksomhetens HMS-rutiner, varslingsrutiner, personvernerklæring og etiske retningslinjer. Taushetsplikt gjelder under og etter arbeidsforholdet.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','13. Konkurranse-, kunde- og rekrutteringsklausuler'),
      jsonb_build_object('kind','text','body','<p>[Hvis aktuell:] Egen avtale etter AML kap. 14 A er inngått som vedlegg [n].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','14. Annet'),
      jsonb_build_object('kind','text','body','<p>[Bil/utstyr/hjemmekontor/fjernarbeidsavtale.]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','15. Signaturer'),
      jsonb_build_object('kind','text','body','<p>Sted/dato: [ ]</p><p>For arbeidsgiver: ____________________</p><p>Arbeidstaker: ____________________</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 14-6','description','Minimumsinnhold i arbeidsavtale','url','https://lovdata.no/lov/2005-06-17-62/§14-6')
    )
  ),
  120
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Document: midlertidig-vurdering ────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-midlertidig-vurdering',
  'tpl-midlertidig-vurdering',
  'Midlertidig ansettelse — vilkårsvurdering',
  'Vurderingsmal som dokumenterer at vilkårene i AML § 14-9 er oppfylt før det inngås midlertidig avtale.',
  'procedure',
  array['AML § 14-9', 'AML § 14-11']::text[],
  jsonb_build_object(
    'title','Midlertidig ansettelse — vurdering',
    'summary','Bruk denne malen FØR avtale inngås. Manglende dokumentert grunnlag for midlertidig ansettelse fører ofte til at retten konstaterer fast ansettelse (§ 14-11).',
    'status','draft','template','standard',
    'legalRefs', jsonb_build_array('AML § 14-9'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Hovedregelen er fast ansettelse (§ 14-9 (1)). Midlertidig avtale er bare gyldig hvis ett av de uttømmende vilkårene i § 14-9 (1) bokstav a–e er oppfylt.'),
      jsonb_build_object('kind','heading','level',1,'text','Midlertidig ansettelse — vurdering'),
      jsonb_build_object('kind','heading','level',2,'text','1. Hjemmel'),
      jsonb_build_object('kind','text','body','<p>Velg det grunnlaget som passer:</p><ul><li><strong>(a)</strong> Når arbeidet er av midlertidig karakter (avgrenset prosjekt, sesong osv.)</li><li><strong>(b)</strong> Vikariat for navngitt person.</li><li><strong>(c)</strong> Praksisarbeid.</li><li><strong>(d)</strong> Deltaker i arbeidsmarkedstiltak.</li><li><strong>(e)</strong> Idrettsutøver, idrettstrener, dommer eller andre ledere innen organisert idrett.</li></ul><p>Valgt grunnlag: <strong>[ ]</strong> Begrunnelse: [konkret].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Drøftelse med tillitsvalgte'),
      jsonb_build_object('kind','text','body','<p>Bruken av midlertidig ansettelse skal årlig drøftes med tillitsvalgte (§ 14-9 (3)). Dato for drøftelse: [ ].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Varighet og treårsregelen / fireårsregelen'),
      jsonb_build_object('kind','text','body','<p>Avtalen utløper [dd.mm.åååå]. Husk § 14-9 (7): Etter <strong>3 år</strong> i midlertidig stilling etter (a) eller (b), eller <strong>4 år</strong> ved kombinasjon, anses arbeidstaker som fast ansatt.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Fortrinnsrett (§ 14-2)'),
      jsonb_build_object('kind','text','body','<p>Arbeidstaker som har vært ansatt i mer enn 12 mnd. har fortrinnsrett til ny stilling. Vurdert: [ja/nei]. Vurderingen lagret hos: [ ].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Konklusjon og signering'),
      jsonb_build_object('kind','text','body','<p>Vilkår oppfylt: [ja/nei]. HR-ansvarlig: ____________________</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 14-9','description','Midlertidig ansettelse','url','https://lovdata.no/lov/2005-06-17-62/§14-9'),
      jsonb_build_object('kind','law_ref','ref','AML § 14-11','description','Virkninger av ulovlig midlertidig ansettelse','url','https://lovdata.no/lov/2005-06-17-62/§14-11')
    )
  ),
  121
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 3. Document: konkurranseklausul-vurdering ─────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-konkurranseklausul-vurdering',
  'tpl-konkurranseklausul-vurdering',
  'Konkurranse-, kunde- og rekrutteringsklausul — vurdering og avtalemal',
  'Vurderingsmal og avtalemal etter AML kap. 14 A.',
  'procedure',
  array['AML § 14A-1','AML § 14A-2','AML § 14A-3','AML § 14A-4','AML § 14A-5']::text[],
  jsonb_build_object(
    'title','Konkurranseklausul — vurdering og avtale',
    'summary','Strenge gyldighetsvilkår etter kap. 14 A — særlig skriftlighet, redegjørelse og kompensasjonsplikt.',
    'status','draft','template','standard',
    'legalRefs', jsonb_build_array('AML § 14A-1','AML § 14A-2','AML § 14A-3'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Klausul som ikke oppfyller vilkårene i kap. 14 A er ugyldig. Erstatning må betales for varigheten klausulen gjelder.'),
      jsonb_build_object('kind','heading','level',1,'text','Konkurranseklausul — vurdering'),
      jsonb_build_object('kind','heading','level',2,'text','1. Type klausul'),
      jsonb_build_object('kind','text','body','<ul><li>Konkurranseklausul (§ 14A-1)</li><li>Kundeklausul (§ 14A-2)</li><li>Rekrutteringsklausul (§ 14A-3)</li></ul>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Saklig grunn — særlig behov for vern'),
      jsonb_build_object('kind','text','body','<p>Klausul er bare gyldig så langt det er <em>nødvendig</em> for å ivareta arbeidsgivers særlige behov. Beskriv: [konkret behov].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Form og redegjørelse'),
      jsonb_build_object('kind','text','body','<p>Avtalen skal være <strong>skriftlig</strong>. Arbeidsgiver skal gi en skriftlig redegjørelse for behovet for klausulen. Ved opphør av arbeidsforhold skal arbeidsgiver innen <strong>fire uker</strong> etter forespørsel — eller senest ved oppsigelse / avskjed — gi <strong>endelig skriftlig redegjørelse</strong> for om klausulen vil bli gjort gjeldende.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Varighet'),
      jsonb_build_object('kind','text','body','<p>Maksimalt <strong>12 måneder</strong> fra arbeidsforholdets opphør. Konkret avtalt: [X mnd.].</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Kompensasjon'),
      jsonb_build_object('kind','text','body','<p>Kompensasjon utbetales for klausulens varighet, minst <strong>100 %</strong> av arbeidsvederlaget for inntil 8 G + minst <strong>70 %</strong> for det overskytende. Det gjøres fradrag for inntil halvparten av lønnen ut over dette.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Avtaletekst — mal'),
      jsonb_build_object('kind','text','body','<p>«Arbeidstaker forplikter seg etter at arbeidsforholdet opphører til ikke [å tiltre stilling hos / drive eller medvirke i / kontakte virksomhetens kunder] som ... I [X] måneder fra opphør. For klausulens varighet utbetaler arbeidsgiver kompensasjon i samsvar med AML § 14A-1 (3). Arbeidsgiver kan ensidig si fra seg klausulen ved skriftlig melding inntil arbeidsforholdets opphør.»</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 14A-1','description','Konkurranseklausul','url','https://lovdata.no/lov/2005-06-17-62/§14A-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 14A-2','description','Kundeklausul','url','https://lovdata.no/lov/2005-06-17-62/§14A-2'),
      jsonb_build_object('kind','law_ref','ref','AML § 14A-3','description','Rekrutteringsklausul','url','https://lovdata.no/lov/2005-06-17-62/§14A-3')
    )
  ),
  122
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 4. Document: permisjonsoversikt ───────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-permisjonsoversikt',
  'tpl-permisjonsoversikt',
  'Permisjon — oversikt over rettigheter',
  'Sammendrag av permisjonsrettighetene etter AML kap. 12 — for arbeidstakere og personalrutine.',
  'guide',
  array['AML § 12-1', 'AML § 12-2', 'AML § 12-3', 'AML § 12-4', 'AML § 12-5', 'AML § 12-6', 'AML § 12-7', 'AML § 12-9', 'AML § 12-10', 'AML § 12-11', 'AML § 12-12', 'AML § 12-15']::text[],
  jsonb_build_object(
    'title','Permisjonsrettigheter — oversikt',
    'summary','Kort oversikt over rett til permisjon etter AML kap. 12. For detaljer, kontakt HR.',
    'status','draft','template','standard',
    'legalRefs', jsonb_build_array('AML kap. 12'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','heading','level',1,'text','Permisjonsrettigheter'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Type permisjon</th><th>§</th><th>Rettighet</th><th>Lønn</th></tr></thead><tbody><tr><td>Svangerskapskontroll</td><td>§ 12-1</td><td>Permisjon for nødvendig svangerskapskontroll</td><td>Med lønn</td></tr><tr><td>Svangerskapspermisjon</td><td>§ 12-2</td><td>Inntil 12 uker før termin</td><td>Foreldrepenger fra NAV</td></tr><tr><td>Omsorgs-/fødselspermisjon</td><td>§ 12-3</td><td>Far/medmor: 2 uker rundt fødselen</td><td>Avtaleavhengig</td></tr><tr><td>Foreldrepermisjon</td><td>§ 12-4 / § 12-5</td><td>Inntil 12 mnd. for hvert barn — 36 mnd. ved redusert uttak</td><td>Foreldrepenger fra NAV</td></tr><tr><td>Delvis permisjon</td><td>§ 12-6</td><td>Tidskontoordning — kombinert med arbeid</td><td>Avtale med arbeidsgiver</td></tr><tr><td>Ammefri</td><td>§ 12-8</td><td>Inntil 1 time pr. dag det første året</td><td>Med lønn etter avtale</td></tr><tr><td>Sykt barn</td><td>§ 12-9</td><td>10 dager pr. år (15 dager ved 3+ barn / 20 ved kronisk syk)</td><td>Omsorgspenger fra NAV</td></tr><tr><td>Pleie nære pårørende</td><td>§ 12-10</td><td>Inntil 60 dager ved omsorg ved livets slutt; 10 dager øvrig</td><td>Pleiepenger</td></tr><tr><td>Utdanningspermisjon</td><td>§ 12-11</td><td>Inntil 3 år ved relevant utdanning</td><td>Uten lønn</td></tr><tr><td>Religiøse høytider</td><td>§ 12-15</td><td>Inntil 2 dager pr. år for andre trossamfunn</td><td>Uten lønn</td></tr><tr><td>Militærtjeneste</td><td>§ 12-12</td><td>Permisjon ved verneplikt</td><td>Avhengig av verv</td></tr><tr><td>Offentlige verv / styreverv</td><td>§ 12-13</td><td>Permisjon for utførelse av offentlige verv</td><td>Avtale</td></tr></tbody></table>'),
      jsonb_build_object('kind','text','body','<p>Søknad fremmes via [HR-system / leder]. Varsel om permisjonsuttak skal gis i god tid før uttak — frister varierer per § (typisk 1 uke for kort permisjon, 8 uker for foreldrepermisjon).</p>'),
      jsonb_build_object('kind','law_ref','ref','AML kap. 12','description','Rett til permisjon','url','https://lovdata.no/lov/2005-06-17-62/§12-1')
    )
  ),
  123
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 5. Compliance checklist: innleie-arsgjennomgang ───────────────────────

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
      'innleie-kvartalsgjennomgang',
      'Innleie og midlertidig — kvartalsvis gjennomgang',
      'Kvartalsvis kontroll av at innleie og midlertidige ansettelser etter AML §§ 14-9 og 14-12 oppfyller vilkårene, og at likebehandlingsprinsippet (§ 14-12a) er praktisert.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','midl_grunnlag','prompt','Er det dokumentert grunnlag etter § 14-9 (1) for hver midlertidig avtale?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-9 (1)','severity_default','critical'),
        jsonb_build_object('key','midl_drofting','prompt','Er bruken av midlertidig ansettelse drøftet med tillitsvalgte minst én gang siste 12 mnd.?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-9 (3)','severity_default','high'),
        jsonb_build_object('key','treaarsregelen','prompt','Er det utført sjekk av 3-/4-årsregelen — ingen ansatt som passerer terskelen uten å være konvertert til fast?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-9 (7)','severity_default','critical'),
        jsonb_build_object('key','fortrinnsrett','prompt','Er fortrinnsrett etter § 14-2 vurdert ved nyansettelser?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-2','severity_default','high'),
        jsonb_build_object('key','innleie_grunnlag','prompt','Er innleie fra bemanningsforetak begrunnet i lovlig grunnlag (§ 14-12 (1) — vikariat / midlertidig behov; § 14-12 (2) — tariffavtale)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-12','severity_default','critical',
                           'help','Generell innleie er ikke lovlig — krever konkret begrunnelse.'),
        jsonb_build_object('key','innleie_drofting','prompt','Er innleie drøftet med tillitsvalgte (gjelder årlig + ved utvidet bruk)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-12 (3)','severity_default','high'),
        jsonb_build_object('key','likebehandling','prompt','Er likebehandlingsprinsippet praktisert — innleide har samme lønns-/arbeidsvilkår som om de var ansatt direkte?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-12a','severity_default','critical'),
        jsonb_build_object('key','solidaransvar','prompt','Er det rutiner for å fange solidaransvar etter § 14-12c ved manglende oppfyllelse fra bemanningsforetaket?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-12c','severity_default','high'),
        jsonb_build_object('key','arbavtaler','prompt','Foreligger skriftlig arbeidsavtale etter § 14-5 for samtlige arbeidstakere — fast og midlertidig?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 14-5','severity_default','critical'),
        jsonb_build_object('key','konkurranseklausul','prompt','Er aktive konkurranse-/kundeklausuler vurdert etter kap. 14 A — gyldighet og kompensasjon?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 14A-1','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner','type','text','required',false),
        jsonb_build_object('key','sign_hr','prompt','HR-ansvarliges signatur','type','signature','required',true),
        jsonb_build_object('key','sign_tv','prompt','Tillitsvalgts signatur','type','signature','required',true)
      )),
      array['AML § 14-2','AML § 14-5','AML § 14-9','AML § 14-12','AML § 14-12a','AML § 14-12c','AML § 14A-1']::text[],
      true, false, true, 'draft', 'kvartalsvis'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
