-- workflow_queue_force_tick — admin-triggered queue drain RPC.
--
-- Helsesjekk-fanen (Engine Health) eksponerer en "Force-process kø nå"-
-- knapp som lar en admin tappe køen umiddelbart i stedet for å vente på
-- pg_cron / workflow-queue-worker-tick (1 min cadence). Vi lener oss på
-- den eksisterende workflow_queue_lease(int) fra _20260905121400 og
-- avgrenser tilgang via platform_is_admin() ELLER permisjonen
-- workflows.activate. Returnerer antall leasede rader så UI kan vise
-- "leaset N rader" som umiddelbar tilbakemelding.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiske tiltak må
--   iverksettes; en stille kø gir falsk trygghet. Helsesjekk + force-
--   tick gir operativ visibility + manuell drain når cron svikter.
--   Restrisiko deferred: rate-limit per org for hvor ofte force-tick
--   kan kalles (DoS-vern). For nå begrenser permission-sjekken bruken
--   til admin / activate-godkjente.
--
-- Idempotency: create or replace; revoke + grant kjøres alltid; ingen
-- DDL utenom funksjonen selv.

create or replace function public.workflow_queue_force_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not (
    public.platform_is_admin()
    or public.user_has_permission_strict('workflows.activate', auth.uid())
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  -- workflow_queue_lease flips status pending -> processing for up to
  -- p_batch_size rows and returns them. We only need the count for the
  -- UI nudge; the actual processing happens in workflow-queue-worker.
  select count(*)
    into v_count
    from public.workflow_queue_lease(50);

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.workflow_queue_force_tick() from public;
grant execute on function public.workflow_queue_force_tick() to authenticated;

comment on function public.workflow_queue_force_tick() is
  'Admin-only RPC that leases up to 50 pending workflow_action_queue rows immediately. Backs the "Force-process kø nå" button in Helsesjekk-fanen. Requires platform_is_admin() OR workflows.activate permission. Returns leased row count.';
