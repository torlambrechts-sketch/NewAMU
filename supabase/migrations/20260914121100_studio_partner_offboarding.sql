-- Studio Builder Phase 3 Task 3.4 — partner offboarding TTL.
--
-- When an admin revokes a partner_membership (sets active=false +
-- revoked_at), drafts authored by the revoked user must stay readable
-- by the client's admins for 30 days, then be purged. This migration:
--
--   1. Adds `revoked_grace_until timestamptz` to studio_pack_drafts.
--      Null = "owned by an active user", a timestamp = "purge after this".
--   2. Adds a trigger on partner_memberships that stamps the column
--      with now() + interval '30 days' for every draft authored by the
--      member being revoked.
--   3. Ships a cleanup function purge_revoked_studio_drafts() that the
--      existing pg_cron workflow-cron-dispatcher (per
--      workflow-engine-review.md) picks up automatically. Standalone
--      pg_cron registration is left out so we don't duplicate the cron
--      surface.
--
-- Conditional on partner_memberships existing — no-op when the partner
-- substrate hasn't shipped to the target environment.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: GDPR art. 5 (1) (e) — data minimisation;
--   partner-authored drafts are deleted after 30 days when access is
--   revoked. AML § 18-3 — handover obligation; 30 days gives the client
--   time to claim or copy the work before purge.
--   Restrisiko deferred:
--     - Confirmable TTL (sales hard-confirm at 30 days vs longer) —
--       open Q 8 in spec §10. 30d is the recommendation; revisit if
--       customers ask for longer.
--     - Cron registration — workflow-cron-dispatcher picks this up via
--       the existing scheduled-job substrate.
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. revoked_grace_until column
-- ────────────────────────────────────────────────────────────────────

alter table public.studio_pack_drafts
  add column if not exists revoked_grace_until timestamptz;

create index if not exists studio_pack_drafts_revoked_idx
  on public.studio_pack_drafts (revoked_grace_until)
  where revoked_grace_until is not null;

comment on column public.studio_pack_drafts.revoked_grace_until is
  'Studio Builder Phase 3 Task 3.4 — when the author''s partner_membership is revoked, this stamps now()+30d. purge_revoked_studio_drafts() reaps rows with revoked_grace_until < now().';

-- ────────────────────────────────────────────────────────────────────
-- 2. Conditional trigger on partner_memberships revoke
-- ────────────────────────────────────────────────────────────────────

do $do$
begin
  if not exists (
    select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'partner_memberships'
  ) then
    raise notice '[studio_partner_offboarding] partner_memberships missing — skipping trigger.';
    return;
  end if;

  execute $sql$
    create or replace function public.studio_partner_offboard_stamp_drafts()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      -- Only fire when the row transitions to inactive.
      if (old.active = true and new.active = false) then
        update public.studio_pack_drafts
           set revoked_grace_until = now() + interval '30 days'
         where last_edited_by = old.user_id
           and revoked_grace_until is null;
      end if;
      return new;
    end;
    $fn$;
  $sql$;

  execute 'drop trigger if exists studio_partner_offboard_stamp on public.partner_memberships';
  execute 'create trigger studio_partner_offboard_stamp
             after update on public.partner_memberships
             for each row
             execute function public.studio_partner_offboard_stamp_drafts()';
end
$do$;

-- ────────────────────────────────────────────────────────────────────
-- 3. Cleanup function — caller can invoke from cron or manually
-- ────────────────────────────────────────────────────────────────────

create or replace function public.purge_revoked_studio_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  delete from public.studio_pack_drafts
    where revoked_grace_until is not null
      and revoked_grace_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

comment on function public.purge_revoked_studio_drafts is
  'Studio Builder Phase 3 Task 3.4 — purges studio_pack_drafts rows whose 30-day post-revoke grace has elapsed. Returns the count purged. Invoke from pg_cron (workflow-cron-dispatcher) or manually for an immediate sweep.';
