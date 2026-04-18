-- Soft-delete for ROS analyses (matches list filter in useRos) + app permission for ros.manage
alter table public.ros_analyses
  add column if not exists deleted_at timestamptz;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'ros.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
