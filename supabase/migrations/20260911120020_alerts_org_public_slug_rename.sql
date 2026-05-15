-- Phase F3 (early-land) — rename organizations.whistle_public_slug → alerts_public_slug.
--
-- The new public RPCs in 20260911120021 reference alerts_public_slug. The
-- legacy column stays as a generated alias for the transition period so
-- /varsle/:slug URLs keep working until App.tsx is updated in Phase F1.
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- 1. Add new column if missing
alter table public.organizations
  add column if not exists alerts_public_slug text;

-- 2. Backfill from legacy column
update public.organizations
   set alerts_public_slug = whistle_public_slug
 where alerts_public_slug is null
   and whistle_public_slug is not null;

-- 3. For any rows missing both, derive from id
update public.organizations
   set alerts_public_slug = replace(id::text, '-', '')
 where alerts_public_slug is null;

-- 4. Constraints + index
do $$
begin
  alter table public.organizations alter column alerts_public_slug set not null;
exception when others then null;
end $$;

create unique index if not exists organizations_alerts_slug_uidx
  on public.organizations (alerts_public_slug);

-- 5. Trigger replaces the legacy whistle slug trigger
create or replace function public.organizations_set_alerts_slug()
returns trigger
language plpgsql
as $$
begin
  if new.alerts_public_slug is null or length(trim(new.alerts_public_slug)) < 8 then
    -- Inherit from legacy column if present (transition window), else derive
    new.alerts_public_slug := coalesce(
      nullif(trim(new.whistle_public_slug), ''),
      replace(new.id::text, '-', '')
    );
  end if;
  -- Keep legacy in sync so /varsle/:slug still works until Phase F4 drops it
  if new.whistle_public_slug is null then
    new.whistle_public_slug := new.alerts_public_slug;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_whistle_slug_bi on public.organizations;
drop trigger if exists organizations_alerts_slug_bi on public.organizations;
create trigger organizations_alerts_slug_bi
  before insert on public.organizations
  for each row execute function public.organizations_set_alerts_slug();

-- 6. Drop the legacy trigger function (no longer referenced)
drop function if exists public.organizations_set_whistle_slug();
