-- Phase E sprint-3 preface: per-org signing-adapter config + cert metadata.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: NSM Grunnprinsipper 2.4 (nøkkelmateriale i
--   HSM-klassifisert lagring, aldri i prosess­minne) + sikkerhetsloven
--   §4-3 (forsvarlig sikkerhetstilstand for tjenester som signerer
--   mot myndighets­registre). Vi flytter Maskinporten-signering bak
--   et Signer-grensesnitt; denne migrasjonen åpner for at en org kan
--   peke til en HSM-leverandør per integrasjon.
--   Restrisiko deferred: faktiske HSM-leverandør-adaptere (AWS CloudHSM
--   / Azure Key Vault HSM / Buypass HSM) krever signerte
--   leverandør­kontrakter — koden støtter dem, ingen org kan velge dem
--   uten at platform_admin har provisjonert handle først.

set local search_path = public, pg_catalog;

-- ── 1. Per-org adapter override + cert metadata ──────────────────────────

alter table public.org_integrations
  add column if not exists signing_adapter         text,
  add column if not exists signing_kid             text,
  add column if not exists signing_cert_serial     text,
  add column if not exists signing_cert_expires_at timestamptz,
  add column if not exists signing_cert_warned_at  timestamptz;

-- Default the adapter to vault_pem for any existing row that lacks one.
update public.org_integrations
   set signing_adapter = 'vault_pem'
 where signing_adapter is null;

alter table public.org_integrations
  alter column signing_adapter set default 'vault_pem';

-- Enforce the enumerated set. Drop the constraint first so the migration
-- is rerunnable in dev where someone may have widened it.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'org_integrations_signing_adapter_chk'
       and conrelid = 'public.org_integrations'::regclass
  ) then
    execute 'alter table public.org_integrations drop constraint org_integrations_signing_adapter_chk';
  end if;
end$$;

alter table public.org_integrations
  add constraint org_integrations_signing_adapter_chk
  check (signing_adapter is null or signing_adapter in (
    'vault_pem',
    'hsm_stub',
    'aws_cloudhsm',
    'azure_keyvault_hsm',
    'buypass_hsm'
  ));

comment on column public.org_integrations.signing_adapter is
  'Per-org override of the platform-wide GOV_SIGNING_ADAPTER env var. Routes Maskinporten JWT signing to a specific adapter (vault_pem today; HSM adapters after Phase E sprint-3).';
comment on column public.org_integrations.signing_kid is
  'Cert KID for the active virksomhetssertifikat. Populated by the setup wizard or the cert-rotation job; surfaced to the JWT header.';
comment on column public.org_integrations.signing_cert_serial is
  'X.509 serial of the active cert — recorded on every sign in workflow_signing_audit_log so rotations are forensically reconstructable.';
comment on column public.org_integrations.signing_cert_expires_at is
  'notAfter of the active cert. The cert-expiry trigger emits ON_CERT_EXPIRY_NEAR when this passes within 30 days.';
comment on column public.org_integrations.signing_cert_warned_at is
  'Debounce stamp — the cert-expiry trigger sets this so the warning event only fires once per cert.';

-- ── 2. Cert-expiry trigger ───────────────────────────────────────────────
--
-- Fires on insert/update of org_integrations. When the cert's notAfter is
-- inside the 30-day window AND we haven't warned for this cert before
-- (signing_cert_warned_at is null OR refers to an older expiry), emit a
-- generic gov event so the workflow engine can surface a warning task
-- to admins. Idempotent: re-running the trigger with the same expiry
-- does not re-emit.

create or replace function public.trg_org_integrations_cert_expiry_warn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_payload jsonb;
begin
  if new.signing_cert_expires_at is null then
    return new;
  end if;

  -- Already warned for this cert (debounce). Reset the debounce when the
  -- expiry actually moves forward (i.e. a new cert was provisioned).
  if new.signing_cert_warned_at is not null
     and (tg_op = 'INSERT'
          or old.signing_cert_expires_at is not distinct from new.signing_cert_expires_at)
  then
    return new;
  end if;

  if new.signing_cert_expires_at < now() + interval '30 days' then
    v_payload := jsonb_build_object(
      'organization_id',       new.organization_id,
      'integration_kind',      new.kind,
      'signing_adapter',       coalesce(new.signing_adapter, 'vault_pem'),
      'signing_kid',           new.signing_kid,
      'cert_serial',           new.signing_cert_serial,
      'cert_expires_at',       new.signing_cert_expires_at,
      'days_until_expiry',     extract(day from (new.signing_cert_expires_at - now()))::int
    );

    begin
      perform public.workflow_dispatch_db_event(
        new.organization_id,
        'gov',
        'cert_expiry_near',
        v_payload
      );
      new.signing_cert_warned_at := now();
    exception when others then
      -- Failure to fan out is non-fatal — log to workflow_runs so the
      -- platform can see the orphan.
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, null, 'gov', 'cert_expiry_near',
        'failed',
        jsonb_build_object('integration_kind', new.kind, 'error', sqlerrm)
      );
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists org_integrations_cert_expiry_warn on public.org_integrations;
create trigger org_integrations_cert_expiry_warn
  before insert or update of signing_cert_expires_at, signing_cert_serial
  on public.org_integrations
  for each row execute function public.trg_org_integrations_cert_expiry_warn();

comment on function public.trg_org_integrations_cert_expiry_warn() is
  'Fires when org_integrations.signing_cert_expires_at falls inside the 30-day window. Emits gov.cert_expiry_near via workflow_dispatch_db_event so admins get a warning task. Debounced via signing_cert_warned_at.';
