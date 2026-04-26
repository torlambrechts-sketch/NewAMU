# Step 1 — DB Migration: New Tables

Create file: `supabase/migrations/20260801000000_amu_redesign_tables.sql`

## Context

The existing `amu_meetings`, `amu_agenda_items`, `amu_decisions` tables stay in place — this migration is **additive**. It also extends `amu_meetings` with new columns needed by the redesign.

## What to write

### 1. Extend `amu_meetings` (ALTER, not create)

```sql
alter table public.amu_meetings
  add column if not exists committee_id   uuid references public.amu_committees(id),
  add column if not exists sequence_no    int,
  add column if not exists year           int generated always as (extract(year from scheduled_at)::int) stored,
  add column if not exists scheduled_at   timestamptz,
  add column if not exists is_hybrid      boolean not null default false,
  add column if not exists signed_by_leader uuid references public.amu_members(id),
  add column if not exists signed_by_deputy uuid references public.amu_members(id);

-- update status check to include new statuses
alter table public.amu_meetings
  drop constraint if exists amu_meetings_status_check;
alter table public.amu_meetings
  add constraint amu_meetings_status_check
  check (status in ('draft','scheduled','in_progress','completed','signed','archived'));
```

### 2. New table: `amu_committees`

One row per organization. Create before `amu_members` (FK target).

```sql
create table if not exists public.amu_committees (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  name                  text not null,
  term_start            date not null,
  term_end              date not null,
  chair_side            text not null check (chair_side in ('employer','employee')),
  min_meetings_per_year int not null default 4,
  bht_provider          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);
```

RLS (copy pattern from existing `amu_meetings` policies, swap table name):
- SELECT: `organization_id = public.current_org_id()`
- INSERT WITH CHECK: same
- UPDATE USING: same AND `true` (committees are always editable by managers)
- DELETE USING: `organization_id = public.current_org_id()`

Audit trigger: `after insert or update or delete … execute function public.audit_log_change()`

### 3. New table: `amu_members`

Replaces `amu_participants` for new module. Old `amu_participants` remains for backward compat.

```sql
create table if not exists public.amu_members (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  committee_id             uuid not null references public.amu_committees(id) on delete cascade,
  user_id                  uuid references auth.users(id),
  display_name             text not null,
  side                     text not null check (side in ('employer','employee','bht')),
  role                     text not null check (role in ('leader','deputy_leader','member','bht_observer')),
  function_label           text,
  voting                   boolean not null default true,
  hms_training_valid_until date,
  term_start               date not null,
  term_end                 date not null,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id)
);
```

RLS: same SELECT/INSERT/UPDATE/DELETE pattern. UPDATE: no immutability block (members are always editable).

### 4. New table: `amu_attendance`

```sql
create table if not exists public.amu_attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id      uuid not null references public.amu_meetings(id) on delete cascade,
  member_id       uuid not null references public.amu_members(id) on delete cascade,
  status          text not null default 'present'
    check (status in ('present','absent','excused','digital')),
  joined_at       timestamptz,
  unique (meeting_id, member_id)
);
```

RLS: SELECT/INSERT/UPDATE — org check. UPDATE also requires parent meeting `status not in ('signed','archived')` via EXISTS subquery (same pattern as `amu_agenda_items_update` in `Claude/NewAUM/01_DATABASE.md`).

### 5. New table: `amu_topic_proposals`

```sql
create table if not exists public.amu_topic_proposals (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  proposed_by       uuid references auth.users(id),
  target_meeting_id uuid references public.amu_meetings(id),
  description       text not null,
  status            text not null default 'submitted'
    check (status in ('submitted','accepted','rejected','deferred')),
  created_at        timestamptz not null default now()
);
```

RLS: SELECT/INSERT — org check. UPDATE only when `status = 'submitted'`.

### 6. New table: `amu_annual_reports`

```sql
create table if not exists public.amu_annual_reports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  committee_id     uuid not null references public.amu_committees(id),
  year             int not null,
  body             jsonb not null default '{}',
  status           text not null default 'draft'
    check (status in ('draft','signed','archived')),
  signed_by_leader uuid references public.amu_members(id),
  signed_by_deputy uuid references public.amu_members(id),
  signed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  unique (committee_id, year)
);
```

RLS: SELECT/INSERT — org check. UPDATE USING: org check AND `status not in ('signed','archived')`.

Audit trigger on `amu_annual_reports`.

### 7. Org-id auto-fill triggers

For each new table (`amu_committees`, `amu_members`, `amu_attendance`, `amu_topic_proposals`, `amu_annual_reports`), add a BEFORE INSERT trigger that sets `organization_id = public.current_org_id()` when null. Follow the pattern from `Claude/NewAUM/01_DATABASE.md` § "Insert triggers".

### 8. Updated-at triggers

For each new table that has `updated_at`, add a BEFORE UPDATE trigger calling `public.set_updated_at()`.

## Commit

```
feat(amu): migration — new committees/members/attendance/proposals/reports tables
```
