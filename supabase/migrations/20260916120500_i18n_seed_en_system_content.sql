-- i18n Phase 2 — English (en) seed for vendor-seeded system content.
--
-- Populates the `en` rows of all eight `<table>_locales` sidecar tables so an
-- English user sees an English discovery surface (template names, labels,
-- descriptions, use-case and scoring notes — the text that appears in hub
-- tiles, the sidebar, switchers and settings lists).
--
-- Strategy: each `en` row is first inserted as a copy of the `nb` row so the
-- row always exists and the per-column resolver has a value; the structured
-- text columns are then overwritten with reviewed English. The large jsonb
-- payload columns (survey `body`, document `page_payload`, alert/meeting/task
-- `definition`, register `metadata_schema`) are deliberately LEFT as the nb
-- copy — translating the full compliance-content corpus is a language-expert
-- task tracked separately. The frontend coalesces per column, so the result
-- is an English chrome over Norwegian content bodies until that lands.
--
-- Law references (AML §, IK-f §, LDL §, Ftrl §, GDPR Art., ISO clauses) are
-- kept verbatim — they are legal citations, not translatable prose.
--
-- Self-audit (Arbeidstilsynet POV): no compliance content changes — the nb
-- rows are untouched and the jsonb payloads are byte-identical copies. Pure
-- additive translation of display metadata. Restrisiko: jsonb bodies remain
-- Norwegian until the translation pass; the resolver fallback makes this a
-- graceful, non-broken state.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Insert en rows as copies of nb (idempotent) ──────────────────────────
insert into public.survey_template_catalog_locales
  (template_id, locale, name, short_name, description, use_case, scoring_note, body)
select template_id, 'en', name, short_name, description, use_case, scoring_note, body
from public.survey_template_catalog_locales where locale = 'nb'
on conflict (template_id, locale) do nothing;

insert into public.document_system_templates_locales
  (template_id, locale, label, description, page_payload)
select template_id, 'en', label, description, page_payload
from public.document_system_templates_locales where locale = 'nb'
on conflict (template_id, locale) do nothing;

insert into public.wiki_legal_coverage_items_locales (item_id, locale, label)
select item_id, 'en', label
from public.wiki_legal_coverage_items_locales where locale = 'nb'
on conflict (item_id, locale) do nothing;

insert into public.register_types_locales
  (register_type_id, locale, name, description, metadata_schema)
select register_type_id, 'en', name, description, metadata_schema
from public.register_types_locales where locale = 'nb'
on conflict (register_type_id, locale) do nothing;

insert into public.alert_system_templates_locales
  (template_id, locale, label, description, definition, metadata_schema)
select template_id, 'en', label, description, definition, metadata_schema
from public.alert_system_templates_locales where locale = 'nb'
on conflict (template_id, locale) do nothing;

insert into public.meeting_system_templates_locales
  (template_id, locale, label, description, definition, metadata_schema)
select template_id, 'en', label, description, definition, metadata_schema
from public.meeting_system_templates_locales where locale = 'nb'
on conflict (template_id, locale) do nothing;

insert into public.task_template_catalog_locales
  (template_id, locale, name, description, definition)
select template_id, 'en', name, description, definition
from public.task_template_catalog_locales where locale = 'nb'
on conflict (template_id, locale) do nothing;

-- ── 2. Survey templates — English display text ──────────────────────────────
update public.survey_template_catalog_locales t set
  name = v.name, short_name = v.short_name, description = v.description,
  use_case = v.use_case, scoring_note = v.scoring_note
