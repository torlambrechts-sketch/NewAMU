-- GPS stamp on inspection rounds (field evidence / location traceability).

alter table public.inspection_rounds
  add column if not exists gps_lat double precision,
  add column if not exists gps_lon double precision,
  add column if not exists gps_accuracy_m double precision,
  add column if not exists gps_stamped_at timestamptz;
