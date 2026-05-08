-- AML §§ 3-3 og 3-4 — Bedriftshelsetjeneste og tjenestepensjon.
--
-- Coverage gap closed:
--   § 3-3 plikt til å knytte virksomheten til en godkjent BHT for
--     bransjer som er definert i forskrift om organisering, ledelse og
--     medvirkning § 13-1.
--   § 3-4 informasjon om tjenestepensjonsordning + OTP-loven.
--
-- Three artifacts:
--   1. Document tpl-bedriftshelsetjeneste — avtalemal + samarbeidsplan
--      + BHT-rapportering til AMU.
--   2. Document tpl-tjenestepensjon-info — informasjon til ansatte om
--      pensjonsordningen (OTP-loven og AML § 3-4).
--   3. Compliance checklist bht-arsplan-gjennomgang — årlig kontroll
--      av BHT-avtalen og at planen er satt opp og evaluert.
--
-- Self-audit: § 3-3 brudd er pålegg-grunn ved tilsyn for orgs i
-- relevante bransjer. Vanligste funn er at avtalen finnes men at det
-- ikke er en plan for hvordan BHT brukes — eller at BHT-rapporten
-- aldri legges fram for AMU. Sjekklisten fanger begge.

set local search_path = public, pg_catalog;

-- ── 1. Document: bedriftshelsetjeneste ────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-bedriftshelsetjeneste',
  'tpl-bedriftshelsetjeneste',
  'Bedriftshelsetjeneste — avtale, samarbeidsplan og rapportering',
  'Avtalemal og samarbeidsplan med godkjent bedriftshelsetjeneste etter AML § 3-3.',
  'procedure',
  array['AML § 3-3', 'Forskrift om organisering ledelse og medvirkning § 13-1', 'Forskrift om organisering ledelse og medvirkning § 13-2']::text[],
  jsonb_build_object(
    'title','Bedriftshelsetjeneste — samarbeid',
    'summary','Hvordan vi bruker den godkjente bedriftshelsetjenesten i tråd med AML § 3-3.',
    'status','draft',
    'template','standard',
    'legalRefs', jsonb_build_array('AML § 3-3'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','info',
        'text','BHT-plikten gjelder for bransjer som er listet i forskrift om organisering, ledelse og medvirkning § 13-1. Sjekk om virksomheten er omfattet før plikten anses irrelevant.'),
      jsonb_build_object('kind','heading','level',1,'text','Bedriftshelsetjeneste'),
      jsonb_build_object('kind','heading','level',2,'text','1. Avtale med godkjent BHT'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Felt</th><th>Innhold</th></tr></thead><tbody><tr><td>Leverandør</td><td>[Navn på BHT — godkjent av Arbeidstilsynet]</td></tr><tr><td>Godkjenningsnummer</td><td>[Sjekk i Arbeidstilsynets register]</td></tr><tr><td>Avtaleperiode</td><td>[Fra–til]</td></tr><tr><td>Volum</td><td>[Timer pr. ansatt eller fast årlig timer]</td></tr><tr><td>Kontaktperson hos BHT</td><td>[Navn]</td></tr><tr><td>Vår kontaktperson</td><td>[HMS-leder]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','2. BHTs oppgaver — § 13-2'),
      jsonb_build_object('kind','text','body',
        '<p>BHT skal bistå arbeidsgiver, arbeidstakere, AMU og verneombud med:</p><ul><li>kartlegging av arbeidsmiljøet og forslag til tiltak</li><li>løpende kartlegging av sykdom og helsemessige konsekvenser</li><li>plan for HMS-arbeid</li><li>tilrettelegging og oppfølging av sykmeldte</li><li>opplysningsvirksomhet og informasjon</li><li>helsekontroller der dette er pålagt eller forsvarlig</li><li>medvirkning ved AMU-møter</li></ul>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Årlig samarbeidsplan'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Aktivitet</th><th>Periode</th><th>Ansvar</th><th>Status</th></tr></thead><tbody><tr><td>Risikokartlegging på utvalgt område</td><td>[Q1]</td><td>BHT + HMS</td><td>[ ]</td></tr><tr><td>Helsekontroll — eksponerte grupper</td><td>[Q2]</td><td>BHT</td><td>[ ]</td></tr><tr><td>HMS-opplæring / fagdag</td><td>[Q3]</td><td>BHT + HR</td><td>[ ]</td></tr><tr><td>Årsrapport til AMU</td><td>[Q4]</td><td>BHT</td><td>[ ]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Rapportering'),
      jsonb_build_object('kind','text','body',
        '<p>BHT skal levere skriftlig årsrapport som forelegges AMU. Rapporten skal beskrive utført arbeid, observasjoner og forslag til tiltak. Personidentifiserende helseopplysninger skal IKKE inngå i rapporten.</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 3-3','description','Bedriftshelsetjeneste','url','https://lovdata.no/lov/2005-06-17-62/§3-3'),
      jsonb_build_object('kind','law_ref','ref','Forskrift om organisering, ledelse og medvirkning § 13-1','description','Bransjer med BHT-plikt','url','https://lovdata.no/forskrift/2011-12-06-1355')
    )
  ),
  100
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Document: tjenestepensjon-info ─────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-tjenestepensjon-info',
  'tpl-tjenestepensjon-info',
  'Tjenestepensjon — informasjon til ansatte',
  'Lovpålagt informasjon om virksomhetens tjenestepensjonsordning, jf. AML § 3-4 og OTP-loven.',
  'policy',
  array['AML § 3-4', 'OTP-loven']::text[],
  jsonb_build_object(
    'title','Tjenestepensjon — informasjon til ansatte',
    'summary','Hvordan virksomheten oppfyller plikten etter OTP-loven og AML § 3-4 om informasjon om tjenestepensjon.',
    'status','draft',
    'template','policy',
    'legalRefs', jsonb_build_array('AML § 3-4'),
    'requiresAcknowledgement', true,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','heading','level',1,'text','Tjenestepensjon'),
      jsonb_build_object('kind','text','body',
        '<p>[Virksomhet] tilbyr tjenestepensjon i tråd med lov om obligatorisk tjenestepensjon (OTP-loven). Informasjonen nedenfor oppfyller plikten i AML § 3-4 til å informere ansatte om ordningens innhold.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','1. Type ordning'),
      jsonb_build_object('kind','text','body',
        '<p>Vår ordning er en <strong>[innskuddsbasert / ytelsesbasert / hybrid]</strong> tjenestepensjon hos <strong>[leverandør]</strong>.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Innskuddsnivå'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Lønnsintervall</th><th>Innskudd fra arbeidsgiver</th><th>Egenandel ansatt</th></tr></thead><tbody><tr><td>Inntil 1 G</td><td>[ %]</td><td>[ %]</td></tr><tr><td>1–7,1 G</td><td>[ %]</td><td>[ %]</td></tr><tr><td>7,1–12 G</td><td>[ %]</td><td>[ %]</td></tr></tbody></table><p><em>Minimumssatser etter OTP-loven: 2 % av lønn mellom 1 og 12 G.</em></p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Hvem omfattes'),
      jsonb_build_object('kind','text','body',
        '<p>Alle ansatte som fyller vilkårene i OTP-loven omfattes — typisk fast og midlertidig ansatte over 13 år som arbeider mer enn 20 % stilling. Innleide og selvstendige er ikke omfattet av ordningen.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Risikodekninger'),
      jsonb_build_object('kind','text','body',
        '<p>Ordningen omfatter også [innskuddsfritak ved uførhet / etterlattepensjon / barnepensjon]. Detaljer hos leverandøren.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Hvor finner jeg min status?'),
      jsonb_build_object('kind','text','body',
        '<p>Logg inn hos [leverandør] med BankID. Du finner også oversikt på <a href="https://www.norskpensjon.no">Norsk Pensjon</a> eller <a href="https://www.nav.no">nav.no/dinpensjon</a>.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Endringer i ordningen'),
      jsonb_build_object('kind','text','body',
        '<p>Vesentlige endringer drøftes med tillitsvalgte og varsles ansatte skriftlig før de gjøres gjeldende, jf. AML § 3-4.</p>'),
      jsonb_build_object('kind','law_ref','ref','AML § 3-4','description','Informasjon om tjenestepensjon','url','https://lovdata.no/lov/2005-06-17-62/§3-4'),
      jsonb_build_object('kind','law_ref','ref','Lov om obligatorisk tjenestepensjon','description','OTP-loven','url','https://lovdata.no/lov/2005-12-21-124'),
      jsonb_build_object('kind','module','moduleName','acknowledgement_footer')
    )
  ),
  101
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 3. Compliance checklist: bht-arsplan-gjennomgang ──────────────────────

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
      'bht-arsplan-gjennomgang',
      'BHT — årlig samarbeidsgjennomgang',
      'Årlig kontroll av at avtalen med godkjent bedriftshelsetjeneste fungerer i praksis: at samarbeidsplanen er satt opp, gjennomført og evaluert med AMU.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','plikt_avklart','prompt','Er det avklart om virksomheten er omfattet av BHT-plikten (forskrift § 13-1)?',
                           'type','yes_no_na','required',true,
                           'law_ref','Forskrift om org., ledelse og medvirkning § 13-1','severity_default','high'),
        jsonb_build_object('key','avtale_aktiv','prompt','Foreligger det aktiv avtale med godkjent BHT?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-3','severity_default','critical'),
        jsonb_build_object('key','godkjenning','prompt','Er BHTs godkjenningsstatus kontrollert i Arbeidstilsynets register?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-3 (3)','severity_default','high'),
        jsonb_build_object('key','samarbeidsplan','prompt','Er det utarbeidet skriftlig samarbeidsplan for året?',
                           'type','yes_no_na','required',true,
                           'law_ref','Forskrift om org., ledelse og medvirkning § 13-2','severity_default','high'),
        jsonb_build_object('key','plan_oppgaver','prompt','Dekker planen risikokartlegging, helseovervåking, oppfølging av sykmeldte og opplæring?',
                           'type','yes_no_na','required',true,
                           'law_ref','§ 13-2','severity_default','high'),
        jsonb_build_object('key','plan_gjennomfort','prompt','Er aktivitetene i planen gjennomført?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-3','severity_default','high'),
        jsonb_build_object('key','arsrapport','prompt','Foreligger BHT-rapport for året?',
                           'type','yes_no_na','required',true,
                           'law_ref','§ 13-3','severity_default','high'),
        jsonb_build_object('key','amu_behandlet','prompt','Er BHT-rapporten lagt fram og behandlet i AMU?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 7-2','severity_default','high'),
        jsonb_build_object('key','helsekontroll','prompt','Er helsekontroller for eksponerte grupper gjennomført der det kreves?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 4-5 + § 10-11','severity_default','high'),
        jsonb_build_object('key','sykefravar_oppfolging','prompt','Bistår BHT i sykefraværsoppfølging?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 4-6','severity_default','medium'),
        jsonb_build_object('key','tiltak_oppfolging','prompt','Er forslag til tiltak fra BHT besluttet og fulgt opp?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-1','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner og forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_hms','prompt','HMS-leders signatur','type','signature','required',true),
        jsonb_build_object('key','sign_amu','prompt','AMU-leders signatur','type','signature','required',true)
      )),
      array['AML § 3-3','AML § 3-4','Forskrift om org., ledelse og medvirkning § 13-1','Forskrift om org., ledelse og medvirkning § 13-2']::text[],
      true, false, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;