from (values
  ('aml-10-arbeidstid-belastning','Working hours, strain and recovery','Working-hours pulse','Quarterly pulse measurement of actual working hours, overtime, recovery and perceived strain.','work environment pulse','Anonymised. The quarterly trend is strong documentation for inspections.'),
  ('aml-13-likebehandling','Equal treatment and inclusion','D&I','Annual anonymous survey of perceived discrimination and inclusive culture. Lower k-threshold (3) so small departments can see their own results.','work environment survey','Anonymised with k=3. Optional free-text comments may contain personally identifying special categories — UI hint warns against entering health information.'),
  ('aml-2-3-medvirkningsplikt-attest','Duty to cooperate – annual confirmation','Duty to cooperate','Annual confirmation from each employee that the duty to cooperate under AML §2-3 is understood, and that whistleblowing channels and the safety representative are known.','compliance attestation','Identified. Each employee completes it individually; the statistics tab shows coverage per unit.'),
  ('aml-3-1-hms-modenhet-leder','HSE maturity – manager self-report','HSE maturity','Annual self-report from each line manager on how systematic HSE work is within their area of responsibility. The year-on-year trend documents that internal control is working.','leader self-assessment','Identified per manager. Aggregated coverage and average score in the statistics tab.'),
  ('aml-3-5-arbeidsgivers-hms-attest','Employer HSE training – annual attestation','HSE training (annual)','Annual attestation from each manager with employer responsibility on completed HSE training (AML §3-5). Complements the existing employer-HSE-training checklist — the checklist is a single signed document; the survey is an annual sweep with a coverage overview across managers.','compliance attestation','Identified per manager. The statistics tab shows which managers are missing attestation.'),
  ('aml-4-2-medvirkning','Participation and accommodation','Participation','Semi-annual survey of whether employees feel they participate in decisions and that work is suitably accommodated.','work environment survey','Anonymised. Aggregated per unit with a k=5 threshold.'),
  ('aml-6-1-verneombud-bekreftelse','Safety representative – known and active','SR confirmation','Annual identified confirmation from employees that the safety representative is known and actively visible in their area. Complements the existing safety-representative annual-report checklist.','compliance attestation','Identified. Aggregated per department in the statistics tab — surfaces areas with no known safety representative.'),
  ('aml-9-kontrolltiltak-opplevelse','Control measures – perceived proportionality','Control measures','Annual anonymous assessment of whether control measures affecting employees are perceived as proportionate (AML §9-1). Lower k-threshold for small teams.','work environment survey','Anonymised with k=3. Triggered by new control measures or changes.'),
  ('amu-valg-system','Working Environment Committee and safety representative elections','AMU election','Anonymous ballot for the working environment committee (AMU) and safety representatives. Uses the survey module anonymity mechanism. Eligible voters are limited manually in v1 — a structured election module is planned.','Working Environment Committee and safety representative elections — secret ballot per AML § 6-3.',NULL),
  ('apenhetsloven-aktsomhet-internal','Transparency Act – internal due-diligence attestation','Transparency Act (internal)','Annual internal attestation from procurement/management that due-diligence assessments under the Transparency Act §4 are completed, documented and published by 30 June.','compliance attestation','Identified. Complements the external supplier survey ext-apenhetsloven; this survey documents that we have ourselves performed due diligence on the supply chain.'),
  ('ext-apenhetsloven','Code of conduct / human rights','Transparency','Confirmation in line with the Transparency Act — rights and decent working conditions.','Supplier screening.','Document in the supplier register review.'),
  ('ext-hms-egenerklaring','HSE self-declaration (supplier)','HSE self-decl.','Standardised self-declaration for suppliers — internal control, training, insurance.','Annually from subcontractors.','File attachments can be added in a workflow.'),
  ('ext-underentreprenor','Subcontractor — construction site','Subcontr. constr.','SHA plan, ID card, working conditions before starting on a construction site.','Construction.','Requires a signature as needed.'),
  ('gdpr-personvern-attest','GDPR – data protection attestation','GDPR attestation','Annual internal attestation from the DPO or data protection officer that data protection routines are maintained and documented.','compliance attestation','Identified. The Norwegian Data Protection Authority requests equivalent documentation during inspections.'),
  ('ik-5-2-opplaering-effekt','Training and knowledge (effect)','Training pulse','Annual survey of whether employees feel they have received sufficient training and information when changes occur.','work environment survey','Anonymised. Year-on-year trend.'),
  ('ik-5-8-internkontroll-egenkontroll','Internal control – manager self-check','IC self-check','Annual manager self-check that internal control works as intended within their area of responsibility. Complements the existing internal-control annual-review checklist — the checklist is one organisation-wide signed document; the survey is manager-by-manager for a coverage overview.','leader self-control','Identified per manager. Aggregated per unit in the statistics tab.'),
  ('leadership-360','Leadership 360','Leadership 360','Semi-annual 360 feedback on leadership from direct reports. Anonymous, aggregated per manager with k=5.','leader feedback','Anonymised. Aggregated per manager.'),
  ('team-pulse-kvartal','Team pulse (quarterly)','Team pulse','A short quarterly pulse — five questions on team health, energy, direction and collaboration.','team pulse','Anonymised. Quarterly trend.'),
  ('tpl-amu-arsrapport-input','AMU annual report — input','AMU input','Structured input for the AMU annual report (§ 7-4). NOT anonymous — the respondent is identified by role (employer side / employee side / safety representative / secretary). Uses the voting type for parity-based balloting. Votes are aggregated separately per side.','Once before writing the annual report — typically Q1 each year.','Voting items are reported with vote counts per side (employer/employee). Traffic-light items are aggregated into consensus or dissent. Priority_top3 is compiled into a top-5 list. Used as an appendix to the AMU annual report.'),
  ('tpl-ark','ARK Work Environment','ARK','A broadly validated instrument for Norwegian working life — NTNU. Covers strain, coping, leadership, culture, health. Suitable as the main survey for larger organisations (>= 30 employees).','Main survey for larger organisations. Recommended every other year.','Average per subscale (1-5). Follow the ARK guidance for thresholds and benchmark against the industry. A subscale below 3.5 triggers a mitigation assessment (IK-f § 5 nr. 6).'),
  ('tpl-arp-likestilling','ARP — Equality and discrimination','ARP','The activity and disclosure duty (LDL § 26). Maps perceived differential treatment by gender, ethnicity, religion, disability, age and sexual orientation. Requires explicit consent before demographics are asked.','Annual ARP survey — requires disclosure in the annual report for >= 50 employees (or >= 20 if the parties require it).','Average per subscale (Direct differential treatment, Structural). Items 12-13 are reported as occurrence. Cross-tabulations only if each cell has k>=5. Consent on item 1 controls whether demographics are included.'),
  ('tpl-edmondson','Psychological safety — Edmondson 7-question','Edmondson PS','Amy Edmondson''s original 7-question instrument for psychological safety in teams. Widely used in research and organisational development globally. The basis for the Google Aristotle study.','Assess whether team members feel safe enough to take interpersonal risk — voice opinions, admit mistakes, ask "silly" questions.','Reverse Q4 and Q7 (6 - score). Compute the average of all 7. Scale 1-5. Benchmark: <3.0 = low safety; 3.0-3.8 = moderate; >3.8 = high safety. Add free text for qualitative findings.'),
  ('tpl-endring-baseline','Change — baseline (BEFORE restructuring)','Change BEFORE','Baseline measurement before restructuring/reorganisation/digitalisation. Mirrors the items in tpl-endring-etter for direct comparison. Items drawn from COPSOQ III subscales Job insecurity, Organizational justice and Quantitative demands with Norwegian adaptation.','Once before the decision. Used to show risk groups and expected effect.','Average per subscale (Information, Participation, Strain, Coping). Risk groups are identified by cross-tabulating seniority x department — only cells with k>=5.'),
  ('tpl-endring-etter','Change — follow-up measurement','Change AFTER','Follow-up measurement 3 and 6 months after the change is implemented. Items mirrored to the baseline for direct comparison, plus an eNPS-style item for an overall assessment.','3 months and 6 months after the change is implemented.','Compare each subscale against tpl-endring-baseline. A negative trend triggers a mitigation duty and an AMU presentation.'),
  ('tpl-endring-puls','Change — pulse (DURING restructuring)','Change pulse','A short monthly pulse measurement during the active restructuring phase. Escalation rule: if the average of items 3-5 drops > 0.5 between two measurements, an alert goes to the AMU plus a mitigation duty.','Monthly during the restructuring phase. Stop once the change is complete.','Average of all items. Compare against the baseline. Triggers on a drop > 0.5 between two pulse measurements.'),
  ('tpl-enps','Employee Net Promoter Score (eNPS)','eNPS','Two core questions measuring loyalty and recommendation as an employer. Quick to answer (under 2 min). Compute eNPS = % Promoters (9-10) minus % Detractors (0-6).','A quick pulse survey to capture employee loyalty and willingness to recommend. Suitable for monthly/quarterly runs.','eNPS = (Promoters / total) x 100 - (Detractors / total) x 100. Promoters: 9-10; Passives: 7-8; Detractors: 0-6. Score -100 to +100. Industry norm: +10 is considered good, +50 is excellent.'),
  ('tpl-exit','Exit survey','Exit','For employees who are leaving — understand attrition.','On resignation.','Linked to the offboarding workflow.'),
  ('tpl-google-rework','Google re:Work — Team effectiveness','re:Work','Based on the Google Project Aristotle study. Measures the five factors that predict high-performing teams: Psychological safety, Dependability, Structure & clarity, Meaning and Impact.','Evaluate team dynamics and identify which of the five Aristotle factors needs strengthening.','Compute the average per factor (scale 1-5). Factor boundaries: Psychological safety: Q1-Q3; Dependability: Q4-Q5; Structure & clarity: Q6-Q7; Meaning: Q8-Q9; Impact: Q10-Q11. Benchmark: 3.5+ per factor = a healthy team.'),
  ('tpl-hms-climate','HSE climate survey (Norwegian-adapted)','HSE climate','A Norwegian-adapted survey of safety climate per the Internal Control Regulations and AML §4-3. Maps whether the HSE culture is real and not merely formal.','Annual HSE climate survey as part of systematic HSE work (IK-f §5 nr. 5).','Scale 1-5. An average below 3.5 on any single question should be prioritised in the action plan. Results are documented as part of the annual review (IK-f §5 nr. 5).'),
  ('tpl-klarert-tilpasset','Custom template — start here','New template','An empty or near-empty template for defining your own questions and criteria (copy and adapt).','Custom surveys.','Add questions in the builder after creation.'),
  ('tpl-mobbing','Bullying & harassment — NAQ-R+','Bullying','NAQ-R short form (Negative Acts Questionnaire — Revised) supplemented with dedicated items for sexual harassment and management handling. Heightened anonymity (k>=10). Used to follow up a red flag from the main survey, after a report, or as a targeted semi-annual survey.','Follow-up to a report, or a deep dive when the main survey flags an issue. Requires strong anonymity and clear communication about how free text is handled.','Bullying status: a respondent is counted as bullied if at least one NAQ-R item is reported weekly or more often in the last 6 months (Einarsen''s definition). Aggregation per department only if k>=10. Free text is never exported without a manual anonymisation review by whistleblowing intake.'),
  ('tpl-onboarding','Onboarding 30 days','Onboarding','30 days after hire — reception and training.','Auto-dispatch','Linked to the start date.'),
  ('tpl-pulse','Pulse survey, 4 questions','Pulse','A short pulse between main surveys — captures changes quickly.','Quarterly.','Compare against the latest main survey.'),
  ('tpl-qps-nordic','QPS Nordic 34+','QPS','A validated questionnaire for the psychosocial work environment — STAMI/NIVA. Covers seven subscales: job demands, role expectations, control, predictability, mastery, social support, leadership. Recommended for the main survey every other year.','Main survey of the psychosocial work environment. Recommended cadence: every other year; interim surveys via tpl-pulse.','Average per subscale (scale 1-5). Risk indicators: Job demands > 3.5 (overload); Control < 3.0; Predictability < 3.0; Social support < 3.5; Leadership < 3.5. A subscale below threshold triggers a mitigation duty under IK-f § 5 nr. 6.'),
  ('tpl-stikkprove-fysisk','Physical work environment — spot check','Physical','A semi-annual spot check between safety inspections. Traffic-light assessment of indoor climate, lighting, noise, cleanliness, space, protective equipment plus specific risk elements.','Semi-annual — a supplement to the annual safety inspection. Red/yellow findings are logged as nonconformities.','Traffic lights are aggregated per element (% green / yellow / red). Items 7-10 are averaged (1-5). Item 11 triggers a direct nonconformity action.'),
  ('tpl-uwes','Utrecht Work Engagement Scale (UWES-9)','UWES-9','Measures work engagement along three dimensions: Vigor, Dedication and Absorption. Validated in more than 30 countries.','Map employee work engagement and detect burnout risk.','Compute the average per subscale (Vigor: Q1,Q2,Q3; Dedication: Q4,Q5,Q6; Absorption: Q7,Q8,Q9). Total score = average of all 9. Scale 0-6 (0=Never, 6=Always). Benchmark: >4.0 = high engagement.'),
  ('tpl-vold-trusler','Violence and threats (§ 4-3 (3))','Violence/threats','An industry-adapted survey for workplaces exposed to violence/threats — healthcare, education, security, transport, public-facing roles. Frequency-based exposure measurement over the last 6 months plus risk situations plus a mitigation assessment.','Semi-annual survey in exposed industries. Results are presented to the AMU.','Exposure items are reported as occurrence per category. Mitigation items are averaged (1-5). A low score (< 3.0) on routines/follow-up triggers a mitigation duty under § 4-3 (3) + IK-f § 5 nr. 6.'),
  ('vendor-arbeidsforhold-attest','Supplier – working conditions on our premises','Working-conditions attest.','Confirmation from a supplier that their employees working at our organisation have a written employment contract, working hours within AML ch. 10, and a documented HSE policy.','vendor attestation','Identified (vendor recipient). Locked on publication — supplier evidence must not be changed after publication.'),
  ('vendor-prosjekt-sluttattest','Supplier – project completion attestation','Project completion','A project completion attestation from a supplier with lessons learned, any nonconformities, and confirmation of contract fulfilment.','vendor attestation','Identified. Locked on publication.')
) as v(id, name, short_name, description, use_case, scoring_note)
where t.template_id = v.id and t.locale = 'en';

