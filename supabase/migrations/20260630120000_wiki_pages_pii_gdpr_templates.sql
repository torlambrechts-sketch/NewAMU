-- PII columns on wiki_pages, hr.sensitive RLS, GDPR system templates, legal coverage.

-- ---------------------------------------------------------------------------
-- 1. wiki_pages: PII classification
-- ---------------------------------------------------------------------------

alter table public.wiki_pages
  add column if not exists contains_pii boolean not null default false,
  add column if not exists pii_categories text[] not null default '{}',
  add column if not exists pii_legal_basis text,
  add column if not exists pii_retention_note text;

-- ---------------------------------------------------------------------------
-- 2. Permission hr.sensitive (grant to org admin role)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'hr.sensitive'
from public.role_definitions rd
where rd.slug = 'admin' and rd.is_system = true
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. wiki_pages SELECT — restrict sensitive special-category PII
-- ---------------------------------------------------------------------------

drop policy if exists "wiki_pages_select_org" on public.wiki_pages;

create policy "wiki_pages_select_org"
  on public.wiki_pages for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.wiki_spaces s
      where s.id = wiki_pages.space_id
        and s.organization_id = wiki_pages.organization_id
        and (
          s.restricted_permission is null
          or public.is_org_admin()
          or public.user_has_permission('documents.manage')
          or public.user_has_permission(s.restricted_permission)
        )
    )
    and (
      not coalesce(wiki_pages.contains_pii, false)
      or not (
        wiki_pages.pii_categories && array['helse', 'fagforeningsmedlemskap', 'etnisitet']::text[]
      )
      or public.user_has_permission('hr.sensitive')
      or public.is_org_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. System templates: personvern (ansatte) + behandlingsprotokoll
-- ---------------------------------------------------------------------------

insert into public.document_system_templates (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-personvern-ansatt',
  'tpl-personvern-ansatt',
  'Personvernerklæring for ansatte',
  'Informasjon til ansatte om behandling av personopplysninger (GDPR art. 13–14, personopplysningsloven).',
  'policy',
  array['GDPR Art. 13', 'GDPR Art. 14', 'Personopplysningsloven §2']::text[],
  jsonb_build_object(
    'title', 'Personvernerklæring for ansatte',
    'summary', 'Hvordan vi behandler personopplysninger om deg i arbeidsforholdet.',
    'status', 'draft',
    'template', 'policy',
    'legalRefs', jsonb_build_array('GDPR Art. 13', 'GDPR Art. 14', 'Personopplysningsloven §2'),
    'requiresAcknowledgement', true,
    'acknowledgementAudience', 'all_employees',
    'revisionIntervalMonths', 12,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'alert', 'variant', 'info', 'text', 'Dette dokumentet skal gi deg informasjon i tråd med GDPR art. 13 og 14. Fyll ut alle avsnitt merket [FYLL INN].'),
      jsonb_build_object('kind', 'heading', 'level', 1, 'text', 'Personvernerklæring for ansatte'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Behandlingsansvarlig'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Virksomhetens navn, organisasjonsnummer, adresse, kontaktperson for personvern (navn, e-post, telefon).]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Personvernombud'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Navn og kontaktinfo til personvernombud, eller «Vi har ikke utpekt personvernombud» hvis unntak gjelder.]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Formål og rettslig grunnlag'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Tabell eller punktliste — hver behandlingsaktivitet: formål og rettslig grunnlag etter GDPR art. 6 (og art. 9 ved særlige kategorier).]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Lagringstid'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Lagringstid per kategori av opplysninger og kriterier for sletting.]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Databehandlere og overføringer'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Liste over databehandlere, formål, og om opplysninger overføres utenfor EØS (sikkerhetsmekanismer / SCC / beslutning om tilstrekkelighet).]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Dine rettigheter'),
      jsonb_build_object('kind', 'text', 'body', '<p>[FYLL INN: Beskriv rett til innsyn, sletting, begrensning, dataportabilitet, innsigelse og hvordan den ansatte utøver rettighetene.]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Klage til Datatilsynet'),
      jsonb_build_object('kind', 'text', 'body', '<p>Du har rett til å klage til Datatilsynet dersom du mener behandlingen er i strid med regelverket. Kontakt: <a href="https://www.datatilsynet.no">www.datatilsynet.no</a>.</p><p>[FYLL INN: Eventuell intern klagekanal først.]</p>'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'GDPR art. 13–14', 'description', 'Informasjonsplikt overfor den registrerte', 'url', 'https://lovdata.no/dokument/NL/lov/2018-06-15-38'),
      jsonb_build_object('kind', 'module', 'moduleName', 'acknowledgement_footer', 'params', jsonb_build_object())
    )
  ),
  96
)
on conflict (id) do update set
  slug = excluded.slug,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

