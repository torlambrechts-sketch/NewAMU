-- Compliance Requirements taxonomy expansion.
--
-- Two changes, both additive:
--   1. Split IK-forskriften §5 into eight numbered points (ik-5-1 …
--      ik-5-8) so coverage analysis can be granular per duty rather
--      than one rolled-up clause. The original ik-5 row is kept
--      active for backward compatibility with existing junctions
--      (vernerunde-standard's tagging continues to function).
--   2. Add AML system requirements that the dossier
--      (COMPLIANCE_TEMPLATE_COVERAGE.md) identifies as referenced
--      by proposed templates or as duty-imposing clauses worth
--      tracking in the taxonomy.
--
-- Out of scope here (TODO for an HMS-rådgiver-co-authored follow-up):
--   - Full chapter-by-chapter taxonomy of every § in Kap 1, Kap 2A,
--     Kap 7, Kap 8, Kap 9, Kap 10, Kap 12, Kap 13, Kap 15, Kap 16.
--   - Verbatim Norwegian description text for every row (titles only
--     here; descriptions can be filled in by domain expert later).
--
-- All rows are organization_id = NULL (system-defined). RLS already
-- prevents customer writes against system rows; platform ships
-- updates via additional migrations.

-- ── 1. IK-forskriften §5 — 8 numbered points ─────────────────────────────

insert into public.compliance_requirements
  (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  (null, 'aml-amu', 'ik-5-1', 'IK-forskriften §5 nr. 1',
   'Tilgang til lover og forskrifter',
   'Sørge for at lover og forskrifter i HMS-lovgivningen er tilgjengelig og ha oversikt over særlig viktige krav. (Ikke krav om skriftlig dokumentasjon.)',
   true, true),
  (null, 'aml-amu', 'ik-5-2', 'IK-forskriften §5 nr. 2',
   'Kunnskaper og ferdigheter hos arbeidstakere',
   'Sørge for at arbeidstakerne har tilstrekkelig kunnskaper og ferdigheter, inkl. informasjon ved endringer.',
   true, true),
  (null, 'aml-amu', 'ik-5-3', 'IK-forskriften §5 nr. 3',
   'Arbeidstakernes medvirkning',
   'Sørge for at arbeidstakerne medvirker slik at samlet kunnskap og erfaring utnyttes.',
   true, true),
  (null, 'aml-amu', 'ik-5-4', 'IK-forskriften §5 nr. 4',
   'Mål for HMS',
   'Fastsette mål for helse, miljø og sikkerhet. Krav om skriftlig dokumentasjon.',
   true, true),
  (null, 'aml-amu', 'ik-5-5', 'IK-forskriften §5 nr. 5',
   'Organisasjon, ansvar og oppgaver',
   'Ha oversikt over virksomhetens organisasjon, ansvar, oppgaver og myndighet for HMS-arbeidet. Krav om skriftlig dokumentasjon.',
   true, true),
  (null, 'aml-amu', 'ik-5-6', 'IK-forskriften §5 nr. 6',
   'Kartlegging, risikovurdering og planer',
   'Kartlegge farer og problemer, vurdere risiko, og utarbeide planer og tiltak. Krav om skriftlig dokumentasjon.',
   true, true),
  (null, 'aml-amu', 'ik-5-7', 'IK-forskriften §5 nr. 7',
   'Rutiner for å avdekke, rette opp og forebygge',
   'Iverksette rutiner for å avdekke, rette opp og forebygge overtredelser av HMS-lovgivningen. Krav om skriftlig dokumentasjon.',
   true, true),
  (null, 'aml-amu', 'ik-5-8', 'IK-forskriften §5 nr. 8',
   'Systematisk overvåkning og gjennomgang',
   'Foreta systematisk overvåkning og gjennomgang av internkontrollen for å sikre at den fungerer som forutsatt. Krav om skriftlig dokumentasjon.',
   true, true)
on conflict (pack, slug) where organization_id is null do nothing;

-- ── 2. AML — referenced by templates or otherwise duty-imposing ──────────

insert into public.compliance_requirements
  (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  -- Kap 2 — Plikter
  (null, 'aml-amu', 'aml-2-1', 'AML §2-1',
   'Arbeidsgivers plikter',
   'Arbeidsgiver skal sørge for at bestemmelsene gitt i og i medhold av denne lov blir overholdt.',
   true, true),
  (null, 'aml-amu', 'aml-2-2', 'AML §2-2',
   'Arbeidsgivers plikter overfor andre enn egne arbeidstakere',
   'Plikter overfor innleide og entreprenørers ansatte; samordningsansvar når flere virksomheter arbeider på samme sted.',
   true, true),
  (null, 'aml-amu', 'aml-2-3', 'AML §2-3',
   'Arbeidstakers medvirkningsplikt',
   'Arbeidstakers plikt til å medvirke i HMS-arbeidet, varsle om farer, melde yrkesskade og delta i oppfølging.',
   true, true),

  -- Kap 3 — Virkemidler (additions; aml-3-1 + aml-3-2 already seeded)
  (null, 'aml-amu', 'aml-3-3', 'AML §3-3',
   'Bedriftshelsetjeneste',
   'Plikt til å knytte til seg bedriftshelsetjeneste der risikoforholdene tilsier det.',
   true, true),
  (null, 'aml-amu', 'aml-3-4', 'AML §3-4',
   'Vurdering av tiltak for fysisk aktivitet',
   'Arbeidsgiver skal i tilknytning til det systematiske HMS-arbeidet vurdere tiltak for å fremme fysisk aktivitet blant arbeidstakerne.',
   true, true),
  (null, 'aml-amu', 'aml-3-5', 'AML §3-5',
   'Plikt for arbeidsgiver til å gjennomgå opplæring i HMS',
   'Arbeidsgiver skal gjennomgå opplæring i HMS-arbeid. Opplæringen skal kunne dokumenteres.',
   true, true),

  -- Kap 4 — Krav til arbeidsmiljøet (additions; 4-1, 4-3, 4-4, 4-5 already seeded)
  (null, 'aml-amu', 'aml-4-2', 'AML §4-2',
   'Krav om tilrettelegging, medvirkning og utvikling',
   'Arbeidet skal organiseres og tilrettelegges under hensyn til den enkelte arbeidstakers helse og forutsetninger; krav om medvirkning og kompetanseutvikling.',
   true, true),
  (null, 'aml-amu', 'aml-4-6', 'AML §4-6',
   'Tilrettelegging for arbeidstakere med redusert arbeidsevne',
   'Arbeidsgiver skal så langt det er mulig iverksette nødvendige tiltak for at arbeidstaker med redusert arbeidsevne kan beholde eller få et passende arbeid.',
   true, true),

  -- Kap 5 — Registrerings- og meldeplikt
  (null, 'aml-amu', 'aml-5-1', 'AML §5-1',
   'Registrering av skader og sykdommer',
   'Arbeidsgiver skal sørge for at alle personskader som oppstår under utførelsen av arbeid blir registrert.',
   true, true),
  (null, 'aml-amu', 'aml-5-2', 'AML §5-2',
   'Arbeidsgivers varslings- og meldeplikt',
   'Plikt til straks å varsle Arbeidstilsynet og politiet ved alvorlig personskade eller dødsfall.',
   true, true),

  -- Kap 6 — Verneombud (additions; aml-6-2 already seeded)
  (null, 'aml-amu', 'aml-6-1', 'AML §6-1',
   'Plikt til å velge verneombud',
   'Ved enhver virksomhet som går inn under loven skal det velges verneombud (med unntak for små virksomheter etter avtale).',
   true, true),
  (null, 'aml-amu', 'aml-6-3', 'AML §6-3',
   'Verneombudets rett til å stanse farlig arbeid',
   'Verneombudet kan stanse arbeid som etter dets vurdering medfører umiddelbar fare for arbeidstakeres liv eller helse.',
   true, true),
  (null, 'aml-amu', 'aml-6-5', 'AML §6-5',
   'Utgifter, opplæring m.v. for verneombud',
   'Verneombudet skal få nødvendig opplæring; arbeidsgiver dekker utgifter og fritak fra ordinært arbeid for vervet.',
   true, true),

  -- Kap 7 — AMU
  (null, 'aml-amu', 'aml-7-1', 'AML §7-1',
   'Plikt til å opprette arbeidsmiljøutvalg',
   'I virksomhet med minst 50 arbeidstakere skal det være arbeidsmiljøutvalg. AMU avholder regelmessige møter og fører protokoll.',
   true, true),
  (null, 'aml-amu', 'aml-7-2', 'AML §7-2',
   'Arbeidsmiljøutvalgets oppgaver',
   'AMU skal virke for gjennomføring av et fullt forsvarlig arbeidsmiljø; behandle årsrapporter, planer og saker av betydning.',
   true, true),

  -- Kap 11 — Arbeid av barn og ungdom
  (null, 'aml-amu', 'aml-11-1', 'AML §11-1',
   'Forbud mot barnearbeid',
   'Barn under 15 år skal ikke utføre arbeid; barn fra 15 år skal ikke utføre arbeid som kan skade helsen, sikkerheten eller utviklingen.',
   true, true),
  (null, 'aml-amu', 'aml-11-2', 'AML §11-2',
   'Arbeidstid for barn og ungdom',
   'Begrensninger på daglig og ukentlig arbeidstid for personer under 18 år.',
   true, true),
  (null, 'aml-amu', 'aml-11-3', 'AML §11-3',
   'Forbud mot nattarbeid',
   'Personer under 18 år skal som hovedregel ikke arbeide mellom kl. 23 og kl. 06.',
   true, true),
  (null, 'aml-amu', 'aml-11-4', 'AML §11-4',
   'Helsekontroll',
   'Arbeidsgiver skal sørge for at arbeidstakere under 18 år gjennomgår helsekontroll før og under arbeidsforholdet.',
   true, true),
  (null, 'aml-amu', 'aml-11-5', 'AML §11-5',
   'Pauser og fritid',
   'Krav til pauser, daglig hvile og ukentlig fritid for personer under 18 år.',
   true, true),

  -- Kap 14 — Ansettelse
  (null, 'aml-amu', 'aml-14-5', 'AML §14-5',
   'Krav om skriftlig arbeidsavtale',
   'Det skal inngås skriftlig arbeidsavtale i alle arbeidsforhold.',
   true, true),
  (null, 'aml-amu', 'aml-14-6', 'AML §14-6',
   'Minimumskrav til innholdet i den skriftlige arbeidsavtalen',
   'Avtalen skal inneholde opplysninger om partenes identitet, arbeidssted, tiltredelsestidspunkt, varighet, prøvetid, ferierettigheter, oppsigelsesfrister, lønn, arbeidstid, pauser og tariffavtale.',
   true, true)
on conflict (pack, slug) where organization_id is null do nothing;