-- ── 3. Document system templates — English display text ─────────────────────
update public.document_system_templates_locales t set
  label = v.label, description = v.description
from (values
  ('00000000-d000-4000-a000-000000000101','Risk assessment — system documentation','Documents how the Klarert task module covers the requirement for a written risk assessment under AML §3-1 and IK-f §5 nr. 3.'),
  ('00000000-d000-4000-a000-000000000102','Psychosocial work environment — system documentation','Documents how the survey module covers the mapping and mitigation duty for the psychosocial work environment under AML §4-3.'),
  ('00000000-d000-4000-a000-000000000103','Chemical exposure and substance register — system documentation','Documents how the chemicals register in Klarert covers the requirements for a substance register and chemical risk assessment under AML §4-5 and the Chemicals Regulations.'),
  ('00000000-d000-4000-a000-000000000104','Nonconformity handling and injury reporting — system documentation','Documents how the nonconformity template in the task module covers the requirements for nonconformity handling (IK-f §5 nr. 4) and the duty to report injuries (AML §5-1, §5-2).'),
  ('00000000-d000-4000-a000-000000000105','HSE training — system documentation','Documents how the learning module in Klarert covers the training duty under AML §3-2 and IK-f §5 nr. 1c.'),
  ('00000000-d000-4000-a000-000000000106','Sick-leave follow-up — system documentation','Documents how the sick-leave template in the task module covers the follow-up duty under AML §4-6 and Ftrl §8-7a.'),
  ('00000000-d000-4000-a000-000000000107','Systematic internal control — Klarert as an IC system','Overarching system documentation explaining how Klarert as a whole covers the requirements in the Internal Control Regulations §5 — for use during inspections.'),
  ('tpl-aarsgjennomgang','Annual review of internal control','Minutes for the statutory annual review of internal control (IK-f §5 nr. 5). Structured agenda, decision fields and signatures.'),
  ('tpl-aktivitetsplikt','Activity and disclosure plan','Mapping and measures for equality and non-discrimination — LDL §26 (all employers) and §26a (50+ employees).'),
  ('tpl-amu-rapport','AMU annual report','The AMU annual report to employees and management on work environment efforts — AML §7-4. Inspection-ready.'),
  ('tpl-ansettelsesavtale-mal','Employment contract — template with minimum content','A written employment contract with content covering the minimum requirements in AML § 14-6.'),
  ('tpl-arbeidstidsrutine','Working-hours routine — rest, overtime and recording','A written routine for working hours, rest, overtime and overview under AML chapter 10.'),
  ('tpl-avvik','Nonconformity handling','A routine for reporting, handling and closing nonconformities and unwanted incidents.'),
  ('tpl-bedriftshelsetjeneste','Occupational health service — agreement, cooperation plan and reporting','An agreement template and cooperation plan with an approved occupational health service under AML § 3-3.'),
  ('tpl-beredskap','Emergency preparedness plan','An emergency plan for fire, accident and crisis situations with emergency numbers, an evacuation procedure and a drill plan. Inspection-ready.'),
  ('tpl-droftelsessamtale','Pre-dismissal discussion — procedure and agenda template','The statutory discussion with the employee and the union representative before a decision on dismissal is made, cf. AML § 15-1.'),
  ('tpl-hms-policy','HSE policy and objectives','The organisation''s overarching HSE statement with formal approval, SMART objectives, zero tolerance for harassment, whistleblowing and AMU/OHS references — inspection-ready.'),
  ('tpl-info-drofting-rutine','Information and discussion with union representatives — routine','A statutory routine for information and discussion with union representatives under AML ch. 8 (applies to organisations with at least 50 employees).'),
  ('tpl-konkurranseklausul-vurdering','Non-competition, non-solicitation and recruitment clauses — assessment and agreement template','An assessment template and agreement template under AML chapter 14 A.'),
  ('tpl-kontrolltiltak-vurdering','Control measures — objectivity and proportionality assessment','A statutory assessment template that must be completed before introducing a control measure, cf. AML §§ 9-1 and 9-2.'),
  ('tpl-likestilling-mangfold','Equality and diversity plan','An overarching plan tied to the requirements of the inclusion legislation.'),
  ('tpl-midlertidig-vurdering','Temporary employment — condition assessment','An assessment template documenting that the conditions in AML § 14-9 are met before a temporary agreement is entered into.'),
  ('tpl-opplaering','HSE training plan','An HSE training plan with role-specific requirements, safety representative training and sector-specific additions. Inspection-ready.'),
  ('tpl-org-ansvar','Organisation and allocation of responsibility','An overview of HSE roles, responsibilities and authority in the organisation (IK-f §5 nr. 1b). Inspection-ready.'),
  ('tpl-permisjonsoversikt','Leave — overview of entitlements','A summary of leave entitlements under AML chapter 12 — for employees and the HR routine.'),
  ('tpl-personvern-ansatte','Privacy notice for employees','A GDPR Art. 13/14 notice on the processing of employee personal data — with a digital receipt that provides an audit trail.'),
  ('tpl-risikovurdering','Risk assessment — procedure and live feed','A procedure for risk assessment linked to the live risk overview from the system.'),
  ('tpl-rusmiddel','Substance abuse in the workplace','A substance policy with zero tolerance, a support scheme and an AML §9-4 basis for control measures. Inspection-ready.'),
  ('tpl-seniorpolitikk','Life-phase policy (senior policy)','Guidelines for the senior phase and the transition to retirement.'),
  ('tpl-sluttattest','Certificate of employment — template','A standardised certificate of employment under AML § 15-15. Must be given to everyone who leaves, without waiting for a request.'),
  ('tpl-tilrettelegging','Routine for individual accommodation','Accommodation for employees with reduced capacity under AML.'),
  ('tpl-tjenestepensjon-info','Occupational pension — information for employees','Statutory information on the organisation''s occupational pension scheme, cf. AML § 3-4 and the OTP Act.'),
  ('tpl-varsling','Whistleblowing routines','A written whistleblowing routine under AML §2A-3 — channels, case handling and protection against retaliation. Inspection-ready.'),
  ('tpl-varslingsrutiner','Whistleblowing routines','Written routines for whistleblowing about censurable conditions under AML chapter 2A. Statutory for organisations with at least five employees.'),
  ('tpl-verneombud','Safety representative duties and rights','A description of the safety representative role per AML §6-2 and §6-3.'),
  ('tpl-verneombud-mandat','Safety representative mandate and election documentation','Documentation of the election, term, training and area of responsibility for safety representatives — AML §6-1–§6-5.'),
  ('tpl-virksomhetsoverdragelse-rutine','Transfer of undertaking — routine and letter template','A procedure plus an information-letter template under AML chapter 16 for the transfer of an undertaking or part of an undertaking.')
) as v(id, label, description)
where t.template_id = v.id and t.locale = 'en';

