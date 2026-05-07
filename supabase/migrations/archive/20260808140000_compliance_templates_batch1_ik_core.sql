-- Compliance template batch 1: Internkontroll-core
--
-- Adds two AML-pack system templates that fill IK-forskriften §5 nr. 7
-- and §5 nr. 8 — the two numbered points that explicitly require
-- "iverksette rutiner" and "systematisk overvåkning og gjennomgang".
-- These are the only IK §5 points that map cleanly to recurring
-- structured checklists (the others are document-shaped or process-
-- shaped per the dossier).
--
-- Templates:
--   - avviksoppfolging-runde       (kvartalsvis, IK §5 nr. 7)
--   - internkontroll-arsgjennomgang (årlig, IK §5 nr. 8 + auxiliary)
--
-- Architectural fix in this migration:
-- The previous provision_compliance_baseline_for_org used a blanket
-- tagging loop that linked every system template with every pack-scoped
-- system requirement. That over-claimed coverage. This migration
-- replaces the function with explicit per-template tag mappings so
-- coverage analysis reflects what each template actually inspects.
--
-- Existing junction rows from prior migrations are left intact (no
-- destructive UPDATE/DELETE); the explicit tagging is additive on top
-- of what's already there. Cleanup of over-tagging from earlier seeds
-- is deferred to a domain-expert-co-authored follow-up commit.

-- ── 1. Replace the provision function with batch 1 templates +
--      explicit per-template requirement tags ──────────────────────────

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

    -- vernerunde-standard (existing baseline)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id,
      'aml-amu',
      'vernerunde-standard',
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
        jsonb_build_object('key','foto','prompt','Bilder fra runden',
                           'type','photo','required',false),
        jsonb_build_object('key','signatur_verneombud','prompt','Verneombudets signatur',
                           'type','signature','required',true,
                           'law_ref','AML §6-2')
      )),
      true, true, true, 'draft', 'kvartalsvis'
    )
    on conflict (organization_id, slug) do nothing;

    -- avviksoppfolging-runde (new — IK §5 nr. 7)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id,
      'aml-amu',
      'avviksoppfolging-runde',
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
        jsonb_build_object('key','kommentar',
                           'prompt','Kommentar / observasjoner',
                           'type','text','required',false),
        jsonb_build_object('key','signatur_hms_leder',
                           'prompt','HMS-leders signatur',
                           'type','signature','required',true)
      )),
      true, false, true, 'draft', 'kvartalsvis'
    )
    on conflict (organization_id, slug) do nothing;

    -- internkontroll-arsgjennomgang (new — IK §5 nr. 8)
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id,
      'aml-amu',
      'internkontroll-arsgjennomgang',
      'Internkontroll – årsgjennomgang',
      'Årlig systematisk gjennomgang av internkontrollen (IK-forskriften §5 nr. 8). Sentral artefakt for tilsyn.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','mal_oppfolging',
                           'prompt','Er HMS-mål satt for året evaluert?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 4','severity_default','medium'),
        jsonb_build_object('key','risikovurdering_oppdatert',
                           'prompt','Er risikovurderinger oppdatert siste 12 mnd?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
        jsonb_build_object('key','verneombud_aktivt',
                           'prompt','Har verneombudet vært aktivt deltakende?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML §6-2','severity_default','medium'),
        jsonb_build_object('key','amu_protokoll_signert',
                           'prompt','Er AMU-protokoll for året undertegnet?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §7-2','severity_default','medium',
                           'help','Hvis virksomheten har AMU-plikt etter §7-1.'),
        jsonb_build_object('key','avvik_handlingsplan',
                           'prompt','Er avvikshåndtering og handlingsplan ført løpende?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-forskriften §5 nr. 7','severity_default','high'),
        jsonb_build_object('key','bht_dialog',
                           'prompt','Har bedriftshelsetjenesten levert årsrapport?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML §3-3','severity_default','medium',
                           'help','Hvis virksomheten har BHT-plikt.'),
        jsonb_build_object('key','forbedringsforslag',
                           'prompt','Hva er identifisert som hovedforbedring for neste år?',
                           'type','text','required',true),
        jsonb_build_object('key','signatur_dagligleder',
                           'prompt','Daglig leders signatur',
                           'type','signature','required',true,
                           'law_ref','IK-forskriften §5 nr. 8')
      )),
      true, true, true, 'draft', 'årlig'
    )
    on conflict (organization_id, slug) do nothing;

  end if;

  -- ── ISO 45001 pack template (unchanged from 5.0) ─────────────────────
  if p_pack_slug = 'iso-45001' then
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      p_org_id,
      'iso-45001',
      'iso-45001-internal-audit',
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
    )
    on conflict (organization_id, slug) do nothing;
  end if;

  -- ── Explicit per-template requirement tags ─────────────────────────────
  -- Each block: insert junction rows for one (org, template-slug) pair
  -- mapping to a hand-curated list of requirement slugs. Idempotent via
  -- PK conflict.

  -- vernerunde-standard
  if p_pack_slug = 'aml-amu' then
    insert into public.compliance_template_requirements
      (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t
    cross join public.compliance_requirements r
    where t.organization_id = p_org_id
      and t.slug = 'vernerunde-standard'
      and t.deleted_at is null
      and r.organization_id is null
      and r.is_active = true
      and r.slug in (
        'aml-3-2', 'aml-4-1', 'aml-4-3', 'aml-4-4', 'aml-4-5', 'aml-6-2',
        'ik-5-5', 'ik-5-6', 'ik-5-7', 'ik-5-8'
      )
    on conflict (template_id, requirement_id) do nothing;

    -- avviksoppfolging-runde
    insert into public.compliance_template_requirements
      (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t
    cross join public.compliance_requirements r
    where t.organization_id = p_org_id
      and t.slug = 'avviksoppfolging-runde'
      and t.deleted_at is null
      and r.organization_id is null
      and r.is_active = true
      and r.slug in ('ik-5-7', 'aml-5-1')
    on conflict (template_id, requirement_id) do nothing;

    -- internkontroll-arsgjennomgang
    insert into public.compliance_template_requirements
      (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t
    cross join public.compliance_requirements r
    where t.organization_id = p_org_id
      and t.slug = 'internkontroll-arsgjennomgang'
      and t.deleted_at is null
      and r.organization_id is null
      and r.is_active = true
      and r.slug in (
        'ik-5-4', 'ik-5-5', 'ik-5-6', 'ik-5-7', 'ik-5-8',
        'aml-3-1', 'aml-3-3', 'aml-6-2', 'aml-7-2'
      )
    on conflict (template_id, requirement_id) do nothing;
  end if;

  -- iso-45001-internal-audit covers all ISO system requirements
  if p_pack_slug = 'iso-45001' then
    insert into public.compliance_template_requirements
      (template_id, requirement_id, organization_id)
    select t.id, r.id, t.organization_id
    from public.compliance_checklist_templates t
    cross join public.compliance_requirements r
    where t.organization_id = p_org_id
      and t.slug = 'iso-45001-internal-audit'
      and t.deleted_at is null
      and r.organization_id is null
      and r.is_active = true
      and r.pack = 'iso-45001'
    on conflict (template_id, requirement_id) do nothing;
  end if;
end;
$$;

-- ── 2. Backfill: run provisioning for every active (org, pack) ─────────

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
