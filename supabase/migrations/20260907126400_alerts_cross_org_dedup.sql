-- Cross-org alerts dedup substrate (impact-2 fix from final review).
-- Pålegg-grunner addressed: AML § 2A-7 (varslers identitet / dobbelt-spor må
--   gjenkjennes på tvers av søsterorg i konsernstruktur), GDPR Art. 17 (rett
--   til sletting krever at duplikater på tvers av søsterorg kan koples).
-- Restrisiko deferred: ingen UI for å administrere dedup-grupper (kun RPC).
--   En platform-admin må kalle alert_dedup_admin_create_group via psql/RPC
--   inntil et frontend-skjerm bygges.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. org_alert_dedup_groups — one row per konsern / multi-org cluster     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.org_alert_dedup_groups (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  shared_fingerprint_key  bytea not null,
  created_at              timestamptz not null default now()
);

comment on table public.org_alert_dedup_groups is
  'Cross-org alerts dedup cluster (e.g. konsernstruktur). A single random 32-byte HMAC key is shared across all member orgs so alerts_text_fingerprint_shared can produce identical fingerprints for identical varsel-tekst across member orgs.';

comment on column public.org_alert_dedup_groups.shared_fingerprint_key is
  'Random 32-byte HMAC-SHA256 key shared by every member org in the group. Service-role only (RLS denies all access to authenticated). Replaces the per-org key in org_alerts_fingerprint_keys for members of the group.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. org_alert_dedup_group_members — m2m join table                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.org_alert_dedup_group_members (
  group_id        uuid not null references public.org_alert_dedup_groups (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (group_id, organization_id)
);

create index if not exists org_alert_dedup_group_members_org_idx
  on public.org_alert_dedup_group_members (organization_id);

comment on table public.org_alert_dedup_group_members is
  'Join table — which orgs belong to which cross-org dedup group. An org may belong to AT MOST one group at a time (enforced by the create-RPC; not by a DB constraint so future migrations can relax this if needed for nested konsern-strukturer).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. RLS: select for org admins of any member org; write via RPC only     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.org_alert_dedup_groups enable row level security;
alter table public.org_alert_dedup_group_members enable row level security;

drop policy if exists "org_alert_dedup_groups_select_member_admin"
  on public.org_alert_dedup_groups;
create policy "org_alert_dedup_groups_select_member_admin"
  on public.org_alert_dedup_groups for select
  to authenticated
  using (
    exists (
      select 1
        from public.org_alert_dedup_group_members m
       where m.group_id = org_alert_dedup_groups.id
         and public.is_org_admin(auth.uid())
         and m.organization_id = public.current_org_id()
    )
    or public.platform_is_admin()
  );

-- No insert/update/delete policy → writes only via service_role / SECURITY
-- DEFINER RPC. Also explicitly deny the shared_fingerprint_key bytea column
-- from being read by `select *` — we cannot have RLS hide a column, but we
-- can revoke the column grant from authenticated and only grant the other
-- columns. Done below.

drop policy if exists "org_alert_dedup_group_members_select_member_admin"
  on public.org_alert_dedup_group_members;
create policy "org_alert_dedup_group_members_select_member_admin"
  on public.org_alert_dedup_group_members for select
  to authenticated
  using (
    public.is_org_admin(auth.uid())
    and organization_id = public.current_org_id()
    or public.platform_is_admin()
  );

-- Column-level grants: hide shared_fingerprint_key from authenticated even
-- when a member admin can read the row. Service role bypasses RLS so the
-- HMAC function below still has access.
revoke all on public.org_alert_dedup_groups from authenticated;
grant select (id, name, created_at) on public.org_alert_dedup_groups to authenticated;
grant select on public.org_alert_dedup_group_members to authenticated;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. alerts_text_fingerprint_shared — group-aware HMAC                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Resolution chain (per call):
--   1. p_text null/empty → null
--   2. p_org_id is a member of some org_alert_dedup_group_members row →
--      use that group's shared_fingerprint_key
--   3. otherwise → fall back to alerts_text_fingerprint(p_org_id, p_text)
--      (the existing per-org HMAC from _121600). Backwards compatible.

