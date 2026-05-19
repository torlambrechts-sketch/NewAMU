-- Endringslogg — semantic audit-event layer.
--
-- Why this exists: hse_audit_log (archive/20260619210000) is the immutable,
-- trigger-fed CDC trail; perfect for forensics, unrenderable by humans.
-- audit_events is the semantic layer the UI reads: explicit action verb,
-- pre-rendered Norwegian summary, typed diff. Written by mutation code via
-- emit_audit_event RPC. Two-layer pattern documented in
-- specs/endringslogg-spec.md §2.
--
-- Self-audit (Arbeidstilsynet POV): the forensic floor is untouched. The
-- semantic layer is append-only by RLS; insert is the only authenticated
-- write; update/delete are revoked. Worst-case drift between layers is
-- monitored by the recon SQL described in spec §11.

-- ── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.audit_events (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  occurred_at           timestamptz not null default now(),

  -- Actor (denormalised — profile may be deactivated later)
  actor_user_id         uuid references auth.users (id) on delete set null,
  actor_name            text not null,
  actor_initials        text not null,
  actor_role            text not null check (actor_role in (
                          'verneombud','amu_medlem','leder','hms_radgiver',
                          'ansatt','system','ekstern'
                        )),
  actor_is_external     boolean not null default false,
  actor_external_label  text,

  -- Action
  action                text not null check (action in (
                          'opprettet','endret','lukket','gjenapnet',
                          'tildelt','omfordelt','kommentert',
                          'signert','attestert','avvist','godkjent',
                          'lastet_opp_vedlegg','slettet_vedlegg',
                          'versjon_bumpet','eskalert',
                          'eksportert','delt','arkivert'
                        )),
  entity_kind           text not null,
  entity_id             uuid not null,
  scope_id              text not null,
  location              text,

  -- Pre-rendered for UI
  summary_nb            text not null,
  diff                  jsonb,

  -- Forensic anchor — nullable so non-DB-mutating events (eksportert, delt)
  -- can still be logged.
  hse_audit_log_id      uuid references public.hse_audit_log (id) on delete set null,

  -- Privilege gate (spec §6 — privileged event blur)
  privileged            boolean not null default false
);

comment on table public.audit_events is
  'Semantic audit-event layer. UI reads from this. Append-only by RLS. See specs/endringslogg-spec.md.';
comment on column public.audit_events.diff is
  'Pre-computed Diff (spec §1): single_field | multi_field | list_change | text_block. Null for actions without a value change.';
comment on column public.audit_events.privileged is
  'When true, diff content is masked for readers without audit.read.privileged. Row visibility is preserved so the trail itself is provable.';
comment on column public.audit_events.hse_audit_log_id is
  'Optional join back to the immutable CDC row. Set null on hse_audit_log delete (which is itself revoked) so a future retention sweep cannot orphan this column unexpectedly.';

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_kind, entity_id, occurred_at desc);

create index if not exists audit_events_org_scope_idx
  on public.audit_events (organization_id, scope_id, occurred_at desc);

create index if not exists audit_events_actor_idx
  on public.audit_events (actor_user_id, occurred_at desc);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.audit_events enable row level security;

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

drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert
  on public.audit_events for insert to authenticated
  with check (organization_id = public.current_org_id());

grant select, insert on public.audit_events to authenticated;
revoke update, delete on public.audit_events from authenticated;

-- ── 3. Privilege-aware read view ────────────────────────────────────────────
-- Server-side redaction. Users without audit.read.privileged see the row
-- (so the audit trail itself is provable) but the diff and summary content
-- are scrubbed for privileged events.

create or replace view public.audit_events_read as
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

-- Views inherit RLS from underlying table; explicit grant for safety.
grant select on public.audit_events_read to authenticated;

-- ── 4. Permission catalogue + role seed ─────────────────────────────────────

-- Add the two new permission keys to admin role for every existing org.
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'audit.read'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'audit.read.privileged'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- Re-seed the default-roles helper so new orgs grant audit.read to admin.
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
      (r_member, 'module.view.reports')
    on conflict do nothing;
  end if;
end;
$$;

-- ── 5. emit_audit_event RPC ─────────────────────────────────────────────────
-- Client mutation code calls this after a successful DB write. The RPC
-- resolves the actor profile (initials, display name) server-side to
-- prevent spoofing, validates the action enum, and inserts.

create or replace function public.audit_actor_initials(p_name text)
returns text language sql immutable as $$
  select upper(
    coalesce(
      nullif(
        substring(p_name from '^\s*(\S)') || coalesce(substring(p_name from '\s+(\S)[^\s]*\s*$'), ''),
        ''
      ),
      'BR'
    )
  );
$$;

create or replace function public.emit_audit_event(
  p_scope_id text,
  p_entity_kind text,
  p_entity_id uuid,
  p_action text,
  p_summary_nb text,
  p_diff jsonb default null,
  p_location text default null,
  p_privileged boolean default false,
  p_actor_role text default null,
  p_hse_audit_log_id uuid default null
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

  -- Resolve actor identity (denormalised for log integrity).
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

    -- Role: client may pass a hint (verneombud / amu_medlem / hms_radgiver
    -- when known from org_setup); fall back to leder for admins, ansatt
    -- otherwise. Better resolution lands in P3 alongside delegation tagging.
    v_role := p_actor_role;
    if v_role is null or v_role not in (
      'verneombud','amu_medlem','leder','hms_radgiver','ansatt','ekstern'
    ) then
      v_role := case when v_is_admin then 'leder' else 'ansatt' end;
    end if;
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
    v_role = 'ekstern',
    p_action,
    p_entity_kind,
    p_entity_id,
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
  text, text, uuid, text, text, jsonb, text, boolean, text, uuid
) to authenticated;
