-- Repair: recreate hse_audit_log RLS policies (valid PostgreSQL: DROP + CREATE only).
-- Skips entirely if public.hse_audit_log does not exist (e.g. 20260619210000 failed before CREATE TABLE).

do $repair$
begin
  if to_regclass('public.hse_audit_log') is null then
    raise notice 'hse_audit_log missing — apply 20260708120000_hse_audit_log_bootstrap_missing.sql or full 20260619210000';
    return;
  end if;

  execute 'alter table public.hse_audit_log enable row level security';

  execute 'drop policy if exists hse_audit_log_select on public.hse_audit_log';
  execute $p$
    create policy hse_audit_log_select
      on public.hse_audit_log for select to authenticated
      using (
        organization_id = public.current_org_id()
        and (
          public.is_org_admin()
          or public.user_has_permission('hse.audit_read')
        )
      )
  $p$;

  execute 'drop policy if exists hse_audit_log_insert_system on public.hse_audit_log';
  execute $p$
    create policy hse_audit_log_insert_system
      on public.hse_audit_log for insert to authenticated
      with check (organization_id = public.current_org_id())
  $p$;
end;
$repair$;
