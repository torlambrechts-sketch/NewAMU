-- System reports — code-owned, locked-down layouts shippable across pages.
--
-- Adds the `is_system` flag to `dashboard_layouts`. A system row is a
-- read-only, org-agnostic layout (organization_id IS NULL) that any
-- authenticated user can SELECT but only migrations can write.
--
-- Concretely:
--   1. is_system boolean column, default false.
--   2. organization_id becomes nullable — but only when is_system=true.
--   3. before_insert_defaults skips the org auto-fill on system rows.
--   4. New partial unique index enforces uniqueness of (scope_id, slug)
--      across system rows (the existing unique on
--      (organization_id, scope_id, slug, owner_user_id) is moot here
--      because Postgres treats NULLs as distinct in unique constraints).
--   5. Additive SELECT policy lets every authenticated user read
--      system rows regardless of which org they're in.
--   6. The org-write policy already short-circuits when
--      organization_id IS NULL, but we belt-and-braces it with a CHECK
--      that no normal user can flip is_system=true via UPDATE.
--
-- Self-revisjon (Arbeidstilsynet POV): locked system reports satisfy the
-- «kan ikke endre rapporten» del av tilsynsbevis-tråden (IK-f § 5 nr. 7,
-- AML § 18-8) ved at innholdet er kodeforvaltet og kun endret via
-- versjonert migrasjon. Restrisiko: «hvem signerte rapporten» løses i
-- snapshot-published-modulen som allerede finnes (kind='report').

set local search_path = public, pg_catalog;

alter table public.dashboard_layouts
  add column if not exists is_system boolean not null default false;

comment on column public.dashboard_layouts.is_system is
  'True for code-owned, org-agnostic layouts seeded via migration. organization_id is NULL on these rows. Read-only via RLS; only migrations should insert/update.';

-- Drop NOT NULL on organization_id so system rows can sit org-agnostic.
-- Pre-existing rows are unaffected (all currently NOT NULL).
alter table public.dashboard_layouts
  alter column organization_id drop not null;

-- Ensure no user can sneak a non-system row in without an org. Existing
-- trigger guarantees this for INSERT; the CHECK guarantees it for both
-- INSERT and UPDATE.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dashboard_layouts_org_required_unless_system_chk'
  ) then
    alter table public.dashboard_layouts
      add constraint dashboard_layouts_org_required_unless_system_chk
      check (is_system or organization_id is not null);
  end if;
end $$;

-- Partial unique index for system rows. Without this, NULL org_id would
-- let duplicates slip past the existing four-column unique constraint.
create unique index if not exists dashboard_layouts_system_uniq
  on public.dashboard_layouts (scope_id, slug)
  where is_system = true and deleted_at is null;

-- Update insert-defaults trigger so it doesn't auto-fill organization_id
-- on system rows (which are intentionally org-agnostic).
create or replace function public.dashboard_layouts_before_insert_defaults()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not new.is_system and new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Additive SELECT policy: any authenticated user can read system layouts.
-- The existing org-scoped policy keeps personal/org rows private.
drop policy if exists dashboard_layouts_select_system on public.dashboard_layouts;
create policy dashboard_layouts_select_system
  on public.dashboard_layouts for select
  to authenticated
  using (is_system = true and deleted_at is null);

-- Tighten the write policy with check so that:
--   - users can't insert a row with is_system=true
--   - users can't flip an existing row to is_system=true
-- The original policy already requires organization_id = current_org_id();
-- since system rows have organization_id IS NULL, the USING clause was
-- already false for them. We re-declare WITH CHECK explicitly to make
-- intent obvious.
drop policy if exists dashboard_layouts_write_org on public.dashboard_layouts;
create policy dashboard_layouts_write_org
  on public.dashboard_layouts for all
  to authenticated
  using (
    is_system = false
    and organization_id = public.current_org_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  )
  with check (
    is_system = false
    and organization_id = public.current_org_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  );

grant select on public.dashboard_layouts to authenticated;
