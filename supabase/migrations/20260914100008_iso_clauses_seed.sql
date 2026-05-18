-- ISO IMS — clause catalogue seed.
--
-- Seeds iso_standard_clauses with the clause structure (§4–§10) for
-- ISO 9001:2015, ISO 14001:2015, ISO 45001:2018, and ISO 27001:2022,
-- plus Annex A top-level groupings (A.5–A.8) for ISO 27001.
-- Idempotent: re-applying updates title and position; never deletes rows.
-- Individual Annex A controls are stored in iso_27001_annex_a_controls.

set local search_path = public, pg_catalog;

-- ── ISO 9001:2015 — Kvalitetsstyringssystem ───────────────────────────────────

INSERT INTO iso_standard_clauses (id, standard, clause_id, title, parent_id, is_leaf, position) VALUES
  ('iso-9001:4',       'iso-9001', '4',       'Organisasjonens kontekst',                     NULL,            false,   10),
  ('iso-9001:4.1',     'iso-9001', '4.1',     'Forståelse av organisasjonen og dens kontekst','iso-9001:4',    true,    20),
  ('iso-9001:4.2',     'iso-9001', '4.2',     'Forståelse av interesseparters behov og forventninger','iso-9001:4', true, 30),
  ('iso-9001:4.3',     'iso-9001', '4.3',     'Fastlegge kvalitetsstyringssystemets omfang',  'iso-9001:4',    true,    40),
  ('iso-9001:4.4',     'iso-9001', '4.4',     'Kvalitetsstyringssystem og dets prosesser',    'iso-9001:4',    false,   50),
  ('iso-9001:4.4.1',   'iso-9001', '4.4.1',   'Prosesskrav',                                  'iso-9001:4.4',  true,    60),
  ('iso-9001:4.4.2',   'iso-9001', '4.4.2',   'Dokumentert informasjon for prosesser',        'iso-9001:4.4',  true,    70),

  ('iso-9001:5',       'iso-9001', '5',       'Lederskap',                                    NULL,            false,   80),
  ('iso-9001:5.1',     'iso-9001', '5.1',     'Lederskap og forpliktelse',                    'iso-9001:5',    false,   90),
  ('iso-9001:5.1.1',   'iso-9001', '5.1.1',   'Generelt',                                     'iso-9001:5.1',  true,   100),
  ('iso-9001:5.1.2',   'iso-9001', '5.1.2',   'Kundefokus',                                   'iso-9001:5.1',  true,   110),
  ('iso-9001:5.2',     'iso-9001', '5.2',     'Policy',                                       'iso-9001:5',    false,  120),
  ('iso-9001:5.2.1',   'iso-9001', '5.2.1',   'Etablere kvalitetspolicyen',                   'iso-9001:5.2',  true,   130),
  ('iso-9001:5.2.2',   'iso-9001', '5.2.2',   'Kommunisere kvalitetspolicyen',                'iso-9001:5.2',  true,   140),
  ('iso-9001:5.3',     'iso-9001', '5.3',     'Organisatoriske roller, ansvar og myndighet',  'iso-9001:5',    true,   150),

  ('iso-9001:6',       'iso-9001', '6',       'Planlegging',                                  NULL,            false,  160),
  ('iso-9001:6.1',     'iso-9001', '6.1',     'Tiltak for å håndtere risikoer og muligheter', 'iso-9001:6',    false,  170),
  ('iso-9001:6.1.1',   'iso-9001', '6.1.1',   'Fastsette risikoer og muligheter',             'iso-9001:6.1',  true,   180),
  ('iso-9001:6.1.2',   'iso-9001', '6.1.2',   'Planlegge tiltak',                             'iso-9001:6.1',  true,   190),
  ('iso-9001:6.2',     'iso-9001', '6.2',     'Kvalitetsmål og planlegging for å nå dem',     'iso-9001:6',    false,  200),
  ('iso-9001:6.2.1',   'iso-9001', '6.2.1',   'Fastsette kvalitetsmål',                       'iso-9001:6.2',  true,   210),
  ('iso-9001:6.2.2',   'iso-9001', '6.2.2',   'Planlegge for å nå kvalitetsmål',              'iso-9001:6.2',  true,   220),
  ('iso-9001:6.3',     'iso-9001', '6.3',     'Planlegging av endringer',                     'iso-9001:6',    true,   230),

  ('iso-9001:7',       'iso-9001', '7',       'Støtte',                                       NULL,            false,  240),
  ('iso-9001:7.1',     'iso-9001', '7.1',     'Ressurser',                                    'iso-9001:7',    false,  250),
  ('iso-9001:7.1.1',   'iso-9001', '7.1.1',   'Generelt',                                     'iso-9001:7.1',  true,   260),
  ('iso-9001:7.1.2',   'iso-9001', '7.1.2',   'Personer',                                     'iso-9001:7.1',  true,   270),
  ('iso-9001:7.1.3',   'iso-9001', '7.1.3',   'Infrastruktur',                                'iso-9001:7.1',  true,   280),
  ('iso-9001:7.1.4',   'iso-9001', '7.1.4',   'Prosessmiljø',                                 'iso-9001:7.1',  true,   290),
  ('iso-9001:7.1.5',   'iso-9001', '7.1.5',   'Ressurser for overvåkning og måling',          'iso-9001:7.1',  true,   300),
  ('iso-9001:7.1.6',   'iso-9001', '7.1.6',   'Organisasjonsmessig kunnskap',                 'iso-9001:7.1',  true,   310),
  ('iso-9001:7.2',     'iso-9001', '7.2',     'Kompetanse',                                   'iso-9001:7',    true,   320),
  ('iso-9001:7.3',     'iso-9001', '7.3',     'Bevissthet',                                   'iso-9001:7',    true,   330),
  ('iso-9001:7.4',     'iso-9001', '7.4',     'Kommunikasjon',                                'iso-9001:7',    true,   340),
  ('iso-9001:7.5',     'iso-9001', '7.5',     'Dokumentert informasjon',                      'iso-9001:7',    false,  350),
  ('iso-9001:7.5.1',   'iso-9001', '7.5.1',   'Generelt',                                     'iso-9001:7.5',  true,   360),
  ('iso-9001:7.5.2',   'iso-9001', '7.5.2',   'Opprette og oppdatere',                        'iso-9001:7.5',  true,   370),
  ('iso-9001:7.5.3',   'iso-9001', '7.5.3',   'Kontroll av dokumentert informasjon',          'iso-9001:7.5',  true,   380),

  ('iso-9001:8',       'iso-9001', '8',       'Drift',                                        NULL,            false,  390),
  ('iso-9001:8.1',     'iso-9001', '8.1',     'Driftsplanlegging og -styring',                'iso-9001:8',    true,   400),
  ('iso-9001:8.2',     'iso-9001', '8.2',     'Krav til produkter og tjenester',              'iso-9001:8',    false,  410),
  ('iso-9001:8.2.1',   'iso-9001', '8.2.1',   'Kommunikasjon med kunder',                     'iso-9001:8.2',  true,   420),
  ('iso-9001:8.2.2',   'iso-9001', '8.2.2',   'Fastsette krav til produkter og tjenester',   'iso-9001:8.2',  true,   430),
  ('iso-9001:8.2.3',   'iso-9001', '8.2.3',   'Gjennomgå krav til produkter og tjenester',   'iso-9001:8.2',  true,   440),
  ('iso-9001:8.2.4',   'iso-9001', '8.2.4',   'Endringer i krav til produkter og tjenester', 'iso-9001:8.2',  true,   450),
  ('iso-9001:8.3',     'iso-9001', '8.3',     'Design og utvikling av produkter og tjenester','iso-9001:8',   false,  460),
  ('iso-9001:8.3.1',   'iso-9001', '8.3.1',   'Generelt',                                     'iso-9001:8.3',  true,   470),
  ('iso-9001:8.3.2',   'iso-9001', '8.3.2',   'Planlegging av design og utvikling',           'iso-9001:8.3',  true,   480),
  ('iso-9001:8.3.3',   'iso-9001', '8.3.3',   'Inndata for design og utvikling',              'iso-9001:8.3',  true,   490),
  ('iso-9001:8.3.4',   'iso-9001', '8.3.4',   'Kontroller for design og utvikling',           'iso-9001:8.3',  true,   500),
  ('iso-9001:8.3.5',   'iso-9001', '8.3.5',   'Utdata fra design og utvikling',               'iso-9001:8.3',  true,   510),
  ('iso-9001:8.3.6',   'iso-9001', '8.3.6',   'Endringer i design og utvikling',              'iso-9001:8.3',  true,   520),
  ('iso-9001:8.4',     'iso-9001', '8.4',     'Kontroll av eksternt leverte prosesser, produkter og tjenester', 'iso-9001:8', false, 530),
  ('iso-9001:8.4.1',   'iso-9001', '8.4.1',   'Generelt',                                     'iso-9001:8.4',  true,   540),
  ('iso-9001:8.4.2',   'iso-9001', '8.4.2',   'Type og omfang av kontroll',                   'iso-9001:8.4',  true,   550),
  ('iso-9001:8.4.3',   'iso-9001', '8.4.3',   'Informasjon til eksterne leverandører',        'iso-9001:8.4',  true,   560),
  ('iso-9001:8.5',     'iso-9001', '8.5',     'Produksjon og tjenesteleveranse',              'iso-9001:8',    false,  570),
  ('iso-9001:8.5.1',   'iso-9001', '8.5.1',   'Kontroll av produksjon og tjenesteleveranse',  'iso-9001:8.5',  true,   580),
  ('iso-9001:8.5.2',   'iso-9001', '8.5.2',   'Identifikasjon og sporbarhet',                 'iso-9001:8.5',  true,   590),
  ('iso-9001:8.5.3',   'iso-9001', '8.5.3',   'Eiendom tilhørende kunder eller eksterne parter','iso-9001:8.5',true,   600),
  ('iso-9001:8.5.4',   'iso-9001', '8.5.4',   'Bevaring',                                     'iso-9001:8.5',  true,   610),
  ('iso-9001:8.5.5',   'iso-9001', '8.5.5',   'Aktiviteter etter leveranse',                  'iso-9001:8.5',  true,   620),
  ('iso-9001:8.5.6',   'iso-9001', '8.5.6',   'Kontroll av endringer',                        'iso-9001:8.5',  true,   630),
  ('iso-9001:8.6',     'iso-9001', '8.6',     'Frigivelse av produkter og tjenester',         'iso-9001:8',    true,   640),
  ('iso-9001:8.7',     'iso-9001', '8.7',     'Kontroll av avvikende utdata',                 'iso-9001:8',    true,   650),

  ('iso-9001:9',       'iso-9001', '9',       'Evaluering av ytelse',                         NULL,            false,  660),
  ('iso-9001:9.1',     'iso-9001', '9.1',     'Overvåkning, måling, analyse og evaluering',   'iso-9001:9',    false,  670),
  ('iso-9001:9.1.1',   'iso-9001', '9.1.1',   'Generelt',                                     'iso-9001:9.1',  true,   680),
  ('iso-9001:9.1.2',   'iso-9001', '9.1.2',   'Kundetilfredshet',                             'iso-9001:9.1',  true,   690),
  ('iso-9001:9.1.3',   'iso-9001', '9.1.3',   'Analyse og evaluering',                        'iso-9001:9.1',  true,   700),
  ('iso-9001:9.2',     'iso-9001', '9.2',     'Intern revisjon',                              'iso-9001:9',    false,  710),
  ('iso-9001:9.2.1',   'iso-9001', '9.2.1',   'Gjennomføre interne revisjoner',               'iso-9001:9.2',  true,   720),
  ('iso-9001:9.2.2',   'iso-9001', '9.2.2',   'Program for intern revisjon',                  'iso-9001:9.2',  true,   730),
  ('iso-9001:9.3',     'iso-9001', '9.3',     'Ledelsens gjennomgåelse',                      'iso-9001:9',    false,  740),
  ('iso-9001:9.3.1',   'iso-9001', '9.3.1',   'Generelt',                                     'iso-9001:9.3',  true,   750),
  ('iso-9001:9.3.2',   'iso-9001', '9.3.2',   'Inndata til ledelsens gjennomgåelse',          'iso-9001:9.3',  true,   760),
  ('iso-9001:9.3.3',   'iso-9001', '9.3.3',   'Utdata fra ledelsens gjennomgåelse',           'iso-9001:9.3',  true,   770),

  ('iso-9001:10',      'iso-9001', '10',      'Forbedring',                                   NULL,            false,  780),
  ('iso-9001:10.1',    'iso-9001', '10.1',    'Generelt',                                     'iso-9001:10',   true,   790),
  ('iso-9001:10.2',    'iso-9001', '10.2',    'Avvik og korrigerende tiltak',                 'iso-9001:10',   true,   800),
  ('iso-9001:10.3',    'iso-9001', '10.3',    'Kontinuerlig forbedring',                      'iso-9001:10',   true,   810)

