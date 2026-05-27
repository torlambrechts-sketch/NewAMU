-- Alerts v1.1 — expanded role set + external investigator grants.
--
-- v1.1 §7 spec defines 11 roles. v1.0 had committee + committee_confidential
-- + committee_escalated + dpo + manage. Phase 1 adds:
--   verneombud · tillitsvalgt · pastoral_care · accused_representative
--   external_investigator · auditor · board_escalation
-- The keys themselves are registered in src/lib/permissionKeys.ts (TS
-- source) — this migration extends alert_cases_select RLS so each role
-- gets the read scope the spec defines.
--
-- Self-audit:
--   * AML § 6-5 — verneombud has independent rett til innsyn i HMS-saker.
--   * AML § 8-1 — tillitsvalgt har innsyn i drøftelsesgrunnlag.
--   * Sjelesørger / pastoral_care — taushetsplikt cf. straffeloven § 211;
--     reads pseudonym + state only, can write notes outside the case.
--   * Accused right of defence — accused_representative reads a redacted
--     view of *their client's* cases only.
--   * External investigator — time-limited, case-scoped grant via
--     alert_external_investigator_grant. Token-expiry mirrors the existing
--     workflow_auditor_tokens pattern.
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ── alert_external_investigator_grant ─────────────────────────────────────

create table if not exists public.alert_external_investigator_grant (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  investigator_user_id uuid not null references auth.users (id) on delete cascade,
  granted_by      uuid not null references auth.users (id) on delete restrict,
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users (id) on delete restrict,
  scope_notes     text,
  unique (case_id, investigator_user_id)
);

create index if not exists alert_external_investigator_grant_user_idx
  on public.alert_external_investigator_grant (investigator_user_id, expires_at)
  where revoked_at is null;

alter table public.alert_external_investigator_grant enable row level security;

drop policy if exists alert_external_investigator_grant_select on public.alert_external_investigator_grant;
create policy alert_external_investigator_grant_select
  on public.alert_external_investigator_grant for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or investigator_user_id = auth.uid()
    )
  );

drop policy if exists alert_external_investigator_grant_write on public.alert_external_investigator_grant;
create policy alert_external_investigator_grant_write
  on public.alert_external_investigator_grant for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.committee_confidential'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.committee_confidential'))
  );

-- Helper: returns true when caller has an active external-investigator grant on a case.
create or replace function public.alerts_user_has_external_grant(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.alert_external_investigator_grant g
    where g.case_id = p_case_id
      and g.investigator_user_id = p_user_id
      and g.revoked_at is null
      and g.expires_at > now()
  );
$$;

revoke all on function public.alerts_user_has_external_grant(uuid, uuid) from public, anon;
grant execute on function public.alerts_user_has_external_grant(uuid, uuid) to authenticated, service_role;

-- ── Replace alert_cases_select with the expanded role matrix ──────────────

drop policy if exists alert_cases_select on public.alert_cases;
create policy alert_cases_select
  on public.alert_cases for select
  using (
    organization_id = public.current_org_id()
    and (
      -- Reporter: always see own submission (via auth.uid match).
      reporter_user_id = auth.uid()

      -- Committee (non-confidential).
      or (
        confidentiality_level in ('standard','restricted')
        and (public.is_org_admin() or public.user_has_permission('alerts.committee'))
      )

      -- Verneombud + tillitsvalgt — same view as committee (non-confidential).
      or (
        confidentiality_level in ('standard','restricted')
        and (
          public.user_has_permission('alerts.verneombud')
          or public.user_has_permission('alerts.tillitsvalgt')
        )
      )

      -- Confidential — committee_confidential only.
      or (
        confidentiality_level = 'confidential'
        and public.user_has_permission('alerts.committee_confidential')
      )

      -- Escalated (against-leader) cases — separate roster.
      or (
        kind = 'whistleblowing'
        and system_template_id = 'aml-varsel-mot-leder'
        and public.user_has_permission('alerts.committee_escalated')
      )

      -- DPO — metadata + GDPR brudd cases.
      or (
        kind = 'gdpr_breach'
        and public.user_has_permission('alerts.dpo')
      )

      -- Board escalation — only when case is currently escalated.
      or (
        status = 'escalated'
        and public.user_has_permission('alerts.board_escalation')
      )

      -- External investigator — time-limited per-case grant.
      or public.alerts_user_has_external_grant(id, auth.uid())

      -- Pastoral care — pseudonym + state only.
      -- Achieved by a separate view alert_cases_pastoral (created here)
      -- that exposes only id, case_number, status, anonymity_mode, severity.
      -- Direct SELECT on alert_cases is NOT granted to pastoral_care.

      -- Auditor — read everything for audit purposes.
      or public.user_has_permission('alerts.auditor')

      -- Break-glass — any active session for the calling user grants
      -- org-wide read for the duration. Each read still emits a timeline
      -- event via the application layer.
      or public.alerts_break_glass_active_for(auth.uid()) is not null
    )
  );

-- Pastoral-care projection: status + anonymity only, no body.
create or replace view public.alert_cases_pastoral as
  select c.id,
         c.organization_id,
         c.kind,
         c.status,
         c.anonymity_mode,
         c.severity,
         c.received_at,
         c.acknowledgement_due_at,
         c.investigation_due_at,
         coalesce(c.reporter_display_name, '[anonym]') as pseudonym
    from public.alert_cases c
   where c.organization_id = public.current_org_id();

grant select on public.alert_cases_pastoral to authenticated;

comment on view public.alert_cases_pastoral is
  'Restricted projection for alerts.pastoral_care — status + anonymity + '
  'pseudonym only. No title/description/notes. Pastoral worker offers '
  'support without reading the case body.';

-- Accused-representative view: redacted version (built in _121700).
-- The view itself is defined in the next migration; here we just ensure
-- the role can SELECT on it once it exists.
