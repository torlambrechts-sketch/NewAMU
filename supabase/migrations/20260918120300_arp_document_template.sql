-- ARP (Aktivitets- og redegjørelsesplikt) årsrapport — LDL § 26
--
-- Gap closed: No system document template guided employers through the mandatory
-- annual LDL § 26 ARP report covering gender pay, parental leave, promotion,
-- and harassment prevention measures.
--
-- Law: Likestillings- og diskrimineringsloven § 26 (ARP-plikt for virksomheter
--      med ≥ 50 ansatte, eller 20–49 med tariffavtale).
--
-- Self-audit (Diskrimineringsombudet/Håndhevingsorganet POV):
--   Addressed: Manglende dokumentasjon av aktiviteter og redegjørelse (§ 26(4)),
--              Manglende likelønn- og forfremmingsdata (§ 26(2)), manglende
--              presentasjon til tillitsvalgte (§ 26(5)).
--   Restrisiko: Detaljert lønnsstatistikk per stillingskategori krever HR-system-
--               integrasjon — planen refererer til vedlegg fra lønnsystemet.
--
-- UUID slot: 00000000-d000-4000-a000-000000000109 (next after trakasseringsrutine)

-- ── 1. Seed the ARP document template ────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000109',
  'tpl-arp-redegjorelse',
  'Aktivitets- og redegjørelsesrapport (ARP) — LDL § 26',
  'Mal for obligatorisk årsrapport om likestilling og diskriminering. Dokumenterer aktiviteter og resultater innen lønn, forfremmelse, rekruttering, foreldrepermisjon og forebygging av trakassering — påkrevd for virksomheter med ≥ 50 ansatte (LDL § 26).',
  'likestilling',
  array[
    'Likestillings- og diskrimineringsloven § 26',
    'Likestillings- og diskrimineringsloven § 26 (4)',
    'Likestillings- og diskrimineringsloven § 26 (5)',
    'AML § 4-3'
  ],
  109,
  jsonb_build_object('blocks', jsonb_build_array(

    jsonb_build_object(
      'kind', 'alert',
      'variant', 'info',
      'body', 'Denne rapporten skal utarbeides årlig og presenteres for tillitsvalgte eller ansattevalgte representanter (LDL § 26 (5)). For virksomheter med 20–49 ansatte gjelder plikten kun dersom det er inngått tariffavtale.'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 1,
      'text', 'Aktivitets- og redegjørelsesrapport'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p><strong>Virksomhet:</strong> [Navn]<br><strong>Organisasjonsnummer:</strong> [Orgnr]<br><strong>Rapporteringsperiode:</strong> [År]<br><strong>Utarbeidet av:</strong> [Navn, stilling]<br><strong>Dato:</strong> [Dato]</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '1. Om virksomheten og rapporteringsplikten'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p>Virksomheten er underlagt aktivitets- og redegjørelsesplikten etter LDL § 26 fordi den har [X] fast ansatte. Rapporten dekker alle diskrimineringsgrunnlag i likestillings- og diskrimineringsloven: kjønn, graviditet, foreldrepermisjon, omsorgsoppgaver, etnisitet, religion og livssyn, nedsatt funksjonsevne, seksuell orientering, kjønnsidentitet og kjønnsuttrykk, og alder.</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '2. Kjønnsfordeling og representasjon'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Stilling/nivå</th><th>Kvinner (%)</th><th>Menn (%)</th><th>Annet/ikke oppgitt (%)</th></tr></thead><tbody><tr><td>Totalt ansatte</td><td></td><td></td><td></td></tr><tr><td>Lederstillinger</td><td></td><td></td><td></td></tr><tr><td>Mellomledere</td><td></td><td></td><td></td></tr><tr><td>Fagansatte</td><td></td><td></td><td></td></tr><tr><td>Øvrige ansatte</td><td></td><td></td><td></td></tr></tbody></table><p><em>Kilde: HR-system per 31.12.[År]. Kategorisering etter intern stillingsinndeling.</em></p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '3. Lønnskartlegging (LDL § 26 (2))'
    ),

    jsonb_build_object(
      'kind', 'law_ref',
      'ref', 'Likestillings- og diskrimineringsloven § 26 (2)',
      'description', 'Virksomheter med aktivitetsplikt skal kartlegge lønn og lønnsforskjeller mellom kjønn, fordelt på like og likeverdige stillinger.'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p>Lønnskartleggingen er gjennomført for rapporteringsåret. Se vedlegg «Likelønnsanalyse [År]» fra lønnsystem/HR for detaljert statistikk per stillingskategori.</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Stillingskategori</th><th>Gjennomsnitt kvinner (kr)</th><th>Gjennomsnitt menn (kr)</th><th>Differanse (%)</th><th>Forklart av:</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody></table><p><strong>Konklusjon:</strong> [Beskriv om det er uforklarlige lønnsforskjeller og planlagte tiltak.]</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '4. Rekruttering og forfremmelse'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p><strong>4.1 Rekruttering</strong></p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Stilling</th><th>Søkere kvinner</th><th>Søkere menn</th><th>Ansatt</th></tr></thead><tbody><tr><td>Lederstillinger</td><td></td><td></td><td></td></tr><tr><td>Fagstillinger</td><td></td><td></td><td></td></tr></tbody></table><p><strong>4.2 Forfremmelse</strong></p><p>Antall interne forfremmelser i [År]: [X] kvinner, [Y] menn. [Beskriv eventuelle skjevheter og tiltak.]</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '5. Foreldrepermisjon og tilrettelegging'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Type permisjon</th><th>Kvinner (antall/uker)</th><th>Menn (antall/uker)</th></tr></thead><tbody><tr><td>Svangerskapspermisjon</td><td></td><td>—</td></tr><tr><td>Fedrekvote</td><td>—</td><td></td></tr><tr><td>Fellesuker tatt ut av far/medforelder</td><td>—</td><td></td></tr><tr><td>Tilrettelegging under/etter permisjon</td><td></td><td></td></tr></tbody></table><p>Kommentarer: [Beskriv ev. utfordringer og tiltak for å fremme likedeling av foreldrepermisjon.]</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '6. Forebygging av trakassering og diskriminering'
    ),

    jsonb_build_object(
      'kind', 'law_ref',
      'ref', 'AML § 4-3',
      'description', 'Arbeidsgiver skal sørge for et arbeidsmiljø fritt for trakassering og annen utilbørlig atferd.'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p>Gjennomførte aktiviteter i [År]:</p><ul><li>[ ] Gjennomgang av rutine for håndtering av trakassering</li><li>[ ] Opplæring av ledere i forebygging av trakassering</li><li>[ ] Medarbeiderundersøkelse — spørsmål om psykososialt arbeidsmiljø</li><li>[ ] Behandlede varsler om trakassering: [antall], utfall: [beskriv uten personidentifikasjon]</li></ul><p><strong>Tiltak neste år:</strong> [Beskriv planlagte tiltak.]</p>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '7. Øvrige aktiviteter og tiltak (LDL § 26 (4))'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p>Andre gjennomførte aktiviteter for å fremme likestilling og hindre diskriminering:</p><ul><li>[ ] Universell utforming av arbeidssted og digitale verktøy</li><li>[ ] Tilrettelegging for ansatte med nedsatt funksjonsevne</li><li>[ ] Tiltak for å hindre aldersdiskriminering</li><li>[ ] Opplæring i mangfold og inkludering</li></ul>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '8. Mål og tiltak for neste rapporteringsår'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Mål</th><th>Tiltak</th><th>Ansvarlig</th><th>Frist</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>'
    ),

    jsonb_build_object(
      'kind', 'heading',
      'level', 2,
      'text', '9. Presentasjon for tillitsvalgte / ansattevalgte representanter'
    ),

    jsonb_build_object(
      'kind', 'law_ref',
      'ref', 'Likestillings- og diskrimineringsloven § 26 (5)',
      'description', 'Redegjørelsen skal drøftes med tillitsvalgte eller annet representativt organ for ansatte.'
    ),

    jsonb_build_object(
      'kind', 'text',
      'body', '<p>Rapporten ble presentert for [tillitsvalgte / AMU / ansattevalgt representant] den [dato]. Tilstedeværende representanter: [navn/funksjon]. Kommentarer og innspill fra representantene: [beskriv].</p>'
    ),

    jsonb_build_object(
      'kind', 'acknowledgement_footer',
      'requiresSignature', true,
      'label', 'Rapporten er godkjent av virksomhetens ledelse',
      'confirmText', 'Jeg bekrefter at rapporten er korrekt og fullstendig, og at den er presentert for ansattevalgte representanter iht. LDL § 26 (5).'
    )

  ))
) on conflict (id) do update set
  slug = excluded.slug,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  sort_order = excluded.sort_order,
  page_payload = excluded.page_payload;
