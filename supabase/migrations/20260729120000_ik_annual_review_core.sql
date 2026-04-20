-- IK-forskriften § 5.8 — Årlig gjennomgang (årsgjennomgang) med signatur og revisjonsspor.

-- ── 1. Table: ik_annual_reviews ─────────────────────────────────────────────
create table if not exists public.ik_annual_reviews (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  year               int not null check (year between 1990 and 2100),
  status             text not null default 'draft'
    check (status in ('draft', 'signed', 'archived')),
  summary            text,
  evaluation_json    jsonb not null default '{}'::jsonb,
  new_goals_json     jsonb not null default '{}'::jsonb,
  conducted_by       uuid references auth.users (id) on delete set null,
  manager_signed_at  timestamptz,
  manager_signed_by  uuid references auth.users (id) on delete set null,
  deputy_signed_at   timestamptz,
  deputy_signed_by   uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, year)
);

create index if not exists ik_annual_reviews_org_year_idx
  on public.ik_annual_reviews (organization_id, year desc);

drop trigger if exists ik_annual_reviews_set_updated_at on public.ik_annual_reviews;
create trigger ik_annual_reviews_set_updated_at
  before update on public.ik_annual_reviews
  for each row execute function public.set_updated_at();

-- ── 2. RLS (organization isolation + manage permission) ───────────────────────
alter table public.ik_annual_reviews enable row level security;

drop policy if exists ik_annual_reviews_select on public.ik_annual_reviews;
create policy ik_annual_reviews_select on public.ik_annual_reviews
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists ik_annual_reviews_insert on public.ik_annual_reviews;
create policy ik_annual_reviews_insert on public.ik_annual_reviews
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage') or public.user_has_permission('ik.manage'))
  );

drop policy if exists ik_annual_reviews_update on public.ik_annual_reviews;
create policy ik_annual_reviews_update on public.ik_annual_reviews
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage') or public.user_has_permission('ik.manage'))
    and status not in ('signed', 'archived')
  )
  with check (organization_id = public.current_org_id());

drop policy if exists ik_annual_reviews_delete on public.ik_annual_reviews;
create policy ik_annual_reviews_delete on public.ik_annual_reviews
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage') or public.user_has_permission('ik.manage'))
    and status = 'draft'
  );

grant select, insert, update, delete on public.ik_annual_reviews to authenticated;

-- ── 3. BEFORE INSERT: auto-fill organization_id ──────────────────────────────
create or replace function public.ik_annual_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists ik_annual_reviews_before_insert_tg on public.ik_annual_reviews;
create trigger ik_annual_reviews_before_insert_tg
  before insert on public.ik_annual_reviews
  for each row execute function public.ik_annual_reviews_before_insert();

-- ── 4. HSE audit log (immutable change trail) ────────────────────────────────
drop trigger if exists ik_annual_reviews_audit_tg on public.ik_annual_reviews;
create trigger ik_annual_reviews_audit_tg
  after insert or update or delete on public.ik_annual_reviews
  for each row execute function public.hse_audit_trigger();

-- ── 5. Workflow: dispatch when status becomes signed ──────────────────────────
create or replace function public.trg_ik_annual_reviews_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if tg_op = 'UPDATE'
     and new.status = 'signed'
     and old.status is distinct from 'signed'
  then
    v_row := to_jsonb(new);
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'internkontroll',
      'ON_ANNUAL_REVIEW_SIGNED',
      v_row
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ik_annual_reviews_workflow_tg on public.ik_annual_reviews;
create trigger ik_annual_reviews_workflow_tg
  after update of status on public.ik_annual_reviews
  for each row execute function public.trg_ik_annual_reviews_workflow();

-- ── 6. Permission alias ik.manage (same scope as internkontroll.manage) ─────
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'ik.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- ── 7. org_module_payloads: settings key for IK admin ───────────────────────
alter table public.org_module_payloads drop constraint if exists org_module_payloads_key_chk;

alter table public.org_module_payloads add constraint org_module_payloads_key_chk check (
  module_key in (
    'internal_control',
    'hse',
    'org_health',
    'representatives',
    'tasks',
    'organisation',
    'cost_settings',
    'workspace',
    'report_builder',
    'workplace_reporting',
    'workplace_dashboard',
    'inspection',
    'internkontroll_settings'
  )
);
