-- user_has_role() — DRY helper for RLS-policies.
--
-- Senior-dev forutsetning #2 i specs/fase5-utestaaende-plan.md §7.
-- Erstatter inline-EXISTS-subspørringer i RLS-policies for å unngå drift
-- mellom policies på tvers av tabeller (gdpr_breach_incidents,
-- gdpr_subject_requests, org_role_requirement_instances).
--
-- Self-audit:
--   * SECURITY DEFINER — kjører med definer-tilgang slik at RLS-evaluering
--     ikke trenger select på functional_role_assignments fra hver tabells
--     policy
--   * Returnerer boolean — kan brukes direkte i policy `using ()`
--   * Stable — kan caches innen samme statement

set local search_path = public, pg_catalog;

create or replace function public.user_has_role(p_org_id uuid, p_role_slug text)
returns boolean as $$
  select exists (
    select 1 from public.org_functional_role_assignments
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role_slug = p_role_slug
      and (valid_to is null or valid_to >= current_date)
  );
$$ language sql stable security definer set search_path = public, pg_catalog;

comment on function public.user_has_role is
  'Boolean — sjekker om auth.uid() har en gyldig tildeling av rollen p_role_slug i org. DRY helper for RLS.';

revoke all on function public.user_has_role(uuid, text) from public;
grant execute on function public.user_has_role(uuid, text) to authenticated;

-- Tilsvarende for org-admin-sjekk
create or replace function public.user_is_org_admin(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and organization_id = p_org_id
      and is_org_admin = true
  );
$$ language sql stable security definer set search_path = public, pg_catalog;

comment on function public.user_is_org_admin is
  'Boolean — sjekker om auth.uid() er org-admin i p_org_id. DRY helper for RLS.';

revoke all on function public.user_is_org_admin(uuid) from public;
grant execute on function public.user_is_org_admin(uuid) to authenticated;

-- ── Refaktorere eksisterende RLS-policies til å bruke helpers ────────────
--
-- gdpr_breach_incidents
drop policy if exists gbi_select_admin_or_dpo on public.gdpr_breach_incidents;
create policy gbi_select_admin_or_dpo on public.gdpr_breach_incidents
  for select using (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  );

drop policy if exists gbi_modify_admin_or_dpo on public.gdpr_breach_incidents;
create policy gbi_modify_admin_or_dpo on public.gdpr_breach_incidents
  for all using (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  ) with check (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  );

-- gdpr_subject_requests
drop policy if exists gsr_select_admin_or_dpo on public.gdpr_subject_requests;
create policy gsr_select_admin_or_dpo on public.gdpr_subject_requests
  for select using (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  );

drop policy if exists gsr_modify_admin_or_dpo on public.gdpr_subject_requests;
create policy gsr_modify_admin_or_dpo on public.gdpr_subject_requests
  for all using (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  ) with check (
    public.user_is_org_admin(organization_id)
    or public.user_has_role(organization_id, 'dpo')
  );

-- org_role_requirement_instances (sjølv-tilgang + admin)
drop policy if exists orri_select_self_or_admin on public.org_role_requirement_instances;
create policy orri_select_self_or_admin on public.org_role_requirement_instances
  for select using (
    user_id = auth.uid()
    or public.user_is_org_admin(organization_id)
  );

drop policy if exists orri_modify_admin on public.org_role_requirement_instances;
create policy orri_modify_admin on public.org_role_requirement_instances
  for all using (
    public.user_is_org_admin(organization_id)
  ) with check (
    public.user_is_org_admin(organization_id)
  );

-- ── Cron-run-log for sporbarhet av edge function-kjøringer ───────────────
--
-- Senior-dev anbefaling: lagre cron-runs for audit-spor.

create table if not exists public.cron_run_log (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  invoked_at timestamptz not null default now(),
  organization_id uuid,
  status text not null check (status in ('success','partial','error')),
  duration_ms int,
  payload jsonb,
  result jsonb,
  error_message text
);

create index if not exists cron_run_log_function_time_idx
  on public.cron_run_log (function_name, invoked_at desc);

comment on table public.cron_run_log is
  'Audit-spor av cron-baserte edge function-kjøringer. Brukes for å bekrefte at reconcile faktisk har kjørt på forventet tidspunkt.';

alter table public.cron_run_log enable row level security;

drop policy if exists crl_select_admin on public.cron_run_log;
create policy crl_select_admin on public.cron_run_log
  for select using (
    organization_id is null  -- system-level runs synlig for alle auth
    or public.user_is_org_admin(organization_id)
  );
