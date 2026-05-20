-- Security fix: cross-tenant data leak via SECURITY DEFINER views.
--
-- Gap closed: 11 views in the public schema are owned by `postgres` and were
-- created without `security_invoker`, so they execute with the owner's rights
-- and BYPASS row-level security on every underlying table. All 11 were granted
-- SELECT to both `anon` and `authenticated`, meaning any holder of the
-- publishable key — including unauthenticated clients — could read EVERY
-- tenant's data through them (employee names + e-mails via
-- org_active_role_holders / training_matrix_view, risk register titles and
-- descriptions via risk_register_*_v, GDPR + BankID activity, workflow action
-- payloads, and every org's custom template names via v_admin_templates).
-- Only audit_events_read self-filtered by current_org_id(); the rest did not.
--
-- Fix: flip every view to `security_invoker = on` so the caller's RLS applies,
-- and revoke `anon` SELECT (none of these surfaces are meant for
-- unauthenticated use). With invoker semantics each view now returns only the
-- caller's own organization, because every underlying table already carries
-- org-scoped RLS. workflow_template_catalog had RLS enabled but no policy
-- (deny-all), which would blank the workflow branch of v_admin_templates once
-- the view runs as invoker — it holds only system catalog rows, so a plain
-- read policy is added.
--
-- Self-audit (Arbeidstilsynet / Datatilsynet POV): pålegg-grunn addressed —
-- personopplysninger (navn, e-post) og HMS-avviksdata var teknisk tilgjengelig
-- på tvers av virksomheter, i strid med GDPR art. 5(1)(f) og art. 32.
-- Restrisiko deferred: the materialized view reporting_compliance_score_mv
-- cannot carry RLS; anon access is revoked here, but authenticated cross-org
-- exposure must be closed separately with a security-definer wrapper.

do $$
declare
  v_view text;
begin
  foreach v_view in array array[
    'audit_events_read',
    'bankid_signatures_by_page',
    'gdpr_subject_requests_status_view',
    'org_active_role_holders',
    'risk_register_summary_v',
    'risk_register_unified_v',
    'role_compliance_requirements_view',
    'role_compliance_status_view',
    'training_matrix_view',
    'v_admin_templates',
    'workflow_action_queue_normalized'
  ]
  loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
    ) then
      execute format('alter view public.%I set (security_invoker = on)', v_view);
      execute format('revoke select on public.%I from anon', v_view);
    end if;
  end loop;
end$$;

-- workflow_template_catalog: RLS on, no policy (deny-all). Rows are global
-- system templates (no organization_id), safe for any signed-in user to read.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workflow_template_catalog'
      and policyname = 'workflow_template_catalog_read'
  ) then
    create policy workflow_template_catalog_read
      on public.workflow_template_catalog
      for select to authenticated
      using (true);
  end if;
end$$;

-- Materialized views cannot enforce RLS. reporting_compliance_score_mv was
-- selectable by anon; revoke it. Authenticated cross-org exposure is tracked
-- as restrisiko above.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reporting_compliance_score_mv'
      and c.relkind = 'm'
  ) then
    revoke select on public.reporting_compliance_score_mv from anon;
  end if;
end$$;

-- Two public tables had RLS disabled entirely (fully exposed to anon).
-- alerts_public_status_throttle is written only by the alerts edge function
-- via the service role (which bypasses RLS) — enabling RLS with no policy
-- correctly denies all anon/authenticated access.
alter table public.alerts_public_status_throttle enable row level security;

-- no_public_holidays is shared reference data (no tenant column). Enable RLS
-- and add an explicit read-only policy so anon can still read it but cannot
-- write.
alter table public.no_public_holidays enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'no_public_holidays'
      and policyname = 'no_public_holidays_read'
  ) then
    create policy no_public_holidays_read
      on public.no_public_holidays
      for select to anon, authenticated
      using (true);
  end if;
end$$;
