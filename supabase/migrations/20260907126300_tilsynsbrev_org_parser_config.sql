-- Tilsynsbrev per-org parser config — promotes the Claude LLM extraction
-- path from "optional fallback" to "default when API key present" and
-- exposes a per-org override so admins can lock the module to LLM-only
-- (fail loud on missing key) or regex-only (deterministic, no LLM calls).
-- AML § 18-6 + tilsynsforberedelse: påleggsoppfølging må være sporbar og
-- konsistent. GDPR Art. 22 dekker bare automatiserte enkelt-beslutninger
-- med rettslige virkninger; auto-ekstraksjon av paragrafer er ingen slik
-- beslutning (mennesker akseptererer/avviser i UI), men vi siterer den
-- som "føre var" og lar admin styre modus + sette cap på LLM-bruk.

set local search_path = public, pg_catalog;

-- ── 1. Per-upload parser_mode (caller-override) ────────────────────────
-- parser_mode is what the *user* asked for at upload time. parser_kind
-- (already on the table) is what the edge-fn actually ended up using
-- after resolving caller pref + org default + key availability + rate
-- limit. The two stay distinct on purpose.
alter table public.tilsynsbrev_uploads
  add column if not exists parser_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'tilsynsbrev_uploads_parser_mode_chk'
  ) then
    alter table public.tilsynsbrev_uploads
      add constraint tilsynsbrev_uploads_parser_mode_chk
      check (parser_mode in ('auto','llm_only','regex_only'));
  end if;
end$$;

comment on column public.tilsynsbrev_uploads.parser_mode is
  'Caller-requested parser mode at upload time. auto=use org default + key availability; llm_only=must use Claude (fails if key missing); regex_only=skip Claude even if key present. Resolved against org default in edge fn; final pick is recorded in parser_kind.';

-- ── 2. Per-org settings ────────────────────────────────────────────────
-- There is no existing organization_settings table for this module, so
-- we add a minimal one. Rows are created lazily — absence means "auto"
-- with the default cap. Composite PK on organization_id only.
create table if not exists public.org_tilsynsbrev_settings (
  organization_id              uuid primary key references public.organizations(id) on delete cascade,
  default_parser_mode          text not null default 'auto'
                                 check (default_parser_mode in ('auto','llm_only','regex_only')),
  -- Name of the Supabase Vault secret holding the per-org Anthropic key.
  -- NULL = use platform-level ANTHROPIC_API_KEY env var. Per-org keys
  -- are a v0.2 surface; today we just store the pointer.
  anthropic_api_key_secret_name text,
  -- Hard cap on Claude calls per calendar month, per org. NULL = use the
  -- platform default of 100. Going over the cap forces regex fallback
  -- and logs a notice to console (NOT to workflow_runs to keep that
  -- table clean — rate-limit hits are operational, not domain events).
  monthly_llm_call_cap         int,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

drop trigger if exists org_tilsynsbrev_settings_set_updated_at on public.org_tilsynsbrev_settings;
create trigger org_tilsynsbrev_settings_set_updated_at
  before update on public.org_tilsynsbrev_settings
  for each row execute function public.set_updated_at();

comment on table public.org_tilsynsbrev_settings is
  'Per-organisation tilsynsbrev-parser overrides. Row is optional — absence means {default_parser_mode: ''auto'', cap: 100, key: platform}. Inserted lazily by admin UI; the edge fn fetches the row with service_role and falls back to defaults when missing.';
comment on column public.org_tilsynsbrev_settings.default_parser_mode is
  'Default mode applied when an upload has parser_mode=''auto''. auto resolves to llm if key present, regex otherwise; llm_only fails upload if no key; regex_only never calls Claude.';
comment on column public.org_tilsynsbrev_settings.anthropic_api_key_secret_name is
  'Optional pointer to a per-org Anthropic API key stored in Supabase Vault. v0.1 reads platform ANTHROPIC_API_KEY env var; per-org Vault lookup lands in v0.2.';
comment on column public.org_tilsynsbrev_settings.monthly_llm_call_cap is
  'Hard cap on LLM calls per calendar month. NULL = platform default (100). Going over forces regex fallback and parser_kind = ''regex:rate_limited''.';

-- ── 3. RLS ─────────────────────────────────────────────────────────────
alter table public.org_tilsynsbrev_settings enable row level security;

-- SELECT: any org member can read the org's settings (it's the parser
-- behaviour they will experience). No confidentiality gate — these are
-- operational knobs, not case content.
drop policy if exists "org_tilsynsbrev_settings_select_org" on public.org_tilsynsbrev_settings;
create policy "org_tilsynsbrev_settings_select_org"
  on public.org_tilsynsbrev_settings for select
  using (organization_id = public.current_org_id());

