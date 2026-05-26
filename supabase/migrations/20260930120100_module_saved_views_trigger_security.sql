-- Drop SECURITY DEFINER from the two before-insert trigger functions
-- introduced in 20260930120000. SECURITY DEFINER was over-cautious —
-- the trigger runs in the calling transaction's context, RLS isn't
-- involved, and exposing these as security-definer RPCs callable by
-- the anon role is exactly what the supabase advisor flagged
-- (anon_security_definer_function_executable).
--
-- Matches the convention used by internal_packs_before_insert_defaults
-- and other before-insert helpers across the codebase: plain plpgsql,
-- no security context override.

create or replace function public.module_saved_views_before_insert_defaults()
returns trigger language plpgsql as $$
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
returns trigger language plpgsql as $$
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
