-- Phase D — public RPCs for anonymous alert submission + status lookup.
--
-- Replaces:
--   public_submit_whistleblowing       → public_submit_alert
--   public_whistleblowing_status        → public_alert_status
--   public_whistleblowing_org_lookup    → public_alert_org_lookup
--
-- Legacy RPCs are kept active until Phase F4 (so /varsle/:slug URLs that
-- haven't yet been routed to the new module don't break). They live as
-- thin shims that call the new RPCs internally for the duration.
--
-- Self-audit (per spec §4.3):
--   * security definer + set search_path = public — no leak of caller's
--     elevated grants beyond the explicit insert/select.
--   * Strict key allowlist in public_submit_alert: payload keys must be
--     a subset of template.definition.publicFormFields[].key. Unknown
--     keys raise 'invalid_payload_key'.
--   * Whitelist materialisation: never reads reporter_user_id /
--     closed_at / severity etc. from the payload.
--   * captcha token validation is a no-op here (production: deploy
--     Edge Function alerts-public-submit that verifies Turnstile,
--     scrubs IP-bearing headers, and calls this RPC).
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ── public_alert_org_lookup — resolve slug → org display ──────────────────

create or replace function public.public_alert_org_lookup(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.alerts_public_slug)
    from public.organizations o
    where lower(trim(o.alerts_public_slug)) = lower(trim(p_slug))
    limit 1;
$$;

grant execute on function public.public_alert_org_lookup(text) to anon, authenticated;

-- ── public_submit_alert — anonymous submission per template ───────────────

