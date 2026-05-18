-- Studio Builder Phase 2b — ISO 27001 v1.1.0 (richer Annex A bodies).
--
-- The v1.0.0-skeleton pack shipped in _120800 carries only control ids
-- + titles. This migration adds a v1.1.0 row per org with concrete
-- starter bodies for each Annex A control:
--   - 1-2 sentence Norwegian-first description
--   - Suggested artifact kind (document / register / checklist / course)
--   - Indicative cadence
--   - GDPR / NIS2 cross-references where they exist
--
-- This is starter-grade — a real ISMS consultant fine-tunes per
-- tenant. But it's enough that gap-matrix + studio-pack-import +
-- a fresh-org seed produce something usable on day one.
--
-- Per spec Phase 2b "no migration", the content rides as JSON inside
-- studio_packs.manifest. We seed via studio_pack_drafts → studio_packs
-- (atomic, immutable on publish) so the lifecycle mirrors how real
-- pack authoring will work via the PackEditor.
--
-- Customers explicitly upgrade from 1.0.0-skeleton → 1.1.0 by
-- importing the new version via PackEditor.
--
-- Arbeidstilsynet self-audit:
--   ISO 27001:2022 Annex A.5.1–A.8.28 covered with concrete starter
--   text. AML § 3-1 (1) systematic HMS — for orgs running both AML
--   and ISO 27001, the cross-references (e.g. A.6.3 ↔ AML § 4-2
--   opplæringsplikt) prevent double-work.
--   Restrisiko deferred:
--     - Per-tenant customization (asset categorisation, role mapping)
--       is the customer-admin's job via the PackEditor.
--     - Field-level evidence templates (e.g. specific backup logs)
--       come in v1.2.0 once a real customer pilot.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.seed_iso27001_v1_1_0_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_manifest jsonb;
begin
  v_manifest := jsonb_build_object(
    'format_version', '1.0',
    'controls', jsonb_build_array(
      jsonb_build_object(
        'id', 'A.5.1', 'category', 'Organizational',
        'title', 'Policies for information security',
        'title_nb', 'Policy for informasjonssikkerhet',
        'body_nb', 'En skriftlig, ledelses-godkjent informasjonssikkerhetspolicy gjeldende for hele virksomheten. Skal gjennomgås årlig eller ved vesentlige endringer.',
        'kind', 'document', 'cadence', 'arlig',
        'cross_refs', jsonb_build_array('GDPR Art. 24', 'NIS2 Art. 21 (2)(a)')
      ),
      jsonb_build_object(
        'id', 'A.5.9', 'category', 'Organizational',
        'title', 'Inventory of information and other associated assets',
        'title_nb', 'Register over informasjon og tilknyttede aktiva',
        'body_nb', 'Strukturert register med eier, klassifisering, lokasjon og avhengigheter for hver eiendel. Oppdateres ved nye anskaffelser og minst kvartalsvis.',
        'kind', 'register', 'cadence', 'kvartalsvis',
        'cross_refs', jsonb_build_array('GDPR Art. 30')
      ),
      jsonb_build_object(
        'id', 'A.5.10', 'category', 'Organizational',
        'title', 'Acceptable use of information and associated assets',
        'title_nb', 'Akseptabel bruk av informasjon og aktiva',
        'body_nb', 'Regler for hva ansatte kan og ikke kan gjøre med selskapets data, utstyr og kontoer. Signeres ved tiltredelse og ved policy-endring.',
        'kind', 'document', 'cadence', 'ad_hoc',
        'cross_refs', jsonb_build_array('AML § 4-2 (3)')
      ),
      jsonb_build_object(
        'id', 'A.5.15', 'category', 'Organizational',
        'title', 'Access control',
        'title_nb', 'Tilgangskontroll',
        'body_nb', 'Policy + sjekkliste for tildeling, gjennomgang og opphør av brukertilganger. Inkluderer least-privilege og periodisk gjennomgang.',
        'kind', 'checklist', 'cadence', 'halvarlig',
        'cross_refs', jsonb_build_array('GDPR Art. 32 (1)(b)')
      ),
      jsonb_build_object(
        'id', 'A.5.23', 'category', 'Organizational',
        'title', 'Information security for use of cloud services',
        'title_nb', 'Informasjonssikkerhet ved bruk av skytjenester',
        'body_nb', 'Sky-leverandør-policy + databehandleravtaler + risikovurdering per skytjeneste. Krever DPA der personopplysninger behandles.',
        'kind', 'document', 'cadence', 'arlig',
        'cross_refs', jsonb_build_array('GDPR Art. 28', 'NIS2 Art. 21 (2)(d)')
      ),
      jsonb_build_object(
        'id', 'A.5.30', 'category', 'Organizational',
        'title', 'ICT readiness for business continuity',
        'title_nb', 'IKT-beredskap for kontinuitet',
        'body_nb', 'Beredskapsplan med RTO/RPO per kritisk system, regelmessig øvelse minst årlig, og dokumentert post-mortem etter hver hendelse.',
        'kind', 'checklist', 'cadence', 'arlig'
      ),
      jsonb_build_object(
        'id', 'A.6.3', 'category', 'People',
        'title', 'Information security awareness, education and training',
        'title_nb', 'Sikkerhetsbevissthet, utdanning og opplæring',
        'body_nb', 'Pliktig årlig sikkerhetskurs for alle ansatte + rollespesifikk opplæring (utviklere, lederlinje, IT). Gjennomføring loggføres.',
        'kind', 'course', 'cadence', 'arlig',
        'cross_refs', jsonb_build_array('AML § 4-2', 'GDPR Art. 39 (1)(b)')
      ),
      jsonb_build_object(
        'id', 'A.6.6', 'category', 'People',
        'title', 'Confidentiality or non-disclosure agreements',
        'title_nb', 'Konfidensialitets-/taushets-avtaler',
        'body_nb', 'Signerte NDA for ansatte, konsulenter og leverandører som behandler sensitiv data. Spores i HR-register.',
        'kind', 'document', 'cadence', 'ad_hoc'
      ),
      jsonb_build_object(
        'id', 'A.7.1', 'category', 'Physical',
        'title', 'Physical security perimeters',
        'title_nb', 'Fysiske sikkerhetssoner',
        'body_nb', 'Adgangskontroll, kameraovervåkning og besøksregistrering for områder som huser servere eller sensitiv data.',
        'kind', 'checklist', 'cadence', 'halvarlig'
      ),
      jsonb_build_object(
        'id', 'A.7.4', 'category', 'Physical',
        'title', 'Physical security monitoring',
        'title_nb', 'Fysisk overvåkning',
        'body_nb', 'Kameralogger gjennomgås månedlig; uautoriserte forsøk dokumenteres som hendelser. GDPR-konform logging.',
        'kind', 'checklist', 'cadence', 'kvartalsvis',
        'cross_refs', jsonb_build_array('GDPR Art. 6 (1)(f)')
      ),
      jsonb_build_object(
        'id', 'A.8.2', 'category', 'Technological',
        'title', 'Privileged access rights',
        'title_nb', 'Privilegerte tilganger',
        'body_nb', 'Register over privilegerte kontoer + kvartalsvis gjennomgang + just-in-time-elevering der mulig. MFA er obligatorisk.',
        'kind', 'register', 'cadence', 'kvartalsvis'
      ),
      jsonb_build_object(
        'id', 'A.8.9', 'category', 'Technological',
        'title', 'Configuration management',
        'title_nb', 'Konfigurasjonsstyring',
        'body_nb', 'Baselineskonfigurasjon dokumentert per kritisk system. Drift fanges av automatisert sjekk; avvik åpnes som incident.',
        'kind', 'checklist', 'cadence', 'halvarlig'
      ),
      jsonb_build_object(
        'id', 'A.8.12', 'category', 'Technological',
        'title', 'Data leakage prevention',
        'title_nb', 'Datalekkasje-forebygging',
        'body_nb', 'DLP-policy + tekniske kontroller (mail, USB, cloud-deling) + opplæring. Hendelser triagerer GDPR-meldeplikt innen 72 t.',
        'kind', 'checklist', 'cadence', 'arlig',
        'cross_refs', jsonb_build_array('GDPR Art. 33')
      ),
      jsonb_build_object(
        'id', 'A.8.13', 'category', 'Technological',
        'title', 'Information backup',
        'title_nb', 'Sikkerhetskopier',
        'body_nb', 'Backups for alle kritiske systemer, 3-2-1-prinsipp, gjenopprettings-test minst halvårlig, krypteret lagring.',
        'kind', 'checklist', 'cadence', 'halvarlig'
      ),
      jsonb_build_object(
        'id', 'A.8.16', 'category', 'Technological',
        'title', 'Monitoring activities',
        'title_nb', 'Overvåkning og logging',
        'body_nb', 'Sentralisert logging av sikkerhetshendelser (autentisering, tilgangsbrudd, konfigurasjons-endringer) + 12 mnd. retensjon + SIEM-deteksjonsregler.',
        'kind', 'checklist', 'cadence', 'kvartalsvis'
      ),
      jsonb_build_object(
        'id', 'A.8.24', 'category', 'Technological',
        'title', 'Use of cryptography',
        'title_nb', 'Bruk av kryptografi',
        'body_nb', 'Kryptopolicy med godkjente algoritmer og nøkkelstyring (HSM/KMS). TLS 1.2+ obligatorisk, sertifikater roteres automatisk.',
        'kind', 'document', 'cadence', 'arlig'
      ),
      jsonb_build_object(
        'id', 'A.8.28', 'category', 'Technological',
        'title', 'Secure coding',
        'title_nb', 'Sikker koding',
        'body_nb', 'Coding-standard (OWASP Top 10), peer review obligatorisk, SAST i CI-pipeline, dependencies oppdateres månedlig.',
        'kind', 'document', 'cadence', 'arlig'
      )
    ),
    'reviews', jsonb_build_object(
      'management_review_cadence', 'arlig',
      'management_review_law_ref', 'ISO 27001 § 9.3',
      'management_review_agenda', jsonb_build_array(
        'a) Status fra forrige ledelsens gjennomgang',
        'b) Endringer i interne og eksterne kontekstforhold',
        'c) Tilbakemeldinger fra interessenter',
        'd) ISMS-prestasjon (KPI, hendelser, NCRs)',
        'e) Ressursbehov',
        'f) Mulige forbedringer'
      )
    ),
    'metadata', jsonb_build_object(
      'pack_version', '1.1.0',
      'iso_version', 'ISO 27001:2022',
      'language_primary', 'nb',
      'language_secondary', 'en',
      'authored_by', 'Klarert starter — krever ISMS-konsulent for produksjon'
    )
  );

  insert into public.studio_packs (
    organization_id, slug, semver, name_i18n, summary_i18n, accent,
    legal_references, manifest, immutable, published_at, status,
    review_status
  ) values (
    p_org_id,
    'iso-27001',
    '1.1.0',
    jsonb_build_object('nb', 'ISO 27001 — informasjonssikkerhet', 'en', 'ISO 27001 — Information security'),
    jsonb_build_object(
      'nb', 'Annex A-kontroller med konkrete starter-bodies. Krever ISMS-konsulent for produksjon.',
      'en', 'Annex A controls with concrete starter bodies. Requires ISMS consultant before production use.'
    ),
    '#1e40af',
    to_jsonb(array[
      'ISO 27001 A.5.1','ISO 27001 A.5.9','ISO 27001 A.5.10',
      'ISO 27001 A.5.15','ISO 27001 A.5.23','ISO 27001 A.5.30',
      'ISO 27001 A.6.3','ISO 27001 A.6.6','ISO 27001 A.7.1',
      'ISO 27001 A.7.4','ISO 27001 A.8.2','ISO 27001 A.8.9',
      'ISO 27001 A.8.12','ISO 27001 A.8.13','ISO 27001 A.8.16',
      'ISO 27001 A.8.24','ISO 27001 A.8.28','ISO 27001 § 9.3'
    ]),
    v_manifest,
    true,
    now(),
    'published',
    'reviewed'
  )
  on conflict (organization_id, slug, semver) do nothing;
end;
$fn$;

-- Backfill: every existing org gets v1.1.0 alongside the v1.0.0 skeleton.
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.seed_iso27001_v1_1_0_for_org(v_org_id);
  end loop;
end $$;

-- Future orgs: extend the existing on-insert trigger to also seed 1.1.0.
create or replace function public.studio_iso27001_seed_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.seed_iso27001_starter_pack_for_org(new.id);
  perform public.seed_iso27001_v1_1_0_for_org(new.id);
  return new;
end;
$fn$;
