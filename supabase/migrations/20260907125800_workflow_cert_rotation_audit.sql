-- Cert-rotation audit log + RPC for Maskinporten virksomhetssertifikat swap.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: NSM Grunnprinsipper 2.4 (planlagt rotasjon
--   av nøkkelmateriale med forsvarlig sporbarhet) + IK-f § 5 nr. 7
--   (systematisk overvåking av sikkerhetstiltak) + sikkerhetsloven § 4-3
--   (forsvarlig sikkerhetstilstand for myndighets-signering). Hver
--   rotasjon må kunne reproduseres: gammel KID, ny KID, hvem og når.
--   Restrisiko deferred: cross-signing av to KIDer i overlapps-vindu —
--   krever Digdir-side koordinering og dekkes i sprint-4.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ── 1. Permission key seed ───────────────────────────────────────────────
-- The string key `integrations.cert_rotate` is registered in
-- src/lib/permissionKeys.ts with its Norwegian label. Seed it to the
-- `admin` role only — rotation is high-impact and not for daglig_leder.

insert into public.role_permissions (role_id, permission_key)
  select rd.id, 'integrations.cert_rotate'
    from public.role_definitions rd
   where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- ── 2. Audit table ───────────────────────────────────────────────────────

create table if not exists public.cert_rotation_audit_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             text not null check (kind in ('altinn','regint','datatilsynet','nav')),
  old_kid          text,
  new_kid          text,
  old_serial       text,
  new_serial       text,
  old_expires_at   timestamptz,
  new_expires_at   timestamptz,
  rotated_by       uuid references public.profiles (id),
  rotated_at       timestamptz not null default now(),
  reason           text
);

create index if not exists cert_rotation_audit_log_org_idx
  on public.cert_rotation_audit_log (organization_id, rotated_at desc);
create index if not exists cert_rotation_audit_log_kind_idx
  on public.cert_rotation_audit_log (organization_id, kind, rotated_at desc);
create index if not exists cert_rotation_audit_log_new_kid_idx
  on public.cert_rotation_audit_log (new_kid, rotated_at desc);

comment on table public.cert_rotation_audit_log is
  'Append-only forensic trail for Maskinporten virksomhetssertifikat-rotasjon. One row per workflow_record_cert_rotation call. NSM Grunnprinsipper 2.4 + IK-f § 5 nr. 7.';

-- ── 3. RLS ──────────────────────────────────────────────────────────────

alter table public.cert_rotation_audit_log enable row level security;

-- service_role writes (RPC runs as security definer, but be explicit).
drop policy if exists cert_rotation_audit_log_service_insert on public.cert_rotation_audit_log;
create policy cert_rotation_audit_log_service_insert
  on public.cert_rotation_audit_log
  for insert
  to service_role
  with check (true);

-- org admins (and anyone holding integrations.cert_rotate / gov.outbox_triage)
-- can read their org's rows. Membership gate first.
drop policy if exists cert_rotation_audit_log_org_select on public.cert_rotation_audit_log;
create policy cert_rotation_audit_log_org_select
  on public.cert_rotation_audit_log
  for select
  using (
    organization_id = public.current_org_id()
    and (
      public.user_has_permission('integrations.cert_rotate')
      or public.user_has_permission('gov.outbox_triage')
      or public.user_has_permission('module.view.admin')
    )
  );

-- ── 4. Append-only triggers ──────────────────────────────────────────────

create or replace function public.trg_cert_rotation_audit_log_deny_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cert_rotation_audit_log is append-only; update denied for row %', old.id;
end;
$$;

drop trigger if exists cert_rotation_audit_log_deny_update on public.cert_rotation_audit_log;
create trigger cert_rotation_audit_log_deny_update
  before update on public.cert_rotation_audit_log
  for each row execute function public.trg_cert_rotation_audit_log_deny_update();

create or replace function public.trg_cert_rotation_audit_log_deny_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cert_rotation_audit_log is append-only; delete denied for row %', old.id;
end;
$$;

drop trigger if exists cert_rotation_audit_log_deny_delete on public.cert_rotation_audit_log;
create trigger cert_rotation_audit_log_deny_delete
  before delete on public.cert_rotation_audit_log
  for each row execute function public.trg_cert_rotation_audit_log_deny_delete();

grant select on public.cert_rotation_audit_log to authenticated;
grant insert, select on public.cert_rotation_audit_log to service_role;

-- ── 5. Rotation RPC ──────────────────────────────────────────────────────
-- The browser wizard:
--   1. Calls workflow_set_vault_secret (existing) to push the new PEM.
--   2. Calls workflow_record_cert_rotation (this) to atomically update
--      org_integrations + emit the audit row + dispatch the event.