ON CONFLICT (id) DO UPDATE SET
  title    = EXCLUDED.title,
  position = EXCLUDED.position;

-- ── ISO 14001:2015 — Miljøstyringssystem ─────────────────────────────────────

INSERT INTO iso_standard_clauses (id, standard, clause_id, title, parent_id, is_leaf, position) VALUES
  ('iso-14001:4',       'iso-14001', '4',     'Organisasjonens kontekst',                     NULL,              false,   10),
  ('iso-14001:4.1',     'iso-14001', '4.1',   'Forståelse av organisasjonen og dens kontekst','iso-14001:4',     true,    20),
  ('iso-14001:4.2',     'iso-14001', '4.2',   'Forståelse av interesseparters behov og forventninger','iso-14001:4', true, 30),
  ('iso-14001:4.3',     'iso-14001', '4.3',   'Fastlegge miljøstyringssystemets omfang',      'iso-14001:4',     true,    40),
  ('iso-14001:4.4',     'iso-14001', '4.4',   'Miljøstyringssystem',                          'iso-14001:4',     true,    50),

  ('iso-14001:5',       'iso-14001', '5',     'Lederskap',                                    NULL,              false,   60),
  ('iso-14001:5.1',     'iso-14001', '5.1',   'Lederskap og forpliktelse',                    'iso-14001:5',     true,    70),
  ('iso-14001:5.2',     'iso-14001', '5.2',   'Miljøpolicy',                                  'iso-14001:5',     true,    80),
  ('iso-14001:5.3',     'iso-14001', '5.3',   'Organisatoriske roller, ansvar og myndighet',  'iso-14001:5',     true,    90),

  ('iso-14001:6',       'iso-14001', '6',     'Planlegging',                                  NULL,              false,  100),
  ('iso-14001:6.1',     'iso-14001', '6.1',   'Tiltak for å håndtere risikoer og muligheter', 'iso-14001:6',     false,  110),
  ('iso-14001:6.1.1',   'iso-14001', '6.1.1', 'Generelt',                                     'iso-14001:6.1',   true,   120),
  ('iso-14001:6.1.2',   'iso-14001', '6.1.2', 'Miljøaspekter',                                'iso-14001:6.1',   true,   130),
  ('iso-14001:6.1.3',   'iso-14001', '6.1.3', 'Bindende forpliktelser',                       'iso-14001:6.1',   true,   140),
  ('iso-14001:6.1.4',   'iso-14001', '6.1.4', 'Planlegging av tiltak',                        'iso-14001:6.1',   true,   150),
  ('iso-14001:6.2',     'iso-14001', '6.2',   'Miljømål og planlegging for å nå dem',         'iso-14001:6',     false,  160),
  ('iso-14001:6.2.1',   'iso-14001', '6.2.1', 'Fastsette miljømål',                           'iso-14001:6.2',   true,   170),
  ('iso-14001:6.2.2',   'iso-14001', '6.2.2', 'Planlegge for å nå miljømål',                  'iso-14001:6.2',   true,   180),

  ('iso-14001:7',       'iso-14001', '7',     'Støtte',                                       NULL,              false,  190),
  ('iso-14001:7.1',     'iso-14001', '7.1',   'Ressurser',                                    'iso-14001:7',     true,   200),
  ('iso-14001:7.2',     'iso-14001', '7.2',   'Kompetanse',                                   'iso-14001:7',     true,   210),
  ('iso-14001:7.3',     'iso-14001', '7.3',   'Bevissthet',                                   'iso-14001:7',     true,   220),
  ('iso-14001:7.4',     'iso-14001', '7.4',   'Kommunikasjon',                                'iso-14001:7',     false,  230),
  ('iso-14001:7.4.1',   'iso-14001', '7.4.1', 'Generelt',                                     'iso-14001:7.4',   true,   240),
  ('iso-14001:7.4.2',   'iso-14001', '7.4.2', 'Intern kommunikasjon',                         'iso-14001:7.4',   true,   250),
  ('iso-14001:7.4.3',   'iso-14001', '7.4.3', 'Ekstern kommunikasjon',                        'iso-14001:7.4',   true,   260),
  ('iso-14001:7.5',     'iso-14001', '7.5',   'Dokumentert informasjon',                      'iso-14001:7',     false,  270),
  ('iso-14001:7.5.1',   'iso-14001', '7.5.1', 'Generelt',                                     'iso-14001:7.5',   true,   280),
  ('iso-14001:7.5.2',   'iso-14001', '7.5.2', 'Opprette og oppdatere',                        'iso-14001:7.5',   true,   290),
  ('iso-14001:7.5.3',   'iso-14001', '7.5.3', 'Kontroll av dokumentert informasjon',          'iso-14001:7.5',   true,   300),

  ('iso-14001:8',       'iso-14001', '8',     'Drift',                                        NULL,              false,  310),
  ('iso-14001:8.1',     'iso-14001', '8.1',   'Driftsplanlegging og -styring',                'iso-14001:8',     true,   320),
  ('iso-14001:8.2',     'iso-14001', '8.2',   'Beredskap og innsats ved nødsituasjoner',      'iso-14001:8',     true,   330),

  ('iso-14001:9',       'iso-14001', '9',     'Evaluering av ytelse',                         NULL,              false,  340),
  ('iso-14001:9.1',     'iso-14001', '9.1',   'Overvåkning, måling, analyse og evaluering',   'iso-14001:9',     false,  350),
  ('iso-14001:9.1.1',   'iso-14001', '9.1.1', 'Generelt',                                     'iso-14001:9.1',   true,   360),
  ('iso-14001:9.1.2',   'iso-14001', '9.1.2', 'Evaluering av samsvar',                        'iso-14001:9.1',   true,   370),
  ('iso-14001:9.2',     'iso-14001', '9.2',   'Intern revisjon',                              'iso-14001:9',     false,  380),
  ('iso-14001:9.2.1',   'iso-14001', '9.2.1', 'Generelt',                                     'iso-14001:9.2',   true,   390),
  ('iso-14001:9.2.2',   'iso-14001', '9.2.2', 'Program for intern revisjon',                  'iso-14001:9.2',   true,   400),
  ('iso-14001:9.3',     'iso-14001', '9.3',   'Ledelsens gjennomgåelse',                      'iso-14001:9',     true,   410),

  ('iso-14001:10',      'iso-14001', '10',    'Forbedring',                                   NULL,              false,  420),
  ('iso-14001:10.1',    'iso-14001', '10.1',  'Generelt',                                     'iso-14001:10',    true,   430),
  ('iso-14001:10.2',    'iso-14001', '10.2',  'Avvik og korrigerende tiltak',                 'iso-14001:10',    true,   440),
  ('iso-14001:10.3',    'iso-14001', '10.3',  'Kontinuerlig forbedring',                      'iso-14001:10',    true,   450)

