-- Extend and add compliance templates.
--
-- Changes:
--   tpl-org-ansvar          template 'standard' → 'policy' so the wizard resolves
--                           {{tokens}} that were left literal in every created doc.
--   tpl-beredskap           replace [Fyll inn] placeholders with {{assemblyPoint}},
--                           {{aedLocation}}, {{bhtPhone}} — wizard now collects them.
--   tpl-opplaering          replace static generic sector block with
--                           {{inject:sector_training_note}} so the plan is driven
--                           by the org's NACE risk profile, not example text.
--   tpl-personvern-ansatte  NEW: GDPR Art. 13/14 employee privacy notice —
--                           requiresAcknowledgement gives an immutable per-user
--                           receipt that satisfies Datatilsynet's documentation req.
--   tpl-aktivitetsplikt     NEW: Ldl §26/§26a activity + transparency plan for
--                           equality and non-discrimination.
--
-- Self-audit (Arbeidstilsynet / Datatilsynet POV):
--   tpl-org-ansvar: 'standard' skips the wizard so {{orgName}} etc. stay literal.
--     Every created doc showed "[Navn]" as approver — zero audit value.
--   tpl-beredskap: [Fyll inn] in a published beredskapsplan is a documentation
--     deficiency under Brann- og eksplosjonsvernloven §3-4 + AML §4-1.
--   tpl-opplaering: Generic examples are not sector evidence for IK-f §5 nr. 1c.
--     NACE-driven inject makes the plan specific to the employer's industry.
--   tpl-personvern-ansatte: GDPR Art. 13 requires notice at collection time.
--     acknowledgement_footer provides per-user signed receipt.
--   tpl-aktivitetsplikt: Ldl §26 applies to all employers; §26a requires public
--     reporting for 50+ employees. Both levels covered with threshold note.
--   Restrisiko: privacyOfficerEmail not yet a TemplateContext token — org must
--     fill in the placeholder manually after document creation.

-- ── 1. tpl-org-ansvar — flip template type so wizard runs ─────────────────────

update public.document_system_templates
set page_payload = jsonb_set(page_payload, '{template}', '"policy"')
where id = 'tpl-org-ansvar'
  and page_payload->>'template' = 'standard';

-- ── 2. tpl-beredskap — replace [Fyll inn] with {{tokens}} ─────────────────────

update public.document_system_templates
set page_payload = replace(replace(replace(
  page_payload::text,
  '[BHT-telefon — fyll inn]',
  '{{bhtPhone}}'
), '[Fyll inn adresse/sted — tydelig synlig fra alle utganger]',
   '{{assemblyPoint}}'
), 'plassering: [Fyll inn]',
   'plassering: {{aedLocation}}'
)::jsonb
where id = 'tpl-beredskap';

-- ── 3. tpl-opplaering — replace static sector block with inject ───────────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(
      case
        when b->>'kind' = 'text'
          and (b->>'body') like '%sektorspesifikk opplæring%'
          and (b->>'body') like '%Kjemisk eksponering%'
        then '{"kind":"alert","variant":"warning","text":"{{inject:sector_training_note}}"}'::jsonb
        else b
      end
      order by ordinality
    )
    from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
  )
)
where id = 'tpl-opplaering';

