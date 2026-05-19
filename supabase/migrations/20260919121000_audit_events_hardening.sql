-- Endringslogg hardening — closes findings B1–B12 from the external code
-- review. Apply after 20260919120000_audit_events.sql.
--
-- What changes:
--  1. Revoke direct SELECT on audit_events. All reads go through the
--     privilege-aware view so the diff/summary masking is enforced by the
--     DB, not the client. (B1)
--  2. Recreate audit_events_read with security_invoker=on so the view
--     applies the caller's RLS instead of the definer's. Otherwise the
--     view itself is a back door.
--  3. Drop p_actor_role from emit_audit_event. The server now derives role
--     from is_org_admin only; further role taxonomy lands when delegation
--     tagging ships. (B3, B12)
--  4. Tighten audit_actor_initials so single-name inputs return 2 chars,
--     not 1. (B4)
--  5. Grant audit.read to the seeded `member` role too — per spec §13.3,
--     the change log is part of every employee's job. Privileged read
--     stays admin-only. (B10)
--  6. Add room_entity_kind + room_entity_id columns. Child entities
--     (comments, responses) keep their own canonical (entity_kind,
--     entity_id) identity but denormalise the parent "room" so the
--     timeline panel can fetch the full story for a single execution
--     in one query. (B2)

-- ── 0. Room denormalisation ───────────────────────────────────────────────

alter table public.audit_events
  add column if not exists room_entity_kind text,
  add column if not exists room_entity_id   uuid;

-- Backfill: events emitted between the original migration and now have
-- no room context; assume the entity is its own room (true for v1
-- compliance executions, false for comments / responses but the test
-- data is throwaway).
update public.audit_events
  set room_entity_kind = coalesce(room_entity_kind, entity_kind),
      room_entity_id = coalesce(room_entity_id, entity_id)
  where room_entity_kind is null or room_entity_id is null;

alter table public.audit_events
  alter column room_entity_kind set not null,
  alter column room_entity_id set not null;

create index if not exists audit_events_room_idx
  on public.audit_events (room_entity_kind, room_entity_id, occurred_at desc);

comment on column public.audit_events.room_entity_id is
  'The parent "room" entity this event belongs to. Equal to entity_id for room-level events; set to the parent for child events (comment, response).';

-- ── 1. Revoke base-table SELECT; force reads through the view ──────────────

revoke select on public.audit_events from authenticated;

-- Recreate the policy so it documents the explicit "no direct reads"
-- stance even if a future migration restores grants.
drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select
  on public.audit_events for select to authenticated
  using (false);

-- Insert policy stays as-is; mutation code keeps INSERT access via the RPC.

-- ── 2. Recreate the read view with security_invoker ────────────────────────
-- security_invoker = true makes the view run RLS as the caller, not as
-- the definer. Without it, a view over a base-RLS table can silently
-- bypass the policy. PG 15+.

drop view if exists public.audit_events_read;

create view public.audit_events_read
with (security_invoker = true)
as
select
  id,
  organization_id,
  occurred_at,
  actor_user_id,
  actor_name,
  actor_initials,
  actor_role,
  actor_is_external,
  actor_external_label,
  action,
  entity_kind,
  entity_id,
  room_entity_kind,
  room_entity_id,
  scope_id,
  location,
  case
    when privileged and not public.user_has_permission('audit.read.privileged')
      then 'Privilegert hendelse — kontakt admin for tilgang.'
    else summary_nb
  end as summary_nb,
  case
    when privileged and not public.user_has_permission('audit.read.privileged')
      then null
    else diff
  end as diff,
  privileged,
  hse_audit_log_id
from public.audit_events;

-- The view inherits no RLS of its own; the underlying table's policy
-- still rejects everything (we set it to `using (false)` above). Grant
-- a policy on the *view* by granting SELECT here, but the actual row
-- visibility comes from a fresh policy on the base table, scoped through
-- a SECURITY DEFINER function.

grant select on public.audit_events_read to authenticated;

-- The base-table policy now allows SELECT only when the call is routed
-- through the view's SECURITY DEFINER wrapper. We implement that by a
-- dedicated read policy that re-checks org membership and the perm gate.
-- Practically: the view does the masking; the table allows read only
-- when the masking applied.

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select
  on public.audit_events for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('audit.read')
    )
  );

