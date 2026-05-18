-- ISO 27001:2022 — compliance pack seed, provision helper, and final dispatcher.
--
-- Gap closed: ISO 27001:2022 §9.2 requires a documented ISMS internal audit
-- programme. Templates must cover §6 (risk assessment + SoA), §8 (operations +
-- risk treatment), §9 (performance) and §10 (improvement).
--
-- Self-audit (ISO 27001 certification readiness):
--   Addressed: 7 clause-grouped templates; system requirements for all clause
--   groups; category "Internrevisjon (ISMS)". Annex A control implementation
--   is tracked separately via the SoA table (20260914100003).
--   Restrisiko deferred: per-control audit templates tied to SoA (Phase 3),
--   automated penetration test result linkage.
--
-- is_active = FALSE for existing orgs. This is the final migration that
-- completes the dispatcher and trigger for all 5 packs (aml-amu, iso-45001,
-- iso-9001, iso-14001, iso-27001).
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
      v_org.id, 'iso-27001',
      'ISO 27001',
      'Internrevisjoner (ISMS)',
      'Ny ISMS-revisjon',
      'Internrevisjon mot ISO 27001:2022 for informasjonssikkerhetsstyringssystem (ISMS). Dekker alle klausuler og refererer til Annex A Statement of Applicability.',
      jsonb_build_array(
        jsonb_build_object('code','ISO 27001:2022 § 9.2','text','Internrevisjon — revisjonsprogramme og prosedyre'),
        jsonb_build_object('code','ISO 27001:2022 § 6.1.3','text','Informasjonssikkerhetsrisiko — Statement of Applicability'),
        jsonb_build_object('code','ISO 27001:2022 § 8.3','text','Informasjonssikkerhetsrisikobehandling')
      ),
      jsonb_build_object('open','Pågående revisjoner','critical','Major NC','ytd','Fullførte i år'),
      jsonb_build_object('critical','Major NC','high','Major NC','medium','Minor NC','low','Observasjon'),
      40,
      false
    ) on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ── 2. Provision helper: _provision_compliance_iso_27001_baseline ─────────────

