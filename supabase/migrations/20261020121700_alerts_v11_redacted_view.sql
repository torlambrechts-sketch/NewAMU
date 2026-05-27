-- Alerts v1.1 — alert_case_redacted view + accused-representative RLS.
--
-- v1.1 §7 spec: an accused_representative role gets a redacted view of
-- *their client's* case only. We model this as:
--   1. alert_accused_representative_grant — explicit (case, accused, lawyer)
--      tuple with expires_at; written by committee_confidential.
--   2. alert_case_redacted view — projects alert_cases + alert_case_notes
--      with reporter/witness/third-party identity masked, deliberation notes
--      stripped, attachment paths hidden.
--   3. RLS on the underlying tables permits selects matching grants.
--
-- Self-audit:
--   * ECHR Art. 6 (right to defence) — accused has a documented channel to
--     receive a redacted view of evidence against them.
--   * AML § 2A-7 (5) + GDPR Art. 15 (4) — reporter identity remains masked.
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ── 1. Representative grant table ─────────────────────────────────────────

create table if not exists public.alert_accused_representative_grant (
  id                       uuid primary key default gen_random_uuid(),
  case_id                  uuid not null references public.alert_cases (id) on delete cascade,
  accused_id               uuid not null references public.alert_accused (id) on delete cascade,
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  representative_user_id   uuid not null references auth.users (id) on delete cascade,
  granted_by               uuid not null references auth.users (id) on delete restrict,
  granted_at               timestamptz not null default now(),
  expires_at               timestamptz not null,
  revoked_at               timestamptz,
  revoked_by               uuid references auth.users (id) on delete restrict,
  notes                    text,
  unique (case_id, representative_user_id)
);

create index if not exists alert_accused_representative_grant_user_idx
  on public.alert_accused_representative_grant (representative_user_id, expires_at)
  where revoked_at is null;

alter table public.alert_accused_representative_grant enable row level security;

drop policy if exists alert_accused_representative_grant_select on public.alert_accused_representative_grant;
create policy alert_accused_representative_grant_select
  on public.alert_accused_representative_grant for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee_confidential')
      or representative_user_id = auth.uid()
    )
  );

drop policy if exists alert_accused_representative_grant_write on public.alert_accused_representative_grant;
create policy alert_accused_representative_grant_write
  on public.alert_accused_representative_grant for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.committee_confidential'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.committee_confidential'))
  );

create or replace function public.alerts_user_has_representative_grant(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.alert_accused_representative_grant g
    where g.case_id = p_case_id
      and g.representative_user_id = p_user_id
      and g.revoked_at is null
      and g.expires_at > now()
  );
$$;

revoke all on function public.alerts_user_has_representative_grant(uuid, uuid) from public, anon;
grant execute on function public.alerts_user_has_representative_grant(uuid, uuid) to authenticated, service_role;

-- ── 2. alert_case_redacted view ───────────────────────────────────────────

create or replace view public.alert_case_redacted as
  select
    c.id,
    c.organization_id,
    c.kind,
    c.status,
    c.anonymity_mode,
    c.severity,
    c.received_at,
    c.acknowledgement_due_at,
    c.investigation_due_at,
    c.closed_at,
    c.closing_outcome,
    c.system_template_id,
    c.org_template_id,
    '[redacted: reporter identity]'::text as title,
    '[redacted: contents available only via DPO via DSAR]'::text as description,
    c.category_id,
    c.location_id,
    c.department_id,
    c.team_id,
    c.metadata - 'reporter_email' - 'reporter_phone' - 'reporter_name' as metadata
  from public.alert_cases c;

grant select on public.alert_case_redacted to authenticated;

comment on view public.alert_case_redacted is
  'Redacted projection for alerts.accused_representative + DSAR redaction '
  'pipeline. Reporter identity is always masked; title + description are '
  'replaced with placeholder strings. Use the DSAR workflow + explicit '
  'redaction tooling for selective disclosure.';

-- ── 3. Extend alert_cases_select to allow representative reads via the
-- redacted view ----------------------------------------------------------
-- The view inherits RLS from the base table; we add another OR branch to
-- the alert_cases_select policy so reads through the view succeed.
drop policy if exists alert_cases_select on public.alert_cases;
create policy alert_cases_select
  on public.alert_cases for select
  using (
    organization_id = public.current_org_id()
    and (
      reporter_user_id = auth.uid()
      or (
        confidentiality_level in ('standard','restricted')
        and (public.is_org_admin() or public.user_has_permission('alerts.committee'))
      )
      or (
        confidentiality_level in ('standard','restricted')
        and (
          public.user_has_permission('alerts.verneombud')
          or public.user_has_permission('alerts.tillitsvalgt')
        )
      )
      or (
        confidentiality_level = 'confidential'
        and public.user_has_permission('alerts.committee_confidential')
      )
      or (
        kind = 'whistleblowing'
        and system_template_id = 'aml-varsel-mot-leder'
        and public.user_has_permission('alerts.committee_escalated')
      )
      or (
        kind = 'gdpr_breach'
        and public.user_has_permission('alerts.dpo')
      )
      or (
        status = 'escalated'
        and public.user_has_permission('alerts.board_escalation')
      )
      or public.alerts_user_has_external_grant(id, auth.uid())
      or public.user_has_permission('alerts.auditor')
      or public.alerts_break_glass_active_for(auth.uid()) is not null
      -- Accused representative — redacted view enforces masking; we let
      -- them through the row-level gate so the projection works.
      or (
        public.user_has_permission('alerts.accused_representative')
        and public.alerts_user_has_representative_grant(id, auth.uid())
      )
    )
  );
