-- Self-contained compliance provisioning bundle.
--
-- One file you can paste into Supabase Studio (SQL Editor) on any
-- environment to bring the compliance template baseline to its final
-- state. Bundles the contents of these earlier migrations:
--
--   20260808120100_compliance_provision_function_and_trigger.sql
--   20260808160000_compliance_provision_refactor_to_helpers.sql
--   20260808170000_compliance_templates_batch3_fysisk.sql
--   20260808180000_compliance_templates_batch4_psyk_vo.sql
--   20260810120000_compliance_pin_all_system_templates.sql
--
-- After running this, every (organization_id, pack) row in
-- public.compliance_packs gets the full set of system templates seeded
-- (idempotent via `on conflict (organization_id, slug) do nothing`),
-- the trigger on compliance_packs is in place so future license-grants
-- auto-provision, and every existing system template has nav_pinned=true.
--
-- Prerequisites: public.compliance_pack enum and the
-- compliance_checklist_templates / compliance_template_requirements /
-- compliance_packs tables must already exist (created by the schema
-- migrations 20260807120000 and 20260806120000). If they don't, this
-- migration will error out and you need to run the schema migrations
-- first.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Helper functions (one per "topic batch")
-- ════════════════════════════════════════════════════════════════════════

-- ── ISO 45001 baseline ───────────────────────────────────────────────────
create or replace function public._provision_compliance_iso_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-45001', 'iso-45001-internal-audit',
    'Internrevisjon – ISO 45001:2018',
    'Internrevisjon mot ISO 45001 for arbeidsmiljøstyringssystem.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','context_4_1','prompt','Er konteksten for OH&S-systemet vurdert og dokumentert?',
                         'type','yes_no_na','required',true,'iso_clause','4.1','severity_default','medium'),
      jsonb_build_object('key','leadership_5_1','prompt','Demonstrerer toppledelsen lederskap og forpliktelse?',
                         'type','yes_no_na','required',true,'iso_clause','5.1','severity_default','high'),
      jsonb_build_object('key','policy_5_2','prompt','Er HMS-policy etablert, kommunisert og tilgjengelig?',
                         'type','yes_no_na','required',true,'iso_clause','5.2','severity_default','high'),
      jsonb_build_object('key','consultation_5_4','prompt','Er ansattes konsultasjon og medvirkning sikret?',
                         'type','text','required',true,'iso_clause','5.4','severity_default','high'),
      jsonb_build_object('key','risks_6_1','prompt','Er risikoer og muligheter identifisert og håndtert?',
                         'type','yes_no_na','required',true,'iso_clause','6.1.2','severity_default','critical'),
      jsonb_build_object('key','legal_6_1_3','prompt','Er lovkrav og andre krav identifisert og oppdatert?',
                         'type','yes_no_na','required',true,'iso_clause','6.1.3','severity_default','high'),
      jsonb_build_object('key','objectives_6_2','prompt','Er HMS-mål etablert med tiltaksplan?',
                         'type','yes_no_na','required',true,'iso_clause','6.2','severity_default','medium'),
      jsonb_build_object('key','competence_7_2','prompt','Er kompetansekrav definert og verifisert?',
                         'type','yes_no_na','required',true,'iso_clause','7.2','severity_default','high'),
      jsonb_build_object('key','operational_8_1','prompt','Er operativ planlegging og kontroll dokumentert?',
                         'type','text','required',true,'iso_clause','8.1','severity_default','high'),
      jsonb_build_object('key','emergency_8_2','prompt','Er beredskap for hendelser etablert og testet?',
                         'type','yes_no_na','required',true,'iso_clause','8.2','severity_default','critical'),
      jsonb_build_object('key','monitoring_9_1','prompt','Er overvåking, måling og analyse av HMS-ytelse etablert?',
                         'type','yes_no_na','required',true,'iso_clause','9.1','severity_default','high'),
      jsonb_build_object('key','incident_10_2','prompt','Er hendelser og avvik undersøkt med korrigerende tiltak?',
                         'type','yes_no_na','required',true,'iso_clause','10.2','severity_default','critical'),
      jsonb_build_object('key','improvement_10_3','prompt','Pågår kontinuerlig forbedring av systemet?',
                         'type','text','required',true,'iso_clause','10.3','severity_default','medium'),
      jsonb_build_object('key','auditor_signature','prompt','Revisors signatur',
                         'type','signature','required',true,'iso_clause','9.2')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'iso-45001-internal-audit' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true and r.pack = 'iso-45001'
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ── AML baseline (Vernerunde) ────────────────────────────────────────────
create or replace function public._provision_compliance_aml_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'vernerunde-standard',
    'Vernerunde – standard',
    'Standard vernerunde etter arbeidsmiljøloven og internkontrollforskriften.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','fysisk_arb_omr','prompt','Er det fysiske arbeidsmiljøet forsvarlig?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-1, §4-4','severity_default','high',
                         'help','Vurder belysning, støy, ergonomi, ryddighet.'),
      jsonb_build_object('key','verneutstyr_tilg','prompt','Er nødvendig verneutstyr tilgjengelig og brukt?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §3-2 (1)','severity_default','critical'),
      jsonb_build_object('key','psyk_arbmiljo','prompt','Er det forhold som påvirker psykososialt arbeidsmiljø negativt?',
                         'type','text','required',false,
                         'law_ref','AML §4-3','severity_default','medium'),
      jsonb_build_object('key','kjemikalier','prompt','Er kjemikalier merket og oppbevart riktig?',
                         'type','yes_no_na','required',false,
                         'law_ref','AML §4-5','severity_default','high'),
      jsonb_build_object('key','evakuering','prompt','Er rømningsveier frie og merkede?',
                         'type','yes_no_na','required',true,
                         'law_ref','Internkontrollforskriften §5','severity_default','critical'),
      jsonb_build_object('key','foto','prompt','Bilder fra runden','type','photo','required',false),
      jsonb_build_object('key','signatur_verneombud','prompt','Verneombudets signatur',
                         'type','signature','required',true,'law_ref','AML §6-2')
    )),
    true, true, true, 'draft', 'kvartalsvis'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'vernerunde-standard' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-3-2','aml-4-1','aml-4-3','aml-4-4','aml-4-5','aml-6-2',
                   'ik-5-5','ik-5-6','ik-5-7','ik-5-8')
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ── AML internkontroll core ──────────────────────────────────────────────
create or replace function public._provision_compliance_aml_ik_core(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'avviksoppfolging-runde',
    'Avviksoppfølging-runde',
    'Kvartalsvis gjennomgang av åpne avvik, forebyggende tiltak og effekt av lukkede saker (IK-forskriften §5 nr. 7).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','aapne_avvik_oversikt','prompt','Er status for åpne avvik gjennomgått siste kvartal?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 7','severity_default','high'),
      jsonb_build_object('key','forebygge_gjentakelse','prompt','Hvilke tiltak er iverksatt for å forebygge gjentakelse?',
                         'type','text','required',true,'law_ref','IK-forskriften §5 nr. 7'),
      jsonb_build_object('key','lukket_avvik_eff','prompt','Er effekt av lukkede avvik verifisert?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 7','severity_default','medium'),
      jsonb_build_object('key','kommentar','prompt','Kommentar / observasjoner','type','text','required',false),
      jsonb_build_object('key','signatur_hms_leder','prompt','HMS-leders signatur','type','signature','required',true)
    )),
    true, true, true, 'draft', 'kvartalsvis'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'internkontroll-arsgjennomgang',
    'Internkontroll – årsgjennomgang',
    'Årlig systematisk gjennomgang av internkontrollen (IK-forskriften §5 nr. 8). Sentral artefakt for tilsyn.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','mal_oppfolging','prompt','Er HMS-mål satt for året evaluert?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 4','severity_default','medium'),
      jsonb_build_object('key','risikovurdering_oppdatert','prompt','Er risikovurderinger oppdatert siste 12 mnd?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
      jsonb_build_object('key','verneombud_aktivt','prompt','Har verneombudet vært aktivt deltakende?',
                         'type','yes_no_na','required',true,'law_ref','AML §6-2','severity_default','medium'),
      jsonb_build_object('key','amu_protokoll_signert','prompt','Er AMU-protokoll for året undertegnet?',
                         'type','yes_no_na','required',false,'law_ref','AML §7-2','severity_default','medium',
                         'help','Hvis virksomheten har AMU-plikt etter §7-1.'),
      jsonb_build_object('key','avvik_handlingsplan','prompt','Er avvikshåndtering og handlingsplan ført løpende?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 7','severity_default','high'),
      jsonb_build_object('key','bht_dialog','prompt','Har bedriftshelsetjenesten levert årsrapport?',
                         'type','yes_no_na','required',false,'law_ref','AML §3-3','severity_default','medium',
                         'help','Hvis virksomheten har BHT-plikt.'),
      jsonb_build_object('key','forbedringsforslag','prompt','Hva er identifisert som hovedforbedring for neste år?',
                         'type','text','required',true),
      jsonb_build_object('key','signatur_dagligleder','prompt','Daglig leders signatur',
                         'type','signature','required',true,'law_ref','IK-forskriften §5 nr. 8')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'avviksoppfolging-runde' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('ik-5-7','aml-5-1')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'internkontroll-arsgjennomgang' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('ik-5-4','ik-5-5','ik-5-6','ik-5-7','ik-5-8',
                   'aml-3-1','aml-3-3','aml-6-2','aml-7-2')
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ── AML onboarding & ansettelse ──────────────────────────────────────────
create or replace function public._provision_compliance_aml_onboarding(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'onboarding-hms-opplaering',
    'Onboarding – HMS-opplæring',
    'Sjekkliste for HMS-opplæring av ny ansatt før selvstendig arbeid (AML §3-2 (1) b + §3-3 + arbeidstakers medvirkningsplikt §2-3).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','intro_arb_omr','prompt','Har den ansatte fått omvisning og gjennomgang av arbeidsplassen?',
                         'type','yes_no_na','required',true,'law_ref','AML §3-2 (1) b','severity_default','high'),
      jsonb_build_object('key','verneutstyr_opplaering','prompt','Er bruk av personlig verneutstyr vist og praktisert?',
                         'type','yes_no_na','required',true,'law_ref','AML §3-2 (1) a','severity_default','critical'),
      jsonb_build_object('key','noedutgang','prompt','Er nødutganger og samlingsplass vist?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4','severity_default','high'),
      jsonb_build_object('key','kjemikalier_intro','prompt','Er stoffkartotek og kjemiske risikoer gjennomgått?',
                         'type','yes_no_na','required',false,'law_ref','AML §4-5','severity_default','high',
                         'help','Hvis arbeidet involverer kjemikalier.'),
      jsonb_build_object('key','verneombud_kontakt','prompt','Hvem er den ansattes verneombud (navn + kontakt)?',
                         'type','text','required',true,'law_ref','AML §6-1'),
      jsonb_build_object('key','signatur_ansatt','prompt','Den ansattes signatur',
                         'type','signature','required',true,'law_ref','AML §2-3'),
      jsonb_build_object('key','signatur_naermeste_leder','prompt','Nærmeste leders signatur',
                         'type','signature','required',true,'law_ref','AML §2-1')
    )),
    true, true, true, 'draft', 'ved tilsetting'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'arbeidsgivers-hms-opplaering',
    'Arbeidsgivers HMS-opplæring – kontroll',
    'Bekreftelse på at arbeidsgiver / leder med arbeidsgiveransvar har gjennomgått pålagt HMS-opplæring (AML §3-5).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','kursnavn','prompt','Hvilken HMS-opplæring er gjennomført?',
                         'type','text','required',true,'law_ref','AML §3-5'),
      jsonb_build_object('key','kursdato','prompt','Når ble opplæringen fullført? (dd.mm.åååå)',
                         'type','text','required',true),
      jsonb_build_object('key','dokumentasjon','prompt','Last opp kursbevis / diplom',
                         'type','photo','required',false),
      jsonb_build_object('key','signatur','prompt','Bekreftelse fra arbeidsgiver',
                         'type','signature','required',true,'law_ref','AML §3-5')
    )),
    true, true, true, 'draft', 'ved tilsetting av leder'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'tilsetting-mindrearig-sjekk',
    'Tilsetting av mindreårig – sjekk',
    'Sjekkliste som må fullføres FØR første arbeidsdag for personer under 18 år (AML kap 11).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','alder_bekreftet','prompt','Er alderen til den ansatte bekreftet (kopi av legitimasjon)?',
                         'type','yes_no_na','required',true,'law_ref','AML §11-1','severity_default','critical'),
      jsonb_build_object('key','arbeidstid_innenfor_grenser','prompt','Er planlagt arbeidstid innenfor lovens grenser?',
                         'type','yes_no_na','required',true,'law_ref','AML §11-2','severity_default','critical',
                         'help','Maks 8t/dag, 40t/uke for 15-18 år.'),
      jsonb_build_object('key','nattarbeid_unngas','prompt','Er nattarbeid (kl 23-06) unngått eller særskilt unntatt?',
                         'type','yes_no_na','required',true,'law_ref','AML §11-3','severity_default','critical'),
      jsonb_build_object('key','helsekontroll','prompt','Er helsekontroll gjennomført før arbeid?',
                         'type','yes_no_na','required',true,'law_ref','AML §11-4','severity_default','high'),
      jsonb_build_object('key','pauser_dokumentert','prompt','Er pauseregler (30 min ved 4,5t) sikret i arbeidsplanen?',
                         'type','yes_no_na','required',true,'law_ref','AML §11-5','severity_default','high'),
      jsonb_build_object('key','foresatt_samtykke','prompt','Er samtykke fra foresatt innhentet (under 18)?',
                         'type','yes_no_na','required',true,'severity_default','critical'),
      jsonb_build_object('key','signatur_naermeste_leder','prompt','Nærmeste leders signatur',
                         'type','signature','required',true),
      jsonb_build_object('key','signatur_foresatt','prompt','Foresattes signatur (under 18)',
                         'type','signature','required',true)
    )),
    true, true, true, 'draft', 'ved tilsetting av mindreårig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'arbeidsavtale-sjekk',
    'Arbeidsavtale-sjekk',
    'Kontroll av at den skriftlige arbeidsavtalen oppfyller minstekrav før signering (AML §14-5 + §14-6).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','partenes_identitet','prompt','Er partenes identitet angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) a'),
      jsonb_build_object('key','arbeidssted','prompt','Er arbeidssted angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) b'),
      jsonb_build_object('key','stillingsbetegnelse','prompt','Er stillingsbetegnelse / arbeidsoppgaver beskrevet?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) c'),
      jsonb_build_object('key','tiltredelse_dato','prompt','Er tiltredelsesdato angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) d'),
      jsonb_build_object('key','varighet','prompt','Er varighet (fast / midlertidig) angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) e'),
      jsonb_build_object('key','proevetid','prompt','Er prøvetid (om aktuelt) skriftlig avtalt?',
                         'type','yes_no_na','required',false,'law_ref','AML §14-6 (1) f','severity_default','medium'),
      jsonb_build_object('key','ferierettigheter','prompt','Er rett til ferie og feriepenger angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) g'),
      jsonb_build_object('key','oppsigelsesfrister','prompt','Er oppsigelsesfrister angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) h'),
      jsonb_build_object('key','lonn','prompt','Er lønn / godtgjørelse spesifisert?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) i'),
      jsonb_build_object('key','arbeidstid','prompt','Er arbeidstid (lengde + plassering) angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) j'),
      jsonb_build_object('key','pauser','prompt','Er rett til pauser angitt?',
                         'type','yes_no_na','required',true,'law_ref','AML §14-6 (1) k'),
      jsonb_build_object('key','tariffavtale','prompt','Er eventuell tariffavtale angitt?',
                         'type','yes_no_na','required',false,'law_ref','AML §14-6 (1) l','severity_default','low'),
      jsonb_build_object('key','signatur_arbeidsgiver','prompt','Arbeidsgivers signatur',
                         'type','signature','required',true,'law_ref','AML §14-5'),
      jsonb_build_object('key','signatur_ansatt','prompt','Den ansattes signatur',
                         'type','signature','required',true,'law_ref','AML §14-5')
    )),
    true, true, true, 'draft', 'ved tilsetting'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'onboarding-hms-opplaering' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-3-2','aml-3-3','aml-2-3','aml-6-1')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'arbeidsgivers-hms-opplaering' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-3-5','aml-2-1')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'tilsetting-mindrearig-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-11-1','aml-11-2','aml-11-3','aml-11-4','aml-11-5','aml-3-2')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'arbeidsavtale-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-14-5','aml-14-6','aml-2-1')
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ── AML fysisk + kjemisk arbeidsmiljø ────────────────────────────────────
create or replace function public._provision_compliance_aml_fysisk(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'brannvernrunde',
    'Brannvernrunde',
    'Kvartalsvis kontroll av rømningsveier, slokkemidler, branninstruks og samlingsplass (AML §4-4 + Forskrift om brannforebygging).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','roemningsveier_frie','prompt','Er rømningsveier frie og merkede?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4','severity_default','critical'),
      jsonb_build_object('key','slokkemidler_tilgjengelig','prompt','Er slokkemidler tilgjengelig og kontrollert?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4','severity_default','critical'),
      jsonb_build_object('key','branninstruks_synlig','prompt','Er branninstruks tydelig oppslått?',
                         'type','yes_no_na','required',true,'severity_default','high'),
      jsonb_build_object('key','samlingsplass_kjent','prompt','Vet ansatte hvor samlingsplassen er?',
                         'type','yes_no_na','required',true,'severity_default','high'),
      jsonb_build_object('key','siste_oevelse','prompt','Når ble siste branntestøvelse gjennomført? (dd.mm.åååå)',
                         'type','text','required',true),
      jsonb_build_object('key','foto_avvik','prompt','Bilder av eventuelle avvik','type','photo','required',false),
      jsonb_build_object('key','signatur','prompt','Verneombudets signatur',
                         'type','signature','required',true,'law_ref','AML §6-2')
    )),
    true, true, true, 'draft', 'kvartalsvis'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'ergonomi-runde',
    'Ergonomi-runde',
    'Halvårlig vurdering av arbeidsstillinger, tunge løft, gjentakende bevegelser og hjelpemidler (AML §4-4 (2) c).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','arbeidsstilling','prompt','Er arbeidsstillingen vurdert som forsvarlig?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4 (2) c','severity_default','medium'),
      jsonb_build_object('key','tunge_loft','prompt','Forekommer tunge løft som ikke er risikovurdert?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4 (2) c','severity_default','high'),
      jsonb_build_object('key','gjentakende_bevegelser','prompt','Er gjentakende bevegelser identifisert og dempet?',
                         'type','yes_no_na','required',false,'severity_default','medium'),
      jsonb_build_object('key','hjelpemidler_tilgjengelig','prompt','Er ergonomiske hjelpemidler tilgjengelig der det trengs?',
                         'type','yes_no_na','required',false,'severity_default','medium'),
      jsonb_build_object('key','pauser_tilrettelagt','prompt','Er pauser og rotering tilstrekkelig?',
                         'type','yes_no_na','required',false,'severity_default','low'),
      jsonb_build_object('key','tiltak_foreslaatt','prompt','Forslag til ergonomiske tiltak','type','text','required',false)
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'maskinsikkerhet-sjekk',
    'Maskinsikkerhet-sjekk',
    'Periodisk kontroll av maskinsikkerhet — verneanordninger, nødstopp, dokumentasjon, vedlikehold (AML §4-4 (1) + Arbeidsutstyrsforskriften).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','maskin_id','prompt','Hvilken maskin / utstyr er kontrollert? (ID eller navn)',
                         'type','text','required',true),
      jsonb_build_object('key','verneanordning_funksjon','prompt','Fungerer verneanordninger som forutsatt?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-4 (1)','severity_default','critical'),
      jsonb_build_object('key','noedstopp_test','prompt','Er nødstopp testet og responderer?',
                         'type','yes_no_na','required',true,'severity_default','critical'),
      jsonb_build_object('key','dokumentasjon_oppdatert','prompt','Er bruksanvisning og samsvarserklæring tilgjengelig?',
                         'type','yes_no_na','required',true,'severity_default','high'),
      jsonb_build_object('key','vedlikehold_journal','prompt','Er siste vedlikehold dokumentert?',
                         'type','yes_no_na','required',true,'severity_default','medium'),
      jsonb_build_object('key','foto','prompt','Bilder av kontrollert utstyr','type','photo','required',false),
      jsonb_build_object('key','signatur','prompt','Inspektørens signatur','type','signature','required',true)
    )),
    true, true, true, 'draft', 'månedlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'stoffkartotek-runde',
    'Stoffkartotek-runde',
    'Årlig kontroll av stoffkartotek, merking, oppbevaring, verneutstyr og risikovurdering for kjemikalier (AML §4-5 + Stoffkartotekforskriften).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','stoffkartotek_oppdatert','prompt','Er stoffkartoteket oppdatert siste 12 mnd?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-5','severity_default','high'),
      jsonb_build_object('key','merking_korrekt','prompt','Er kjemikalier korrekt merket (CLP)?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-5','severity_default','critical'),
      jsonb_build_object('key','oppbevaring_forsvarlig','prompt','Er oppbevaring og separasjon forsvarlig?',
                         'type','yes_no_na','required',true,'severity_default','critical'),
      jsonb_build_object('key','verneutstyr_dedikert','prompt','Er dedikert verneutstyr for kjemikaliebruk tilgjengelig?',
                         'type','yes_no_na','required',true,'law_ref','AML §3-2 (1) a','severity_default','critical'),
      jsonb_build_object('key','risikovurdering_pr_stoff','prompt','Er risikovurdering gjort for hvert farlig stoff?',
                         'type','yes_no_na','required',true,'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
      jsonb_build_object('key','eksponeringsmaling','prompt','Er eksponeringsmålinger gjennomført der pålagt?',
                         'type','yes_no_na','required',false,'severity_default','high'),
      jsonb_build_object('key','foto','prompt','Bilder fra runden','type','photo','required',false),
      jsonb_build_object('key','signatur','prompt','Verneombud + HMS-leder signatur','type','signature','required',true)
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'brannvernrunde' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-4','ik-5-7')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'ergonomi-runde' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-4','aml-4-2')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'maskinsikkerhet-sjekk' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-4','ik-5-7')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'stoffkartotek-runde' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-5','ik-5-6','aml-3-2')
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ── AML psykososialt + verneombud ────────────────────────────────────────
create or replace function public._provision_compliance_aml_psyk_vo(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'psykososial-pulsmaling',
    'Psykososial pulsmåling',
    'Halvårlig pulsmåling av psykososiale forhold (AML §4-3). Supplerer anonym survey for ikke-observable forhold.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','trakassering_observert','prompt','Er det observert eller meldt om trakassering eller utilbørlig opptreden?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-3 (3)','severity_default','critical'),
      jsonb_build_object('key','arbeidsbelastning_balansert','prompt','Oppleves arbeidsbelastningen som forsvarlig?',
                         'type','yes_no_na','required',true,'law_ref','AML §4-3','severity_default','high'),
      jsonb_build_object('key','ledelse_dialog','prompt','Har de ansatte regelmessig dialog med leder om arbeidssituasjon?',
                         'type','yes_no_na','required',false,'severity_default','medium'),
      jsonb_build_object('key','inkluderende_kultur','prompt','Oppleves arbeidsmiljøet som inkluderende?',
                         'type','yes_no_na','required',false,'severity_default','medium'),
      jsonb_build_object('key','aapne_temaer','prompt','Hvilke psykososiale temaer er aktive nå? (Skriv ikke personidentifiserende helseopplysninger.)',
                         'type','text','required',false),
      jsonb_build_object('key','signatur_verneombud','prompt','Verneombudets signatur',
                         'type','signature','required',true,'law_ref','AML §6-2')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'verneombud-arsrapport',
    'Verneombud-årsrapport',
    'Årlig egenrapport fra verneombud om aktiviteter, samarbeid med AMU og egen opplæring (AML §6-2 + §6-5). Inngår som vedlegg til AMU-årsprotokoll.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','runder_gjennomfort','prompt','Antall vernerunder gjennomført dette året',
                         'type','number','required',true,'law_ref','AML §6-2'),
      jsonb_build_object('key','avvik_meldt','prompt','Antall avvik meldt fra verneombud',
                         'type','number','required',true,'law_ref','AML §6-2'),
      jsonb_build_object('key','samarbeid_amu','prompt','Er saker brakt videre til AMU der det er aktuelt?',
                         'type','yes_no_na','required',false,'law_ref','AML §7-2','severity_default','medium'),
      jsonb_build_object('key','egen_opplaering','prompt','Er verneombudets opplæring oppdatert?',
                         'type','yes_no_na','required',true,'law_ref','AML §6-5','severity_default','high'),
      jsonb_build_object('key','kommentar','prompt','Verneombudets kommentarer til arbeidsmiljøåret',
                         'type','text','required',false),
      jsonb_build_object('key','signatur_verneombud','prompt','Verneombudets signatur',
                         'type','signature','required',true,'law_ref','AML §6-2'),
      jsonb_build_object('key','signatur_dagligleder','prompt','Daglig leders bekreftelse',
                         'type','signature','required',true)
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'psykososial-pulsmaling' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-4-3','aml-4-2','aml-6-2')
  on conflict (template_id, requirement_id) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'verneombud-arsrapport' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true
    and r.slug in ('aml-6-2','aml-6-5','aml-7-2')
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Master dispatcher
-- ════════════════════════════════════════════════════════════════════════

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
  elsif p_pack_slug = 'iso-45001' then
    perform public._provision_compliance_iso_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. License-grant trigger so future packs auto-provision
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.compliance_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    if (tg_op = 'INSERT')
       or (tg_op = 'UPDATE' and old.is_active = false)
    then
      perform public.provision_compliance_baseline_for_org(
        new.organization_id, new.slug
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_pack_provision_tg on public.compliance_packs;
create trigger compliance_pack_provision_tg
  after insert or update on public.compliance_packs
  for each row execute function public.compliance_pack_provision_on_change();

-- ════════════════════════════════════════════════════════════════════════
-- 4. Pin every existing system template (idempotent)
-- ════════════════════════════════════════════════════════════════════════

update public.compliance_checklist_templates
set nav_pinned = true
where is_system = true
  and nav_pinned = false
  and deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Backfill: provision every active (org, pack)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.compliance_packs
    where is_active = true
      and deleted_at is null
  loop
    perform public.provision_compliance_baseline_for_org(
      v_pack.organization_id, v_pack.slug
    );
  end loop;
end $$;
