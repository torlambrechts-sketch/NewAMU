-- Extend org_integrations.kind with the regulator providers the workflow
-- gov-actions need.
--
-- archive/_20260902120300_integrasjoner_bankid_restanser.sql already
-- ships the table + RLS + bankid_signatures pattern. We piggy-back so
-- there is exactly one place to manage credentials per org (CLAUDE.md
-- reuse rule), and Vault secrets pattern from
-- specs/integrasjoner-bankid-restanser.md applies as-is.
--
-- Added kinds:
--   regint        — Arbeidstilsynet Register for Inntekt (alvorlig
--                   skade-melding, AML § 5-2). Auth: Maskinporten JWT
--                   bearer-grant signed with virksomhetssertifikat.
--   datatilsynet  — GDPR Art. 33 personvernbrudd-skjema. Currently a
--                   structured-email integration; designed to swap
--                   transport when Datatilsynet's API lands.
--   nav           — NAV sykefraværsoppfølging via Altinn DSOP. Generic
--                   altinn envelope underneath.
--
-- (altinn already in the enum; ldo deliberately omitted — there is no
-- API, the workflow generates an evidence pack for manual submission.)
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 5-2 (24h melding), GDPR Art. 33 (72h),
--   AML § 4-6 (sykefraværsoppfølging).
--   Restrisiko deferred: signering med virksomhetssertifikat krever
--   Vault-utvidelse — Phase E sprint-2 leverer setup-wizard og
--   nøkkelrullering. Inntil da kan kun service-role lagre TT02-
--   sandbox-konfig.

alter table public.org_integrations
  drop constraint if exists org_integrations_kind_check;

alter table public.org_integrations
  add constraint org_integrations_kind_check
  check (kind in (
    'bankid',
    'eco_online',
    'altinn',
    'lovdata_pro',
    'feide',
    'regint',          -- Arbeidstilsynet Register for Inntekt
    'datatilsynet',    -- Datatilsynet personvernbrudd-skjema
    'nav'              -- NAV sykefraværsoppfølging via Altinn DSOP
  ));

-- Add health-check tracking columns specific to the regulator providers.
-- These let the integrations setup wizard show "TT02 sandbox tested
-- successfully" before flipping enabled=true for prod.
alter table public.org_integrations
  add column if not exists environment text default 'tt02'
    check (environment in ('tt02','prod')),
  add column if not exists last_submission_at timestamptz,
  add column if not exists last_submission_status text
    check (last_submission_status in ('ok','failed', null)),
  add column if not exists requires_external_activation boolean not null default false;

comment on column public.org_integrations.environment is
  'TT02 = Altinn sandbox / Arbeidstilsynet test; prod = live regulatory submissions. Wizard flips to prod only after a successful TT02 dry-run.';
comment on column public.org_integrations.requires_external_activation is
  'TRUE for gov integrations (regint/datatilsynet/nav/altinn). UI surfaces this so admins know workflows.activate_external is required to use rules that target the integration.';

-- Backfill requires_external_activation for existing gov-kind rows.
update public.org_integrations
   set requires_external_activation = true
 where kind in ('altinn','regint','datatilsynet','nav');
