-- document_template_versions — append-only snapshot log for
-- document_org_templates. Same pattern as compliance / survey
-- snapshot tables.
--
-- Snapshot triggers on changes to title / description / category /
-- legal_basis / page_payload — the substantive content of a document
-- template. Cosmetic-only updates (e.g. updated_at touch) are skipped.

create table if not exists public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.document_org_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists document_template_versions_tpl_idx
  on public.document_template_versions (template_id, created_at desc);
create index if not exists document_template_versions_org_idx
  on public.document_template_versions (organization_id, created_at desc);

alter table public.document_template_versions enable row level security;

drop policy if exists document_template_versions_select on public.document_template_versions;
create policy document_template_versions_select
  on public.document_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.document_template_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.label is not distinct from new.label
     and old.description is not distinct from new.description
     and old.category is not distinct from new.category
     and old.legal_basis is not distinct from new.legal_basis
     and old.page_payload::text is not distinct from new.page_payload::text
  then
    return new;
  end if;
  insert into public.document_template_versions
    (template_id, organization_id, snapshot, changed_by)
  values (
    new.id,
    new.organization_id,
    jsonb_build_object(
      'label', new.label,
      'description', new.description,
      'category', new.category,
      'legal_basis', new.legal_basis,
      'page_payload', new.page_payload,
      'updated_at', new.updated_at
    ),
    auth.uid()
  );
  return new;
end
$fn$;

drop trigger if exists document_template_snapshot on public.document_org_templates;
create trigger document_template_snapshot
  after update on public.document_org_templates
  for each row execute function public.document_template_snapshot_fn();

comment on table public.document_template_versions is
  'Append-only snapshot of document template state on each meaningful update.';
