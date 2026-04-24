-- Fix PL/pgSQL: FOR over single-column SELECT must use a scalar loop variable (jsonb), not record.

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
