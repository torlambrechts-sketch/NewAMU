-- ISO 9001:2015 — compliance pack seed, provision helper, and updated dispatcher.
--
-- Gap closed: ISO 9001:2015 §9.2 requires a documented internal audit programme
-- covering all clauses of the QMS. Without audit checklists, an org cannot
-- demonstrate systematic audit coverage to a certification body.
--
-- Self-audit (ISO 9001 certification readiness):
--   Addressed: 7 clause-grouped audit templates covering all Harmonized
--   Structure sections (4–10); system requirements for all 7 clause groups;
--   one default category ("Internrevisjon") per org on activation.
--   Restrisiko deferred: per-process audit templates (§8.1), customer
--   satisfaction measurement integration (§9.1.2 — separate survey template),
--   corrective action auto-linkage (§10.2 — tasks module handles this).
--
-- Seeding strategy:
--   is_active = FALSE for all existing orgs. New orgs receive the pack via the
--   license-grant trigger when an admin activates it from Innstillinger → Pakker.
--   Templates and categories are only provisioned on activation (trigger fires).
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Seed compliance_packs rows (is_active = false) ────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    insert into public.compliance_packs (
      organization_id, slug, short_name, plural_label, cta_label, description,
      legal_references, kpi_labels, severity_labels, position, is_active
    ) values (
      v_org.id, 'iso-9001',
      'ISO 9001',
      'Internrevisjoner (kvalitet)',
      'Ny internrevisjon',
      'Internrevisjon mot ISO 9001:2015 for kvalitetsstyringssystem (QMS). Dekker alle klausuler i Harmonized Structure (kl. 4–10).',
      jsonb_build_array(
        jsonb_build_object('code','ISO 9001:2015 § 9.2','text','Internrevisjon — krav til revisjonsprogramme og -prosedyre'),
        jsonb_build_object('code','ISO 9001:2015 § 10.2','text','Avvik og korrigerende tiltak'),
        jsonb_build_object('code','ISO 9001:2015 § 4.4','text','Kvalitetsstyringssystem og dets prosesser')
      ),
      jsonb_build_object('open','Pågående revisjoner','critical','Major NC','ytd','Fullførte i år'),
      jsonb_build_object('critical','Major NC','high','Major NC','medium','Minor NC','low','Observasjon'),
      30,
      false  -- dormant until org admin activates
    ) on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ── 2. Provision helper: _provision_compliance_iso_9001_baseline ─────────────
-- Called by the master dispatcher when is_active flips to true.
-- Creates 7 audit templates (one per Harmonized Structure section)
-- plus system requirements for all 7 clause groups.

