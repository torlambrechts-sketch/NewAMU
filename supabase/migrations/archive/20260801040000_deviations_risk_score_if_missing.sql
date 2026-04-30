-- Some databases never got archive/20260617140000 (risk matrix on deviations).
-- useAmu selects public.deviations.risk_score — add matrix columns + generated score when missing.

alter table public.deviations
  add column if not exists risk_probability smallint,
  add column if not exists risk_consequence smallint;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deviations'
      and column_name = 'risk_score'
  ) then
    alter table public.deviations
      add column risk_score smallint
      generated always as (
        case
          when risk_probability is not null and risk_consequence is not null
          then risk_probability * risk_consequence
          else null
        end
      ) stored;
  end if;
end;
$$;

-- Optional index (same as legacy): fast high-risk list per org
create index if not exists deviations_risk_score_idx
  on public.deviations (organization_id, risk_score desc nulls last)
  where risk_score is not null;