create or replace function public._provision_compliance_iso_27001_baseline(p_org_id uuid)
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
    p_org_id, 'iso-27001', 'iso-27001-context',
    'ISO 27001 — Kontekst (kl. 4)',
    'Revisjon av organisasjonens ISMS-kontekst, interessenter og virkeområde.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','context_4_1','prompt','Er interne/eksterne faktorer som påvirker ISMS identifisert (trusselbilde, regulatorisk, organisatorisk)?',
        'type','yes_no_na','required',true,'iso_clause','4.1','severity_default','medium'),
      jsonb_build_object('key','stakeholders_4_2','prompt','Er interesseparter og deres krav til informasjonssikkerhet kartlagt?',
        'type','yes_no_na','required',true,'iso_clause','4.2','severity_default','high'),
      jsonb_build_object('key','scope_4_3','prompt','Er ISMS-virkeområdet dokumentert med grenser og grensesnitt?',
        'type','yes_no_na','required',true,'iso_clause','4.3','severity_default','high'),
      jsonb_build_object('key','isms_4_4','prompt','Er ISMS etablert, implementert, vedlikeholdt og kontinuerlig forbedret?',
        'type','yes_no_na','required',true,'iso_clause','4.4','severity_default','high'),
      jsonb_build_object('key','notes_4','prompt','Revisors notater (kl. 4)','type','text','required',false,'iso_clause','4')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 2: Leadership (5.1–5.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-leadership',
    'ISO 27001 — Lederskap (kl. 5)',
    'Revisjon av ledelsesforpliktelse, IS-policy og roller/ansvar.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','leadership_5_1','prompt','Demonstrerer toppledelsen lederskap til ISMS — stiller ressurser og setter mål?',
        'type','yes_no_na','required',true,'iso_clause','5.1','severity_default','high'),
      jsonb_build_object('key','policy_5_2','prompt','Er IS-policyen dokumentert, kommunisert og gjennomgått regelmessig?',
        'type','yes_no_na','required',true,'iso_clause','5.2','severity_default','high'),
      jsonb_build_object('key','roles_5_3','prompt','Er roller og ansvar for ISMS tydelig definert (inkl. CISO/IS-ansvarlig)?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','medium'),
      jsonb_build_object('key','notes_5','prompt','Revisors notater (kl. 5)','type','text','required',false,'iso_clause','5')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 3: Planning — risk + SoA (6.1–6.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-planning',
    'ISO 27001 — Planlegging og risikovurdering (kl. 6)',
    'Revisjon av IS-risikovurdering, SoA og IS-mål.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','risk_process_6_1_2','prompt','Er IS-risikovurderingsprosessen definert med akseptansekriterier og risikoidentifikasjon?',
        'type','yes_no_na','required',true,'iso_clause','6.1.2','severity_default','critical'),
      jsonb_build_object('key','soa_6_1_3','prompt','Er Statement of Applicability oppdatert med alle 93 Annex A-kontroller, begrunnelse for unntak og implementeringsstatus?',
        'type','yes_no_na','required',true,'iso_clause','6.1.3','severity_default','critical'),
      jsonb_build_object('key','treatment_plan_6_1_3','prompt','Er risikobehandlingsplan godkjent av risikoeiere og koblet til SoA?',
        'type','yes_no_na','required',true,'iso_clause','6.1.3','severity_default','critical'),
      jsonb_build_object('key','objectives_6_2','prompt','Er IS-mål etablert, målbare og kommunisert?',
        'type','yes_no_na','required',true,'iso_clause','6.2','severity_default','high'),
      jsonb_build_object('key','notes_6','prompt','Revisors notater (kl. 6)','type','text','required',false,'iso_clause','6')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 4: Support (7.1–7.5)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-support',
    'ISO 27001 — Støtte (kl. 7)',
    'Revisjon av kompetanse, bevissthet, kommunikasjon og dokumentasjon.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','competence_7_2','prompt','Er IS-kompetansekrav definert og bekreftet for nøkkelroller?',
        'type','yes_no_na','required',true,'iso_clause','7.2','severity_default','high'),
      jsonb_build_object('key','awareness_7_3','prompt','Er IS-bevissthetsprogram gjennomført og dokumentert (A.6.3)?',
        'type','yes_no_na','required',true,'iso_clause','7.3','severity_default','high'),
      jsonb_build_object('key','documented_7_5','prompt','Er all dokumentert informasjon påkrevd av ISO 27001 tilgjengelig og kontrollert?',
        'type','yes_no_na','required',true,'iso_clause','7.5','severity_default','high'),
      jsonb_build_object('key','notes_7','prompt','Revisors notater (kl. 7)','type','text','required',false,'iso_clause','7')
    )),
    true, true, true, 'draft', 'årlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 5: Operations (8.1–8.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-operations',
    'ISO 27001 — Drift og risikobehandling (kl. 8)',
    'Revisjon av operativ IS-kontroll, risikovurdering og risikobehandling.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','ops_8_1','prompt','Er operativ planlegging og kontroll av ISMS implementert og overvåket?',
        'type','yes_no_na','required',true,'iso_clause','8.1','severity_default','high'),
      jsonb_build_object('key','risk_assessment_8_2','prompt','Er IS-risikovurdering gjennomført med planlagte intervaller eller ved vesentlige endringer?',
        'type','yes_no_na','required',true,'iso_clause','8.2','severity_default','critical'),
      jsonb_build_object('key','treatment_8_3','prompt','Er IS-risikobehandlingsplan implementert og implementeringen dokumentert?',
        'type','yes_no_na','required',true,'iso_clause','8.3','severity_default','critical'),
      jsonb_build_object('key','notes_8','prompt','Revisors notater (kl. 8)','type','text','required',false,'iso_clause','8')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 6: Performance evaluation (9.1–9.3)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-performance',
    'ISO 27001 — Evalueringsrevisjon (kl. 9)',
    'Revisjon av IS-overvåking, internrevisjon og ledelsens ISMS-gjennomgang.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','monitoring_9_1','prompt','Er overvåking og måling av ISMS-ytelse (inkl. hendelsesmålinger og KPI) gjennomført?',
        'type','yes_no_na','required',true,'iso_clause','9.1','severity_default','high'),
      jsonb_build_object('key','internal_audit_9_2','prompt','Gjennomføres ISMS internrevisjon etter plan med kompetente revisorer og dokumenterte funn?',
        'type','yes_no_na','required',true,'iso_clause','9.2','severity_default','critical'),
      jsonb_build_object('key','mgmt_review_9_3','prompt','Gjennomfører ledelsen formell ISMS-gjennomgang med alle påkrevde inndata og beslutninger dokumentert?',
        'type','yes_no_na','required',true,'iso_clause','9.3','severity_default','high'),
      jsonb_build_object('key','notes_9','prompt','Revisors notater (kl. 9)','type','text','required',false,'iso_clause','9'),
      jsonb_build_object('key','auditor_signature','prompt','Revisors signatur','type','signature','required',true,'iso_clause','9.2')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- Template 7: Improvement (10.1–10.2)
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint
  ) values (
    p_org_id, 'iso-27001', 'iso-27001-improvement',
    'ISO 27001 — Forbedring (kl. 10)',
    'Revisjon av avviksbehandling, korrigerende tiltak og kontinuerlig forbedring av ISMS.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','nc_10_1','prompt','Håndteres avvik og NC-er med rotårsaksanalyse og dokumenterte korrigerende tiltak?',
        'type','yes_no_na','required',true,'iso_clause','10.1','severity_default','critical'),
      jsonb_build_object('key','continual_10_2','prompt','Kan organisasjonen demonstrere kontinuerlig forbedring av ISMS-egnethet og -effektivitet?',
        'type','text','required',true,'iso_clause','10.2','severity_default','medium'),
      jsonb_build_object('key','notes_10','prompt','Revisors notater (kl. 10)','type','text','required',false,'iso_clause','10')
    )),
    true, true, true, 'draft', 'halvårlig'
  ) on conflict (organization_id, slug) do nothing;

  -- System requirements
  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null,'iso-27001','iso-27001-4','ISO 27001:2022 § 4','Kontekst av organisasjonen','Klausul 4.1-4.4.',true,true),
    (null,'iso-27001','iso-27001-5','ISO 27001:2022 § 5','Lederskap','Klausul 5.1-5.3.',true,true),
    (null,'iso-27001','iso-27001-6','ISO 27001:2022 § 6','Planlegging','Klausul 6.1-6.3: Risiko, SoA og IS-mål.',true,true),
    (null,'iso-27001','iso-27001-7','ISO 27001:2022 § 7','Støtte','Klausul 7.1-7.5.',true,true),
    (null,'iso-27001','iso-27001-8','ISO 27001:2022 § 8','Drift','Klausul 8.1-8.3: Operativ kontroll og risikobehandling.',true,true),
    (null,'iso-27001','iso-27001-9','ISO 27001:2022 § 9','Evaluering av ytelse','Klausul 9.1-9.3.',true,true),
    (null,'iso-27001','iso-27001-10','ISO 27001:2022 § 10','Forbedring','Klausul 10.1-10.2.',true,true)
  on conflict (pack, slug) where organization_id is null do nothing;

  -- Link templates to requirements
  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r
    on r.organization_id is null and r.pack = 'iso-27001'
  where t.organization_id = p_org_id and t.pack = 'iso-27001' and t.deleted_at is null
    and (
      (t.slug = 'iso-27001-context'     and r.slug = 'iso-27001-4') or
      (t.slug = 'iso-27001-leadership'  and r.slug = 'iso-27001-5') or
      (t.slug = 'iso-27001-planning'    and r.slug = 'iso-27001-6') or
      (t.slug = 'iso-27001-support'     and r.slug = 'iso-27001-7') or
      (t.slug = 'iso-27001-operations'  and r.slug = 'iso-27001-8') or
      (t.slug = 'iso-27001-performance' and r.slug = 'iso-27001-9') or
      (t.slug = 'iso-27001-improvement' and r.slug = 'iso-27001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_27001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_27001_baseline(uuid) to authenticated, service_role;

-- ── 3. Final complete master dispatcher (all 5 packs) ─────────────────────────

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
  elsif p_pack_slug = 'iso-27001' then
    perform public._provision_compliance_iso_27001_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ── 4. Final trigger (all 5 packs, category + template assignment) ────────────

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
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'aml-amu','vernerunder','Vernerunder','Standard runder etter arbeidsmiljøloven og internkontrollforskriften.',10,true),
          (new.organization_id,'aml-amu','fysisk','Fysisk og kjemisk arbeidsmiljø','Brann, ergonomi, maskiner og kjemikalier.',20,true),
          (new.organization_id,'aml-amu','internkontroll','Internkontroll og avvik','Avviksoppfølging og årlig systemgjennomgang.',30,true),
          (new.organization_id,'aml-amu','ansettelse','Ansettelse og opplæring','Onboarding, mindreårige, arbeidsavtale og leder-HMS.',40,true),
          (new.organization_id,'aml-amu','psykososialt','Psykososialt og verneombud','Psykososial pulsmåling og verneombud-årsrapport.',50,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-45001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-45001','internrevisjon','Internrevisjon','Revisjon mot ISO 45001 — klausul 9.2.',10,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-9001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-9001','internrevisjon','Internrevisjon (kvalitet)','Klausulvise revisjoner mot ISO 9001:2015.',10,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-14001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-14001','internrevisjon','Internrevisjon (miljø)','Klausulvise revisjoner mot ISO 14001:2015.',10,true)
        on conflict (organization_id,pack,slug) do nothing;

      elsif new.slug = 'iso-27001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system) values
          (new.organization_id,'iso-27001','internrevisjon','Internrevisjon (ISMS)','Klausulvise revisjoner mot ISO 27001:2022.',10,true)
        on conflict (organization_id,pack,slug) do nothing;
      end if;

      -- Assign uncategorised templates to the default category for this pack
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
