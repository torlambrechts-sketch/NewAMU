-- Seed default AML and ISO 45001 pack content per existing org.
-- Mirrors the static content previously held in src/lib/compliance/packs.ts.
-- Idempotent via UNIQUE (organization_id, slug).

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop

    -- ── AML / Internkontrollforskriften ──────────────────────────────────
    insert into public.compliance_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels, severity_labels, position
    ) values (
      v_org.id, 'aml-amu',
      'AML', 'Vernerunder', 'Ny vernerunde',
      'Vernerunder og avvik etter arbeidsmiljøloven og internkontrollforskriften.',
      jsonb_build_array(
        jsonb_build_object('code','AML §3-1','text','Krav til systematisk HMS-arbeid (internkontroll).'),
        jsonb_build_object('code','AML §4-1','text','Generelle krav til arbeidsmiljøet.'),
        jsonb_build_object('code','IK-forskriften §5','text','Internkontrollens innhold (sjekklister, avvik, oppfølging).')
      ),
      jsonb_build_object(
        'open',     'Åpne vernerunder',
        'critical', 'Kritiske avvik',
        'ytd',      'Vernerunder i år'
      ),
      jsonb_build_object(
        'critical', 'Kritisk avvik',
        'high',     'Vesentlig avvik',
        'medium',   'Mindre avvik',
        'low',      'Forbedringspotensial'
      ),
      10
    )
    on conflict (organization_id, slug) do nothing;

    -- ── ISO 45001:2018 ───────────────────────────────────────────────────
    insert into public.compliance_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels, severity_labels, position
    ) values (
      v_org.id, 'iso-45001',
      'ISO 45001', 'Internrevisjoner', 'Ny internrevisjon',
      'Internrevisjoner og samsvarssjekk mot ISO 45001 (arbeidsmiljøstyringssystem).',
      jsonb_build_array(
        jsonb_build_object('code','ISO 45001 §9.2','text','Internal audit — planlegg, gjennomfør, dokumenter og rapporter.'),
        jsonb_build_object('code','ISO 45001 §10.2','text','Incident, nonconformity and corrective action.'),
        jsonb_build_object('code','ISO 45001 §10.3','text','Continual improvement.')
      ),
      jsonb_build_object(
        'open',     'Pågående revisjoner',
        'critical', 'Major NCs',
        'ytd',      'Fullførte i år'
      ),
      jsonb_build_object(
        'critical', 'Major NC',
        'high',     'Major NC',
        'medium',   'Minor NC',
        'low',      'Observation'
      ),
      20
    )
    on conflict (organization_id, slug) do nothing;

  end loop;
end $$;
