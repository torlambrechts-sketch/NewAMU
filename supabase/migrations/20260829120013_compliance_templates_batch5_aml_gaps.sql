-- Compliance templates batch 5: AML coverage gaps.
--
-- Roles exercised before authoring:
--   Company admin   — what recurring operational checklists are missing?
--   Compliance officer — which paragraphs leave us exposed to Arbeidstilsynet?
--   Government inspector — what do we actually look for in a tilsyn?
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed by this batch:
--     1. Manglende skriftlig varslingsrutine og dokumentert håndtering
--        (AML §2A-7, §2A-5) → varsling-rutine-arssjekk + varsling-handtering-logg
--     2. Manglende/ufullstendig skade- og sykdomsregister (AML §5-1/5-2/5-3)
--        → skade-sykdom-register-sjekk
--     3. Manglende oppfølgingsplan ved sykmelding >4 uker (AML §4-6 + IA-avtalen)
--        → ia-oppfolgingsplan-sjekk
--     4. Manglende AMU-protokoll og årsplanbehandling (AML §7-1/7-2/7-4)
--        → amu-arsrapport-sjekk
--     5. Manglende periodisk kontroll av arbeidstidsregler (AML kap. 10)
--        → arbeidstid-kontroll
--     6. Udokumentert BHT-samarbeid og årsplan (AML §3-3)
--        → bht-samarbeid-arsplan
--     7. Manglende dokumentasjon av HMS-mål og årsplan (IK-f §5 nr. 1 + 4)
--        → hms-maal-arsplan-sjekk
--     8. Udokumenterte kontrolltiltak overfor ansatte (AML §9-1/9-2)
--        → kontrolltiltak-evaluering
--     9. Udokumentert innleieprosess og likebehandling (AML §14-12/12a/12c)
--        → innleie-sjekk
--    10. Manglende drøftelsesmøte ved oppsigelse (AML §15-1)
--        → oppsigelse-drofting-sjekk
--    11. Manglende likestillingsredegjørelse (Likestillings- og diskrimineringsloven §26 + AML §13-1)
--        → likestilling-arssjekk
--
--   Restrisiko deferred:
--     - AML kap. 12 (permisjon): HR-prosess-formet, søknad/innvilgelse; ikke checklist-egnet.
--     - AML kap. 16 (virksomhetsoverdragelse): Episodisk, juridisk rådgiver. Sjelden nok
--       at en dedikert oppgave i tasks-modulen er bedre egnet.
--     - AML §8-1/8-2 (drøfting ≥50 ansatte): Dekkes tilstrekkelig av amu-arsrapport-sjekk
--       (eget punkt for §8-1-drøfting).
--     - AML §9-3 (helseopplysninger ved ansettelse): Grense-case; håndteres best i HR-modul
--       via arbeidsavtale-sjekk (informert samtykke). Ingen ny template nødvendig.
--
-- Architecture:
--   Four new helper functions dispatched from provision_compliance_baseline_for_org.
--   A dedicated _backfill_compliance_aml_law_refs helper sets law_refs text[] on ALL
--   system templates for an org — the column was added by _120043 but never populated
--   by earlier helpers. Called at end of AML provision so new orgs get it immediately.
--   DO block at migration end force-sets law_refs for existing orgs and re-provisions
--   to pick up new templates.
--   Item-type 'date' introduced here (JSONB is flexible; no DB constraint change needed).
--   Frontend renderer must be updated to handle type='date' — tracked in types.ts.
--
-- law_refs text[] format: 'AML § X-Y' (space after §), per _120043 convention.
-- Item-level law_ref in definition: 'AML §X-Y' (existing no-space convention).
-- IK-f format in law_refs[]: 'IK-f § 5 nr. X'.
-- IK-f format in definition items: 'IK-forskriften §5 nr. X'.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. New system requirement rows
-- ════════════════════════════════════════════════════════════════════════════

