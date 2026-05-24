-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M7 — provision fn + baseline clauses + ~30 controls
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   This migration is the production-ready baseline an org gets on first
--   sign-up. Three idempotent SECURITY DEFINER functions:
--     1. provision_regulation_clauses_baseline_for_org — seeds ~120
--        paragraph-level clauses across the 9 baseline regulations.
--     2. provision_internal_controls_baseline_for_org — seeds 30 system
--        controls + maps each to N clauses (cross-pack) + default
--        bindings to existing module templates.
--     3. compliance_layer_provision_on_org_insert — trigger that runs
--        both on every new org row.
--   Backfill loop seeds every existing org. Idempotent via composite-PK
--   + ON CONFLICT DO UPDATE for clauses and ON CONFLICT (org_id, slug)
--   DO UPDATE for controls. Re-runs are safe.
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 1 + AML § 3-1 (2) c: en organisasjon kan vise tilsyn
--     en *navngitt* liste over kontrollene den utfører, ikke bare
--     "vi har sjekklister og dokumenter". 30 kontroller dekker AML
--     kap. 2–18 + IK-f § 5 nr. 1–8 + ISO 45001 §§ 4–10 + GDPR Art.
--     32/33/35 + LDL § 26 + Brann + Åpenhetsloven.
--   - AML § 3-1 (2) e: hver kontroll bærer både `purpose` (hva mitigerer
--     den) og en kobling til paragraf(er) — Arbeidstilsynet kan spore
--     bakover fra paragraf til kontroll til artefakt.
--   - Restrisiko: 1) seed-bindinger refererer template-slugs (`amu-
--     arsmote-arsrapport`, `tpl-hms-policy` osv.) som finnes i de
--     forutgående seed-migrasjonene; mangler en av dem hopper binding-
--     insert med ON CONFLICT DO NOTHING uten å feile. En oppfølgings-
--     migrasjon kan re-kjøre M7 etter at en manglende template-mal er
--     seedet. 2) `is_system=true` på kontrollene betyr at admin må
--     klone for å tilpasse — gjenspeiler at navngitte kontroller er
--     en plattform-grunnlinje, ikke en låst tvang.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════
-- 1. provision_regulation_clauses_baseline_for_org
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.provision_regulation_clauses_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- AML — Arbeidsmiljøloven
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('aml-2-1',     p_org_id, 'aml', 'AML § 2-1',     'Arbeidsgivers ansvar', 'Arbeidsgiver skal sørge for at bestemmelsene i denne lov blir overholdt.', 100, true),
    ('aml-2-3',     p_org_id, 'aml', 'AML § 2-3',     'Arbeidstakers medvirkning', 'Plikt til å delta aktivt i HMS-arbeidet.', 110, true),
    ('aml-2a-1',    p_org_id, 'aml', 'AML § 2A-1',    'Rett til å varsle om kritikkverdige forhold', 'Vern av varslere mot gjengjeldelse.', 120, true),
    ('aml-2a-2',    p_org_id, 'aml', 'AML § 2A-2',    'Vern mot gjengjeldelse', 'Skriftlig varslingsrutine plikt ≥ 5 ansatte.', 121, true),
    ('aml-2a-3',    p_org_id, 'aml', 'AML § 2A-3',    'Ekstern varsling', 'Vilkår for ekstern varsling til myndigheter.', 122, true),
    ('aml-2a-4',    p_org_id, 'aml', 'AML § 2A-4',    'Varslerens rett til informasjon', 'Krav om tilbakemelding til varsler.', 123, true),
    ('aml-2a-7',    p_org_id, 'aml', 'AML § 2A-7',    'Behandling av varslingsoversikt', 'Anonymisert årsoversikt til AMU.', 124, true),
    ('aml-3-1',     p_org_id, 'aml', 'AML § 3-1',     'Systematisk HMS-arbeid', 'Krav til internkontrollsystem og dokumenterte rutiner.', 130, true),
    ('aml-3-2',     p_org_id, 'aml', 'AML § 3-2',     'Særskilte forholdsregler', 'Krav om særskilt opplæring og verneutstyr.', 131, true),
    ('aml-3-3',     p_org_id, 'aml', 'AML § 3-3',     'Bedriftshelsetjeneste', 'BHT-tilknytning for utsatte bransjer.', 132, true),
    ('aml-3-4',     p_org_id, 'aml', 'AML § 3-4',     'Vurdering av tiltak for fysisk aktivitet', 'Arbeidsgivers plikt til å vurdere tiltak.', 133, true),
    ('aml-3-5',     p_org_id, 'aml', 'AML § 3-5',     'Arbeidsgivers plikt til HMS-opplæring', '40-timers HMS-opplæring for daglig leder.', 134, true),
    ('aml-4-1',     p_org_id, 'aml', 'AML § 4-1',     'Generelle krav til arbeidsmiljøet', 'Fullt forsvarlig arbeidsmiljø.', 140, true),
    ('aml-4-2',     p_org_id, 'aml', 'AML § 4-2',     'Krav om tilrettelegging, medvirkning og utvikling', 'Medvirkning og kompetanseutvikling.', 141, true),
    ('aml-4-3',     p_org_id, 'aml', 'AML § 4-3',     'Krav til det psykososiale arbeidsmiljøet', 'Integritet, kommunikasjon, vern mot trakassering.', 142, true),
    ('aml-4-4',     p_org_id, 'aml', 'AML § 4-4',     'Krav til det fysiske arbeidsmiljøet', 'Belysning, støy, klima, ergonomi.', 143, true),
    ('aml-4-5',     p_org_id, 'aml', 'AML § 4-5',     'Særlig om kjemisk og biologisk helsefare', 'Kjemikalier merket og oppbevart.', 144, true),
    ('aml-4-6',     p_org_id, 'aml', 'AML § 4-6',     'Særlig om tilrettelegging for arbeidstakere med redusert arbeidsevne', 'Individuell tilrettelegging.', 145, true),
    ('aml-5-1',     p_org_id, 'aml', 'AML § 5-1',     'Registrering av skader og sykdommer', 'Førstehjelp og registrering av skader.', 150, true),
    ('aml-5-2',     p_org_id, 'aml', 'AML § 5-2',     'Arbeidsgivers varslingsplikt ved alvorlige hendelser', 'Melding til Arbeidstilsynet innen 24 t ved alvorlig skade.', 151, true),
    ('aml-5-3',     p_org_id, 'aml', 'AML § 5-3',     'Arbeidstakers varslingsplikt', 'Melde fra om feil, mangler og farer.', 152, true),
    ('aml-6-1',     p_org_id, 'aml', 'AML § 6-1',     'Plikt til å velge verneombud', 'Verneombud pliktig ved ≥ 10 ansatte.', 160, true),
    ('aml-6-2',     p_org_id, 'aml', 'AML § 6-2',     'Verneombudets oppgaver', 'Verneombudet skal ivareta arbeidstakernes interesser.', 161, true),
    ('aml-6-3',     p_org_id, 'aml', 'AML § 6-3',     'Stansingsretten', 'Verneombudets rett til å stanse arbeid ved fare.', 162, true),
    ('aml-6-5',     p_org_id, 'aml', 'AML § 6-5',     'Opplæring av verneombud', '40-timers grunnopplæring.', 163, true),
    ('aml-7-1',     p_org_id, 'aml', 'AML § 7-1',     'Plikt til å opprette arbeidsmiljøutvalg', 'AMU pliktig ved ≥ 30 ansatte.', 170, true),
    ('aml-7-2',     p_org_id, 'aml', 'AML § 7-2',     'Arbeidsmiljøutvalgets oppgaver', 'AMU skal behandle hms-saker.', 171, true),
    ('aml-7-2-2-f', p_org_id, 'aml', 'AML § 7-2 (2) f', 'AMU årsrapport', 'AMU skal utarbeide årsrapport.', 172, true),
    ('aml-7-4',     p_org_id, 'aml', 'AML § 7-4',     'Arbeidsmiljøutvalgets årsrapport', 'Rapport om virksomhetens HMS-arbeid.', 173, true),
    ('aml-8-1',     p_org_id, 'aml', 'AML § 8-1',     'Plikt til informasjon og drøfting', 'Drøftingsplikt ved ≥ 50 ansatte.', 180, true),
    ('aml-8-2',     p_org_id, 'aml', 'AML § 8-2',     'Gjennomføring av plikten til informasjon og drøfting', 'Form og fremgangsmåte.', 181, true),
    ('aml-9-1',     p_org_id, 'aml', 'AML § 9-1',     'Vilkår for kontrolltiltak i virksomheten', 'Skriftlig vurdering før innføring av kontrolltiltak.', 190, true),
    ('aml-9-2',     p_org_id, 'aml', 'AML § 9-2',     'Drøfting før innføring av kontrolltiltak', 'Drøftingsplikt med tillitsvalgte.', 191, true),
    ('aml-9-3',     p_org_id, 'aml', 'AML § 9-3',     'Innsyn i e-post og elektroniske dokumenter', 'Vilkår for innsyn.', 192, true),
    ('aml-10-4',    p_org_id, 'aml', 'AML § 10-4',    'Alminnelig arbeidstid', 'Hovedregel om arbeidstid.', 200, true),
    ('aml-13-1',    p_org_id, 'aml', 'AML § 13-1',    'Forbud mot diskriminering', 'Diskriminerings-forbud.', 210, true),
    ('aml-13-7',    p_org_id, 'aml', 'AML § 13-7',    'Trakassering', 'Vern mot trakassering.', 211, true),
    ('aml-14-5',    p_org_id, 'aml', 'AML § 14-5',    'Krav om skriftlig arbeidsavtale', 'Skriftlig avtale pliktig.', 220, true),
    ('aml-14-6',    p_org_id, 'aml', 'AML § 14-6',    'Minimumskrav til den skriftlige arbeidsavtalen', '14 obligatoriske punkter.', 221, true),
    ('aml-15-1',    p_org_id, 'aml', 'AML § 15-1',    'Drøfting før oppsigelse', 'Drøftingsmøte før oppsigelse.', 230, true),
    ('aml-15-15',   p_org_id, 'aml', 'AML § 15-15',   'Attest', 'Attest-plikt ved opphør.', 231, true),
    ('aml-18-6',    p_org_id, 'aml', 'AML § 18-6',    'Pålegg fra Arbeidstilsynet', 'Lukking av pålegg.', 240, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- IK-f — Internkontrollforskriften
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('ik-f-5-1a', p_org_id, 'ik-f', 'IK-f § 5 nr. 1a', 'HMS-mål skriftlig', 'Skriftlige HMS-mål.', 300, true),
    ('ik-f-5-1b', p_org_id, 'ik-f', 'IK-f § 5 nr. 1b', 'Organisasjon og ansvar', 'Skriftlig fordeling.', 301, true),
    ('ik-f-5-1c', p_org_id, 'ik-f', 'IK-f § 5 nr. 1c', 'Kunnskap og opplæring', 'Sikre kompetanse.', 302, true),
    ('ik-f-5-1d', p_org_id, 'ik-f', 'IK-f § 5 nr. 1d', 'Arbeidstaker-medvirkning', 'Sikre medvirkning.', 303, true),
    ('ik-f-5-2',  p_org_id, 'ik-f', 'IK-f § 5 nr. 2',  'Kartlegging av farer', 'Kartlegging.', 310, true),
    ('ik-f-5-3',  p_org_id, 'ik-f', 'IK-f § 5 nr. 3',  'Risikovurdering', 'Risikovurdering.', 311, true),
    ('ik-f-5-4',  p_org_id, 'ik-f', 'IK-f § 5 nr. 4',  'Avviksrutine', 'Avvik-rutine.', 312, true),
    ('ik-f-5-5',  p_org_id, 'ik-f', 'IK-f § 5 nr. 5',  'Systematisk overvåking', 'Overvåking.', 313, true),
    ('ik-f-5-6',  p_org_id, 'ik-f', 'IK-f § 5 nr. 6',  'Tiltak basert på risiko', 'Tiltaksplan.', 314, true),
    ('ik-f-5-7',  p_org_id, 'ik-f', 'IK-f § 5 nr. 7',  'Tilsyn med systemet', 'Tilsynsrutine.', 315, true),
    ('ik-f-5-8',  p_org_id, 'ik-f', 'IK-f § 5 nr. 8',  'Årlig gjennomgang', 'Årsgjennomgang av IK-systemet.', 316, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- ISO 9001:2015
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('iso-9001-4',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 4',   'Kontekst', 'Klausul 4: organisasjonens kontekst.', 400, true),
    ('iso-9001-5',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 5',   'Lederskap', 'Klausul 5: lederskap.', 401, true),
    ('iso-9001-6',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 6',   'Planlegging', 'Klausul 6: planlegging.', 402, true),
    ('iso-9001-7',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 7',   'Støtte', 'Klausul 7: støtte.', 403, true),
    ('iso-9001-8',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 8',   'Drift', 'Klausul 8: drift.', 404, true),
    ('iso-9001-9',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 9',   'Evaluering av ytelse', 'Klausul 9: evaluering.', 405, true),
    ('iso-9001-9-2', p_org_id, 'iso-9001', 'ISO 9001:2015 § 9.2', 'Internrevisjon', 'Internrevisjon.', 406, true),
    ('iso-9001-9-3', p_org_id, 'iso-9001', 'ISO 9001:2015 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 407, true),
    ('iso-9001-10',  p_org_id, 'iso-9001', 'ISO 9001:2015 § 10',  'Forbedring', 'Klausul 10: forbedring.', 408, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- ISO 14001:2015
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('iso-14001-4',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 4',   'Kontekst', 'EMS-kontekst.', 500, true),
    ('iso-14001-5',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 5',   'Lederskap', 'EMS-lederskap.', 501, true),
    ('iso-14001-6',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 6',   'Planlegging', 'Miljøaspekter, forpliktelser.', 502, true),
    ('iso-14001-7',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 7',   'Støtte', 'Ressurser, kompetanse.', 503, true),
    ('iso-14001-8',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 8',   'Drift', 'Operativ kontroll, beredskap.', 504, true),
    ('iso-14001-9',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 9',   'Evaluering av ytelse', 'EMS-evaluering.', 505, true),
    ('iso-14001-9-2', p_org_id, 'iso-14001', 'ISO 14001:2015 § 9.2', 'Internrevisjon', 'Internrevisjon.', 506, true),
    ('iso-14001-9-3', p_org_id, 'iso-14001', 'ISO 14001:2015 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 507, true),
    ('iso-14001-10',  p_org_id, 'iso-14001', 'ISO 14001:2015 § 10',  'Forbedring', 'Avvik, korrigerende tiltak.', 508, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- ISO 27001:2022
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('iso-27001-4',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 4',   'Kontekst', 'ISMS-kontekst.', 600, true),
    ('iso-27001-5',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 5',   'Lederskap', 'ISMS-lederskap.', 601, true),
    ('iso-27001-6',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 6',   'Planlegging', 'Risiko, SoA.', 602, true),
    ('iso-27001-7',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 7',   'Støtte', 'Kompetanse, bevissthet.', 603, true),
    ('iso-27001-8',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 8',   'Drift', 'Operativ IS-kontroll.', 604, true),
    ('iso-27001-9',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 9',   'Evaluering av ytelse', 'ISMS-evaluering.', 605, true),
    ('iso-27001-9-2', p_org_id, 'iso-27001', 'ISO 27001:2022 § 9.2', 'Internrevisjon', 'Internrevisjon.', 606, true),
    ('iso-27001-9-3', p_org_id, 'iso-27001', 'ISO 27001:2022 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 607, true),
    ('iso-27001-10',  p_org_id, 'iso-27001', 'ISO 27001:2022 § 10',  'Forbedring', 'NC og korrigerende tiltak.', 608, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- ISO 45001:2018
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('iso-45001-4',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 4',     'Kontekst', 'OH&S-kontekst.', 700, true),
    ('iso-45001-5',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 5',     'Lederskap', 'OH&S-lederskap.', 701, true),
    ('iso-45001-6',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 6',     'Planlegging', 'Risiko og muligheter.', 702, true),
    ('iso-45001-6-1-2', p_org_id, 'iso-45001', 'ISO 45001:2018 § 6.1.2', 'Identifikasjon av farer', 'Hazard identification.', 703, true),
    ('iso-45001-6-1-3', p_org_id, 'iso-45001', 'ISO 45001:2018 § 6.1.3', 'Lovkrav og andre krav', 'Legal & other requirements.', 704, true),
    ('iso-45001-7',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 7',     'Støtte', 'Kompetanse, bevissthet.', 705, true),
    ('iso-45001-8',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 8',     'Drift', 'Operativ kontroll, beredskap.', 706, true),
    ('iso-45001-8-2',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 8.2',   'Beredskap og respons', 'Emergency preparedness.', 707, true),
    ('iso-45001-9-1',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.1',   'Overvåking og måling', 'Monitoring.', 708, true),
    ('iso-45001-9-2',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.2',   'Internrevisjon', 'Internal audit.', 709, true),
    ('iso-45001-9-3',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.3',   'Ledelsens gjennomgang', 'Management review.', 710, true),
    ('iso-45001-10',    p_org_id, 'iso-45001', 'ISO 45001:2018 § 10',    'Forbedring', 'Hendelser, NC, korrigerende tiltak.', 711, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- GDPR (Personopplysningsloven)
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('gdpr-art-5',  p_org_id, 'gdpr', 'GDPR Art. 5',  'Behandlingsprinsipper', 'Lovlighet, formålsbegrensning, dataminimering.', 800, true),
    ('gdpr-art-6',  p_org_id, 'gdpr', 'GDPR Art. 6',  'Lovlighet av behandling', 'Behandlingsgrunnlag.', 801, true),
    ('gdpr-art-13', p_org_id, 'gdpr', 'GDPR Art. 13', 'Informasjon ved direkte innhenting', 'Informasjonsplikt.', 802, true),
    ('gdpr-art-15', p_org_id, 'gdpr', 'GDPR Art. 15', 'Innsynsrett', 'Den registrertes innsynsrett.', 803, true),
    ('gdpr-art-17', p_org_id, 'gdpr', 'GDPR Art. 17', 'Rett til sletting', 'Sletteplikt.', 804, true),
    ('gdpr-art-25', p_org_id, 'gdpr', 'GDPR Art. 25', 'Innebygd personvern', 'Privacy by design.', 805, true),
    ('gdpr-art-28', p_org_id, 'gdpr', 'GDPR Art. 28', 'Databehandler', 'Databehandleravtale.', 806, true),
    ('gdpr-art-30', p_org_id, 'gdpr', 'GDPR Art. 30', 'Behandlingsprotokoll', 'ROPA.', 807, true),
    ('gdpr-art-32', p_org_id, 'gdpr', 'GDPR Art. 32', 'Sikkerhet ved behandling', 'Tekniske og organisatoriske tiltak.', 808, true),
    ('gdpr-art-33', p_org_id, 'gdpr', 'GDPR Art. 33', 'Brudd-varsling til tilsyn', '72-timers-frist.', 809, true),
    ('gdpr-art-34', p_org_id, 'gdpr', 'GDPR Art. 34', 'Brudd-varsling til registrerte', 'Underretningsplikt.', 810, true),
    ('gdpr-art-35', p_org_id, 'gdpr', 'GDPR Art. 35', 'DPIA', 'Vurdering av personvernkonsekvenser.', 811, true),
    ('gdpr-art-37', p_org_id, 'gdpr', 'GDPR Art. 37', 'DPO', 'Personvernombud.', 812, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- LDL — Likestillings- og diskrimineringsloven
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('ldl-13',   p_org_id, 'likestilling', 'LDL § 13',   'Trakassering', 'Vern mot trakassering.', 900, true),
    ('ldl-26',   p_org_id, 'likestilling', 'LDL § 26',   'Aktivitets- og redegjørelsesplikt', 'ARP.', 901, true),
    ('ldl-26a',  p_org_id, 'likestilling', 'LDL § 26 a', 'Lønnskartlegging', 'Biennial lønnskartlegging.', 902, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;

  -- Åpenhetsloven
  insert into public.regulation_clauses (id, organization_id, regulation_id, code, title, description, position, is_system) values
    ('apenhetsloven-4', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 4', 'Aktsomhetsvurdering', 'Plikt til aktsomhetsvurdering.', 1000, true),
    ('apenhetsloven-5', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 5', 'Redegjørelse', 'Publiseringsplikt.', 1001, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description, position = excluded.position;
end;
$$;

revoke all on function public.provision_regulation_clauses_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_regulation_clauses_baseline_for_org(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 2. provision_internal_controls_baseline_for_org
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.provision_internal_controls_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_control_id uuid;
  v_template_uuid text;
begin
  -- Helper macro inlined: each upsert returns the (possibly existing) id so
  -- we can immediately insert junction + binding rows.

  -- ── 1. AML kap. 2 — ansvarsfordeling ───────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-ansvarsfordeling', 'Ansvarsfordeling og roller (HMS)',
    'Fastsette og kommunisere ansvar/myndighet for HMS i hele organisasjonen.',
    'directive', 'arlig', 'daglig_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-2-1',     p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-1b',   p_org_id, 'primary'),
    (v_control_id, 'iso-45001-5', p_org_id, 'supporting'),
    (v_control_id, 'iso-9001-5',  p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 2. AML kap. 2A — varslingsrutine ───────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-varslingsrutine', 'Varslingsrutine — årlig gjennomgang',
    'Sikre at varslingsrutinen er kjent, oppdatert og at varsler følges opp.',
    'preventive', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-2a-1', p_org_id, 'primary'),
    (v_control_id, 'aml-2a-2', p_org_id, 'primary'),
    (v_control_id, 'aml-2a-3', p_org_id, 'supporting'),
    (v_control_id, 'aml-2a-4', p_org_id, 'supporting'),
    (v_control_id, 'aml-2a-7', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 3. AML § 3-1 — systematisk HMS-arbeid ──────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-systematisk-hms', 'Systematisk HMS-arbeid (internkontroll)',
    'Sikre dokumentert internkontrollsystem og rutiner per AML § 3-1 + IK-f.',
    'directive', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-3-1',    p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-1a',  p_org_id, 'primary'),
    (v_control_id, 'iso-45001-4',p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 4. AML § 3-3 — BHT årsplan ─────────────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-bht-arsplan', 'Bedriftshelsetjeneste — årsplan',
    'Etablere og dokumentere BHT-årsplan, gjennomføre planlagte aktiviteter.',
    'preventive', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-3-3', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 5. AML § 3-4 — sykefraværsoppfølging ───────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-sykefravaer', 'Sykefraværsoppfølging',
    'Følge opp sykmeldte ansatte iht. oppfølgingsplan og dialogmøte-frister.',
    'corrective', 'manedlig', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-3-4', p_org_id, 'primary'),
    (v_control_id, 'aml-4-6', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 6. AML § 4-3 — psykososial pulsmåling ──────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-psyk-pulsmaling', 'Psykososial pulsmåling',
    'Gjennomføre kartlegging av psykososialt arbeidsmiljø (QPS Nordic/ARK).',
    'detective', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-4-3', p_org_id, 'primary'),
    (v_control_id, 'aml-4-2', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 7. AML § 4-4 — fysisk vernerunde ───────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-vernerunde', 'Vernerunde (fysisk arbeidsmiljø)',
    'Kvartalsvis vernerunde med dokumenterte funn og tiltak.',
    'detective', 'kvartalsvis', 'verneombud_hoved', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-4-1',     p_org_id, 'primary'),
    (v_control_id, 'aml-4-4',     p_org_id, 'primary'),
    (v_control_id, 'aml-6-2',     p_org_id, 'supporting'),
    (v_control_id, 'iso-45001-9-1',p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 8. AML § 4-5 — kjemikaliekartlegging ──────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-kjemikaliekartlegging', 'Kjemikaliekartlegging og stoffkartotek',
    'Holde stoffkartotek oppdatert; vurdere risiko ved kjemikaliebruk.',
    'preventive', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-4-5', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 9. AML § 5-1 / 5-2 — yrkesskademelding ────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-yrkesskademelding', 'Yrkesskademelding-rutine',
    'Melde alvorlige hendelser innen 24 t; registrere alle skader.',
    'corrective', 'ad_hoc', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-5-1', p_org_id, 'primary'),
    (v_control_id, 'aml-5-2', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 10. AML § 6 — verneombud-syklus ───────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-verneombud-syklus', 'Verneombud — valg og oppfølging',
    'Gjennomføre VO-valg hver 2. år; sikre 40-timers opplæring.',
    'directive', 'arlig', 'amu_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-6-1', p_org_id, 'primary'),
    (v_control_id, 'aml-6-2', p_org_id, 'supporting'),
    (v_control_id, 'aml-6-5', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 11. AML § 3-5 — 40-timers HMS-opplæring ───────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-40t-hms-opplaring', 'HMS-opplæring for ledere (40 t)',
    'Sikre at daglig leder og linjeledere har gjennomført 40-timers HMS-opplæring.',
    'preventive', 'arlig', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-3-5',    p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-1c',  p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 12. AML § 7-2(2)f — AMU årsmøte + årsrapport ──────────────────
  -- THIS is the cross-pack reuse demo control.
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-amu-arsmote', 'AMU årsmøte og årsrapport',
    'Gjennomføre AMU-årsmøte og utarbeide årsrapport iht. AML § 7-2 (2) f.',
    'directive', 'arlig', 'amu_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-7-2-2-f', p_org_id, 'primary'),
    (v_control_id, 'aml-7-4',     p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-7',    p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 13. AMU kvartalsmøte ──────────────────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-amu-kvartalsmote', 'AMU kvartalsmøte',
    'Behandle løpende HMS-saker i AMU kvartalsvis.',
    'detective', 'kvartalsvis', 'amu_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-7-1', p_org_id, 'primary'),
    (v_control_id, 'aml-7-2', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 14. AML § 8-1 — drøftingsprotokoll ────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-drofting-protokoll', 'Drøftingsplikt — protokollføring',
    'Dokumentere informasjon og drøfting med tillitsvalgte (AML § 8).',
    'preventive', 'ad_hoc', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-8-1', p_org_id, 'primary'),
    (v_control_id, 'aml-8-2', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 15. AML § 9-1 — kontrolltiltak-policy ─────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-kontrolltiltak-policy', 'Kontrolltiltak — skriftlig policy',
    'Skriftlig vurdering og drøfting før innføring av kontrolltiltak.',
    'preventive', 'arlig', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-9-1', p_org_id, 'primary'),
    (v_control_id, 'aml-9-2', p_org_id, 'supporting'),
    (v_control_id, 'aml-9-3', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 16. AML § 13-7 / LDL § 13 — trakasseringshåndtering ──────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-trakassering', 'Trakasseringshåndtering',
    'Etablere rutine for håndtering av trakasseringssaker.',
    'corrective', 'ad_hoc', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-13-7', p_org_id, 'primary'),
    (v_control_id, 'aml-4-3',  p_org_id, 'supporting'),
    (v_control_id, 'ldl-13',   p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 17. AML § 14 — arbeidsavtale-mal ─────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-arbeidsavtale', 'Arbeidsavtale-mal og signatur',
    'Bruke godkjent mal som dekker alle 14 obligatoriske punkter.',
    'preventive', 'ad_hoc', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-14-5', p_org_id, 'primary'),
    (v_control_id, 'aml-14-6', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 18. AML § 15-1 / 15-15 — opphørs-prosess ─────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-opphor-prosess', 'Opphørsprosess — drøfting og attest',
    'Sikre drøftingsmøte før oppsigelse og attest ved opphør.',
    'preventive', 'ad_hoc', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-15-1',  p_org_id, 'primary'),
    (v_control_id, 'aml-15-15', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 19. AML § 18-6 — tilsyns-pålegg-lukking ──────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-tilsyn-palegg', 'Tilsyns-pålegg — lukkingsoppfølging',
    'Lukke pålegg fra Arbeidstilsynet innen frist; dokumentere tiltak.',
    'corrective', 'ad_hoc', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'aml-18-6', p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-7', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 20. IK-f § 5 nr. 6 — ROS årlig ───────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-ros-arlig', 'Risiko- og sårbarhetsanalyse (ROS)',
    'Gjennomføre årlig ROS med tiltaksplan og restrisiko-vurdering.',
    'detective', 'arlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'ik-f-5-2',       p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-3',       p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-6',       p_org_id, 'primary'),
    (v_control_id, 'iso-45001-6-1-2',p_org_id, 'supporting'),
    (v_control_id, 'iso-45001-6-1-3',p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 21. IK-f § 5 nr. 4 — avviksrutine ────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-avviksrutine', 'Avviksrutine og oppfølging',
    'Registrere, behandle og lukke avvik systematisk.',
    'corrective', 'ad_hoc', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'ik-f-5-4',   p_org_id, 'primary'),
    (v_control_id, 'iso-9001-10',p_org_id, 'supporting'),
    (v_control_id, 'iso-45001-10',p_org_id,'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 22. IK-f § 5 nr. 8 + ISO 9.3 — ÅRLIG LEDELSES-GJENNOMGANG ────
  -- KEY DEMO: this is the management review that crosses 6 frameworks.
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-arlig-ledelses-gjennomgang', 'Årlig ledelses-gjennomgang',
    'Strukturert årlig gjennomgang av virksomhetens styringssystem på tvers av IK-f, ISO 9001/14001/27001/45001 og AML § 7-2 (2) f.',
    'directive', 'arlig', 'daglig_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'ik-f-5-8',     p_org_id, 'primary'),
    (v_control_id, 'aml-7-2-2-f',  p_org_id, 'primary'),
    (v_control_id, 'iso-9001-9-3', p_org_id, 'primary'),
    (v_control_id, 'iso-14001-9-3',p_org_id, 'primary'),
    (v_control_id, 'iso-27001-9-3',p_org_id, 'primary'),
    (v_control_id, 'iso-45001-9-3',p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 23. ISO 45001 § 9.2 — internrevisjon ─────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-internrevisjon-iso', 'Internrevisjon (ISO 45001 + 9001)',
    'Gjennomføre planlagte internrevisjoner med kompetente revisorer.',
    'detective', 'halvarlig', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'iso-45001-9-2', p_org_id, 'primary'),
    (v_control_id, 'iso-9001-9-2',  p_org_id, 'primary'),
    (v_control_id, 'iso-14001-9-2', p_org_id, 'primary'),
    (v_control_id, 'iso-27001-9-2', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 24. ISO 45001 § 9.1 — overvåking og måling ───────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-overvaking-maling', 'Overvåking og måling av HMS-ytelse',
    'Definere KPI og overvåke disse systematisk.',
    'detective', 'kvartalsvis', 'hms_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'iso-45001-9-1', p_org_id, 'primary'),
    (v_control_id, 'ik-f-5-5',      p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 25. ISO 45001 § 8.2 — beredskap (brannøvelse) ───────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-brannovelse', 'Brannøvelse — kvartalsvis',
    'Gjennomføre brannøvelse og teste beredskapsplaner.',
    'preventive', 'kvartalsvis', 'brannvern_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'iso-45001-8-2', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 26. GDPR Art. 32 — sikkerhet ved behandling ─────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-gdpr-sikkerhet', 'GDPR — tekniske og organisatoriske tiltak',
    'Årlig vurdering av sikkerhetstiltak iht. GDPR Art. 32.',
    'preventive', 'arlig', 'dpo', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'gdpr-art-32', p_org_id, 'primary'),
    (v_control_id, 'gdpr-art-25', p_org_id, 'supporting'),
    (v_control_id, 'iso-27001-6', p_org_id, 'supporting'),
    (v_control_id, 'iso-27001-8', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 27. GDPR Art. 33 — brudd-varsling 72t ───────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-gdpr-brudd-72t', 'GDPR brudd-varsling (72 t)',
    'Rutine for å varsle Datatilsynet innen 72 timer ved personvern-brudd.',
    'corrective', 'ad_hoc', 'dpo', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'gdpr-art-33', p_org_id, 'primary'),
    (v_control_id, 'gdpr-art-34', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 28. GDPR Art. 35 — DPIA ────────────────────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-gdpr-dpia', 'DPIA — vurdering av personvernkonsekvenser',
    'Gjennomføre DPIA ved nye/endrede høyrisiko-behandlinger.',
    'preventive', 'ad_hoc', 'dpo', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'gdpr-art-35', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── 29. LDL § 26 / § 26a — ARP-redegjørelse ─────────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-arp-redegjorelse', 'ARP — aktivitets- og redegjørelsesplikten',
    'Årlig redegjørelse for likestillingsarbeidet; lønnskartlegging hvert 2. år.',
    'directive', 'arlig', 'hr_leder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'ldl-26',  p_org_id, 'primary'),
    (v_control_id, 'ldl-26a', p_org_id, 'supporting')
  on conflict (control_id, clause_id) do nothing;

  -- ── 30. Åpenhetsloven § 4 — aktsomhetsvurdering ─────────────────
  insert into public.internal_controls (
    organization_id, slug, name, purpose, control_family, frequency_hint,
    owner_role, status, is_system
  ) values (
    p_org_id, 'kontroll-apenhetsloven', 'Aktsomhetsvurdering (Åpenhetsloven)',
    'Årlig aktsomhetsvurdering og redegjørelse iht. Åpenhetsloven.',
    'directive', 'arlig', 'innkjopsleder', 'active', true
  ) on conflict (organization_id, slug) do update set
    name = excluded.name, purpose = excluded.purpose
  returning id into v_control_id;

  insert into public.internal_control_clauses (control_id, clause_id, organization_id, coverage_level) values
    (v_control_id, 'apenhetsloven-4', p_org_id, 'primary'),
    (v_control_id, 'apenhetsloven-5', p_org_id, 'primary')
  on conflict (control_id, clause_id) do nothing;

  -- ── Bindings (best-effort — skip silently if template slug missing) ─
  -- We use ON CONFLICT DO NOTHING on the unique (control, kind, template, requirement_kind)
  -- composite so re-runs are safe. Template validation trigger raises if
  -- a referenced template id doesn't exist; we wrap binding inserts in
  -- per-row exception-safe blocks so a missing seed template doesn't
  -- abort the whole provision.

  -- Årlig ledelses-gjennomgang → bind to AMU årsmøte meeting template
  -- (if seeded) and to årsgjennomgang document template (if seeded).
  begin
    select id into v_control_id from public.internal_controls
      where organization_id = p_org_id and slug = 'kontroll-arlig-ledelses-gjennomgang';
    if v_control_id is not null then
      -- Meeting template binding
      if exists (
        select 1 from public.meeting_system_templates
         where slug = 'amu-arsmote-arsrapport' limit 1
      ) then
        select id::text into v_template_uuid from public.meeting_system_templates
          where slug = 'amu-arsmote-arsrapport' limit 1;
        insert into public.internal_control_bindings (
          control_id, source_kind, source_template_table,
          source_template_id, source_template_slug, requirement_kind,
          cadence_hint, is_required, is_system, notes
        ) values (
          v_control_id, 'meeting_protocol', 'meeting_system_templates',
          v_template_uuid, 'amu-arsmote-arsrapport', 'latest_within_cadence',
          'arlig', true, true, 'AMU årsmøte med årsrapport — primær bevisflate.'
        ) on conflict (control_id, source_kind, source_template_id, requirement_kind) do nothing;
      end if;
    end if;
  exception when others then
    null;  -- defensive: don't abort provision on a missing seed template
  end;

  -- AMU kvartalsmøte → bind to standard AMU meeting template if present
  begin
    select id into v_control_id from public.internal_controls
      where organization_id = p_org_id and slug = 'kontroll-amu-kvartalsmote';
    if v_control_id is not null and exists (
      select 1 from public.meeting_system_templates where slug = 'amu-kvartalsmote' limit 1
    ) then
      select id::text into v_template_uuid from public.meeting_system_templates
        where slug = 'amu-kvartalsmote' limit 1;
      insert into public.internal_control_bindings (
        control_id, source_kind, source_template_table,
        source_template_id, source_template_slug, requirement_kind,
        cadence_hint, is_required, is_system, notes
      ) values (
        v_control_id, 'meeting_protocol', 'meeting_system_templates',
        v_template_uuid, 'amu-kvartalsmote', 'count_within_period',
        'kvartalsvis', true, true, 'AMU kvartalsvis — 4 møter per år.'
      ) on conflict (control_id, source_kind, source_template_id, requirement_kind) do nothing;
    end if;
  exception when others then null;
  end;

  -- Vernerunde → bind to compliance checklist template
  begin
    select id into v_control_id from public.internal_controls
      where organization_id = p_org_id and slug = 'kontroll-vernerunde';
    if v_control_id is not null and exists (
      select 1 from public.compliance_checklist_templates
       where organization_id = p_org_id and slug = 'vernerunde-standard' limit 1
    ) then
      select id::text into v_template_uuid from public.compliance_checklist_templates
        where organization_id = p_org_id and slug = 'vernerunde-standard' limit 1;
      insert into public.internal_control_bindings (
        control_id, source_kind, source_template_table,
        source_template_id, source_template_slug, requirement_kind,
        cadence_hint, is_required, is_system, notes
      ) values (
        v_control_id, 'compliance_execution', 'compliance_checklist_templates',
        v_template_uuid, 'vernerunde-standard', 'count_within_period',
        'kvartalsvis', true, true, 'Standard vernerunde — kvartalsvis.'
      ) on conflict (control_id, source_kind, source_template_id, requirement_kind) do nothing;
    end if;
  exception when others then null;
  end;

  -- Internrevisjon → bind to ISO 45001 internal audit template
  begin
    select id into v_control_id from public.internal_controls
      where organization_id = p_org_id and slug = 'kontroll-internrevisjon-iso';
    if v_control_id is not null and exists (
      select 1 from public.compliance_checklist_templates
       where organization_id = p_org_id and slug = 'iso-45001-internal-audit' limit 1
    ) then
      select id::text into v_template_uuid from public.compliance_checklist_templates
        where organization_id = p_org_id and slug = 'iso-45001-internal-audit' limit 1;
      insert into public.internal_control_bindings (
        control_id, source_kind, source_template_table,
        source_template_id, source_template_slug, requirement_kind,
        cadence_hint, is_required, is_system, notes
      ) values (
        v_control_id, 'compliance_execution', 'compliance_checklist_templates',
        v_template_uuid, 'iso-45001-internal-audit', 'latest_within_cadence',
        'halvarlig', true, true, 'ISO 45001 internrevisjon.'
      ) on conflict (control_id, source_kind, source_template_id, requirement_kind) do nothing;
    end if;
  exception when others then null;
  end;
end;
$$;

revoke all on function public.provision_internal_controls_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_internal_controls_baseline_for_org(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. On-new-org trigger + backfill loop
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.compliance_layer_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure framework clauses exist before controls reference them.
  perform public.provision_regulation_clauses_baseline_for_org(new.id);
  perform public.provision_internal_controls_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists compliance_layer_provision_on_org_insert_tg on public.organizations;
create trigger compliance_layer_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.compliance_layer_provision_on_org_insert();

-- Backfill every existing org (idempotent via ON CONFLICT semantics).
do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_regulation_clauses_baseline_for_org(v_org.id);
    perform public.provision_internal_controls_baseline_for_org(v_org.id);
  end loop;
end $$;

-- Re-run the compliance_requirements.clause_id backfill now that
-- clauses exist (M1's UPDATE ran before the seed).
update public.compliance_requirements cr
   set clause_id = rc.id
  from public.regulation_clauses rc
 where cr.clause_id is null
   and cr.deleted_at is null
   and rc.deleted_at is null
   and (cr.organization_id = rc.organization_id or cr.organization_id is null)
   and cr.code = rc.code;
