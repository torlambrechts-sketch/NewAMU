-- Advanced reporting engine: audit trail, compliance MV, RPC report builders,
-- ARP storage, k-anonymity aggregates, dashboard widget config.
-- Data sources: council_meetings, wiki_*, org_module_payloads (hse, tasks, internal_control, organisation), learning_*, profiles.

-- ---------------------------------------------------------------------------
-- Immutable audit log (append-only via SECURITY DEFINER trigger)
-- ---------------------------------------------------------------------------

create table if not exists public.reporting_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null,
  entity_id text not null default '',
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);

create index if not exists reporting_audit_log_org_idx on public.reporting_audit_log (organization_id, changed_at desc);

alter table public.reporting_audit_log enable row level security;

drop policy if exists "reporting_audit_log_select_org" on public.reporting_audit_log;
create policy "reporting_audit_log_select_org"
  on public.reporting_audit_log for select
  using (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- ARP (Aktivitets- og redegjørelsesplikten)
-- ---------------------------------------------------------------------------

create table if not exists public.reporting_arp_snapshots (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reporting_year int not null,
  metrics jsonb not null default '{}'::jsonb,
  narrative jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (organization_id, reporting_year)
);

create index if not exists reporting_arp_org_year_idx on public.reporting_arp_snapshots (organization_id, reporting_year desc);

alter table public.reporting_arp_snapshots enable row level security;

drop policy if exists "reporting_arp_select_org" on public.reporting_arp_snapshots;
create policy "reporting_arp_select_org"
  on public.reporting_arp_snapshots for select
  using (organization_id = public.current_org_id());

drop policy if exists "reporting_arp_write_admin" on public.reporting_arp_snapshots;
create policy "reporting_arp_write_admin"
  on public.reporting_arp_snapshots for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('reports.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('reports.manage'))
  );

-- ---------------------------------------------------------------------------
-- Dashboard widget layouts
-- ---------------------------------------------------------------------------

create table if not exists public.reporting_dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null default 'Standard',
  widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, name)
);

create index if not exists reporting_dash_layout_org_idx on public.reporting_dashboard_layouts (organization_id);

alter table public.reporting_dashboard_layouts enable row level security;