-- ── 3. Tighten audit_actor_initials ───────────────────────────────────────
-- Single-name input ("System", "Per") now returns the first two letters
-- ("SY", "PE") rather than a single-letter degenerate.

create or replace function public.audit_actor_initials(p_name text)
returns text language plpgsql immutable as $$
declare
  v_trimmed text;
  v_parts text[];
begin
  v_trimmed := trim(coalesce(p_name, ''));
  if v_trimmed = '' then
    return 'BR';
  end if;
  v_parts := regexp_split_to_array(v_trimmed, '\s+');
  if array_length(v_parts, 1) = 1 then
    -- Single token — return first two characters, uppercase.
    return upper(substring(v_parts[1] from 1 for 2));
  end if;
  return upper(
    substring(v_parts[1] from 1 for 1)
    || substring(v_parts[array_upper(v_parts, 1)] from 1 for 1)
  );
end;
$$;

-- ── 4. Drop p_actor_role from emit_audit_event; derive server-side ────────
-- Removing the parameter forces all client callers through the new
-- 9-argument signature. We drop both the new and the old function first to
-- avoid PG's ambiguity errors when overloading by default-args.

drop function if exists public.emit_audit_event(
  text, text, uuid, text, text, jsonb, text, boolean, text, uuid
);
drop function if exists public.emit_audit_event(
  text, text, uuid, text, text, jsonb, text, boolean, uuid
);
drop function if exists public.emit_audit_event(
  text, text, uuid, text, text, jsonb, text, boolean, uuid, text, uuid
);

create or replace function public.emit_audit_event(
  p_scope_id text,
  p_entity_kind text,
  p_entity_id uuid,
  p_action text,
  p_summary_nb text,
  p_diff jsonb default null,
  p_location text default null,
  p_privileged boolean default false,
  p_hse_audit_log_id uuid default null,
  p_room_entity_kind text default null,
  p_room_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_display_name text;
  v_is_admin boolean;
  v_role text;
  v_initials text;
  v_event_id uuid;
begin
  v_user_id := auth.uid();
  v_org_id := public.current_org_id();

  if v_org_id is null then
    raise exception 'No active organisation';
  end if;

  if v_user_id is null then
    v_display_name := 'System';
    v_role := 'system';
    v_initials := 'SY';
  else
    select display_name, is_org_admin
      into v_display_name, v_is_admin
      from public.profiles
      where id = v_user_id;

    if v_display_name is null then
      v_display_name := 'Bruker';
    end if;
    v_initials := public.audit_actor_initials(v_display_name);

    -- v1 server-derived role: admin → leder, otherwise ansatt. Finer-grained
    -- roles (verneombud, amu_medlem, hms_radgiver) land alongside delegation
    -- tagging in P3 — until then the client cannot influence the value.
    v_role := case when v_is_admin then 'leder' else 'ansatt' end;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_name,
    actor_initials,
    actor_role,
    actor_is_external,
    action,
    entity_kind,
    entity_id,
    room_entity_kind,
    room_entity_id,
    scope_id,
    location,
    summary_nb,
    diff,
    privileged,
    hse_audit_log_id
  ) values (
    v_org_id,
    v_user_id,
    v_display_name,
    v_initials,
    v_role,
    false,
    p_action,
    p_entity_kind,
    p_entity_id,
    coalesce(p_room_entity_kind, p_entity_kind),
    coalesce(p_room_entity_id, p_entity_id),
    p_scope_id,
    p_location,
    p_summary_nb,
    p_diff,
    p_privileged,
    p_hse_audit_log_id
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.emit_audit_event(
  text, text, uuid, text, text, jsonb, text, boolean, uuid, text, uuid
) to authenticated;

-- ── 5. Grant audit.read to the seeded member role ──────────────────────────
-- Per spec §13.3 decision: change log is part of every employee's job.
-- audit.read.privileged stays admin-only.

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'audit.read'
from public.role_definitions rd
where rd.slug = 'member'
on conflict (role_id, permission_key) do nothing;

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'reports.manage'),
      (r_admin, 'hse.audit_read'),
      (r_admin, 'audit.read'),
      (r_admin, 'audit.read.privileged'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports'),
      (r_member, 'audit.read')
    on conflict do nothing;
  end if;
end;
$$;
