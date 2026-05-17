-- Alerts cross-org dedup — move shared_fingerprint_key to sibling table.
--
-- Arbeidstilsynet / Datatilsynet self-audit:
--   Pålegg-grunn addressed: GDPR Art. 32 (security of processing —
--   nøkkelmateriale skal være isolert fra brukerflater). _126400 hid
--   shared_fingerprint_key via column-level revoke on the parent table;
--   a future `grant all on org_alert_dedup_groups to authenticated`
--   (added e.g. by a careless RLS refactor) would silently re-expose
--   the HMAC key. Move the key to a sibling table with deny-all RLS so
--   the access path is structural, not a privilege-stack quirk.
--   Restrisiko deferred: per-org HSM-backed dedup keys (NSM 2.4) —
--   tracked under integrations.cert_rotate roadmap.

set local search_path = public, pg_catalog;

-- ── 1. Create sibling table — service_role only, RLS denies all ───────────

create table if not exists public.org_alert_dedup_group_keys (
  group_id uuid primary key references public.org_alert_dedup_groups (id) on delete cascade,
  key      bytea not null,
  created_at timestamptz not null default now()
);

comment on table public.org_alert_dedup_group_keys is
  'Sibling of org_alert_dedup_groups holding the 32-byte HMAC key (moved from the parent in _126700). Authenticated role has NO grant or policy — service_role only. alerts_text_fingerprint_shared() reads via SECURITY DEFINER.';
comment on column public.org_alert_dedup_group_keys.key is
  'Random 32-byte HMAC-SHA256 key shared by every member org in the group. Service-role only.';

alter table public.org_alert_dedup_group_keys enable row level security;

-- Defense-in-depth: explicit deny-all policies for authenticated so that
-- even if a future grant accidentally lands, RLS still hides the rows.
drop policy if exists "org_alert_dedup_group_keys_deny_select"
  on public.org_alert_dedup_group_keys;
create policy "org_alert_dedup_group_keys_deny_select"
  on public.org_alert_dedup_group_keys for select
  to authenticated
  using (false);

drop policy if exists "org_alert_dedup_group_keys_deny_insert"
  on public.org_alert_dedup_group_keys;
create policy "org_alert_dedup_group_keys_deny_insert"
  on public.org_alert_dedup_group_keys for insert
  to authenticated
  with check (false);

drop policy if exists "org_alert_dedup_group_keys_deny_update"
  on public.org_alert_dedup_group_keys;
create policy "org_alert_dedup_group_keys_deny_update"
  on public.org_alert_dedup_group_keys for update
  to authenticated
  using (false);

drop policy if exists "org_alert_dedup_group_keys_deny_delete"
  on public.org_alert_dedup_group_keys;
create policy "org_alert_dedup_group_keys_deny_delete"
  on public.org_alert_dedup_group_keys for delete
  to authenticated
  using (false);

-- Strip default grants. service_role bypasses RLS so the SECURITY DEFINER
-- functions below still see the key.
revoke all on public.org_alert_dedup_group_keys from public;
revoke all on public.org_alert_dedup_group_keys from authenticated;

-- ── 2. Migrate existing keys from parent → sibling (idempotent) ───────────

do $$
declare
  v_has_col boolean;
begin
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'org_alert_dedup_groups'
       and column_name  = 'shared_fingerprint_key'
  ) into v_has_col;

  if v_has_col then
    insert into public.org_alert_dedup_group_keys (group_id, key)
    select id, shared_fingerprint_key
      from public.org_alert_dedup_groups
     where shared_fingerprint_key is not null
    on conflict (group_id) do nothing;
  end if;
end$$;

-- ── 3. Re-issue alerts_text_fingerprint_shared to read from sibling ───────
-- Identical signature and stability; only the key lookup join changes.

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

  -- Shared-group lookup now joins through the sibling key table; the
  -- parent table no longer carries the key column.
  select k.key into v_key
    from public.org_alert_dedup_group_members m
    join public.org_alert_dedup_group_keys k on k.group_id = m.group_id
   where m.organization_id = p_org_id
   limit 1;

  if v_key is not null then
    return encode(public.hmac(p_text::bytea, v_key, 'sha256'), 'hex');
  end if;

  return public.alerts_text_fingerprint(p_org_id, p_text);
end;
$$;

revoke all on function public.alerts_text_fingerprint_shared(uuid, text) from public;
grant execute on function public.alerts_text_fingerprint_shared(uuid, text) to service_role;

comment on function public.alerts_text_fingerprint_shared(uuid, text) is
  'Cross-org-aware HMAC of varsel-fritekst. Reads the group key from org_alert_dedup_group_keys (moved out of org_alert_dedup_groups in _126700 so authenticated cannot accidentally see it via a column grant). Falls back to alerts_text_fingerprint(p_org_id, p_text) when the org is not in a dedup group.';

-- ── 4. Re-issue alert_dedup_admin_create_group to write to sibling ────────

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

  insert into public.org_alert_dedup_groups (name)
  values (p_name)
  returning id into v_group_id;

  insert into public.org_alert_dedup_group_keys (group_id, key)
  values (v_group_id, public.gen_random_bytes(32))
  on conflict (group_id) do nothing;

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

-- ── 5. Drop the column from the parent table (idempotent) ─────────────────

alter table public.org_alert_dedup_groups
  drop column if exists shared_fingerprint_key;

-- Re-grant select on the parent now that the sensitive column is gone —
-- the row-level _126400 policy still gates access to dedup-group members.
grant select on public.org_alert_dedup_groups to authenticated;

do $$
begin
  raise notice 'org_alert_dedup_group_keys created and populated; shared_fingerprint_key dropped from parent.';
end
$$;
