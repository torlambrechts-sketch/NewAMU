-- survey_template_versions — append-only snapshot log for
-- survey_org_templates. Mirrors the compliance_template_versions
-- pattern (20260912120000): snapshot trigger fires on UPDATE when any
-- of the meaningful columns change, capturing the new row state.
-- A future restore RPC will copy a snapshot back into the live row.
--
-- Self-audit: closes the «kan dere vise hva som ble endret på malen
-- og når?» gap for undersøkelses-maler. Restrisiko: same as
-- compliance — restore UI is a follow-up RPC.

create table if not exists public.survey_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.survey_org_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists survey_template_versions_tpl_idx
  on public.survey_template_versions (template_id, created_at desc);
create index if not exists survey_template_versions_org_idx
  on public.survey_template_versions (organization_id, created_at desc);

alter table public.survey_template_versions enable row level security;

drop policy if exists survey_template_versions_select on public.survey_template_versions;
create policy survey_template_versions_select
  on public.survey_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.survey_template_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.name_override is not distinct from new.name_override
     and old.description_override is not distinct from new.description_override
     and coalesce(old.body_override::text, '') is not distinct from coalesce(new.body_override::text, '')
     and old.is_active is not distinct from new.is_active
     and old.nav_pinned is not distinct from new.nav_pinned
     and old.cadence_hint is not distinct from new.cadence_hint
     and old.review_status is not distinct from new.review_status
  then
    return new;
  end if;
  insert into public.survey_template_versions
    (template_id, organization_id, snapshot, changed_by)
  values (
    new.id,
    new.organization_id,
    jsonb_build_object(
      'name_override', new.name_override,
      'description_override', new.description_override,
      'body_override', new.body_override,
      'is_active', new.is_active,
      'nav_pinned', new.nav_pinned,
      'cadence_hint', new.cadence_hint,
      'review_status', new.review_status,
      'updated_at', new.updated_at
    ),
    auth.uid()
  );
  return new;
end
$fn$;

drop trigger if exists survey_template_snapshot on public.survey_org_templates;
create trigger survey_template_snapshot
  after update on public.survey_org_templates
  for each row execute function public.survey_template_snapshot_fn();

comment on table public.survey_template_versions is
  'Append-only snapshot of survey template override state on each meaningful update.';
