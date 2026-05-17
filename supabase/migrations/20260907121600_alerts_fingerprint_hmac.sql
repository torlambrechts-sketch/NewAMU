-- Fix-up: alerts_text_fingerprint used plain sha256 — a global rainbow-
-- table attacker who has seen any standard whistleblower wording (or
-- guesses common phrases) can reconstruct the fingerprint and confirm
-- whether a specific text appears in a specific org's alert_cases.
-- Switch to HMAC-SHA256 keyed per-org so equal-text-different-org
-- fingerprints are unlinkable.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 femte ledd (taushetsplikt om
--   varsel — fingerprint må ikke kunne rekonstrueres ut fra antatt
--   tekst), GDPR Art. 32 (passende sikkerhetstiltak — keying gjør
--   tamper-deteksjon mulig uten å miste taushetsplikt), GDPR Art. 25
--   (innebygd personvern).
--   Restrisiko deferred: nøkkel-rotasjon krever en re-hash av historiske
--   fingerprints — dette er ikke automatisert. En fremtidig migrasjon
--   kan introdusere key_version + lazy re-fingerprint. Nøkler er lagret
--   i en separat tabell med RLS = service_role only.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ---------------------------------------------------------------------------
-- 1. Per-org fingerprint key table. Random 32-byte key per org generated on
--    first use. Service-role only — neither org admins nor end users may
--    ever read the keys (otherwise the HMAC reduces back to sha256).
-- ---------------------------------------------------------------------------
create table if not exists public.org_alerts_fingerprint_keys (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  key             bytea not null,
  created_at      timestamptz not null default now()
);

alter table public.org_alerts_fingerprint_keys enable row level security;

-- Deny everything to authenticated roles. Service role bypasses RLS so
-- the security-definer functions below can read the keys.
drop policy if exists "org_alerts_fingerprint_keys_no_access" on public.org_alerts_fingerprint_keys;
create policy "org_alerts_fingerprint_keys_no_access"
  on public.org_alerts_fingerprint_keys for all
  using (false) with check (false);

comment on table public.org_alerts_fingerprint_keys is
  'Per-org HMAC key for alerts_text_fingerprint. Random 32-byte secret. RLS denies all access to non-service roles so the HMAC remains keyed against everyone except the platform itself.';

-- Seed a key for every existing org. Idempotent: orgs that already have
-- one are skipped.
insert into public.org_alerts_fingerprint_keys (organization_id, key)
select o.id, public.gen_random_bytes(32)
  from public.organizations o
 where not exists (
   select 1 from public.org_alerts_fingerprint_keys k
    where k.organization_id = o.id
 );

-- New orgs need a key too — install a trigger that mints one on insert.
create or replace function public.trg_org_alerts_fingerprint_key_install()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_alerts_fingerprint_keys (organization_id, key)
  values (new.id, public.gen_random_bytes(32))
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_alerts_fingerprint_key_install_tg on public.organizations;
create trigger organizations_alerts_fingerprint_key_install_tg
  after insert on public.organizations
  for each row execute function public.trg_org_alerts_fingerprint_key_install();

-- ---------------------------------------------------------------------------
-- 2. New fingerprint signature: takes (org_id, text). Computes HMAC-SHA256
--    with the per-org key. Drop the legacy single-arg signature so callers
--    are forced to pass the org id.
-- ---------------------------------------------------------------------------
drop function if exists public.alerts_text_fingerprint(text);

create or replace function public.alerts_text_fingerprint(
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
    raise exception 'alerts_text_fingerprint: organization_id is required';
  end if;

  select key into v_key
    from public.org_alerts_fingerprint_keys
   where organization_id = p_org_id;

  if v_key is null then
    -- Defensive: orgs created before this migration without the new
    -- trigger would have no key. Mint one inline so the call site does
    -- not see a NULL fingerprint (which downstream rules might
    -- misinterpret).
    insert into public.org_alerts_fingerprint_keys (organization_id, key)
    values (p_org_id, public.gen_random_bytes(32))
    on conflict (organization_id) do update
       set key = excluded.key
       where org_alerts_fingerprint_keys.key is null
    returning key into v_key;

    if v_key is null then
      select key into v_key
        from public.org_alerts_fingerprint_keys
       where organization_id = p_org_id;
    end if;
  end if;

  return encode(public.hmac(p_text::bytea, v_key, 'sha256'), 'hex');
end;
$$;

revoke all on function public.alerts_text_fingerprint(uuid, text) from public;
grant execute on function public.alerts_text_fingerprint(uuid, text) to service_role;

comment on function public.alerts_text_fingerprint(uuid, text) is
  'HMAC-SHA256 of varsel-fritekst keyed per org. Replaces the rainbow-table-vulnerable plain sha256 in _120400. Lets downstream rules detect tampering without ever seeing the body (AML § 2A-7 / GDPR Art. 32 need-to-know).';

-- ---------------------------------------------------------------------------
-- 3. Re-issue the alert_cases insert trigger so its calls to
--    alerts_text_fingerprint pass new.organization_id. Body otherwise
--    identical to _120400 lines 289-365. Guarded by to_regclass — the
--    alerts module-core may not have applied yet (this migration sorts
--    before _20260911120000_alerts_module_core).
-- ---------------------------------------------------------------------------
do $migrate$
begin
  if to_regclass('public.alert_cases') is null then
    raise notice 'alert_cases not present yet — skipping trigger rebind (will pick up the new fingerprint signature once _20260911120100_alerts_workflow_triggers_install runs)';
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
        'description_sha256', public.alerts_text_fingerprint(new.organization_id, new.description),
        'title_sha256',       public.alerts_text_fingerprint(new.organization_id, new.title),
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

do $$
begin
  raise notice 'alerts_text_fingerprint switched to per-org HMAC; legacy single-arg signature dropped.';
end
$$;
