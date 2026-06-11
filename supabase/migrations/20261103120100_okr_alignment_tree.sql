-- OKR alignment tree (H3.2)
--
-- Gap closed: a single flat plan per org — team leads couldn't cascade the
-- company plan into team-level OKRs, and nothing showed which company
-- objective a team objective supports. Adds parent_plan_id (plan tree, max
-- depth 5, same org, cycle-guarded) and okr_objectives.supports_objective_id
-- (the «støtter: O2 …» cascade line).
--
-- The one-active-plan-per-org/pack unique index is rescoped to ROOT plans
-- (parent_plan_id is null) so provision_okr_baseline_for_org keeps its
-- idempotency contract while child plans multiply freely.
--
-- Self-audit (Arbeidstilsynet POV): linjeansvar for HMS-mål kan nå
-- dokumenteres per nivå (AML § 2-1 / § 3-1 systematikk). Restrisiko:
-- objectives' progress does not auto-roll up from child plans — the cascade
-- is navigational/documentary, not arithmetic.

alter table public.okr_plans
  add column if not exists parent_plan_id uuid references public.okr_plans(id) on delete set null;

comment on column public.okr_plans.parent_plan_id is
  'Parent in the alignment tree (company plan → team plan). Null = root. '
  'Same-org + max depth 5 enforced by okr_plans_validate_parent().';

alter table public.okr_objectives
  add column if not exists supports_objective_id uuid references public.okr_objectives(id) on delete set null;

comment on column public.okr_objectives.supports_objective_id is
  'Objective in the PARENT plan this objective supports («støtter: O2 …»). '
  'Same-org enforced by trigger; renders as the cascade line in planning.';

-- Rescope the active-plan uniqueness to roots only.
drop index if exists okr_plans_org_pack_unique_active_idx;
create unique index if not exists okr_plans_org_pack_unique_active_idx
  on public.okr_plans (organization_id, pack)
  where deleted_at is null and status <> 'archived' and parent_plan_id is null;

create index if not exists okr_plans_parent_idx
  on public.okr_plans (parent_plan_id)
  where parent_plan_id is not null;

-- Parent guard: same org, no self/cycle, max depth 5.
create or replace function public.okr_plans_validate_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cursor uuid;
  v_org uuid;
  v_depth int := 0;
begin
  if new.parent_plan_id is null then
    return new;
  end if;
  if new.parent_plan_id = new.id then
    raise exception 'En plan kan ikke være sin egen overordnede.';
  end if;
  select organization_id into v_org from public.okr_plans where id = new.parent_plan_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'Overordnet plan må tilhøre samme organisasjon.';
  end if;
  v_cursor := new.parent_plan_id;
  while v_cursor is not null loop
    v_depth := v_depth + 1;
    if v_depth >= 5 then
      raise exception 'Maksimal plan-dybde (5 nivåer) er nådd.';
    end if;
    if v_cursor = new.id then
      raise exception 'Syklisk plan-hierarki er ikke tillatt.';
    end if;
    select parent_plan_id into v_cursor from public.okr_plans where id = v_cursor;
  end loop;
  return new;
end;
$$;

drop trigger if exists okr_plans_validate_parent on public.okr_plans;
create trigger okr_plans_validate_parent
  before insert or update of parent_plan_id on public.okr_plans
  for each row execute function public.okr_plans_validate_parent();

-- supports_objective_id guard: same org (cross-plan reference is the point,
-- but never cross-tenant).
create or replace function public.okr_objectives_validate_supports()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
begin
  if new.supports_objective_id is null then
    return new;
  end if;
  if new.supports_objective_id = new.id then
    raise exception 'Et mål kan ikke støtte seg selv.';
  end if;
  select organization_id into v_org
    from public.okr_objectives where id = new.supports_objective_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'Støttet mål må tilhøre samme organisasjon.';
  end if;
  return new;
end;
$$;

drop trigger if exists okr_objectives_validate_supports on public.okr_objectives;
create trigger okr_objectives_validate_supports
  before insert or update of supports_objective_id on public.okr_objectives
  for each row execute function public.okr_objectives_validate_supports();
