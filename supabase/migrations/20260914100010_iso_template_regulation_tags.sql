-- ISO templates: add law_refs + set regulation_id on categories.
--
-- Gap closed: ISO compliance templates had no law_refs[] and their categories
-- had no regulation_id, so the regulation filter could not match ISO 9001/14001/27001
-- templates, and the compliance planner could not find which templates cover which
-- ISO clauses. ISO 27001 was also missing from the regulations table entirely.
--
-- Changes:
--   1. regulations — add iso-27001 row for all existing orgs; update provision fn.
--   2. compliance_checklist_categories — set regulation_id for iso-9001/14001/27001.
--   3. compliance_checklist_templates — set law_refs on all ISO templates.
--   4. _provision_compliance_iso_*_baseline — include law_refs on INSERT so
--      future activations also get tagged.
--   5. compliance_pack_provision_on_change — include regulation_id on category INSERTs.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Add iso-27001 to regulations ──────────────────────────────────────────

insert into public.regulations (
  id, organization_id, name, short_name, description, legal_authority,
  position, is_active, is_system
)
select
  'iso-27001', id,
  'ISO 27001 — Informasjonssikkerhet', 'ISO 27001',
  'Styringssystem for informasjonssikkerhet (ISMS) — risikovurdering, SoA, Annex A.',
  'ISO', 55, true, true
from public.organizations
on conflict (organization_id, id) do nothing;

-- Update provision function to include iso-27001 so new orgs get it on signup.
create or replace function public.provision_regulations_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.regulations (
    id, organization_id, name, short_name, description, legal_authority, position, is_active, is_system
  )
  values
    ('aml',           p_org_id, 'Arbeidsmiljøloven',                             'AML',       'Verneombud, AMU, psykososialt og fysisk arbeidsmiljø.',                           'Arbeidstilsynet',            10, true, true),
    ('ik-f',          p_org_id, 'Internkontrollforskriften',                     'IK-f',      'Systematisk HMS-arbeid, ROS, dokumentasjon og oppfølging.',                       'Arbeidstilsynet',            20, true, true),
    ('iso-9001',      p_org_id, 'ISO 9001 — Kvalitetsledelse',                   'ISO 9001',  'Kvalitetsstyringssystem.',                                                        'ISO',                        30, true, true),
    ('iso-14001',     p_org_id, 'ISO 14001 — Miljøledelse',                      'ISO 14001', 'Miljøstyringssystem.',                                                            'ISO',                        40, true, true),
    ('iso-45001',     p_org_id, 'ISO 45001 — Arbeidsmiljøledelse',               'ISO 45001', 'Arbeidsmiljøstyringssystem.',                                                     'ISO',                        50, true, true),
    ('iso-27001',     p_org_id, 'ISO 27001 — Informasjonssikkerhet',             'ISO 27001', 'Styringssystem for informasjonssikkerhet (ISMS) — risikovurdering, SoA, Annex A.','ISO',                        55, true, true),
    ('apenhetsloven', p_org_id, 'Åpenhetsloven',                                 'Åpenhetsloven','Aktsomhetsvurderinger og leverandørkontroll.',                                 'Forbrukertilsynet',          60, true, true),
    ('gdpr',          p_org_id, 'Personopplysningsloven (GDPR)',                 'GDPR',      'Behandling av personopplysninger.',                                               'Datatilsynet',               70, true, true),
    ('likestilling',  p_org_id, 'Likestillings- og diskrimineringsloven',        'LDL',       'Aktivitets- og redegjørelsesplikten (ARP).',                                      'Diskrimineringsombudet',     80, true, true),
    ('iso-19011',     p_org_id, 'NS-EN ISO 19011 — Revisjon av styringssystem',  'ISO 19011', 'Retningslinjer for revisjon av styringssystem.',                                  'ISO',                        90, true, true)
  on conflict (organization_id, id) do nothing;
end;
$$;

revoke all on function public.provision_regulations_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_regulations_baseline_for_org(uuid) to authenticated, service_role;

-- ── 2. Set regulation_id on existing ISO categories ───────────────────────────
-- iso-45001 already has regulation_id='iso-45001'. Fix the three new packs.

update public.compliance_checklist_categories
  set regulation_id = 'iso-9001'
  where pack = 'iso-9001' and (regulation_id is null or regulation_id = '');

