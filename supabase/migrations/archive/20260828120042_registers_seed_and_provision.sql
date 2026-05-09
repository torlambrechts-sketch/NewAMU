-- Registers — seed three system types + provision per-org settings.
-- See specs/registers-engine.md §5 (T3 + T6).
--
-- Three system types prove the engine across compliance frameworks:
--   1. chemicals                    → AML §4-5 + ISO 14001 + REACH
--   2. external_suppliers           → ISO 9001 §8.4 + åpenhetsloven + AML §2-2
--   3. gdpr_processing_activities   → GDPR Art. 30
--
-- Provisioning mirrors documents (_120033) + survey (_120031 + _120039):
--   - `provision_registers_baseline_for_org(p_org_id uuid)` enables
--     every active system register type for the org via on-conflict-do-
--     nothing into register_org_settings. Idempotent.
--   - Trigger on `organizations` insert calls the function for every
--     new tenant.
--   - Backfill loop runs the function for every existing org so this
--     migration is safe to apply to a long-running DB.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Seed: chemicals ────────────────────────────────────────────────────

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'chemicals', null,
  'Kjemikalieregister',
  'Stoffer og blandinger som håndteres på arbeidsplassen — med fareklassifisering, sikkerhetsdatablader og lagringssted. Dekker AML §4-5, ISO 14001 og REACH/CLP.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'name',           'label', 'Navn',                'kind', 'text',         'required', true),
      jsonb_build_object('key', 'cas_number',     'label', 'CAS-nummer',          'kind', 'text',         'hint', 'F.eks. 64-17-5'),
      jsonb_build_object('key', 'manufacturer',   'label', 'Produsent',           'kind', 'text'),
      jsonb_build_object('key', 'storage_location','label','Lagringssted',        'kind', 'text'),
      jsonb_build_object('key', 'h_phrases',      'label', 'H-setninger',         'kind', 'select_multi',
        'hint', 'Faresetninger fra CLP-forordningen',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'H200', 'label', 'H200 — Eksplosivt'),
          jsonb_build_object('value', 'H220', 'label', 'H220 — Brennbar gass'),
          jsonb_build_object('value', 'H225', 'label', 'H225 — Lett antennelig væske'),
          jsonb_build_object('value', 'H300', 'label', 'H300 — Dødelig ved svelging'),
          jsonb_build_object('value', 'H314', 'label', 'H314 — Etsende'),
          jsonb_build_object('value', 'H315', 'label', 'H315 — Hudirritasjon'),
          jsonb_build_object('value', 'H319', 'label', 'H319 — Øyeirritasjon'),
          jsonb_build_object('value', 'H334', 'label', 'H334 — Allergi/astma ved innånding'),
          jsonb_build_object('value', 'H335', 'label', 'H335 — Luftveisirritasjon'),
          jsonb_build_object('value', 'H340', 'label', 'H340 — Genetiske skader'),
          jsonb_build_object('value', 'H350', 'label', 'H350 — Kreftfremkallende'),
          jsonb_build_object('value', 'H360', 'label', 'H360 — Reproduksjonsskader'),
          jsonb_build_object('value', 'H400', 'label', 'H400 — Giftig for vannlevende')
        )),
      jsonb_build_object('key', 'hazard_class',   'label', 'Fareklasse',          'kind', 'select',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'flammable',     'label', 'Brannfarlig'),
          jsonb_build_object('value', 'corrosive',     'label', 'Etsende'),
          jsonb_build_object('value', 'toxic',         'label', 'Giftig'),
          jsonb_build_object('value', 'health_hazard', 'label', 'Helsefare'),
          jsonb_build_object('value', 'environmental', 'label', 'Miljøfare'),
          jsonb_build_object('value', 'oxidizing',     'label', 'Oksiderende'),
          jsonb_build_object('value', 'low',           'label', 'Lav fare')
        )),
      jsonb_build_object('key', 'sds_attached',   'label', 'Sikkerhetsdatablad lagret', 'kind', 'boolean',
        'hint', 'Lenke SDS-dokumentet i Dokumenter-modulen'),
      jsonb_build_object('key', 'annual_volume_kg','label','Årlig forbruk (kg)',  'kind', 'number')
    )
  ),
  array['aml', 'iso-14001', 'reach']::text[],
  array['aml-amu', 'iso-45001']::text[],
  12,
  true, true, 10
)
on conflict (id) do nothing;

