-- workflow_rule_catalog: system-owned library of audit-ready workflow templates.
--
-- Mirrors the template-surface pattern from CLAUDE.md:
--   survey:    survey_template_catalog    + survey_org_templates
--   documents: document_system_templates  + document_org_templates
--   meetings:  meeting_system_templates   + meeting_org_template_settings
-- For workflows, the per-org row already exists (workflow_rules). What was
-- missing was the system catalog, so bug-fixes to a baseline rule could
-- ship without an awkward UPDATE-by-slug across every tenant. Per-org rows
-- carry catalog_slug + catalog_version (added in _120100) so the UI can
-- surface "an update is available" without overwriting org edits.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — systematisk overvåking krever
--   at maler kan vedlikeholdes sentralt. Tidligere måtte hver organisasjon
--   få en patch direkte — uskalbar.
--   Restrisiko deferred: org-tilpasninger forblir org-eide (vi sender ikke
--   diff-varsler enda); inntil videre er det opp til admin å vurdere
--   "Bruk oppdatert mal".

create table if not exists public.workflow_rule_catalog (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  scope_id           text not null,                        -- maps to module scope (compliance, survey, …, gov)
  name_i18n          jsonb not null,                       -- { nb, en }
  description_i18n   jsonb not null default '{}'::jsonb,
  source_module      text not null,                        -- workflow_rules.source_module value
  trigger_type       text not null default 'db_event'
                       check (trigger_type in ('payload_change','db_event','schedule','manual','webhook_in')),
  trigger_event_name text,                                 -- e.g. 'finding_critical'
  schedule_cron      text,                                 -- for trigger_type = 'schedule'
  trigger_on         text not null default 'both'
                       check (trigger_on in ('insert','update','both')),
  condition_json     jsonb not null default '{"match":"always"}'::jsonb,
  actions_json       jsonb not null default '[]'::jsonb,
  flow_graph_json    jsonb,                                -- visual layout (matches workflowFlowTypes.ts)
  steps_json         jsonb not null default '[]'::jsonb,   -- workflow_steps shape, for multi-step rules
  law_refs           text[] not null default '{}',
  frameworks         text[] not null default '{}',
  pack               text,                                 -- 'aml-amu' | 'iso-45001' | 'gdpr' | 'hovedavtalen' | …
  cadence_hint       text,                                 -- 'arlig' | 'halvarlig' | 'kvartalsvis' | 'ad_hoc'
  recommended_for    text[] not null default '{}',         -- ['HMS-leder', 'verneombud', …]
  confidentiality_level text not null default 'standard'
                       check (confidentiality_level in ('standard','restricted','confidential')),
  contains_gov_action boolean not null default false,
  idempotency_template text,
  catalog_version    int not null default 1,
  is_published       boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists workflow_rule_catalog_scope_idx
  on public.workflow_rule_catalog (scope_id, is_published);

create index if not exists workflow_rule_catalog_pack_idx
  on public.workflow_rule_catalog (pack) where pack is not null;

create index if not exists workflow_rule_catalog_law_refs_gin_idx
  on public.workflow_rule_catalog using gin (law_refs);

create index if not exists workflow_rule_catalog_frameworks_gin_idx
  on public.workflow_rule_catalog using gin (frameworks);

drop trigger if exists workflow_rule_catalog_set_updated_at on public.workflow_rule_catalog;
create trigger workflow_rule_catalog_set_updated_at
  before update on public.workflow_rule_catalog
  for each row execute function public.set_updated_at();

alter table public.workflow_rule_catalog enable row level security;

-- Catalog is system-wide: every authenticated user in every org can read.
drop policy if exists "workflow_rule_catalog_select_all" on public.workflow_rule_catalog;
create policy "workflow_rule_catalog_select_all"
  on public.workflow_rule_catalog for select
  to authenticated
  using (true);

-- Only platform admins can write. (Service-role bypasses RLS anyway, so the
-- seed migrations run as expected.)
drop policy if exists "workflow_rule_catalog_write_platform" on public.workflow_rule_catalog;
create policy "workflow_rule_catalog_write_platform"
  on public.workflow_rule_catalog for all
  using (public.platform_is_admin())
  with check (public.platform_is_admin());

comment on table public.workflow_rule_catalog is
  'System-owned library of audit-ready workflow templates. Per-org instances live in workflow_rules with catalog_slug/catalog_version backreferences.';
comment on column public.workflow_rule_catalog.contains_gov_action is
  'TRUE if the template references any gov action (Altinn/RegInc/Datatilsynet/NAV/LDO). Builder uses this to gate the rule behind workflows.activate_external.';
comment on column public.workflow_rule_catalog.flow_graph_json is
  'Optional visual layout matching src/lib/workflowFlowTypes.ts. NULL for legacy linear templates.';
