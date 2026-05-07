-- Compliance Checklist primitive — default templates seeded per existing org.
--
-- Two templates per org, one per pack:
--   aml-amu      → "Vernerunde – standard"          (7 items, AML/IK-forskriften refs)
--   iso-45001    → "Internrevisjon – ISO 45001:2018" (14 items, clauses 4.1 → 10.3)
--
-- Idempotent via UNIQUE (organization_id, slug). Re-running is safe.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop

    -- ── AML pack: Vernerunde – standard ────────────────────────────────────
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition, is_active
    ) values (
      v_org.id,
      'aml-amu',
      'vernerunde-standard',
      'Vernerunde – standard',
      'Standard vernerunde etter arbeidsmiljøloven og internkontrollforskriften.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object(
          'key','fysisk_arb_omr',
          'prompt','Er det fysiske arbeidsmiljøet forsvarlig?',
          'type','yes_no_na','required',true,
          'law_ref','AML §4-1, §4-4','severity_default','high',
          'help','Vurder belysning, støy, ergonomi, ryddighet.'
        ),
        jsonb_build_object(
          'key','verneutstyr_tilg',
          'prompt','Er nødvendig verneutstyr tilgjengelig og brukt?',
          'type','yes_no_na','required',true,
          'law_ref','AML §3-2 (1)','severity_default','critical'
        ),
        jsonb_build_object(
          'key','psyk_arbmiljo',
          'prompt','Er det forhold som påvirker psykososialt arbeidsmiljø negativt?',
          'type','text','required',false,
          'law_ref','AML §4-3','severity_default','medium'
        ),
        jsonb_build_object(
          'key','kjemikalier',
          'prompt','Er kjemikalier merket og oppbevart riktig?',
          'type','yes_no_na','required',false,
          'law_ref','AML §4-5','severity_default','high'
        ),
        jsonb_build_object(
          'key','evakuering',
          'prompt','Er rømningsveier frie og merkede?',
          'type','yes_no_na','required',true,
          'law_ref','Internkontrollforskriften §5','severity_default','critical'
        ),
        jsonb_build_object(
          'key','foto',
          'prompt','Bilder fra runden',
          'type','photo','required',false
        ),
        jsonb_build_object(
          'key','signatur_verneombud',
          'prompt','Verneombudets signatur',
          'type','signature','required',true,
          'law_ref','AML §6-2'
        )
      )),
      true
    )
    on conflict (organization_id, slug) do nothing;

    -- ── ISO 45001 pack: Internrevisjon – ISO 45001:2018 ─────────────────────
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition, is_active
    ) values (
      v_org.id,
      'iso-45001',
      'iso-45001-internal-audit',
      'Internrevisjon – ISO 45001:2018',
      'Internrevisjon mot ISO 45001 for arbeidsmiljøstyringssystem.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object(
          'key','context_4_1',
          'prompt','Er konteksten for OH&S-systemet vurdert og dokumentert?',
          'type','yes_no_na','required',true,
          'iso_clause','4.1','severity_default','medium'
        ),
        jsonb_build_object(
          'key','leadership_5_1',
          'prompt','Demonstrerer toppledelsen lederskap og forpliktelse?',
          'type','yes_no_na','required',true,
          'iso_clause','5.1','severity_default','high'
        ),
        jsonb_build_object(
          'key','policy_5_2',
          'prompt','Er HMS-policy etablert, kommunisert og tilgjengelig?',
          'type','yes_no_na','required',true,
          'iso_clause','5.2','severity_default','high'
        ),
        jsonb_build_object(
          'key','consultation_5_4',
          'prompt','Er ansattes konsultasjon og medvirkning sikret?',
          'type','text','required',true,
          'iso_clause','5.4','severity_default','high'
        ),
        jsonb_build_object(
          'key','risks_6_1',
          'prompt','Er risikoer og muligheter identifisert og håndtert?',
          'type','yes_no_na','required',true,
          'iso_clause','6.1.2','severity_default','critical'
        ),
        jsonb_build_object(
          'key','legal_6_1_3',
          'prompt','Er lovkrav og andre krav identifisert og oppdatert?',
          'type','yes_no_na','required',true,
          'iso_clause','6.1.3','severity_default','high'
        ),
        jsonb_build_object(
          'key','objectives_6_2',
          'prompt','Er HMS-mål etablert med tiltaksplan?',
          'type','yes_no_na','required',true,
          'iso_clause','6.2','severity_default','medium'
        ),
        jsonb_build_object(
          'key','competence_7_2',
          'prompt','Er kompetansekrav definert og verifisert?',
          'type','yes_no_na','required',true,
          'iso_clause','7.2','severity_default','high'
        ),
        jsonb_build_object(
          'key','operational_8_1',
          'prompt','Er operativ planlegging og kontroll dokumentert?',
          'type','text','required',true,
          'iso_clause','8.1','severity_default','high'
        ),
        jsonb_build_object(
          'key','emergency_8_2',
          'prompt','Er beredskap for hendelser etablert og testet?',
          'type','yes_no_na','required',true,
          'iso_clause','8.2','severity_default','critical'
        ),
        jsonb_build_object(
          'key','monitoring_9_1',
          'prompt','Er overvåking, måling og analyse av HMS-ytelse etablert?',
          'type','yes_no_na','required',true,
          'iso_clause','9.1','severity_default','high'
        ),
        jsonb_build_object(
          'key','incident_10_2',
          'prompt','Er hendelser og avvik undersøkt med korrigerende tiltak?',
          'type','yes_no_na','required',true,
          'iso_clause','10.2','severity_default','critical'
        ),
        jsonb_build_object(
          'key','improvement_10_3',
          'prompt','Pågår kontinuerlig forbedring av systemet?',
          'type','text','required',true,
          'iso_clause','10.3','severity_default','medium'
        ),
        jsonb_build_object(
          'key','auditor_signature',
          'prompt','Revisors signatur',
          'type','signature','required',true,
          'iso_clause','9.2'
        )
      )),
      true
    )
    on conflict (organization_id, slug) do nothing;

  end loop;
end $$;
