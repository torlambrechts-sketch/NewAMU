-- AMU redesign — reporting views (depends on 20260801000000_amu_redesign_tables.sql)

create or replace view public.amu_compliance_status as
select
  c.id                                                    as committee_id,
  c.organization_id,
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
group by c.id, c.organization_id, c.min_meetings_per_year;

create or replace view public.amu_meeting_summary as
select
  m.*,
  count(distinct ai.id)                                   as agenda_item_count,
  count(distinct ai.id) filter (where ai.status = 'decided') as decided_count,
  count(distinct at2.id)                                  as attendee_count,
  count(distinct at2.id) filter (where at2.status = 'present') as present_count,
  count(distinct d.id)                                    as decision_count
from public.amu_meetings m
left join public.amu_agenda_items ai on ai.meeting_id = m.id
left join public.amu_attendance   at2 on at2.meeting_id = m.id
left join public.amu_decisions    d  on d.agenda_item_id = ai.id
group by m.id;

create or replace view public.amu_critical_queue as

select
  'unsigned_meeting'          as item_type,
  m.id                        as source_id,
  m.organization_id,
  m.title                     as label,
  m.completed_at              as source_date,
  'high'                      as severity
from public.amu_meetings m
where m.status = 'completed'
  and m.signed_at is null
  and (now() - coalesce(m.completed_at, m.updated_at)) > interval '14 days'

union all

select
  'draft_annual_report',
  ar.id,
  ar.organization_id,
  ('Årsrapport ' || ar.year)::text,
  ar.created_at,
  'high'
from public.amu_annual_reports ar
where ar.status = 'draft'
  and ar.year < extract(year from now())::int

union all

select
  'missing_meeting',
  c.id,
  c.organization_id,
  ('Mangler møte ' || (c.min_meetings_per_year - coalesce(held.cnt, 0)) || ' av ' || c.min_meetings_per_year)::text,
  now(),
  'medium'
from public.amu_committees c
left join (
  select committee_id, count(*) as cnt
  from public.amu_meetings
  where year = extract(year from now())::int
    and status in ('completed', 'signed')
  group by committee_id
) held on held.committee_id = c.id
where coalesce(held.cnt, 0) < c.min_meetings_per_year

union all

select
  'hms_training_expired',
  mb.id,
  mb.organization_id,
  (mb.display_name || ' — HMS-kurs utløpt')::text,
  mb.hms_training_valid_until::timestamptz,
  'high'
from public.amu_members mb
where mb.voting
  and mb.active
  and (mb.hms_training_valid_until is null
       or mb.hms_training_valid_until < current_date);

grant select on public.amu_compliance_status to authenticated;
grant select on public.amu_meeting_summary to authenticated;
grant select on public.amu_critical_queue to authenticated;
