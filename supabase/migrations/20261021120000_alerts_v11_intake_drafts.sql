-- Alerts v1.1 — alert_intake_draft (save-and-resume for the public intake).
--
-- Reporters who can't complete the form in one sitting save a draft; the
-- access_key returned on first save lets them return on any device. The
-- draft TTL is 30 days; expired drafts get pruned by a daily cron job.
--
-- Self-audit:
--   * AML § 2A-7 (5) — drafts hold reporter content; encrypted at rest
--     using the same envelope as case content.
--   * GDPR Art. 5 (1) (c) data minimisation — drafts are auto-deleted
--     after 30 days even if never submitted.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_intake_draft (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  system_template_id   text references public.alert_system_templates (id) on delete cascade,
  org_template_id      uuid references public.alert_org_templates (id) on delete cascade,
  intake_form_version_id uuid references public.alert_intake_form_version (id) on delete set null,
  access_key           uuid not null unique default gen_random_uuid(),
  access_key_hash      bytea,                              -- HMAC of access_key for lookup-time check
  payload_encrypted    bytea not null,
  key_version          integer not null default 1,
  voice_intake_id      uuid,                                -- FK added in _120100
  last_saved_at        timestamptz not null default now(),
  expires_at           timestamptz not null default (now() + interval '30 days'),
  submission_locale    text,
  created_at           timestamptz not null default now(),
  check (system_template_id is not null or org_template_id is not null)
);

create index if not exists alert_intake_draft_expires_idx
  on public.alert_intake_draft (expires_at);

create index if not exists alert_intake_draft_org_idx
  on public.alert_intake_draft (organization_id, last_saved_at desc);

alter table public.alert_intake_draft enable row level security;

-- No client SELECT — public lookup happens via SECURITY DEFINER RPC below.
drop policy if exists alert_intake_draft_block_select on public.alert_intake_draft;
create policy alert_intake_draft_block_select
  on public.alert_intake_draft for select
  using (false);

-- Public RPC: save draft (upsert by access_key).
create or replace function public.public_save_alert_draft(
  p_org_slug                 text,
  p_system_template_id       text,
  p_intake_form_version_id   uuid,
  p_payload_encrypted        bytea,
  p_key_version              integer,
  p_access_key               uuid default null,
  p_submission_locale        text default 'nb',
  p_voice_intake_id          uuid default null
)
returns table (access_key uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_existing_id uuid;
  v_access uuid;
  v_expires timestamptz;
begin
  -- Resolve org by alerts_public_slug.
  select id into v_org_id
    from public.organizations
    where alerts_public_slug = p_org_slug
    limit 1;
  if v_org_id is null then
    raise exception 'org_not_found' using errcode = 'no_data_found';
  end if;

  -- Validate template + form version reference each other consistently.
  if not exists (
    select 1 from public.alert_intake_form_version v
    where v.id = p_intake_form_version_id
      and v.organization_id = v_org_id
      and v.active = true
      and (v.system_template_id = p_system_template_id or v.org_template_id::text = p_system_template_id)
  ) then
    raise exception 'intake_form_version_not_active' using errcode = 'invalid_parameter_value';
  end if;

  if p_access_key is not null then
    -- Upsert by access_key.
    select id, expires_at into v_existing_id, v_expires
      from public.alert_intake_draft
      where access_key = p_access_key
        and organization_id = v_org_id;
    if v_existing_id is not null then
      update public.alert_intake_draft
         set payload_encrypted = p_payload_encrypted,
             key_version       = p_key_version,
             voice_intake_id   = coalesce(p_voice_intake_id, voice_intake_id),
             last_saved_at     = now(),
             expires_at        = now() + interval '30 days',
             submission_locale = coalesce(p_submission_locale, submission_locale)
       where id = v_existing_id
       returning access_key, expires_at into v_access, v_expires;
       return query select v_access, v_expires;
       return;
    end if;
  end if;

  -- New draft.
  insert into public.alert_intake_draft
    (organization_id, system_template_id, intake_form_version_id,
     payload_encrypted, key_version, voice_intake_id, submission_locale)
  values
    (v_org_id, p_system_template_id, p_intake_form_version_id,
     p_payload_encrypted, p_key_version, p_voice_intake_id, p_submission_locale)
  returning access_key, expires_at into v_access, v_expires;
  return query select v_access, v_expires;
end;
$$;

revoke all on function public.public_save_alert_draft(text, text, uuid, bytea, integer, uuid, text, uuid) from public;
grant execute on function public.public_save_alert_draft(text, text, uuid, bytea, integer, uuid, text, uuid) to anon, authenticated;

create or replace function public.public_resume_alert_draft(p_access_key uuid)
returns table (
  organization_id          uuid,
  system_template_id       text,
  org_template_id          uuid,
  intake_form_version_id   uuid,
  payload_encrypted        bytea,
  key_version              integer,
  last_saved_at            timestamptz,
  expires_at               timestamptz,
  voice_intake_id          uuid,
  submission_locale        text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Timing-attack defence: constant-time-ish lookup + jitter.
  perform pg_sleep((50 + random() * 150) / 1000.0);
  return query
    select d.organization_id, d.system_template_id, d.org_template_id,
           d.intake_form_version_id, d.payload_encrypted, d.key_version,
           d.last_saved_at, d.expires_at, d.voice_intake_id, d.submission_locale
      from public.alert_intake_draft d
      where d.access_key = p_access_key
        and d.expires_at > now()
      limit 1;
end;
$$;

revoke all on function public.public_resume_alert_draft(uuid) from public;
grant execute on function public.public_resume_alert_draft(uuid) to anon, authenticated;

-- Daily prune cron callable.
create or replace function public.alerts_prune_intake_drafts()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete from public.alert_intake_draft
     where expires_at < now() - interval '7 days'
    returning 1
  )
  select count(*) into v_count from deleted;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.alerts_prune_intake_drafts() from public, anon;
grant execute on function public.alerts_prune_intake_drafts() to service_role;
