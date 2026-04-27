-- amu_compliance_status: legal_refs columns (shape matches app Zod schema)
-- Must DROP+CREATE: CREATE OR REPLACE cannot remove columns from an existing view (42P16).
drop view if exists public.amu_compliance_status cascade;

create view public.amu_compliance_status as
select
  c.id                                                    as committee_id,
  extract(year from now())::int                           as year,

  c.min_meetings_per_year                                 as meetings_required,
  count(m.id) filter (
    where m.year = extract(year from now())::int
      and m.status in ('completed', 'signed')
  )::int                                                  as meetings_held,

  (
    count(*) filter (where mb.side = 'employer' and mb.voting and mb.active)
    =
    count(*) filter (where mb.side = 'employee' and mb.voting and mb.active)
    and
    count(*) filter (where mb.side = 'employer' and mb.voting and mb.active) > 0
  )                                                       as parity_ok,

  exists (
    select 1 from public.amu_members bht
    where bht.committee_id = c.id and bht.side = 'bht' and bht.active
  )                                                       as bht_present,

  not exists (
    select 1 from public.amu_members nm
    where nm.committee_id = c.id
      and nm.voting
      and nm.active
      and (nm.hms_training_valid_until is null
           or nm.hms_training_valid_until < current_date)
  )                                                       as hms_training_all_valid,

  exists (
    select 1 from public.amu_annual_reports ar
    where ar.committee_id = c.id
      and ar.year = extract(year from now())::int - 1
      and ar.status = 'signed'
  )                                                       as annual_report_signed

from public.amu_committees c
left join public.amu_meetings  m  on m.committee_id = c.id
left join public.amu_members   mb on mb.committee_id = c.id
group by c.id, c.min_meetings_per_year;

grant select on public.amu_compliance_status to authenticated;
