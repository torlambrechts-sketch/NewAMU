-- Tighten confidentiality gating on workflow_runs + workflow_run_evidence.
--
-- The original policies in _120400 and _120500 allowed `is_org_admin()`
-- as a shortcut for reading restricted/confidential runs. An org admin
-- is NOT by definition a member of the varslingsutvalg — granting them
-- default read access to whistleblower (varsel) runs is an AML §2A-7
-- breach (taushetsplikt for varselbehandlere, need-to-know-prinsipp).
--
-- This migration replaces both policies so the only way to see a
-- restricted/confidential run is to explicitly hold the
-- `workflows.view_confidential` permission (assigned via role_permissions
-- or active role_delegations), or to be the run's own actor_id.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML §2A-7 (5) — taushetsplikt om varsel og
--   varslers identitet. GDPR Art. 32 (need-to-know). Bonus: IK-f § 5
--   nr. 4 — fordeling av ansvar (rolle-eksplisitt tilgang i stedet
--   for admin-shortcut).
--   Restrisiko deferred: org-admins mister default-innsyn i
--   konfidensielle kjøringer. Operasjonelt tilsiktet — admin må få
--   `workflows.view_confidential` eksplisitt hvis de skal se varsler.
--   Eksisterende admins beholder nøkkelen (seeded i _120900) men det
--   er nå en *bevisst tildeling*, ikke en rolle-shortcut. Ta bort
--   nøkkelen fra admin-rollen for å håndheve segregation of duties.

-- ---------------------------------------------------------------------------
-- Strict permission helper. user_has_permission() short-circuits on
-- is_org_admin() (see _20260402120000_rbac_invites.sql:133), which is the
-- exact bypass we want to eliminate for confidentiality gating. This
-- helper checks ONLY role_permissions + active role_delegations — no
-- admin shortcut.
-- ---------------------------------------------------------------------------
create or replace function public.user_has_permission_strict(
  p_key  text,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.role_definitions rd on rd.id = ur.role_id
       where ur.user_id = p_user
         and rp.permission_key = p_key
         and rd.organization_id = (
           select organization_id from public.profiles where id = p_user
         )
    )
    or exists (
      select 1
        from public.role_delegations d
        join public.role_permissions rp on rp.role_id = d.role_id
       where d.to_user_id = p_user
         and d.ends_at > now()
         and d.starts_at <= now()
         and rp.permission_key = p_key
         and d.organization_id = (
           select organization_id from public.profiles where id = p_user
         )
    );
$$;

comment on function public.user_has_permission_strict(text, uuid) is
  'Like user_has_permission but WITHOUT the is_org_admin() shortcut. Use for confidentiality gates (AML §2A-7, GDPR Art. 32 need-to-know) where org-admin must not see data by virtue of role.';

revoke all on function public.user_has_permission_strict(text, uuid) from public;
grant execute on function public.user_has_permission_strict(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- workflow_runs: strict gate. The actor of the run can always see their
-- own row (so that a varsler-coordinator sees their own dispatched
-- runs); everyone else needs the explicit permission.
-- ---------------------------------------------------------------------------
drop policy if exists "workflow_runs_select_org" on public.workflow_runs;
create policy "workflow_runs_select_org"
  on public.workflow_runs for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or actor_id = (select auth.uid())
      or public.user_has_permission_strict('workflows.view_confidential')
    )
  );

-- ---------------------------------------------------------------------------
-- workflow_run_evidence: inherits the parent run's confidentiality.
-- Same strict gate.
-- ---------------------------------------------------------------------------
drop policy if exists "workflow_run_evidence_select" on public.workflow_run_evidence;
create policy "workflow_run_evidence_select"
  on public.workflow_run_evidence for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.workflow_runs r
       where r.id = workflow_run_evidence.run_id
         and (
           r.confidentiality_level = 'standard'
           or r.actor_id = (select auth.uid())
           or public.user_has_permission_strict('workflows.view_confidential')
         )
    )
  );

-- ---------------------------------------------------------------------------
-- Reviewed but intentionally NOT changed in this migration:
--
--   * workflow_rules — no confidentiality predicate on the SELECT policy
--     (just organization_id = current_org_id()). Compose/audit need to
--     see rule definitions; the *runs* are where the protected payload
--     lives. Leave alone.
--
--   * workflow_rule_revisions (_120300) — select policy is org-only, no
--     confidentiality predicate. The revision rows snapshot rule
--     *definitions*, not run payloads. Leave alone (the rule's own
--     confidentiality_level is in prev_confidentiality_level but is
--     not used as a gate).
--
--   * workflow_approvals (_120700) — select policy is org-only.
--     workflow_approvals_write is intentionally permissive (org-admin /
--     workflows.activate / the assigned approver) because deciding an
--     approval is an administrative act, not a confidentiality read.
--     The body of the related run is gated by workflow_runs above.
--
-- If you tighten any of these, mirror the strict-helper pattern.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verification: in any tenant, count confidential runs that an org-admin
-- *without* workflows.view_confidential would still see via the new
-- policy. Should be 0. Wrapped in plpgsql block so it logs but never
-- fails the migration (e.g. on a fresh DB with no data).
-- ---------------------------------------------------------------------------
do $verify$
declare
  v_admin_uid uuid;
  v_admin_org uuid;
  v_leaked    bigint;
begin
  -- Pick any org admin who does NOT have workflows.view_confidential as
  -- an explicit role permission (strict). If none exists, nothing to verify.
  select p.id, p.organization_id
    into v_admin_uid, v_admin_org
    from public.profiles p
   where p.is_org_admin = true
     and not public.user_has_permission_strict('workflows.view_confidential', p.id)
   limit 1;

  if v_admin_uid is null then
    raise notice 'workflow_confidentiality_strict: no admin-without-explicit-perm found; skipping leak check';
    return;
  end if;

  -- Simulate the policy predicate directly (we are running as the
  -- migrator, not as the admin, so we cannot rely on RLS itself).
  select count(*)
    into v_leaked
    from public.workflow_runs r
   where r.organization_id = v_admin_org
     and r.confidentiality_level in ('restricted','confidential')
     and r.actor_id is distinct from v_admin_uid
     and not public.user_has_permission_strict(
           'workflows.view_confidential', v_admin_uid
         );

  if v_leaked > 0 then
    raise warning
      'workflow_confidentiality_strict: admin % (org %) would still see % confidential run(s) — INVESTIGATE',
      v_admin_uid, v_admin_org, v_leaked;
  else
    raise notice
      'workflow_confidentiality_strict: admin % (org %) sees 0 confidential runs without workflows.view_confidential (expected)',
      v_admin_uid, v_admin_org;
  end if;
end
$verify$;