-- INSERT / UPDATE: org admins only. We reuse tilsynsbrev.upload as the
-- admin-tier permission for this module (same gate as the hidden-count
-- RPC in _125600).
drop policy if exists "org_tilsynsbrev_settings_write_admin" on public.org_tilsynsbrev_settings;
create policy "org_tilsynsbrev_settings_write_admin"
  on public.org_tilsynsbrev_settings for insert
  with check (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

drop policy if exists "org_tilsynsbrev_settings_update_admin" on public.org_tilsynsbrev_settings;
create policy "org_tilsynsbrev_settings_update_admin"
  on public.org_tilsynsbrev_settings for update
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  )
  with check (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

drop policy if exists "org_tilsynsbrev_settings_delete_denied" on public.org_tilsynsbrev_settings;
create policy "org_tilsynsbrev_settings_delete_denied"
  on public.org_tilsynsbrev_settings for delete
  using (false);

-- ── 4. Cost-accounting / usage counter ─────────────────────────────────
-- One row per (org, month). Edge fn UPSERTs and increments via
-- tilsynsbrev_llm_usage_record(); reads via the SELECT policy below.
create table if not exists public.tilsynsbrev_llm_usage (
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  month                date not null,
  total_calls          bigint not null default 0,
  total_input_tokens   bigint not null default 0,
  total_output_tokens  bigint not null default 0,
  last_call_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (organization_id, month)
);

drop trigger if exists tilsynsbrev_llm_usage_set_updated_at on public.tilsynsbrev_llm_usage;
create trigger tilsynsbrev_llm_usage_set_updated_at
  before update on public.tilsynsbrev_llm_usage
  for each row execute function public.set_updated_at();

create index if not exists tilsynsbrev_llm_usage_org_month_desc_idx
  on public.tilsynsbrev_llm_usage (organization_id, month desc);

comment on table public.tilsynsbrev_llm_usage is
  'Per-org monthly Claude-call counter for the tilsynsbrev-parser edge fn. Tokens read from the Anthropic response usage block. Used both for billing visibility and to enforce monthly_llm_call_cap from org_tilsynsbrev_settings.';

alter table public.tilsynsbrev_llm_usage enable row level security;

drop policy if exists "tilsynsbrev_llm_usage_select_org" on public.tilsynsbrev_llm_usage;
create policy "tilsynsbrev_llm_usage_select_org"
  on public.tilsynsbrev_llm_usage for select
  using (organization_id = public.current_org_id());

-- Writes only by service_role (edge fn). No end-user write policy.
drop policy if exists "tilsynsbrev_llm_usage_no_user_write" on public.tilsynsbrev_llm_usage;
create policy "tilsynsbrev_llm_usage_no_user_write"
  on public.tilsynsbrev_llm_usage for insert
  with check (false);

drop policy if exists "tilsynsbrev_llm_usage_no_user_update" on public.tilsynsbrev_llm_usage;
create policy "tilsynsbrev_llm_usage_no_user_update"
  on public.tilsynsbrev_llm_usage for update
  using (false);

drop policy if exists "tilsynsbrev_llm_usage_no_user_delete" on public.tilsynsbrev_llm_usage;
create policy "tilsynsbrev_llm_usage_no_user_delete"
  on public.tilsynsbrev_llm_usage for delete
  using (false);

-- ── 5. Atomic increment RPC ────────────────────────────────────────────
-- Edge fn calls this once per Claude call. SECURITY DEFINER so the
-- service_role (or, in the future, a per-org JWT) can upsert without
-- tripping the no-user-write policy.
create or replace function public.tilsynsbrev_llm_usage_record(
  p_org_id        uuid,
  p_input_tokens  int,
  p_output_tokens int
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_month date := date_trunc('month', now())::date;
begin
  insert into public.tilsynsbrev_llm_usage as u (
    organization_id, month, total_calls, total_input_tokens,
    total_output_tokens, last_call_at
  ) values (
    p_org_id, v_month, 1, coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0), now()
  )
  on conflict (organization_id, month) do update
    set total_calls         = u.total_calls + 1,
        total_input_tokens  = u.total_input_tokens + coalesce(p_input_tokens, 0),
        total_output_tokens = u.total_output_tokens + coalesce(p_output_tokens, 0),
        last_call_at        = now();
end;
$$;

revoke all on function public.tilsynsbrev_llm_usage_record(uuid, int, int) from public;
grant execute on function public.tilsynsbrev_llm_usage_record(uuid, int, int)
  to service_role;

comment on function public.tilsynsbrev_llm_usage_record(uuid, int, int) is
  'Atomic UPSERT/increment for tilsynsbrev_llm_usage. Called by the tilsynsbrev-parser edge fn after a successful Claude call. service_role only.';