create or replace function public._provision_compliance_iso_9001_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl_id uuid;
begin

  -- Template 1: Context of the organization (clauses 4.1–4.4)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-context',
    'ISO 9001 — Kontekst (kl. 4)',
    'Revisjon av organisasjonens kontekst, interessenter, virkeområde og prosesser.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','context_4_1','prompt','Er interne og eksterne faktorer som påvirker QMS identifisert og dokumentert (SWOT/PESTLE)?',
        'type','yes_no_na','required',true,'iso_clause','4.1','severity_default','medium'),
      jsonb_build_object('key','stakeholders_4_2','prompt','Er interesseparter og deres relevante krav identifisert, overvåket og gjennomgått?',
        'type','yes_no_na','required',true,'iso_clause','4.2','severity_default','medium'),
      jsonb_build_object('key','scope_4_3','prompt','Er QMS-virkeområdet dokumentert med begrunnelse for unntak fra ISO 9001?',
        'type','yes_no_na','required',true,'iso_clause','4.3','severity_default','high'),
      jsonb_build_object('key','processes_4_4','prompt','Er alle QMS-prosesser kartlagt med eiere, inn-/ut-leveranser, risiko og KPI?',
        'type','yes_no_na','required',true,'iso_clause','4.4','severity_default','high'),
      jsonb_build_object('key','notes_context','prompt','Revisors notater og observasjoner (kl. 4)',
        'type','text','required',false,'iso_clause','4')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 2: Leadership (clauses 5.1–5.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-leadership',
    'ISO 9001 — Lederskap (kl. 5)',
    'Revisjon av lederengasjement, kvalitetspolicy og roller/ansvar.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','leadership_5_1','prompt','Demonstrerer toppledelsen lederskap og forpliktelse til QMS (kl. 5.1)?',
        'type','yes_no_na','required',true,'iso_clause','5.1','severity_default','high'),
      jsonb_build_object('key','customer_5_1_2','prompt','Er kundefokus aktivt fremmet av ledelsen, inkludert risikoidentifikasjon og KTI-mål?',
        'type','yes_no_na','required',true,'iso_clause','5.1.2','severity_default','high'),
      jsonb_build_object('key','policy_5_2','prompt','Er kvalitetspolicyen dokumentert, kommunisert, forstått og gjennomgått?',
        'type','yes_no_na','required',true,'iso_clause','5.2','severity_default','high'),
      jsonb_build_object('key','roles_5_3','prompt','Er roller, ansvar og myndighet for QMS tydelig definert og kommunisert?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','medium'),
      jsonb_build_object('key','notes_leadership','prompt','Revisors notater og observasjoner (kl. 5)',
        'type','text','required',false,'iso_clause','5')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 3: Planning (clauses 6.1–6.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-planning',
    'ISO 9001 — Planlegging (kl. 6)',
    'Revisjon av risiko og muligheter, kvalitetsmål og endringsstyring.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','risks_6_1','prompt','Er risikoer og muligheter for QMS identifisert og tiltak planlagt (kl. 6.1)?',
        'type','yes_no_na','required',true,'iso_clause','6.1','severity_default','high'),
      jsonb_build_object('key','objectives_6_2','prompt','Er kvalitetsmål etablert, SMART-formulerte, kommunisert og overvåket?',
        'type','yes_no_na','required',true,'iso_clause','6.2','severity_default','high'),
      jsonb_build_object('key','change_6_3','prompt','Planlegges endringer i QMS strukturert med vurdering av konsekvenser og ressurser?',
        'type','yes_no_na','required',true,'iso_clause','6.3','severity_default','medium'),
      jsonb_build_object('key','notes_planning','prompt','Revisors notater og observasjoner (kl. 6)',
        'type','text','required',false,'iso_clause','6')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 4: Support (clauses 7.1–7.5)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-support',
    'ISO 9001 — Støtte (kl. 7)',
    'Revisjon av ressurser, kompetanse, bevissthet, kommunikasjon og dokumentasjon.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','resources_7_1','prompt','Stilles tilstrekkelige ressurser (personell, infrastruktur, miljø, måleutstyr) til disposisjon?',
        'type','yes_no_na','required',true,'iso_clause','7.1','severity_default','medium'),
      jsonb_build_object('key','competence_7_2','prompt','Er kompetansekrav definert og kompetanse verifisert og dokumentert (kl. 7.2)?',
        'type','yes_no_na','required',true,'iso_clause','7.2','severity_default','high'),
      jsonb_build_object('key','awareness_7_3','prompt','Er personell bevisst på kvalitetspolicyen, mål og sin rolle i QMS?',
        'type','yes_no_na','required',true,'iso_clause','7.3','severity_default','medium'),
      jsonb_build_object('key','communication_7_4','prompt','Er intern og ekstern kommunikasjon om QMS planlagt og gjennomført?',
        'type','yes_no_na','required',true,'iso_clause','7.4','severity_default','low'),
      jsonb_build_object('key','documented_info_7_5','prompt','Er all påkrevd dokumentert informasjon tilgjengelig, beskyttet og kontrollert?',
        'type','yes_no_na','required',true,'iso_clause','7.5','severity_default','high'),
      jsonb_build_object('key','notes_support','prompt','Revisors notater og observasjoner (kl. 7)',
        'type','text','required',false,'iso_clause','7')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 5: Operations (clauses 8.1–8.7)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-operations',
    'ISO 9001 — Drift (kl. 8)',
    'Revisjon av operativ planlegging, design, leverandørstyring og produktkontroll.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','ops_planning_8_1','prompt','Er operativ planlegging og kontroll av prosesser dokumentert og implementert?',
        'type','yes_no_na','required',true,'iso_clause','8.1','severity_default','high'),
      jsonb_build_object('key','customer_req_8_2','prompt','Er kundekrav, lovkrav og klager systematisk fanget opp og håndtert?',
        'type','yes_no_na','required',true,'iso_clause','8.2','severity_default','high'),
      jsonb_build_object('key','design_8_3','prompt','Er design- og utviklingsprosessen kontrollert med gjennomgang, verifisering og validering?',
        'type','yes_no_na','required',true,'iso_clause','8.3','severity_default','medium'),
      jsonb_build_object('key','external_providers_8_4','prompt','Er leverandørstyringen (evaluering, krav, overvåking) dokumentert og gjennomført?',
        'type','yes_no_na','required',true,'iso_clause','8.4','severity_default','high'),
      jsonb_build_object('key','production_8_5','prompt','Er produksjon og tjenesteleveranse kontrollert inkl. identifikasjon/sporbarhet?',
        'type','yes_no_na','required',true,'iso_clause','8.5','severity_default','medium'),
      jsonb_build_object('key','nonconforming_8_7','prompt','Håndteres avvikende produkter/tjenester konsekvent med disposisjon dokumentert?',
        'type','yes_no_na','required',true,'iso_clause','8.7','severity_default','high'),
      jsonb_build_object('key','notes_operations','prompt','Revisors notater og observasjoner (kl. 8)',
        'type','text','required',false,'iso_clause','8')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 6: Performance evaluation (clauses 9.1–9.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-performance',
    'ISO 9001 — Evalueringsrevisjon (kl. 9)',
    'Revisjon av overvåking, intern revisjon og ledelsens gjennomgang.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','monitoring_9_1','prompt','Er overvåking, måling, analyse og evaluering av QMS-ytelse planlagt og gjennomført?',
        'type','yes_no_na','required',true,'iso_clause','9.1','severity_default','high'),
      jsonb_build_object('key','customer_sat_9_1_2','prompt','Måles kundetilfredshet systematisk og brukes resultatene til forbedring?',
        'type','yes_no_na','required',true,'iso_clause','9.1.2','severity_default','high'),
      jsonb_build_object('key','internal_audit_9_2','prompt','Gjennomføres internrevisjon etter plan med kompetente revisorer og dokumenterte funn?',
        'type','yes_no_na','required',true,'iso_clause','9.2','severity_default','critical'),
      jsonb_build_object('key','mgmt_review_9_3','prompt','Gjennomfører ledelsen formell gjennomgang av QMS med alle påkrevde inndata og beslutninger?',
        'type','yes_no_na','required',true,'iso_clause','9.3','severity_default','high'),
      jsonb_build_object('key','notes_performance','prompt','Revisors notater og observasjoner (kl. 9)',
        'type','text','required',false,'iso_clause','9'),
      jsonb_build_object('key','auditor_signature','prompt','Revisors signatur',
        'type','signature','required',true,'iso_clause','9.2')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 7: Improvement (clauses 10.1–10.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-9001', 'iso-9001-improvement',
    'ISO 9001 — Forbedring (kl. 10)',
    'Revisjon av avviksbehandling, korrigerende tiltak og kontinuerlig forbedring.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','nc_10_2','prompt','Håndteres avvik og NC-er konsekvent med rotårsaksanalyse og dokumenterte korrigerende tiltak?',
        'type','yes_no_na','required',true,'iso_clause','10.2','severity_default','critical'),
      jsonb_build_object('key','effectiveness_10_2','prompt','Evalueres effektiviteten av korrigerende tiltak og lukkes disse systematisk?',
        'type','yes_no_na','required',true,'iso_clause','10.2','severity_default','high'),
      jsonb_build_object('key','continual_10_3','prompt','Kan organisasjonen demonstrere kontinuerlig forbedring av QMS-egnethet og -effektivitet?',
        'type','text','required',true,'iso_clause','10.3','severity_default','medium'),
      jsonb_build_object('key','notes_improvement','prompt','Revisors notater og observasjoner (kl. 10)',
        'type','text','required',false,'iso_clause','10')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- System requirements for ISO 9001 (7 clause groups)
  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null, 'iso-9001', 'iso-9001-4',  'ISO 9001:2015 § 4', 'Kontekst av organisasjonen',
     'Klausul 4.1-4.4: Kontekst, interesseparter, virkeområde og prosesser.', true, true),
    (null, 'iso-9001', 'iso-9001-5',  'ISO 9001:2015 § 5', 'Lederskap',
     'Klausul 5.1-5.3: Lederengasjement, kvalitetspolicy og roller.', true, true),
    (null, 'iso-9001', 'iso-9001-6',  'ISO 9001:2015 § 6', 'Planlegging',
     'Klausul 6.1-6.3: Risiko og muligheter, kvalitetsmål, endringer.', true, true),
    (null, 'iso-9001', 'iso-9001-7',  'ISO 9001:2015 § 7', 'Støtte',
     'Klausul 7.1-7.5: Ressurser, kompetanse, bevissthet, kommunikasjon, dokumentasjon.', true, true),
    (null, 'iso-9001', 'iso-9001-8',  'ISO 9001:2015 § 8', 'Drift',
     'Klausul 8.1-8.7: Operativ planlegging, design, leverandørstyring, produksjon.', true, true),
    (null, 'iso-9001', 'iso-9001-9',  'ISO 9001:2015 § 9', 'Evaluering av ytelse',
     'Klausul 9.1-9.3: Overvåking, internrevisjon, ledelsens gjennomgang.', true, true),
    (null, 'iso-9001', 'iso-9001-10', 'ISO 9001:2015 § 10', 'Forbedring',
     'Klausul 10.1-10.3: Avvik, korrigerende tiltak, kontinuerlig forbedring.', true, true)
  on conflict (pack, slug) where organization_id is null do nothing;

  -- Link each template to its primary requirement
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r
    on r.organization_id is null and r.pack = 'iso-9001'
  where t.organization_id = p_org_id
    and t.pack = 'iso-9001'
    and t.deleted_at is null
    and (
      (t.slug = 'iso-9001-context'     and r.slug = 'iso-9001-4') or
      (t.slug = 'iso-9001-leadership'  and r.slug = 'iso-9001-5') or
      (t.slug = 'iso-9001-planning'    and r.slug = 'iso-9001-6') or
      (t.slug = 'iso-9001-support'     and r.slug = 'iso-9001-7') or
      (t.slug = 'iso-9001-operations'  and r.slug = 'iso-9001-8') or
      (t.slug = 'iso-9001-performance' and r.slug = 'iso-9001-9') or
      (t.slug = 'iso-9001-improvement' and r.slug = 'iso-9001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_9001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_9001_baseline(uuid) to authenticated, service_role;

-- ── 3. Extend master dispatcher with iso-9001 branch ─────────────────────────
-- The trigger function is also updated below to create the default category.

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
  elsif p_pack_slug = 'iso-9001' then
    perform public._provision_compliance_iso_9001_baseline(p_org_id);
  -- iso-14001 and iso-27001 branches added in subsequent migrations
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ── 4. Extend trigger to provision iso-9001 category on activation ────────────

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

      if new.slug = 'aml-amu' then
        insert into public.compliance_checklist_categories
          (organization_id, pack, slug, name, description, position, is_system)
        values
          (new.organization_id,'aml-amu','vernerunder','Vernerunder','Standard runder etter arbeidsmiljøloven og internkontrollforskriften.',10,true),
          (new.organization_id,'aml-amu','fysisk','Fysisk og kjemisk arbeidsmiljø','Brann, ergonomi, maskiner og kjemikalier (AML §4-4 og §4-5).',20,true),
          (new.organization_id,'aml-amu','internkontroll','Internkontroll og avvik','Avviksoppfølging og årlig systemgjennomgang.',30,true),
          (new.organization_id,'aml-amu','ansettelse','Ansettelse og opplæring','Onboarding, mindreårige, arbeidsavtale og leder-HMS.',40,true),
          (new.organization_id,'aml-amu','psykososialt','Psykososialt og verneombud','Psykososial pulsmåling og verneombud-årsrapport.',50,true)
        on conflict (organization_id, pack, slug) do nothing;

      elsif new.slug = 'iso-45001' then
        insert into public.compliance_checklist_categories
          (organization_id, pack, slug, name, description, position, is_system)
        values
          (new.organization_id,'iso-45001','internrevisjon','Internrevisjon','Revisjon mot ISO 45001 — klausul 9.2.',10,true)
        on conflict (organization_id, pack, slug) do nothing;

      elsif new.slug = 'iso-9001' then
        insert into public.compliance_checklist_categories
          (organization_id, pack, slug, name, description, position, is_system)
        values
          (new.organization_id,'iso-9001','internrevisjon','Internrevisjon (kvalitet)','Klausulvise revisjoner mot ISO 9001:2015.',10,true)
        on conflict (organization_id, pack, slug) do nothing;
      -- iso-14001 and iso-27001 category branches added in subsequent migrations

      end if;

      -- Assign new templates to default category
      declare
        v_cat_id uuid;
      begin
        select id into v_cat_id
          from public.compliance_checklist_categories
          where organization_id = new.organization_id
            and pack = new.slug
            and slug = 'internrevisjon';

        if v_cat_id is not null and new.slug = 'iso-9001' then
          update public.compliance_checklist_templates
            set category_id = v_cat_id
            where organization_id = new.organization_id
              and pack = 'iso-9001'
              and category_id is null
              and deleted_at is null;
        end if;
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_pack_provision_tg on public.compliance_packs;
create trigger compliance_pack_provision_tg
  after insert or update on public.compliance_packs
  for each row execute function public.compliance_pack_provision_on_change();
