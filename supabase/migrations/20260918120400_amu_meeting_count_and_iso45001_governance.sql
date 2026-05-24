-- AMU annual meeting count validation + ISO 45001 governance templates (cl. 5.3 / 5.4)
--
-- Gap 1: AMU meeting count not validated (AML § 7-2 (3) requires ≥ 4 meetings/year
--   for orgs with ≥ 50 employees). The existing amu-arsrapport-sjekk template
--   reviewed the content of meetings but never asked "were ≥ 4 held this year?"
--   A dedicated annual summary template closes this Arbeidstilsynet finding.
--
-- Gap 2: ISO 45001 clause 5.3 (organisational roles, responsibilities and
--   authorities) and clause 5.4 (consultation and participation of workers) had
--   no standalone checklists in _provision_compliance_iso_baseline — only single
--   items buried in the general internrevisjon template. Dedicated templates
--   allow periodic targeted reviews of these governance requirements.
--
-- Self-audit (Arbeidstilsynet / ISO CB auditor POV):
--   Addressed: pålegg-grunn «AMU avholdt ikke lovpålagte 4 møter» (§ 7-2 (3));
--              ISO 45001 minor nonconformity «no procedure for consulting workers»
--              (kl. 5.4); ISO 45001 minor nonconformity «OH&S roles not formally
--              assigned» (kl. 5.3).
--   Restrisiko: Digital meeting count relies on self-reporting in the checklist —
--               actual calendar integration would give stronger evidence. Deferred.

-- ── 1. AMU annual meeting count template (aml-amu pack) ──────────────────────

create or replace function public._patch_amu_arsmote_oppsummering()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
    ) values (
      v_org_id,
      'aml-amu',
      'amu-arsmote-oppsummering',
      'AMU — Årsoppsummering møtefrekvens',
      'Verifiserer at AMU har avholdt lovpålagte møter (min. 4 per år for virksomheter med ≥ 50 ansatte) og at møtereferater foreligger. Brukes som del av internkontrollen ved årets slutt.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object(
          'key', 'ansatte_over_50',
          'prompt', 'Har virksomheten 50 eller flere ansatte?',
          'type', 'yes_no_na',
          'required', true,
          'help', 'Svar «Ikke aktuelt» hvis under 50 ansatte — AMU-møtekrav gjelder ikke.',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'antall_moter',
          'prompt', 'Hvor mange AMU-møter ble avholdt i løpet av kalenderåret?',
          'type', 'number',
          'required', true,
          'help', 'Minimum 4 møter per kalenderår er påkrevd (AML § 7-2 (3)). Oppgi faktisk antall avholdte møter.',
          'severity_default', 'critical'
        ),
        jsonb_build_object(
          'key', 'fire_moter_ok',
          'prompt', 'Er kravet om minimum 4 møter per år oppfylt?',
          'type', 'yes_no_na',
          'required', true,
          'help', 'Dersom færre enn 4 møter er avholdt, er dette et pålegg-område for Arbeidstilsynet.',
          'severity_default', 'critical'
        ),
        jsonb_build_object(
          'key', 'referater_foreligger',
          'prompt', 'Foreligger møtereferater for samtlige møter?',
          'type', 'yes_no_na',
          'required', true,
          'help', 'Referater skal lagres og gjøres tilgjengelig for verneombud og tillitsvalgte (IK-f § 5 nr. 7).',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'saker_fra_verneombud',
          'prompt', 'Har verneombudene kunnet fremme saker for AMU dette året?',
          'type', 'yes_no_na',
          'required', true,
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'arsrapport_utarbeidet',
          'prompt', 'Er AMU-årsrapport utarbeidet og presentert for styret?',
          'type', 'yes_no_na',
          'required', true,
          'help', 'AML § 7-2 (6) krever at AMU hvert år avgir rapport til styret om sitt arbeid.',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'avvik_fra_aaret',
          'prompt', 'Beskriv eventuelle avvik fra minstekravet og planlagte korrigerende tiltak.',
          'type', 'text',
          'required', false,
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'leder_signatur',
          'prompt', 'Ansvarlig leders signatur',
          'type', 'signature',
          'required', true,
          'severity_default', 'high'
        )
      )),
      true, true, true, 'draft', 'arlig',
      array['AML § 7-2', 'AML § 7-2 (3)', 'AML § 7-2 (6)', 'IK-f § 5 nr. 7']
    ) on conflict (organization_id, slug) do update set
      name        = excluded.name,
      description = excluded.description,
      definition  = excluded.definition,
      law_refs    = excluded.law_refs,
      cadence_hint = excluded.cadence_hint;
  end loop;
end;
$$;

select public._patch_amu_arsmote_oppsummering();
drop function public._patch_amu_arsmote_oppsummering();

-- ── 2. ISO 45001 clause 5.3 governance template ───────────────────────────────

