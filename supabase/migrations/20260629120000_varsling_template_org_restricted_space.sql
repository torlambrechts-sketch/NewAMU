-- Varsling: org contact fields, tpl-varsling catalog, varsling space category, restricted spaces RLS, permission.

-- ---------------------------------------------------------------------------
-- 1. Organizations: varsling contact (for template injection)
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists varsling_contact_id uuid references auth.users (id) on delete set null,
  add column if not exists varsling_contact_email text,
  add column if not exists varsling_channel_description text;

-- ---------------------------------------------------------------------------
-- 2. Wiki spaces: optional permission gate + category 'varsling'
-- ---------------------------------------------------------------------------

alter table public.wiki_spaces
  add column if not exists restricted_permission text;

alter table public.wiki_spaces drop constraint if exists wiki_spaces_category_check;
alter table public.wiki_spaces
  add constraint wiki_spaces_category_check
  check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library', 'varsling'));

-- ---------------------------------------------------------------------------
-- 3. Template tables: allow category 'varsling' where applicable
-- ---------------------------------------------------------------------------

alter table public.document_system_templates drop constraint if exists document_system_templates_category_check;
alter table public.document_system_templates
  add constraint document_system_templates_category_check
  check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library', 'varsling'));

alter table public.document_org_templates drop constraint if exists document_org_templates_category_check;
alter table public.document_org_templates
  add constraint document_org_templates_category_check
  check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library', 'varsling'));

-- ---------------------------------------------------------------------------
-- 4. Permission: varsling.handle (grant to each org's admin role)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'varsling.handle'
from public.role_definitions rd
where rd.slug = 'admin' and rd.is_system = true
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. RLS: wiki_spaces — hide restricted spaces without permission
-- ---------------------------------------------------------------------------

drop policy if exists "wiki_spaces_select_org" on public.wiki_spaces;
create policy "wiki_spaces_select_org"
  on public.wiki_spaces for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      restricted_permission is null
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission(restricted_permission)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. RLS: wiki_pages — inherit restriction from parent space
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
  );

-- ---------------------------------------------------------------------------
-- 7. RLS: wiki_space_items — same as pages (space-scoped)
-- ---------------------------------------------------------------------------

