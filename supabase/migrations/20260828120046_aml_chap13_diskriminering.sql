-- AML kapittel 13 — Vern mot diskriminering.
--
-- Coverage gap closed:
--   AML § 13 forbyr diskriminering på en rekke grunnlag og pålegger
--   forebyggende tiltak. Likestillings- og diskrimineringsloven (LDL)
--   § 26 har den ÅRLIGE aktivitets- og redegjørelsesplikten (ARP) som
--   dokumenterer arbeidet i praksis. Tilsynet med ARP utføres av LDO.
--
-- Three artifacts:
--   1. Document tpl-arp-redegjorelse — årlig ARP-rapportmal. Skal
--      publiseres som del av årsrapport eller på virksomhetens nett-
--      sider innen utløpet av regnskapsåret etter (LDL § 26 (3)).
--   2. Survey tpl-aml-13-likestilling — anonym kartlegging av
--      diskriminering, trakassering og likestilling i organisasjonen
--      (input til ARP-redegjørelsen).
--   3. Learning course c-aml-13-likestilling — obligatorisk e-kurs for
--      ledere om diskrimineringsforbud, ARP og varslingsrutiner.
--
-- Self-audit (LDO/Arbeidstilsynet POV): Den vanligste pålegg-grunnen
-- ved ARP-tilsyn er at virksomheter har gjennomført kartleggingen men
-- ikke offentliggjort resultatet, eller at handlingsplanen mangler
-- konkrete tiltak. Templatene treffer begge gapene: surveyen leverer
-- aggregert datagrunnlag, dokumentmalen tvinger tiltak per funn.
-- Restrisiko: § 13-7 mobbing/trakassering krever løpende sak-pr-sak
-- behandling som ikke er en mal — tas av varslingsrutinene (kap 2A).

set local search_path = public, pg_catalog;

