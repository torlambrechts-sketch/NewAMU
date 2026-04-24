-- AMU space flag, seed space per org, tpl-amu-protokoll, RLS for AMU visibility + amu.member broad read.

-- ---------------------------------------------------------------------------
-- 1. wiki_spaces: mark AMU folder (for RLS and reliable detection)
-- ---------------------------------------------------------------------------

alter table public.wiki_spaces
  add column if not exists is_amu_space boolean not null default false;

comment on column public.wiki_spaces.is_amu_space is
  'True for the org AMU folder — published pages here are readable by all org members (AML §7-4).';

-- ---------------------------------------------------------------------------
-- 2. Permission amu.member (AMU members — full read access per AML §7-2(4))
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'amu.member'
from public.role_definitions rd
where rd.slug = 'admin' and rd.is_system = true
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. wiki_pages SELECT — AMU published pages visible to all org members
-- ---------------------------------------------------------------------------

drop policy if exists "wiki_pages_select_org" on public.wiki_pages;

create policy "wiki_pages_select_org"
  on public.wiki_pages for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      exists (
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
      or (
        wiki_pages.status = 'published'
        and exists (
          select 1
          from public.wiki_spaces s
          where s.id = wiki_pages.space_id
            and s.organization_id = wiki_pages.organization_id
            and coalesce(s.is_amu_space, false)
        )
      )
    )
    and (
      not coalesce(wiki_pages.contains_pii, false)
      or not (
        wiki_pages.pii_categories && array['helse', 'fagforeningsmedlemskap', 'etnisitet']::text[]
      )
      or public.user_has_permission('hr.sensitive')
      or public.is_org_admin()
      or public.user_has_permission('amu.member')
    )
  );

drop policy if exists "wiki_pages_amu_member_read" on public.wiki_pages;
create policy "wiki_pages_amu_member_read"
  on public.wiki_pages for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('amu.member')
  );

-- ---------------------------------------------------------------------------
-- 4. Seed AMU space for orgs that do not already have one (title or flag)
-- ---------------------------------------------------------------------------

insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status, is_amu_space)
select
  gen_random_uuid()::text,
  o.id,
  'AMU — Arbeidsmiljøutvalg',
  'Protokoller, årsrapporter og vedtak fra AMU (AML §7-4)',
  'procedure',
  '🏛️',
  'active',
  true
from public.organizations o
where not exists (
  select 1
  from public.wiki_spaces s
  where s.organization_id = o.id
    and (s.title ilike '%amu%' or coalesce(s.is_amu_space, false))
);

-- Mark existing AMU-like folders
update public.wiki_spaces
set is_amu_space = true
where title ilike '%amu%'
  and coalesce(is_amu_space, false) = false;

-- ---------------------------------------------------------------------------
-- 5. wiki_ensure_org_defaults — ensure AMU space exists for new activity
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
    insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status, is_amu_space)
    values
      (gen_random_uuid()::text, v_org, 'HMS-håndbok',
       'Virksomhetens samlede HMS-dokumentasjon iht. Internkontrollforskriften og Arbeidsmiljøloven.',
       'hms_handbook', '📋', 'active', false),
      (gen_random_uuid()::text, v_org, 'Policyer og retningslinjer',
       'Interne retningslinjer og personalpolicyer.',
       'policy', '📜', 'active', false),
      (gen_random_uuid()::text, v_org, 'Veiledninger',
       'Praktiske veiledninger og rollebeskrivelser.',
       'guide', '📖', 'active', false);
  end if;

  if not exists (
    select 1 from public.wiki_spaces
    where organization_id = v_org
      and (title ilike '%amu%' or coalesce(is_amu_space, false))
  ) then
    insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status, is_amu_space)
    values (
      gen_random_uuid()::text,
      v_org,
      'AMU — Arbeidsmiljøutvalg',
      'Protokoller, årsrapporter og vedtak fra AMU (AML §7-4)',
      'procedure',
      '🏛️',
      'active',
      true
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. System template: AMU meeting protocol
-- ---------------------------------------------------------------------------

insert into public.document_system_templates (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-amu-protokoll',
  'tpl-amu-protokoll',
  'AMU-møteprotokoll',
  'Protokoll fra AMU-møte etter AML §7-2 og §7-4.',
  'procedure',
  array['AML §7-2', 'AML §7-4']::text[],
  jsonb_build_object(
    'title', 'AMU-protokoll — møte [dato]',
    'summary', 'Protokoll fra AMU-møte.',
    'status', 'draft',
    'template', 'standard',
    'legalRefs', jsonb_build_array('AML §7-2', 'AML §7-4'),
    'requiresAcknowledgement', false,
    'revisionIntervalMonths', 999,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'heading', 'level', 1, 'text', 'AMU-protokoll — møte {dato}'),
      jsonb_build_object('kind', 'text', 'body',
        '<p>Møtedato: [dato]<br/>Møtested: [sted]<br/>Tilstede: [navneliste — representanter fra arbeidsgiver og ansatte]<br/>Arbeidsgiverside: [navn, tittel]<br/>Ansattside: [navn, verneombud/representant]</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Saksliste'),
      jsonb_build_object('kind', 'text', 'body', '<p>Sak 1: …<br/>Sak 2: …<br/>Sak 3: …</p>'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Vedtak'),
      jsonb_build_object('kind', 'alert', 'variant', 'warning', 'text', 'Vedtak er bindende for virksomheten iht. AML §7-2'),
      jsonb_build_object('kind', 'heading', 'level', 2, 'text', 'Signaturer'),
      jsonb_build_object('kind', 'text', 'body', '<p>Leder AMU: _____ · Sekretær: _____</p>'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'AML §7-1', 'description', 'Arbeidsmiljøutvalget', 'url', 'https://lovdata.no/lov/2005-06-17-62/§7-1'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'AML §7-2', 'description', 'AMUs oppgaver og vedtak', 'url', 'https://lovdata.no/lov/2005-06-17-62/§7-2'),
      jsonb_build_object('kind', 'law_ref', 'ref', 'AML §7-4', 'description', 'Protokoller og årsrapport', 'url', 'https://lovdata.no/lov/2005-06-17-62/§7-4')
    )
  ),
  98
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
  ('AML §7-4', 'AMU-protokoller tilgjengelig for ansatte', array['tpl-amu-protokoll', 'tpl-amu-rapport']::text[])
on conflict (ref) do update set
  label = excluded.label,
  template_ids = (
    select coalesce(array_agg(distinct x), '{}'::text[])
    from unnest(
      coalesce(
        (select w.template_ids from public.wiki_legal_coverage_items w where w.ref = excluded.ref),
        '{}'::text[]
      ) || excluded.template_ids
    ) as x
  );