update public.compliance_checklist_categories
  set regulation_id = 'iso-14001'
  where pack = 'iso-14001' and (regulation_id is null or regulation_id = '');

update public.compliance_checklist_categories
  set regulation_id = 'iso-27001'
  where pack = 'iso-27001' and (regulation_id is null or regulation_id = '');

-- ── 3. Backfill law_refs on existing ISO templates ───────────────────────────

-- ISO 9001
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 4']
  where slug = 'iso-9001-context'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 5']
  where slug = 'iso-9001-leadership'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 6']
  where slug = 'iso-9001-planning'    and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 7']
  where slug = 'iso-9001-support'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 8']
  where slug = 'iso-9001-operations'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 9', 'ISO 9001:2015 § 9.2']
  where slug = 'iso-9001-performance' and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 9001:2015 § 10']
  where slug = 'iso-9001-improvement' and deleted_at is null and (law_refs = '{}' or law_refs is null);

-- ISO 14001
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 4']
  where slug = 'iso-14001-context'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 5']
  where slug = 'iso-14001-leadership'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 6']
  where slug = 'iso-14001-planning'    and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 7']
  where slug = 'iso-14001-support'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 8']
  where slug = 'iso-14001-operations'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 9', 'ISO 14001:2015 § 9.2']
  where slug = 'iso-14001-performance' and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 14001:2015 § 10']
  where slug = 'iso-14001-improvement' and deleted_at is null and (law_refs = '{}' or law_refs is null);

-- ISO 27001
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 4']
  where slug = 'iso-27001-context'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 5']
  where slug = 'iso-27001-leadership'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 6']
  where slug = 'iso-27001-planning'    and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 7']
  where slug = 'iso-27001-support'     and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 8']
  where slug = 'iso-27001-operations'  and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 9', 'ISO 27001:2022 § 9.2']
  where slug = 'iso-27001-performance' and deleted_at is null and (law_refs = '{}' or law_refs is null);
update public.compliance_checklist_templates set law_refs = array['ISO 27001:2022 § 10']
  where slug = 'iso-27001-improvement' and deleted_at is null and (law_refs = '{}' or law_refs is null);

-- ISO 45001 (single combined audit template)
update public.compliance_checklist_templates set law_refs = array['ISO 45001:2018 § 9.2']
  where slug = 'iso-45001-internal-audit' and deleted_at is null and (law_refs = '{}' or law_refs is null);

-- ── 4. Update provision functions to include law_refs on future INSERTs ───────

