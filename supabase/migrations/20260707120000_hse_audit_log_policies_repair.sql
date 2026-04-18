-- Repair: CREATE POLICY IF NOT EXISTS is invalid in PostgreSQL (syntax error at "not").
-- Idempotent policy recreate for hse_audit_log (safe if 20260619210000 already applied).

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