ON CONFLICT (id) DO UPDATE SET
  title    = EXCLUDED.title,
  position = EXCLUDED.position;

-- ── ISO 45001:2018 — Arbeidsmiljøstyringssystem ───────────────────────────────

INSERT INTO iso_standard_clauses (id, standard, clause_id, title, parent_id, is_leaf, position) VALUES
  ('iso-45001:4',       'iso-45001', '4',     'Organisasjonens kontekst',                     NULL,              false,   10),
  ('iso-45001:4.1',     'iso-45001', '4.1',   'Forståelse av organisasjonen og dens kontekst','iso-45001:4',     true,    20),
  ('iso-45001:4.2',     'iso-45001', '4.2',   'Forståelse av arbeidstakeres og andre interesseparters behov og forventninger','iso-45001:4', true, 30),
  ('iso-45001:4.3',     'iso-45001', '4.3',   'Fastlegge OH&S-styringssystemets omfang',      'iso-45001:4',     true,    40),
  ('iso-45001:4.4',     'iso-45001', '4.4',   'OH&S-styringssystem',                          'iso-45001:4',     true,    50),

  ('iso-45001:5',       'iso-45001', '5',     'Lederskap og arbeidstakernes medvirkning',     NULL,              false,   60),
  ('iso-45001:5.1',     'iso-45001', '5.1',   'Lederskap og forpliktelse',                    'iso-45001:5',     true,    70),
  ('iso-45001:5.2',     'iso-45001', '5.2',   'OH&S-policy',                                  'iso-45001:5',     true,    80),
  ('iso-45001:5.3',     'iso-45001', '5.3',   'Organisatoriske roller, ansvar, ansvarliggjøring og myndighet', 'iso-45001:5', true, 90),
  ('iso-45001:5.4',     'iso-45001', '5.4',   'Samråd og deltakelse fra arbeidstakere',       'iso-45001:5',     true,   100),

  ('iso-45001:6',       'iso-45001', '6',     'Planlegging',                                  NULL,              false,  110),
  ('iso-45001:6.1',     'iso-45001', '6.1',   'Tiltak for å håndtere risikoer og muligheter', 'iso-45001:6',     false,  120),
  ('iso-45001:6.1.1',   'iso-45001', '6.1.1', 'Generelt',                                     'iso-45001:6.1',   true,   130),
  ('iso-45001:6.1.2',   'iso-45001', '6.1.2', 'Identifisering av farer og vurdering av risikoer og muligheter', 'iso-45001:6.1', false, 140),
  ('iso-45001:6.1.2.1', 'iso-45001', '6.1.2.1','Identifisering av farer',                    'iso-45001:6.1.2', true,   150),
  ('iso-45001:6.1.2.2', 'iso-45001', '6.1.2.2','Vurdering av OH&S-risikoer og andre risikoer for OH&S-styringssystemet','iso-45001:6.1.2', true, 160),
  ('iso-45001:6.1.2.3', 'iso-45001', '6.1.2.3','Vurdering av OH&S-muligheter og andre muligheter for OH&S-styringssystemet','iso-45001:6.1.2', true, 170),
  ('iso-45001:6.1.3',   'iso-45001', '6.1.3', 'Fastsette juridiske og andre krav',            'iso-45001:6.1',   true,   180),
  ('iso-45001:6.1.4',   'iso-45001', '6.1.4', 'Planlegging av tiltak',                        'iso-45001:6.1',   true,   190),
  ('iso-45001:6.2',     'iso-45001', '6.2',   'OH&S-mål og planlegging for å nå dem',         'iso-45001:6',     false,  200),
  ('iso-45001:6.2.1',   'iso-45001', '6.2.1', 'Fastsette OH&S-mål',                           'iso-45001:6.2',   true,   210),
  ('iso-45001:6.2.2',   'iso-45001', '6.2.2', 'Planlegge for å nå OH&S-mål',                  'iso-45001:6.2',   true,   220),

  ('iso-45001:7',       'iso-45001', '7',     'Støtte',                                       NULL,              false,  230),
  ('iso-45001:7.1',     'iso-45001', '7.1',   'Ressurser',                                    'iso-45001:7',     true,   240),
  ('iso-45001:7.2',     'iso-45001', '7.2',   'Kompetanse',                                   'iso-45001:7',     true,   250),
  ('iso-45001:7.3',     'iso-45001', '7.3',   'Bevissthet',                                   'iso-45001:7',     true,   260),
  ('iso-45001:7.4',     'iso-45001', '7.4',   'Kommunikasjon',                                'iso-45001:7',     false,  270),
  ('iso-45001:7.4.1',   'iso-45001', '7.4.1', 'Generelt',                                     'iso-45001:7.4',   true,   280),
  ('iso-45001:7.4.2',   'iso-45001', '7.4.2', 'Intern kommunikasjon',                         'iso-45001:7.4',   true,   290),
  ('iso-45001:7.4.3',   'iso-45001', '7.4.3', 'Ekstern kommunikasjon',                        'iso-45001:7.4',   true,   300),
  ('iso-45001:7.5',     'iso-45001', '7.5',   'Dokumentert informasjon',                      'iso-45001:7',     false,  310),
  ('iso-45001:7.5.1',   'iso-45001', '7.5.1', 'Generelt',                                     'iso-45001:7.5',   true,   320),
  ('iso-45001:7.5.2',   'iso-45001', '7.5.2', 'Opprette og oppdatere',                        'iso-45001:7.5',   true,   330),
  ('iso-45001:7.5.3',   'iso-45001', '7.5.3', 'Kontroll av dokumentert informasjon',          'iso-45001:7.5',   true,   340),

  ('iso-45001:8',       'iso-45001', '8',     'Drift',                                        NULL,              false,  350),
  ('iso-45001:8.1',     'iso-45001', '8.1',   'Driftsplanlegging og -styring',                'iso-45001:8',     false,  360),
  ('iso-45001:8.1.1',   'iso-45001', '8.1.1', 'Generelt',                                     'iso-45001:8.1',   true,   370),
  ('iso-45001:8.1.2',   'iso-45001', '8.1.2', 'Eliminering av farer og reduksjon av OH&S-risikoer', 'iso-45001:8.1', true, 380),
  ('iso-45001:8.1.3',   'iso-45001', '8.1.3', 'Styring av endringer',                         'iso-45001:8.1',   true,   390),
  ('iso-45001:8.1.4',   'iso-45001', '8.1.4', 'Innkjøp',                                      'iso-45001:8.1',   false,  400),
  ('iso-45001:8.1.4.1', 'iso-45001', '8.1.4.1','Generelt',                                    'iso-45001:8.1.4', true,   410),
  ('iso-45001:8.1.4.2', 'iso-45001', '8.1.4.2','Leverandører',                                'iso-45001:8.1.4', true,   420),
  ('iso-45001:8.1.4.3', 'iso-45001', '8.1.4.3','Utkontraktering',                             'iso-45001:8.1.4', true,   430),
  ('iso-45001:8.2',     'iso-45001', '8.2',   'Beredskap og innsats ved nødsituasjoner',      'iso-45001:8',     true,   440),

  ('iso-45001:9',       'iso-45001', '9',     'Evaluering av ytelse',                         NULL,              false,  450),
  ('iso-45001:9.1',     'iso-45001', '9.1',   'Overvåkning, måling, analyse og evaluering av ytelse', 'iso-45001:9', false, 460),
  ('iso-45001:9.1.1',   'iso-45001', '9.1.1', 'Generelt',                                     'iso-45001:9.1',   true,   470),
  ('iso-45001:9.1.2',   'iso-45001', '9.1.2', 'Evaluering av samsvar',                        'iso-45001:9.1',   true,   480),
  ('iso-45001:9.2',     'iso-45001', '9.2',   'Intern revisjon',                              'iso-45001:9',     false,  490),
  ('iso-45001:9.2.1',   'iso-45001', '9.2.1', 'Generelt',                                     'iso-45001:9.2',   true,   500),
  ('iso-45001:9.2.2',   'iso-45001', '9.2.2', 'Program for intern revisjon',                  'iso-45001:9.2',   true,   510),
  ('iso-45001:9.3',     'iso-45001', '9.3',   'Ledelsens gjennomgåelse',                      'iso-45001:9',     true,   520),

  ('iso-45001:10',      'iso-45001', '10',    'Forbedring',                                   NULL,              false,  530),
  ('iso-45001:10.1',    'iso-45001', '10.1',  'Generelt',                                     'iso-45001:10',    true,   540),
  ('iso-45001:10.2',    'iso-45001', '10.2',  'Hendelser, avvik og korrigerende tiltak',       'iso-45001:10',    true,   550),
  ('iso-45001:10.3',    'iso-45001', '10.3',  'Kontinuerlig forbedring',                      'iso-45001:10',    true,   560)