create or replace function public._provision_compliance_iso_9001_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl_id uuid;
begin

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 9001:2015 § 4']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 9001:2015 § 5']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 9001:2015 § 6']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 9001:2015 § 7']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 9001:2015 § 8']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 9001:2015 § 9', 'ISO 9001:2015 § 9.2']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 9001:2015 § 10']
  ) on conflict (organization_id, slug) do nothing;

  -- System requirements
  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null,'iso-9001','iso-9001-4',  'ISO 9001:2015 § 4',  'Kontekst av organisasjonen',
     'Klausul 4.1-4.4: Kontekst, interesseparter, virkeområde og prosesser.', true, true),
    (null,'iso-9001','iso-9001-5',  'ISO 9001:2015 § 5',  'Lederskap',
     'Klausul 5.1-5.3: Lederengasjement, kvalitetspolicy og roller.', true, true),
    (null,'iso-9001','iso-9001-6',  'ISO 9001:2015 § 6',  'Planlegging',
     'Klausul 6.1-6.3: Risiko og muligheter, kvalitetsmål, endringer.', true, true),
    (null,'iso-9001','iso-9001-7',  'ISO 9001:2015 § 7',  'Støtte',
     'Klausul 7.1-7.5: Ressurser, kompetanse, bevissthet, kommunikasjon, dokumentasjon.', true, true),
    (null,'iso-9001','iso-9001-8',  'ISO 9001:2015 § 8',  'Drift',
     'Klausul 8.1-8.7: Operativ planlegging, design, leverandørstyring, produksjon.', true, true),
    (null,'iso-9001','iso-9001-9',  'ISO 9001:2015 § 9',  'Evaluering av ytelse',
     'Klausul 9.1-9.3: Overvåking, internrevisjon, ledelsens gjennomgang.', true, true),
    (null,'iso-9001','iso-9001-10', 'ISO 9001:2015 § 10', 'Forbedring',
     'Klausul 10.1-10.3: Avvik og korrigerende tiltak.', true, true)
  on conflict (pack, slug) where organization_id is null do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r on r.organization_id is null and r.pack = 'iso-9001'
  where t.organization_id = p_org_id and t.pack = 'iso-9001' and t.deleted_at is null
    and (
      (t.slug = 'iso-9001-context'     and r.slug = 'iso-9001-4')  or
      (t.slug = 'iso-9001-leadership'  and r.slug = 'iso-9001-5')  or
      (t.slug = 'iso-9001-planning'    and r.slug = 'iso-9001-6')  or
      (t.slug = 'iso-9001-support'     and r.slug = 'iso-9001-7')  or
      (t.slug = 'iso-9001-operations'  and r.slug = 'iso-9001-8')  or
      (t.slug = 'iso-9001-performance' and r.slug = 'iso-9001-9')  or
      (t.slug = 'iso-9001-improvement' and r.slug = 'iso-9001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_9001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_9001_baseline(uuid) to authenticated, service_role;

-- ── ISO 14001 baseline (with law_refs) ────────────────────────────────────────

create or replace function public._provision_compliance_iso_14001_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 14001:2015 § 4']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 14001:2015 § 5']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 14001:2015 § 6']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 14001:2015 § 7']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 14001:2015 § 8']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 14001:2015 § 9', 'ISO 14001:2015 § 9.2']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 14001:2015 § 10']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null,'iso-14001','iso-14001-4', 'ISO 14001:2015 § 4',  'Kontekst av organisasjonen','Klausul 4.1-4.4.',true,true),
    (null,'iso-14001','iso-14001-5', 'ISO 14001:2015 § 5',  'Lederskap','Klausul 5.1-5.2: Ledelsesforpliktelse og miljøpolicy.',true,true),
    (null,'iso-14001','iso-14001-6', 'ISO 14001:2015 § 6',  'Planlegging','Klausul 6.1-6.2: Aspekter, forpliktelser, risikoer, mål.',true,true),
    (null,'iso-14001','iso-14001-7', 'ISO 14001:2015 § 7',  'Støtte','Klausul 7.1-7.5: Ressurser, kompetanse, dokumentasjon.',true,true),
    (null,'iso-14001','iso-14001-8', 'ISO 14001:2015 § 8',  'Drift','Klausul 8.1-8.2: Operativ kontroll og beredskap.',true,true),
    (null,'iso-14001','iso-14001-9', 'ISO 14001:2015 § 9',  'Evaluering av ytelse','Klausul 9.1-9.3: Overvåking, etterlevingsevaluering, ledelsens gjennomgang.',true,true),
    (null,'iso-14001','iso-14001-10','ISO 14001:2015 § 10', 'Forbedring','Klausul 10.1-10.3: Avvik og korrigerende tiltak.',true,true)
  on conflict (pack, slug) where organization_id is null do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r on r.organization_id is null and r.pack = 'iso-14001'
  where t.organization_id = p_org_id and t.pack = 'iso-14001' and t.deleted_at is null
    and (
      (t.slug = 'iso-14001-context'     and r.slug = 'iso-14001-4')  or
      (t.slug = 'iso-14001-leadership'  and r.slug = 'iso-14001-5')  or
      (t.slug = 'iso-14001-planning'    and r.slug = 'iso-14001-6')  or
      (t.slug = 'iso-14001-support'     and r.slug = 'iso-14001-7')  or
      (t.slug = 'iso-14001-operations'  and r.slug = 'iso-14001-8')  or
      (t.slug = 'iso-14001-performance' and r.slug = 'iso-14001-9')  or
      (t.slug = 'iso-14001-improvement' and r.slug = 'iso-14001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_14001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_14001_baseline(uuid) to authenticated, service_role;

-- ── ISO 27001 baseline (with law_refs) ────────────────────────────────────────

create or replace function public._provision_compliance_iso_27001_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 27001:2022 § 4']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 27001:2022 § 5']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 27001:2022 § 6']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 27001:2022 § 7']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 27001:2022 § 8']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 27001:2022 § 9', 'ISO 27001:2022 § 9.2']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'halvårlig', array['ISO 27001:2022 § 10']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_requirements (
    organization_id, pack, slug, code, title, description, is_system, is_active
  ) values
    (null,'iso-27001','iso-27001-4',  'ISO 27001:2022 § 4',  'Kontekst av organisasjonen','Klausul 4.1-4.4.',true,true),
    (null,'iso-27001','iso-27001-5',  'ISO 27001:2022 § 5',  'Lederskap','Klausul 5.1-5.3.',true,true),
    (null,'iso-27001','iso-27001-6',  'ISO 27001:2022 § 6',  'Planlegging','Klausul 6.1-6.3: Risiko, SoA og IS-mål.',true,true),
    (null,'iso-27001','iso-27001-7',  'ISO 27001:2022 § 7',  'Støtte','Klausul 7.1-7.5.',true,true),
    (null,'iso-27001','iso-27001-8',  'ISO 27001:2022 § 8',  'Drift','Klausul 8.1-8.3: Operativ kontroll og risikobehandling.',true,true),
    (null,'iso-27001','iso-27001-9',  'ISO 27001:2022 § 9',  'Evaluering av ytelse','Klausul 9.1-9.3.',true,true),
    (null,'iso-27001','iso-27001-10', 'ISO 27001:2022 § 10', 'Forbedring','Klausul 10.1-10.2.',true,true)
  on conflict (pack, slug) where organization_id is null do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, p_org_id
  from public.compliance_checklist_templates t
  join public.compliance_requirements r on r.organization_id is null and r.pack = 'iso-27001'
  where t.organization_id = p_org_id and t.pack = 'iso-27001' and t.deleted_at is null
    and (
      (t.slug = 'iso-27001-context'     and r.slug = 'iso-27001-4')  or
      (t.slug = 'iso-27001-leadership'  and r.slug = 'iso-27001-5')  or
      (t.slug = 'iso-27001-planning'    and r.slug = 'iso-27001-6')  or
      (t.slug = 'iso-27001-support'     and r.slug = 'iso-27001-7')  or
      (t.slug = 'iso-27001-operations'  and r.slug = 'iso-27001-8')  or
      (t.slug = 'iso-27001-performance' and r.slug = 'iso-27001-9')  or
      (t.slug = 'iso-27001-improvement' and r.slug = 'iso-27001-10')
    )
  on conflict (template_id, requirement_id) do nothing;

