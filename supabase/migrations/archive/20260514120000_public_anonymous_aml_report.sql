-- Public (anon) innsending av aggregert anonym AML-henvendelse inn i org_module_payloads.workplace_reporting.
-- Samme org-slug som offentlig varsling (whistle_public_slug).

create or replace function public.public_anonymous_aml_page_settings(p_org_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.payload->'anonymousAmlPage'
      from public.organizations o
      join public.org_module_payloads p
        on p.organization_id = o.id and p.module_key = 'workplace_reporting'
      where lower(trim(o.whistle_public_slug)) = lower(trim(p_org_slug))
      limit 1
    ),
    '{}'::jsonb
  );
$$;

grant execute on function public.public_anonymous_aml_page_settings(text) to anon, authenticated;

create or replace function public.public_submit_anonymous_aml_report(
  p_org_slug text,
  p_kind text,
  p_urgency text,
  p_details_indicated boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_payload jsonb;
  v_report jsonb;
  v_merged jsonb;
  v_kinds constant text[] := array[
    'work_injury_illness',
    'near_miss',
    'harassment_discrimination',
    'violence_threat',
    'psychosocial',
    'whistleblowing',
    'other'
  ];
  v_urg constant text[] := array['low', 'medium', 'high'];
begin
  if p_org_slug is null or length(trim(p_org_slug)) < 8 then
    raise exception 'invalid_slug';
  end if;
  select id into v_org_id
  from public.organizations
  where lower(trim(whistle_public_slug)) = lower(trim(p_org_slug))
  limit 1;
  if v_org_id is null then
    raise exception 'org_not_found';
  end if;
  if p_kind is null or not (trim(p_kind) = any(v_kinds)) then
    raise exception 'invalid_kind';
  end if;
  if p_urgency is null or not (trim(p_urgency) = any(v_urg)) then
    raise exception 'invalid_urgency';
  end if;

  select coalesce(
    (
      select p.payload
      from public.org_module_payloads p
      where p.organization_id = v_org_id and p.module_key = 'workplace_reporting'
    ),
    '{}'::jsonb
  )
  into v_payload;

  v_report := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'kind', trim(p_kind),
    'submittedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'detailsIndicated', coalesce(p_details_indicated, false),
    'urgency', trim(p_urgency)
  );

  v_merged := jsonb_set(
    v_payload,
    '{anonymousAmlReports}',
    jsonb_build_array(v_report) || coalesce(v_payload->'anonymousAmlReports', '[]'::jsonb),
    true
  );

  insert into public.org_module_payloads (organization_id, module_key, payload)
  values (v_org_id, 'workplace_reporting', v_merged)
  on conflict (organization_id, module_key) do update
  set payload = excluded.payload, updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.public_submit_anonymous_aml_report(text, text, text, boolean) to anon, authenticated;
