-- Flow-of-work hooks, spaced repetition reviews, streaks, department link, automation settings.

-- ---------------------------------------------------------------------------
-- Optional: link profile to a department (for department leaderboards)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists profiles_department_idx on public.profiles (department_id)
  where department_id is not null;

-- ---------------------------------------------------------------------------
-- Assignments (incident-triggered micro-learning; email sent via external job)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_module_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assigned_to_user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null references public.learning_courses (id) on delete cascade,
  module_id text,
  reason text,
  source text default 'manual',
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists learning_assignments_org_idx on public.learning_module_assignments (organization_id);
create index if not exists learning_assignments_user_idx on public.learning_module_assignments (assigned_to_user_id);

-- ---------------------------------------------------------------------------
-- Spaced repetition: failed quiz questions → resurface on dashboard after N days
-- ---------------------------------------------------------------------------

create table if not exists public.learning_quiz_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  module_id text not null,
  question_id text not null,
  review_at timestamptz not null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id, module_id, question_id)
);

create index if not exists learning_quiz_reviews_user_due_idx
  on public.learning_quiz_reviews (user_id, review_at)
  where dismissed_at is null;

-- ---------------------------------------------------------------------------
-- Weekly learning streak (corporate-friendly)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_streaks (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  streak_weeks int not null default 0,
  last_activity_week_start date,
  primary key (user_id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Org automation settings (webhooks for Teams/Slack — app sends HTTP from Edge/cron)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_flow_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  teams_webhook_url text,
  slack_webhook_url text,
  generic_webhook_url text,
  updated_at timestamptz not null default now()
);

drop trigger if exists learning_flow_settings_updated on public.learning_flow_settings;
create trigger learning_flow_settings_updated
  before update on public.learning_flow_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Course prerequisites (unlock expert content after foundation courses)
-- ---------------------------------------------------------------------------

alter table public.learning_courses
  add column if not exists prerequisite_course_ids text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.learning_module_assignments enable row level security;
alter table public.learning_quiz_reviews enable row level security;
alter table public.learning_streaks enable row level security;
alter table public.learning_flow_settings enable row level security;

create policy "learning_assignments_select_own_or_manage"
  on public.learning_module_assignments for select
  using (
    organization_id = public.current_org_id()
    and (
      assigned_to_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

create policy "learning_assignments_insert_manage"
  on public.learning_module_assignments for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_quiz_reviews_select_own"
  on public.learning_quiz_reviews for select
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_quiz_reviews_insert_own"
  on public.learning_quiz_reviews for insert
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_quiz_reviews_update_own"
  on public.learning_quiz_reviews for update
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_quiz_reviews_delete_own"
  on public.learning_quiz_reviews for delete
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_streaks_select_own"
  on public.learning_streaks for select
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_streaks_insert_own"
  on public.learning_streaks for insert
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_streaks_update_own"
  on public.learning_streaks for update
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_flow_settings_select_member"
  on public.learning_flow_settings for select
  using (organization_id = public.current_org_id());

create policy "learning_flow_settings_write_manage"
  on public.learning_flow_settings for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_flow_settings_update_manage"
  on public.learning_flow_settings for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- ---------------------------------------------------------------------------
-- Bump streak on learning activity (call from client after module complete)
-- ---------------------------------------------------------------------------

create or replace function public.learning_record_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
  v_week_start date;
  v_prev_week date;
  v_row public.learning_streaks%rowtype;
begin
  if v_uid is null then return; end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then return; end if;
  v_week_start := (date_trunc('week', (now() at time zone 'utc'))::date);
  v_prev_week := v_week_start - 7;

  select * into v_row from public.learning_streaks where user_id = v_uid and organization_id = v_org;
  if not found then
    insert into public.learning_streaks (user_id, organization_id, streak_weeks, last_activity_week_start)
    values (v_uid, v_org, 1, v_week_start);
    return;
  end if;

  if v_row.last_activity_week_start = v_week_start then
    return;
  end if;

  if v_row.last_activity_week_start = v_prev_week then
    update public.learning_streaks
    set streak_weeks = streak_weeks + 1, last_activity_week_start = v_week_start
    where user_id = v_uid and organization_id = v_org;
  else
    update public.learning_streaks
    set streak_weeks = 1, last_activity_week_start = v_week_start
    where user_id = v_uid and organization_id = v_org;
  end if;
end;
$$;

grant execute on function public.learning_record_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- Department leaderboard: avg completion across published courses (org members with department)
-- ---------------------------------------------------------------------------

create or replace function public.learning_department_leaderboard()
returns table (
  department_id uuid,
  department_name text,
  member_count bigint,
  avg_completion_pct numeric
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
  if v_org is null then
    return;
  end if;

  return query
  with pub as (
    select c.id as cid from public.learning_courses c
    where c.organization_id = v_org and c.status = 'published'
  ),
  course_progress_pct as (
    select
      p.user_id,
      p.course_id,
      case
        when exists (
          select 1 from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
        ) then (
          select count(*)::numeric from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
            and coalesce((p.module_progress -> (m.id::text) ->> 'completed')::boolean, false)
        ) / nullif((
          select count(*)::numeric from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
        ), 0)
        else (
          select count(*)::numeric from jsonb_each(p.module_progress) e
          where coalesce((e.value->>'completed')::boolean, false)
        ) / nullif((
          select jsonb_array_length(l.modules)
          from public.learning_courses c2
          join public.learning_system_course_locales l
            on l.system_course_id = c2.source_system_course_id
           and l.locale = coalesce(c2.catalog_locale, 'nb')
          where c2.id = p.course_id and c2.organization_id = v_org
          limit 1
        ), 0)
      end as pct
    from public.learning_course_progress p
    where p.organization_id = v_org
  ),
  user_course_avg as (
    select
      pr.user_id,
      avg(pr.pct) filter (where pr.course_id in (select cid from pub)) as avgp
    from course_progress_pct pr
    group by pr.user_id
  ),
  dept_agg as (
    select
      p.department_id as did,
      count(*)::bigint as mc,
      coalesce(avg(u.avgp), 0)::numeric as av
    from public.profiles p
    left join user_course_avg u on u.user_id = p.id
    where p.organization_id = v_org and p.department_id is not null
    group by p.department_id
  )
  select d.id, d.name, da.mc, round(da.av * 100, 1)
  from public.departments d
  join dept_agg da on da.did = d.id
  where d.organization_id = v_org
  order by da.av desc nulls last;
end;
$$;

grant execute on function public.learning_department_leaderboard() to authenticated;

-- Assign a micro-module from automation (e.g. HSE incident). Email is sent by app/Edge using returned deep link.
create or replace function public.learning_assign_module(
  p_user_id uuid,
  p_course_id text,
  p_module_id text default null,
  p_reason text default null,
  p_source text default 'incident'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and organization_id = v_org) then
    raise exception 'User not in organization';
  end if;
  if not exists (select 1 from public.learning_courses where id = p_course_id and organization_id = v_org) then
    raise exception 'Course not found';
  end if;

  insert into public.learning_module_assignments (
    organization_id, assigned_to_user_id, course_id, module_id, reason, source, created_by
  ) values (
    v_org, p_user_id, p_course_id, p_module_id, p_reason, coalesce(p_source, 'incident'), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.learning_assign_module(uuid, text, text, text, text) to authenticated;
