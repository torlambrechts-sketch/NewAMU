-- regulation_clauses: migration safety fixes after external code review.
--
-- External reviewer flagged two correctness defects in the previous
-- migration's provision function (20261001120000):
--
--   1. The on-conflict update overwrites every editable column without a
--      `where regulation_clauses.is_system = true` guard. If admin-customised
--      content sneaks into a system-seed id (e.g. via direct DB access or a
--      future RLS relaxation), re-running the function would silently
--      replace it. RLS currently blocks update of is_system=true rows via
--      the API, but the defensive guard is cheap and matches the principle
--      that "system seeds never overwrite human edits."
--
--   2. The end-of-migration DO block looped `for v_org_id in select id from
--      organizations` without per-iteration exception handling. A single org
--      whose state trips a side-trigger (deactivated regulation, etc.) would
--      abort the entire loop, leaving downstream orgs un-provisioned.
--
-- This migration rewrites provision_regulation_clauses_baseline_for_org to
-- include the is_system guard on every ON CONFLICT block, then re-runs the
-- backfill with one BEGIN/EXCEPTION envelope per org so a single failing
-- tenant cannot block the rest.
--
-- Restrisiko addressed:
--   • Klarert kan nå pushe nye lovkrav uten å risikere å overskrive
--     org-spesifikk tilpasning. (Defense-in-depth; primær gating er RLS.)
--   • En enkelt org i en ugyldig tilstand stopper ikke catalog-rollout for
--     resten av tenantene.

