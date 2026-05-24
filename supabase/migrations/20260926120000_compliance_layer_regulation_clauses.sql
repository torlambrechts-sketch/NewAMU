-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M1 — regulation_clauses (Tier 1, paragraph-level)
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   Today the canonical legal taxonomy lives in two places that don't
--   talk to each other:
--     1. `regulations` (per-org, composite PK, 9 system rows) — framework
--        header level only ('aml', 'iso-45001', 'gdpr').
--     2. `compliance_requirements` (system + per-org, pack-scoped) —
--        paragraph-level but bound to a single `compliance_pack` enum
--        value, so "ISO 9001 § 9.3" and "ISO 45001 § 9.3" sit in
--        separate rows and cannot share a control via a junction.
--
--   The 3-tier architecture (Rules → Internal Controls → Execution)
--   requires a single canonical clause taxonomy that any internal
--   control can reference cross-framework. `regulation_clauses` is
--   that taxonomy — paragraph-keyed, framework-tagged, hierarchical via
--   `parent_clause_id`. The existing `compliance_requirements` table is
--   kept intact (no rows moved) and gains a `clause_id` FK so the two
--   models can co-exist while the new layer rolls out.
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 1a krever skriftlig dokumentasjon av hvilke lover og
--     forskrifter virksomheten er omfattet av. `regulation_clauses` er
--     den maskinlesbare versjonen av dette kravregisteret — paragraf for
--     paragraf, med samme-org RLS slik at hver tenant kun ser sine egne
--     rader pluss system-grunnlinjen.
--   - AML § 3-1 (2) e krever rutiner for å avdekke regelverksbrudd.
--     Eksakt streng-match mellom `regulation_clauses.code` og eksisterende
--     `law_refs[]`-felt på alle template-flater (sjekklist, undersøkelse,
--     dokument, læring, møte, register) gjør at gap-planneren kan
--     produsere paragraph × control-matrise uten parsing-heuristikk.
--   - Restrisiko: 1) automatisk backfill av `compliance_requirements.
--     clause_id` matcher kun rader der `code` finnes eksakt i seed-listen
--     (M7). Tilstandsbrudd ryddes i en oppfølgings-migrasjon når seed
--     utvides. 2) Soft-coherence trigger sikrer at en klausul aldri
--     refererer en regulation som ikke finnes for samme org — men system-
--     regulations regnes alltid som gyldig kontekst (org_id NULL er ikke
--     mulig her, men is_system-flagg krysser RLS).

set local search_path = public, pg_catalog;

-- ── 1. Table ─────────────────────────────────────────────────────────────

create table if not exists public.regulation_clauses (
  id                text not null,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  regulation_id     text not null,
  parent_clause_id  text,
  code              text not null,
  title             text not null,
  description       text not null default '',
  name_i18n         jsonb not null default '{}'::jsonb,
  description_i18n  jsonb not null default '{}'::jsonb,
  position          integer not null default 100,
  is_active         boolean not null default true,
  is_system         boolean not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (organization_id, id),
  -- Self-FK enforced at trigger level (cross-row, same composite key needed)
  check (char_length(id) > 0),
  check (char_length(code) > 0),
  check (char_length(title) > 0),
  check (jsonb_typeof(name_i18n) = 'object'),
  check (jsonb_typeof(description_i18n) = 'object')
);

comment on table public.regulation_clauses is
  $c$Paragraph-level legal/standards clauses. Composite PK (org_id, id)
  mirrors `regulations`. `id` is a slug like 'aml-3-1', 'iso-45001-9-3',
  'gdpr-art-33'. `code` carries the exact display string that matches
  `law_refs[]` entries across all template surfaces. Cross-framework
  reuse is enabled by `internal_control_clauses` linking one control to
  N clauses across packs.$c$;

comment on column public.regulation_clauses.id is
  $c$Slug, stable across migrations. Format: `<regulation_id>-<paragraph>`.
  Used as text FK from `internal_control_clauses.clause_id` and
  (additively) from `compliance_requirements.clause_id`.$c$;

comment on column public.regulation_clauses.code is
  $c$Display string, e.g. 'AML § 3-1', 'ISO 45001:2018 § 9.2',
  'GDPR Art. 33', 'IK-f § 5 nr. 7'. Exact-match against existing
  `law_refs text[]` arrays on every template surface — the gap planner
  + auto-binding resolver depend on string equality.$c$;

