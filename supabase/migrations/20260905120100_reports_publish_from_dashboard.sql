-- Atomic clone-and-publish: given a kind='dashboard' source row, mint a
-- new kind='report' row populated with the current view's layout + filters
-- and a freshly-frozen snapshot. Lets the in-dashboard "Lag rapport"
-- button skip the older two-step (save-as → publish) flow.
--
-- Caller must hold reports.manage. The source row + new report row live
-- in the same org and share the same scope_id; report_scopes is empty
-- (composite scopes already merge dataset maps client-side and pass a
-- single namespaced map in p_snapshot).
--
-- cover_meta on the new report carries source_dashboard_id +
-- source_dashboard_name so the per-scope report list can group reports
-- by the dashboard they were published from.

create or replace function public.publish_dashboard_as_report(
  p_source_id        uuid,
  p_name             text,
  p_description      text default null,
  p_snapshot         jsonb default '{}'::jsonb,
  p_share_password   text default null,
  p_share_expires_at timestamptz default null
) returns table (ok boolean, report_id uuid, share_token text, err text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid := public.current_org_id();
  v_source     public.dashboard_layouts;
  v_report_id  uuid;
  v_slug       text;
  v_token      text;
  v_pwd_hash   text;
begin
  if v_uid is null then
    return query select false, null::uuid, null::text, 'not_authenticated'::text;
    return;
  end if;
  if not public.user_has_permission('reports.manage', v_uid) then
    return query select false, null::uuid, null::text, 'forbidden'::text;
    return;
  end if;

  select * into v_source
  from public.dashboard_layouts
  where id = p_source_id and organization_id = v_org and deleted_at is null;
  if not found then
    return query select false, null::uuid, null::text, 'not_found'::text;
    return;
  end if;
  if v_source.kind <> 'dashboard' then
    return query select false, null::uuid, null::text, 'source_must_be_dashboard'::text;
    return;
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    return query select false, null::uuid, null::text, 'snapshot_required'::text;
    return;
  end if;
  if octet_length(p_snapshot::text) >= 4 * 1024 * 1024 then
    return query select false, null::uuid, null::text, 'snapshot_too_large'::text;
    return;
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return query select false, null::uuid, null::text, 'name_required'::text;
    return;
  end if;

  -- 24-char base64url, 144 bits of entropy — mirrors publish_report.
  v_token := rtrim(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_'), '=');
  v_pwd_hash := case
    when p_share_password is null or length(p_share_password) = 0 then null
    else crypt(p_share_password, gen_salt('bf'))
  end;

  -- Slug must be unique per (org, scope, owner=null). 8 random base32-ish
  -- chars give ~10^12 keyspace per scope — plenty for retries.
  v_slug := 'rpt-' || lower(regexp_replace(
    substr(encode(gen_random_bytes(6), 'base64'), 1, 8),
    '[^a-zA-Z0-9]', 'x', 'g'
  ));

  insert into public.dashboard_layouts (
    organization_id, scope_id, kind, slug, name, description,
    layout, filters, report_scopes, cover_meta,
    snapshot_data, snapshot_at,
    share_token, share_password_hash, share_expires_at,
    published_at, published_by,
    is_default, owner_user_id
  ) values (
    v_org,
    v_source.scope_id,
    'report',
    v_slug,
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_source.layout,
    v_source.filters,
    '{}'::text[],
    jsonb_build_object(
      'title',                 btrim(p_name),
      'source_dashboard_id',   v_source.id,
      'source_dashboard_name', v_source.name
    ),
    p_snapshot,
    now(),
    v_token,
    v_pwd_hash,
    p_share_expires_at,
    now(),
    v_uid,
    false,
    null
  )
  returning id into v_report_id;

  return query select true, v_report_id, v_token, null::text;
end;
$$;

revoke all on function public.publish_dashboard_as_report(uuid, text, text, jsonb, text, timestamptz) from public;
grant execute on function public.publish_dashboard_as_report(uuid, text, text, jsonb, text, timestamptz) to authenticated;
