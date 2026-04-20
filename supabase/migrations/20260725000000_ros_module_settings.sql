-- ROS module: organization-level toggles (signatures required, default matrix size, etc.)

create table if not exists public.ros_module_settings (
  organization_id     uuid primary key references public.organizations(id) on delete cascade,
  require_dual_signature boolean not null default true,
  default_matrix_size   smallint not null default 5
    check (default_matrix_size in (3, 5)),
  updated_at          timestamptz not null default now()
);

alter table public.ros_module_settings enable row level security;

drop policy if exists ros_module_settings_select on public.ros_module_settings;
drop policy if exists ros_module_settings_write on public.ros_module_settings;

create policy ros_module_settings_select on public.ros_module_settings
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy ros_module_settings_write on public.ros_module_settings
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('ros.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('ros.manage'))
  );

grant select, insert, update, delete on public.ros_module_settings to authenticated;

drop trigger if exists ros_module_settings_updated_at on public.ros_module_settings;
create trigger ros_module_settings_updated_at
  before update on public.ros_module_settings
  for each row execute function public.set_updated_at();

-- Seed row per org (idempotent)
insert into public.ros_module_settings (organization_id)
select o.id from public.organizations o
where not exists (
  select 1 from public.ros_module_settings s where s.organization_id = o.id
);
