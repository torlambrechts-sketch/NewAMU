-- Compliance template batch 3: Fysisk og kjemisk arbeidsmiljø
--
-- Adds four AML-pack helpers covering AML §4-4 (fysisk arbeidsmiljø)
-- and §4-5 (kjemisk og biologisk helsefare). Per Q-B and Q-C the user
-- accepted including brannvernrunde and maskinsikkerhet-sjekk in the
-- AML pack now even though brann- og eksplosjonsvernloven and
-- arbeidsutstyrsforskriften will eventually land in their own packs;
-- the templates can be re-tagged then without data loss.
--
-- New templates (all review_status='draft', AML pack):
--   brannvernrunde         (kvartalsvis, AML §4-4)
--   ergonomi-runde         (halvårlig,  AML §4-4 (2) c)
--   maskinsikkerhet-sjekk  (månedlig,   AML §4-4 (1))
--   stoffkartotek-runde    (årlig,      AML §4-5)
--
-- All four are bruks-avhengige — orgs without machinery, chemicals
-- or production environments simply set is_active=false. Brannvern
-- is universally relevant (any premises) so it's nav_pinned by default;
-- the others are off the sidebar by default.

create or replace function public._provision_compliance_aml_fysisk(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ── brannvernrunde ───────────────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'brannvernrunde',
    'Brannvernrunde',
    'Kvartalsvis kontroll av rømningsveier, slokkemidler, branninstruks og samlingsplass (AML §4-4 + Forskrift om brannforebygging).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','roemningsveier_frie',
                         'prompt','Er rømningsveier frie og merkede?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-4','severity_default','critical'),
      jsonb_build_object('key','slokkemidler_tilgjengelig',
                         'prompt','Er slokkemidler tilgjengelig og kontrollert?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-4','severity_default','critical'),
      jsonb_build_object('key','branninstruks_synlig',
                         'prompt','Er branninstruks tydelig oppslått?',
                         'type','yes_no_na','required',true,
                         'severity_default','high'),
      jsonb_build_object('key','samlingsplass_kjent',
                         'prompt','Vet ansatte hvor samlingsplassen er?',
                         'type','yes_no_na','required',true,
                         'severity_default','high'),
      jsonb_build_object('key','siste_oevelse',
                         'prompt','Når ble siste branntestøvelse gjennomført? (dd.mm.åååå)',
                         'type','text','required',true),
      jsonb_build_object('key','foto_avvik',
                         'prompt','Bilder av eventuelle avvik',
                         'type','photo','required',false),
      jsonb_build_object('key','signatur',
                         'prompt','Verneombudets signatur',
                         'type','signature','required',true,'law_ref','AML §6-2')
    )),
    true, true, true, 'draft', 'kvartalsvis'
  ) on conflict (organization_id, slug) do nothing;

  -- ── ergonomi-runde ───────────────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'ergonomi-runde',
    'Ergonomi-runde',
    'Halvårlig vurdering av arbeidsstillinger, tunge løft, gjentakende bevegelser og hjelpemidler (AML §4-4 (2) c).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','arbeidsstilling',
                         'prompt','Er arbeidsstillingen vurdert som forsvarlig?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-4 (2) c','severity_default','medium'),
      jsonb_build_object('key','tunge_loft',
                         'prompt','Forekommer tunge løft som ikke er risikovurdert?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-4 (2) c','severity_default','high'),
      jsonb_build_object('key','gjentakende_bevegelser',
                         'prompt','Er gjentakende bevegelser identifisert og dempet?',
                         'type','yes_no_na','required',false,
                         'severity_default','medium'),
      jsonb_build_object('key','hjelpemidler_tilgjengelig',
                         'prompt','Er ergonomiske hjelpemidler tilgjengelig der det trengs?',
                         'type','yes_no_na','required',false,
                         'severity_default','medium'),
      jsonb_build_object('key','pauser_tilrettelagt',
                         'prompt','Er pauser og rotering tilstrekkelig?',
                         'type','yes_no_na','required',false,
                         'severity_default','low'),
      jsonb_build_object('key','tiltak_foreslaatt',
                         'prompt','Forslag til ergonomiske tiltak',
                         'type','text','required',false)
    )),
    true, false, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- ── maskinsikkerhet-sjekk ────────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'maskinsikkerhet-sjekk',
    'Maskinsikkerhet-sjekk',
    'Periodisk kontroll av maskinsikkerhet — verneanordninger, nødstopp, dokumentasjon, vedlikehold (AML §4-4 (1) + Arbeidsutstyrsforskriften).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','maskin_id',
                         'prompt','Hvilken maskin / utstyr er kontrollert? (ID eller navn)',
                         'type','text','required',true),
      jsonb_build_object('key','verneanordning_funksjon',
                         'prompt','Fungerer verneanordninger som forutsatt?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-4 (1)','severity_default','critical'),
      jsonb_build_object('key','noedstopp_test',
                         'prompt','Er nødstopp testet og responderer?',
                         'type','yes_no_na','required',true,
                         'severity_default','critical'),
      jsonb_build_object('key','dokumentasjon_oppdatert',
                         'prompt','Er bruksanvisning og samsvarserklæring tilgjengelig?',
                         'type','yes_no_na','required',true,
                         'severity_default','high'),
      jsonb_build_object('key','vedlikehold_journal',
                         'prompt','Er siste vedlikehold dokumentert?',
                         'type','yes_no_na','required',true,
                         'severity_default','medium'),
      jsonb_build_object('key','foto',
                         'prompt','Bilder av kontrollert utstyr',
                         'type','photo','required',false),
      jsonb_build_object('key','signatur',
                         'prompt','Inspektørens signatur',
                         'type','signature','required',true)
    )),
    true, false, true, 'draft', 'månedlig'
  ) on conflict (organization_id, slug) do nothing;

  -- ── stoffkartotek-runde ──────────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'stoffkartotek-runde',
    'Stoffkartotek-runde',
    'Årlig kontroll av stoffkartotek, merking, oppbevaring, verneutstyr og risikovurdering for kjemikalier (AML §4-5 + Stoffkartotekforskriften).',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','stoffkartotek_oppdatert',
                         'prompt','Er stoffkartoteket oppdatert siste 12 mnd?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-5','severity_default','high'),
      jsonb_build_object('key','merking_korrekt',
                         'prompt','Er kjemikalier korrekt merket (CLP)?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-5','severity_default','critical'),
      jsonb_build_object('key','oppbevaring_forsvarlig',
                         'prompt','Er oppbevaring og separasjon forsvarlig?',
                         'type','yes_no_na','required',true,
                         'severity_default','critical'),
      jsonb_build_object('key','verneutstyr_dedikert',
                         'prompt','Er dedikert verneutstyr for kjemikaliebruk tilgjengelig?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §3-2 (1) a','severity_default','critical'),
      jsonb_build_object('key','risikovurdering_pr_stoff',
                         'prompt','Er risikovurdering gjort for hvert farlig stoff?',
                         'type','yes_no_na','required',true,
                         'law_ref','IK-forskriften §5 nr. 6','severity_default','high'),
      jsonb_build_object('key','eksponeringsmaling',
                         'prompt','Er eksponeringsmålinger gjennomført der pålagt?',
                         'type','yes_no_na','required',false,
                         'severity_default','high'),
      jsonb_build_object('key','foto',
                         'prompt','Bilder fra runden',
                         'type','photo','required',false),
      jsonb_build_object('key','signatur',
                         'prompt','Verneombud + HMS-leder signatur',
                         'type','signature','required',true)
    )),
    true, false, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- ── Per-template explicit requirement tags ───────────────────────────
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

-- ── Master function: add the new helper to AML dispatch ────────────────
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
  elsif p_pack_slug = 'iso-45001' then
    perform public._provision_compliance_iso_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- Backfill: idempotent re-run for existing orgs.
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
