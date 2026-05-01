-- Batch reorder module sort_order in one round-trip (GAP-DEV02).
-- learning_modules.id and course_id are text (not UUID) in this schema.

create or replace function public.learning_reorder_modules(
  p_course_id text,
  p_org_id uuid,
  p_module_ids text[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.learning_modules m
  set
    sort_order = sub.idx::int,
    updated_at = now()
  from (
    select
      u.module_id,
      (row_number() over () - 1) as idx
    from unnest(p_module_ids) as u(module_id)
  ) sub
  where m.id = sub.module_id
    and m.course_id = p_course_id
    and m.organization_id = p_org_id;
$$;

grant execute on function public.learning_reorder_modules(text, uuid, text[]) to authenticated;
