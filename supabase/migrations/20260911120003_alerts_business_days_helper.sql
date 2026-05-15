-- Alerts module — business-days helper for AML § 2A-3 acknowledgement SLA.
--
-- AML § 2A-3 says "innen rimelig tid". Regulatory norm + Datatilsynet's
-- veiledning interpret this as 5 *working* days for AML varsel templates.
-- This file ships a generic add_business_days(timestamptz, int) that skips
-- Saturdays, Sundays, and the canonical Norwegian public-holiday set.
--
-- alert_cases_before_insert_defaults() in 20260911120000 calls this helper
-- when available; falls back to calendar days if missing (UNDEFINED_FUNCTION
-- catch — keeps the migration usable on a partial-apply state).
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ── 1. Norwegian public holidays (movable feasts via Easter) ──────────────

create table if not exists public.no_public_holidays (
  holiday_date date primary key,
  label        text not null,
  computed     boolean not null default false,  -- true = derived from Easter
  created_at   timestamptz not null default now()
);

-- Compute Easter Sunday for a given year (Anonymous Gregorian algorithm).
create or replace function public.no_easter_sunday(p_year int)
returns date
language plpgsql
immutable
as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int;
  month int; day int;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  month := (h + l - 7 * m + 114) / 31;
  day := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, month, day);
end;
$$;

-- Seed/refresh holidays for a year. Idempotent (on conflict do nothing).
create or replace function public.no_seed_holidays_for_year(p_year int)
returns void
language plpgsql
as $$
declare
  v_easter date;
begin
  v_easter := public.no_easter_sunday(p_year);

  insert into public.no_public_holidays (holiday_date, label, computed) values
    (make_date(p_year, 1, 1),        'Nyttårsdag',          false),
    (v_easter - interval '3 days',   'Skjærtorsdag',        true),
    (v_easter - interval '2 days',   'Langfredag',          true),
    (v_easter,                       '1. påskedag',         true),
    (v_easter + interval '1 day',    '2. påskedag',         true),
    (make_date(p_year, 5, 1),        'Arbeidernes dag',     false),
    (make_date(p_year, 5, 17),       'Grunnlovsdag',        false),
    (v_easter + interval '39 days',  'Kristi himmelfartsdag', true),
    (v_easter + interval '49 days',  '1. pinsedag',         true),
    (v_easter + interval '50 days',  '2. pinsedag',         true),
    (make_date(p_year, 12, 25),      '1. juledag',          false),
    (make_date(p_year, 12, 26),      '2. juledag',          false)
  on conflict (holiday_date) do nothing;
end;
$$;

-- Seed holidays for current year ± 5 years (covers acknowledgement deadlines
-- + 5-year retention reflection back to past closures).
do $$
declare
  v_year int;
begin
  for v_year in (extract(year from now())::int - 5) .. (extract(year from now())::int + 5) loop
    perform public.no_seed_holidays_for_year(v_year);
  end loop;
end $$;

-- ── 2. add_business_days(ts, days) — skip weekends + Norwegian holidays ────

create or replace function public.add_business_days(p_ts timestamptz, p_days integer)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_remaining int := p_days;
  v_cursor    timestamptz := p_ts;
  v_dow       int;
begin
  if p_days <= 0 then
    return p_ts;
  end if;

  while v_remaining > 0 loop
    v_cursor := v_cursor + interval '1 day';
    v_dow := extract(isodow from v_cursor)::int;   -- 1=Mon ... 7=Sun
    if v_dow < 6
       and not exists (
         select 1 from public.no_public_holidays h
         where h.holiday_date = v_cursor::date
       )
    then
      v_remaining := v_remaining - 1;
    end if;
  end loop;

  return v_cursor;
end;
$$;

revoke all on function public.add_business_days(timestamptz, integer) from public, anon;
grant execute on function public.add_business_days(timestamptz, integer) to authenticated, service_role;