-- ── 1. Document: ARP-redegjørelse ─────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-arp-redegjorelse',
  'tpl-arp-redegjorelse',
  'Aktivitets- og redegjørelsesplikt (ARP) — årlig redegjørelse',
  'Lovpålagt årlig redegjørelse om likestilling og diskriminering etter Likestillings- og diskrimineringsloven § 26.',
  'policy',
  array['Likestillings- og diskrimineringsloven § 26', 'AML § 13-1', 'AML § 13-2', 'AML § 13-7']::text[],
  jsonb_build_object(
    'title', 'Likestillings- og diskrimineringsredegjørelse [ÅR]',
    'summary', 'Virksomhetens ARP-redegjørelse etter LDL § 26 — likestillingstilstand, kartlagt risiko, tiltak og resultater.',
    'status', 'draft',
    'template', 'policy',
    'legalRefs', jsonb_build_array('LDL § 26', 'AML § 13-1', 'AML § 13-7'),
    'requiresAcknowledgement', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','warning',
        'text','Redegjørelsen skal offentliggjøres senest sammen med årsrapporten — eller på virksomhetens nettsider hvis det ikke utarbeides årsrapport. Skal kunne fremlegges for Likestillings- og diskrimineringsombudet (LDO) på forespørsel.'),
      jsonb_build_object('kind','heading','level',1,'text','Likestillings- og diskrimineringsredegjørelse'),
      jsonb_build_object('kind','heading','level',2,'text','1. Virksomhetens forpliktelse'),
      jsonb_build_object('kind','text','body',
        '<p>[Virksomhetens navn] arbeider aktivt, målrettet og planmessig for å fremme likestilling og hindre diskriminering på grunnlag av:</p><ul><li>Kjønn, graviditet, permisjon ved fødsel og adopsjon, omsorgsoppgaver</li><li>Etnisitet, religion, livssyn</li><li>Funksjonsnedsettelse, seksuell orientering, kjønnsidentitet, kjønnsuttrykk, alder</li><li>Andre vesentlige forhold ved en person</li></ul><p>Dette dokumentet redegjør for tilstand, risiko, tiltak og resultater i [ÅR], jf. LDL § 26.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Likestillingstilstand — tall'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Indikator</th><th>Kvinner</th><th>Menn</th><th>Annet/uoppgitt</th><th>Totalt</th></tr></thead><tbody><tr><td>Antall ansatte (årsverk)</td><td>[ ]</td><td>[ ]</td><td>[ ]</td><td>[ ]</td></tr><tr><td>Andel deltid</td><td>[ %]</td><td>[ %]</td><td>—</td><td>[ %]</td></tr><tr><td>Midlertidig ansatt</td><td>[ %]</td><td>[ %]</td><td>—</td><td>[ %]</td></tr><tr><td>Foreldrepermisjon — uker (snitt)</td><td>[ ]</td><td>[ ]</td><td>—</td><td>—</td></tr><tr><td>Sykefravær</td><td>[ %]</td><td>[ %]</td><td>—</td><td>[ %]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',3,'text','Lønn — kjønnsdelt analyse'),
      jsonb_build_object('kind','text','body',
        '<p><em>Krav: redegjørelse for kjønnsforskjeller i lønn for arbeid av lik verdi, brutt ned på stillingsnivåer eller -grupper.</em></p><table><thead><tr><th>Stillingsgruppe</th><th>Snittlønn kvinner</th><th>Snittlønn menn</th><th>Forskjell %</th><th>Antall</th></tr></thead><tbody><tr><td>[Ledergruppe]</td><td>[ ]</td><td>[ ]</td><td>[ %]</td><td>[ ]</td></tr><tr><td>[Mellomledelse]</td><td>[ ]</td><td>[ ]</td><td>[ %]</td><td>[ ]</td></tr><tr><td>[Fagspesialister]</td><td>[ ]</td><td>[ ]</td><td>[ %]</td><td>[ ]</td></tr><tr><td>[Operativ]</td><td>[ ]</td><td>[ ]</td><td>[ %]</td><td>[ ]</td></tr></tbody></table><p><em>Forskjeller over 5 % i samme gruppe krever særskilt vurdering og kommentar nedenfor.</em></p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Aktivitetsplikten — fire-trinns metode'),
      jsonb_build_object('kind','text','body',
        '<h3>Trinn 1 — Undersøke risikoen</h3><p>[Beskriv hvordan dere kartlegger risiko for diskriminering: medarbeiderundersøkelser, varslinger, statistikk, eksitintervjuer.]</p><h3>Trinn 2 — Analysere årsakene</h3><p>[Beskriv funnene: hvor er risikoen høyest, hva er årsakene?]</p><h3>Trinn 3 — Iverksette tiltak</h3><p>[Liste over konkrete tiltak — ikke generelle policyer, men målrettede grep med ansvar og frist.]</p><h3>Trinn 4 — Vurdere resultatene</h3><p>[Beskriv evaluering: hva virket, hva fortsetter dere med?]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Tiltaksoversikt'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Risiko / funn</th><th>Diskriminerings­grunnlag</th><th>Tiltak</th><th>Ansvarlig</th><th>Frist</th><th>Status</th></tr></thead><tbody><tr><td>[ ]</td><td>[ ]</td><td>[ ]</td><td>[ ]</td><td>[dd.mm.åå]</td><td>[Planlagt/Pågår/Lukket]</td></tr><tr><td>[ ]</td><td>[ ]</td><td>[ ]</td><td>[ ]</td><td>[dd.mm.åå]</td><td>[ ]</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Trakassering og seksuell trakassering'),
      jsonb_build_object('kind','text','body',
        '<p>[Antall mottatte varsler/tilfeller dette året], [Status og oppfølging], [Eventuelle systemiske funn].</p><p>Vi viser til virksomhetens varslingsrutiner (AML § 2A-7) og rutine for håndtering av trakassering.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Tilrettelegging og inkludering'),
      jsonb_build_object('kind','text','body',
        '<p>[Beskriv hvordan virksomheten tilrettelegger for arbeidstakere med funksjonsnedsettelse (AML § 4-6, LDL § 12), gravide arbeidstakere, eldre arbeidstakere og andre med særlige behov.]</p>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Rekruttering, lønns- og forfremmelsesprosesser'),
      jsonb_build_object('kind','text','body',
        '<ul><li>[Hvordan utlysninger formuleres for å nå bredt]</li><li>[Praksis for kjønnsbalanse i søkergrupper]</li><li>[Strukturerte intervjuer / objektive kriterier]</li><li>[Lønnskartlegging — frekvens, tiltak ved funn]</li></ul>'),
      jsonb_build_object('kind','heading','level',2,'text','8. Drøfting med tillitsvalgte / verneombud'),
      jsonb_build_object('kind','text','body',
        '<p>Redegjørelsen er drøftet i AMU [dato] og med tillitsvalgte [dato]. Innspill er innarbeidet i tiltakslisten over.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','9. Signatur og publisering'),
      jsonb_build_object('kind','text','body',
        '<p>Daglig leder: ________________________ Dato: __________</p><p>Publisert på: [virksomhet.no/likestilling] — [dato]</p>'),
      jsonb_build_object('kind','law_ref','ref','Likestillings- og diskrimineringsloven § 26','description','Aktivitets- og redegjørelsesplikt','url','https://lovdata.no/lov/2017-06-16-51/§26'),
      jsonb_build_object('kind','law_ref','ref','AML § 13-1','description','Forbud mot diskriminering','url','https://lovdata.no/lov/2005-06-17-62/§13-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 13-7','description','Forebygging av seksuell trakassering','url','https://lovdata.no/lov/2005-06-17-62/§13-7')
    )
  ),
  70
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Survey: aml-13-likestilling ────────────────────────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source,
  use_case, category, audience, estimated_minutes, recommend_anonymous,
  scoring_note, law_ref, law_refs, body
) values (
  'tpl-aml-13-likestilling',
  null,
  true,
  'Likestilling og diskriminering — kartlegging',
  'Likestilling',
  'Anonym kartlegging av opplevd diskriminering, trakassering og likestilling i virksomheten. Datagrunnlag for ARP-redegjørelsen etter LDL § 26.',
  'Klarert / LDO veileder',
  'Årlig kartlegging som leverer trinn 1 i aktivitetsplikten — undersøke risikoen.',
  'compliance',
  'internal',
  6,
  true,
  'Aggreger per spørsmål. Identifiser grupper med signifikant lavere enighet (terskel 3.5/5). Resultatene oppsummeres i ARP-redegjørelsen, brutt ned på diskrimineringsgrunnlag der utvalg tillater det.',
  'AML § 13-1',
  array['AML § 13-1', 'AML § 13-2', 'AML § 13-7', 'Likestillings- og diskrimineringsloven § 26']::text[],
  jsonb_build_object(
    'version', 1,
    'questions', jsonb_build_array(
      jsonb_build_object('id','d1','text','Jeg behandles likeverdig med kollegaer i tilsvarende stilling, uavhengig av kjønn, etnisitet, funksjonsnedsettelse, seksuell orientering, religion, alder eller andre forhold ved meg som person.',
        'type','likert_5','required',true,'subscale','Likebehandling','law_ref','AML § 13-1','anchors',jsonb_build_object('low','Helt uenig','high','Helt enig')),
      jsonb_build_object('id','d2','text','Forfremmelser, lønnsutvikling og kompetansetiltak fordeles rettferdig i min virksomhet.',
        'type','likert_5','required',true,'subscale','Lønn og forfremmelse','law_ref','LDL § 26'),
      jsonb_build_object('id','d3','text','Jeg har i løpet av siste 12 mnd. blitt utsatt for diskriminering på arbeidsplassen.',
        'type','yes_no','required',true,'law_ref','AML § 13-1'),
      jsonb_build_object('id','d4','text','Hvis ja på Q3: Hvilket grunnlag opplevde du diskrimineringen på? (kan velge flere)',
        'type','multi_select','required',false,
        'options', jsonb_build_array(
          jsonb_build_object('value','kjonn','label','Kjønn'),
          jsonb_build_object('value','graviditet','label','Graviditet / permisjon / omsorg'),
          jsonb_build_object('value','etnisitet','label','Etnisitet / hudfarge'),
          jsonb_build_object('value','religion','label','Religion / livssyn'),
          jsonb_build_object('value','funksjon','label','Funksjonsnedsettelse'),
          jsonb_build_object('value','orientering','label','Seksuell orientering / kjønnsidentitet / kjønnsuttrykk'),
          jsonb_build_object('value','alder','label','Alder'),
          jsonb_build_object('value','annet','label','Annet'))),
      jsonb_build_object('id','t1','text','Jeg har i løpet av siste 12 mnd. opplevd uønsket atferd som har sammenheng med kjønn (seksuell trakassering eller trakassering pga. kjønn).',
        'type','yes_no','required',true,'law_ref','AML § 13-7'),
      jsonb_build_object('id','t2','text','Jeg har i løpet av siste 12 mnd. opplevd annen mobbing eller trakassering på arbeidsplassen.',
        'type','yes_no','required',true,'law_ref','AML § 4-3 (3)'),
      jsonb_build_object('id','t3','text','Jeg vet hvordan jeg kan varsle om uønsket atferd, og jeg har tillit til at varselet behandles forsvarlig.',
        'type','likert_5','required',true,'subscale','Varslingstillit','law_ref','AML § 2A-7'),
      jsonb_build_object('id','t4','text','Jeg har vært vitne til trakassering eller diskriminering rettet mot kollega siste 12 mnd.',
        'type','yes_no','required',true),
      jsonb_build_object('id','i1','text','Min arbeidsplass tilrettelegger for arbeidstakere med funksjonsnedsettelse, helseutfordringer eller særlige livssituasjoner.',
        'type','likert_5','required',true,'subscale','Inkludering','law_ref','AML § 4-6 + LDL § 12'),
      jsonb_build_object('id','i2','text','Permisjonsuttak og deltid behandles likt for kvinner og menn.',
        'type','likert_5','required',true,'subscale','Inkludering','law_ref','LDL § 26'),
      jsonb_build_object('id','i3','text','Beslutningsprosessene er åpne og bygger på objektive kriterier (rekruttering, forfremmelse, lønn).',
        'type','likert_5','required',true,'subscale','Prosess','law_ref','LDL § 26'),
      jsonb_build_object('id','o1','text','Hvilket konkret tiltak vil ha størst effekt på likestilling og inkludering hos oss det neste året? (anonymt)',
        'type','text','required',false)
    )
  )
)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  source = excluded.source,
  use_case = excluded.use_case,
  category = excluded.category,
  audience = excluded.audience,
  estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous,
  scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref,
  law_refs = excluded.law_refs,
  body = excluded.body,
  updated_at = now();

