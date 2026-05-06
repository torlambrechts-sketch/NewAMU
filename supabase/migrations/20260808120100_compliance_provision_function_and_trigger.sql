-- Multi-tenant baseline provisioning for compliance checklists.
--
-- Problem: the previous seed migrations
--   20260806120200_compliance_checklist_seed.sql  (templates)
--   20260807130100_compliance_requirements_seed.sql (requirement tags)
-- looped over public.organizations at migration time. Orgs that register
-- AFTER those migrations ran would never receive system templates or
-- their requirement linkage. With customers signing up over time, this
-- silently breaks new tenants.
--
-- Fix: a SECURITY DEFINER function provision_compliance_baseline_for_org
-- that idempotently provisions baseline content for one (org, pack) pair,
-- plus an AFTER INSERT/UPDATE trigger on public.compliance_packs that
-- calls it whenever a pack is licensed (row inserted with is_active=true,
-- or a previously inactive row is reactivated).
--
-- Per Q4: license-grant is the trigger event, not org creation. Inserting
-- a compliance_packs row is the license-grant primitive. New orgs get a
-- baseline by inserting their licensed packs at signup; the trigger does
-- the rest.

-- ── 1. The provisioning function ────────────────────────────────────────────

create or replace function public.provision_compliance_baseline_for_org(
  p_org_id   uuid,
  p_pack_slug public.compliance_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
  v_req      record;
begin
  -- Templates: insert system baselines per pack, idempotent on
  -- (organization_id, slug). Content mirrors the original
  -- 20260806120200_compliance_checklist_seed.sql payload — kept here so
  -- new orgs get the same starting state without re-running that migration.

  if p_pack_slug = 'aml-amu' then
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
  end if;

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

  -- Tag the org's templates with all matching pack-scoped system requirements.
  -- Idempotent via PK conflict.
  for v_template in
    select id, pack
    from public.compliance_checklist_templates
    where organization_id = p_org_id
      and pack = p_pack_slug
      and is_system = true
      and deleted_at is null
  loop
    for v_req in
      select id
      from public.compliance_requirements
      where organization_id is null
        and pack = v_template.pack
        and is_active = true
    loop
      insert into public.compliance_template_requirements
        (template_id, requirement_id, organization_id)
      values
        (v_template.id, v_req.id, p_org_id)
      on conflict (template_id, requirement_id) do nothing;
    end loop;
  end loop;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ── 2. Trigger: license-grant fires provisioning ───────────────────────────

create or replace function public.compliance_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Provision iff the row is now licensed and either just inserted
  -- (license granted) or just reactivated (was disabled, now enabled).
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

-- ── 3. Backfill any (org, pack) that already exists but is missing tags ────
-- Existing rows from the initial migrations are already in place; this is a
-- belt-and-braces re-run so mixed environments converge to a known state.

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
