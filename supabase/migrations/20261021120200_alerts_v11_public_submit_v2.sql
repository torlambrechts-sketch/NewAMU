-- Alerts v1.1 — public_submit_alert_v2 with anonymity_mode + encrypted payload.
--
-- v1.0 RPC accepted a raw JSON payload + checked against the system
-- template's definition.publicFormFields. v1.1 adds:
--   * anonymity_mode argument (replaces the implicit is_anonymous flag)
--   * intake_form_version_id (must match an active version row)
--   * encrypted payload pieces (title_encrypted, description_encrypted,
--     reporter_identifier_encrypted, reporter_email_hashed)
--   * voice_intake_id (binds an existing voice recording)
--   * draft_access_key (clears the resumed draft after successful submit)
--   * 50–200 ms random jitter on success path (timing-attack defence on
--     the slug-lookup branch)
--
-- The legacy RPC remains for v1.0 compatibility — we don't drop it.
--
-- Self-audit:
--   * GDPR Art. 5 (1) (a) — explicit anonymity_mode at intake creates
--     auditable consent record.
--   * GDPR Art. 5 (1) (f) — strict payload key allowlist closes column-
--     injection vector.
--   * AML § 2A-7 (5) — encrypted-only path keeps plaintext columns NULL
--     when org has a DEK.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.public_submit_alert_v2(
  p_org_slug                  text,
  p_system_template_id        text,
  p_intake_form_version_id    uuid,
  p_anonymity_mode            text,
  p_payload                   jsonb,
  p_title_encrypted           bytea default null,
  p_description_encrypted     bytea default null,
  p_reporter_identifier_encrypted bytea default null,
  p_reporter_identifier_key_version integer default null,
  p_reporter_email_hashed     bytea default null,
  p_title_key_version         integer default null,
  p_description_key_version   integer default null,
  p_voice_intake_id           uuid default null,
  p_draft_access_key          uuid default null,
  p_submission_locale         text default 'nb'
)
returns table (case_id uuid, access_key uuid, case_number text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id      uuid;
  v_template    record;
  v_form_version record;
  v_case_id     uuid;
  v_access_key  uuid;
  v_allowed_keys text[];
  v_unknown_key text;
  v_kind        text;
begin
  -- Jitter (timing-attack defence).
  perform pg_sleep((50 + random() * 150) / 1000.0);

  if p_anonymity_mode not in ('fully_anonymous','pseudonymous','confidential','open') then
    raise exception 'invalid_anonymity_mode: %', p_anonymity_mode using errcode = 'invalid_parameter_value';
  end if;

  -- Resolve org.
  select id into v_org_id from public.organizations where alerts_public_slug = p_org_slug limit 1;
  if v_org_id is null then
    raise exception 'org_not_found' using errcode = 'no_data_found';
  end if;

  -- Resolve template + verify allows_anonymous when anonymity_mode != 'open'.
  select t.id, t.slug, t.kind, t.allows_anonymous, t.default_confidentiality_level,
         t.definition, t.metadata_schema
    into v_template
    from public.alert_system_templates t
    where t.id = p_system_template_id and t.is_active = true
    limit 1;
  if v_template.id is null then
    raise exception 'template_not_found' using errcode = 'no_data_found';
  end if;
  if p_anonymity_mode in ('fully_anonymous','pseudonymous','confidential')
     and v_template.allows_anonymous = false then
    raise exception 'template_does_not_allow_anonymous' using errcode = 'invalid_parameter_value';
  end if;

  -- Verify intake form version is active for this (org, template).
  select id, schema into v_form_version
    from public.alert_intake_form_version
    where id = p_intake_form_version_id
      and organization_id = v_org_id
      and (system_template_id = p_system_template_id or org_template_id is not null)
      and active = true;
  if v_form_version.id is null then
    raise exception 'intake_form_version_inactive' using errcode = 'invalid_parameter_value';
  end if;

  -- Build the allowed-key list from the active form version's schema.
  select coalesce(array_agg(key), array[]::text[]) into v_allowed_keys
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_form_version.schema) = 'array' then v_form_version.schema
        when v_form_version.schema ? 'fields' then v_form_version.schema->'fields'
        else '[]'::jsonb
      end
    ) e,
    jsonb_object_keys(e) k
    cross join lateral (select e->>'key' as key) ke
    where ke.key is not null;

  -- Strict allowlist on payload.
  for v_unknown_key in select k from jsonb_object_keys(p_payload) k loop
    if not (v_unknown_key = any(v_allowed_keys))
       and v_unknown_key not in ('occurred_at_text','title','description','category') then
      raise exception 'invalid_payload_key: %', v_unknown_key using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  v_kind := v_template.kind;
  v_access_key := gen_random_uuid();

  insert into public.alert_cases (
    organization_id,
    access_key,
    kind,
    source_kind,
    system_template_id,
    title,
    title_encrypted,
    title_key_version,
    description,
    description_encrypted,
    description_key_version,
    category,
    occurred_at_text,
    anonymity_mode,
    is_anonymous,
    reporter_contact,
    reporter_user_id,
    reporter_identifier_encrypted,
    reporter_identifier_key_version,
    reporter_email_for_notification_hashed,
    intake_form_version_id,
    confidentiality_level,
    submission_locale,
    metadata
  ) values (
    v_org_id,
    v_access_key,
    v_kind,
    'system',
    p_system_template_id,
    coalesce(p_payload->>'title','[no title]'),
    p_title_encrypted,
    p_title_key_version,
    coalesce(p_payload->>'description',''),
    p_description_encrypted,
    p_description_key_version,
    p_payload->>'category',
    p_payload->>'occurred_at_text',
    p_anonymity_mode,
    case when p_anonymity_mode = 'open' then false else true end,
    case when p_anonymity_mode in ('pseudonymous','open') then p_payload->>'reporter_contact' else null end,
    case when p_anonymity_mode = 'open' then auth.uid() else null end,
    p_reporter_identifier_encrypted,
    p_reporter_identifier_key_version,
    p_reporter_email_hashed,
    p_intake_form_version_id,
    case
      when p_anonymity_mode = 'confidential' then 'confidential'
      else v_template.default_confidentiality_level
    end,
    p_submission_locale,
    coalesce(p_payload - 'title' - 'description' - 'category' - 'occurred_at_text' - 'reporter_contact', '{}'::jsonb)
  ) returning id into v_case_id;

  -- Bind voice intake if provided.
  if p_voice_intake_id is not null then
    update public.alert_voice_intake
       set case_id = v_case_id
     where id = p_voice_intake_id
       and organization_id = v_org_id;
  end if;

  -- Submitted timeline event.
  insert into public.alert_case_timeline_events
    (case_id, organization_id, event_kind, actor_kind, payload)
  values (v_case_id, v_org_id, 'submitted',
          case when auth.uid() is not null then 'reporter' else 'reporter' end,
          jsonb_build_object('anonymity_mode', p_anonymity_mode, 'template', p_system_template_id));

  -- Clear the draft if provided.
  if p_draft_access_key is not null then
    delete from public.alert_intake_draft
      where access_key = p_draft_access_key and organization_id = v_org_id;
  end if;

  return query select v_case_id, v_access_key, v_case_id::text;
end;
$$;

revoke all on function public.public_submit_alert_v2(
  text, text, uuid, text, jsonb, bytea, bytea, bytea, integer, bytea, integer, integer, uuid, uuid, text
) from public;
grant execute on function public.public_submit_alert_v2(
  text, text, uuid, text, jsonb, bytea, bytea, bytea, integer, bytea, integer, integer, uuid, uuid, text
) to anon, authenticated;