ON CONFLICT (id) DO UPDATE SET
  title    = EXCLUDED.title,
  position = EXCLUDED.position;

-- ── ISO 27001:2022 — Styringssystem for informasjonssikkerhet (ISMS) ──────────
-- Clauses 4–10 follow the Harmonized Structure.
-- Annex A groupings (A.5–A.8) are seeded as top-level headings only;
-- individual controls live in iso_27001_annex_a_controls (see 20260914100003).

INSERT INTO iso_standard_clauses (id, standard, clause_id, title, parent_id, is_leaf, position) VALUES
  ('iso-27001:4',       'iso-27001', '4',     'Organisasjonens kontekst',                     NULL,              false,   10),
  ('iso-27001:4.1',     'iso-27001', '4.1',   'Forståelse av organisasjonen og dens kontekst','iso-27001:4',     true,    20),
  ('iso-27001:4.2',     'iso-27001', '4.2',   'Forståelse av interesseparters behov og forventninger','iso-27001:4', true, 30),
  ('iso-27001:4.3',     'iso-27001', '4.3',   'Fastlegge ISMS-omfanget',                      'iso-27001:4',     true,    40),
  ('iso-27001:4.4',     'iso-27001', '4.4',   'Styringssystem for informasjonssikkerhet',     'iso-27001:4',     true,    50),

  ('iso-27001:5',       'iso-27001', '5',     'Lederskap',                                    NULL,              false,   60),
  ('iso-27001:5.1',     'iso-27001', '5.1',   'Lederskap og forpliktelse',                    'iso-27001:5',     true,    70),
  ('iso-27001:5.2',     'iso-27001', '5.2',   'Policy',                                       'iso-27001:5',     true,    80),
  ('iso-27001:5.3',     'iso-27001', '5.3',   'Organisatoriske roller, ansvar og myndighet',  'iso-27001:5',     true,    90),

  ('iso-27001:6',       'iso-27001', '6',     'Planlegging',                                  NULL,              false,  100),
  ('iso-27001:6.1',     'iso-27001', '6.1',   'Tiltak for å håndtere risikoer og muligheter', 'iso-27001:6',     false,  110),
  ('iso-27001:6.1.1',   'iso-27001', '6.1.1', 'Generelt',                                     'iso-27001:6.1',   true,   120),
  ('iso-27001:6.1.2',   'iso-27001', '6.1.2', 'Vurdering av informasjonssikkerhetsrisiko',    'iso-27001:6.1',   true,   130),
  ('iso-27001:6.1.3',   'iso-27001', '6.1.3', 'Håndtering av informasjonssikkerhetsrisiko',   'iso-27001:6.1',   true,   140),
  ('iso-27001:6.2',     'iso-27001', '6.2',   'Informasjonssikkerhetsmål og planlegging for å nå dem', 'iso-27001:6', true, 150),
  ('iso-27001:6.3',     'iso-27001', '6.3',   'Planlegging av endringer',                     'iso-27001:6',     true,   160),

  ('iso-27001:7',       'iso-27001', '7',     'Støtte',                                       NULL,              false,  170),
  ('iso-27001:7.1',     'iso-27001', '7.1',   'Ressurser',                                    'iso-27001:7',     true,   180),
  ('iso-27001:7.2',     'iso-27001', '7.2',   'Kompetanse',                                   'iso-27001:7',     true,   190),
  ('iso-27001:7.3',     'iso-27001', '7.3',   'Bevissthet',                                   'iso-27001:7',     true,   200),
  ('iso-27001:7.4',     'iso-27001', '7.4',   'Kommunikasjon',                                'iso-27001:7',     true,   210),
  ('iso-27001:7.5',     'iso-27001', '7.5',   'Dokumentert informasjon',                      'iso-27001:7',     false,  220),
  ('iso-27001:7.5.1',   'iso-27001', '7.5.1', 'Generelt',                                     'iso-27001:7.5',   true,   230),
  ('iso-27001:7.5.2',   'iso-27001', '7.5.2', 'Opprette og oppdatere',                        'iso-27001:7.5',   true,   240),
  ('iso-27001:7.5.3',   'iso-27001', '7.5.3', 'Kontroll av dokumentert informasjon',          'iso-27001:7.5',   true,   250),

  ('iso-27001:8',       'iso-27001', '8',     'Drift',                                        NULL,              false,  260),
  ('iso-27001:8.1',     'iso-27001', '8.1',   'Driftsplanlegging og -styring',                'iso-27001:8',     true,   270),
  ('iso-27001:8.2',     'iso-27001', '8.2',   'Vurdering av informasjonssikkerhetsrisiko',    'iso-27001:8',     true,   280),
  ('iso-27001:8.3',     'iso-27001', '8.3',   'Håndtering av informasjonssikkerhetsrisiko',   'iso-27001:8',     true,   290),

  ('iso-27001:9',       'iso-27001', '9',     'Evaluering av ytelse',                         NULL,              false,  300),
  ('iso-27001:9.1',     'iso-27001', '9.1',   'Overvåkning, måling, analyse og evaluering',   'iso-27001:9',     true,   310),
  ('iso-27001:9.2',     'iso-27001', '9.2',   'Intern revisjon',                              'iso-27001:9',     false,  320),
  ('iso-27001:9.2.1',   'iso-27001', '9.2.1', 'Generelt',                                     'iso-27001:9.2',   true,   330),
  ('iso-27001:9.2.2',   'iso-27001', '9.2.2', 'Program for intern revisjon',                  'iso-27001:9.2',   true,   340),
  ('iso-27001:9.3',     'iso-27001', '9.3',   'Ledelsens gjennomgåelse',                      'iso-27001:9',     false,  350),
  ('iso-27001:9.3.1',   'iso-27001', '9.3.1', 'Generelt',                                     'iso-27001:9.3',   true,   360),
  ('iso-27001:9.3.2',   'iso-27001', '9.3.2', 'Inndata til ledelsens gjennomgåelse',          'iso-27001:9.3',   true,   370),
  ('iso-27001:9.3.3',   'iso-27001', '9.3.3', 'Utdata fra ledelsens gjennomgåelse',           'iso-27001:9.3',   true,   380),

  ('iso-27001:10',      'iso-27001', '10',    'Forbedring',                                   NULL,              false,  390),
  ('iso-27001:10.1',    'iso-27001', '10.1',  'Kontinuerlig forbedring',                      'iso-27001:10',    true,   400),
  ('iso-27001:10.2',    'iso-27001', '10.2',  'Avvik og korrigerende tiltak',                 'iso-27001:10',    true,   410),

  -- Annex A — top-level groupings only (controls are in iso_27001_annex_a_controls)
  ('iso-27001:A.5',     'iso-27001', 'A.5',   'Vedlegg A — Organisasjonskontroller (A.5)',    NULL,              false,  420),
  ('iso-27001:A.6',     'iso-27001', 'A.6',   'Vedlegg A — Personkontroller (A.6)',           NULL,              false,  430),
  ('iso-27001:A.7',     'iso-27001', 'A.7',   'Vedlegg A — Fysiske kontroller (A.7)',         NULL,              false,  440),
  ('iso-27001:A.8',     'iso-27001', 'A.8',   'Vedlegg A — Teknologiske kontroller (A.8)',    NULL,              false,  450)

ON CONFLICT (id) DO UPDATE SET
  title    = EXCLUDED.title,
  position = EXCLUDED.position;