end;
$$;

revoke all on function public._provision_compliance_iso_27001_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_27001_baseline(uuid) to authenticated, service_role;

-- ── ISO 45001 baseline (add law_refs) ─────────────────────────────────────────

create or replace function public._provision_compliance_iso_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
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
    true, true, true, 'draft', 'årlig', array['ISO 45001:2018 § 9.2']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id and t.slug = 'iso-45001-internal-audit' and t.deleted_at is null
    and r.organization_id is null and r.is_active = true and r.pack = 'iso-45001'
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

revoke all on function public._provision_compliance_iso_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_baseline(uuid) to authenticated, service_role;

-- ── 5. Update trigger: add regulation_id to category INSERTs ─────────────────

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
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system,regulation_id) values
          (new.organization_id,'iso-45001','internrevisjon','Internrevisjon','Revisjon mot ISO 45001 — klausul 9.2.',10,true,'iso-45001')
        on conflict (organization_id,pack,slug) do update set regulation_id = excluded.regulation_id;

      elsif new.slug = 'iso-9001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system,regulation_id) values
          (new.organization_id,'iso-9001','internrevisjon','Internrevisjon (kvalitet)','Klausulvise revisjoner mot ISO 9001:2015.',10,true,'iso-9001')
        on conflict (organization_id,pack,slug) do update set regulation_id = excluded.regulation_id;

      elsif new.slug = 'iso-14001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system,regulation_id) values
          (new.organization_id,'iso-14001','internrevisjon','Internrevisjon (miljø)','Klausulvise revisjoner mot ISO 14001:2015.',10,true,'iso-14001')
        on conflict (organization_id,pack,slug) do update set regulation_id = excluded.regulation_id;

      elsif new.slug = 'iso-27001' then
        insert into public.compliance_checklist_categories (organization_id,pack,slug,name,description,position,is_system,regulation_id) values
          (new.organization_id,'iso-27001','internrevisjon','Internrevisjon (ISMS)','Klausulvise revisjoner mot ISO 27001:2022.',10,true,'iso-27001')
        on conflict (organization_id,pack,slug) do update set regulation_id = excluded.regulation_id;
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