insert into public.compliance_requirements
  (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  -- Kap 5 — Registrerings- og meldeplikt (§5-3 missing from prior seeds)
  (null, 'aml-amu', 'aml-5-3', 'AML §5-3',
   'Meldeplikt ved yrkessykdom',
   'Arbeidsgiver og behandlende lege skal melde til Arbeidstilsynet ved mistanke om yrkessykdom.',
   true, true),

  -- Kap 10 — Arbeidstid (chapter placeholder existed; adding specific §§)
  (null, 'aml-amu', 'aml-10-4', 'AML §10-4',
   'Alminnelig arbeidstid',
   'Den alminnelige arbeidstid må ikke overstige ni timer i løpet av 24 timer og 40 timer i løpet av sju dager.',
   true, true),
  (null, 'aml-amu', 'aml-10-6', 'AML §10-6',
   'Overtid',
   'Overtid kan ikke overstige 10 timer per uke, 25 timer per fire sammenhengende uker og 200 timer per 52 uker.',
   true, true),
  (null, 'aml-amu', 'aml-10-7', 'AML §10-7',
   'Oversikt over arbeidstid',
   'Arbeidsgiver skal utarbeide en oversikt over den tid arbeidstakerne arbeider.',
   true, true),
  (null, 'aml-amu', 'aml-10-8', 'AML §10-8',
   'Hviletid',
   'Arbeidstaker skal ha minst 11 timers sammenhengende hvile per 24-timer og minst 35 timer per uke.',
   true, true),
  (null, 'aml-amu', 'aml-10-9', 'AML §10-9',
   'Pauser',
   'Arbeidstaker skal ha pause på minst 30 minutter dersom den daglige arbeidstid overstiger fem og en halv time.',
   true, true),
  (null, 'aml-amu', 'aml-10-10', 'AML §10-10',
   'Søn- og helgedagsarbeid',
   'Søndagsarbeid og arbeid på offisielle helge- og høytidsdager er ikke tillatt med mindre arbeidets art gjør det nødvendig.',
   true, true),
  (null, 'aml-amu', 'aml-10-11', 'AML §10-11',
   'Nattarbeid',
   'Nattarbeid (kl. 21–06) er ikke tillatt med mindre arbeidets art gjør det nødvendig, eller det er avtalt med tillitsvalgte.',
   true, true),
  (null, 'aml-amu', 'aml-10-12', 'AML §10-12',
   'Gjennomsnittsberegning av alminnelig arbeidstid',
   'Arbeidsgiver og arbeidstaker kan skriftlig avtale gjennomsnittsberegning av arbeidstid innenfor nærmere angitte rammer.',
   true, true),

  -- Kap 13 — missing §13-7
  (null, 'aml-amu', 'aml-13-7', 'AML §13-7',
   'Opplysningsplikt om lønn',
   'Arbeidstaker som har grunn til å tro at diskriminering foreligger, kan kreve at arbeidsgiver skriftlig opplyser om lønn og lønnsfastsetting for sammenlignbar person.',
   true, true),

  -- Kap 14 — innleie tillegg (§14-12 exists; §14-12a and §14-12c missing)
  (null, 'aml-amu', 'aml-14-12a', 'AML §14-12a',
   'Innleide arbeidstakeres lønns- og arbeidsvilkår (likebehandling)',
   'Innleide arbeidstakere har krav på lik behandling som om de hadde vært ansatt hos innleier (lønn, arbeidstid, ferie m.m.).',
   true, true),
  (null, 'aml-amu', 'aml-14-12c', 'AML §14-12c',
   'Drøftingsplikt og informasjon ved innleie fra bemanningsforetak',
   'Arbeidsgiver skal drøfte bruk av innleide arbeidstakere med tillitsvalgte minst én gang per år og informere om omfanget.',
   true, true),

  -- Kap 15 — specific §§ (chapter placeholder existed)
  (null, 'aml-amu', 'aml-15-1', 'AML §15-1',
   'Drøfting av oppsigelse',
   'Før arbeidsgiver fatter beslutning om oppsigelse, skal spørsmålet så vidt mulig drøftes med arbeidstaker og tillitsvalgt, med mindre arbeidstaker ikke ønsker det.',
   true, true),
  (null, 'aml-amu', 'aml-15-4', 'AML §15-4',
   'Krav til oppsigelsens form og innhold',
   'Oppsigelse fra arbeidsgiver skal skje skriftlig og inneholde opplysninger om rett til forhandling, søksmålsfrister og fortrinnsrett.',
   true, true),
  (null, 'aml-amu', 'aml-15-7', 'AML §15-7',
   'Vern mot usaklig oppsigelse',
   'Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens, arbeidsgivers eller arbeidstakerens forhold.',
   true, true)

on conflict (pack, slug) where organization_id is null do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Helper: Varsling (AML §2A-7 + §2A-5)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._provision_compliance_aml_varsling(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ── varsling-rutine-arssjekk ─────────────────────────────────────────────
  -- Required for all companies with ≥5 employees. High-priority Arbeidstilsynet
  -- finding when absent. Annual self-check that procedures exist, are current, and
  -- have been communicated.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'varsling-rutine-arssjekk',
    'Varslingsrutine – årssjekk',
    'Årlig kontroll av at virksomheten har skriftlig varslingsrutine og at den er kommunisert til alle ansatte (AML §2A-7). Obligatorisk for virksomheter med 5 eller flere ansatte.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','rutine_finnes',
        'prompt','Er skriftlig varslingsrutine utarbeidet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-7','severity_default','critical'),
      jsonb_build_object('key','rutine_oppdatert',
        'prompt','Er rutinen oppdatert inneværende kalenderår?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-7','severity_default','high'),
      jsonb_build_object('key','rutine_kommunisert',
        'prompt','Er alle ansatte informert om varslingsrutinen og varslingskanalene?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-7','severity_default','high'),
      jsonb_build_object('key','mottaker_utpekt',
        'prompt','Er en ansvarlig mottaker (person/funksjon) av varsler utpekt og navngitt i rutinen?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','ekstern_kanal',
        'prompt','Er ekstern varslingsvei (Arbeidstilsynet, Økokrim, politi) beskrevet i rutinen?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-2','severity_default','medium'),
      jsonb_build_object('key','gjengjeldelse_forbud',
        'prompt','Er forbudet mot gjengjeldelse overfor varsler tydelig beskrevet i rutinen?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-3','severity_default','high'),
      jsonb_build_object('key','varsler_identitet',
        'prompt','Er vern av varslerens identitet og konfidensialitet beskrevet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-4','severity_default','medium'),
      jsonb_build_object('key','siste_revisjonsdato',
        'prompt','Dato for siste revisjon av rutinen',
        'type','date','required',true,
        'law_ref','AML §2A-7'),
      jsonb_build_object('key','varsler_mottatt',
        'prompt','Er varsler mottatt og behandlet siste 12 måneder? (Ja = varsler mottatt, Nei = ingen)',
        'type','yes_no_na','required',false),
      jsonb_build_object('key','kommentar',
        'prompt','Kommentarer eller forbedringspunkter til varslingsrutinen',
        'type','text','required',false),
      jsonb_build_object('key','signatur_dagligleder',
        'prompt','Daglig leders signatur',
        'type','signature','required',true,
        'law_ref','AML §2A-7')
    )),
    true, true, true, 'draft', 'årlig',
    array['AML § 2A-1','AML § 2A-2','AML § 2A-3','AML § 2A-4','AML § 2A-7']
  ) on conflict (organization_id, slug) do nothing;

  -- ── varsling-handtering-logg ─────────────────────────────────────────────
  -- Ad-hoc: one execution per received varsling. Documents the investigation
  -- steps, outcome and non-retaliation confirmation. Arbeidstilsynet expects
  -- this paper trail to exist if a whistleblower complaint is escalated.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'varsling-handtering-logg',
    'Varslingssak – håndteringslogg',
    'Sjekkliste per mottatt varslingssak. Dokumenterer at arbeidsgiver har undersøkt og iverksatt tiltak (AML §2A-5). Én utfylling per varslingssak.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','mottatt_dato',
        'prompt','Dato varselet ble mottatt',
        'type','date','required',true,
        'law_ref','AML §2A-5'),
      jsonb_build_object('key','kanal',
        'prompt','Mottakskanal (intern / ekstern / anonym)',
        'type','text','required',true),
      jsonb_build_object('key','konfidensialitet',
        'prompt','Er varslerens identitet sikret konfidensielt fra dag én?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-4','severity_default','critical'),
      jsonb_build_object('key','undersokelse_start',
        'prompt','Er undersøkelse av varselet igangsatt innen rimelig tid?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-5','severity_default','critical'),
      jsonb_build_object('key','undersokelse_gjennomfort',
        'prompt','Er undersøkelsen gjennomført og konkludert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-5','severity_default','critical'),
      jsonb_build_object('key','tiltak_iverksatt',
        'prompt','Beskriv tiltak iverksatt etter undersøkelsen',
        'type','text','required',true,
        'law_ref','AML §2A-5'),
      jsonb_build_object('key','varsler_informert',
        'prompt','Er varsleren informert om oppfølgingen av saken?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-5','severity_default','high'),
      jsonb_build_object('key','ingen_gjengjeldelse',
        'prompt','Er det bekreftet at ingen gjengjeldelse mot varsleren er skjedd?',
        'type','yes_no_na','required',true,
        'law_ref','AML §2A-3','severity_default','critical'),
      jsonb_build_object('key','ekstern_melding',
        'prompt','Er Arbeidstilsynet eller politiet varslet (ved alvorlige tilfeller)?',
        'type','yes_no_na','required',false,
        'severity_default','medium',
        'help','Ikke alltid nødvendig — vurder alvorlighetsgraden av det varslet gjelder.'),
      jsonb_build_object('key','sak_lukket',
        'prompt','Er saken lukket med dokumentert konklusjon?',
        'type','yes_no_na','required',true,
        'severity_default','medium'),
      jsonb_build_object('key','lukkingsdato',
        'prompt','Dato saken ble lukket',
        'type','date','required',false),
      jsonb_build_object('key','signatur_ansvarlig',
        'prompt','Ansvarlig behandlers signatur',
        'type','signature','required',true),
      jsonb_build_object('key','signatur_dagligleder',
        'prompt','Daglig leders bekreftelse',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'ved mottatt varslingssak',
    array['AML § 2A-3','AML § 2A-4','AML § 2A-5']
  ) on conflict (organization_id, slug) do nothing;

  -- Requirement tags: varsling-rutine-arssjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'varsling-rutine-arssjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-2a-1','aml-2a-2','aml-2a-3','aml-2a-4','aml-2a-7')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: varsling-handtering-logg
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'varsling-handtering-logg' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-2a-3','aml-2a-4','aml-2a-5')
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Helper: Registre og IA (AML §5-1/2/3 + §4-6)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._provision_compliance_aml_registre_ia(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ── skade-sykdom-register-sjekk ──────────────────────────────────────────
  -- Quarterly check that the injury/illness register is maintained and that
  -- serious incident notifications to Arbeidstilsynet have been made.
  -- Failure to keep the register is a common tilsyn finding (AML §5-1).
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'skade-sykdom-register-sjekk',
    'Skade- og sykdomsregister – kvartalssjekk',
    'Kvartalsvis kontroll av at skade- og sykdomsregisteret er oppdatert og at meldeplikt overholdes (AML §5-1 + §5-2 + §5-3). Grunnlag for AMU-rapportering.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','register_eksisterer',
        'prompt','Eksisterer et skriftlig (eller digitalt) skade- og sykdomsregister?',
        'type','yes_no_na','required',true,
        'law_ref','AML §5-1','severity_default','critical'),
      jsonb_build_object('key','register_oppdatert',
        'prompt','Er alle personskader og nestenulykker siden forrige sjekk registrert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §5-1','severity_default','critical'),
      jsonb_build_object('key','alvorlig_hendelse_meldt',
        'prompt','Er eventuelle alvorlige personskader straks varslet til Arbeidstilsynet og politiet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §5-2','severity_default','critical',
        'help','Straks-varsel ved alvorlig personskade, arbeidsulykke med mulig dødelig utfall eller alvorlig feil ved teknisk innretning.'),
      jsonb_build_object('key','yrkessykdom_meldt',
        'prompt','Er behandlende lege varslet ved mistanke om yrkessykdom?',
        'type','yes_no_na','required',true,
        'law_ref','AML §5-3','severity_default','high',
        'help','Arbeidsgiver og lege har selvstendig meldeplikt ved mistanke om yrkessykdom.'),
      jsonb_build_object('key','antall_personskader',
        'prompt','Antall registrerte personskader dette kvartalet',
        'type','number','required',true,
        'law_ref','AML §5-1'),
      jsonb_build_object('key','antall_nestenulykker',
        'prompt','Antall registrerte nestenulykker dette kvartalet',
        'type','number','required',true),
      jsonb_build_object('key','amu_informert',
        'prompt','Er AMU informert om registerstatus?',
        'type','yes_no_na','required',false,
        'law_ref','AML §7-2','severity_default','medium',
        'help','Gjelder for virksomheter med AMU (≥50 ansatte).'),
      jsonb_build_object('key','trend_kommentar',
        'prompt','Observasjoner, trender eller årsaksanalyse fra perioden',
        'type','text','required',false),
      jsonb_build_object('key','signatur',
        'prompt','HMS-ansvarlig signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'kvartalsvis',
    array['AML § 5-1','AML § 5-2','AML § 5-3']
  ) on conflict (organization_id, slug) do nothing;

  -- ── ia-oppfolgingsplan-sjekk ─────────────────────────────────────────────
  -- Ad-hoc: one execution per long-term sickleave (>4 weeks). Documents the
  -- statutory follow-up plan, dialogue meetings and NAV notification.
  -- Failure to create the plan by week 4 is a very common Arbeidstilsynet finding.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'ia-oppfolgingsplan-sjekk',
    'IA-oppfølgingsplan – sjekkliste',
    'Sjekkliste ved sykmelding over 4 uker. Sikrer at oppfølgingsplan opprettes, dialogmøter holdes og NAV varsles innen lovens frister (AML §4-6 + IA-avtalen). Én utfylling per sykmeldt ansatt.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','sykmelding_startdato',
        'prompt','Sykmeldingsdato (startdato)',
        'type','date','required',true,
        'law_ref','AML §4-6',
        'help','Frister regnes fra denne datoen.'),
      jsonb_build_object('key','oppfolgingsplan_uke4',
        'prompt','Er oppfølgingsplan opprettet innen 4 uker fra sykmeldingsdato?',
        'type','yes_no_na','required',true,
        'law_ref','AML §4-6','severity_default','critical',
        'help','Planen skal beskrive tilretteleggingstiltak. Kopi sendes sykmelder.'),
      jsonb_build_object('key','sykmelder_kopi',
        'prompt','Er kopi av oppfølgingsplan sendt til sykmelder?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','dialogmote1_avholdt',
        'prompt','Er dialogmøte 1 avholdt innen 7 uker (gjelder 100% sykmelding)?',
        'type','yes_no_na','required',true,
        'law_ref','AML §4-6','severity_default','critical',
        'help','Arbeidsgiver-initiert møte. Senest 7 uker etter sykmeldingens start ved 100% sykmelding.'),
      jsonb_build_object('key','dialogmote1_dato',
        'prompt','Dato for dialogmøte 1',
        'type','date','required',false),
      jsonb_build_object('key','tilrettelegging_vurdert',
        'prompt','Er alle mulige tilretteleggingstiltak i virksomheten vurdert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §4-6','severity_default','critical',
        'help','Arbeidsgiver har plikt til å vurdere alle mulige tiltak — gradert sykmelding, tilpassede oppgaver, hjemmearbeid, omorganisering.'),
      jsonb_build_object('key','tilrettelegging_beskrivelse',
        'prompt','Hvilke tilretteleggingstiltak er vurdert og/eller iverksatt?',
        'type','text','required',true,
        'law_ref','AML §4-6'),
      jsonb_build_object('key','nav_plan_sendt',
        'prompt','Er oppfølgingsplan sendt til NAV innen 9 uker?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','dialogmote2_behov',
        'prompt','Er behov for dialogmøte 2 (NAV-initiert, ca. uke 26) avklart?',
        'type','yes_no_na','required',false,
        'severity_default','medium',
        'help','NAV innkaller til dialogmøte 2 ved behov. Arbeidsgiver plikter å møte.'),
      jsonb_build_object('key','plan_oppdatert',
        'prompt','Er oppfølgingsplanen løpende oppdatert etter dialogmøter?',
        'type','yes_no_na','required',true,
        'severity_default','medium'),
      jsonb_build_object('key','signatur_leder',
        'prompt','Nærmeste leders signatur',
        'type','signature','required',true),
      jsonb_build_object('key','signatur_arbeidstaker',
        'prompt','Arbeidstakerens signatur',
        'type','signature','required',false,
        'help','Arbeidstaker kan avslå å signere — dokumenter frafall av signatur.')
    )),
    true, false, true, 'draft', 'ved sykmelding over 4 uker',
    array['AML § 4-6']
  ) on conflict (organization_id, slug) do nothing;

  -- Requirement tags: skade-sykdom-register-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'skade-sykdom-register-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-5-1','aml-5-2','aml-5-3','ik-5-7')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: ia-oppfolgingsplan-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'ia-oppfolgingsplan-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-6','aml-4-2')
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Helper: AMU · Arbeidstid · BHT · HMS-mål
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._provision_compliance_aml_amu_styring(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ── amu-arsrapport-sjekk ─────────────────────────────────────────────────
  -- Per AMU meeting (min. 4/year for companies ≥50 employees). Documents that
  -- the meeting was held, protocol signed and all required topics addressed.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'amu-arsrapport-sjekk',
    'AMU-møte – protokoll og sjekk',
    'Sjekkliste per AMU-møte: protokoll, agenda og lovpålagte sakstyper (AML §7-1, §7-2, §7-4). Kun for virksomheter med 50 eller flere ansatte. Minst 4 møter per år.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','mote_avholdt',
        'prompt','Er AMU-møtet avholdt (minst 4 møter per kalenderår)?',
        'type','yes_no_na','required',true,
        'law_ref','AML §7-1','severity_default','critical'),
      jsonb_build_object('key','mote_dato',
        'prompt','Dato for dette AMU-møtet',
        'type','date','required',true,
        'law_ref','AML §7-2'),
      jsonb_build_object('key','protokoll_fort',
        'prompt','Er møteprotokoll ført og undertegnet av AMU-leder og sekretær?',
        'type','yes_no_na','required',true,
        'law_ref','AML §7-4','severity_default','critical',
        'help','Protokollen er offentlig og skal oppbevares. AMU kan kreve den lagt frem for Arbeidstilsynet.'),
      jsonb_build_object('key','aarsplan_behandlet',
        'prompt','Er årsplan og HMS-årsrapport behandlet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §7-2','severity_default','high'),
      jsonb_build_object('key','skaderegister_gjennomgatt',
        'prompt','Er skade- og sykdomsregisteret gjennomgått og presentert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §7-2','severity_default','high'),
      jsonb_build_object('key','avvik_handlingsplan',
        'prompt','Er åpne avvik og handlingsplan gjennomgått?',
        'type','yes_no_na','required',true,
        'severity_default','medium'),
      jsonb_build_object('key','bht_rapport',
        'prompt','Er BHTs årsrapport og plan behandlet?',
        'type','yes_no_na','required',false,
        'law_ref','AML §3-3','severity_default','medium',
        'help','Gjelder for BHT-pliktige virksomheter.'),
      jsonb_build_object('key','verneombud_rapport',
        'prompt','Har verneombudet rapportert sine observasjoner til AMU?',
        'type','yes_no_na','required',false,
        'law_ref','AML §6-2','severity_default','medium'),
      jsonb_build_object('key','drofting_vesentlige_saker',
        'prompt','Er vesentlige saker for arbeids- og ansettelsesvilkår informert om og drøftet?',
        'type','yes_no_na','required',false,
        'law_ref','AML §8-1','severity_default','medium',
        'help','Virksomheter med minst 50 ansatte har informasjons- og drøftingsplikt etter §8-1.'),
      jsonb_build_object('key','protokoll_distribuert',
        'prompt','Er protokollen distribuert til alle AMU-representanter innen rimelig tid?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','neste_mote_dato',
        'prompt','Dato for neste AMU-møte',
        'type','date','required',false),
      jsonb_build_object('key','signatur_amu_leder',
        'prompt','AMU-leders signatur',
        'type','signature','required',true,
        'law_ref','AML §7-4'),
      jsonb_build_object('key','signatur_verneombud',
        'prompt','Verneombudets signatur',
        'type','signature','required',true,
        'law_ref','AML §6-2')
    )),
    true, false, true, 'draft', 'kvartalsvis (hvert AMU-møte)',
    array['AML § 7-1','AML § 7-2','AML § 7-4','AML § 8-1','AML § 8-2']
  ) on conflict (organization_id, slug) do nothing;

  -- ── arbeidstid-kontroll ──────────────────────────────────────────────────
  -- Quarterly audit of working hours compliance. Covers overtime limits,
  -- rest periods and recordkeeping. Very common Arbeidstilsynet pålegg area.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'arbeidstid-kontroll',
    'Arbeidstid – periodisk kontroll',
    'Kvartalsvis kontroll av at arbeidstidsregler overholdes: ordinær tid, hvile, pauser, overtid og søn-/nattarbeid (AML kap. 10). Supplerer timerapporter.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','periode',
        'prompt','Hvilken periode kontrolleres? (dd.mm.åååå – dd.mm.åååå)',
        'type','text','required',true),
      jsonb_build_object('key','daglig_arbeidstid_ok',
        'prompt','Overholdes grensen på maks 9 timer daglig og 40 timer ukentlig ordinær arbeidstid?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-4','severity_default','critical'),
      jsonb_build_object('key','daglig_hvile_11t',
        'prompt','Overholdes kravet om minst 11 timers sammenhengende hvile per 24-timersperiode?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-8','severity_default','critical',
        'help','Unntak kan avtales med tillitsvalgte, men gir krav på kompenserende hvile.'),
      jsonb_build_object('key','ukentlig_hvile_35t',
        'prompt','Overholdes kravet om minst 35 timers ukentlig hvile?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-8','severity_default','high'),
      jsonb_build_object('key','pauser_sikret',
        'prompt','Er ansatte sikret rett til pause på minst 30 min ved arbeidsdag over 5,5 timer?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-9','severity_default','medium'),
      jsonb_build_object('key','overtid_grenser_ok',
        'prompt','Overholdes overtidsgrensene: maks 10t/uke, 25t/4 uker, 200t/år?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-6','severity_default','critical'),
      jsonb_build_object('key','overtid_droftet',
        'prompt','Er bruk av overtid drøftet med tillitsvalgte der det er aktuelt?',
        'type','yes_no_na','required',false,
        'law_ref','AML §10-6','severity_default','medium',
        'help','Gjelder for virksomheter med tariffavtale eller tillitsvalgte.'),
      jsonb_build_object('key','arbeidstid_oversikt',
        'prompt','Føres det løpende oversikt over de ansattes arbeidstid?',
        'type','yes_no_na','required',true,
        'law_ref','AML §10-7','severity_default','high',
        'help','Plikten gjelder alle arbeidsgivere. Oversikten skal være tilgjengelig for Arbeidstilsynet.'),
      jsonb_build_object('key','sondagsarbeid_regulert',
        'prompt','Er søn- og helgedagsarbeid regulert eller godkjent per avtale/unntak?',
        'type','yes_no_na','required',false,
        'law_ref','AML §10-10','severity_default','medium',
        'help','Kun aktuelt for virksomheter med søndagsarbeid.'),
      jsonb_build_object('key','nattarbeid_regulert',
        'prompt','Er nattarbeid (kl. 21–06) regulert per unntak eller tariffavtale?',
        'type','yes_no_na','required',false,
        'law_ref','AML §10-11','severity_default','medium',
        'help','Kun aktuelt for virksomheter med nattarbeid.'),
      jsonb_build_object('key','antall_overtidstimer',
        'prompt','Totalt antall overtidstimer i perioden (alle ansatte samlet)',
        'type','number','required',false),
      jsonb_build_object('key','avvik_og_tiltak',
        'prompt','Identifiserte avvik og planlagte tiltak',
        'type','text','required',false),
      jsonb_build_object('key','signatur',
        'prompt','HMS-/HR-ansvarlig signatur',
        'type','signature','required',true,
        'law_ref','AML §10-7')
    )),
    true, false, true, 'draft', 'kvartalsvis',
    array['AML § 10-4','AML § 10-6','AML § 10-7','AML § 10-8','AML § 10-10','AML § 10-11','AML § 10-12']
  ) on conflict (organization_id, slug) do nothing;

  -- ── bht-samarbeid-arsplan ────────────────────────────────────────────────
  -- Annual BHT cooperation check. Relevant for companies in BHT-pliktige
  -- industries (BHT-forskriften). Companies without BHT obligation may
  -- deactivate via is_active=false.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'bht-samarbeid-arsplan',
    'BHT-samarbeid – årsplan og bistand',
    'Årlig gjennomgang av samarbeidet med bedriftshelsetjenesten: tilknytning, årsplan, bistandsområder og leveranser (AML §3-3). Deaktiver hvis virksomheten ikke har BHT-plikt.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','bht_tilknyttet',
        'prompt','Er BHT formelt tilknyttet virksomheten gjennom bistandsavtale?',
        'type','yes_no_na','required',true,
        'law_ref','AML §3-3','severity_default','critical'),
      jsonb_build_object('key','bht_godkjent',
        'prompt','Er BHT godkjent av Arbeidstilsynet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §3-3','severity_default','high',
        'help','Sjekk godkjent-bht.no for å verifisere godkjenningstatus.'),
      jsonb_build_object('key','bht_avtale_oppdatert',
        'prompt','Er bistandsavtalen med BHT oppdatert og dekkende for virksomhetens risikoer?',
        'type','yes_no_na','required',true,
        'law_ref','AML §3-3','severity_default','high'),
      jsonb_build_object('key','bht_arsplan_mottatt',
        'prompt','Har BHT levert årsplan for inneværende år?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','bht_arsrapport_mottatt',
        'prompt','Har BHT levert årsrapport for foregående år?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','risikovurdering_bistand',
        'prompt','Har BHT bistått med risikovurdering og kartlegging av arbeidsmiljø?',
        'type','yes_no_na','required',true,
        'law_ref','AML §3-3','severity_default','medium',
        'help','Minimum én kartlegging per år anbefales i risikoeksponerte miljøer.'),
      jsonb_build_object('key','helseundersoekelse',
        'prompt','Er yrkeshelsekontroll gjennomført for eksponerte grupper?',
        'type','yes_no_na','required',false,
        'severity_default','high',
        'help','Påkrevet ved eksponering for støy, kjemikalier, biologiske faktorer, stråling m.m.'),
      jsonb_build_object('key','bht_amu',
        'prompt','Er BHTs årsrapport presentert for AMU?',
        'type','yes_no_na','required',false,
        'law_ref','AML §7-2','severity_default','medium',
        'help','Gjelder for virksomheter med AMU (≥50 ansatte).'),
      jsonb_build_object('key','bht_tilgang',
        'prompt','Har BHT hatt tilgang til arbeidsplassen og relevante arbeidsprosesser siste år?',
        'type','yes_no_na','required',true,
        'law_ref','AML §3-3','severity_default','medium'),
      jsonb_build_object('key','fysisk_aktivitet_vurdert',
        'prompt','Er tiltak for å fremme fysisk aktivitet blant ansatte vurdert?',
        'type','yes_no_na','required',false,
        'law_ref','AML §3-4','severity_default','low',
        'help','§3-4: arbeidsgiver skal i tilknytning til systematisk HMS-arbeid vurdere slike tiltak.'),
      jsonb_build_object('key','neste_bistandsomraader',
        'prompt','Planlagte bistandsområder for kommende år (beskriv kort)',
        'type','text','required',false),
      jsonb_build_object('key','signatur',
        'prompt','HMS-ansvarlig signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'årlig',
    array['AML § 3-3','AML § 3-4']
  ) on conflict (organization_id, slug) do nothing;

  -- ── hms-maal-arsplan-sjekk ───────────────────────────────────────────────
  -- Annual: verify HMS goals are documented, prior year evaluated, annual plan
  -- communicated. Core IK obligation (IK-f §5 nr. 1 + 4). nav_pinned=true
  -- because this is a top-level management requirement.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'hms-maal-arsplan-sjekk',
    'HMS-mål og årsplan – sjekk',
    'Sjekkliste for dokumentasjon av HMS-mål og årsplan (IK-forskriften §5 nr. 1 + §5 nr. 4). Gjennomføres ved årsstart / planlegging av HMS-arbeidet for nytt år.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','mal_dokumentert',
        'prompt','Er HMS-mål for inneværende år skriftlig dokumentert?',
        'type','yes_no_na','required',true,
        'law_ref','IK-forskriften §5 nr. 4','severity_default','critical'),
      jsonb_build_object('key','mal_konkrete',
        'prompt','Er målene konkrete, målbare og tidsbestemte?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','forrige_aar_evaluert',
        'prompt','Er fjorårets HMS-mål evaluert og resultat dokumentert?',
        'type','yes_no_na','required',true,
        'law_ref','IK-forskriften §5 nr. 8','severity_default','high'),
      jsonb_build_object('key','aarsplan_utarbeidet',
        'prompt','Er årsplan for HMS-aktiviteter utarbeidet?',
        'type','yes_no_na','required',true,
        'law_ref','IK-forskriften §5 nr. 4','severity_default','critical'),
      jsonb_build_object('key','aarsplan_kommunisert',
        'prompt','Er årsplan gjort kjent for ansatte og verneombud?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','lovkrav_tilgjengelig',
        'prompt','Er aktuelle lover og forskrifter tilgjengelig og kjent for ansatte?',
        'type','yes_no_na','required',true,
        'law_ref','IK-forskriften §5 nr. 1','severity_default','high',
        'help','Kan oppfylles ved lenker på intranett, lovdata.no e.l. Ikke krav om fysiske eksemplarer.'),
      jsonb_build_object('key','bht_i_plan',
        'prompt','Er BHT-bistand planlagt for inneværende år?',
        'type','yes_no_na','required',false,
        'law_ref','AML §3-3','severity_default','medium',
        'help','Gjelder for BHT-pliktige virksomheter.'),
      jsonb_build_object('key','vo_inkludert',
        'prompt','Er verneombudet involvert i årsplanleggingen?',
        'type','yes_no_na','required',true,
        'law_ref','AML §6-2','severity_default','medium'),
      jsonb_build_object('key','risikovurdering_planlagt',
        'prompt','Er oppdatering av risikovurderinger planlagt for inneværende år?',
        'type','yes_no_na','required',true,
        'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
      jsonb_build_object('key','hms_mal_tekst',
        'prompt','Beskriv de viktigste HMS-målene for inneværende år',
        'type','text','required',true,
        'law_ref','IK-forskriften §5 nr. 4'),
      jsonb_build_object('key','signatur_dagligleder',
        'prompt','Daglig leders signatur',
        'type','signature','required',true,
        'law_ref','IK-forskriften §5 nr. 4')
    )),
    true, true, true, 'draft', 'årlig',
    array['AML § 3-1','IK-f § 5 nr. 1','IK-f § 5 nr. 4','IK-f § 5 nr. 6','IK-f § 5 nr. 8']
  ) on conflict (organization_id, slug) do nothing;

  -- Requirement tags: amu-arsrapport-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'amu-arsrapport-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-7-1','aml-7-2','aml-8-1','aml-8-2','aml-3-3','aml-6-2')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: arbeidstid-kontroll
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'arbeidstid-kontroll' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-10','aml-10-4','aml-10-6','aml-10-7','aml-10-8','aml-10-9',
                   'aml-10-10','aml-10-11','aml-10-12')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: bht-samarbeid-arsplan
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'bht-samarbeid-arsplan' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-3-3','aml-3-4','aml-3-1')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: hms-maal-arsplan-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'hms-maal-arsplan-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-3-1','ik-5-1','ik-5-4','ik-5-6','ik-5-8','aml-6-2')
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Helper: HR-sjekker (kontrolltiltak · innleie · oppsigelse · likestilling)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._provision_compliance_aml_hr_sjekker(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ── kontrolltiltak-evaluering ────────────────────────────────────────────
  -- Ad-hoc / annual: for companies that use camera surveillance, GPS tracking,
  -- computer/email monitoring, drug testing or other control measures.
  -- Companies without any such measures may deactivate this template.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'kontrolltiltak-evaluering',
    'Kontrolltiltak – evaluering',
    'Periodisk evaluering av kontrolltiltak overfor ansatte (kamera, GPS, datakontroll m.m.). Kun relevant for virksomheter som benytter slike tiltak. Dokumenterer drøfting, informasjon og evaluering (AML §9-1 + §9-2).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','tiltak_type',
        'prompt','Hvilke kontrolltiltak benyttes i virksomheten? (beskriv)',
        'type','text','required',true,
        'law_ref','AML §9-1'),
      jsonb_build_object('key','saklig_grunnlag',
        'prompt','Er tiltaket saklig begrunnet i virksomhetens forhold?',
        'type','yes_no_na','required',true,
        'law_ref','AML §9-1','severity_default','critical',
        'help','Saklig grunn kan f.eks. være sikkerhet, vern av forretningshemmeligheter eller kontroll av arbeidstid.'),
      jsonb_build_object('key','forholdsmessig',
        'prompt','Er tiltaket forholdsmessig — ikke mer inngripende enn nødvendig for formålet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §9-1','severity_default','critical'),
      jsonb_build_object('key','droftet_tillitsvalgte',
        'prompt','Er kontrolltiltaket drøftet med tillitsvalgte?',
        'type','yes_no_na','required',true,
        'law_ref','AML §9-2','severity_default','critical'),
      jsonb_build_object('key','drofting_dato',
        'prompt','Dato for drøfting med tillitsvalgte',
        'type','date','required',false,
        'law_ref','AML §9-2'),
      jsonb_build_object('key','ansatte_informert',
        'prompt','Er ansatte informert om: hva overvåkes, formål, hvem har tilgang, og hvor lenge data lagres?',
        'type','yes_no_na','required',true,
        'law_ref','AML §9-2','severity_default','high'),
      jsonb_build_object('key','evaluering_gjennomfort',
        'prompt','Er tiltaket evaluert i inneværende periode (§9-2 krever periodisk evaluering)?',
        'type','yes_no_na','required',true,
        'law_ref','AML §9-2','severity_default','high'),
      jsonb_build_object('key','evaluering_dato',
        'prompt','Dato for denne evalueringen',
        'type','date','required',true),
      jsonb_build_object('key','personvern_vurdert',
        'prompt','Er personvernkonsekvenser (DPIA) vurdert?',
        'type','yes_no_na','required',false,
        'severity_default','medium',
        'help','Anbefalt ved systematisk overvåkning (GDPR Art. 35). Obligatorisk ved høy risiko for de registrerte.'),
      jsonb_build_object('key','kommentar',
        'prompt','Kommentarer til evalueringen eller planlagte endringer',
        'type','text','required',false),
      jsonb_build_object('key','signatur',
        'prompt','HMS-ansvarlig / leder signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'årlig (eller ved endring av tiltak)',
    array['AML § 9-1','AML § 9-2']
  ) on conflict (organization_id, slug) do nothing;

  -- ── innleie-sjekk ────────────────────────────────────────────────────────
  -- Ad-hoc: one execution per engagement of agency workers. Verifies legal
  -- basis, equal treatment and drøfting obligations.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'innleie-sjekk',
    'Innleie fra bemanningsforetak – sjekk',
    'Sjekkliste ved bruk av innleid arbeidskraft fra bemanningsforetak. Dokumenterer juridisk grunnlag, likebehandling og drøftingsplikt (AML §14-12, §14-12a, §14-12c).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','foretak_navn',
        'prompt','Navn på bemanningsforetaket',
        'type','text','required',true),
      jsonb_build_object('key','foretak_registrert',
        'prompt','Er bemanningsforetaket registrert i Arbeidstilsynets register over bemanningsforetak?',
        'type','yes_no_na','required',true,
        'law_ref','AML §14-12','severity_default','critical',
        'help','Sjekk register.arbeidstilsynet.no/bemanningsforetak. Uregistrerte foretak er forbudt.'),
      jsonb_build_object('key','juridisk_grunnlag',
        'prompt','Er det juridiske grunnlaget for innleie vurdert og dokumentert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §14-12','severity_default','critical',
        'help','Fast ansatt arbeidstaker som midlertidig er fraværende, eller vilkårene i §14-9 for midlertidig ansettelse er til stede.'),
      jsonb_build_object('key','innleieperiode',
        'prompt','Planlagt innleieperiode (dd.mm.åååå – dd.mm.åååå)',
        'type','text','required',true),
      jsonb_build_object('key','stilling_funksjon',
        'prompt','Stilling og funksjon den innleide utfører',
        'type','text','required',true),
      jsonb_build_object('key','likebehandling_sikret',
        'prompt','Er likebehandling på lønn og arbeidsvilkår sikret — minst tilsvarende fast ansatt?',
        'type','yes_no_na','required',true,
        'law_ref','AML §14-12a','severity_default','critical',
        'help','§14-12a: innleid arbeidstaker har krav på lønn og arbeidsvilkår som om vedkommende var ansatt hos innleier.'),
      jsonb_build_object('key','drofting_gjennomfort',
        'prompt','Er bruk av innleide drøftet med tillitsvalgte?',
        'type','yes_no_na','required',true,
        'law_ref','AML §14-12c','severity_default','high',
        'help','Drøftingsplikten gjelder ved planlagt innleie og i den årlige gjennomgangen.'),
      jsonb_build_object('key','drofting_dato',
        'prompt','Dato for drøfting med tillitsvalgte',
        'type','date','required',false,
        'law_ref','AML §14-12c'),
      jsonb_build_object('key','ansatte_informert',
        'prompt','Er ansatte informert om omfanget av innleie?',
        'type','yes_no_na','required',true,
        'law_ref','AML §14-12c','severity_default','medium'),
      jsonb_build_object('key','signatur',
        'prompt','HR-/leder signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'ved bruk av innleid arbeidskraft',
    array['AML § 14-12','AML § 14-12a','AML § 14-12c']
  ) on conflict (organization_id, slug) do nothing;

  -- ── oppsigelse-drofting-sjekk ────────────────────────────────────────────
  -- Ad-hoc: one execution per dismissal process. Absence of the §15-1
  -- drøftelse meeting is the single most common grounds for unlawful dismissal
  -- in Norwegian employment law. This checklist makes the paper trail explicit.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'oppsigelse-drofting-sjekk',
    'Oppsigelse – drøftelsessjekk',
    'Sjekkliste for drøftelsesmøte FØR beslutning om oppsigelse (AML §15-1). Manglende drøftelse er det vanligste grunnlaget for at oppsigelse kjennes ugyldig. Én utfylling per oppsigelsessak.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','stilling_rolle',
        'prompt','Stilling/rolle som berøres (ikke navn — personvern)',
        'type','text','required',true,
        'help','Bruk stillingstittel, ikke personnavn, for å beskytte den ansattes personvern i systemet.'),
      jsonb_build_object('key','drofting_tilbudt',
        'prompt','Er drøftelsesmøte tilbudt i tråd med AML §15-1?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-1','severity_default','critical'),
      jsonb_build_object('key','innkalling_skriftlig',
        'prompt','Var innkallingen skriftlig og ga arbeidstaker tilstrekkelig tid til forberedelse?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-1','severity_default','high'),
      jsonb_build_object('key','tillitsvalgt_tilbudt',
        'prompt','Ble arbeidstaker tilbudt å ha tillitsvalgt eller annen rådgiver til stede?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-1','severity_default','high'),
      jsonb_build_object('key','arbeidstaker_tilstede',
        'prompt','Var arbeidstaker til stede på møtet?',
        'type','yes_no_na','required',true,
        'help','Nei er mulig — arbeidstaker kan avslå drøftelse. Dokumenter avslaget.'),
      jsonb_build_object('key','saken_presentert',
        'prompt','Ble saksgrunnlaget (grunnlag for mulig oppsigelse) presentert og drøftet?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-1','severity_default','critical'),
      jsonb_build_object('key','arbeidstaker_fikk_svare',
        'prompt','Fikk arbeidstaker mulighet til å presentere sitt syn før beslutning?',
        'type','yes_no_na','required',true,
        'severity_default','critical'),
      jsonb_build_object('key','drofting_dato',
        'prompt','Dato for drøftelsesmøtet',
        'type','date','required',true,
        'law_ref','AML §15-1'),
      jsonb_build_object('key','oppsigelse_etter_mote',
        'prompt','Ble oppsigelse besluttet og gitt ETTER møtet (ikke i selve drøftelsesmøtet)?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-1','severity_default','high'),
      jsonb_build_object('key','saklighet_vurdert',
        'prompt','Er saklighetsgrunnlaget for oppsigelsen vurdert og dokumentert?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-7','severity_default','critical'),
      jsonb_build_object('key','formkrav_sjekket',
        'prompt','Er oppsigelsens form og innhold kontrollert (skriftlig, inneholder §15-4-opplysninger)?',
        'type','yes_no_na','required',true,
        'law_ref','AML §15-4','severity_default','high',
        'help','§15-4: oppsigelsen skal inneholde opplysninger om rett til forhandling og søksmål, søksmålsfrister og fortrinnsrett etter §14-2.'),
      jsonb_build_object('key','oppsigelsesdato',
        'prompt','Dato oppsigelsen ble gitt',
        'type','date','required',true,
        'law_ref','AML §15-4'),
      jsonb_build_object('key','signatur_leder',
        'prompt','Leder / HR-ansvarlig signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'ved oppsigelse',
    array['AML § 15-1','AML § 15-4','AML § 15-7']
  ) on conflict (organization_id, slug) do nothing;

  -- ── likestilling-arssjekk ────────────────────────────────────────────────
  -- Annual: equality and anti-discrimination reporting obligation.
  -- Mandatory for ≥50 employees (Likestillings- og diskrimineringsloven §26).
  -- Companies with 20–49 employees may also have duty per tariff agreement.
  -- Anchored to AML §13-1 in AML pack; LDL §26 referenced via law_refs string.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'aml-amu', 'likestilling-arssjekk',
    'Likestillingsredegjørelse – årssjekk',
    'Årlig sjekk av likestillings- og ikke-diskrimineringsredegjørelse (Likestillings- og diskrimineringsloven §26 + AML §13-1). Obligatorisk for virksomheter med 50 eller flere ansatte.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','antall_ansatte',
        'prompt','Totalt antall fast ansatte',
        'type','number','required',true,
        'help','Rapporteringsplikt gjelder fra 50 ansatte. 20–49 ansatte kan ha plikt per tariffavtale.'),
      jsonb_build_object('key','lonnsgap_kartlagt',
        'prompt','Er lønnsstatistikk kartlagt og fordelt på kjønn og stillingsnivå?',
        'type','yes_no_na','required',true,
        'law_ref','AML §13-1','severity_default','critical',
        'help','LDL §26: aktivitetsplikt inkluderer kartlegging av lønn per kjønn.'),
      jsonb_build_object('key','lederandel_kartlagt',
        'prompt','Er andelen kvinner og menn i lederposisjoner kartlagt?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','deltid_kartlagt',
        'prompt','Er bruk av deltid per kjønn kartlagt?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','ufrivillig_deltid_kartlagt',
        'prompt','Er ufrivillig deltid kartlagt og berørte ansatte tilbudt økt stilling/fortrinnsrett?',
        'type','yes_no_na','required',false,
        'law_ref','AML §14-3','severity_default','medium',
        'help','§14-3: deltidsansatte har fortrinnsrett til økt stilling fremfor ny ansettelse.'),
      jsonb_build_object('key','forskjeller_analysert',
        'prompt','Er identifiserte lønns- og karriereforskjeller mellom kjønn analysert?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','tiltak_planlagt',
        'prompt','Er konkrete tiltak for å utjevne eventuelle ulikheter planlagt?',
        'type','yes_no_na','required',true,
        'severity_default','high'),
      jsonb_build_object('key','tiltak_beskrivelse',
        'prompt','Beskriv planlagte likestillingstiltak',
        'type','text','required',false),
      jsonb_build_object('key','redegjorelse_publisert',
        'prompt','Er likestillingsredegjørelsen offentliggjort (årsrapport, nettside eller tilsvarende)?',
        'type','yes_no_na','required',true,
        'severity_default','critical',
        'help','LDL §26: redegjørelsen skal offentliggjøres. Diskrimineringsnemnda kan sanksjonere manglende publisering.'),
      jsonb_build_object('key','publisert_dato',
        'prompt','Dato for offentliggjøring av redegjørelsen',
        'type','date','required',false),
      jsonb_build_object('key','forrige_aar_effekt',
        'prompt','Er effekt av fjorårets likestillingstiltak evaluert?',
        'type','yes_no_na','required',false,
        'severity_default','medium'),
      jsonb_build_object('key','signatur',
        'prompt','Daglig leder / HR-ansvarlig signatur',
        'type','signature','required',true)
    )),
    true, false, true, 'draft', 'årlig',
    array['AML § 13-1','AML § 13-7','Likestillings- og diskrimineringsloven § 26']
  ) on conflict (organization_id, slug) do nothing;

  -- Requirement tags: kontrolltiltak-evaluering
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'kontrolltiltak-evaluering' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-9-1','aml-9-2')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: innleie-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'innleie-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-14-12','aml-14-12a','aml-14-12c')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: oppsigelse-drofting-sjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'oppsigelse-drofting-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-15-1','aml-15-4','aml-15-7')
  on conflict (template_id, requirement_id) do nothing;

  -- Requirement tags: likestilling-arssjekk
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'likestilling-arssjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-13-1','aml-13-7','aml-14-3')
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Helper: law_refs backfill for all system templates
--    Sets law_refs on any system template whose law_refs is still empty.
--    Called at end of AML provision so new orgs get it on first provision.
--    The where-clause preserves any manually-set law_refs (admin override).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._backfill_compliance_aml_law_refs(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Batch 0 — baseline
  update public.compliance_checklist_templates
  set law_refs = array['AML § 3-2','AML § 4-1','AML § 4-3','AML § 4-4','AML § 4-5',
                        'AML § 6-2','IK-f § 5 nr. 7','IK-f § 5 nr. 8']
  where organization_id = p_org_id and slug = 'vernerunde-standard'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  -- Batch 1 — IK core
  update public.compliance_checklist_templates
  set law_refs = array['AML § 5-1','IK-f § 5 nr. 7']
  where organization_id = p_org_id and slug = 'avviksoppfolging-runde'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 3-1','AML § 3-3','AML § 6-2','AML § 7-2',
                        'IK-f § 5 nr. 4','IK-f § 5 nr. 6','IK-f § 5 nr. 7','IK-f § 5 nr. 8']
  where organization_id = p_org_id and slug = 'internkontroll-arsgjennomgang'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  -- Batch 2 — onboarding
  update public.compliance_checklist_templates
  set law_refs = array['AML § 2-3','AML § 3-2','AML § 4-4','AML § 4-5','AML § 6-1']
  where organization_id = p_org_id and slug = 'onboarding-hms-opplaering'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 2-1','AML § 3-5']
  where organization_id = p_org_id and slug = 'arbeidsgivers-hms-opplaering'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 11-1','AML § 11-2','AML § 11-3','AML § 11-4','AML § 11-5']
  where organization_id = p_org_id and slug = 'tilsetting-mindrearig-sjekk'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 14-5','AML § 14-6','AML § 14-9']
  where organization_id = p_org_id and slug = 'arbeidsavtale-sjekk'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  -- Batch 3 — fysisk
  update public.compliance_checklist_templates
  set law_refs = array['AML § 4-4','IK-f § 5 nr. 7']
  where organization_id = p_org_id and slug = 'brannvernrunde'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 4-2','AML § 4-4']
  where organization_id = p_org_id and slug = 'ergonomi-runde'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 4-4','IK-f § 5 nr. 7']
  where organization_id = p_org_id and slug = 'maskinsikkerhet-sjekk'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 3-2','AML § 4-5','IK-f § 5 nr. 6']
  where organization_id = p_org_id and slug = 'stoffkartotek-runde'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  -- Batch 4 — psyk / VO
  update public.compliance_checklist_templates
  set law_refs = array['AML § 4-2','AML § 4-3','AML § 6-2']
  where organization_id = p_org_id and slug = 'psykososial-pulsmaling'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

  update public.compliance_checklist_templates
  set law_refs = array['AML § 6-2','AML § 6-5','AML § 7-2']
  where organization_id = p_org_id and slug = 'verneombud-arsrapport'
    and is_system = true and (law_refs is null or law_refs = '{}'::text[]);

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Updated master provision function
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.provision_compliance_baseline_for_org(
  p_org_id   uuid,
  p_pack_slug public.compliance_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pack_slug = 'aml-amu' then
    perform public._provision_compliance_aml_baseline(p_org_id);
    perform public._provision_compliance_aml_ik_core(p_org_id);
    perform public._provision_compliance_aml_onboarding(p_org_id);
    perform public._provision_compliance_aml_fysisk(p_org_id);
    perform public._provision_compliance_aml_psyk_vo(p_org_id);
    -- Batch 5 — new
    perform public._provision_compliance_aml_varsling(p_org_id);
    perform public._provision_compliance_aml_registre_ia(p_org_id);
    perform public._provision_compliance_aml_amu_styring(p_org_id);
    perform public._provision_compliance_aml_hr_sjekker(p_org_id);
    -- Set law_refs on all system templates for this org (no-op if already set)
    perform public._backfill_compliance_aml_law_refs(p_org_id);
  elsif p_pack_slug = 'iso-45001' then
    perform public._provision_compliance_iso_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. One-time backfill: force-set law_refs on existing system templates
--    (bypasses the is_empty guard in the helper so all existing orgs converge)
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  -- Existing 13 AML templates — force-set law_refs regardless of current value
  -- so this migration is idempotent on repeat and converges all environments.
  update public.compliance_checklist_templates
  set law_refs = case slug
    when 'vernerunde-standard'         then array['AML § 3-2','AML § 4-1','AML § 4-3','AML § 4-4','AML § 4-5','AML § 6-2','IK-f § 5 nr. 7','IK-f § 5 nr. 8']
    when 'avviksoppfolging-runde'      then array['AML § 5-1','IK-f § 5 nr. 7']
    when 'internkontroll-arsgjennomgang' then array['AML § 3-1','AML § 3-3','AML § 6-2','AML § 7-2','IK-f § 5 nr. 4','IK-f § 5 nr. 6','IK-f § 5 nr. 7','IK-f § 5 nr. 8']
    when 'onboarding-hms-opplaering'   then array['AML § 2-3','AML § 3-2','AML § 4-4','AML § 4-5','AML § 6-1']
    when 'arbeidsgivers-hms-opplaering' then array['AML § 2-1','AML § 3-5']
    when 'tilsetting-mindrearig-sjekk' then array['AML § 11-1','AML § 11-2','AML § 11-3','AML § 11-4','AML § 11-5']
    when 'arbeidsavtale-sjekk'         then array['AML § 14-5','AML § 14-6','AML § 14-9']
    when 'brannvernrunde'              then array['AML § 4-4','IK-f § 5 nr. 7']
    when 'ergonomi-runde'             then array['AML § 4-2','AML § 4-4']
    when 'maskinsikkerhet-sjekk'       then array['AML § 4-4','IK-f § 5 nr. 7']
    when 'stoffkartotek-runde'         then array['AML § 3-2','AML § 4-5','IK-f § 5 nr. 6']
    when 'psykososial-pulsmaling'      then array['AML § 4-2','AML § 4-3','AML § 6-2']
    when 'verneombud-arsrapport'       then array['AML § 6-2','AML § 6-5','AML § 7-2']
    else law_refs
  end
  where is_system = true
    and slug in (
      'vernerunde-standard','avviksoppfolging-runde','internkontroll-arsgjennomgang',
      'onboarding-hms-opplaering','arbeidsgivers-hms-opplaering','tilsetting-mindrearig-sjekk',
      'arbeidsavtale-sjekk','brannvernrunde','ergonomi-runde','maskinsikkerhet-sjekk',
      'stoffkartotek-runde','psykososial-pulsmaling','verneombud-arsrapport'
    );
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Re-provision all active licensed packs to pick up the 12 new templates
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pack record;
  v_fn   regprocedure := to_regprocedure(
    'public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)'
  );
begin
  if v_fn is null then
    raise notice
      'compliance batch5: provision_compliance_baseline_for_org not found — '
      'apply earlier batch migrations first, then re-run. Skipping.';
    return;
  end if;

  for v_pack in
    select organization_id, slug
    from public.compliance_packs
    where is_active = true
      and deleted_at is null
  loop
    execute format('select %s($1, $2)', v_fn::text)
      using v_pack.organization_id, v_pack.slug;
  end loop;
end $$;
