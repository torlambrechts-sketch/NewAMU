-- Resolver RPC for the "Mine favoritter" page.
--
-- The favourites page needs a human title for every favourited template,
-- but the seven modules store their display name in different columns
-- (name / label / locale-table title). Rather than make the client run
-- seven schema-specific queries, `get_my_template_favorites` resolves the
-- title server-side in one round trip. A favourite whose template no
-- longer exists comes back with `resolved = false` so the UI can show it
-- as stale (and let the user remove it) instead of silently dropping it.

set local search_path = public, pg_catalog;

create or replace function public.get_my_template_favorites()
returns table (
  id            uuid,
  template_kind text,
  template_ref  text,
  "position"    integer,
  source        text,
  title         text,
  resolved      boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with fav as (
    select * from public.template_favorites
    where user_id = auth.uid()
      and organization_id = public.current_org_id()
  )
  select
    f.id,
    f.template_kind,
    f.template_ref,
    f.position,
    f.source,
    coalesce(t.title, f.template_ref) as title,
    (t.title is not null)             as resolved
  from fav f
  left join lateral (
    select case f.template_kind
      when 'compliance' then (
        select name from public.compliance_checklist_templates
        where id::text = f.template_ref and organization_id = f.organization_id)
      when 'survey' then (
        select name from public.survey_template_catalog
        where id = f.template_ref)
      when 'document' then coalesce(
        (select label from public.document_system_templates
         where id = f.template_ref),
        (select label from public.document_org_templates
         where id = f.template_ref and organization_id = f.organization_id))
      when 'register' then (
        select name from public.register_types
        where id = f.template_ref)
      when 'learning' then (
        select l.title
        from public.learning_system_course_locales l
        join public.learning_system_courses c on c.id = l.system_course_id
        where c.id = f.template_ref
        order by (l.locale = c.default_locale) desc, (l.locale = 'nb') desc
        limit 1)
      when 'task' then (
        select name from public.task_template_catalog
        where id::text = f.template_ref)
      when 'meeting' then coalesce(
        (select label from public.meeting_system_templates
         where id = f.template_ref),
        (select name from public.meeting_org_templates
         where id::text = f.template_ref and organization_id = f.organization_id))
      else null
    end as title
  ) t on true
  order by f.template_kind, f.position, title;
$$;

revoke all on function public.get_my_template_favorites() from public, anon;
grant execute on function public.get_my_template_favorites() to authenticated;
