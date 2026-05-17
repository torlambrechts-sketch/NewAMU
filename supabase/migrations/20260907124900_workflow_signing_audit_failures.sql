-- Workflow signing audit-log failure capture.
--
-- vaultPemSigner.sign() currently swallows audit-log insert failures with
-- console.warn — the regulator call still goes through but no audit row
-- exists. Lost evidence in a forensic-grade pipeline is a P0 in itself,
-- but happens silently. hsmStubSigner.sign() doesn't even attempt the
-- audit row.
--
-- Fix:
--   1. New table workflow_signing_audit_failures captures the parameters
--      of any signing-audit-log row that could not be persisted by the
--      primary insert. A daily cron job re-tries the failed rows; success
--      promotes them into workflow_signing_audit_log.
--   2. Edge functions (vaultPemSigner + hsmStubSigner) are updated in a
--      separate patch — this migration only provides the substrate.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: NSM Grunnprinsipper §§ 2.4 + 5.4 — sporbar
--   bruk av kryptografisk materiale skal være fullstendig. En manglende
--   audit-rad kan ikke skjules som en "warning". IK-f § 5 nr. 7
--   (overvåking — også av selve overvåkings-pipelinen). Datatilsynets
--   eksempel: ved et innsynskrav på gov-meldinger må vi kunne vise når
--   en signatur ble gjort selv om DB-en var midlertidig utilgjengelig
--   for sekundærskriving.
--   Restrisiko deferred: hvis selve workflow_signing_audit_failures-
--   tabellen er nede, går vi tilbake til en console.error. Vi har p.t.
--   ikke en triple-fallback (filsystem) — defer til v0.2.

set local search_path = public, pg_catalog;

create table if not exists public.workflow_signing_audit_failures (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid references public.organizations (id) on delete cascade,
  kind                     text,
  adapter                  text,
  attempted_at             timestamptz not null default now(),
  public_key_kid           text,
  cert_serial              text,
  cert_expires_at          timestamptz,
  intent                   text,
  sha256_of_signed_input   text,
  attempt_count            int not null default 1,
  last_error               text,
  last_attempt_at          timestamptz not null default now(),
  drained_at               timestamptz,
  drained_into             uuid references public.workflow_signing_audit_log(id) on delete set null
);

create index if not exists workflow_signing_audit_failures_pending_idx
  on public.workflow_signing_audit_failures (attempted_at desc)
  where drained_at is null;

create index if not exists workflow_signing_audit_failures_org_idx
  on public.workflow_signing_audit_failures (organization_id, attempted_at desc);

comment on table public.workflow_signing_audit_failures is
  'Captures rows that could not be inserted into workflow_signing_audit_log (transient DB error during edge fn sign()). A daily cron drains pending rows back into the audit log. NSM § 5.4 + IK-f § 5 nr. 7.';

comment on column public.workflow_signing_audit_failures.attempt_count is
  'Number of times the daily drainer has attempted to promote this row. After 5 unsuccessful attempts an operator must inspect manually (no further auto-retry).';

alter table public.workflow_signing_audit_failures enable row level security;

drop policy if exists workflow_signing_audit_failures_service_insert on public.workflow_signing_audit_failures;
create policy workflow_signing_audit_failures_service_insert
  on public.workflow_signing_audit_failures for insert
  to service_role
  with check (true);

drop policy if exists workflow_signing_audit_failures_service_update on public.workflow_signing_audit_failures;
create policy workflow_signing_audit_failures_service_update
  on public.workflow_signing_audit_failures for update
  to service_role
  using (true)
  with check (true);

drop policy if exists workflow_signing_audit_failures_org_select on public.workflow_signing_audit_failures;
create policy workflow_signing_audit_failures_org_select
  on public.workflow_signing_audit_failures for select
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

grant select on public.workflow_signing_audit_failures to authenticated;
grant insert, update, select on public.workflow_signing_audit_failures to service_role;

-- ── Drainer function (idempotent re-promotion) ──────────────────────────
create or replace function public.workflow_signing_audit_drain_failures()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted int := 0;
  r record;
  v_new_id uuid;
begin
  for r in
    select *
      from public.workflow_signing_audit_failures
     where drained_at is null
       and attempt_count < 5
     order by attempted_at asc
     limit 200
  loop
    begin
      insert into public.workflow_signing_audit_log (
        organization_id, kind, adapter, signed_at,
        public_key_kid, cert_serial, cert_expires_at, intent,
        sha256_of_signed_input
      ) values (
        r.organization_id,
        coalesce(r.kind, 'evidence'),
        coalesce(r.adapter, 'vault_pem'),
        r.attempted_at,
        r.public_key_kid, r.cert_serial, r.cert_expires_at,
        coalesce(r.intent, 'maskinporten_jwt_bearer_grant'),
        r.sha256_of_signed_input
      )
      returning id into v_new_id;

      update public.workflow_signing_audit_failures
         set drained_at = now(),
             drained_into = v_new_id
       where id = r.id;
      v_promoted := v_promoted + 1;
    exception when others then
      update public.workflow_signing_audit_failures
         set attempt_count = attempt_count + 1,
             last_attempt_at = now(),
             last_error = sqlerrm
       where id = r.id;
    end;
  end loop;

  if v_promoted > 0 then
    raise notice 'workflow_signing_audit_drain_failures: promoted % failure rows', v_promoted;
  end if;
  return v_promoted;
end;
$$;

revoke all on function public.workflow_signing_audit_drain_failures() from public;
grant execute on function public.workflow_signing_audit_drain_failures() to service_role;

-- pg_cron schedule (daily at 03:15). Gated on pg_cron.
do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (
      select jobid from cron.job
       where jobname = 'workflow_signing_audit_drain'
    ) loop
      perform cron.unschedule(r.jobid);
    end loop;
    perform cron.schedule(
      'workflow_signing_audit_drain',
      '15 3 * * *',
      $cmd$select public.workflow_signing_audit_drain_failures();$cmd$
    );
    raise notice 'workflow_signing_audit_drain: scheduled daily 03:15';
  else
    raise notice 'workflow_signing_audit_drain: pg_cron missing — invoke workflow_signing_audit_drain_failures() externally';
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;
