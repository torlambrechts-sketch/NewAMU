-- hse_audit_trigger: org resolution for org-less tables (review finding)
--
-- Gap closed: hse_audit_trigger() reads organization_id straight off the
-- audited row, but it is attached to role_permissions and user_roles which
-- have NO organization_id column — so EVERY runtime write to those tables
-- crashed with a not-null violation on hse_audit_log.organization_id.
-- Latent until now (role_permissions/user_roles were only seeded before the
-- audit triggers existed); surfaced by the post-implementation DB test when
-- functional_role_sync_permissions (H3.3) inserted role_permissions — and
-- it equally breaks the pre-existing accept_invitation role grants and
-- assign_admin_role_to_self.
--
-- Fix: resolve the org through role_definitions for those two tables, and
-- as a last resort skip the audit row instead of failing the audited write
-- (an audit trigger must never take down the transaction it observes).
-- Self-audit: audit coverage is preserved (both tables resolve a real org
-- via role_id); the skip path only triggers for hypothetical future
-- org-less tables. Restrisiko: none for current tables.

create or replace function public.hse_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_changed_fields text[];
  v_old  jsonb := null;
  v_new  jsonb := null;
  v_org  uuid;
begin
  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select array_agg(key) into v_changed_fields
    from (
      select key from jsonb_each(v_old)
      where v_old->key is distinct from v_new->key
    ) changed;
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  end if;

  v_org := coalesce((v_new->>'organization_id')::uuid, (v_old->>'organization_id')::uuid);

  -- role_permissions / user_roles carry no org column — resolve through
  -- the role definition they reference.
  if v_org is null and TG_TABLE_NAME in ('role_permissions', 'user_roles') then
    select rd.organization_id into v_org
      from public.role_definitions rd
     where rd.id = coalesce((v_new->>'role_id')::uuid, (v_old->>'role_id')::uuid);
  end if;

  -- Never let auditing fail the audited write.
  if v_org is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.hse_audit_log
    (organization_id, table_name, record_id, action, changed_by,
     old_data, new_data, changed_fields)
  values (
    v_org,
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