-- ── 4. Register types — English display text ────────────────────────────────
update public.register_types_locales t set name = v.name, description = v.description
from (values
  ('aml_18_tilsynssaker','Inspection and order register','A register for inspection visits, orders and follow-up from the Norwegian Labour Inspection Authority and other supervisory authorities (chapter 18 + sector laws).'),
  ('aml_5_personskade','Personal injury register','A statutory register of work accidents, personal injuries and work-related illnesses under AML §§ 5-1 and 5-2. Covers both the NAV injury report and notification to the Labour Inspection Authority.'),
  ('chemicals','Chemicals register','Substances and mixtures handled in the workplace — with hazard classification, safety data sheets and storage location. Covers AML §4-5, ISO 14001 and REACH/CLP.'),
  ('emergency_preparedness','Emergency scenarios','A register of identified emergency situations and preparedness plans, including drill history. Covers ISO 14001 §8.2 and ISO 45001 §8.2.'),
  ('environmental_aspects','Environmental aspects and impacts','A register of the organisation''s activities, products and services that can affect the environment, with a significance assessment. Covers ISO 14001 §6.1.2.'),
  ('external_suppliers','Supplier register','External suppliers and subcontractors — with risk classification, due-diligence status and contract history. Covers ISO 9001 §8.4, the Transparency Act §4 and AML §2-2.'),
  ('gdpr_processing_activities','Records of processing activities','An overview of processing activities for personal data — required under GDPR Article 30. Available to the Data Protection Authority during inspections.'),
  ('hira','Hazard identification and risk assessment (HIRA)','Systematic identification of hazards and assessment of work environment risk. Covers ISO 45001 §6.1.2 and AML §3-1. Each row represents one hazard with its risk assessment and hierarchy of controls.'),
  ('iso_asset_register','Information asset register','An inventory of the organisation''s information assets with owners, classification and CIA assessment (confidentiality, integrity, availability). Covers ISO 27001:2022 A.5.9.'),
  ('iso_risk_treatment','Information security risk','A risk assessment and treatment plan for information security risks — asset × threat × vulnerability. Covers ISO 27001 §6.1.2 and §6.1.3.'),
  ('legal_compliance','Legal and compliance register','A register of all binding obligations (laws, regulations, permits, agreements) that apply to the organisation''s environmental and HSE work. Covers ISO 14001 §6.1.3 and ISO 45001 §6.1.3.')
) as v(id, name, description)
where t.register_type_id = v.id and t.locale = 'en';