create or replace function public._patch_iso45001_governance_templates()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  for v_org_id in
    select distinct organization_id
    from public.compliance_checklist_templates
    where pack = 'iso-45001' and deleted_at is null
  loop
    -- Clause 5.3: Organisational roles, responsibilities and authorities
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
    ) values (
      v_org_id,
      'iso-45001',
      'iso-45001-roller-ansvar',
      'ISO 45001 — Roller, ansvar og myndighet (kl. 5.3)',
      'Periodisk gjennomgang av at OH&S-roller er tildelt, dokumentert og kommunisert. Dekker kl. 5.3 i ISO 45001:2018.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object(
          'key', 'roller_definert',
          'prompt', 'Er alle OH&S-relevante roller og ansvar formelt definert og dokumentert?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'roller_kommunisert',
          'prompt', 'Er rollene kommunisert til de berørte personene — skriftlig eller via opplæring?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'hms_leder_utpekt',
          'prompt', 'Er en HMS-leder (eller tilsvarende funksjon) formelt utpekt med myndighet til å rapportere direkte til toppledelsen?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'critical'
        ),
        jsonb_build_object(
          'key', 'verneombud_funksjon_ok',
          'prompt', 'Er verneombuds rolle og myndighet dokumentert og i tråd med AML § 6-2?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'amu_ansvar_dokumentert',
          'prompt', 'Er AMUs rolle, sammensetning og ansvar dokumentert i HMS-systemet?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'oppdatert_siden_sist',
          'prompt', 'Er rolle- og ansvarsdokumentasjonen oppdatert etter organisasjonsendringer siden forrige gjennomgang?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.3',
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'kommentar',
          'prompt', 'Revisors kommentar og eventuelle avvik',
          'type', 'text',
          'required', false,
          'iso_clause', '5.3'
        ),
        jsonb_build_object(
          'key', 'revisor_signatur',
          'prompt', 'Revisors signatur',
          'type', 'signature',
          'required', true,
          'iso_clause', '5.3'
        )
      )),
      true, true, true, 'draft', 'arlig',
      array['ISO 45001:2018 § 5.3', 'AML § 6-2', 'AML § 7-1']
    ) on conflict (organization_id, slug) do update set
      name        = excluded.name,
      description = excluded.description,
      definition  = excluded.definition,
      law_refs    = excluded.law_refs;

    -- Clause 5.4: Consultation and participation of workers
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
    ) values (
      v_org_id,
      'iso-45001',
      'iso-45001-medvirkning',
      'ISO 45001 — Konsultasjon og medvirkning (kl. 5.4)',
      'Periodisk gjennomgang av prosesser for å konsultere og involvere ansatte i OH&S-beslutninger. Dekker kl. 5.4 i ISO 45001:2018 og AML § 4-2.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object(
          'key', 'medvirkning_prosess',
          'prompt', 'Er det etablert dokumenterte prosesser for konsultasjon og medvirkning av ansatte i HMS-beslutninger?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'critical'
        ),
        jsonb_build_object(
          'key', 'ikke_ledende_konsultert',
          'prompt', 'Konsulteres ikke-ledende ansatte i utvikling, gjennomgang og endring av HMS-policy og mål?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'hindringer_fjernet',
          'prompt', 'Er identifiserte hindringer for arbeidstakers deltakelse dokumentert og tiltak iverksatt?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'risikovurdering_deltakelse',
          'prompt', 'Deltar ansatte i identifikasjon av farer og risikovurdering (kl. 6.1.2)?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'tilbakemelding_kanal',
          'prompt', 'Finnes det tilgjengelige kanaler der ansatte kan melde inn HMS-bekymringer uten frykt for gjengjeldelse?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'aml_4_2_oppfylt',
          'prompt', 'Er kravene til medvirkning i AML § 4-2 oppfylt — ansatte involveres ved planlegging av eget arbeid og organisasjonsendringer?',
          'type', 'yes_no_na',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'high'
        ),
        jsonb_build_object(
          'key', 'eksempler_medvirkning',
          'prompt', 'Beskriv konkrete eksempler på medvirkning fra siste periode (møter, workshops, HMS-runder, o.l.)',
          'type', 'text',
          'required', true,
          'iso_clause', '5.4',
          'severity_default', 'medium'
        ),
        jsonb_build_object(
          'key', 'kommentar',
          'prompt', 'Revisors kommentar og eventuelle avvik',
          'type', 'text',
          'required', false,
          'iso_clause', '5.4'
        ),
        jsonb_build_object(
          'key', 'revisor_signatur',
          'prompt', 'Revisors signatur',
          'type', 'signature',
          'required', true,
          'iso_clause', '5.4'
        )
      )),
      true, true, true, 'draft', 'halvårlig',
      array['ISO 45001:2018 § 5.4', 'AML § 4-2', 'IK-f § 5 nr. 7']
    ) on conflict (organization_id, slug) do update set
      name        = excluded.name,
      description = excluded.description,
      definition  = excluded.definition,
      law_refs    = excluded.law_refs;
  end loop;
end;
$$;

select public._patch_iso45001_governance_templates();
drop function public._patch_iso45001_governance_templates();

-- ── 3. Extend _provision_compliance_iso_baseline to include governance templates

create or replace function public._provision_compliance_iso_baseline(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Internal audit (original)
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
    true, true, true, 'draft', 'arlig', array['ISO 45001:2018 § 9.2']
  ) on conflict (organization_id, slug) do nothing;

  -- Governance: clause 5.3 roles and responsibilities
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id,
    'iso-45001',
    'iso-45001-roller-ansvar',
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
    true, true, true, 'draft', 'arlig', array['ISO 45001:2018 § 5.3', 'AML § 6-2', 'AML § 7-1']
  ) on conflict (organization_id, slug) do nothing;

  -- Governance: clause 5.4 consultation and participation
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint, law_refs
  ) values (
    p_org_id,
    'iso-45001',
    'iso-45001-medvirkning',
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
  from public.compliance_checklist_templates t cross join public.compliance_requirements r
  where t.organization_id = p_org_id
    and t.slug in ('iso-45001-internal-audit', 'iso-45001-roller-ansvar', 'iso-45001-medvirkning')
    and t.deleted_at is null
    and r.organization_id is null and r.is_active = true and r.pack = 'iso-45001'
  on conflict (template_id, requirement_id) do nothing;
end;
$$;

revoke all on function public._provision_compliance_iso_baseline(uuid) from public, anon;
grant execute on function public._provision_compliance_iso_baseline(uuid) to authenticated, service_role;