create or replace function public.workflow_record_cert_rotation(
  p_org_id          uuid,
  p_kind            text,
  p_old_kid         text,
  p_new_kid         text,
  p_new_serial      text,
  p_new_expires_at  timestamptz,
  p_reason          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_audit_id     uuid;
  v_caller_org   uuid;
  v_old_serial   text;
  v_old_expires  timestamptz;
  v_old_kid_db   text;
  v_payload      jsonb;
begin
  if not public.user_has_permission('integrations.cert_rotate') then
    raise exception 'workflow_record_cert_rotation: integrations.cert_rotate permission required';
  end if;

  select organization_id into v_caller_org
    from public.profiles
   where id = auth.uid();
  if v_caller_org is distinct from p_org_id and not public.platform_is_admin() then
    raise exception 'cross-org cert-rotation denied';
  end if;

  if p_kind not in ('altinn','regint','datatilsynet','nav') then
    raise exception 'invalid kind %', p_kind;
  end if;

  -- Snapshot the existing fields BEFORE updating so the audit row records
  -- the actual previous state, not the post-update state.
  select signing_kid, signing_cert_serial, signing_cert_expires_at
    into v_old_kid_db, v_old_serial, v_old_expires
    from public.org_integrations
   where organization_id = p_org_id and kind = p_kind
   for update;

  -- Caller hands us the KID it observed pre-rotation. Use the DB value if
  -- caller passed null (idempotent retry case).
  if p_old_kid is null then
    p_old_kid := v_old_kid_db;
  end if;

  insert into public.cert_rotation_audit_log (
    organization_id, kind,
    old_kid, new_kid, old_serial, new_serial,
    old_expires_at, new_expires_at,
    rotated_by, reason
  ) values (
    p_org_id, p_kind,
    p_old_kid, p_new_kid, v_old_serial, p_new_serial,
    v_old_expires, p_new_expires_at,
    auth.uid(), p_reason
  )
  returning id into v_audit_id;

  update public.org_integrations
     set signing_kid             = p_new_kid,
         signing_cert_serial     = p_new_serial,
         signing_cert_expires_at = p_new_expires_at,
         signing_cert_warned_at  = null,
         updated_at              = now()
   where organization_id = p_org_id and kind = p_kind;

  v_payload := jsonb_build_object(
    'organization_id',  p_org_id,
    'integration_kind', p_kind,
    'old_kid',          p_old_kid,
    'new_kid',          p_new_kid,
    'old_serial',       v_old_serial,
    'new_serial',       p_new_serial,
    'old_expires_at',   v_old_expires,
    'new_expires_at',   p_new_expires_at,
    'rotated_by',       auth.uid(),
    'reason',           p_reason,
    'audit_id',         v_audit_id
  );

  begin
    perform public.workflow_dispatch_db_event(
      p_org_id, 'gov', 'ON_CERT_ROTATED', v_payload
    );
  exception when others then
    insert into public.workflow_runs (
      organization_id, rule_id, source_module, event, status, detail
    ) values (
      p_org_id, null, 'gov', 'ON_CERT_ROTATED',
      'failed',
      jsonb_build_object('integration_kind', p_kind, 'error', sqlerrm,
                         'audit_id', v_audit_id)
    );
  end;

  return v_audit_id;
end;
$$;

revoke all on function public.workflow_record_cert_rotation(uuid, text, text, text, text, timestamptz, text) from public;
grant execute on function public.workflow_record_cert_rotation(uuid, text, text, text, text, timestamptz, text) to authenticated;

comment on function public.workflow_record_cert_rotation(uuid, text, text, text, text, timestamptz, text) is
  'Atomically records a virksomhetssertifikat-rotasjon. Looks up the previous cert fields from org_integrations, inserts a cert_rotation_audit_log row, updates org_integrations (new kid/serial/expires + reset warned_at), and dispatches ON_CERT_ROTATED via workflow_dispatch_db_event. Caller must hold integrations.cert_rotate.';

-- ── 6. System rule — ON_CERT_EXPIRY_NEAR reminder ────────────────────────
-- The _123700 trigger already emits cert_expiry_near (lower-case) when a
-- cert moves inside the 30-day window. Add a non-optional system rule that
-- responds by creating a task for daglig_leder + a notification to admin.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  description, rationale, source_module, trigger_type, trigger_event_name,
  schedule_cron, trigger_on, condition_json, actions_json, law_refs,
  frameworks, pdca_phase, applies_if_employee_count_gte, enabled, notes
) values (
  'integrations-cert-expiry-30d-warn',
  'NSM', 'NSM Grunnprinsipper — 2 Beskytte', 2,
  'NSM 2.4 — Planlagt rotasjon av nøkkelmateriale (30 d varsel)',
  'Virksomhetssertifikat innen 30 dager fra utløp → opprett oppgave for daglig leder og varsle admin om at rotasjon må planlegges.',
  'NSM Grunnprinsipper 2.4 og IK-f § 5 nr. 7 krever at sikkerhetstiltak (her: signeringsnøkkel mot myndighetsregistre) overvåkes systematisk. Uten denne regelen kan en cert utløpe og blokkere all Maskinporten-trafikk uten at noen har handlet i tide.',
  'gov', 'db_event', 'cert_expiry_near', null, 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Roter virksomhetssertifikat (utløper snart)","description":"NSM 2.4 — virksomhetssertifikatet for {{event.integration_kind}} utløper {{event.cert_expires_at}}. Start rotasjon under Admin > Integrasjoner > Sertifikat-rotasjon.","ownerRole":"daglig_leder","dueInDays":14,"module":"gov","sourceType":"cert_rotation"},
    {"type":"send_notification","audience":"role:admin","title":"Virksomhetssertifikat utløper snart","body":"{{event.integration_kind}}: utløper {{event.cert_expires_at}} ({{event.days_until_expiry}} dager). Roter under Admin > Integrasjoner > Sertifikat-rotasjon."}
  ]'::jsonb,
  ARRAY['NSM Grunnprinsipp 2.4', 'IK-forskriften § 5 nr. 7'],
  ARRAY['aml-amu','iso-45001'],
  'check', null, true,
  'Driver UI-banner under Admin > Integrasjoner via signing_cert_expires_at-kolonnen.'
)
on conflict (slug) do update set
  description    = excluded.description,
  rationale      = excluded.rationale,
  actions_json   = excluded.actions_json,
  law_refs       = excluded.law_refs,
  frameworks     = excluded.frameworks,
  pdca_phase     = excluded.pdca_phase,
  enabled        = excluded.enabled,
  notes          = excluded.notes,
  updated_at     = now();
