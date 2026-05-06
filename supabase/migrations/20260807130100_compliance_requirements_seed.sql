-- Seed system requirements for the AML and ISO 45001 packs, then link the
-- two seeded baseline templates (vernerunde-standard, iso-45001-internal-audit)
-- to all relevant requirements per org.
--
-- System rows have organization_id = NULL and is_system = true. They are
-- read-only from the application (RLS WRITE policy denies); platform ships
-- updates via new migrations.

-- ── 1. AML / Internkontrollforskriften system requirements ─────────────────

insert into public.compliance_requirements (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  (null, 'aml-amu', 'aml-3-1',  'AML §3-1', 'Krav til systematisk HMS-arbeid',
   'Arbeidsgiver skal sørge for at det utføres systematisk helse-, miljø- og sikkerhetsarbeid (internkontroll).', true, true),
  (null, 'aml-amu', 'aml-4-1',  'AML §4-1', 'Generelle krav til arbeidsmiljøet',
   'Arbeidsmiljøet skal være fullt forsvarlig ut fra en enkeltvis og samlet vurdering.', true, true),
  (null, 'aml-amu', 'aml-4-3',  'AML §4-3', 'Psykososialt arbeidsmiljø',
   'Arbeidet skal legges til rette slik at arbeidstakerens integritet og verdighet ivaretas.', true, true),
  (null, 'aml-amu', 'aml-4-4',  'AML §4-4', 'Det fysiske arbeidsmiljøet',
   'Fysiske arbeidsmiljøfaktorer som bygnings- og utstyrsmessige forhold, inneklima, lys, støy og stråling skal være fullt forsvarlige.', true, true),
  (null, 'aml-amu', 'aml-4-5',  'AML §4-5', 'Kjemisk og biologisk helsefare',
   'Arbeidstakere skal være sikret mot ulykker, helseskader og særlig ubehag som følge av kjemikalier og biologisk materiale.', true, true),
  (null, 'aml-amu', 'aml-6-2',  'AML §6-2', 'Verneombudets oppgaver',
   'Verneombudet skal ivareta arbeidstakernes interesser i saker som angår arbeidsmiljøet.', true, true),
  (null, 'aml-amu', 'ik-5',     'IK-forskriften §5', 'Internkontrollens innhold',
   'Skriftlig dokumentasjon av rutiner, sjekklister, avvikshåndtering og oppfølging.', true, true)
on conflict do nothing;

-- ── 2. ISO 45001:2018 system requirements ──────────────────────────────────

insert into public.compliance_requirements (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  (null, 'iso-45001', 'iso-45001-4-1',   'ISO 45001 §4.1',   'Understanding the organization and its context',
   'Determine external and internal issues relevant to its purpose that affect the OH&S management system.', true, true),
  (null, 'iso-45001', 'iso-45001-5-1',   'ISO 45001 §5.1',   'Leadership and commitment',
   'Top management demonstrates leadership and commitment with respect to the OH&S management system.', true, true),
  (null, 'iso-45001', 'iso-45001-5-2',   'ISO 45001 §5.2',   'OH&S policy',
   'Top management establishes, implements and maintains an OH&S policy.', true, true),
  (null, 'iso-45001', 'iso-45001-5-4',   'ISO 45001 §5.4',   'Consultation and participation of workers',
   'Establish processes for consultation and participation of workers at all applicable levels.', true, true),
  (null, 'iso-45001', 'iso-45001-6-1-2', 'ISO 45001 §6.1.2', 'Hazard identification and assessment of risks',
   'Establish, implement and maintain a process for ongoing and proactive hazard identification.', true, true),
  (null, 'iso-45001', 'iso-45001-6-1-3', 'ISO 45001 §6.1.3', 'Determination of legal and other requirements',
   'Establish, implement and maintain a process to determine and have access to up-to-date legal requirements.', true, true),
  (null, 'iso-45001', 'iso-45001-6-2',   'ISO 45001 §6.2',   'OH&S objectives and planning to achieve them',
   'Establish OH&S objectives at relevant functions and levels to maintain and continually improve the OH&S management system.', true, true),
  (null, 'iso-45001', 'iso-45001-7-2',   'ISO 45001 §7.2',   'Competence',
   'Determine the necessary competence of workers that affects or can affect OH&S performance.', true, true),
  (null, 'iso-45001', 'iso-45001-8-1',   'ISO 45001 §8.1',   'Operational planning and control',
   'Plan, implement, control and maintain the processes needed to meet OH&S management system requirements.', true, true),
  (null, 'iso-45001', 'iso-45001-8-2',   'ISO 45001 §8.2',   'Emergency preparedness and response',
   'Establish, implement and maintain processes needed to prepare for and respond to potential emergency situations.', true, true),
  (null, 'iso-45001', 'iso-45001-9-1',   'ISO 45001 §9.1',   'Monitoring, measurement, analysis and performance evaluation',
   'Establish, implement and maintain processes for monitoring, measurement, analysis and performance evaluation.', true, true),
  (null, 'iso-45001', 'iso-45001-9-2',   'ISO 45001 §9.2',   'Internal audit',
   'Conduct internal audits at planned intervals to provide information on whether the OH&S management system conforms.', true, true),
  (null, 'iso-45001', 'iso-45001-10-2',  'ISO 45001 §10.2',  'Incident, nonconformity and corrective action',
   'Establish, implement and maintain processes to manage incidents and nonconformities, including corrective action.', true, true),
  (null, 'iso-45001', 'iso-45001-10-3',  'ISO 45001 §10.3',  'Continual improvement',
   'Continually improve the suitability, adequacy and effectiveness of the OH&S management system.', true, true)
on conflict do nothing;

-- ── 3. Tag the two seeded baseline templates with all pack-matching reqs ────

do $$
declare
  v_org      record;
  v_template record;
  v_req      record;
begin
  for v_org in select id from public.organizations loop
    for v_template in
      select id, pack
      from public.compliance_checklist_templates
      where organization_id = v_org.id
        and slug in ('vernerunde-standard', 'iso-45001-internal-audit')
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
          (v_template.id, v_req.id, v_org.id)
        on conflict (template_id, requirement_id) do nothing;
      end loop;
    end loop;
  end loop;
end $$;