create or replace function public.provision_regulation_clauses_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- All ON CONFLICT clauses now include `where regulation_clauses.is_system = true`
  -- so a row that an admin somehow flipped to is_system=false is never overwritten.
  -- AML
  insert into public.regulation_clauses (
    id, organization_id, regulation_id, code, title, description,
    recommended_cadence, cadence_rationale, position, is_system
  ) values
    ('aml-2-1',     p_org_id, 'aml', 'AML § 2-1',     'Arbeidsgivers ansvar', 'Arbeidsgiver skal sørge for at bestemmelsene i denne lov blir overholdt.',
     'arlig',       'Ledelsens gjennomgang minst årlig (jf. IK-f § 5 nr. 8).', 100, true),
    ('aml-2-3',     p_org_id, 'aml', 'AML § 2-3',     'Arbeidstakers medvirkning', 'Plikt til å delta aktivt i HMS-arbeidet.',
     'arlig',       'Årlig opplæring i HMS-medvirkning anbefales.', 110, true),
    ('aml-2a-1',    p_org_id, 'aml', 'AML § 2A-1',    'Rett til å varsle om kritikkverdige forhold', 'Vern av varslere mot gjengjeldelse.',
     'arlig',       'Varslingsrutinene gjennomgås årlig og ved endringer.', 120, true),
    ('aml-2a-2',    p_org_id, 'aml', 'AML § 2A-2',    'Vern mot gjengjeldelse', 'Skriftlig varslingsrutine plikt ≥ 5 ansatte.',
     'arlig',       'AML § 2A-6 — skriftlige rutiner gjennomgås årlig.', 121, true),
    ('aml-2a-3',    p_org_id, 'aml', 'AML § 2A-3',    'Ekstern varsling', 'Vilkår for ekstern varsling til myndigheter.',
     'arlig',       null, 122, true),
    ('aml-2a-4',    p_org_id, 'aml', 'AML § 2A-4',    'Varslerens rett til informasjon', 'Krav om tilbakemelding til varsler.',
     'ad_hoc',      'Hendelsesbasert — frist beregnes per varsel.', 123, true),
    ('aml-2a-5',    p_org_id, 'aml', 'AML § 2A-5',    'Arbeidsgivers aktivitetsplikt', 'Plikt til å undersøke og iverksette tiltak ved varsel.',
     'ad_hoc',      'Frist beregnes per varsel, ikke fast frekvens.', 124, true),
    ('aml-2a-7',    p_org_id, 'aml', 'AML § 2A-7',    'Behandling av varslingsoversikt', 'Anonymisert årsoversikt til AMU.',
     'arlig',       'Oversikt legges fram for AMU årlig.', 125, true),
    ('aml-3-1',     p_org_id, 'aml', 'AML § 3-1',     'Systematisk HMS-arbeid', 'Krav til internkontrollsystem og dokumenterte rutiner.',
     'arlig',       'Systematisk HMS-arbeid skal følges opp og dokumenteres minst årlig.', 130, true),
    ('aml-3-2',     p_org_id, 'aml', 'AML § 3-2',     'Særskilte forholdsregler', 'Krav om særskilt opplæring og verneutstyr.',
     'arlig',       'Risikovurdering ved særskilte forhold gjennomgås årlig.', 131, true),
    ('aml-3-3',     p_org_id, 'aml', 'AML § 3-3',     'Bedriftshelsetjeneste', 'BHT-tilknytning for utsatte bransjer.',
     'arlig',       'BHT-avtale og handlingsplan gjennomgås årlig.', 132, true),
    ('aml-3-4',     p_org_id, 'aml', 'AML § 3-4',     'Vurdering av tiltak for fysisk aktivitet', 'Arbeidsgivers plikt til å vurdere tiltak.',
     'arlig',       null, 133, true),
    ('aml-3-5',     p_org_id, 'aml', 'AML § 3-5',     'Arbeidsgivers plikt til HMS-opplæring', '40-timers HMS-opplæring for daglig leder.',
     'ad_hoc',      'Engangs ved tiltredelse — repetisjon ved ny daglig leder.', 134, true),
    ('aml-4-1',     p_org_id, 'aml', 'AML § 4-1',     'Generelle krav til arbeidsmiljøet', 'Fullt forsvarlig arbeidsmiljø.',
     'arlig',       'Risikovurdering av arbeidsmiljøet minst årlig.', 140, true),
    ('aml-4-2',     p_org_id, 'aml', 'AML § 4-2',     'Krav om tilrettelegging, medvirkning og utvikling', 'Medvirkning og kompetanseutvikling.',
     'arlig',       null, 141, true),
    ('aml-4-3',     p_org_id, 'aml', 'AML § 4-3',     'Krav til det psykososiale arbeidsmiljøet', 'Integritet, kommunikasjon, vern mot trakassering.',
     'arlig',       'Medarbeiderundersøkelse minst årlig anbefales.', 142, true),
    ('aml-4-4',     p_org_id, 'aml', 'AML § 4-4',     'Krav til det fysiske arbeidsmiljøet', 'Belysning, støy, klima, ergonomi.',
     'halvarlig',   'Vernerunde halvårlig dekker fysiske forhold.', 143, true),
    ('aml-4-5',     p_org_id, 'aml', 'AML § 4-5',     'Særlig om kjemisk og biologisk helsefare', 'Kjemikalier merket og oppbevart.',
     'arlig',       'Stoffkartotek revideres minst årlig.', 144, true),
    ('aml-4-6',     p_org_id, 'aml', 'AML § 4-6',     'Tilrettelegging for arbeidstakere med redusert arbeidsevne', 'Individuell tilrettelegging.',
     'ad_hoc',      'Hendelsesbasert per arbeidstaker.', 145, true),
    ('aml-5-1',     p_org_id, 'aml', 'AML § 5-1',     'Registrering av skader og sykdommer', 'Førstehjelp og registrering av skader.',
     'manedlig',    'Skader registreres løpende, AMU behandler månedlig/kvartalsvis.', 150, true),
    ('aml-5-2',     p_org_id, 'aml', 'AML § 5-2',     'Arbeidsgivers varslingsplikt ved alvorlige hendelser', 'Melding til Arbeidstilsynet innen 24 t ved alvorlig skade.',
     'ad_hoc',      'AML § 5-2 — varsling innen 24 timer ved alvorlig skade.', 151, true),
    ('aml-5-3',     p_org_id, 'aml', 'AML § 5-3',     'Arbeidstakers varslingsplikt', 'Melde fra om feil, mangler og farer.',
     'ad_hoc',      'Hendelsesbasert.', 152, true),
    ('aml-6-1',     p_org_id, 'aml', 'AML § 6-1',     'Plikt til å velge verneombud', 'Verneombud pliktig ved ≥ 10 ansatte.',
     'arlig',       'Vernerunde halvårlig + årlig gjennomgang av verneombudets mandat.', 160, true),
    ('aml-6-2',     p_org_id, 'aml', 'AML § 6-2',     'Verneombudets oppgaver', 'Verneombudet skal ivareta arbeidstakernes interesser.',
     'halvarlig',   'Vernerunde halvårlig dekker verneombudets vurdering.', 161, true),
    ('aml-6-3',     p_org_id, 'aml', 'AML § 6-3',     'Stansingsretten', 'Verneombudets rett til å stanse arbeid ved fare.',
     'ad_hoc',      'AML § 6-3 — hendelsesbasert vurdering ved overhengende fare.', 162, true),
    ('aml-6-5',     p_org_id, 'aml', 'AML § 6-5',     'Opplæring av verneombud', '40-timers grunnopplæring.',
     'ad_hoc',      'Engangs ved valg + oppfriskning ved gjenvalg.', 163, true),
    ('aml-7-1',     p_org_id, 'aml', 'AML § 7-1',     'Plikt til å opprette arbeidsmiljøutvalg', 'AMU pliktig ved ≥ 30 ansatte.',
     'arlig',       null, 170, true),
    ('aml-7-2',     p_org_id, 'aml', 'AML § 7-2',     'Arbeidsmiljøutvalgets oppgaver', 'AMU skal behandle hms-saker.',
     'kvartalsvis', 'AMU-møter minst 4 ganger per år (AML § 7-2 andre ledd).', 171, true),
    ('aml-7-2-2-f', p_org_id, 'aml', 'AML § 7-2 (2) f', 'AMU årsrapport', 'AMU skal utarbeide årsrapport.',
     'arlig',       'AMU årsrapport skal foreligge innen 1. mars.', 172, true),
    ('aml-7-4',     p_org_id, 'aml', 'AML § 7-4',     'Arbeidsmiljøutvalgets årsrapport', 'Rapport om virksomhetens HMS-arbeid.',
     'arlig',       null, 173, true),
    ('aml-8-1',     p_org_id, 'aml', 'AML § 8-1',     'Plikt til informasjon og drøfting', 'Drøftingsplikt ved ≥ 50 ansatte.',
     'arlig',       null, 180, true),
    ('aml-8-2',     p_org_id, 'aml', 'AML § 8-2',     'Gjennomføring av plikten til informasjon og drøfting', 'Form og fremgangsmåte.',
     'arlig',       null, 181, true),
    ('aml-8-3',     p_org_id, 'aml', 'AML § 8-3',     'Fortrolige opplysninger', 'Tillitsvalgtes taushetsplikt.',
     'ad_hoc',      null, 182, true),
    ('aml-9-1',     p_org_id, 'aml', 'AML § 9-1',     'Vilkår for kontrolltiltak i virksomheten', 'Skriftlig vurdering før innføring av kontrolltiltak.',
     'ad_hoc',      'Vurdering kreves ved innføring av nye kontrolltiltak.', 190, true),
    ('aml-9-2',     p_org_id, 'aml', 'AML § 9-2',     'Drøfting før innføring av kontrolltiltak', 'Drøftingsplikt med tillitsvalgte.',
     'ad_hoc',      null, 191, true),
    ('aml-9-3',     p_org_id, 'aml', 'AML § 9-3',     'Innsyn i e-post og elektroniske dokumenter', 'Vilkår for innsyn.',
     'ad_hoc',      'Hendelsesbasert vurdering per innsynsbegjæring.', 192, true),
    ('aml-10-4',    p_org_id, 'aml', 'AML § 10-4',    'Alminnelig arbeidstid', 'Hovedregel om arbeidstid.',
     'arlig',       'Arbeidstidsordninger gjennomgås årlig.', 200, true),
    ('aml-10-6',    p_org_id, 'aml', 'AML § 10-6',    'Overtidsarbeid', 'Vilkår og maksgrenser for overtid.',
     'manedlig',    'Overtidsoversikt gjennomgås månedlig.', 201, true),
    ('aml-10-7',    p_org_id, 'aml', 'AML § 10-7',    'Oversikt over arbeidstiden', 'Krav om oversikt over arbeidet tid.',
     'manedlig',    'Tidregistrering rapporteres månedlig.', 202, true),
    ('aml-10-8',    p_org_id, 'aml', 'AML § 10-8',    'Daglig og ukentlig arbeidsfri', 'Hovedregel: 11 timer daglig, 35 timer ukentlig hviletid.',
     'manedlig',    'Brudd på hviletid følges opp månedlig.', 203, true),
    ('aml-10-10',   p_org_id, 'aml', 'AML § 10-10',   'Søndagsarbeid', 'Søndagsarbeid forbudt som hovedregel.',
     'ad_hoc',      null, 204, true),
    ('aml-10-11',   p_org_id, 'aml', 'AML § 10-11',   'Nattarbeid', 'Regulering av arbeid mellom kl. 21 og 06.',
     'arlig',       null, 205, true),
    ('aml-10-12',   p_org_id, 'aml', 'AML § 10-12',   'Unntak fra arbeidstidsregler', 'Adgang til tariffunntak.',
     'arlig',       'Avtalte unntak gjennomgås årlig.', 206, true),
    ('aml-12-1',    p_org_id, 'aml', 'AML § 12-1',    'Svangerskapskontroll', 'Rett til fri for svangerskapskontroll.',
     'ad_hoc',      'Hendelsesbasert per ansatt.', 210, true),
    ('aml-12-2',    p_org_id, 'aml', 'AML § 12-2',    'Svangerskapspermisjon', 'Inntil 12 uker før termin.',
     'ad_hoc',      null, 211, true),
    ('aml-12-3',    p_org_id, 'aml', 'AML § 12-3',    'Omsorgspermisjon', '2 uker omsorgspermisjon ved fødsel.',
     'ad_hoc',      null, 212, true),
    ('aml-12-4',    p_org_id, 'aml', 'AML § 12-4',    'Fødselspermisjon', '6 uker etter fødsel for mor.',
     'ad_hoc',      null, 213, true),
    ('aml-12-5',    p_org_id, 'aml', 'AML § 12-5',    'Foreldrepermisjon', 'Inntil 12 mnd permisjon ved fødsel.',
     'ad_hoc',      null, 214, true),
    ('aml-12-6',    p_org_id, 'aml', 'AML § 12-6',    'Delvis permisjon', 'Forhandling om delvis permisjon.',
     'ad_hoc',      null, 215, true),
    ('aml-12-9',    p_org_id, 'aml', 'AML § 12-9',    'Barns og barnepassers sykdom', 'Rett til fri ved barns sykdom.',
     'ad_hoc',      null, 216, true),
    ('aml-12-10',   p_org_id, 'aml', 'AML § 12-10',   'Pleie av nære pårørende', 'Inntil 60 dager.',
     'ad_hoc',      null, 217, true),
    ('aml-12-11',   p_org_id, 'aml', 'AML § 12-11',   'Utdanningspermisjon', 'Inntil 3 år utdanning.',
     'ad_hoc',      null, 218, true),
    ('aml-12-12',   p_org_id, 'aml', 'AML § 12-12',   'Militærtjeneste', 'Rett til permisjon ved militærtjeneste.',
     'ad_hoc',      null, 219, true),
    ('aml-12-15',   p_org_id, 'aml', 'AML § 12-15',   'Religiøse permisjoner', 'Inntil 2 dager per år.',
     'ad_hoc',      null, 220, true),
    ('aml-13-1',    p_org_id, 'aml', 'AML § 13-1',    'Forbud mot diskriminering', 'Diskriminerings-forbud.',
     'arlig',       'Diskrimineringsforbud gjennomgås årlig i HR-rutiner.', 230, true),
    ('aml-13-2',    p_org_id, 'aml', 'AML § 13-2',    'Diskrimineringsforbudets virkeområde', 'Hvor diskrimineringsforbudet gjelder.',
     'arlig',       null, 231, true),
    ('aml-13-7',    p_org_id, 'aml', 'AML § 13-7',    'Trakassering', 'Vern mot trakassering.',
     'arlig',       'Trakasseringsrutinene gjennomgås årlig.', 232, true),
    ('aml-14-2',    p_org_id, 'aml', 'AML § 14-2',    'Fortrinnsrett for deltidsansatte', 'Fortrinnsrett til ny stilling.',
     'ad_hoc',      'Hendelsesbasert ved utlysninger.', 240, true),
    ('aml-14-5',    p_org_id, 'aml', 'AML § 14-5',    'Krav om skriftlig arbeidsavtale', 'Skriftlig avtale pliktig.',
     'ad_hoc',      'Sjekkes ved hver nyansettelse.', 241, true),
    ('aml-14-6',    p_org_id, 'aml', 'AML § 14-6',    'Minimumskrav til den skriftlige arbeidsavtalen', '14 obligatoriske punkter.',
     'arlig',       'Arbeidsavtalemal gjennomgås årlig.', 242, true),
    ('aml-14-9',    p_org_id, 'aml', 'AML § 14-9',    'Fast ansettelse', 'Hovedregel om fast ansettelse.',
     'ad_hoc',      null, 243, true),
    ('aml-14-12',   p_org_id, 'aml', 'AML § 14-12',   'Innleie fra bemanningsforetak', 'Vilkår for innleie.',
     'ad_hoc',      'Vurderes per innleieforhold.', 244, true),
    ('aml-14-12a',  p_org_id, 'aml', 'AML § 14-12a',  'Likebehandling ved innleie', 'Lønn og arbeidsvilkår.',
     'ad_hoc',      null, 245, true),
    ('aml-14-12c',  p_org_id, 'aml', 'AML § 14-12c',  'Innleie fra produksjonsbedrift', 'Vilkår for innleie fra produksjonsbedrift.',
     'ad_hoc',      null, 246, true),
    ('aml-14a-1',   p_org_id, 'aml', 'AML § 14A-1',   'Konkurranseklausuler', 'Vilkår og krav til skriftlighet.',
     'ad_hoc',      'Vurderes ved hver kontrakt med klausul.', 250, true),
    ('aml-14a-2',   p_org_id, 'aml', 'AML § 14A-2',   'Kundeklausuler', 'Forbud mot etterfølgende kontakt.',
     'ad_hoc',      null, 251, true),
    ('aml-14a-3',   p_org_id, 'aml', 'AML § 14A-3',   'Rekrutteringsklausuler', 'Forbud mot å rekruttere kolleger.',
     'ad_hoc',      null, 252, true),
    ('aml-15-1',    p_org_id, 'aml', 'AML § 15-1',    'Drøfting før oppsigelse', 'Drøftingsmøte før oppsigelse.',
     'ad_hoc',      'Påkrevd før hver oppsigelse.', 260, true),
    ('aml-15-3',    p_org_id, 'aml', 'AML § 15-3',    'Oppsigelsesfrister', 'Lovbestemte minstefrister.',
     'ad_hoc',      null, 261, true),
    ('aml-15-4',    p_org_id, 'aml', 'AML § 15-4',    'Form og innhold ved oppsigelse', 'Skriftlig + spesifikke krav.',
     'ad_hoc',      null, 262, true),
    ('aml-15-6',    p_org_id, 'aml', 'AML § 15-6',    'Oppsigelsesvern under svangerskap', 'Særlig vern under svangerskap.',
     'ad_hoc',      null, 263, true),
    ('aml-15-7',    p_org_id, 'aml', 'AML § 15-7',    'Saklig grunn ved oppsigelse', 'Krav til saklig oppsigelsesgrunn.',
     'ad_hoc',      'Vurderes per sak.', 264, true),
    ('aml-15-15',   p_org_id, 'aml', 'AML § 15-15',   'Attest', 'Attest-plikt ved opphør.',
     'ad_hoc',      null, 265, true),
    ('aml-16-1',    p_org_id, 'aml', 'AML § 16-1',    'Virkeområde for virksomhetsoverdragelse', 'Når reglene gjelder.',
     'ad_hoc',      null, 270, true),
    ('aml-16-2',    p_org_id, 'aml', 'AML § 16-2',    'Lønns- og arbeidsvilkår ved overdragelse', 'Vilkår bevares ved overdragelse.',
     'ad_hoc',      null, 271, true),
    ('aml-16-3',    p_org_id, 'aml', 'AML § 16-3',    'Reservasjonsrett', 'Rett til å nekte overgang.',
     'ad_hoc',      null, 272, true),
    ('aml-16-4',    p_org_id, 'aml', 'AML § 16-4',    'Vern mot oppsigelse ved overdragelse', 'Særlig vern ved virksomhetsoverdragelse.',
     'ad_hoc',      null, 273, true),
    ('aml-16-5',    p_org_id, 'aml', 'AML § 16-5',    'Informasjon og drøfting ved overdragelse', 'Plikt ved virksomhetsoverdragelse.',
     'ad_hoc',      null, 274, true),
    ('aml-18-1',    p_org_id, 'aml', 'AML § 18-1',    'Arbeidstilsynets myndighet', 'Generelle bestemmelser om tilsyn.',
     'ad_hoc',      'Hendelsesbasert ved tilsyn.', 280, true),
    ('aml-18-6',    p_org_id, 'aml', 'AML § 18-6',    'Pålegg fra Arbeidstilsynet', 'Lukking av pålegg.',
     'ad_hoc',      'Pålegg lukkes innen frist gitt av tilsynet.', 281, true),
    ('aml-18-7',    p_org_id, 'aml', 'AML § 18-7',    'Tvangsmulkt', 'Sanksjon ved manglende oppfyllelse.',
     'ad_hoc',      null, 282, true),
    ('aml-18-8',    p_org_id, 'aml', 'AML § 18-8',    'Stansing', 'Stansing av arbeid ved overhengende fare.',
     'ad_hoc',      null, 283, true),
    ('aml-18-10',   p_org_id, 'aml', 'AML § 18-10',   'Overtredelsesgebyr', 'Sanksjonsmulighet ved brudd.',
     'ad_hoc',      null, 284, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description,
    recommended_cadence = excluded.recommended_cadence, cadence_rationale = excluded.cadence_rationale,
    position = excluded.position
  where regulation_clauses.is_system = true;

  insert into public.regulation_clauses (
    id, organization_id, regulation_id, code, title, description,
    recommended_cadence, cadence_rationale, position, is_system
  ) values
    ('ik-f-1',    p_org_id, 'ik-f', 'IK-f § 1',    'Formål', 'Fremme HMS-arbeid og forebygge svikt.', 'arlig', null, 290, true),
    ('ik-f-2',    p_org_id, 'ik-f', 'IK-f § 2',    'Virkeområde', 'Aktivitetene som omfattes av forskriften.', 'arlig', null, 291, true),
    ('ik-f-3',    p_org_id, 'ik-f', 'IK-f § 3',    'Internkontroll — definisjon', 'Hva internkontroll betyr.', 'arlig', null, 292, true),
    ('ik-f-4',    p_org_id, 'ik-f', 'IK-f § 4',    'Plikt til internkontroll', 'Hvem som har plikt til internkontroll.', 'arlig', 'Ledelsens gjennomgang av plikten årlig.', 293, true),
    ('ik-f-5',    p_org_id, 'ik-f', 'IK-f § 5',    'Innhold i internkontrollen', 'Krav om dokumentert internkontrollsystem.', 'arlig', 'IK-forskriften § 5 — systemet gjennomgås minst årlig.', 294, true),
    ('ik-f-5-1',  p_org_id, 'ik-f', 'IK-f § 5 nr. 1', 'HMS-mål', 'Skriftlige HMS-mål for virksomheten.', 'arlig', null, 295, true),
    ('ik-f-5-1a', p_org_id, 'ik-f', 'IK-f § 5 nr. 1a', 'HMS-mål skriftlig', 'Skriftlige HMS-mål.', 'arlig', null, 300, true),
    ('ik-f-5-1b', p_org_id, 'ik-f', 'IK-f § 5 nr. 1b', 'Organisasjon og ansvar', 'Skriftlig fordeling av ansvar.', 'arlig', null, 301, true),
    ('ik-f-5-1c', p_org_id, 'ik-f', 'IK-f § 5 nr. 1c', 'Kunnskap og opplæring', 'Sikre kompetanse blant ansatte.', 'arlig', null, 302, true),
    ('ik-f-5-1d', p_org_id, 'ik-f', 'IK-f § 5 nr. 1d', 'Arbeidstaker-medvirkning', 'Sikre medvirkning i HMS-arbeidet.', 'arlig', null, 303, true),
    ('ik-f-5-2',  p_org_id, 'ik-f', 'IK-f § 5 nr. 2',  'Kartlegging av farer', 'Kartlegging av farer og problemer.', 'arlig', 'Risikokartlegging minst årlig.', 310, true),
    ('ik-f-5-3',  p_org_id, 'ik-f', 'IK-f § 5 nr. 3',  'Risikovurdering', 'Vurdere risiko og planlegge tiltak.', 'arlig', 'Risikovurdering minst årlig.', 311, true),
    ('ik-f-5-4',  p_org_id, 'ik-f', 'IK-f § 5 nr. 4',  'Avviksrutine', 'Rutiner for avvik og korrigerende tiltak.', 'arlig', null, 312, true),
    ('ik-f-5-5',  p_org_id, 'ik-f', 'IK-f § 5 nr. 5',  'Systematisk overvåking', 'Overvåking av HMS-arbeidet.', 'arlig', null, 313, true),
    ('ik-f-5-6',  p_org_id, 'ik-f', 'IK-f § 5 nr. 6',  'Tiltak basert på risiko', 'Tiltaksplan basert på risiko.', 'arlig', null, 314, true),
    ('ik-f-5-7',  p_org_id, 'ik-f', 'IK-f § 5 nr. 7',  'Tilsyn med systemet', 'Rutine for tilsyn med IK-systemet.', 'arlig', 'IK-forskriften § 5 nr. 7 — jevnlig overvåkning og gjennomgang.', 315, true),
    ('ik-f-5-8',  p_org_id, 'ik-f', 'IK-f § 5 nr. 8',  'Årlig gjennomgang', 'Årsgjennomgang av IK-systemet.', 'arlig', 'Pliktig årsgjennomgang av IK-systemet.', 316, true),
    ('ik-f-6',    p_org_id, 'ik-f', 'IK-f § 6',    'Samordning', 'Samordning når flere virksomheter på samme sted.', 'ad_hoc', null, 320, true),
    ('ik-f-7',    p_org_id, 'ik-f', 'IK-f § 7',    'Tilsyn og sanksjoner', 'Tilsynsmyndighet etter forskriften.', 'ad_hoc', null, 321, true),
    ('ik-f-8',    p_org_id, 'ik-f', 'IK-f § 8',    'Klage', 'Klage på vedtak.', 'ad_hoc', null, 322, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description,
    recommended_cadence = excluded.recommended_cadence, cadence_rationale = excluded.cadence_rationale,
    position = excluded.position
  where regulation_clauses.is_system = true;

  insert into public.regulation_clauses (
    id, organization_id, regulation_id, code, title, description,
    recommended_cadence, cadence_rationale, position, is_system
  ) values
    ('iso-9001-4',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 4',   'Kontekst', 'Klausul 4: organisasjonens kontekst.', 'arlig', null, 400, true),
    ('iso-9001-5',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 5',   'Lederskap', 'Klausul 5: lederskap.', 'arlig', null, 401, true),
    ('iso-9001-6',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 6',   'Planlegging', 'Klausul 6: planlegging.', 'arlig', null, 402, true),
    ('iso-9001-7',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 7',   'Støtte', 'Klausul 7: støtte.', 'arlig', null, 403, true),
    ('iso-9001-8',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 8',   'Drift', 'Klausul 8: drift.', 'manedlig', null, 404, true),
    ('iso-9001-9',   p_org_id, 'iso-9001', 'ISO 9001:2015 § 9',   'Evaluering av ytelse', 'Klausul 9: evaluering.', 'arlig', null, 405, true),
    ('iso-9001-9-2', p_org_id, 'iso-9001', 'ISO 9001:2015 § 9.2', 'Internrevisjon', 'Internrevisjon.', 'arlig', 'ISO 9001 § 9.2 — internrevisjon minst årlig.', 406, true),
    ('iso-9001-9-3', p_org_id, 'iso-9001', 'ISO 9001:2015 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 'arlig', 'ISO 9001 § 9.3 — ledelsens gjennomgang minst årlig.', 407, true),
    ('iso-9001-10',  p_org_id, 'iso-9001', 'ISO 9001:2015 § 10',  'Forbedring', 'Klausul 10: forbedring.', 'ad_hoc', null, 408, true),
    ('iso-14001-4',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 4',   'Kontekst', 'EMS-kontekst.', 'arlig', null, 500, true),
    ('iso-14001-5',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 5',   'Lederskap', 'EMS-lederskap.', 'arlig', null, 501, true),
    ('iso-14001-6',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 6',   'Planlegging', 'Miljøaspekter, forpliktelser.', 'arlig', null, 502, true),
    ('iso-14001-7',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 7',   'Støtte', 'Ressurser, kompetanse.', 'arlig', null, 503, true),
    ('iso-14001-8',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 8',   'Drift', 'Operativ kontroll, beredskap.', 'manedlig', null, 504, true),
    ('iso-14001-9',   p_org_id, 'iso-14001', 'ISO 14001:2015 § 9',   'Evaluering av ytelse', 'EMS-evaluering.', 'arlig', null, 505, true),
    ('iso-14001-9-2', p_org_id, 'iso-14001', 'ISO 14001:2015 § 9.2', 'Internrevisjon', 'Internrevisjon.', 'arlig', 'ISO 14001 § 9.2 — internrevisjon minst årlig.', 506, true),
    ('iso-14001-9-3', p_org_id, 'iso-14001', 'ISO 14001:2015 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 'arlig', 'ISO 14001 § 9.3 — ledelsens gjennomgang minst årlig.', 507, true),
    ('iso-14001-10',  p_org_id, 'iso-14001', 'ISO 14001:2015 § 10',  'Forbedring', 'Avvik, korrigerende tiltak.', 'ad_hoc', null, 508, true),
    ('iso-27001-4',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 4',   'Kontekst', 'ISMS-kontekst.', 'arlig', null, 600, true),
    ('iso-27001-5',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 5',   'Lederskap', 'ISMS-lederskap.', 'arlig', null, 601, true),
    ('iso-27001-6',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 6',   'Planlegging', 'Risiko, SoA.', 'arlig', null, 602, true),
    ('iso-27001-7',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 7',   'Støtte', 'Kompetanse, bevissthet.', 'arlig', null, 603, true),
    ('iso-27001-8',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 8',   'Drift', 'Operativ IS-kontroll.', 'manedlig', null, 604, true),
    ('iso-27001-9',   p_org_id, 'iso-27001', 'ISO 27001:2022 § 9',   'Evaluering av ytelse', 'ISMS-evaluering.', 'arlig', null, 605, true),
    ('iso-27001-9-2', p_org_id, 'iso-27001', 'ISO 27001:2022 § 9.2', 'Internrevisjon', 'Internrevisjon.', 'arlig', 'ISO 27001 § 9.2 — internrevisjon minst årlig.', 606, true),
    ('iso-27001-9-3', p_org_id, 'iso-27001', 'ISO 27001:2022 § 9.3', 'Ledelsens gjennomgang', 'Management review.', 'arlig', 'ISO 27001 § 9.3 — ledelsens gjennomgang minst årlig.', 607, true),
    ('iso-27001-10',  p_org_id, 'iso-27001', 'ISO 27001:2022 § 10',  'Forbedring', 'NC og korrigerende tiltak.', 'ad_hoc', null, 608, true),
    ('iso-45001-4',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 4',     'Kontekst', 'OH&S-kontekst.', 'arlig', null, 700, true),
    ('iso-45001-5',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 5',     'Lederskap', 'OH&S-lederskap.', 'arlig', null, 701, true),
    ('iso-45001-5-4',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 5.4',   'Konsultasjon og medvirkning', 'Arbeidstakeres deltakelse i HMS-arbeidet.', 'kvartalsvis', 'Parallell til AML § 7-2 — minst 4 møter/år.', 702, true),
    ('iso-45001-6',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 6',     'Planlegging', 'Risiko og muligheter.', 'arlig', null, 703, true),
    ('iso-45001-6-1-2', p_org_id, 'iso-45001', 'ISO 45001:2018 § 6.1.2', 'Identifikasjon av farer', 'Hazard identification.', 'arlig', 'Risikokartlegging minst årlig.', 704, true),
    ('iso-45001-6-1-3', p_org_id, 'iso-45001', 'ISO 45001:2018 § 6.1.3', 'Lovkrav og andre krav', 'Legal & other requirements.', 'arlig', 'Lovkravsoversikt revideres årlig.', 705, true),
    ('iso-45001-7',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 7',     'Støtte', 'Kompetanse, bevissthet.', 'arlig', null, 706, true),
    ('iso-45001-7-2',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 7.2',   'Kompetanse', 'Sikre OH&S-kompetanse.', 'arlig', null, 707, true),
    ('iso-45001-7-4',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 7.4',   'Kommunikasjon', 'Intern og ekstern kommunikasjon.', 'arlig', null, 708, true),
    ('iso-45001-8',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 8',     'Drift', 'Operativ kontroll, beredskap.', 'manedlig', null, 709, true),
    ('iso-45001-8-2',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 8.2',   'Beredskap og respons', 'Emergency preparedness.', 'arlig', 'Beredskapsøvelse (brann/førstehjelp) minst årlig.', 710, true),
    ('iso-45001-9',     p_org_id, 'iso-45001', 'ISO 45001:2018 § 9',     'Vurdering av prestasjon', 'Overvåking, måling, analyse.', 'arlig', null, 711, true),
    ('iso-45001-9-1',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.1',   'Overvåking og måling', 'Monitoring.', 'manedlig', null, 712, true),
    ('iso-45001-9-2',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.2',   'Internrevisjon', 'Internal audit.', 'arlig', 'ISO 45001 § 9.2 — internrevisjon minst årlig.', 713, true),
    ('iso-45001-9-3',   p_org_id, 'iso-45001', 'ISO 45001:2018 § 9.3',   'Ledelsens gjennomgang', 'Management review.', 'arlig', 'ISO 45001 § 9.3 — ledelsens gjennomgang minst årlig.', 714, true),
    ('iso-45001-10',    p_org_id, 'iso-45001', 'ISO 45001:2018 § 10',    'Forbedring', 'Hendelser, NC, korrigerende tiltak.', 'ad_hoc', null, 715, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description,
    recommended_cadence = excluded.recommended_cadence, cadence_rationale = excluded.cadence_rationale,
    position = excluded.position
  where regulation_clauses.is_system = true;

  insert into public.regulation_clauses (
    id, organization_id, regulation_id, code, title, description,
    recommended_cadence, cadence_rationale, position, is_system
  ) values
    ('gdpr-art-5',  p_org_id, 'gdpr', 'GDPR Art. 5',  'Behandlingsprinsipper', 'Lovlighet, formålsbegrensning, dataminimering.', 'arlig', 'GDPR Art. 5 — prinsippene gjennomgås årlig.', 800, true),
    ('gdpr-art-6',  p_org_id, 'gdpr', 'GDPR Art. 6',  'Lovlighet av behandling', 'Behandlingsgrunnlag.', 'arlig', null, 801, true),
    ('gdpr-art-7',  p_org_id, 'gdpr', 'GDPR Art. 7',  'Samtykke', 'Vilkår for gyldig samtykke.', 'arlig', null, 802, true),
    ('gdpr-art-9',  p_org_id, 'gdpr', 'GDPR Art. 9',  'Særlige kategorier', 'Sensitive personopplysninger.', 'arlig', null, 803, true),
    ('gdpr-art-12', p_org_id, 'gdpr', 'GDPR Art. 12', 'Åpenhet og rettigheter', 'Krav om åpen og klar informasjon.', 'ad_hoc', 'Respons innen frist (1 mnd) per forespørsel.', 804, true),
    ('gdpr-art-13', p_org_id, 'gdpr', 'GDPR Art. 13', 'Informasjon ved direkte innhenting', 'Informasjonsplikt ved direkte innhenting.', 'arlig', 'Personvernerklæring oppdateres årlig.', 805, true),
    ('gdpr-art-15', p_org_id, 'gdpr', 'GDPR Art. 15', 'Innsynsrett', 'Den registrertes innsynsrett.', 'ad_hoc', 'Innsyn besvares innen 1 mnd.', 806, true),
    ('gdpr-art-17', p_org_id, 'gdpr', 'GDPR Art. 17', 'Rett til sletting', 'Sletteplikt.', 'ad_hoc', null, 807, true),
    ('gdpr-art-25', p_org_id, 'gdpr', 'GDPR Art. 25', 'Innebygd personvern', 'Privacy by design.', 'arlig', null, 808, true),
    ('gdpr-art-28', p_org_id, 'gdpr', 'GDPR Art. 28', 'Databehandler', 'Databehandleravtale.', 'arlig', 'Databehandleravtaler gjennomgås årlig.', 809, true),
    ('gdpr-art-30', p_org_id, 'gdpr', 'GDPR Art. 30', 'Behandlingsprotokoll', 'Record of processing activities (ROPA).', 'arlig', 'Behandlingsoversikt gjennomgås årlig og ved endringer.', 810, true),
    ('gdpr-art-32', p_org_id, 'gdpr', 'GDPR Art. 32', 'Sikkerhet ved behandling', 'Tekniske og organisatoriske tiltak.', 'arlig', null, 811, true),
    ('gdpr-art-33', p_org_id, 'gdpr', 'GDPR Art. 33', 'Brudd-varsling til tilsyn', '72-timers-frist ved sikkerhetsbrudd.', 'ad_hoc', 'GDPR Art. 33 — varsling innen 72 timer.', 812, true),
    ('gdpr-art-34', p_org_id, 'gdpr', 'GDPR Art. 34', 'Brudd-varsling til registrerte', 'Underretningsplikt.', 'ad_hoc', null, 813, true),
    ('gdpr-art-35', p_org_id, 'gdpr', 'GDPR Art. 35', 'DPIA', 'Vurdering av personvernkonsekvenser.', 'ad_hoc', 'DPIA gjennomføres ved ny eller endret behandling med høy risiko.', 814, true),
    ('gdpr-art-37', p_org_id, 'gdpr', 'GDPR Art. 37', 'DPO', 'Personvernombud.', 'arlig', null, 815, true),
    ('ldl-13',   p_org_id, 'likestilling', 'LDL § 13',   'Trakassering', 'Vern mot trakassering.', 'arlig', null, 900, true),
    ('ldl-26',   p_org_id, 'likestilling', 'LDL § 26',   'Aktivitets- og redegjørelsesplikt', 'ARP — årlig redegjørelse.', 'arlig', 'LDL § 26 — redegjørelse offentliggjøres årlig.', 901, true),
    ('ldl-26a',  p_org_id, 'likestilling', 'LDL § 26 a', 'Lønnskartlegging', 'Lønnskartlegging annenhvert år.', 'arlig', 'LDL § 26 a — lønnskartlegging annenhvert år; planlegges årlig.', 902, true),
    ('apenhetsloven-1', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 1', 'Formål', 'Sikre grunnleggende menneskerettigheter i leverandørkjeder.', 'arlig', null, 1000, true),
    ('apenhetsloven-3', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 3', 'Definisjoner', 'Begrepsavklaringer.', 'ad_hoc', null, 1001, true),
    ('apenhetsloven-4', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 4', 'Aktsomhetsvurdering', 'Plikt til aktsomhetsvurdering.', 'arlig', 'Aktsomhetsvurdering oppdateres minst årlig.', 1002, true),
    ('apenhetsloven-5', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 5', 'Redegjørelse', 'Publiseringsplikt innen 30. juni.', 'arlig', 'Åpenhetsloven § 5 — redegjørelse offentliggjøres innen 30. juni.', 1003, true),
    ('apenhetsloven-6', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 6', 'Informasjonskrav', 'Rett til informasjon.', 'ad_hoc', 'Forespørsler besvares innen 3 uker.', 1004, true),
    ('apenhetsloven-7', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 7', 'Behandling av informasjonskrav', 'Plikt til å svare innen 3 uker.', 'ad_hoc', null, 1005, true),
    ('apenhetsloven-8', p_org_id, 'apenhetsloven', 'Åpenhetsloven § 8', 'Tilsyn og sanksjoner', 'Forbrukertilsynet håndhever loven.', 'ad_hoc', null, 1006, true)
  on conflict (organization_id, id) do update set
    code = excluded.code, title = excluded.title, description = excluded.description,
    recommended_cadence = excluded.recommended_cadence, cadence_rationale = excluded.cadence_rationale,
    position = excluded.position
  where regulation_clauses.is_system = true;
end;
$$;

revoke all on function public.provision_regulation_clauses_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_regulation_clauses_baseline_for_org(uuid) to authenticated, service_role;

-- Per-org BEGIN/EXCEPTION envelope so a single tenant in an invalid state
-- (e.g. a deactivated framework) can't block the rest of the rollout.
do $backfill$
declare
  v_org_id uuid;
  v_failed_count int := 0;
  v_total_count int := 0;
begin
  for v_org_id in select id from public.organizations loop
    v_total_count := v_total_count + 1;
    begin
      perform public.provision_regulation_clauses_baseline_for_org(v_org_id);
    exception when others then
      v_failed_count := v_failed_count + 1;
      raise warning 'provision_regulation_clauses_baseline_for_org failed for org %: %', v_org_id, sqlerrm;
    end;
  end loop;
  if v_failed_count > 0 then
    raise warning 'Backfill partial: % of % orgs failed', v_failed_count, v_total_count;
  end if;
end $backfill$;