-- ── 3. Learning system course: c-aml-13-likestilling ──────────────────────
-- Multi-module e-kurs. Modules JSONB shape mirrors the existing
-- c-aml-ledere course (text → quiz). Light content here — admins
-- forker / utvider med scenario-videoer i sin organisasjon.

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-13-likestilling', 'aml-13-likestilling', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-13-likestilling',
  'nb',
  'Likestilling og diskriminering — for ledere',
  'Obligatorisk e-kurs om diskrimineringsforbudet, ARP-plikten og forebygging av seksuell trakassering. Gir leder verktøy for å håndtere risiko og varsler.',
  jsonb_build_array(
    jsonb_build_object(
      'id','m1',
      'title','Diskrimineringsforbudet',
      'kind','text',
      'estimatedMinutes',8,
      'content','Arbeidsmiljøloven kapittel 13 og Likestillings- og diskrimineringsloven forbyr diskriminering på en rekke grunnlag: kjønn, graviditet, omsorg, etnisitet, religion, livssyn, funksjonsnedsettelse, seksuell orientering, kjønnsidentitet, kjønnsuttrykk og alder. Forbudet gjelder hele arbeidsforholdet — fra utlysning, gjennom forfremmelse og lønn, til opphør. Direkte og indirekte diskriminering er begge forbudt. Rimelig individuell tilrettelegging er ikke en frivillig gest, men et lovkrav (AML § 4-6, LDL § 12).',
      'lawRefs', jsonb_build_array('AML § 13-1','AML § 4-6','LDL § 6')
    ),
    jsonb_build_object(
      'id','m2',
      'title','Aktivitets- og redegjørelsesplikten (ARP)',
      'kind','text',
      'estimatedMinutes',10,
      'content','Som leder er du ansvarlig for at virksomheten arbeider aktivt, målrettet og planmessig — i fire trinn: undersøke risikoen, analysere årsakene, iverksette tiltak, vurdere resultatene. Redegjørelsen offentliggjøres årlig (LDL § 26). Lønnskartlegging — kjønnsdelt, brutt ned på sammenliknbare stillingsgrupper — er en del av minimumskravene, samt redegjørelse for ufrivillig deltid.',
      'lawRefs', jsonb_build_array('LDL § 26')
    ),
    jsonb_build_object(
      'id','m3',
      'title','Trakassering og seksuell trakassering',
      'kind','text',
      'estimatedMinutes',10,
      'content','AML § 4-3 (3) forbyr trakassering generelt; § 13-7 påbyr forebygging og hindring av seksuell trakassering. «Trakassering» er handlinger, unnlatelser eller ytringer som har som formål eller virkning å være krenkende, skremmende, fiendtlige, nedverdigende eller ydmykende. «Seksuell trakassering» er enhver form for uønsket seksuell oppmerksomhet med tilsvarende formål eller virkning. Du har plikt til å forebygge og hindre — det betyr aktivt arbeid, ikke bare reaksjon på enkeltsaker.',
      'lawRefs', jsonb_build_array('AML § 4-3','AML § 13-7')
    ),
    jsonb_build_object(
      'id','m4',
      'title','Når en sak meldes — slik håndterer du den',
      'kind','text',
      'estimatedMinutes',8,
      'content','Mottak: ta saken på alvor uansett alvorlighet. Bekreft mottak innen 5 virkedager. Habilitet: sørg for at saksbehandler ikke er part. Undersøk: intervju, dokumentasjon, høringsrett. Tiltak: rett opp forholdet, ivareta varsleren mot gjengjeldelse (AML § 2A-4). Dokumenter: alle steg arkiveres i 5 år. Ved seksuell trakassering: vurder politianmeldelse, særlig ved gjentakelse eller alvorlighet.',
      'lawRefs', jsonb_build_array('AML § 2A-3','AML § 2A-4')
    ),
    jsonb_build_object(
      'id','m5',
      'title','Quiz — sjekk forståelsen',
      'kind','quiz',
      'estimatedMinutes',5,
      'questions', jsonb_build_array(
        jsonb_build_object('id','q1','prompt','Hvor ofte skal redegjørelsen etter LDL § 26 publiseres?','type','single','options', jsonb_build_array('Hvert tredje år','Årlig','Hvert femte år','Bare ved organisasjonsendringer'),'answer',1),
        jsonb_build_object('id','q2','prompt','Hvilket trinn er IKKE en del av aktivitetsplikten etter ARP?','type','single','options', jsonb_build_array('Undersøke risikoen','Analysere årsakene','Politianmelde brudd','Vurdere resultatene'),'answer',2),
        jsonb_build_object('id','q3','prompt','Hva er minimumstid for å bekrefte mottak av et varsel?','type','single','options', jsonb_build_array('5 virkedager','30 dager','3 måneder','Ingen frist'),'answer',0),
        jsonb_build_object('id','q4','prompt','Hvem har plikt til å forebygge seksuell trakassering på arbeidsplassen?','type','single','options', jsonb_build_array('Den enkelte ansatte','Verneombudet alene','Arbeidsgiver','Tillitsvalgt'),'answer',2)
      ),
      'passingScore', 75
    )
  )
)
on conflict (system_course_id, locale) do update set
  title = excluded.title,
  description = excluded.description,
  modules = excluded.modules;
