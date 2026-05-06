-- Compliance template batch 4: Psykososialt + verneombud
--
-- Final batch in the AML coverage sweep. Adds two AML-pack templates
-- that complete the dossier's checklist mapping.
--
-- New templates (review_status='draft', AML pack):
--   psykososial-pulsmaling   (halvårlig, AML §4-3)
--   verneombud-arsrapport    (årlig,     AML §6-2)
--
-- After this batch, the AML pack ships with 11 baseline templates:
--   vernerunde-standard, avviksoppfolging-runde,
--   internkontroll-arsgjennomgang, onboarding-hms-opplaering,
--   arbeidsgivers-hms-opplaering, tilsetting-mindrearig-sjekk,
--   arbeidsavtale-sjekk, brannvernrunde, ergonomi-runde,
--   maskinsikkerhet-sjekk, stoffkartotek-runde, psykososial-pulsmaling,
--   verneombud-arsrapport.
-- (12 total per dossier, plus the existing baseline = 13 AML templates.)

create or replace function public._provision_compliance_aml_psyk_vo(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ── psykososial-pulsmaling ───────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'psykososial-pulsmaling',
    'Psykososial pulsmåling',
    'Halvårlig pulsmåling av psykososiale forhold (AML §4-3). Supplerer anonym survey for ikke-observable forhold.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','trakassering_observert',
                         'prompt','Er det observert eller meldt om trakassering eller utilbørlig opptreden?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-3 (3)','severity_default','critical'),
      jsonb_build_object('key','arbeidsbelastning_balansert',
                         'prompt','Oppleves arbeidsbelastningen som forsvarlig?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §4-3','severity_default','high'),
      jsonb_build_object('key','ledelse_dialog',
                         'prompt','Har de ansatte regelmessig dialog med leder om arbeidssituasjon?',
                         'type','yes_no_na','required',false,
                         'severity_default','medium'),
      jsonb_build_object('key','inkluderende_kultur',
                         'prompt','Oppleves arbeidsmiljøet som inkluderende?',
                         'type','yes_no_na','required',false,
                         'severity_default','medium'),
      jsonb_build_object('key','aapne_temaer',
                         'prompt','Hvilke psykososiale temaer er aktive nå? (Skriv ikke personidentifiserende helseopplysninger.)',
                         'type','text','required',false),
      jsonb_build_object('key','signatur_verneombud',
                         'prompt','Verneombudets signatur',
                         'type','signature','required',true,
                         'law_ref','AML §6-2')
    )),
    true, false, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- ── verneombud-arsrapport ────────────────────────────────────────────
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'aml-amu', 'verneombud-arsrapport',
    'Verneombud-årsrapport',
    'Årlig egenrapport fra verneombud om aktiviteter, samarbeid med AMU og egen opplæring (AML §6-2 + §6-5). Inngår som vedlegg til AMU-årsprotokoll.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','runder_gjennomfort',
                         'prompt','Antall vernerunder gjennomført dette året',
                         'type','number','required',true,
                         'law_ref','AML §6-2'),
      jsonb_build_object('key','avvik_meldt',
                         'prompt','Antall avvik meldt fra verneombud',
                         'type','number','required',true,
                         'law_ref','AML §6-2'),
      jsonb_build_object('key','samarbeid_amu',
                         'prompt','Er saker brakt videre til AMU der det er aktuelt?',
                         'type','yes_no_na','required',false,
                         'law_ref','AML §7-2','severity_default','medium'),
      jsonb_build_object('key','egen_opplaering',
                         'prompt','Er verneombudets opplæring oppdatert?',
                         'type','yes_no_na','required',true,
                         'law_ref','AML §6-5','severity_default','high'),
      jsonb_build_object('key','kommentar',
                         'prompt','Verneombudets kommentarer til arbeidsmiljøåret',
                         'type','text','required',false),
      jsonb_build_object('key','signatur_verneombud',
                         'prompt','Verneombudets signatur',
                         'type','signature','required',true,
                         'law_ref','AML §6-2'),
      jsonb_build_object('key','signatur_dagligleder',
                         'prompt','Daglig leders bekreftelse',
                         'type','signature','required',true)
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- ── Per-template explicit requirement tags ───────────────────────────
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
