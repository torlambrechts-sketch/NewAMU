-- Meetings · 3-of-3 signature contract for AMU protocols (L16).
--
-- Why
--   Forskrift om org. ledelse § 3-16: protokoll for AMU-møter skal
--   signeres av møteleder OG sekretær (forvaltningspraksis legger til
--   nestleder/management for ledelsens gjennomgang etter ISO 9001 §9.3).
--   Current sign-RPC flips protocol_signed_at on first signature — i.e.
--   the meeting is "locked" after just one of three required signers.
--
--   This migration adds:
--   1. `required_signer_roles` text[] on meetings — copied from template
--      definition.protocolRoles at creation. Default ['chair','secretary'].
--   2. AFTER INSERT trigger on meeting_signatures that flips
--      protocol_signed_at ONLY when all required roles have signed.
--   3. Patches meetings_sign_protocol_v1: no longer stamps protocol_signed_at
--      itself; lets the trigger compute when all-signed.
--
--   The signature trail is still single-row-per-signer; meeting becomes
--   locked atomically when the trigger sees all required roles covered.
--
-- Self-audit (Arbeidstilsynet POV)
--   Closes Forskrift om org. ledelse § 3-16 — signing obligation.

set local search_path = public, pg_catalog;

-- ── 1. Required roles column on meetings ──────────────────────────────────

alter table public.meetings
  add column if not exists required_signer_roles text[] not null default '{chair,secretary}';

comment on column public.meetings.required_signer_roles is
  'Roles required to sign before protocol_signed_at flips (Forskrift om org. ledelse § 3-16). Copied from template definition.protocolRoles at creation. Default {chair,secretary}.';

-- Backfill from template definition where present.
update public.meetings m
   set required_signer_roles = coalesce(
     (select array_agg(value::text)
      from jsonb_array_elements_text(m.definition_snapshot->'protocolRoles')),
     '{chair,secretary}'
   )
 where required_signer_roles = '{chair,secretary}'
   and m.definition_snapshot ? 'protocolRoles';

-- ── 2. Trigger: flip protocol_signed_at when all required roles signed ────

create or replace function public.meeting_check_all_signed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_meeting public.meetings;
  v_signed_roles text[];
  v_all_signed boolean;
begin
  select * into v_meeting from public.meetings where id = new.meeting_id;
  if v_meeting.protocol_signed_at is not null then
    return new;
  end if;

  select array_agg(distinct signer_role) into v_signed_roles
    from public.meeting_signatures
   where meeting_id = new.meeting_id;

  -- Are all required roles covered?
  v_all_signed := (
    select bool_and(r = any(coalesce(v_signed_roles, '{}'::text[])))
      from unnest(v_meeting.required_signer_roles) r
  );

  if v_all_signed then
    update public.meetings
       set protocol_signed_at = now(),
           protocol_signed_by = new.signer_member_id,
           status = 'completed',
           completed_at = now()
     where id = new.meeting_id
       and protocol_signed_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists meeting_check_all_signed_tg on public.meeting_signatures;
create trigger meeting_check_all_signed_tg
  after insert on public.meeting_signatures
  for each row execute function public.meeting_check_all_signed();

-- Revoke direct execute — trigger-only path.
revoke execute on function public.meeting_check_all_signed() from public, anon, authenticated;

comment on function public.meeting_check_all_signed() is
  'AFTER INSERT trigger on meeting_signatures: when all required_signer_roles have at least one signature, flips meetings.protocol_signed_at (the lock-marker). Replaces the single-shot stamp in meetings_sign_protocol_v1.';

-- ── 3. Patch meetings_sign_protocol_v1 — no longer stamps directly ─────────

create or replace function public.meetings_sign_protocol_v1(
  p_meeting_id uuid,
  p_signer_name text,
  p_signer_role text,
  p_signer_member_id uuid,
  p_document_hash_sha256 text,
  p_client_ip text
)
returns table (
  signature_id uuid,
  level1_event_id uuid
)
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_level1_id uuid;
  v_sig_id uuid;
  v_now timestamptz := now();
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select organization_id into v_org_id from public.meetings where id = p_meeting_id;
  if v_org_id is null then
    raise exception 'Meeting % not found or not visible', p_meeting_id
      using errcode = 'no_data_found';
  end if;

  if p_document_hash_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'document_hash_sha256 must be 64 lowercase hex chars'
      using errcode = 'check_violation';
  end if;

  insert into public.system_signature_events (
    organization_id, user_id, resource_type, resource_id, action,
    document_hash_sha256, signer_display_name, role, client_ip
  )
  values (
    v_org_id, v_user_id, 'meeting_protocol', p_meeting_id::text,
    'meeting_protocol_sign_' || p_signer_role,
    p_document_hash_sha256, btrim(p_signer_name), p_signer_role, p_client_ip
  )
  returning id into v_level1_id;

  insert into public.meeting_signatures (
    meeting_id, signer_member_id, signer_name, signer_role,
    signed_at, is_legally_binding, level1_event_id
  )
  values (
    p_meeting_id, p_signer_member_id, p_signer_name, p_signer_role,
    v_now, false, v_level1_id
  )
  returning id into v_sig_id;

  -- meeting_check_all_signed trigger handles the protocol_signed_at flip
  -- when the last required role signs.

  return query select v_sig_id, v_level1_id;
end;
$$;

revoke all on function public.meetings_sign_protocol_v1(uuid, text, text, uuid, text, text) from public;
grant execute on function public.meetings_sign_protocol_v1(uuid, text, text, uuid, text, text) to authenticated;