create or replace function public.public_submit_alert(
  p_org_slug      text,
  p_template_slug text,
  p_payload       jsonb,
  p_captcha_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id        uuid;
  v_template      record;
  v_field         jsonb;
  v_allowed_keys  text[];
  v_payload_key   text;
  v_case_id       uuid;
  v_access_key    uuid;
begin
  -- 1. Validate org slug
  if p_org_slug is null or length(trim(p_org_slug)) < 8 then
    raise exception 'invalid_slug';
  end if;
  select id into v_org_id from public.organizations
    where lower(trim(alerts_public_slug)) = lower(trim(p_org_slug)) limit 1;
  if v_org_id is null then raise exception 'org_not_found'; end if;

  -- 2. Validate template + that it allows anonymous (or session is auth'd)
  select id, kind, allows_anonymous, definition, default_confidentiality_level
    into v_template
    from public.alert_system_templates
    where id = p_template_slug and is_active = true;
  if v_template.id is null then raise exception 'template_not_found'; end if;
  if v_template.allows_anonymous = false and auth.uid() is null then
    raise exception 'template_requires_authentication';
  end if;

  -- 3. Build allowed-key allowlist from template definition
  v_allowed_keys := array['title','description','occurred_at_text'];
  if v_template.definition ? 'publicFormFields' then
    for v_field in select * from jsonb_array_elements(v_template.definition->'publicFormFields')
    loop
      v_allowed_keys := array_append(v_allowed_keys, v_field->>'key');
    end loop;
  end if;

  -- 4. Reject payload keys not in the allowlist
  for v_payload_key in select jsonb_object_keys(p_payload) loop
    if not v_payload_key = any(v_allowed_keys) then
      raise exception 'invalid_payload_key: %', v_payload_key;
    end if;
  end loop;

  -- 5. captcha is verified upstream in the Edge Function wrapper
  -- (this RPC trusts that it's called from the wrapper in production)
  if p_captcha_token is not null and length(p_captcha_token) < 1 then null; end if;

  -- 6. Insert with whitelisted columns ONLY (never read reporter_user_id,
  --    closed_at, etc. from the payload). The before-insert trigger fills
  --    in acknowledgement_due_at, retention defaults, snapshots, kind.
  insert into public.alert_cases (
    organization_id, kind, source_kind, system_template_id,
    title, description, occurred_at_text,
    is_anonymous, reporter_user_id, reporter_contact,
    metadata,
    submission_locale
  ) values (
    v_org_id, v_template.kind, 'system', v_template.id,
    coalesce(p_payload->>'title', '(uten tittel)'),
    coalesce(p_payload->>'description', ''),
    nullif(trim(p_payload->>'occurred_at_text'), ''),
    auth.uid() is null,                              -- anonymous unless logged in
    auth.uid(),
    case
      when auth.uid() is not null then null
      else nullif(trim(p_payload->>'reporter_contact'), '')
    end,
    -- Whitelisted metadata: anything in payload that isn't a top-level column
    (
      select coalesce(jsonb_object_agg(k.key, v.value), '{}'::jsonb)
        from jsonb_each(p_payload) v
        join unnest(v_allowed_keys) k(key) on k.key = v.key
       where k.key not in ('title','description','occurred_at_text','reporter_contact')
    ),
    coalesce(p_payload->>'submission_locale','nb')
  )
  returning id, access_key into v_case_id, v_access_key;

  -- 7. Timeline event for the submission
  insert into public.alert_case_timeline_events (case_id, organization_id, event_kind, actor_kind, payload)
    values (v_case_id, v_org_id, 'submitted', 'reporter', jsonb_build_object('template_id', v_template.id));

  return jsonb_build_object(
    'caseId', v_case_id,
    'accessKey', v_access_key,
    'message', 'Varsel mottatt. Oppbevar saksnøkkelen trygt for statusoppslag.'
  );
end;
$$;

grant execute on function public.public_submit_alert(text, text, jsonb, text) to anon, authenticated;

-- ── public_alert_status — minimal status by access_key ───────────────────

create or replace function public.public_alert_status(p_access_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_public_notes jsonb;
begin
  select c.id, c.status, c.updated_at, c.acknowledgement_due_at,
         c.kind, c.acknowledged_at, c.closed_at
    into v_case
    from public.alert_cases c
    where c.access_key = p_access_key
    limit 1;

  if v_case.id is null then return jsonb_build_object('found', false); end if;

  select coalesce(jsonb_agg(jsonb_build_object('body', body, 'createdAt', created_at) order by created_at), '[]'::jsonb)
    into v_public_notes
    from public.alert_case_notes
    where case_id = v_case.id and visible_to_reporter = true;

  return jsonb_build_object(
    'found', true,
    'status', v_case.status,
    'updatedAt', v_case.updated_at,
    'acknowledgementDueAt', v_case.acknowledgement_due_at,
    'acknowledgedAt', v_case.acknowledged_at,
    'closedAt', v_case.closed_at,
    'publicNotes', v_public_notes
  );
end;
$$;

grant execute on function public.public_alert_status(uuid) to anon, authenticated;

-- ── Legacy shims (Phase F4 will drop these) ───────────────────────────────
--
-- Keep the legacy public_submit_whistleblowing + public_whistleblowing_status
-- callable so existing /varsle/:slug pages don't 500 between Phase D and
-- Phase F4. They forward to the new RPCs.

create or replace function public.public_submit_whistleblowing(
  p_org_slug text, p_category text, p_title text, p_description text,
  p_who_what_where text, p_occurred_at_text text, p_is_anonymous boolean,
  p_reporter_contact text, p_captcha_token text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_template_id text;
  v_description text;
begin
  -- Map legacy category → new system template (same mapping as Phase B1).
  v_template_id := case lower(coalesce(trim(p_category), ''))
    when 'aml'         then 'aml-varsel-generell'
    when 'corruption'  then 'aml-varsel-okonomisk-misbruk'
    when 'financial'   then 'aml-varsel-okonomisk-misbruk'
    when 'harassment'  then 'aml-varsel-trakassering'
    when 'hms'         then 'aml-varsel-hms-fare'
    when 'environment' then 'aml-varsel-miljo'
    when 'privacy'     then 'gdpr-brudd-feilsending'
    when 'ethics'      then 'etisk-bekymring'
    else                    'aml-varsel-generell'
  end;
  v_description := case when coalesce(trim(p_who_what_where), '') = ''
    then coalesce(p_description, '')
    else coalesce(p_description, '') || E'\n\n--- Hvem, hva, hvor ---\n' || p_who_what_where
  end;
  return public.public_submit_alert(
    p_org_slug, v_template_id,
    jsonb_strip_nulls(jsonb_build_object(
      'title', p_title,
      'description', v_description,
      'occurred_at_text', p_occurred_at_text,
      'reporter_contact', case when p_is_anonymous then null else p_reporter_contact end
    )),
    p_captcha_token
  );
end;
$$;

create or replace function public.public_whistleblowing_status(p_access_key uuid)
returns jsonb language sql security definer set search_path = public as $$
  select public.public_alert_status(p_access_key);
$$;

create or replace function public.public_whistleblowing_org_lookup(p_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select public.public_alert_org_lookup(p_slug);
$$;

grant execute on function public.public_submit_whistleblowing(text,text,text,text,text,text,boolean,text,text) to anon, authenticated;
grant execute on function public.public_whistleblowing_status(uuid) to anon, authenticated;
grant execute on function public.public_whistleblowing_org_lookup(text) to anon, authenticated;