-- ── 2. Seed: external_suppliers ───────────────────────────────────────────

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'external_suppliers', null,
  'Leverandørregister',
  'Eksterne leverandører og underleverandører — med risikoklassifisering, aktsomhetsvurderingsstatus og kontrakthistorikk. Dekker ISO 9001 §8.4, åpenhetsloven §4 og AML §2-2.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'name',                'label', 'Selskap',               'kind', 'text', 'required', true),
      jsonb_build_object('key', 'org_number',          'label', 'Organisasjonsnummer',   'kind', 'text', 'hint', '9 siffer'),
      jsonb_build_object('key', 'contact_person',      'label', 'Kontaktperson',         'kind', 'text'),
      jsonb_build_object('key', 'category',            'label', 'Kategori',              'kind', 'select',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'service',       'label', 'Tjeneste'),
          jsonb_build_object('value', 'goods',         'label', 'Varer'),
          jsonb_build_object('value', 'subcontractor', 'label', 'Underleverandør'),
          jsonb_build_object('value', 'consultant',    'label', 'Konsulent'),
          jsonb_build_object('value', 'other',         'label', 'Annet')
        )),
      jsonb_build_object('key', 'criticality',         'label', 'Kritikalitet',          'kind', 'select',
        'hint', 'Hvor avhengig er virksomheten av denne leverandøren?',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'high',   'label', 'Høy'),
          jsonb_build_object('value', 'medium', 'label', 'Middels'),
          jsonb_build_object('value', 'low',    'label', 'Lav')
        )),
      jsonb_build_object('key', 'due_diligence_status','label', 'Aktsomhetsvurdering',   'kind', 'select',
        'hint', 'Åpenhetsloven §4 — kartlagt risiko for menneskerettigheter / arbeidsforhold',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'not_started', 'label', 'Ikke startet'),
          jsonb_build_object('value', 'in_progress', 'label', 'Pågående'),
          jsonb_build_object('value', 'completed',   'label', 'Gjennomført'),
          jsonb_build_object('value', 'not_applicable','label','Ikke aktuelt')
        )),
      jsonb_build_object('key', 'last_audit_at',       'label', 'Sist revidert',         'kind', 'date'),
      jsonb_build_object('key', 'contract_active',     'label', 'Aktiv kontrakt',        'kind', 'boolean')
    )
  ),
  array['iso-9001', 'apenhetsloven', 'aml']::text[],
  array['iso-45001', 'apenhetsloven']::text[],
  24,
  true, true, 20
)
on conflict (id) do nothing;

-- ── 3. Seed: gdpr_processing_activities ───────────────────────────────────

