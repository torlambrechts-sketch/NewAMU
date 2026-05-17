-- gov_notifications_outbox — manual-triage RPCs + audit-log table.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 5-2 (24-timers melding til
--   Arbeidstilsynet ved alvorlige skader), GDPR Art. 33 (72-timers
--   varsel til Datatilsynet ved personvernbrudd) og IK-f § 5 nr. 7
--   (dokumentasjonsplikt — manuelle innsendinger må kunne re-spores
--   mot regulator-referansenummer). Etter Schrems-II ble auto-send via
--   SendGrid skrudd av (_121000), så manual_*-rader hoper seg opp i
--   awaiting_human-køen uten triage. Disse RPC-ene gir admin et
--   sporbart, signaturpliktig handlingsrom (sendt-bekreftelse eller
--   begrunnet kansellering) som tilfredsstiller IK-f sporbarhetskrav.
--   Restrisiko deferred: regulator-side bekreftelses-PDF hostes ikke
--   her — admin må selv arkivere svar/saksnummer i Dokumenter (sprint+1).

set local search_path = public, pg_catalog;

-- ── 1. Audit-log table ────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gov_outbox_triage_action') then
    create type public.gov_outbox_triage_action as enum ('sent', 'cancelled');
  end if;
end$$;

create table if not exists public.gov_outbox_triage_log (
  id                uuid primary key default gen_random_uuid(),
  outbox_id         uuid not null references public.gov_notifications_outbox (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  action            public.gov_outbox_triage_action not null,
  actor             uuid references auth.users (id) on delete set null,
  at                timestamptz not null default now(),
  payload_snapshot  jsonb not null default '{}'::jsonb,
  reason            text,
  external_ref      text,
  note              text
);

create index if not exists gov_outbox_triage_log_outbox_idx
  on public.gov_outbox_triage_log (outbox_id, at desc);
create index if not exists gov_outbox_triage_log_org_idx
  on public.gov_outbox_triage_log (organization_id, at desc);

comment on table public.gov_outbox_triage_log is
  'Append-only audit chain for human triage on gov_notifications_outbox. One row per manual sent/cancel — IK-f § 5 nr. 7 sporbarhet.';

alter table public.gov_outbox_triage_log enable row level security;

drop policy if exists "gov_outbox_triage_log_select_org" on public.gov_outbox_triage_log;
create policy "gov_outbox_triage_log_select_org"
  on public.gov_outbox_triage_log for select
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('gov.outbox_triage'))
  );

drop policy if exists "gov_outbox_triage_log_service_insert" on public.gov_outbox_triage_log;
create policy "gov_outbox_triage_log_service_insert"
  on public.gov_outbox_triage_log for insert
  to service_role
  with check (true);

create or replace function public.trg_gov_outbox_triage_log_deny_update()
returns trigger language plpgsql as $$
begin
  raise exception 'gov_outbox_triage_log is append-only; update denied for row %', old.id;
end;
$$;
drop trigger if exists gov_outbox_triage_log_deny_update on public.gov_outbox_triage_log;
create trigger gov_outbox_triage_log_deny_update
  before update on public.gov_outbox_triage_log
  for each row execute function public.trg_gov_outbox_triage_log_deny_update();

create or replace function public.trg_gov_outbox_triage_log_deny_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'gov_outbox_triage_log is append-only; delete denied for row %', old.id;
end;
$$;
drop trigger if exists gov_outbox_triage_log_deny_delete on public.gov_outbox_triage_log;
create trigger gov_outbox_triage_log_deny_delete
  before delete on public.gov_outbox_triage_log
  for each row execute function public.trg_gov_outbox_triage_log_deny_delete();

grant select on public.gov_outbox_triage_log to authenticated;
grant insert, select on public.gov_outbox_triage_log to service_role;

-- ── 2. RPC: gov_outbox_mark_sent ────────────────────────────────────────────

create or replace function public.gov_outbox_mark_sent(
  p_id           uuid,
  p_external_ref text,
  p_sent_at      timestamptz default now(),
  p_note         text default null
)
returns public.gov_notifications_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row     public.gov_notifications_outbox;
  v_status  text;
  v_actor   uuid := auth.uid();
  v_payload jsonb;
  v_meta    jsonb;
