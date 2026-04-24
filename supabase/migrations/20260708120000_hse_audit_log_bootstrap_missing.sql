-- Idempotent bootstrap when public.hse_audit_log was never created (e.g. failed migration
-- or repair run alone). Safe if 20260619210000 already applied fully.

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
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('hse.audit_read')
    )
  );

drop policy if exists hse_audit_log_insert_system on public.hse_audit_log;
create policy hse_audit_log_insert_system
  on public.hse_audit_log for insert to authenticated
  with check (organization_id = public.current_org_id());

grant select, insert on public.hse_audit_log to authenticated;

revoke update, delete on public.hse_audit_log from authenticated;

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

-- If action_plan_items exists (later migration), attach audit trigger when missing.
do $ap$
begin
  if to_regclass('public.action_plan_items') is not null then
    execute 'drop trigger if exists action_plan_items_audit_tg on public.action_plan_items';
    execute $t$
      create trigger action_plan_items_audit_tg
        after insert or update or delete on public.action_plan_items
        for each row execute function public.hse_audit_trigger()
    $t$;
  end if;
end;
$ap$;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'hse.audit_read'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