-- ── 5. Alert system templates — English display text ────────────────────────
update public.alert_system_templates_locales t set label = v.label, description = v.description
from (values
  ('aml-varsel-generell','Whistleblowing report — general censurable condition','A report under the Working Environment Act chapter 2A. Use this form when the matter does not fall under one of the more specific categories.'),
  ('aml-varsel-gjengjeldelse','Whistleblowing report — retaliation after an earlier report','A report of retaliation against you after an earlier report. The employer bears the burden of proof (AML § 2A-4).'),
  ('aml-varsel-hms-fare','Whistleblowing report — danger to life or health (HSE)','A report of immediate or potential danger to life or health. For acute danger, use the § 6-3 right to stop work.'),
  ('aml-varsel-miljo','Whistleblowing report — environmental crime','A report of environmental crime or a breach of the Pollution Control Act.'),
  ('aml-varsel-mot-leder','Whistleblowing report — matters concerning top management or the board','A report when the matter involves the normal recipient of reports. Routes via a separate committee.'),
  ('aml-varsel-okonomisk-misbruk','Whistleblowing report — corruption or financial misconduct','A report of corruption, embezzlement, fraud or other financial misconduct.'),
  ('aml-varsel-seksuell-trakassering','Whistleblowing report — sexual harassment','A report of sexual harassment. The employer has a particular duty to prevent and to act.'),
  ('aml-varsel-trakassering','Whistleblowing report — harassment or bullying','A report of harassment, bullying or improper conduct contrary to the Working Environment Act requirements for a psychosocial work environment.'),
  ('etisk-bekymring','Ethical concern — without a clear censurable condition','Ethical concerns that do not reach the threshold for a whistleblowing report under AML chapter 2A.'),
  ('gdpr-brudd-feilsending','GDPR breach — misdirected email or document','The most common breach category: a misdirected email, letter or file attachment containing personal data.'),
  ('gdpr-brudd-integritet','GDPR breach — alteration/corruption (integrity)','An integrity breach — accidental alteration or corruption of personal data.'),
  ('gdpr-brudd-konfidensialitet','GDPR breach — unauthorised access (confidentiality)','A confidentiality breach — unauthorised access to, or disclosure of, personal data.'),
  ('gdpr-brudd-lavrisiko','GDPR breach — low risk, not notifiable','A breach that under Art. 33 (1) is unlikely to result in a risk. Recorded for the documentation duty.'),
  ('gdpr-brudd-leverandor','GDPR breach — processor incident','A breach at a data processor. A notification duty applies to the controller (Art. 33 (2)).'),
  ('gdpr-brudd-tilgjengelighet','GDPR breach — loss or unavailability','An availability breach — loss, unavailability or accidental deletion of personal data.'),
  ('hms-avvik-personskade','HSE nonconformity — personal injury or near miss','Reporting of personal injuries, near misses or work-related illness cases.'),
  ('hms-avvik-yrkeshygiene','HSE nonconformity — occupational hygiene (noise, chemicals, ergonomics)','A nonconformity concerning physical working conditions. Chemical exposure requires 30 years of retention (Regulations on the Performance of Work chapter 31).'),
  ('sikkerhet-hendelse-fysisk','Security incident — physical (break-in, vandalism)','Physical security incidents: break-ins, vandalism, theft, unauthorised access to premises.'),
  ('sikkerhet-hendelse-it','Security incident — IT/cyber (excluding GDPR)','IT security incidents with no personal data involved: phishing, malware, unauthorised access.')
) as v(id, label, description)
where t.template_id = v.id and t.locale = 'en';