insert into public.register_types (
  id, organization_id, name, description, metadata_schema,
  regulation_ids, pack_slugs, default_review_cadence_months,
  is_active, is_system, position
) values (
  'gdpr_processing_activities', null,
  'Behandlingsprotokoll',
  'Oversikt over behandlingsaktiviteter for personopplysninger — påkrevd etter GDPR Artikkel 30. Tilgjengelig for Datatilsynet ved tilsyn.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'purpose',         'label', 'Formål',                  'kind', 'text', 'required', true,
        'hint', 'Hvorfor behandler virksomheten disse opplysningene?'),
      jsonb_build_object('key', 'legal_basis',     'label', 'Behandlingsgrunnlag',     'kind', 'select', 'required', true,
        'options', jsonb_build_array(
          jsonb_build_object('value', 'consent',             'label', 'Samtykke (Art. 6.1.a)'),
          jsonb_build_object('value', 'contract',            'label', 'Avtale (Art. 6.1.b)'),
          jsonb_build_object('value', 'legal_obligation',    'label', 'Rettslig forpliktelse (Art. 6.1.c)'),
          jsonb_build_object('value', 'vital_interest',      'label', 'Vitale interesser (Art. 6.1.d)'),
          jsonb_build_object('value', 'public_interest',     'label', 'Allmennhetens interesse (Art. 6.1.e)'),
          jsonb_build_object('value', 'legitimate_interest', 'label', 'Berettiget interesse (Art. 6.1.f)')
        )),
      jsonb_build_object('key', 'data_subjects',   'label', 'Registrerte',             'kind', 'select_multi',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'employees', 'label', 'Ansatte'),
          jsonb_build_object('value', 'customers', 'label', 'Kunder'),
          jsonb_build_object('value', 'vendors',   'label', 'Leverandører'),
          jsonb_build_object('value', 'visitors',  'label', 'Besøkende'),
          jsonb_build_object('value', 'children',  'label', 'Barn under 16'),
          jsonb_build_object('value', 'public',    'label', 'Publikum')
        )),
      jsonb_build_object('key', 'data_categories', 'label', 'Datakategorier',          'kind', 'select_multi',
        'options', jsonb_build_array(
          jsonb_build_object('value', 'identity',  'label', 'Identifikasjonsdata'),
          jsonb_build_object('value', 'contact',   'label', 'Kontaktinformasjon'),
          jsonb_build_object('value', 'financial', 'label', 'Økonomiske opplysninger'),
          jsonb_build_object('value', 'health',    'label', 'Helseopplysninger (særlig kategori)'),
          jsonb_build_object('value', 'biometric', 'label', 'Biometriske data (særlig kategori)'),
          jsonb_build_object('value', 'union',     'label', 'Fagforeningstilhørighet (særlig kategori)'),
          jsonb_build_object('value', 'criminal',  'label', 'Straffedommer / lovbrudd'),
          jsonb_build_object('value', 'location',  'label', 'Lokasjonsdata')
        )),
      jsonb_build_object('key', 'retention_period','label', 'Lagringstid',             'kind', 'text',
        'hint', 'F.eks. "5 år etter avslutning av arbeidsforhold"'),
      jsonb_build_object('key', 'transfer_eea',    'label', 'Overføring utenfor EØS',  'kind', 'boolean'),
      jsonb_build_object('key', 'dpia_required',   'label', 'DPIA gjennomført',        'kind', 'boolean',
        'hint', 'Vurdering av personvernkonsekvenser (Art. 35)')
    )
  ),
  array['gdpr']::text[],
  array['gdpr']::text[],
  12,
  true, true, 30
)
on conflict (id) do nothing;

-- ── 4. provision_registers_baseline_for_org ───────────────────────────────

create or replace function public.provision_registers_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mirror every active system register type into a per-org settings
  -- row with enabled=true + nav_pinned=true so new tenants discover the
  -- registers from day one. Customer admins toggle individual types
  -- off via the Innstillinger tab.
  insert into public.register_org_settings (
    organization_id, register_type_id, enabled, nav_pinned
  )
  select p_org_id, t.id, true, true
  from public.register_types t
  where t.organization_id is null
    and t.is_system = true
    and t.is_active = true
  on conflict (organization_id, register_type_id) do nothing;
end;
$$;

revoke all on function public.provision_registers_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_registers_baseline_for_org(uuid) to authenticated, service_role;

-- ── 5. Trigger: new-org auto-baseline ─────────────────────────────────────

create or replace function public.registers_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_registers_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists registers_provision_on_org_insert_tg on public.organizations;
create trigger registers_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.registers_provision_on_org_insert();

-- ── 6. Backfill every existing org ────────────────────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_registers_baseline_for_org(v_org.id);
  end loop;
end $$;