drop policy if exists "wiki_space_items_select_org" on public.wiki_space_items;
create policy "wiki_space_items_select_org"
  on public.wiki_space_items for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.wiki_spaces s
      where s.id = wiki_space_items.space_id
        and s.organization_id = wiki_space_items.organization_id
        and (
          s.restricted_permission is null
          or public.is_org_admin()
          or public.user_has_permission('documents.manage')
          or public.user_has_permission(s.restricted_permission)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Seed system template tpl-varsling (page_payload uses placeholders)
-- ---------------------------------------------------------------------------

insert into public.document_system_templates (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-varsling',
  'tpl-varsling',
  'Varslingsrutine (AML §2A)',
  'Skriftlig intern varslingsrutine som oppfyller kravene i AML §2A-6 og §2A-7',
  'policy',
  array['AML §2A-1', 'AML §2A-2', 'AML §2A-3', 'AML §2A-6', 'AML §2A-7']::text[],
  jsonb_build_object(
    'title', 'Varslingsrutine',
    'summary', 'Intern varslingsrutine etter arbeidsmiljøloven kap. 2A.',
    'status', 'draft',
    'template', 'policy',
    'legalRefs', jsonb_build_array('AML §2A-1', 'AML §2A-2', 'AML §2A-3', 'AML §2A-6', 'AML §2A-7'),
    'requiresAcknowledgement', true,
    'acknowledgementAudience', 'all_employees',
    'revisionIntervalMonths', 12,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'heading', 'level', 1, 'text', 'Varslingsrutine — {orgName}'),
      jsonb_build_object('kind', 'alert', 'variant', 'info', 'text', 'Alle ansatte har rett til å varsle om kritikkverdige forhold uten å frykte gjengjeldelse, jf. AML §2A-1.'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', '1. Hva er varsling?'),
      jsonb_build_object('kind', 'text', 'body', '<p>Kritikkverdige forhold etter AML §2A-1 omfatter blant annet lovbrudd, fare for liv eller helse, korrupsjon, misligheter og brudd på arbeidsmiljøloven.</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', '2. Hvem kan varsles til?'),
      jsonb_build_object('kind', 'text', 'body', '<p><strong>Varslingsmottaker:</strong> {varslingContactBlock}</p><p><strong>Kanal:</strong> {varslingChannelDescription}</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', '3. Slik varsler du'),
      jsonb_build_object('kind', 'text', 'body', '<p>Varsling kan skje skriftlig eller muntlig, anonymt eller åpent. Bruk intern kanal først. Dersom det ikke er forsvarlig, kan du varsle Arbeidstilsynet eller Statsforvalteren.</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', '4. Hva skjer etter varsling?'),
      jsonb_build_object('kind', 'text', 'body', '<ul><li>Bekreftelse av mottak innen 7 dager (AML §2A-3)</li><li>Tilbakemelding om oppfølging innen rimelig tid (inntil 3 måneder)</li><li>Konfidensialitet — kun personer som må kjenne saken får innsyn</li><li>Forbud mot gjengjeldelse (AML §2A-2) med konsekvenser ved brudd</li></ul>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', '5. Eksternt varsling'),
      jsonb_build_object('kind', 'text', 'body', '<p>Ansatte har rett til å varsle eksternt til Arbeidstilsynet, Datatilsynet, Finanstilsynet (sektoravhengig) eller Statsforvalteren når vilkårene i loven er oppfylt.</p>'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'AML kap. 2A (§§2A-1–2A-7)', 'description', 'Regler om varsling og vern mot gjengjeldelse', 'url', 'https://lovdata.no/lov/2005-06-17-62/KAPITTEL_2a'),
      jsonb_build_object('kind', 'module', 'moduleName', 'action_button', 'params', jsonb_build_object('label', 'Meld varslingssak (internt)', 'route', '/varsling/ny', 'variant', 'primary')),
      jsonb_build_object('kind', 'module', 'moduleName', 'acknowledgement_footer', 'params', jsonb_build_object())
    )
  ),
  95
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
  ('AML §2A-6', 'Skriftlig varslingsrutine', array['tpl-varsling']::text[]),
  ('AML §2A-7', 'Krav til varslingskanal', array['tpl-varsling']::text[])
on conflict (ref) do update set
  label = excluded.label,
  template_ids = excluded.template_ids;

-- ---------------------------------------------------------------------------
-- 9. wiki_ensure_org_defaults: restricted varsling case log space
-- ---------------------------------------------------------------------------

create or replace function public.wiki_ensure_org_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then return; end if;

  insert into public.document_org_template_settings (organization_id, template_id, enabled)
  select v_org, t.id, true
  from public.document_system_templates t
  on conflict (organization_id, template_id) do nothing;

  if not exists (select 1 from public.wiki_spaces where organization_id = v_org) then
    insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status)
    values
      (gen_random_uuid()::text, v_org, 'HMS-håndbok',
       'Virksomhetens samlede HMS-dokumentasjon iht. Internkontrollforskriften og Arbeidsmiljøloven.',
       'hms_handbook', '📋', 'active'),
      (gen_random_uuid()::text, v_org, 'Policyer og retningslinjer',
       'Interne retningslinjer og personalpolicyer.',
       'policy', '📜', 'active'),
      (gen_random_uuid()::text, v_org, 'Veiledninger',
       'Praktiske veiledninger og rollebeskrivelser.',
       'guide', '📖', 'active');
  end if;

  if not exists (
    select 1 from public.wiki_spaces
    where organization_id = v_org and category = 'varsling' and restricted_permission = 'varsling.handle'
  ) then
    insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status, restricted_permission)
    values (
      gen_random_uuid()::text,
      v_org,
      'Varslingssaker (konfidensielt)',
      'Dokumentasjon knyttet til varslingssaker. Kun personer med tilgang «varsling.handle» ser denne mappen.',
      'varsling',
      '🔒',
      'active',
      'varsling.handle'
    );
  end if;
end;
$$;