-- ── 6. Meeting system templates — English display text ──────────────────────
update public.meeting_system_templates_locales t set label = v.label, description = v.description
from (values
  ('allmote','All-hands meeting','A semi-annual all-hands meeting. Information, consultation and participation per AML § 4-2.'),
  ('amu-arsmote-arsrapport','AMU annual meeting and annual report (v2)','An annual summarising AMU meeting with consideration and adoption of the AMU annual report (AML § 7-2 (6)), next year''s work environment plan and an evaluation. The meeting is structured around § 7-2 (2) letters a-f for full audit coverage.'),
  ('amu-arsrapport-q4','AMU annual meeting and annual report (Q4)','An annual meeting with consideration of the AMU annual report per AML § 7-2 (6) and next year''s work environment plan.'),
  ('amu-konstitueringsmote','AMU constituting meeting (after election)','The first AMU meeting after the election of new members. Constitutes the committee for the coming term: elects a chair/deputy chair, sets the meeting calendar, plans training (the 40-hour course) and clarifies the handover from the previous term.'),
  ('amu-kvartalsmote-q1','AMU quarterly meeting Q1','The first quarterly AMU meeting. Standard agenda: safety inspection status, sick-leave trend, HSE training plan.'),
  ('amu-kvartalsmote-q2','AMU quarterly meeting Q2','The second quarterly meeting. Focus on the work environment survey, risk status and the physical work environment.'),
  ('amu-kvartalsmote-q3','AMU quarterly meeting Q3','The third quarterly meeting. Focus on the psychosocial work environment, whistleblowing cases and bullying/harassment.'),
  ('amu-mote','AMU meeting','A meeting of the working environment committee. Held at least quarterly (AML § 7-2). The template covers both ordinary quarterly meetings and the annual meeting (§ 7-2 (6)) — the agenda builder flags recommended annual items that appear once per year.'),
  ('bedriftsutvalg','Works council meeting','A works council for organisations with a collective agreement (the Basic Agreement § 9-3). Discussion of operations, finances and organisational matters.'),
  ('drofting-likestilling','Discussion meeting — equality activity duty','An annual discussion of the pay survey and equality work per the Equality and Anti-Discrimination Act § 26 and § 26a.'),
  ('drofting-omstilling','Discussion meeting — restructuring / downsizing','The duty to discuss in the event of restructuring, dismissals or collective redundancies. Mandatory items per AML § 8-2 and § 15-1.'),
  ('gdpr-dpia-gjennomgang','GDPR — DPIA review','Consideration and approval of a data protection impact assessment (DPIA) per GDPR Art. 35.'),
  ('gdpr-ropa-arsgjennomgang','GDPR — ROPA annual review','An annual review of the records of processing activities per GDPR Art. 30.'),
  ('iso-14001-miljogjennomgang','ISO 14001 — Environmental review','An annual management review of the environmental management system per ISO 14001:2015 § 9.3.'),
  ('iso-27001-isms-gjennomgang','ISO 27001 — ISMS review','An annual management review of the information security management system per ISO/IEC 27001:2022 § 9.3.'),
  ('iso-45001-ledelsens-gjennomgang','ISO 45001 — Management review','An annual management review of the HSE management system per ISO 45001:2018 § 9.3.'),
  ('iso-9001-ledelsens-gjennomgang','ISO 9001 — Management review','An annual management review of the quality management system per ISO 9001:2015 § 9.3.'),
  ('mus','Performance and development review','An annual performance and development review between manager and employee. Goals, development, wellbeing and HSE.'),
  ('personalmote','Staff meeting','A monthly staff meeting in the unit. Information, consultation and HSE topics.'),
  ('varslingsutvalg','Whistleblowing committee meeting','Handling of whistleblowing cases. A confidential meeting with a duty of confidentiality and a conflict-of-interest prompt.'),
  ('verneombud-mote','Safety representative meeting','A meeting for all safety representatives plus the chief safety representative. Review of safety inspections, nonconformities and training needs.')
) as v(id, label, description)
where t.template_id = v.id and t.locale = 'en';

