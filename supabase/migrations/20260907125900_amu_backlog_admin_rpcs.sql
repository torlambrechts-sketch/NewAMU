-- AMU agenda backlog admin RPCs — manual assign + dismiss with audit.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 7-2 (AMU saksbehandling — alle saker
--   må enten landes på et møte eller dokumentert avvises) + IK-f § 5
--   nr. 8 (system for behandling av avvik/forbedringsforslag — drenering
--   av "tapte" workflow-saker må være sporbar). _20260907124400 leverer
--   automatisk drenering; uten manuell knytting/avvisning + append-only
--   log er restansen et hull i sak­håndteringen.
--   Restrisiko deferred: assign-RPC kopier kun tittel/beskrivelse til
--   agenda-elementet — kobling tilbake til opprinnelig backlog-id
--   (source_backlog_id) er ikke spent på meeting_agenda_items i v0.
--   "Recently drained" historikken leses derfor fra backlog-tabellens
--   drained_at + drained_into; en backfill-kolonne kan legges til
--   senere uten å bryte denne RPCen.

set local search_path = public, pg_catalog;

do $outer$
begin

if to_regclass('public.amu_agenda_backlog') is null then
  raise notice 'amu_backlog_admin_rpcs: amu_agenda_backlog missing — run _20260907124400 first.';
  return;
end if;

-- ── 1. Dismissal log — append-only forensic trail ─────────────────────────

create table if not exists public.amu_backlog_dismissal_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  backlog_id      uuid not null,
  dismissed_by    uuid,
  dismissed_at    timestamptz not null default now(),
  reason          text not null,
  snapshot        jsonb not null
);

create index if not exists amu_backlog_dismissal_log_org_idx
  on public.amu_backlog_dismissal_log (organization_id, dismissed_at desc);

create index if not exists amu_backlog_dismissal_log_backlog_idx
  on public.amu_backlog_dismissal_log (backlog_id);

comment on table public.amu_backlog_dismissal_log is
  'Append-only log of administratively dismissed AMU agenda backlog rows. Snapshot captures full row at dismissal time so the audit trail survives even though the backlog row is deleted. Writes are SECURITY DEFINER via amu_backlog_dismiss(); update/delete denied at trigger level. AML § 7-2 + IK-f § 5 nr. 8 sporbarhet.';
comment on column public.amu_backlog_dismissal_log.snapshot is
  'Full backlog row at the moment of dismissal — title, description, source_module/id, priority, created_at, meeting_type — frozen as jsonb so a later schema change to amu_agenda_backlog cannot rewrite history.';

alter table public.amu_backlog_dismissal_log enable row level security;

drop policy if exists amu_backlog_dismissal_log_select on public.amu_backlog_dismissal_log;
create policy amu_backlog_dismissal_log_select
  on public.amu_backlog_dismissal_log for select
  using (organization_id = public.current_org_id());

-- Inserts only via SECURITY DEFINER RPC (no direct INSERT policy).

create or replace function public.trg_amu_backlog_dismissal_log_deny_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'amu_backlog_dismissal_log is append-only; update denied for row %', old.id;
end;
$$;

drop trigger if exists amu_backlog_dismissal_log_deny_update on public.amu_backlog_dismissal_log;
create trigger amu_backlog_dismissal_log_deny_update
  before update on public.amu_backlog_dismissal_log
  for each row execute function public.trg_amu_backlog_dismissal_log_deny_update();

create or replace function public.trg_amu_backlog_dismissal_log_deny_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'amu_backlog_dismissal_log is append-only; delete denied for row %', old.id;
end;
$$;

drop trigger if exists amu_backlog_dismissal_log_deny_delete on public.amu_backlog_dismissal_log;
create trigger amu_backlog_dismissal_log_deny_delete
  before delete on public.amu_backlog_dismissal_log
  for each row execute function public.trg_amu_backlog_dismissal_log_deny_delete();

grant select on public.amu_backlog_dismissal_log to authenticated;

-- ── 2. amu_backlog_assign_to_meeting — manual drain ───────────────────────

create or replace function public.amu_backlog_assign_to_meeting(
  p_backlog_id uuid,
  p_meeting_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_backlog      public.amu_agenda_backlog;
  v_meeting      public.meetings;
  v_pos          int;
  v_inserted_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage')) then
    raise exception 'forbidden: meetings.manage required';
  end if;

  -- Lock the backlog row so two admins cannot drain it twice.
  select * into v_backlog
    from public.amu_agenda_backlog
   where id = p_backlog_id
   for update;

  if not found then
    raise exception 'backlog_not_found: %', p_backlog_id;
  end if;

  if v_backlog.drained_at is not null then
    raise exception 'backlog_already_drained: % (into %)', p_backlog_id, v_backlog.drained_into;
  end if;

  if v_backlog.organization_id is distinct from public.current_org_id() then
    raise exception 'cross_org_assign_denied';
  end if;

  select * into v_meeting
    from public.meetings
   where id = p_meeting_id;

  if not found then
    raise exception 'meeting_not_found: %', p_meeting_id;
  end if;

  if v_meeting.organization_id is distinct from v_backlog.organization_id then
    raise exception 'org_mismatch: backlog org % vs meeting org %',
      v_backlog.organization_id, v_meeting.organization_id;
  end if;

  if v_meeting.status not in ('planned','in_progress') then
    raise exception 'meeting_not_assignable: status %', v_meeting.status;
  end if;

  -- Append after last existing agenda item.
  select coalesce(max(position), -1) + 1 into v_pos
    from public.meeting_agenda_items
   where meeting_id = v_meeting.id;

  insert into public.meeting_agenda_items (
    meeting_id, position, title, description, is_mandatory
  ) values (
    v_meeting.id, v_pos, v_backlog.title, v_backlog.description, false
  )
  returning id into v_inserted_id;

  update public.amu_agenda_backlog
     set drained_at = now(),
         drained_into = v_inserted_id
   where id = v_backlog.id;

  -- Keep historical row for audit; consumers filter on drained_at is null.
  return v_inserted_id;
end;
$fn$;

revoke all on function public.amu_backlog_assign_to_meeting(uuid, uuid) from public, anon;
grant execute on function public.amu_backlog_assign_to_meeting(uuid, uuid) to authenticated;

comment on function public.amu_backlog_assign_to_meeting(uuid, uuid) is
  'Admin RPC — drains a single amu_agenda_backlog row into the chosen meeting by inserting a meeting_agenda_items row + stamping drained_at/drained_into. Validates caller perm (meetings.manage), org match, and meeting status. Mirrors trg_amu_agenda_backlog_drain() for manual selection.';

-- ── 3. amu_backlog_dismiss — log + delete ─────────────────────────────────

create or replace function public.amu_backlog_dismiss(
  p_id     uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_backlog public.amu_agenda_backlog;
  v_reason  text := coalesce(nullif(btrim(p_reason), ''), null);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_reason is null then
    raise exception 'reason_required';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage')) then
    raise exception 'forbidden: meetings.manage required';
  end if;

  select * into v_backlog
    from public.amu_agenda_backlog
   where id = p_id
   for update;

  if not found then
    raise exception 'backlog_not_found: %', p_id;
  end if;

  if v_backlog.organization_id is distinct from public.current_org_id() then
    raise exception 'cross_org_dismiss_denied';
  end if;

  insert into public.amu_backlog_dismissal_log (
    organization_id, backlog_id, dismissed_by, reason, snapshot
  ) values (
    v_backlog.organization_id,
    v_backlog.id,
    v_uid,
    v_reason,
    jsonb_build_object(
      'id',              v_backlog.id,
      'organization_id', v_backlog.organization_id,
      'meeting_type',    v_backlog.meeting_type,
      'title',           v_backlog.title,
      'description',     v_backlog.description,
      'source_module',   v_backlog.source_module,
      'source_id',       v_backlog.source_id,
      'priority',        v_backlog.priority,
      'drained_at',      v_backlog.drained_at,
      'drained_into',    v_backlog.drained_into,
      'created_at',      v_backlog.created_at
    )
  );

  delete from public.amu_agenda_backlog where id = v_backlog.id;
end;
$fn$;

revoke all on function public.amu_backlog_dismiss(uuid, text) from public, anon;
grant execute on function public.amu_backlog_dismiss(uuid, text) to authenticated;

comment on function public.amu_backlog_dismiss(uuid, text) is
  'Admin RPC — dismisses a single amu_agenda_backlog row by appending the full snapshot to amu_backlog_dismissal_log (append-only) and deleting the backlog row. Requires meetings.manage + non-empty reason. AML § 7-2 + IK-f § 5 nr. 8 sporbarhet.';

end
$outer$;
