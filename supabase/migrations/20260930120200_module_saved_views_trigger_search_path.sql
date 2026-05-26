-- Pin the search_path on the two before-insert trigger functions
-- introduced in 20260930120000 + amended in _120100. Without the
-- explicit `set search_path = public, pg_temp`, the function's
-- behaviour depends on the caller's current search path, which can
-- be manipulated. Closes the `function_search_path_mutable` advisor
-- warning the supabase linter surfaces.

create or replace function public.module_saved_views_before_insert_defaults()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.module_saved_view_defaults_before_insert()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;
