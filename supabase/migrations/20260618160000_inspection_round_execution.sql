-- Adds execution metadata to inspection_rounds so inspectors can record
-- who conducted the round, when, and write the mandatory written protocol
-- required by Internkontrollforskriften § 5.

alter table public.inspection_rounds
  add column if not exists summary text,
  add column if not exists conducted_by uuid references auth.users (id) on delete set null,
  add column if not exists conducted_at timestamptz;