comment on column public.regulation_clauses.regulation_id is
  $c$Slug from `regulations.id` ('aml', 'iso-45001', etc.). Same-org
  coherence enforced by `regulation_clauses_same_org()` trigger —
  cannot reference a regulation that doesn't exist for this org.$c$;

comment on column public.regulation_clauses.parent_clause_id is
  $c$Self-reference for hierarchy (e.g. 'aml-3-1-a' is child of
  'aml-3-1'). Enforced via trigger because composite PK prevents a
  native self-FK without a duplicate org_id column.$c$;

create index if not exists regulation_clauses_org_active_idx
  on public.regulation_clauses (organization_id, regulation_id, position)
  where is_active = true and deleted_at is null;

create index if not exists regulation_clauses_org_code_idx
  on public.regulation_clauses (organization_id, code)
  where deleted_at is null;

create unique index if not exists regulation_clauses_org_code_uidx
  on public.regulation_clauses (organization_id, code)
  where deleted_at is null;

-- ── 2. RLS ───────────────────────────────────────────────────────────────

alter table public.regulation_clauses enable row level security;

drop policy if exists regulation_clauses_select on public.regulation_clauses;
create policy regulation_clauses_select
  on public.regulation_clauses for select
  using (organization_id = public.current_org_id());

drop policy if exists regulation_clauses_write on public.regulation_clauses;
create policy regulation_clauses_write
  on public.regulation_clauses for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    -- System rows protected from app-side writes (managed via migrations).
    and is_system = false
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    and is_system = false
  );

-- ── 3. Triggers: defaults, updated_at, same-org coherence ────────────────

create or replace function public.regulation_clauses_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists regulation_clauses_before_insert_defaults_tg on public.regulation_clauses;
create trigger regulation_clauses_before_insert_defaults_tg
  before insert on public.regulation_clauses
  for each row execute function public.regulation_clauses_before_insert_defaults();

drop trigger if exists regulation_clauses_set_updated_at on public.regulation_clauses;
create trigger regulation_clauses_set_updated_at
  before update on public.regulation_clauses
  for each row execute function public.set_updated_at();

create or replace function public.regulation_clauses_same_org()
returns trigger
language plpgsql
as $$
declare
  v_reg_count int;
  v_parent_count int;
begin
  -- 1. regulation_id must exist for this org (or be a system row in this org).
  select count(*) into v_reg_count
    from public.regulations
    where organization_id = new.organization_id
      and id = new.regulation_id
      and is_active = true
      and deleted_at is null;
  if v_reg_count = 0 then
    raise exception
      'regulation_clauses.regulation_id % does not exist (active) for organization %',
      new.regulation_id, new.organization_id;
  end if;

  -- 2. parent_clause_id, when set, must exist for the same org.
  if new.parent_clause_id is not null then
    select count(*) into v_parent_count
      from public.regulation_clauses
      where organization_id = new.organization_id
        and id = new.parent_clause_id
        and deleted_at is null;
    if v_parent_count = 0 then
      raise exception
        'regulation_clauses.parent_clause_id % does not exist for organization %',
        new.parent_clause_id, new.organization_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists regulation_clauses_same_org_tg on public.regulation_clauses;
create trigger regulation_clauses_same_org_tg
  before insert or update on public.regulation_clauses
  for each row execute function public.regulation_clauses_same_org();

-- ── 4. compliance_requirements.clause_id — additive FK column ────────────

alter table public.compliance_requirements
  add column if not exists clause_id text;

comment on column public.compliance_requirements.clause_id is
  $c$Optional pointer into `regulation_clauses.id`. Additive — old
  read-paths that only consult `pack` + `slug` keep working. New
  paths (gap planner, internal controls UI) follow this FK to pull
  the canonical paragraph metadata.$c$;

-- Index for the gap planner's reverse lookup (find requirements that
-- belong to a clause).
create index if not exists compliance_requirements_clause_id_idx
  on public.compliance_requirements (clause_id)
  where clause_id is not null and deleted_at is null;

-- One-shot backfill: when M7 lands the clause baseline, this UPDATE
-- pre-populates `clause_id` from exact `code` match. Re-running this
-- migration is a no-op for already-set rows.
--
-- Note: the backfill runs against rows that exist NOW. Future clause-
-- seed updates re-run the backfill via M7's provision function.
update public.compliance_requirements cr
   set clause_id = rc.id
  from public.regulation_clauses rc
 where cr.clause_id is null
   and cr.deleted_at is null
   and rc.deleted_at is null
   and (cr.organization_id = rc.organization_id or cr.organization_id is null)
   and cr.code = rc.code;
