-- Compliance matrix: include courses that use catalog JSON modules (no learning_modules rows).

create or replace function public.learning_compliance_matrix()
returns table (
  user_id uuid,
  display_name text,
  course_id text,
  course_title text,
  cell_status text,
  completion_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return; end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;

  return query
  with members as (
    select p.id as uid, p.display_name as dn
    from public.profiles p
    where p.organization_id = v_org
  ),
  pub as (
    select c.id as cid, c.title as tl
    from public.learning_courses c
    where c.organization_id = v_org and c.status = 'published'
  ),
  pct as (
    select
      pr.user_id as uid,
      pr.course_id as cid,
      case
        when calc.n_total > 0 then calc.n_done::numeric / calc.n_total::numeric
        else null::numeric
      end as pval
    from public.learning_course_progress pr
    join public.learning_courses co on co.id = pr.course_id and co.organization_id = pr.organization_id
    cross join lateral (
      select
        coalesce((
          select count(*)::int
          from public.learning_modules m
          where m.course_id = pr.course_id and m.organization_id = v_org
        ), 0) as db_n,
        coalesce((
          select count(*)::int
          from public.learning_modules m
          where m.course_id = pr.course_id and m.organization_id = v_org
            and coalesce((pr.module_progress -> (m.id::text) ->> 'completed')::boolean, false)
        ), 0) as db_d
    ) dbx
    cross join lateral (
      select
        case
          when dbx.db_n > 0 then dbx.db_n
          when co.source_system_course_id is not null then coalesce((
            select jsonb_array_length(coalesce(l.modules, '[]'::jsonb))::int
            from public.learning_system_course_locales l
            where l.system_course_id = co.source_system_course_id
              and l.locale = coalesce(
                nullif(trim(co.catalog_locale), ''),
                (select default_locale from public.learning_system_courses s where s.id = co.source_system_course_id limit 1),
                'nb'
              )
            limit 1
          ), 0)
          else 0
        end as n_total,
        case
          when dbx.db_n > 0 then dbx.db_d
          when co.source_system_course_id is not null then coalesce((
            select count(*)::int
            from public.learning_system_course_locales l
            cross join lateral jsonb_array_elements(coalesce(l.modules, '[]'::jsonb)) as e(elem)
            where l.system_course_id = co.source_system_course_id
              and l.locale = coalesce(
                nullif(trim(co.catalog_locale), ''),
                (select default_locale from public.learning_system_courses s where s.id = co.source_system_course_id limit 1),
                'nb'
              )
              and coalesce((pr.module_progress -> (e.elem->>'id') ->> 'completed')::boolean, false)
          ), 0)
          else 0
        end as n_done
    ) calc
    where pr.organization_id = v_org
  )
  select
    m.uid,
    m.dn,
    c.cid,
    c.tl,
    case
      when pc.pval is null then 'not_started'
      when pc.pval >= 1 then 'complete'
      when pc.pval > 0 then 'in_progress'
      else 'not_started'
    end,
    coalesce(pc.pval, 0)
  from members m
  cross join pub c
  left join pct pc on pc.uid = m.uid and pc.cid = c.cid
  order by m.dn, c.tl;
end;
$$;
