-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M3 — internal_control_clauses (cross-pack junction)
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   This junction is the mechanical answer to "a single control satisfies
--   multiple frameworks". Today the schema forces a separate
--   compliance_requirements row per pack — a management-review template
--   tagged `aml-amu` cannot share a junction row with the same management-
--   review template tagged `iso-45001`. By making the junction sit on
--   `internal_controls` ↔ `regulation_clauses` (cross-framework taxonomy
--   from M1), the same control row can map to ISO 9001 § 9.3 + ISO 14001
--   § 9.3 + ISO 27001 § 9.3 + ISO 45001 § 9.3 + AML § 7-2(2)f + IK-f § 5
--   nr. 8 — and the gap planner sees the coverage everywhere.
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 1 a krever skriftlig kobling mellom virksomhetens
--     mål/aktiviteter og de lovkravene de er ment å oppfylle.
--     internal_control_clauses ER det skriftlige sporet — hver kobling
--     bærer både `coverage_level` ('primary'/'supporting'/'partial')
--     og `notes` for rationale.
--   - AML § 3-1 (2) e krever rutiner for å avdekke regelverksbrudd. En
--     manglende junction-rad for en aktiv klausul = automatisk gap-flagg
--     i compliance_evidence_v + planner-matrise.
--   - Restrisiko: same-org coherence trigger blokkerer kryss-tenant
--     ulykker; men en org-bruker kan i prinsippet referere en system-
--     klausul (org_id = sin egen org) som ennå ikke er seedet. Det er
--     en hard-feil ved insert, ikke en stille lekkasje.

set local search_path = public, pg_catalog;

-- ── 1. Enum ──────────────────────────────────────────────────────────────

do $$ begin
  create type public.control_coverage_level as enum (
    'primary',     -- This control is the main mechanism satisfying this clause
    'supporting',  -- Contributes but is not the primary control
    'partial'      -- Only covers part of the clause; other controls needed
  );
exception when duplicate_object then null; end $$;

-- ── 2. Table ─────────────────────────────────────────────────────────────

create table if not exists public.internal_control_clauses (
  control_id        uuid not null references public.internal_controls (id) on delete cascade,
  clause_id         text not null,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  coverage_level    public.control_coverage_level not null default 'primary',
  notes             text not null default '',
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (control_id, clause_id)
);

comment on table public.internal_control_clauses is
  $c$Junction: one internal control satisfies N regulation_clauses
  (cross-framework). `coverage_level` distinguishes the main mechanism
  ('primary') from contributing controls ('supporting'/'partial').
  Composite PK prevents duplicate coverage rows; same-org coherence
  trigger asserts both ends belong to the same organization (with
  system clauses always allowed, mirroring the regulations pattern).$c$;

comment on column public.internal_control_clauses.clause_id is
  $c$References `regulation_clauses.id`. Not a native FK because the
  parent table has a composite PK (org_id, id); the trigger
  `internal_control_clauses_same_org()` enforces existence + same-org.$c$;

create index if not exists internal_control_clauses_clause_idx
  on public.internal_control_clauses (organization_id, clause_id);

create index if not exists internal_control_clauses_org_control_idx
  on public.internal_control_clauses (organization_id, control_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────

alter table public.internal_control_clauses enable row level security;

drop policy if exists internal_control_clauses_select_org on public.internal_control_clauses;
create policy internal_control_clauses_select_org
  on public.internal_control_clauses for select
  using (organization_id = public.current_org_id());

drop policy if exists internal_control_clauses_write_org on public.internal_control_clauses;
create policy internal_control_clauses_write_org
  on public.internal_control_clauses for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
  );

-- ── 4. Trigger: derive organization_id + assert same-org coherence ───────

create or replace function public.internal_control_clauses_same_org()
returns trigger
language plpgsql
as $$
declare
  v_control_org uuid;
  v_clause_org  uuid;
begin
  -- 1. Pull org from the parent control row.
  select organization_id into v_control_org
    from public.internal_controls
    where id = new.control_id
      and deleted_at is null;
  if v_control_org is null then
    raise exception
      'internal_control_clauses.control_id % does not exist (active)',
      new.control_id;
  end if;

  -- 2. Pull org from the clause row.
  select organization_id into v_clause_org
    from public.regulation_clauses
    where id = new.clause_id
      and deleted_at is null
      and is_active = true
    order by case when organization_id = v_control_org then 0 else 1 end
    limit 1;
  if v_clause_org is null then
    raise exception
      'internal_control_clauses.clause_id % does not exist (active) for organization %',
      new.clause_id, v_control_org;
  end if;

  -- 3. Same-org coherence: both rows must belong to the same org.
  --    (System rows live per-org with is_system=true, so this is just an
  --    equality check.)
  if v_clause_org <> v_control_org then
    raise exception
      'internal_control_clauses cross-org link: control org % vs clause org %',
      v_control_org, v_clause_org;
  end if;

  -- 4. Derive organization_id from the parent control.
  new.organization_id := v_control_org;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists internal_control_clauses_same_org_tg on public.internal_control_clauses;
create trigger internal_control_clauses_same_org_tg
  before insert or update on public.internal_control_clauses
  for each row execute function public.internal_control_clauses_same_org();