begin
  if v_actor is null then
    raise exception 'gov_outbox_mark_sent: not authenticated';
  end if;
  if p_external_ref is null or length(btrim(p_external_ref)) = 0 then
    raise exception 'gov_outbox_mark_sent: external reference is required';
  end if;

  select * into v_row
    from public.gov_notifications_outbox
   where id = p_id
   for update;
  if not found then
    raise exception 'gov_outbox_mark_sent: outbox row % not found', p_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'gov_outbox_mark_sent: org mismatch';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('gov.outbox_triage')) then
    raise exception 'gov_outbox_mark_sent: missing permission gov.outbox_triage';
  end if;

  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  v_status  := coalesce(v_payload ->> 'status', '');
  if v_status <> 'awaiting_human' then
    raise exception 'gov_outbox_mark_sent: row % is not awaiting_human (status=%)', p_id, v_status;
  end if;

  v_meta := jsonb_build_object(
    'external_ref', p_external_ref,
    'sent_by',      v_actor::text,
    'sent_at',      p_sent_at,
    'note',         p_note
  );

  update public.gov_notifications_outbox
     set resolved_at = p_sent_at,
         payload     = v_payload
                        || jsonb_build_object('status', 'sent')
                        || jsonb_build_object('manual_submission', v_meta)
   where id = p_id
  returning * into v_row;

  insert into public.gov_outbox_triage_log (
    outbox_id, organization_id, action, actor, at, payload_snapshot, external_ref, note
  ) values (
    p_id, v_row.organization_id, 'sent', v_actor, p_sent_at, v_payload, p_external_ref, p_note
  );

  -- Tell the workflow engine so downstream audit chains continue.
  begin
    perform public.workflow_dispatch_db_event(
      v_row.organization_id,
      'gov',
      'ON_MANUAL_OUTBOX_SUBMITTED',
      jsonb_build_object(
        'outbox_id',      v_row.id,
        'kind',           v_row.kind,
        'external_ref',   p_external_ref,
        'sent_by',        v_actor::text,
        'sent_at',        p_sent_at,
        'rule_id',        v_row.rule_id,
        'run_id',         v_row.run_id,
        'organization_id', v_row.organization_id
      )
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others             then null;
  end;

  return v_row;
end;
$$;

revoke all on function public.gov_outbox_mark_sent(uuid, text, timestamptz, text) from public;
grant execute on function public.gov_outbox_mark_sent(uuid, text, timestamptz, text) to authenticated;

comment on function public.gov_outbox_mark_sent(uuid, text, timestamptz, text) is
  'Human triage: confirms that an admin has filed the regulator notification manually. Requires gov.outbox_triage permission. Writes audit log + fires ON_MANUAL_OUTBOX_SUBMITTED workflow event.';

-- ── 3. RPC: gov_outbox_cancel ───────────────────────────────────────────────

create or replace function public.gov_outbox_cancel(
  p_id     uuid,
  p_reason text
)
returns public.gov_notifications_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row     public.gov_notifications_outbox;
  v_status  text;
  v_actor   uuid := auth.uid();
  v_payload jsonb;
begin
  if v_actor is null then
    raise exception 'gov_outbox_cancel: not authenticated';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'gov_outbox_cancel: reason is required';
  end if;

  select * into v_row
    from public.gov_notifications_outbox
   where id = p_id
   for update;
  if not found then
    raise exception 'gov_outbox_cancel: outbox row % not found', p_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'gov_outbox_cancel: org mismatch';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('gov.outbox_triage')) then
    raise exception 'gov_outbox_cancel: missing permission gov.outbox_triage';
  end if;

  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  v_status  := coalesce(v_payload ->> 'status', '');
  -- 'awaiting_human' rows are flagged in payload; rows that never got
  -- flagged are still "pending" (resolved_at NULL, no status field).
  if v_row.resolved_at is not null then
    raise exception 'gov_outbox_cancel: row % is already resolved', p_id;
  end if;
  if v_status not in ('awaiting_human', '', 'pending') then
    raise exception 'gov_outbox_cancel: row % is not cancellable (status=%)', p_id, v_status;
  end if;

  update public.gov_notifications_outbox
     set resolved_at = now(),
         payload     = v_payload
                        || jsonb_build_object('status', 'cancelled')
                        || jsonb_build_object('cancellation', jsonb_build_object(
                              'reason',      p_reason,
                              'cancelled_by', v_actor::text,
                              'cancelled_at', now()
                           ))
   where id = p_id
  returning * into v_row;

  insert into public.gov_outbox_triage_log (
    outbox_id, organization_id, action, actor, at, payload_snapshot, reason
  ) values (
    p_id, v_row.organization_id, 'cancelled', v_actor, now(), v_payload, p_reason
  );

  return v_row;
end;
$$;

revoke all on function public.gov_outbox_cancel(uuid, text) from public;
grant execute on function public.gov_outbox_cancel(uuid, text) to authenticated;

comment on function public.gov_outbox_cancel(uuid, text) is
  'Human triage: cancels a pending or awaiting_human outbox row. Reason is required and logged to gov_outbox_triage_log. Requires gov.outbox_triage permission.';

-- ── 4. Permission seed ──────────────────────────────────────────────────────

-- Backfill: every admin + daglig_leder role across all orgs gets the key.
-- Idempotent via primary key (role_id, permission_key).
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'gov.outbox_triage'
  from public.role_definitions rd
 where rd.slug in ('admin', 'daglig_leder', 'daglig-leder')
on conflict (role_id, permission_key) do nothing;

do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.role_permissions rp
    join public.role_definitions rd on rd.id = rp.role_id
   where rp.permission_key = 'gov.outbox_triage'
     and rd.slug in ('admin', 'daglig_leder', 'daglig-leder');
  raise notice 'gov_outbox_manual_triage: gov.outbox_triage seeded to % role rows', v_count;
end$$;
