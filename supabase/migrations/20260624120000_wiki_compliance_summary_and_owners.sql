-- Per-organization owner for a legal coverage catalog item (multi-tenant safe)
create table if not exists public.wiki_legal_coverage_item_assignments (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  coverage_item_id uuid not null references public.wiki_legal_coverage_items (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, coverage_item_id)
);

create index if not exists wiki_legal_coverage_assignments_org_idx
  on public.wiki_legal_coverage_item_assignments (organization_id);

alter table public.wiki_legal_coverage_item_assignments enable row level security;

drop policy if exists "wiki_legal_coverage_assignments_select_org" on public.wiki_legal_coverage_item_assignments;
create policy "wiki_legal_coverage_assignments_select_org"
  on public.wiki_legal_coverage_item_assignments for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists "wiki_legal_coverage_assignments_insert_manage" on public.wiki_legal_coverage_item_assignments;
create policy "wiki_legal_coverage_assignments_insert_manage"
  on public.wiki_legal_coverage_item_assignments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

drop policy if exists "wiki_legal_coverage_assignments_update_manage" on public.wiki_legal_coverage_item_assignments;
create policy "wiki_legal_coverage_assignments_update_manage"
  on public.wiki_legal_coverage_item_assignments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

drop policy if exists "wiki_legal_coverage_assignments_delete_manage" on public.wiki_legal_coverage_item_assignments;
create policy "wiki_legal_coverage_assignments_delete_manage"
  on public.wiki_legal_coverage_item_assignments for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

drop view if exists public.wiki_compliance_summary cascade;

create or replace view public.wiki_compliance_summary as
select
  c.id,
  c.ref,
  coalesce(nullif(trim(c.label), ''), c.ref) as requirement,
  'compliance'::text as category,
  o.organization_id,
  count(p.id) filter (
    where p.id is not null
      and p.status = 'published'
      and (
        p.next_revision_due_at is null
        or (p.next_revision_due_at at time zone 'UTC')::date > (timezone('UTC', now()))::date
      )
  ) as covered_count,
  min(p.next_revision_due_at) filter (where p.status = 'published') as earliest_revision_due,
  bool_or(
    p.id is not null
    and p.status = 'published'
    and p.next_revision_due_at is not null
    and (p.next_revision_due_at at time zone 'UTC')::date <= (timezone('UTC', now()))::date
  ) as has_overdue
from public.wiki_legal_coverage_items c
cross join (
  select distinct organization_id from public.wiki_pages
  union
  select distinct organization_id from public.wiki_spaces
) o
left join public.wiki_pages p
  on p.organization_id = o.organization_id
  and c.ref = any (p.legal_refs)
group by c.id, c.ref, c.label, o.organization_id;

comment on view public.wiki_compliance_summary is
  'Per (coverage item, organization): published pages referencing ref with revision current (null or next_revision_due_at > now()).';

grant select on public.wiki_compliance_summary to authenticated;
