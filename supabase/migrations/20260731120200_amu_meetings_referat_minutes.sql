-- AMU: utkast til referat, møteleder og møteleders signatur
alter table public.amu_meetings
  add column if not exists minutes_draft text;
alter table public.amu_meetings
  add column if not exists meeting_chair_user_id uuid references auth.users (id) on delete set null;
alter table public.amu_meetings
  add column if not exists chair_signed_at timestamptz;
