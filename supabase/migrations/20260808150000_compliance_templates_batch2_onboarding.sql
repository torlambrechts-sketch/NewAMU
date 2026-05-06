-- Compliance template batch 2: Onboarding & opplæring (AML kap 3, 11, 14)
--
-- Adds four AML-pack system templates that fire at hire / role-change
-- rather than on a recurring cadence. They're sidebar-pinned because
-- they're high-frequency operational checklists in HR-adjacent flows.
--
-- New templates:
--   - onboarding-hms-opplaering         (AML §3-2 (1) b + §3-3, §2-3)
--   - arbeidsgivers-hms-opplaering      (AML §3-5)
--   - tilsetting-mindrearig-sjekk       (AML kap 11)
--   - arbeidsavtale-sjekk               (AML §14-6, §14-5)
--
-- Per the dossier: tilsetting-mindrearig is a separate template (Q-A:
-- separate, not folded into onboarding) — it carries different role
-- notes, has a critical foresatt-signatur item, and only applies for
-- under-18 hires. Org admins can deactivate it via is_active=false if
-- the org never hires minors.
--
-- The provision function is replaced (CREATE OR REPLACE) with all
-- system templates known after this batch. Idempotent insert via
-- (organization_id, slug) UNIQUE; idempotent tag via PK conflict.

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
  -- ── AML pack templates ────────────────────────────────────────────────
  if p_pack_slug = 'aml-amu' then

    -- vernerunde-standard
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

    -- avviksoppfolging-runde
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'avviksoppfolging-runde',
      'Avviksoppfølging-runde',
      'Kvartalsvis gjennomgang av åpne avvik, forebyggende tiltak og effekt av lukkede saker (IK-forskriften §5 nr. 7).',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','aapne_avvik_oversikt',
                           'prompt','Er status for åpne avvik gjennomgått siste kvartal?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 7','severity_default','high'),
        jsonb_build_object('key','forebygge_gjentakelse',
                           'prompt','Hvilke tiltak er iverksatt for å forebygge gjentakelse?',
                           'type','text','required',true,
                           'law_ref','IK-forskriften §5 nr. 7'),
        jsonb_build_object('key','lukket_avvik_eff',
                           'prompt','Er effekt av lukkede avvik verifisert?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 7','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Kommentar / observasjoner','type','text','required',false),
        jsonb_build_object('key','signatur_hms_leder','prompt','HMS-leders signatur',
                           'type','signature','required',true)
      )),
      true, false, true, 'draft', 'kvartalsvis'
    ) on conflict (organization_id, slug) do nothing;

    -- internkontroll-arsgjennomgang
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'internkontroll-arsgjennomgang',
      'Internkontroll – årsgjennomgang',
      'Årlig systematisk gjennomgang av internkontrollen (IK-forskriften §5 nr. 8). Sentral artefakt for tilsyn.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','mal_oppfolging','prompt','Er HMS-mål satt for året evaluert?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 4','severity_default','medium'),
        jsonb_build_object('key','risikovurdering_oppdatert','prompt','Er risikovurderinger oppdatert siste 12 mnd?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
        jsonb_build_object('key','verneombud_aktivt','prompt','Har verneombudet vært aktivt deltakende?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §6-2','severity_default','medium'),
        jsonb_build_object('key','amu_protokoll_signert','prompt','Er AMU-protokoll for året undertegnet?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §7-2','severity_default','medium',
                           'help','Hvis virksomheten har AMU-plikt etter §7-1.'),
        jsonb_build_object('key','avvik_handlingsplan','prompt','Er avvikshåndtering og handlingsplan ført løpende?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 7','severity_default','high'),
        jsonb_build_object('key','bht_dialog','prompt','Har bedriftshelsetjenesten levert årsrapport?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §3-3','severity_default','medium',
                           'help','Hvis virksomheten har BHT-plikt.'),
        jsonb_build_object('key','forbedringsforslag','prompt','Hva er identifisert som hovedforbedring for neste år?',
                           'type','text','required',true),
        jsonb_build_object('key','signatur_dagligleder','prompt','Daglig leders signatur',
                           'type','signature','required',true,'law_ref','IK-forskriften §5 nr. 8')
      )),
      true, true, true, 'draft', 'årlig'
    ) on conflict (organization_id, slug) do nothing;

    -- onboarding-hms-opplaering (NEW — AML §3-2 (1) b + §3-3 + §2-3)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'onboarding-hms-opplaering',
      'Onboarding – HMS-opplæring',
      'Sjekkliste for HMS-opplæring av ny ansatt før selvstendig arbeid (AML §3-2 (1) b + §3-3 + arbeidstakers medvirkningsplikt §2-3).',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','intro_arb_omr',
                           'prompt','Har den ansatte fått omvisning og gjennomgang av arbeidsplassen?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §3-2 (1) b','severity_default','high'),
        jsonb_build_object('key','verneutstyr_opplaering',
                           'prompt','Er bruk av personlig verneutstyr vist og praktisert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §3-2 (1) a','severity_default','critical'),
        jsonb_build_object('key','noedutgang',
                           'prompt','Er nødutganger og samlingsplass vist?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §4-4','severity_default','high'),
        jsonb_build_object('key','kjemikalier_intro',
                           'prompt','Er stoffkartotek og kjemiske risikoer gjennomgått?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §4-5','severity_default','high',
                           'help','Hvis arbeidet involverer kjemikalier.'),
        jsonb_build_object('key','verneombud_kontakt',
                           'prompt','Hvem er den ansattes verneombud (navn + kontakt)?',
                           'type','text','required',true,
                           'law_ref','AML §6-1'),
        jsonb_build_object('key','signatur_ansatt',
                           'prompt','Den ansattes signatur',
                           'type','signature','required',true,
                           'law_ref','AML §2-3'),
        jsonb_build_object('key','signatur_naermeste_leder',
                           'prompt','Nærmeste leders signatur',
                           'type','signature','required',true,
                           'law_ref','AML §2-1')
      )),
      true, true, true, 'draft', 'ved tilsetting'
    ) on conflict (organization_id, slug) do nothing;

    -- arbeidsgivers-hms-opplaering (NEW — AML §3-5)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'arbeidsgivers-hms-opplaering',
      'Arbeidsgivers HMS-opplæring – kontroll',
      'Bekreftelse på at arbeidsgiver / leder med arbeidsgiveransvar har gjennomgått pålagt HMS-opplæring (AML §3-5).',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','kursnavn',
                           'prompt','Hvilken HMS-opplæring er gjennomført?',
                           'type','text','required',true,
                           'law_ref','AML §3-5'),
        jsonb_build_object('key','kursdato',
                           'prompt','Når ble opplæringen fullført? (dd.mm.åååå)',
                           'type','text','required',true),
        jsonb_build_object('key','dokumentasjon',
                           'prompt','Last opp kursbevis / diplom',
                           'type','photo','required',false),
        jsonb_build_object('key','signatur',
                           'prompt','Bekreftelse fra arbeidsgiver',
                           'type','signature','required',true,
                           'law_ref','AML §3-5')
      )),
      true, false, true, 'draft', 'ved tilsetting av leder'
    ) on conflict (organization_id, slug) do nothing;

    -- tilsetting-mindrearig-sjekk (NEW — AML kap 11)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'tilsetting-mindrearig-sjekk',
      'Tilsetting av mindreårig – sjekk',
      'Sjekkliste som må fullføres FØR første arbeidsdag for personer under 18 år (AML kap 11).',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','alder_bekreftet',
                           'prompt','Er alderen til den ansatte bekreftet (kopi av legitimasjon)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §11-1','severity_default','critical'),
        jsonb_build_object('key','arbeidstid_innenfor_grenser',
                           'prompt','Er planlagt arbeidstid innenfor lovens grenser?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §11-2','severity_default','critical',
                           'help','Maks 8t/dag, 40t/uke for 15-18 år.'),
        jsonb_build_object('key','nattarbeid_unngas',
                           'prompt','Er nattarbeid (kl 23-06) unngått eller særskilt unntatt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §11-3','severity_default','critical'),
        jsonb_build_object('key','helsekontroll',
                           'prompt','Er helsekontroll gjennomført før arbeid?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §11-4','severity_default','high'),
        jsonb_build_object('key','pauser_dokumentert',
                           'prompt','Er pauseregler (30 min ved 4,5t) sikret i arbeidsplanen?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §11-5','severity_default','high'),
        jsonb_build_object('key','foresatt_samtykke',
                           'prompt','Er samtykke fra foresatt innhentet (under 18)?',
                           'type','yes_no_na','required',true,
                           'severity_default','critical'),
        jsonb_build_object('key','signatur_naermeste_leder',
                           'prompt','Nærmeste leders signatur',
                           'type','signature','required',true),
        jsonb_build_object('key','signatur_foresatt',
                           'prompt','Foresattes signatur (under 18)',
                           'type','signature','required',true)
      )),
      true, false, true, 'draft', 'ved tilsetting av mindreårig'
    ) on conflict (organization_id, slug) do nothing;

    -- arbeidsavtale-sjekk (NEW — AML §14-5, §14-6)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id, 'aml-amu', 'arbeidsavtale-sjekk',
      'Arbeidsavtale-sjekk',
      'Kontroll av at den skriftlige arbeidsavtalen oppfyller minstekrav før signering (AML §14-5 + §14-6).',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','partenes_identitet',
                           'prompt','Er partenes identitet angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) a'),
        jsonb_build_object('key','arbeidssted',
                           'prompt','Er arbeidssted angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) b'),
        jsonb_build_object('key','stillingsbetegnelse',
                           'prompt','Er stillingsbetegnelse / arbeidsoppgaver beskrevet?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) c'),
        jsonb_build_object('key','tiltredelse_dato',
                           'prompt','Er tiltredelsesdato angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) d'),
        jsonb_build_object('key','varighet',
                           'prompt','Er varighet (fast / midlertidig) angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) e'),
        jsonb_build_object('key','proevetid',
                           'prompt','Er prøvetid (om aktuelt) skriftlig avtalt?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §14-6 (1) f','severity_default','medium'),
        jsonb_build_object('key','ferierettigheter',
                           'prompt','Er rett til ferie og feriepenger angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) g'),
        jsonb_build_object('key','oppsigelsesfrister',
                           'prompt','Er oppsigelsesfrister angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) h'),
        jsonb_build_object('key','lonn',
                           'prompt','Er lønn / godtgjørelse spesifisert?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) i'),
        jsonb_build_object('key','arbeidstid',
                           'prompt','Er arbeidstid (lengde + plassering) angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) j'),
        jsonb_build_object('key','pauser',
                           'prompt','Er rett til pauser angitt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §14-6 (1) k'),
        jsonb_build_object('key','tariffavtale',
                           'prompt','Er eventuell tariffavtale angitt?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §14-6 (1) l','severity_default','low'),
        jsonb_build_object('key','signatur_arbeidsgiver',
                           'prompt','Arbeidsgivers signatur',
                           'type','signature','required',true,
                           'law_ref','AML §14-5'),
        jsonb_build_object('key','signatur_ansatt',
                           'prompt','Den ansattes signatur',
                           'type','signature','required',true,
                           'law_ref','AML §14-5')
      )),
      true, true, true, 'draft', 'ved tilsetting'
    ) on conflict (organization_id, slug) do nothing;

  end if;

  -- ── ISO 45001 baseline (unchanged from 5.0) ──────────────────────────
  if p_pack_slug = 'iso-45001' then
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
  end if;

  -- ── Explicit per-template requirement tags (additive, idempotent) ────

  if p_pack_slug = 'aml-amu' then
    -- vernerunde-standard
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'vernerunde-standard' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('aml-3-2','aml-4-1','aml-4-3','aml-4-4','aml-4-5','aml-6-2',
                     'ik-5-5','ik-5-6','ik-5-7','ik-5-8')
    on conflict (template_id, requirement_id) do nothing;

    -- avviksoppfolging-runde
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'avviksoppfolging-runde' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('ik-5-7','aml-5-1')
    on conflict (template_id, requirement_id) do nothing;

    -- internkontroll-arsgjennomgang
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'internkontroll-arsgjennomgang' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('ik-5-4','ik-5-5','ik-5-6','ik-5-7','ik-5-8',
                     'aml-3-1','aml-3-3','aml-6-2','aml-7-2')
    on conflict (template_id, requirement_id) do nothing;

    -- onboarding-hms-opplaering
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'onboarding-hms-opplaering' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('aml-3-2','aml-3-3','aml-2-3','aml-6-1')
    on conflict (template_id, requirement_id) do nothing;

    -- arbeidsgivers-hms-opplaering
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'arbeidsgivers-hms-opplaering' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('aml-3-5','aml-2-1')
    on conflict (template_id, requirement_id) do nothing;

    -- tilsetting-mindrearig-sjekk
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'tilsetting-mindrearig-sjekk' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('aml-11-1','aml-11-2','aml-11-3','aml-11-4','aml-11-5','aml-3-2')
    on conflict (template_id, requirement_id) do nothing;

    -- arbeidsavtale-sjekk
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'arbeidsavtale-sjekk' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.slug in ('aml-14-5','aml-14-6','aml-2-1')
    on conflict (template_id, requirement_id) do nothing;
  end if;

  if p_pack_slug = 'iso-45001' then
    insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t cross join public.compliance_requirements r
    where t.organization_id = p_org_id and t.slug = 'iso-45001-internal-audit' and t.deleted_at is null
      and r.organization_id is null and r.is_active = true
      and r.pack = 'iso-45001'
    on conflict (template_id, requirement_id) do nothing;
  end if;
end;
$$;

-- ── Backfill: run provisioning for every active (org, pack) ──────────

do $$
declare v_pack record;
begin
  for v_pack in
    select organization_id, slug from public.compliance_packs
    where is_active = true and deleted_at is null
  loop
    perform public.provision_compliance_baseline_for_org(
      v_pack.organization_id, v_pack.slug
    );
  end loop;
end $$;
