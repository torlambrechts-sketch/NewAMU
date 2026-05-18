-- ISO 14001:2015 — compliance pack seed, provision helper, and updated dispatcher.
--
-- Gap closed: ISO 14001:2015 §9.2 requires a documented EMS internal audit
-- programme covering all clauses. Audit templates must address environmental
-- aspects (§6.1.2), legal obligations (§6.1.3) and operational control (§8.1).
--
-- Self-audit (ISO 14001 certification readiness):
--   Addressed: 7 clause-grouped templates covering Harmonized Structure §4–10;
--   system requirements for all clause groups; category "Internrevisjon (miljø)".
--   Restrisiko deferred: per-aspect audit templates tying HIRA register to
--   checklist items (Phase 3), automated compliance evaluation reminder workflow.
--
-- is_active = FALSE for existing orgs. Activated from Innstillinger → Pakker.
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
      v_org.id, 'iso-14001',
      'ISO 14001',
      'Internrevisjoner (miljø)',
      'Ny miljørevisjon',
      'Internrevisjon mot ISO 14001:2015 for miljøstyringssystem (EMS). Dekker alle klausuler i Harmonized Structure (kl. 4–10).',
      jsonb_build_array(
        jsonb_build_object('code','ISO 14001:2015 § 9.2','text','Internrevisjon — krav til revisjonsprogramme'),
        jsonb_build_object('code','ISO 14001:2015 § 6.1.2','text','Miljøaspekter og -påvirkninger'),
        jsonb_build_object('code','ISO 14001:2015 § 6.1.3','text','Bindende forpliktelser (lov- og kravregister)')
      ),
      jsonb_build_object('open','Pågående revisjoner','critical','Major NC','ytd','Fullførte i år'),
      jsonb_build_object('critical','Major NC','high','Major NC','medium','Minor NC','low','Observasjon'),
      35,
      false
    ) on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ── 2. Provision helper: _provision_compliance_iso_14001_baseline ─────────────

