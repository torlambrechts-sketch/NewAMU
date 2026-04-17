-- Append-only HSE change history for IK-f / Arbeidstilsynet inspection requests.

-- ── 1. Audit log table (append-only) ───────────────────────────────────────

create table if not exists public.hse_audit_log (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  table_name    text not null,
  record_id     uuid not null,
  action        text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by    uuid references auth.users (id) on delete set null,
  changed_at    timestamptz not null default now(),
  old_data      jsonb,
  new_data      jsonb,
  changed_fields text[]
);

create index if not exists hse_audit_log_org_table_idx
  on public.hse_audit_log (organization_id, table_name, changed_at desc);

create index if not exists hse_audit_log_record_idx
  on public.hse_audit_log (record_id, changed_at desc);

alter table public.hse_audit_log enable row level security;

drop policy if exists hse_audit_log_select on public.hse_audit_log;
create policy hse_audit_log_select
  on public.hse_audit_log for select to authenticated
  using (organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('hse.audit_read')));

drop policy if exists hse_audit_log_insert_system on public.hse_audit_log;
create policy hse_audit_log_insert_system
  on public.hse_audit_log for insert to authenticated
  with check (organization_id = public.current_org_id());

grant select, insert on public.hse_audit_log to authenticated;

revoke update, delete on public.hse_audit_log from authenticated;

-- ── 2. Generic audit trigger function ──────────────────────────────────────

create or replace function public.hse_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changed_fields text[];
  v_old jsonb := null;
  v_new jsonb := null;
begin
  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select coalesce(array_agg(key order by key), '{}'::text[]) into v_changed_fields
    from jsonb_each(v_old) o
    join jsonb_each(v_new) n using (key)
    where o.value is distinct from n.value;
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  end if;

  insert into public.hse_audit_log
    (organization_id, table_name, record_id, action, changed_by,
     old_data, new_data, changed_fields)
  values (
    coalesce(
      (v_new->>'organization_id')::uuid,
      (v_old->>'organization_id')::uuid
    ),
    TG_TABLE_NAME,
    coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
    TG_OP,
    auth.uid(),
    v_old,
    v_new,
    v_changed_fields
  );

  return coalesce(NEW, OLD);
end;
$$;

-- ── 3. Attach trigger to the three critical HSE tables ───────────────────────

drop trigger if exists inspection_rounds_audit_tg on public.inspection_rounds;
create trigger inspection_rounds_audit_tg
  after insert or update or delete on public.inspection_rounds
  for each row execute function public.hse_audit_trigger();

drop trigger if exists inspection_findings_audit_tg on public.inspection_findings;
create trigger inspection_findings_audit_tg
  after insert or update or delete on public.inspection_findings
  for each row execute function public.hse_audit_trigger();

drop trigger if exists deviations_audit_tg on public.deviations;
create trigger deviations_audit_tg
  after insert or update or delete on public.deviations
  for each row execute function public.hse_audit_trigger();

-- ── 4. RBAC: grant HSE audit read to org admins (new + existing orgs) ─────

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'hse.audit_read'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'reports.manage'),
      (r_admin, 'hse.audit_read'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports')
    on conflict do nothing;
  end if;
end;
$$;