create or replace function public.alerts_text_fingerprint_shared(
  p_org_id uuid,
  p_text   text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key bytea;
begin
  if p_text is null or p_text = '' then
    return null;
  end if;
  if p_org_id is null then
    raise exception 'alerts_text_fingerprint_shared: organization_id is required';
  end if;

  -- (2) shared-group lookup. If the org is in a dedup group, the group's
  -- key takes precedence over the per-org key so sister orgs produce
  -- matching fingerprints for the same varsel-tekst.
  select g.shared_fingerprint_key into v_key
    from public.org_alert_dedup_groups g
    join public.org_alert_dedup_group_members m
      on m.group_id = g.id
   where m.organization_id = p_org_id
   limit 1;

  if v_key is not null then
    return encode(public.hmac(p_text::bytea, v_key, 'sha256'), 'hex');
  end if;

  -- (3) fall back to the existing per-org HMAC.
  return public.alerts_text_fingerprint(p_org_id, p_text);
end;
$$;

revoke all on function public.alerts_text_fingerprint_shared(uuid, text) from public;
grant execute on function public.alerts_text_fingerprint_shared(uuid, text) to service_role;

comment on function public.alerts_text_fingerprint_shared(uuid, text) is
  'Cross-org-aware HMAC of varsel-fritekst. If p_org_id is in an org_alert_dedup_group, uses the group''s shared_fingerprint_key; otherwise falls back to alerts_text_fingerprint(p_org_id, p_text). Lets multi-org konserner recognise duplicate submissions across sister orgs (AML § 2A-7 / GDPR Art. 17). Caller MUST be service_role (per the trigger functions in _126400).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Re-issue trg_alert_cases_workflow_emit_submitted to use shared       │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Identical body to _20260911120050_alerts_workflow_triggers_install.sql
-- except the two alerts_text_fingerprint() calls are swapped for
-- alerts_text_fingerprint_shared(). Guarded by to_regclass since this
-- migration sorts after alert_cases has been created in 2026091112_ but
-- the guard keeps fresh-DB ordering safe.

do $migrate$
begin
  if to_regclass('public.alert_cases') is null then
    raise notice 'alert_cases not present — _20260911120000_alerts_module_core has not run. Skipping trigger rebind; _20260911120050 will re-issue with the per-org HMAC and a future fix-up after this migration can re-issue with the shared variant.';
    return;
  end if;

  execute $fn$
    create or replace function public.trg_alert_cases_workflow_emit_submitted()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_payload jsonb;
      v_is_breach boolean;
    begin
      perform set_config('app.workflow_confidentiality', 'confidential', true);

      v_payload := jsonb_build_object(
        'id',                new.id,
        'rowId',             new.id,
        'organization_id',   new.organization_id,
        'kind',              new.kind,
        'category',          new.category,
        'category_id',       new.category_id,
        'severity',          new.severity,
        'status',            new.status,
        'anonymous',         new.is_anonymous,
        'is_anonymous',      new.is_anonymous,
        'aware_at',          new.received_at,
        'received_at',       new.received_at,
        'confidentiality_level', new.confidentiality_level,
        'system_template_id', new.system_template_id,
        'description_sha256', public.alerts_text_fingerprint_shared(new.organization_id, new.description),
        'title_sha256',       public.alerts_text_fingerprint_shared(new.organization_id, new.title),
        'breach_type',        new.breach_type,
        'investigation_due_at', new.investigation_due_at
      );

      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'alerts', 'ON_ALERT_SUBMITTED', v_payload
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;

      v_is_breach := (new.kind = 'gdpr_breach')
        or (new.category in ('personvernbrudd', 'gdpr-brudd', 'gdpr_breach'));

      if v_is_breach then
        begin
          perform public.workflow_dispatch_db_event(
            new.organization_id, 'alerts', 'ON_GDPR_BREACH_REPORTED',
            v_payload || jsonb_build_object(
              'gdpr_aware_at',       new.received_at,
              'gdpr_72h_deadline_at',
                coalesce(new.investigation_due_at, new.received_at + interval '72 hours')
            )
          );
        exception
          when undefined_function then null;
          when undefined_table    then null;
          when others             then null;
        end;
      end if;

      return new;
    end;
    $body$;
  $fn$;
end
$migrate$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. alert_dedup_admin_create_group — platform-admin RPC                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alert_dedup_admin_create_group(
  p_name           text,
  p_member_org_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_org_id   uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.platform_is_admin() then
    raise exception 'alert_dedup_admin_create_group: caller must be platform_admin';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'alert_dedup_admin_create_group: name is required';
  end if;
  if p_member_org_ids is null or array_length(p_member_org_ids, 1) is null then
    raise exception 'alert_dedup_admin_create_group: at least one member org id is required';
  end if;

  -- Refuse to silently re-key an org that is already a member of another
  -- group. If a konsern is restructured the platform admin must explicitly
  -- remove the org from its current group first (via a future RPC; for
  -- now: manual delete on org_alert_dedup_group_members via service_role).
  foreach v_org_id in array p_member_org_ids loop
    if not exists (select 1 from public.organizations where id = v_org_id) then
      raise exception 'alert_dedup_admin_create_group: organization % not found', v_org_id;
    end if;
    select group_id into v_existing
      from public.org_alert_dedup_group_members
     where organization_id = v_org_id
     limit 1;
    if v_existing is not null then
      raise exception 'alert_dedup_admin_create_group: organization % already belongs to dedup group %', v_org_id, v_existing;
    end if;
  end loop;

  insert into public.org_alert_dedup_groups (name, shared_fingerprint_key)
  values (p_name, public.gen_random_bytes(32))
  returning id into v_group_id;

  foreach v_org_id in array p_member_org_ids loop
    insert into public.org_alert_dedup_group_members (group_id, organization_id)
    values (v_group_id, v_org_id)
    on conflict (group_id, organization_id) do nothing;
  end loop;

  return v_group_id;
end;
$$;

revoke all on function public.alert_dedup_admin_create_group(text, uuid[]) from public;
grant execute on function public.alert_dedup_admin_create_group(text, uuid[]) to authenticated;

comment on function public.alert_dedup_admin_create_group(text, uuid[]) is
  'Platform-admin RPC. Creates a new org_alert_dedup_groups row + member rows in one transaction. Refuses to add an org that already belongs to a different group (a single konsern at a time). The new group''s shared_fingerprint_key is random 32 bytes via pgcrypto. After this RPC fires, all member orgs route through alerts_text_fingerprint_shared with the group key instead of their per-org key from _121600.';

do $$
begin
  raise notice 'org_alert_dedup substrate installed; alerts_text_fingerprint_shared in place; emit-submitted trigger rebound.';
end
$$;