create or replace function public._provision_compliance_iso_14001_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- Template 1: Context (4.1–4.4)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-context',
    'ISO 14001 — Kontekst (kl. 4)',
    'Revisjon av organisasjonens miljøkontekst, interessenter og EMS-virkeområde.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','context_4_1','prompt','Er interne og eksterne faktorer som påvirker EMS identifisert og dokumentert?',
        'type','yes_no_na','required',true,'iso_clause','4.1','severity_default','medium'),
      jsonb_build_object('key','stakeholders_4_2','prompt','Er interesseparter og deres bindende forpliktelser kartlagt?',
        'type','yes_no_na','required',true,'iso_clause','4.2','severity_default','medium'),
      jsonb_build_object('key','scope_4_3','prompt','Er EMS-virkeområdet og grenser dokumentert og vedlikeholdt?',
        'type','yes_no_na','required',true,'iso_clause','4.3','severity_default','high'),
      jsonb_build_object('key','ems_4_4','prompt','Er EMS etablert, implementert og kontinuerlig forbedret i henhold til klausul 4.4?',
        'type','yes_no_na','required',true,'iso_clause','4.4','severity_default','high'),
      jsonb_build_object('key','notes_4','prompt','Revisors notater (kl. 4)','type','text','required',false,'iso_clause','4')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 2: Leadership (5.1–5.2)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-leadership',
    'ISO 14001 — Lederskap (kl. 5)',
    'Revisjon av ledelsesforpliktelse og miljøpolicy.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','leadership_5_1','prompt','Demonstrerer toppledelsen lederskap og forpliktelse til EMS?',
        'type','yes_no_na','required',true,'iso_clause','5.1','severity_default','high'),
      jsonb_build_object('key','policy_5_2','prompt','Er miljøpolicyen dokumentert, kommunisert, tilgjengelig for interesseparter og gjennomgått?',
        'type','yes_no_na','required',true,'iso_clause','5.2','severity_default','high'),
      jsonb_build_object('key','notes_5','prompt','Revisors notater (kl. 5)','type','text','required',false,'iso_clause','5')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 3: Planning — aspects, obligations, objectives (6.1–6.2)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-planning',
    'ISO 14001 — Planlegging (kl. 6)',
    'Revisjon av miljøaspekter, bindende forpliktelser, risikoer/muligheter og miljømål.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','aspects_6_1_2','prompt','Er signifikante miljøaspekter identifisert, vurdert og holdt oppdatert (kl. 6.1.2)?',
        'type','yes_no_na','required',true,'iso_clause','6.1.2','severity_default','critical'),
      jsonb_build_object('key','legal_6_1_3','prompt','Er lov- og kravregister komplett, oppdatert og gjennomgått for etterlevelse?',
        'type','yes_no_na','required',true,'iso_clause','6.1.3','severity_default','critical'),
      jsonb_build_object('key','risks_6_1_4','prompt','Er risikoer og muligheter knyttet til miljøaspekter og forpliktelser vurdert?',
        'type','yes_no_na','required',true,'iso_clause','6.1.4','severity_default','high'),
      jsonb_build_object('key','objectives_6_2','prompt','Er miljømål etablert, SMART-formulerte, kommunisert og rapportert?',
        'type','yes_no_na','required',true,'iso_clause','6.2','severity_default','high'),
      jsonb_build_object('key','notes_6','prompt','Revisors notater (kl. 6)','type','text','required',false,'iso_clause','6')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 4: Support (7.1–7.5)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-support',
    'ISO 14001 — Støtte (kl. 7)',
    'Revisjon av ressurser, miljøkompetanse, bevissthet, kommunikasjon og dokumentasjon.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','competence_7_2','prompt','Er kompetanse knyttet til signifikante miljøaspekter definert og sikret?',
        'type','yes_no_na','required',true,'iso_clause','7.2','severity_default','high'),
      jsonb_build_object('key','awareness_7_3','prompt','Er personell bevisst på miljøpolicyen, signifikante aspekter og sin rolle i EMS?',
        'type','yes_no_na','required',true,'iso_clause','7.3','severity_default','medium'),
      jsonb_build_object('key','external_comm_7_4','prompt','Er ekstern kommunikasjon om EMS planlagt og gjennomført som besluttet?',
        'type','yes_no_na','required',true,'iso_clause','7.4','severity_default','medium'),
      jsonb_build_object('key','documented_7_5','prompt','Er all dokumentert informasjon påkrevd av ISO 14001 tilgjengelig og kontrollert?',
        'type','yes_no_na','required',true,'iso_clause','7.5','severity_default','high'),
      jsonb_build_object('key','notes_7','prompt','Revisors notater (kl. 7)','type','text','required',false,'iso_clause','7')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 5: Operations (8.1–8.2)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-operations',
    'ISO 14001 — Drift (kl. 8)',
    'Revisjon av operativ kontroll og beredskap knyttet til signifikante miljøaspekter.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','ops_8_1','prompt','Er operativ planlegging og kontroll etablert for signifikante miljøaspekter og leverandørers prosesser?',
        'type','yes_no_na','required',true,'iso_clause','8.1','severity_default','high'),
      jsonb_build_object('key','emergency_8_2','prompt','Er beredskapsplaner for potensielle miljønødsituasjoner etablert og testet?',
        'type','yes_no_na','required',true,'iso_clause','8.2','severity_default','critical'),
      jsonb_build_object('key','lifecycle_8_1','prompt','Er miljøhensyn integrert i produktdesign, anskaffelse og avfallshåndtering (livsløpsperspektiv)?',
        'type','yes_no_na','required',true,'iso_clause','8.1','severity_default','medium'),
      jsonb_build_object('key','notes_8','prompt','Revisors notater (kl. 8)','type','text','required',false,'iso_clause','8')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 6: Performance evaluation (9.1–9.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-performance',
    'ISO 14001 — Evalueringsrevisjon (kl. 9)',
    'Revisjon av miljøovervåking, etterlevingsevaluering og ledelsens gjennomgang.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','monitoring_9_1','prompt','Er overvåking og måling av EMS-ytelse (inkl. energi, utslipp, avfall) systematisk gjennomført?',
        'type','yes_no_na','required',true,'iso_clause','9.1','severity_default','high'),
      jsonb_build_object('key','compliance_eval_9_1_2','prompt','Evalueres etterlevelse av bindende forpliktelser systematisk og med dokumenterte resultater?',
        'type','yes_no_na','required',true,'iso_clause','9.1.2','severity_default','critical'),
      jsonb_build_object('key','internal_audit_9_2','prompt','Gjennomføres internrevisjon av EMS etter plan med kompetente revisorer?',
        'type','yes_no_na','required',true,'iso_clause','9.2','severity_default','critical'),
      jsonb_build_object('key','mgmt_review_9_3','prompt','Gjennomfører ledelsen formell EMS-gjennomgang med alle påkrevde inndata?',
        'type','yes_no_na','required',true,'iso_clause','9.3','severity_default','high'),
      jsonb_build_object('key','notes_9','prompt','Revisors notater (kl. 9)','type','text','required',false,'iso_clause','9'),
      jsonb_build_object('key','auditor_signature','prompt','Revisors signatur','type','signature','required',true,'iso_clause','9.2')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 7: Improvement (10.1–10.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-14001', 'iso-14001-improvement',
    'ISO 14001 — Forbedring (kl. 10)',
    'Revisjon av avviksbehandling, korrigerende tiltak og kontinuerlig forbedring av EMS.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','nc_10_2','prompt','Håndteres avvik og NC-er med rotårsaksanalyse og dokumenterte korrigerende tiltak?',
        'type','yes_no_na','required',true,'iso_clause','10.2','severity_default','critical'),
      jsonb_build_object('key','continual_10_3','prompt','Kan organisasjonen demonstrere kontinuerlig forbedring av EMS-egnethet og -effektivitet?',
        'type','text','required',true,'iso_clause','10.3','severity_default','medium'),
      jsonb_build_object('key','notes_10','prompt','Revisors notater (kl. 10)','type','text','required',false,'iso_clause','10')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- System requirements
  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null,'iso-14001','iso-14001-4','ISO 14001:2015 § 4','Kontekst av organisasjonen','Klausul 4.1-4.4.',true,true),
    (null,'iso-14001','iso-14001-5','ISO 14001:2015 § 5','Lederskap','Klausul 5.1-5.2: Ledelsesforpliktelse og miljøpolicy.',true,true),
    (null,'iso-14001','iso-14001-6','ISO 14001:2015 § 6','Planlegging','Klausul 6.1-6.2: Aspekter, forpliktelser, risikoer, mål.',true,true),
    (null,'iso-14001','iso-14001-7','ISO 14001:2015 § 7','Støtte','Klausul 7.1-7.5: Ressurser, kompetanse, dokumentasjon.',true,true),
    (null,'iso-14001','iso-14001-8','ISO 14001:2015 § 8','Drift','Klausul 8.1-8.2: Operativ kontroll og beredskap.',true,true),
    (null,'iso-14001','iso-14001-9','ISO 14001:2015 § 9','Evaluering av ytelse','Klausul 9.1-9.3: Overvåking, etterlevingsevaluering, ledelsens gjennomgang.',true,true),
    (null,'iso-14001','iso-14001-10','ISO 14001:2015 § 10','Forbedring','Klausul 10.1-10.3: Avvik og korrigerende tiltak.',true,true)
  on conflict (pack, slug) where organization_id is null do nothing;

  -- Link templates to requirements
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r
    on r.organization_id is null and r.pack = 'iso-14001'
  where t.organization_id = p_org_id and t.pack = 'iso-14001' and t.deleted_at is null
    and (
      (t.slug = 'iso-14001-context'     and r.slug = 'iso-14001-4') or
      (t.slug = 'iso-14001-leadership'  and r.slug = 'iso-14001-5') or
      (t.slug = 'iso-14001-planning'    and r.slug = 'iso-14001-6') or
      (t.slug = 'iso-14001-support'     and r.slug = 'iso-14001-7') or
      (t.slug = 'iso-14001-operations'  and r.slug = 'iso-14001-8') or
      (t.slug = 'iso-14001-performance' and r.slug = 'iso-14001-9') or
      (t.slug = 'iso-14001-improvement' and r.slug = 'iso-14001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_14001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_14001_baseline(uuid) to authenticated, service_role;

-- ── 3. Extend master dispatcher ───────────────────────────────────────────────

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
  elsif p_pack_slug = 'iso-14001' then
    perform public._provision_compliance_iso_14001_baseline(p_org_id);
  -- iso-27001 branch added in subsequent migration
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ── 4. Extend trigger to include iso-14001 category ──────────────────────────

create or replace function public.compliance_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and old.is_active = false) then
      perform public.provision_compliance_baseline_for_org(new.organization_id, new.slug);

      if new.slug = 'aml-amu' then
        insert into public.compliance_checklist_categories
          (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'aml-amu','vernerunder','Vernerunder','Standard runder etter arbeidsmiljøloven og internkontrollforskriften.',10,true),
          (new.organization_id,'aml-amu','fysisk','Fysisk og kjemisk arbeidsmiljø','Brann, ergonomi, maskiner og kjemikalier.',20,true),
          (new.organization_id,'aml-amu','internkontroll','Internkontroll og avvik','Avviksoppfølging og årlig systemgjennomgang.',30,true),
          (new.organization_id,'aml-amu','ansettelse','Ansettelse og opplæring','Onboarding, mindreårige, arbeidsavtale og leder-HMS.',40,true),
          (new.organization_id,'aml-amu','psykososialt','Psykososialt og verneombud','Psykososial pulsmåling og verneombud-årsrapport.',50,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-45001' then
        insert into public.compliance_checklist_categories
          (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-45001','internrevisjon','Internrevisjon','Revisjon mot ISO 45001 — klausul 9.2.',10,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-9001' then
        insert into public.compliance_checklist_categories
          (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-9001','internrevisjon','Internrevisjon (kvalitet)','Klausulvise revisjoner mot ISO 9001:2015.',10,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-14001' then
        insert into public.compliance_checklist_categories
          (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-14001','internrevisjon','Internrevisjon (miljø)','Klausulvise revisjoner mot ISO 14001:2015.',10,true)
        on conflict (organization_id,pack,slug) do nothing;
      -- iso-27001 added in next migration
      end if;

      declare
        v_cat_id uuid;
      begin
        select id into v_cat_id
          from public.compliance_checklist_categories
          where organization_id = new.organization_id
            and pack = new.slug
            and slug = 'internrevisjon';
        if v_cat_id is not null then
          update public.compliance_checklist_templates
            set category_id = v_cat_id
            where organization_id = new.organization_id
              and pack = new.slug
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