-- ── 7. Task templates — English display text ────────────────────────────────
update public.task_template_catalog_locales t set name = v.name, description = v.description
from (values
  ('00000000-1000-4000-a000-000000000001','Nonconformity report — standard','A standard nonconformity report for unwanted incidents, near misses and breaches of routines.'),
  ('00000000-1000-4000-a000-000000000002','Serious incident / personal injury','For serious personal injuries and incidents with a duty to notify the Labour Inspection Authority.'),
  ('00000000-1000-4000-a000-000000000003','Risk assessment — general','Systematic mapping and assessment of risk in the work environment.'),
  ('00000000-1000-4000-a000-000000000004','Risk assessment — chemical exposure','Mapping of chemical exposure and assessment of health risk.'),
  ('00000000-1000-4000-a000-000000000005','Preventive measures','Planning and implementation of preventive HSE measures.'),
  ('00000000-1000-4000-a000-000000000006','Improvement project (PDCA)','A complete PDCA cycle for systematic improvement of the work environment. Includes AMU consideration, measurable success criteria and a formal project closure.'),
  ('00000000-2000-4000-a000-000000000001','General task','A standalone task for general HSE activities and action items.'),
  ('00000000-2000-4000-a000-000000000002','Nonconformity / Incident','Reporting and follow-up of nonconformities, accidents and unwanted incidents. A full CAPA lifecycle with root-cause analysis and linked measures.'),
  ('00000000-2000-4000-a000-000000000003','Near miss / Hazardous condition','Recording of near misses and hazardous conditions that did not cause harm but could have.'),
  ('00000000-2000-4000-a000-000000000004','Improvement measure','Planning, implementation and verification of preventive and corrective measures. Follows the ISO 45001 § 8.1.2 hierarchy of controls.'),
  ('00000000-2000-4000-a000-000000000005','Risk assessment','Systematic mapping and assessment of risk in the work environment. Includes a probability × consequence matrix and residual risk after measures.'),
  ('00000000-2000-4000-a000-000000000006','Suggestion & Improvement','Input and suggestions from employees to improve the work environment. AMU-relevant: § 4-2 participation, § 7-2 AMU consideration, § 8-1 information and discussion.'),
  ('00000000-2000-4000-a000-000000000007','Sick-leave follow-up','Structured follow-up of employees on sick leave under AML § 4-6: 4-week plan, 7-week conversation (Dialogue Meeting 1), 26-week plan (Dialogue Meeting 2, NAV) and accommodation.')
) as v(id, name, description)
where t.template_id = v.id::uuid and t.locale = 'en';