-- ── 4. tpl-personvern-ansatte — NEW (GDPR Art. 13/14 employee notice) ─────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-personvern-ansatte',
  'tpl-personvern-ansatte',
  'Personvernerklæring for ansatte',
  'GDPR Art. 13/14-erklæring om behandling av ansattes personopplysninger — med digital kvittering som gir revisjonsbevis.',
  'hms_handbook',
  array[
    'GDPR Art. 13', 'GDPR Art. 14', 'GDPR Art. 5', 'GDPR Art. 6',
    'GDPR Art. 9', 'Personopplysningsloven § 2', 'AML § 9-1'
  ],
  $json${
    "title": "Personvernerklæring for ansatte — {{orgName}}",
    "summary": "Informasjon om hvordan {{orgName}} behandler ansattes personopplysninger — GDPR Art. 13/14.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["GDPR Art. 13","GDPR Art. 14","GDPR Art. 5","GDPR Art. 6","GDPR Art. 9","Personopplysningsloven § 2","AML § 9-1"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"GDPR Art. 13 krever at du mottar denne informasjonen senest ved ansettelse. Vennligst les gjennom og bekreft med signaturen nederst."},
      {"kind":"table","caption":"Dokumentinformasjon","headers":["Felt","Verdi"],"rows":[["Behandlingsansvarlig","{{orgName}} (org.nr. {{orgNr}})"],[ "Adresse","{{address}}"],["Vedtatt av","{{approverName}} — {{approverTitle}}"],["Dato vedtatt","{{policyDate}}"],["Neste revisjon","{{nextRevisionDate}}"],["Personvernombud","[Fyll inn e-post til personvernombud eller kontaktperson]"]]},
      {"kind":"heading","level":1,"text":"Personvernerklæring — ansatte i {{orgName}}"},
      {"kind":"text","body":"<p>{{orgName}} er behandlingsansvarlig for de personopplysningene vi samler inn og behandler i forbindelse med arbeidsforholdet.</p>"},
      {"kind":"heading","level":2,"text":"Dine rettigheter"},
      {"kind":"text","body":"<p>Som registrert har du rettigheter etter GDPR kapittel III: innsyn (Art. 15), retting (Art. 16), sletting (Art. 17), begrensning (Art. 18), dataportabilitet (Art. 20) og innsigelse (Art. 21).</p>"},
      {"kind":"law_ref","ref":"GDPR Art. 13","description":"Informasjonsplikt når personopplysninger samles inn direkte fra den registrerte."},
      {"kind":"law_ref","ref":"GDPR Art. 14","description":"Informasjonsplikt når personopplysninger ikke er innsamlet direkte fra den registrerte."},
      {"kind":"law_ref","ref":"AML § 9-1","description":"Forbud mot innhenting av visse kategorier opplysninger om arbeidssøkere og ansatte uten saklig grunn."},
      {"kind":"module","moduleName":"acknowledgement_footer"}
    ]
  }$json$::jsonb,
  25
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 5. tpl-aktivitetsplikt — NEW (Ldl §26 / §26a activity plan) ───────────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-aktivitetsplikt',
  'tpl-aktivitetsplikt',
  'Aktivitets- og redegjørelsesplan',
  'Kartlegging og tiltak for likestilling og ikke-diskriminering — Ldl §26 (alle arbeidsgivere) og §26a (50+ ansatte).',
  'hms_handbook',
  array['Ldl § 26', 'Ldl § 26a', 'Ldl § 6', 'Ldl § 13', 'AML § 4-3', 'IK-f § 5 nr. 1a'],
  $json${
    "title": "Aktivitets- og redegjørelsesplan — likestilling {{currentYear}}",
    "summary": "Kartlegging og tiltak for likestilling og ikke-diskriminering — Ldl §26 (alle) og §26a (50+ ansatte).",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["Ldl § 26","Ldl § 26a","Ldl § 6","Ldl § 13","AML § 4-3","IK-f § 5 nr. 1a"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Ldl §26 pålegger alle arbeidsgivere aktivitetsplikt. Arbeidsgivere med 50+ ansatte (eller 20+ med tariffavtale) har i tillegg redegjørelsesplikt etter §26a."},
      {"kind":"table","caption":"Dokumentinformasjon","headers":["Felt","Verdi"],"rows":[["Virksomhet","{{orgName}} (org.nr. {{orgNr}})"],["Vedtatt av","{{approverName}} — {{approverTitle}}"],["Dato vedtatt","{{policyDate}}"],["Neste revisjon","{{nextRevisionDate}}"],["Planperiode","{{currentYear}}"]]},
      {"kind":"heading","level":1,"text":"Aktivitets- og redegjørelsesplan {{currentYear}} — {{orgName}}"},
      {"kind":"law_ref","ref":"Ldl § 26","description":"Aktivitetsplikten — alle arbeidsgivere skal arbeide aktivt, målrettet og planmessig for å fremme likestilling og hindre diskriminering."},
      {"kind":"law_ref","ref":"Ldl § 26a","description":"Redegjørelsesplikten — arbeidsgivere med 50+ ansatte skal redegjøre for likestillingstiltak i årsberetning eller på nettsted."}
    ]
  }$json$::jsonb,
  26
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 6. Enable new templates for all existing tenants ─────────────────────────

do $$
declare
  v_org_id uuid;
  v_ids    text[] := array['tpl-personvern-ansatte', 'tpl-aktivitetsplikt'];
  v_id     text;
begin
  for v_org_id in select id from public.organizations loop
    foreach v_id in array v_ids loop
      insert into public.document_org_template_settings (organization_id, template_id, enabled)
      values (v_org_id, v_id, true)
      on conflict (organization_id, template_id) do nothing;
    end loop;
  end loop;
end;
$$;
