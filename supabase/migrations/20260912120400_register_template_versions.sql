-- register_template_versions — append-only snapshot log for
-- register_types. Skips system rows (organization_id is null) because
-- those are managed in plattform-admin and there's no per-org audit
-- requirement; only org-authored register types are snapshotted.

create table if not exists public.register_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.register_types(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists register_template_versions_tpl_idx
  on public.register_template_versions (template_id, created_at desc);
create index if not exists register_template_versions_org_idx
  on public.register_template_versions (organization_id, created_at desc);

alter table public.register_template_versions enable row level security;

drop policy if exists register_template_versions_select on public.register_template_versions;
create policy register_template_versions_select
  on public.register_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.register_template_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Skip system rows — they have NULL organization_id and are managed
  -- centrally in plattform-admin. No per-org audit trail needed.
  if new.organization_id is null then
    return new;
  end if;
  if old.name is not distinct from new.name
     and coalesce(old.description, '') is not distinct from coalesce(new.description, '')
     and old.metadata_schema::text is not distinct from new.metadata_schema::text
     and old.regulation_ids is not distinct from new.regulation_ids
     and old.pack_slugs is not distinct from new.pack_slugs
     and old.is_active is not distinct from new.is_active
     and coalesce(old.default_review_cadence_months, 0) is not distinct from coalesce(new.default_review_cadence_months, 0)
  then
    return new;
  end if;
  insert into public.register_template_versions
    (template_id, organization_id, snapshot, changed_by)
  values (
    new.id,
    new.organization_id,
    jsonb_build_object(
      'name', new.name,
      'description', new.description,
      'metadata_schema', new.metadata_schema,
      'regulation_ids', new.regulation_ids,
      'pack_slugs', new.pack_slugs,
      'is_active', new.is_active,
      'default_review_cadence_months', new.default_review_cadence_months,
      'updated_at', new.updated_at
    ),
    auth.uid()
  );
  return new;
end
$fn$;

drop trigger if exists register_template_snapshot on public.register_types;
create trigger register_template_snapshot
  after update on public.register_types
  for each row execute function public.register_template_snapshot_fn();

comment on table public.register_template_versions is
  'Append-only snapshot of register type (template) state on each meaningful update. Org-authored rows only — system rows are managed in plattform-admin.';