drop policy if exists "reporting_dash_select_org" on public.reporting_dashboard_layouts;
create policy "reporting_dash_select_org"
  on public.reporting_dashboard_layouts for select
  using (
    organization_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists "reporting_dash_write_own_or_admin" on public.reporting_dashboard_layouts;
create policy "reporting_dash_write_own_or_admin"
  on public.reporting_dashboard_layouts for insert
  with check (
    organization_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists "reporting_dash_update_own_or_admin" on public.reporting_dashboard_layouts;
create policy "reporting_dash_update_own_or_admin"
  on public.reporting_dashboard_layouts for update
  using (
    organization_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists "reporting_dash_delete_own_or_admin" on public.reporting_dashboard_layouts;
create policy "reporting_dash_delete_own_or_admin"
  on public.reporting_dashboard_layouts for delete
  using (
    organization_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid() or public.is_org_admin())
  );

drop trigger if exists reporting_dash_set_updated_at on public.reporting_dashboard_layouts;
create trigger reporting_dash_set_updated_at
  before update on public.reporting_dashboard_layouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permission: reports.manage (attach to admin roles in existing orgs)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'reports.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Trigger: audit org_module_payloads changes
-- ---------------------------------------------------------------------------

create or replace function public.reporting_log_org_module_payload_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.reporting_audit_log (organization_id, entity_type, entity_id, action, changed_by, old_row, new_row)
    values (old.organization_id, 'org_module_payload', old.module_key, 'DELETE', auth.uid(), to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.reporting_audit_log (organization_id, entity_type, entity_id, action, changed_by, old_row, new_row)
    values (new.organization_id, 'org_module_payload', new.module_key, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.reporting_audit_log (organization_id, entity_type, entity_id, action, changed_by, old_row, new_row)
    values (new.organization_id, 'org_module_payload', new.module_key, 'INSERT', auth.uid(), null, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists reporting_audit_org_module_payload on public.org_module_payloads;
create trigger reporting_audit_org_module_payload
  after insert or update or delete on public.org_module_payloads
  for each row execute function public.reporting_log_org_module_payload_change();

-- ---------------------------------------------------------------------------
-- Materialized view: compliance health score
-- ---------------------------------------------------------------------------

drop materialized view if exists public.reporting_compliance_score_mv;

create materialized view public.reporting_compliance_score_mv as
select
  o.organization_id,
  now() as computed_at,
  least(100::numeric, greatest(0::numeric,
    50::numeric
    + 10 * coalesce((
        select case when count(*) filter (where coalesce(elem->>'status', '') = 'done') >= greatest(count(*) * 0.5, 1) then 1 else 0 end
        from public.org_module_payloads p,
          lateral jsonb_array_elements(coalesce(p.payload->'tasks', '[]'::jsonb)) elem
        where p.organization_id = o.organization_id and p.module_key = 'tasks'
        limit 1
      ), 0)
    + 10 * coalesce((
        select case when count(*) >= 1 then 1 else 0 end
        from public.org_module_payloads p,
          lateral jsonb_array_elements(coalesce(p.payload->'safetyRounds', '[]'::jsonb)) elem
        where p.organization_id = o.organization_id and p.module_key = 'hse'
          and (elem->>'conductedAt')::date > (current_date - interval '365 days')
      ), 0)
    + 10 * coalesce((
        select case when count(*) >= 1 then 1 else 0 end
        from public.org_module_payloads p,
          lateral jsonb_array_elements(coalesce(p.payload->'rosAssessments', '[]'::jsonb)) elem
        where p.organization_id = o.organization_id and p.module_key = 'internal_control'
          and coalesce((elem->>'locked')::boolean, false) = true
      ), 0)
  )) as score
from (select distinct organization_id from public.org_module_payloads) o;

create unique index reporting_compliance_score_mv_org_uidx
  on public.reporting_compliance_score_mv (organization_id);

create or replace function public.reporting_refresh_compliance_score()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Not CONCURRENTLY — compatible with migration transactions; use nightly job for production
  refresh materialized view public.reporting_compliance_score_mv;
end;
$$;

grant execute on function public.reporting_refresh_compliance_score() to authenticated;

-- ---------------------------------------------------------------------------
-- Year bounds helper
-- ---------------------------------------------------------------------------

create or replace function public._reporting_year_bounds(p_year int)
returns table (y_start timestamptz, y_end timestamptz)
language sql
immutable
as $$
  select make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC'),
         make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
$$;

-- ---------------------------------------------------------------------------
-- RPC: AMU annual report
-- ---------------------------------------------------------------------------

create or replace function public.reporting_amu_annual_report(p_org_id uuid, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  y0 timestamptz;
  y1 timestamptz;
  meetings jsonb := '[]'::jsonb;
  incidents jsonb := '{}'::jsonb;
  sick jsonb := '{}'::jsonb;
  training jsonb := '{}'::jsonb;
  tasks jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select t.y_start, t.y_end into y0, y1 from public._reporting_year_bounds(p_year) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cm.id,
    'title', cm.payload->>'title',
    'startsAt', cm.payload->>'startsAt',
    'status', cm.payload->>'status',
    'attendees', cm.payload->'attendees'
  )), '[]'::jsonb)
  into meetings
  from public.council_meetings cm
  where cm.organization_id = p_org_id
    and nullif(cm.payload->>'startsAt', '') is not null
    and (cm.payload->>'startsAt')::timestamptz >= y0
    and (cm.payload->>'startsAt')::timestamptz < y1;

  select coalesce(jsonb_object_agg(coalesce(sev, 'unknown'), cnt), '{}'::jsonb)
  into incidents
  from (
    select elem->>'severity' as sev, count(*)::int as cnt
    from public.org_module_payloads p,
      lateral jsonb_array_elements(coalesce(p.payload->'incidents', '[]'::jsonb)) elem
    where p.organization_id = p_org_id and p.module_key = 'hse'
      and nullif(elem->>'occurredAt', '') is not null
      and (elem->>'occurredAt')::timestamptz >= y0
      and (elem->>'occurredAt')::timestamptz < y1
    group by 1
  ) s;

  select coalesce(jsonb_build_object(
    'totalCases', count(*) filter (where c),
    'shortTermPct', case when count(*) filter (where c) > 0
      then round(100.0 * count(*) filter (where c and short_term) / count(*) filter (where c), 1)
      else null end,
    'longTermPct', case when count(*) filter (where c) > 0
      then round(100.0 * count(*) filter (where c and not short_term) / count(*) filter (where c), 1)
      else null end
  ), '{}'::jsonb)
  into sick
  from (
    select
      true as c,
      extract(day from (
        coalesce(nullif(elem->>'returnDate', '')::date, (elem->>'sickFrom')::date + 20)
        - (elem->>'sickFrom')::date
      )) < 16 as short_term
    from public.org_module_payloads p,
      lateral jsonb_array_elements(coalesce(p.payload->'sickLeaveCases', '[]'::jsonb)) elem
    where p.organization_id = p_org_id and p.module_key = 'hse'
      and nullif(elem->>'sickFrom', '') is not null
      and (elem->>'sickFrom')::date >= y0::date
      and (elem->>'sickFrom')::date < y1::date
  ) x;

  select jsonb_build_object(
    'certificatesIssued', (
      select count(*)::int from public.learning_certificates c
      where c.organization_id = p_org_id and c.issued_at >= y0 and c.issued_at < y1
    ),
    'sampleTitles', coalesce((
      select jsonb_agg(q.t order by q.t)
      from (
        select distinct c2.course_title as t
        from public.learning_certificates c2
        where c2.organization_id = p_org_id and c2.issued_at >= y0 and c2.issued_at < y1
          and c2.course_title is not null
        limit 12
      ) q
    ), '[]'::jsonb)
  )
  into training;

  select coalesce(jsonb_build_object(
    'open', count(*) filter (where coalesce(elem->>'status', '') <> 'done'),
    'closed', count(*) filter (where coalesce(elem->>'status', '') = 'done')
  ), '{}'::jsonb)
  into tasks
  from public.org_module_payloads p,
    lateral jsonb_array_elements(coalesce(p.payload->'tasks', '[]'::jsonb)) elem
  where p.organization_id = p_org_id and p.module_key = 'tasks';

  return jsonb_build_object(
    'report', 'amu_annual',
    'organizationId', p_org_id,
    'year', p_year,
    'generatedAt', now(),
    'meetings', meetings,
    'incidentsBySeverity', incidents,
    'sickLeaveSummary', sick,
    'mandatoryTraining', training,
    'kanbanActions', tasks
  );
end;
$$;

grant execute on function public.reporting_amu_annual_report(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Annual review IK (§ 5.8)
-- ---------------------------------------------------------------------------

create or replace function public.reporting_annual_review_ik(p_org_id uuid, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  y0 timestamptz;
  y1 timestamptz;
  wiki_goals jsonb := '[]'::jsonb;
  versions jsonb := '[]'::jsonb;
  rounds jsonb := '{}'::jsonb;
  ros jsonb := '[]'::jsonb;
  annual jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select t.y_start, t.y_end into y0, y1 from public._reporting_year_bounds(p_year) t;

  select coalesce(jsonb_agg(x.obj order by x.ord desc), '[]'::jsonb)
  into wiki_goals
  from (
    select jsonb_build_object(
      'pageId', wp.id,
      'title', wp.title,
      'nextRevisionDueAt', wp.next_revision_due_at,
      'status', wp.status
    ) as obj,
    wp.updated_at as ord
    from public.wiki_pages wp
    join public.wiki_spaces ws on ws.id = wp.space_id
    where ws.organization_id = p_org_id
      and wp.organization_id = p_org_id
      and wp.status = 'published'
    limit 200
  ) x;

  select coalesce(jsonb_agg(x.obj order by x.frozen desc), '[]'::jsonb)
  into versions
  from (
    select jsonb_build_object(
      'pageId', v.page_id,
      'version', v.version,
      'frozenAt', v.frozen_at
    ) as obj,
    v.frozen_at as frozen
    from public.wiki_page_versions v
    where v.organization_id = p_org_id
      and v.frozen_at >= y0 and v.frozen_at < y1
    order by v.frozen_at desc
    limit 50
  ) x;

  select coalesce(jsonb_build_object(
    'roundsInYear', coalesce(count(*), 0)::int,
    'roundsWithIssues', coalesce(count(*) filter (where issue_cnt > 0), 0)::int,
    'avgIssuesPerRound', case when count(*) > 0
      then round(sum(issue_cnt)::numeric / count(*)::numeric, 2) else null end
  ), '{}'::jsonb)
  into rounds
  from (
    select
      (select count(*)::int from jsonb_each(coalesce(elem->'itemDetails', '{}'::jsonb))) as issue_cnt
    from public.org_module_payloads p,
      lateral jsonb_array_elements(coalesce(p.payload->'safetyRounds', '[]'::jsonb)) elem
    where p.organization_id = p_org_id and p.module_key = 'hse'
      and nullif(elem->>'conductedAt', '') is not null
      and (elem->>'conductedAt')::date >= y0::date
      and (elem->>'conductedAt')::date < y1::date
  ) z;

  select coalesce(jsonb_agg(x.obj), '[]'::jsonb)
  into ros
  from (
    select jsonb_build_object(
      'id', elem->>'id',
      'title', elem->>'title',
      'locked', coalesce((elem->>'locked')::boolean, false),
      'residualRiskBand', (
        select case
          when max(coalesce((r->>'residualScore')::numeric, (r->>'riskScore')::numeric, 0)) >= 15 then 'red'
          when max(coalesce((r->>'residualScore')::numeric, (r->>'riskScore')::numeric, 0)) >= 6 then 'yellow'
          else 'green'
        end
        from jsonb_array_elements(coalesce(elem->'rows', '[]'::jsonb)) r
      )
    ) as obj
    from public.org_module_payloads p,
      lateral jsonb_array_elements(coalesce(p.payload->'rosAssessments', '[]'::jsonb)) elem
    where p.organization_id = p_org_id and p.module_key = 'internal_control'
  ) x;

  select coalesce(jsonb_agg(elem order by (elem->>'year')::int desc), '[]'::jsonb)
  into annual
  from public.org_module_payloads p,
    lateral jsonb_array_elements(coalesce(p.payload->'annualReviews', '[]'::jsonb)) elem
  where p.organization_id = p_org_id and p.module_key = 'internal_control'
    and (elem->>'year')::int = p_year - 1;

  return jsonb_build_object(
    'report', 'annual_review_ik',
    'organizationId', p_org_id,
    'year', p_year,
    'generatedAt', now(),
    'hmsGoalsFromWiki', wiki_goals,
    'policyVersionsInYear', versions,
    'safetyRoundsSummary', rounds,
    'rosAssessments', ros,
    'priorYearAnnualReview', annual,
    'nextYearGoalsPlaceholder', ''
  );
end;
$$;

grant execute on function public.reporting_annual_review_ik(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: ARP metrics + optional org chart (JSON from organisation payload)
-- ---------------------------------------------------------------------------

create or replace function public.reporting_arp_metrics(p_org_id uuid, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  org_payload jsonb;
  employees jsonb;
  female int := 0;
  male int := 0;
  unknown int := 0;
  leader_female int := 0;
  leader_male int := 0;
  role text;
  gender text;
  salary_f numeric;
  salary_m numeric;
  by_cat jsonb := '{}'::jsonb;
  salr record;
  emp jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select p.payload->'employees' into org_payload
  from public.org_module_payloads p
  where p.organization_id = p_org_id and p.module_key = 'organisation'
  limit 1;

  employees := coalesce(org_payload, '[]'::jsonb);

  for emp in select jsonb_array_elements(employees)
  loop
    role := lower(coalesce(emp->>'role', ''));
    gender := lower(coalesce(emp->>'gender', ''));
    if gender in ('female', 'f', 'kvinne', 'k') then
      female := female + 1;
      if strpos(role, 'leder') > 0 or role like '%leader%' then
        leader_female := leader_female + 1;
      end if;
    elsif gender in ('male', 'm', 'mann') then
      male := male + 1;
      if strpos(role, 'leder') > 0 or role like '%leader%' then
        leader_male := leader_male + 1;
      end if;
    else
      unknown := unknown + 1;
    end if;
  end loop;

  -- Salary gap by category (optional fields on org chart employees)
  for salr in
    select
      coalesce(nullif(emp->>'salaryCategory', ''), 'Ukjent') as c,
      sum(case when lower(coalesce(emp->>'gender', '')) in ('female', 'f', 'kvinne', 'k') then (emp->>'annualSalaryNok')::numeric else null end) as sf,
      sum(case when lower(coalesce(emp->>'gender', '')) in ('male', 'm', 'mann') then (emp->>'annualSalaryNok')::numeric else null end) as sm,
      count(*) filter (where lower(coalesce(emp->>'gender', '')) in ('female', 'f', 'kvinne', 'k') and (emp->>'annualSalaryNok') is not null) as cf,
      count(*) filter (where lower(coalesce(emp->>'gender', '')) in ('male', 'm', 'mann') and (emp->>'annualSalaryNok') is not null) as cm
    from jsonb_array_elements(employees) emp
    group by 1
  loop
    salary_f := case when salr.cf > 0 then salr.sf / salr.cf else null end;
    salary_m := case when salr.cm > 0 then salr.sm / salr.cm else null end;
    by_cat := by_cat || jsonb_build_object(
      salr.c,
      jsonb_build_object(
        'avgSalaryFemaleNok', salary_f,
        'avgSalaryMaleNok', salary_m,
        'femaleShareOfMaleSalaryPct', case
          when salary_m is not null and salary_m > 0 and salary_f is not null
          then round(100.0 * salary_f / salary_m, 1)
          else null
        end,
        'headcountFemale', salr.cf,
        'headcountMale', salr.cm
      )
    );
  end loop;

  return jsonb_build_object(
    'report', 'arp',
    'organizationId', p_org_id,
    'year', p_year,
    'generatedAt', now(),
    'genderTotals', jsonb_build_object(
      'female', female,
      'male', male,
      'unknown', unknown,
      'leaderFemale', leader_female,
      'leaderMale', leader_male
    ),
    'salaryGapByCategory', by_cat,
    'parentalLeave', jsonb_build_object(
      'avgDaysFemale', (
        select round(avg((e->>'parentalLeaveDays')::numeric), 1)
        from jsonb_array_elements(employees) e
        where lower(coalesce(e->>'gender', '')) in ('female', 'f', 'kvinne', 'k')
          and e->>'parentalLeaveDays' is not null
      ),
      'avgDaysMale', (
        select round(avg((e->>'parentalLeaveDays')::numeric), 1)
        from jsonb_array_elements(employees) e
        where lower(coalesce(e->>'gender', '')) in ('male', 'm', 'mann')
          and e->>'parentalLeaveDays' is not null
      )
    ),
    'narrativeFields', jsonb_build_object(
      'antiDiscriminationMeasures', 'Fyll inn i ARP-redigering (lagres i reporting_arp_snapshots.narrative).'
    )
  );
end;
$$;

grant execute on function public.reporting_arp_metrics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Sick leave by department — k-anonymity (min 5 employees or empty)
-- ---------------------------------------------------------------------------

create or replace function public.reporting_sick_leave_by_department(p_org_id uuid, p_year int, p_min_headcount int default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  y0 timestamptz;
  y1 timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select t.y_start, t.y_end into y0, y1 from public._reporting_year_bounds(p_year) t;

  return (
    with headcount as (
      select coalesce(nullif(emp->>'department', ''), 'Ukjent') as dept, count(*)::int as cnt
      from public.org_module_payloads p,
        lateral jsonb_array_elements(coalesce(p.payload->'employees', '[]'::jsonb)) emp
      where p.organization_id = p_org_id and p.module_key = 'organisation'
      group by 1
    ),
    sick as (
      select
        coalesce(nullif(elem->>'department', ''), 'Ukjent') as department,
        count(*)::int as sick_leave_cases,
        round(avg(extract(day from (
          coalesce(nullif(elem->>'returnDate', '')::date, (elem->>'sickFrom')::date + 20)
          - (elem->>'sickFrom')::date
        ))), 1) as avg_duration_days
      from public.org_module_payloads p,
        lateral jsonb_array_elements(coalesce(p.payload->'sickLeaveCases', '[]'::jsonb)) elem
      where p.organization_id = p_org_id and p.module_key = 'hse'
        and nullif(elem->>'sickFrom', '') is not null
        and (elem->>'sickFrom')::date >= y0::date
        and (elem->>'sickFrom')::date < y1::date
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'department', s.department,
      'sickLeaveCases', s.sick_leave_cases,
      'avgDurationDays', s.avg_duration_days,
      'departmentHeadcount', h.cnt
    )), '[]'::jsonb)
    from sick s
    left join headcount h on h.dept = s.department
    where coalesce(h.cnt, 0) >= p_min_headcount
  );
end;
$$;

grant execute on function public.reporting_sick_leave_by_department(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Training vs incidents correlation (production departments)
-- ---------------------------------------------------------------------------

create or replace function public.reporting_training_incident_correlation(p_org_id uuid, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  y0 timestamptz;
  y1 timestamptz;
  prod_depts text[] := array['Drift og produksjon', 'Produksjon', 'produksjon'];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select t.y_start, t.y_end into y0, y1 from public._reporting_year_bounds(p_year) t;

  return jsonb_build_object(
    'report', 'training_incident_correlation',
    'organizationId', p_org_id,
    'year', p_year,
    'productionDepartmentsMatched', prod_depts,
    'incidentsInProduction', (
      select count(*)::int
      from public.org_module_payloads p,
        lateral jsonb_array_elements(coalesce(p.payload->'incidents', '[]'::jsonb)) elem
      where p.organization_id = p_org_id and p.module_key = 'hse'
        and nullif(elem->>'occurredAt', '') is not null
        and (elem->>'occurredAt')::timestamptz >= y0
        and (elem->>'occurredAt')::timestamptz < y1
        and (
          elem->>'department' = any (prod_depts)
          or lower(elem->>'department') like '%produksjon%'
        )
    ),
    'trainingRecordsTaggedProduction', (
      select count(*)::int
      from public.org_module_payloads p,
        lateral jsonb_array_elements(coalesce(p.payload->'trainingRecords', '[]'::jsonb)) elem
      where p.organization_id = p_org_id and p.module_key = 'hse'
        and (
          elem->>'department' = any (prod_depts)
          or lower(coalesce(elem->>'department', '')) like '%produksjon%'
        )
    ),
    'note', 'Korrelasjon er illustrativ — begge tall hentes fra HSE JSON-modulen for valgte år.'
  );
end;
$$;

grant execute on function public.reporting_training_incident_correlation(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Cost of friction (hours lost × hourly rate from cost_settings payload)
-- ---------------------------------------------------------------------------

create or replace function public.reporting_cost_of_friction(p_org_id uuid, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  y0 timestamptz;
  y1 timestamptz;
  hourly numeric := 650;
  hours_per_day numeric := 7.5;
  enabled boolean := true;
  sick_days numeric := 0;
  incident_days numeric := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select t.y_start, t.y_end into y0, y1 from public._reporting_year_bounds(p_year) t;

  select
    coalesce((p.payload->>'hourlyRateNok')::numeric, 650),
    coalesce((p.payload->>'hoursPerDay')::numeric, 7.5),
    coalesce((p.payload->>'enabled')::boolean, true)
  into hourly, hours_per_day, enabled
  from public.org_module_payloads p
  where p.organization_id = p_org_id and p.module_key = 'cost_settings'
  limit 1;

  select coalesce(sum(
    extract(day from (
      coalesce(nullif(elem->>'returnDate', '')::date, (elem->>'sickFrom')::date + 20)
      - (elem->>'sickFrom')::date
    ))
  ), 0)
  into sick_days
  from public.org_module_payloads p,
    lateral jsonb_array_elements(coalesce(p.payload->'sickLeaveCases', '[]'::jsonb)) elem
  where p.organization_id = p_org_id and p.module_key = 'hse'
    and nullif(elem->>'sickFrom', '') is not null
    and (elem->>'sickFrom')::date >= y0::date
    and (elem->>'sickFrom')::date < y1::date;

  select coalesce(count(*)::numeric * 0.5, 0)
  into incident_days
  from public.org_module_payloads p,
    lateral jsonb_array_elements(coalesce(p.payload->'incidents', '[]'::jsonb)) elem
  where p.organization_id = p_org_id and p.module_key = 'hse'
    and nullif(elem->>'occurredAt', '') is not null
    and (elem->>'occurredAt')::timestamptz >= y0
    and (elem->>'occurredAt')::timestamptz < y1;

  return jsonb_build_object(
    'report', 'cost_of_friction',
    'organizationId', p_org_id,
    'year', p_year,
    'settings', jsonb_build_object('hourlyRateNok', hourly, 'hoursPerDay', hours_per_day, 'enabled', enabled),
    'estimatedSickLeaveDays', round(sick_days, 1),
    'illustrativeIncidentDowntimeDays', round(incident_days, 1),
    'estimatedCostNok', case when enabled then round((sick_days + incident_days) * hours_per_day * hourly, 0) else null end,
    'note', 'Hendelsesdager er illustrativt (0,5 dag per registrert hendelse). Juster i modul eller egen kalkyle.'
  );
end;
$$;

grant execute on function public.reporting_cost_of_friction(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Compliance score from MV
-- ---------------------------------------------------------------------------

create or replace function public.reporting_compliance_score(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  sc numeric;
  ts timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;

  select m.score, m.computed_at into sc, ts
  from public.reporting_compliance_score_mv m
  where m.organization_id = p_org_id;

  return jsonb_build_object(
    'organizationId', p_org_id,
    'score', sc,
    'computedAt', ts,
    'hint', 'Kjør reporting_refresh_compliance_score() etter større dataendringer (eller nattlig jobb).'
  );
end;
$$;

grant execute on function public.reporting_compliance_score(uuid) to authenticated;