-- ── 8. Wiki legal coverage items — English labels ───────────────────────────
update public.wiki_legal_coverage_items_locales t set label = v.label
from (values
  ('06ab0adf-dd7d-4c69-a34e-cddfa22917b7','Equality and diversity'),
  ('24ec2327-b5eb-4676-b97a-83428bc81eb1','Annual review of the HSE system'),
  ('47efdc3d-164a-4065-9190-6f1a62c2f60c','Individual accommodation'),
  ('5cd03a09-9d7c-4542-99d3-52a6a369bbed','HSE objectives set in writing'),
  ('8add1b87-4599-44f9-b66d-329a1af689e1','Mapping and risk assessment'),
  ('a1136070-e828-49b4-916a-75417ea32e74','Senior policy and life phases'),
  ('a7f405c0-2258-40d3-8859-21dced36e0d2','Safety representative duties and training'),
  ('b05b608b-2c43-42f8-aeba-3c31732278a9','Knowledge of laws and regulations'),
  ('bcc2cd06-e6c5-4aa3-9e9d-a5110a08aa98','Organisation and allocation of responsibility'),
  ('c9e2dd4b-f980-440f-b003-5d9c1d0d198d','AMU annual report'),
  ('cdc3a4b5-4360-46e2-92c9-3b7c59b3936b','HSE training'),
  ('cfb7279c-3a8f-4964-8ed6-3ea244982955','Systematic review (in writing)'),
  ('d3949246-5d08-449b-83c4-385e4dd1db4b','Safety representative elected and documented'),
  ('e610b4aa-c445-427e-8e56-b2dee28b33e2','Routines for nonconformity handling'),
  ('f66d664c-42de-4226-b12b-e13b9a356853','Action plans')
) as v(id, label)
where t.item_id = v.id::uuid and t.locale = 'en';
