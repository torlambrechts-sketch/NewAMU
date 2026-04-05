-- Wiki: revision dates, acknowledgement audience, version snapshots, space files/URLs.

-- ---------------------------------------------------------------------------
-- wiki_pages: compliance review + acknowledgement targeting
-- ---------------------------------------------------------------------------

alter table public.wiki_pages
  add column if not exists next_revision_due_at timestamptz,
  add column if not exists revision_interval_months int not null default 12,
  add column if not exists acknowledgement_audience text not null default 'all_employees'
    check (acknowledgement_audience in ('all_employees', 'leaders_only', 'safety_reps_only', 'department')),
  add column if not exists acknowledgement_department_id uuid references public.departments (id) on delete set null;

create index if not exists wiki_pages_next_revision_idx
  on public.wiki_pages (organization_id, next_revision_due_at);

-- ---------------------------------------------------------------------------
-- Immutable published snapshots (for audits / "what applied at time T")
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_page_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  version int not null,
  title text not null,
  summary text not null default '',
  status text not null,
  template text not null,
  legal_refs text[] not null default '{}',
  requires_acknowledgement boolean not null default false,
  acknowledgement_audience text not null default 'all_employees',
  acknowledgement_department_id uuid references public.departments (id) on delete set null,
  blocks jsonb not null default '[]',
  next_revision_due_at timestamptz,
  revision_interval_months int not null default 12,
  frozen_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (page_id, version)
);

create index if not exists wiki_page_versions_org_idx on public.wiki_page_versions (organization_id);
create index if not exists wiki_page_versions_page_idx on public.wiki_page_versions (page_id);

alter table public.wiki_page_versions enable row level security;

create policy "wiki_page_versions_select_org"
  on public.wiki_page_versions for select
  using (organization_id = public.current_org_id());

-- Only admins / documents.manage insert snapshots (app does this on publish)
create policy "wiki_page_versions_insert_manage"
  on public.wiki_page_versions for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- ---------------------------------------------------------------------------
-- Files + URL references per folder (space)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_space_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  space_id text not null references public.wiki_spaces (id) on delete cascade,
  kind text not null check (kind in ('file', 'url')),
  title text not null,
  file_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists wiki_space_items_space_idx on public.wiki_space_items (space_id);

alter table public.wiki_space_items enable row level security;

create policy "wiki_space_items_select_org"
  on public.wiki_space_items for select
  using (organization_id = public.current_org_id());

create policy "wiki_space_items_insert_manage"
  on public.wiki_space_items for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_space_items_update_manage"
  on public.wiki_space_items for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_space_items_delete_manage"
  on public.wiki_space_items for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- ---------------------------------------------------------------------------
-- Storage for uploaded files
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('wiki_space_files', 'wiki_space_files', false)
on conflict (id) do nothing;

create policy "wiki_space_files_insert_own_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_space_files_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "wiki_space_files_delete_manage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- ---------------------------------------------------------------------------
-- Default next revision when missing (12 months from creation)
-- ---------------------------------------------------------------------------

create or replace function public.wiki_pages_set_default_revision()
returns trigger
language plpgsql
as $$
begin
  if new.next_revision_due_at is null then
    new.next_revision_due_at := new.created_at
      + (coalesce(new.revision_interval_months, 12) * interval '1 month');
  end if;
  return new;
end;
$$;

drop trigger if exists wiki_pages_default_revision on public.wiki_pages;
create trigger wiki_pages_default_revision
  before insert on public.wiki_pages
  for each row execute function public.wiki_pages_set_default_revision();

-- ---------------------------------------------------------------------------
-- Legal coverage + templates (inclusion / annual review)
-- ---------------------------------------------------------------------------

insert into public.wiki_legal_coverage_items (ref, label, template_ids)
values
  ('IK-f §5 nr. 8', 'Årlig gjennomgang av HMS-systemet', array['tpl-aarsgjennomgang']::text[]),
  ('AML kap. 4 / §4-6', 'Individuell tilrettelegging', array['tpl-tilrettelegging']::text[]),
  ('Inkluderingsloven', 'Likestilling og mangfold', array['tpl-likestilling-mangfold']::text[]),
  ('Livsfase / seniorpolitikk', 'Seniorpolitikk og livsfaser', array['tpl-seniorpolitikk']::text[])
on conflict (ref) do update set label = excluded.label, template_ids = excluded.template_ids;

insert into public.document_system_templates (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values
(
  'tpl-tilrettelegging',
  'tpl-tilrettelegging',
  'Rutine for individuell tilrettelegging',
  'Tilrettelegging for ansatte med redusert funksjonsevne etter AML.',
  'procedure',
  array['AML §4-1', 'AML §4-6']::text[],
  '{"title":"Rutine for individuell tilrettelegging","summary":"Kartlegging, dialog og tiltak for tilrettelegging i arbeidet.","status":"draft","template":"standard","legalRefs":["AML §4-6"],"requiresAcknowledgement":true,"blocks":[{"kind":"alert","variant":"info","text":"Arbeidsgiver skal i samarbeid med arbeidstaker tilrettelegge arbeidet når det er nødvendig og mulig (AML §4-6)."},{"kind":"heading","level":1,"text":"Formål og omfang"},{"kind":"text","body":"<p>Beskriv hvordan dere fanger behov for tilrettelegging, hvem som kontaktes, og hvordan tiltak dokumenteres.</p>"},{"kind":"heading","level":2,"text":"Prosedyre"},{"kind":"text","body":"<ol><li>Behov avklares i dialog med arbeidstaker</li><li>Vurdering av tiltak og tidsplan</li><li>Oppfølging og evaluering</li></ol>"}]}'::jsonb,
  95
),
(
  'tpl-likestilling-mangfold',
  'tpl-likestilling-mangfold',
  'Plan for likestilling og mangfold',
  'Overordnet plan knyttet til inkluderingslovens krav.',
  'policy',
  array['Inkluderingsloven']::text[],
  '{"title":"Plan for likestilling og mangfold","summary":"Mål og tiltak for et inkluderende arbeidsliv.","status":"draft","template":"policy","legalRefs":["Inkluderingsloven"],"requiresAcknowledgement":false,"blocks":[{"kind":"heading","level":1,"text":"Likestilling og mangfold"},{"kind":"text","body":"<p>Skisser mål for rekruttering, utvikling og nulltoleranse for diskriminering.</p>"},{"kind":"heading","level":2,"text":"Tiltak"},{"kind":"text","body":"<ul><li>Årlig gjennomgang av lønns- og karrieremønstre</li><li>Tilrettelegging og universell utforming der relevant</li></ul>"}]}'::jsonb,
  96
),
(
  'tpl-seniorpolitikk',
  'tpl-seniorpolitikk',
  'Livsfasepolitikk (seniorpolitikk)',
  'Retningslinjer for seniorfase og overgang til pensjon.',
  'guide',
  array['AML §4-1']::text[],
  '{"title":"Livsfasepolitikk (seniorpolitikk)","summary":"Hvordan virksomheten møter ansatte i ulike livsfaser.","status":"draft","template":"standard","legalRefs":["AML §4-1"],"requiresAcknowledgement":false,"blocks":[{"kind":"heading","level":1,"text":"Seniorpolitikk"},{"kind":"text","body":"<p>Beskriv muligheter for tilpasning av arbeidstid, kompetanse og overgang til pensjon.</p>"}]}'::jsonb,
  97
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;
