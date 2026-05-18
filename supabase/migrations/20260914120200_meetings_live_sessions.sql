-- Meetings · live-room session state + speaker queue (L1 + L13).
--
-- Why
--   The live meeting room needs ephemeral session state separate from the
--   permanent record: which agenda item is being discussed now, elapsed
--   timer, who's in the speaker queue. This data is born+dies inside the
--   meeting window; we keep a single row per meeting that the chair
--   updates as the meeting progresses.
--
--   Speaker queue is a child table — append + drain pattern. given_floor_at
--   marks when the chair handed the speaker the floor.
--
-- Self-audit (Arbeidstilsynet POV)
--   Forskrift om org. ledelse § 3-16 — referatkrav. The session state
--   doesn't itself add legal obligation; the timestamps and speaker order
--   it captures end up in the protokoll for transparent record-keeping.

set local search_path = public, pg_catalog;

create table if not exists public.meeting_live_sessions (
  meeting_id           uuid primary key references public.meetings(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  active_agenda_item_id uuid references public.meeting_agenda_items(id) on delete set null,
  elapsed_seconds      integer not null default 0,
  paused               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists meeting_live_sessions_active_idx
  on public.meeting_live_sessions (organization_id)
  where ended_at is null;

comment on table public.meeting_live_sessions is
  'Ephemeral live-room state per meeting: which sak is active, elapsed timer, paused flag. One row per meeting; ended_at set when chair clicks "Avslutt møte".';

alter table public.meeting_live_sessions enable row level security;

drop policy if exists meeting_live_sessions_select on public.meeting_live_sessions;
create policy meeting_live_sessions_select
  on public.meeting_live_sessions
  for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists meeting_live_sessions_write on public.meeting_live_sessions;
create policy meeting_live_sessions_write
  on public.meeting_live_sessions
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop trigger if exists meeting_live_sessions_set_updated_at on public.meeting_live_sessions;
create trigger meeting_live_sessions_set_updated_at
  before update on public.meeting_live_sessions
  for each row execute function public.set_updated_at();

-- ── Speaker queue ──────────────────────────────────────────────────────────

create table if not exists public.meeting_speaker_queue (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.meetings(id) on delete cascade,
  agenda_item_id  uuid references public.meeting_agenda_items(id) on delete set null,
  member_id       uuid references public.organization_members(id) on delete set null,
  position        integer not null,
  topic           text,
  requested_at    timestamptz not null default now(),
  given_floor_at  timestamptz,
  yielded_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists meeting_speaker_queue_position_idx
  on public.meeting_speaker_queue (meeting_id, agenda_item_id, position)
  where yielded_at is null;

comment on table public.meeting_speaker_queue is
  'Taleliste — append-then-drain queue of members asking for the floor per agenda item. given_floor_at marks when the chair handed them the floor; yielded_at when they finished.';

alter table public.meeting_speaker_queue enable row level security;

drop policy if exists meeting_speaker_queue_select on public.meeting_speaker_queue;
create policy meeting_speaker_queue_select
  on public.meeting_speaker_queue
  for select
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
    )
  );

drop policy if exists meeting_speaker_queue_write on public.meeting_speaker_queue;
create policy meeting_speaker_queue_write
  on public.meeting_speaker_queue
  for all
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );
