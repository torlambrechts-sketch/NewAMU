-- Integrasjoner + BankID + restanser fra dokument-leveransen
--
-- Coverage:
--   1. org_integrations — per-org integrasjons­konfigurasjon (BankID,
--      Eco-Online stoff­kartotek, ev. fremtidige).
--   2. bankid_signatures — register over BankID-signaturer på dokumenter.
--   3. Lukker dokument-restanse: koblet til to nye templates som
--      legges til via TS (tpl-lonnskartlegging, tpl-apenhetsloven-
--      redegjorelse).
--
-- Self-audit (sikkerhet + personvern):
--   * org_integrations.config (jsonb) inneholder klient-ID, callback-URL
--     og miljø — IKKE klient-hemmeligheter i denne tabellen. Hemmeligheter
--     skal lagres i Supabase Vault eller Edge Function secrets (TODO
--     markert i admin UI).
--   * bankid_signatures lagrer hash av fødselsnummer (sha256), aldri
--     fødselsnummer i klartekst. OIDC sub fra BankID brukes som stabil
--     identifikator.
--   * RLS: bare org-medlemmer kan se signaturer for egne dokumenter;
--     admin-rolle kreves for å konfigurere integrasjoner.

set local search_path = public, pg_catalog;

-- ── 1. org_integrations ──────────────────────────────────────────────────

create table if not exists public.org_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in (
    'bankid',          -- BankID OIDC for dokument­signering
    'eco_online',      -- Eco-Online stoff­kartotek
    'altinn',          -- Altinn-innsending (fremtidig)
    'lovdata_pro',     -- Lovdata Pro-oppslag (fremtidig)
    'feide'            -- Feide ID for utdannings­sektor (fremtidig)
  )),
  enabled boolean not null default false,
  -- Klient-ID, callback-URL, miljø (test/prod). Ingen hemmeligheter her.
  config jsonb not null default '{}'::jsonb,
  -- For UI-visning av siste tilkoblings­status (sjekkes via edge function)
  last_health_check_at timestamptz,
  last_health_status text check (last_health_status in ('ok', 'degraded', 'down', null)),
  last_health_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind)
);

create index if not exists org_integrations_org_idx
  on public.org_integrations (organization_id, enabled);

comment on table public.org_integrations is
  'Per-org integration configuration. Public fields only — secrets live in Vault.';
comment on column public.org_integrations.config is
  'Public config: {client_id, callback_url, environment (test|prod), display_name}. NEVER store client_secret or private keys here.';

drop trigger if exists org_integrations_set_updated_at on public.org_integrations;
create trigger org_integrations_set_updated_at
  before update on public.org_integrations
  for each row execute function public.set_updated_at();

alter table public.org_integrations enable row level security;

-- Kun org-medlemmer kan lese; admin-rolle kreves for endring
drop policy if exists org_integrations_select on public.org_integrations;
create policy org_integrations_select on public.org_integrations
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.organization_id = org_integrations.organization_id)
  );

drop policy if exists org_integrations_modify on public.org_integrations;
create policy org_integrations_modify on public.org_integrations
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.organization_id = org_integrations.organization_id
              and p.is_org_admin = true)
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.organization_id = org_integrations.organization_id
              and p.is_org_admin = true)
  );

-- ── 2. bankid_signatures ─────────────────────────────────────────────────
--
-- Lagrer signaturer fra BankID-flow. Brukes av signature_block-modulen i
-- dokument-renderingen for å bevise at en bruker har signert versjon X av
-- side Y.

create table if not exists public.bankid_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null,
  page_version int not null,
  -- Hvem signerte (vår side)
  signer_user_id uuid references public.profiles (id) on delete set null,
  signer_role text,                 -- 'arbeidstaker', 'leder', 'tillitsvalgt', 'verneombud', custom
  -- Identitet fra BankID (aldri klartekst fødselsnr)
  signer_display_name text not null,
  signer_ssn_hash text,             -- sha256 av fødselsnummer
  oidc_sub text,                    -- BankID OIDC subject identifier
  -- Status + sikkerhetslogg
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'expired', 'error')),
  signed_at timestamptz,
  -- Sikkerhetslog (for revisjon)
  client_ip inet,
  user_agent text,
  -- Frittekst — f.eks. «Drøftet med tillitsvalgt» fra signature_block
  signature_note text,
  created_at timestamptz not null default now()
);

create index if not exists bankid_signatures_page_idx
  on public.bankid_signatures (organization_id, page_id, page_version);

create index if not exists bankid_signatures_user_idx
  on public.bankid_signatures (signer_user_id, signed_at desc);

comment on table public.bankid_signatures is
  'BankID-signaturer på dokumenter. Personnummer lagres aldri i klartekst — kun sha256-hash.';

alter table public.bankid_signatures enable row level security;

drop policy if exists bankid_signatures_select on public.bankid_signatures;
create policy bankid_signatures_select on public.bankid_signatures
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.organization_id = bankid_signatures.organization_id)
  );

drop policy if exists bankid_signatures_insert on public.bankid_signatures;
create policy bankid_signatures_insert on public.bankid_signatures
  for insert with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.organization_id = bankid_signatures.organization_id)
  );

-- Etter signering er rad uforanderlig — ingen update/delete
-- (admin kan slette via service_role hvis nødvendig for personvern­krav)

-- ── 3. Helper-view: signatur-status per side ─────────────────────────────

create or replace view public.bankid_signatures_by_page as
select
  organization_id,
  page_id,
  page_version,
  count(*) filter (where status = 'completed') as completed_count,
  count(*) filter (where status = 'pending') as pending_count,
  array_agg(distinct signer_role) filter (where status = 'completed') as completed_roles,
  max(signed_at) as latest_signed_at
from public.bankid_signatures
group by organization_id, page_id, page_version;

comment on view public.bankid_signatures_by_page is
  'Aggregert signatur-status per side. Brukes av signature_block-modulen for å vise hvem som har signert.';
