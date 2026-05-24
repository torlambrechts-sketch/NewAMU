-- Corrective migration for review findings in _120300 and _120400
--
-- Fixes applied:
--   P0-2: _patch_amu_arsmote_oppsummering looped ALL orgs instead of aml-amu orgs.
--         Re-run with correct scope; delete the spurious rows inserted for non-aml orgs.
--   P1-1: cadence_hint stored as 'arlig' (ASCII) instead of 'årlig' (Norwegian ø).
--         Corrects all three templates from _120400 across all affected orgs.
--   P1-2: ARP document template page_payload lacked top-level metadata (title, summary,
--         status, template, legalRefs, requiresAcknowledgement, revisionIntervalMonths)
--         that the document renderer expects. Patched in-place via UPDATE.
--   P1-3: Existing ISO 45001 orgs got the two new governance templates from
--         _patch_iso45001_governance_templates() but never got the requirement links
--         that _provision_compliance_iso_baseline creates. Backfill them now.
--   P2-2: on conflict do update for ISO governance templates was missing cadence_hint.
--         Addressed by the cadence_hint fix below.
--   P2-6: arsrapport_utarbeidet help text cited AML § 7-2 (6) — does not exist in
--         current statute. Correct reference is AML § 7-4.
--         law_refs array also corrected.

-- ── 0. Fix ARP template page_payload — add missing top-level metadata ────────
-- The document renderer reads page_payload.title, .status, .requiresAcknowledgement
-- etc. at the top level. The _120300 insert only had a 'blocks' key.

update public.document_system_templates
set page_payload = jsonb_build_object(
  'title',                 'Aktivitets- og redegjørelsesrapport (ARP) — LDL § 26',
  'summary',               'Mal for obligatorisk årsrapport om likestilling og diskriminering. Dokumenterer aktiviteter og resultater innen lønn, forfremmelse, rekruttering, foreldrepermisjon og forebygging av trakassering — påkrevd for virksomheter med ≥ 50 ansatte (LDL § 26).',
  'status',                'draft',
  'template',              'procedure',
  'legalRefs',             jsonb_build_array(
    'Likestillings- og diskrimineringsloven § 26',
    'Likestillings- og diskrimineringsloven § 26 (4)',
    'Likestillings- og diskrimineringsloven § 26 (5)',
    'AML § 4-3'
  ),
  'requiresAcknowledgement', true,
  'revisionIntervalMonths',  12,
  'blocks',                page_payload -> 'blocks'
)
where id = '00000000-d000-4000-a000-000000000109';

-- ── 1. Delete spurious amu-arsmote-oppsummering rows in non-aml-amu orgs ─────

delete from public.compliance_checklist_templates
where slug = 'amu-arsmote-oppsummering'
  and deleted_at is null
  and organization_id not in (
    select distinct organization_id
    from public.compliance_checklist_templates
    where pack = 'aml-amu' and deleted_at is null
      and slug <> 'amu-arsmote-oppsummering'
  );

-- ── 2. Fix cadence_hint 'arlig' → 'årlig' for all three templates ─────────────

update public.compliance_checklist_templates
set cadence_hint = 'årlig'
where slug in ('amu-arsmote-oppsummering', 'iso-45001-roller-ansvar', 'iso-45001-internal-audit')
  and cadence_hint = 'arlig'
  and deleted_at is null;

-- ── 3. Fix arsrapport_utarbeidet help text and law_refs: § 7-2 (6) → § 7-4 ───

update public.compliance_checklist_templates
set
  definition = jsonb_set(
    definition,
    '{items}',
    (
      select jsonb_agg(
        case
          when item ->> 'key' = 'arsrapport_utarbeidet'
          then item
            || jsonb_build_object(
                'help', 'AML § 7-4 krever at AMU hvert år avgir rapport til styret om sitt arbeid.'
               )
          else item
        end
      )
      from jsonb_array_elements(definition -> 'items') as item
    )
  ),
  law_refs = array_replace(law_refs, 'AML § 7-2 (6)', 'AML § 7-4')
where slug = 'amu-arsmote-oppsummering'
  and deleted_at is null
  and definition -> 'items' is not null;

-- ── 4. Backfill requirement links for existing ISO 45001 orgs ─────────────────
-- (these orgs got the templates from _patch but not the requirement links)

insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
select t.id, r.id, t.organization_id
from public.compliance_checklist_templates t
cross join public.compliance_requirements r
where t.slug in ('iso-45001-roller-ansvar', 'iso-45001-medvirkning')
  and t.deleted_at is null
  and r.organization_id is null
  and r.is_active = true
  and r.pack = 'iso-45001'
on conflict (template_id, requirement_id) do nothing;

-- ── 5. Rebuild _provision_compliance_iso_baseline with corrected cadence_hint ─

