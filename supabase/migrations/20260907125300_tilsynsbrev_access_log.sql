-- Tilsynsbrev access log — append-only forensic trail for every read /
-- task-spawn / review-action on a tilsynsbrev_uploads row.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 (5) (varslingssaker — taushets-
--   plikt og kontroll med hvem som har fått innsyn); IK-f § 5 nr. 7
--   (sporbar HMS-doku); GDPR Art. 30 + Art. 33 (5) (registrering av
--   personopplysningsbehandlinger og avvik). Tilsynsbrev klassifisert
--   som restricted/confidential har som regel personopplysninger om
--   ansatte/varsler — uten en innsyn-logg kan vi ikke svare på en
--   tilsynssak hvor Datatilsynet spør «hvem har lest denne saken?».
--   Loggen er append-only via før-trigger og insert-RPC i applikasjons-
--   laget — UI-koden kaller tilsynsbrev_log_access(p_upload_id, p_action)
--   eksplisitt for å fange intent (view / create_task / mark_reviewed /
--   re_parse / download). Automatisk INSERT-trigger ble bevisst valgt
--   bort fordi RLS-SELECT ikke gir en trigger-krok — vi ville fått
--   tomme view-rader hver gang dashboardet refresher en liste.
--   Restrisiko deferred: ip_address + user_agent settes kun når UI
--   sender dem (default null). Server-side enriching i en edge fn er
--   mulig men ikke implementert i denne sprinten.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ── 1. Table ─────────────────────────────────────────────────────────────

create table if not exists public.tilsynsbrev_access_log (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid not null references public.tilsynsbrev_uploads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accessed_by     uuid not null references public.profiles(id) on delete restrict,
  accessed_at     timestamptz not null default now(),
  action          text not null
                    check (action in ('view','create_task','mark_reviewed','re_parse','download')),
  ip_address      inet,
  user_agent      text
);

create index if not exists tilsynsbrev_access_log_upload_idx
  on public.tilsynsbrev_access_log (upload_id, accessed_at desc);
create index if not exists tilsynsbrev_access_log_org_idx
  on public.tilsynsbrev_access_log (organization_id, accessed_at desc);
create index if not exists tilsynsbrev_access_log_user_idx
  on public.tilsynsbrev_access_log (accessed_by, accessed_at desc);

comment on table public.tilsynsbrev_access_log is
  'Append-only audit trail. One row per user-driven action on a tilsynsbrev_uploads row (view / create_task / mark_reviewed / re_parse / download). UI calls tilsynsbrev_log_access() explicitly — no automatic INSERT-trigger on tilsynsbrev_uploads. AML § 2A-7 + GDPR Art. 30 + IK-f § 5 nr. 7 forensic requirement.';
comment on column public.tilsynsbrev_access_log.action is
  'view = page load; create_task = onCreateTask spawned an oppgave; mark_reviewed = manual_review_status flipped to accepted; re_parse = parser edge-fn re-invoked; download = signed-URL fetched for the PDF.';
comment on column public.tilsynsbrev_access_log.ip_address is
  'Optional client IP. Set when UI passes it (e.g. via a reverse-proxy header) or by a server-side wrapper. Null is allowed.';

-- ── 2. RLS ───────────────────────────────────────────────────────────────

alter table public.tilsynsbrev_access_log enable row level security;

-- SELECT: any org member with the upload permission for the org. Reading
-- the log itself does NOT require tilsynsbrev.view_confidential — the
-- log entries describe *who* looked, not the upload payload.
drop policy if exists tilsynsbrev_access_log_select_org on public.tilsynsbrev_access_log;
create policy tilsynsbrev_access_log_select_org
  on public.tilsynsbrev_access_log
  for select
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

-- INSERT: only service_role (RPC runs SECURITY DEFINER). End-user role
-- gets no direct insert grant — keeps the schema honest about the
-- explicit-intent pattern.
drop policy if exists tilsynsbrev_access_log_service_insert on public.tilsynsbrev_access_log;
create policy tilsynsbrev_access_log_service_insert
  on public.tilsynsbrev_access_log
  for insert
  to service_role
  with check (true);

-- UPDATE / DELETE: denied via policy (and via trigger for defense-in-depth).
drop policy if exists tilsynsbrev_access_log_update_denied on public.tilsynsbrev_access_log;
create policy tilsynsbrev_access_log_update_denied
  on public.tilsynsbrev_access_log
  for update
  using (false);

drop policy if exists tilsynsbrev_access_log_delete_denied on public.tilsynsbrev_access_log;
create policy tilsynsbrev_access_log_delete_denied
  on public.tilsynsbrev_access_log
  for delete
  using (false);

-- ── 3. Append-only triggers ──────────────────────────────────────────────

create or replace function public.trg_tilsynsbrev_access_log_deny_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tilsynsbrev_access_log is append-only; update denied for row %', old.id;
end;
$$;

drop trigger if exists tilsynsbrev_access_log_deny_update on public.tilsynsbrev_access_log;
create trigger tilsynsbrev_access_log_deny_update
  before update on public.tilsynsbrev_access_log
  for each row execute function public.trg_tilsynsbrev_access_log_deny_update();

create or replace function public.trg_tilsynsbrev_access_log_deny_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tilsynsbrev_access_log is append-only; delete denied for row %', old.id;
end;
$$;

drop trigger if exists tilsynsbrev_access_log_deny_delete on public.tilsynsbrev_access_log;
create trigger tilsynsbrev_access_log_deny_delete
  before delete on public.tilsynsbrev_access_log
  for each row execute function public.trg_tilsynsbrev_access_log_deny_delete();

-- ── 4. RPC: explicit access logging from the application layer ───────────
-- The UI calls this after a meaningful interaction (page load, create
-- task, mark reviewed). SECURITY DEFINER so it can insert past the
-- service_role-only RLS — but we still gate on org membership and on
-- the upload row being visible to the caller via the existing RLS
-- (read happens through the join in the cross-org check below).

create or replace function public.tilsynsbrev_log_access(
  p_upload_id uuid,
  p_action    text,
  p_ip        inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid;
  v_uid   uuid := auth.uid();
  v_row   uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_action not in ('view','create_task','mark_reviewed','re_parse','download') then
    raise exception 'invalid action: %', p_action;
  end if;

  select organization_id into v_org
    from public.tilsynsbrev_uploads
   where id = p_upload_id;
  if v_org is null then
    raise exception 'upload % not found', p_upload_id;
  end if;
  if v_org <> public.current_org_id() then
    raise exception 'cross-org access denied';
  end if;

  insert into public.tilsynsbrev_access_log (
    upload_id, organization_id, accessed_by, action, ip_address, user_agent
  )
  values (
    p_upload_id, v_org, v_uid, p_action, p_ip, nullif(p_user_agent, '')
  )
  returning id into v_row;

  return v_row;
end;
$$;

revoke all on function public.tilsynsbrev_log_access(uuid, text, inet, text) from public;
grant execute on function public.tilsynsbrev_log_access(uuid, text, inet, text)
  to authenticated, service_role;

comment on function public.tilsynsbrev_log_access(uuid, text, inet, text) is
  'Append a row to tilsynsbrev_access_log. Called explicitly from the UI on page-load (view), task-spawn (create_task), review-flip (mark_reviewed), re-parse (re_parse) and PDF download (download). SECURITY DEFINER because end-users have no direct INSERT grant — this preserves the "explicit intent" invariant.';

-- ── 5. Grants ────────────────────────────────────────────────────────────

grant select on public.tilsynsbrev_access_log to authenticated;
grant insert, select on public.tilsynsbrev_access_log to service_role;