insert into public.document_system_templates (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-behandlingsprotokoll',
  'tpl-behandlingsprotokoll',
  'Behandlingsprotokoll (GDPR art. 30)',
  'Oversikt over behandlingsaktiviteter — internt dokument for behandlingsansvarlig.',
  'policy',
  array['GDPR Art. 30', 'Personopplysningsloven §2']::text[],
  jsonb_build_object(
    'title', 'Behandlingsprotokoll',
    'summary', 'Register over behandlingsaktiviteter etter GDPR art. 30.',
    'status', 'draft',
    'template', 'wide',
    'legalRefs', jsonb_build_array('GDPR Art. 30', 'Personopplysningsloven §2'),
    'requiresAcknowledgement', false,
    'revisionIntervalMonths', 12,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'alert', 'variant', 'warning', 'text', 'Intern dokumentasjon. Ved endringer: oppdater protokollen og vurder behov for DPIA (særlig ved videoovervåking).'),
      jsonb_build_object('kind', 'heading', 'level', 1, 'text', 'Behandlingsprotokoll'),
      jsonb_build_object('kind', 'text', 'body', '<p><strong>Kolonner:</strong> Behandlingsaktivitet | Formål | Rettslig grunnlag | Kategorier av registrerte / personopplysninger | Mottakere | Lagring | Sikkerhetstiltak</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Lønnsutbetaling'),
      jsonb_build_object('kind', 'text', 'body', '<p>Lønnsutbetaling | Lønn og arbeidsavtale | GDPR art. 6 nr. 1 bokstav b og c | Ansatte, lønnsdata, skatteopplysninger | Lønnssystem, bank, Skatteetaten | [FYLL INN: lagringstid] | [FYLL INN: tiltak]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Fraværsregistrering'),
      jsonb_build_object('kind', 'text', 'body', '<p>Fraværsregistrering | Sykefravær og permisjoner | GDPR art. 6 nr. 1 bokstav b og c | Ansatte, fraværsdata | HR-system, NAV ved behov | [FYLL INN] | [FYLL INN]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Rekruttering'),
      jsonb_build_object('kind', 'text', 'body', '<p>Rekruttering | Nyansettelser | GDPR art. 6 nr. 1 bokstav b | Søkere, CV, referanser | Rekrutteringsverktøy, intervjuer | [FYLL INN] | [FYLL INN]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'HMS-registre og avvikslogg'),
      jsonb_build_object('kind', 'text', 'body', '<p>HMS / avvik | Internkontroll og arbeidsmiljø | GDPR art. 6 nr. 1 bokstav c | Ansatte, hendelsesbeskrivelser | Ledelse, verneombud | [FYLL INN] | [FYLL INN]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Videoovervåking (hvis aktuelt)'),
      jsonb_build_object('kind', 'text', 'body', '<p>Videoovervåking | Sikkerhet / drift | GDPR art. 6 nr. 1 bokstav f (berettiget interesse), vurder art. 9 | Besøkende og ansatte | [FYLL INN leverandør] | [FYLL INN] | Krever ofte DPIA — [FYLL INN status]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Elektronisk adgangskontroll'),
      jsonb_build_object('kind', 'text', 'body', '<p>Adgangskontroll | Sikkerhet og sporbarhet | GDPR art. 6 nr. 1 bokstav f | Ansatte, tid/sted | Leverandør av adgangssystem | [FYLL INN] | [FYLL INN]</p>'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'GDPR art. 30', 'description', 'Behandlingsprotokoll', 'url', 'https://lovdata.no/dokument/NL/lov/2018-06-15-38')
    )
  ),
  97
)
on conflict (id) do update set
  slug = excluded.slug,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

insert into public.wiki_legal_coverage_items (ref, label, template_ids) values
  ('GDPR Art. 13', 'Informasjon til den registrerte (ansatte)', array['tpl-personvern-ansatt']::text[]),
  ('GDPR Art. 14', 'Informasjon når opplysninger ikke er innhentet fra den registrerte', array['tpl-personvern-ansatt']::text[]),
  ('Personopplysningsloven §2', 'Behandling av personopplysninger', array['tpl-personvern-ansatt', 'tpl-behandlingsprotokoll']::text[]),
  ('GDPR Art. 30', 'Behandlingsprotokoll', array['tpl-behandlingsprotokoll']::text[])
on conflict (ref) do update set
  label = excluded.label,
  template_ids = excluded.template_ids;