create or replace function public._provision_compliance_iso_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Internal audit
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

  -- Clause 5.3: roles, responsibilities and authorities
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'iso-45001', 'iso-45001-roller-ansvar',
    'ISO 45001 — Roller, ansvar og myndighet (kl. 5.3)',
    'Periodisk gjennomgang av at OH&S-roller er tildelt, dokumentert og kommunisert. Dekker kl. 5.3 i ISO 45001:2018.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','roller_definert','prompt','Er alle OH&S-relevante roller og ansvar formelt definert og dokumentert?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','high'),
      jsonb_build_object('key','roller_kommunisert','prompt','Er rollene kommunisert til de berørte personene — skriftlig eller via opplæring?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','high'),
      jsonb_build_object('key','hms_leder_utpekt','prompt','Er en HMS-leder formelt utpekt med myndighet til å rapportere direkte til toppledelsen?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','critical'),
      jsonb_build_object('key','verneombud_funksjon_ok','prompt','Er verneombuds rolle og myndighet dokumentert og i tråd med AML § 6-2?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','high'),
      jsonb_build_object('key','amu_ansvar_dokumentert','prompt','Er AMUs rolle, sammensetning og ansvar dokumentert i HMS-systemet?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','medium'),
      jsonb_build_object('key','oppdatert_siden_sist','prompt','Er rolle- og ansvarsdokumentasjonen oppdatert etter organisasjonsendringer siden forrige gjennomgang?',
        'type','yes_no_na','required',true,'iso_clause','5.3','severity_default','medium'),
      jsonb_build_object('key','kommentar','prompt','Revisors kommentar og eventuelle avvik',
        'type','text','required',false,'iso_clause','5.3'),
      jsonb_build_object('key','revisor_signatur','prompt','Revisors signatur',
        'type','signature','required',true,'iso_clause','5.3')
    )),
    true, true, true, 'draft', 'årlig', array['ISO 45001:2018 § 5.3', 'AML § 6-2', 'AML § 7-1']
  ) on conflict (organization_id, slug) do nothing;

  -- Clause 5.4: consultation and participation of workers
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id, 'iso-45001', 'iso-45001-medvirkning',
    'ISO 45001 — Konsultasjon og medvirkning (kl. 5.4)',
    'Periodisk gjennomgang av prosesser for å konsultere og involvere ansatte i OH&S-beslutninger. Dekker kl. 5.4 i ISO 45001:2018 og AML § 4-2.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key','medvirkning_prosess','prompt','Er det etablert dokumenterte prosesser for konsultasjon og medvirkning av ansatte i HMS-beslutninger?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','critical'),
      jsonb_build_object('key','ikke_ledende_konsultert','prompt','Konsulteres ikke-ledende ansatte i utvikling, gjennomgang og endring av HMS-policy og mål?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','high'),
      jsonb_build_object('key','hindringer_fjernet','prompt','Er identifiserte hindringer for arbeidstakers deltakelse dokumentert og tiltak iverksatt?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','medium'),
      jsonb_build_object('key','risikovurdering_deltakelse','prompt','Deltar ansatte i identifikasjon av farer og risikovurdering (kl. 6.1.2)?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','high'),
      jsonb_build_object('key','tilbakemelding_kanal','prompt','Finnes det tilgjengelige kanaler der ansatte kan melde inn HMS-bekymringer uten frykt for gjengjeldelse?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','high'),
      jsonb_build_object('key','aml_4_2_oppfylt','prompt','Er kravene til medvirkning i AML § 4-2 oppfylt?',
        'type','yes_no_na','required',true,'iso_clause','5.4','severity_default','high'),
      jsonb_build_object('key','eksempler_medvirkning','prompt','Beskriv konkrete eksempler på medvirkning fra siste periode',
        'type','text','required',true,'iso_clause','5.4','severity_default','medium'),
      jsonb_build_object('key','kommentar','prompt','Revisors kommentar og eventuelle avvik',
        'type','text','required',false,'iso_clause','5.4'),
      jsonb_build_object('key','revisor_signatur','prompt','Revisors signatur',
        'type','signature','required',true,'iso_clause','5.4')
    )),
    true, true, true, 'draft', 'halvårlig', array['ISO 45001:2018 § 5.4', 'AML § 4-2', 'IK-f § 5 nr. 7']
  ) on conflict (organization_id, slug) do nothing;

  insert into public.compliance_template_requirements (template_id, requirement_id, organization_id)
  select t.id, r.id, t.organization_id
  from public.compliance_checklist_templates t
  cross join public.compliance_requirements r
  where t.organization_id = p_org_id
    and t.slug in ('iso-45001-internal-audit', 'iso-45001-roller-ansvar', 'iso-45001-medvirkning')
    and t.deleted_at is null
    and r.organization_id is null and r.is_active = true and r.pack = 'iso-45001'
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

revoke all on function public._provision_compliance_iso_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_baseline(uuid) to authenticated, service_role;
