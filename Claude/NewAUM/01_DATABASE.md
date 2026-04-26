# 01 · Database Layer

All tables: `organization_id uuid not null`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `created_by uuid references auth.users(id)`. RLS on. Insert trigger fills `organization_id` from `public.current_org_id()`.

Migration file: `supabase/migrations/<timestamp>_amu_module.sql`

---

## Tables

### `amu_committees`
One per organization (occasionally per legal entity). Holds valgperiode + chair rotation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | FK orgs |
| `name` | text not null | "AMU – Nordby Industri AS" |
| `term_start` | date not null | valgperiode start |
| `term_end` | date not null | valgperiode slutt |
| `chair_side` | text check (in 'employer','employee') | hvilken side har leder dette året |
| `min_meetings_per_year` | int default 4 | AML § 7-2 — minst 4 |
| `bht_provider` | text | "Stamina Helse AS" |

### `amu_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `committee_id` | uuid fk amu_committees | |
| `user_id` | uuid fk auth.users | nullable for ekstern BHT-rep |
| `display_name` | text not null | |
| `side` | text check (in 'employer','employee','bht') | |
| `role` | text check (in 'leader','deputy_leader','member','bht_observer') | |
| `function_label` | text | "Hovedverneombud", "HMS-leder", etc. |
| `voting` | boolean default true | BHT-rep = false |
| `hms_training_valid_until` | date | 40-timers HMS-kurs (AML § 6-5) |
| `term_start` | date | |
| `term_end` | date | |
| `active` | boolean default true | |

Constraint: at any point in time, count(side='employer' AND voting) MUST equal count(side='employee' AND voting). Enforce in app + scheduled DB check.

### `amu_meetings`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `committee_id` | uuid fk amu_committees | |
| `sequence_no` | int | 1, 2, 3, 4 within year |
| `year` | int | |
| `title` | text | "AMU 2/2026 – Vårmøte" |
| `scheduled_at` | timestamptz | |
| `location` | text | |
| `is_hybrid` | boolean default false | |
| `status` | text check (in 'draft','scheduled','in_progress','completed','signed','archived') default 'draft' | |
| `signed_at` | timestamptz | |
| `signed_by_leader` | uuid fk amu_members | |
| `signed_by_deputy` | uuid fk amu_members | |

### `amu_agenda_items`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `meeting_id` | uuid fk amu_meetings | |
| `position` | int | 1, 2, 3 … |
| `title` | text | |
| `source_type` | text check (in 'standard','auto_deviation','auto_sick_leave','auto_whistleblowing','auto_inspection','auto_hms_plan','manual','employee_proposal') | |
| `source_ref_id` | uuid | links to deviation, inspection, etc. |
| `legal_ref` | text | "§ 7-2 (2)d" |
| `presenter_id` | uuid fk amu_members | |
| `notes` | text | minutes for this item |
| `status` | text check (in 'pending','active','decided','deferred') default 'pending' | |

### `amu_decisions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `agenda_item_id` | uuid fk amu_agenda_items | |
| `decision_text` | text not null | |
| `votes_for` | int | |
| `votes_against` | int | |
| `votes_abstained` | int | |
| `responsible_member_id` | uuid fk amu_members | |
| `due_date` | date | |
| `linked_action_id` | uuid | FK to tiltaksplan |

### `amu_attendance`
| Column | Type |
|---|---|
| `id` uuid pk | |
| `organization_id` uuid | |
| `meeting_id` uuid fk amu_meetings | |
| `member_id` uuid fk amu_members | |
| `status` text check (in 'present','absent','excused','digital') | |
| `joined_at` timestamptz | |

### `amu_topic_proposals`
Anyone in the org can propose a topic for upcoming meetings.

| Column | Type |
|---|---|
| `id` uuid pk | |
| `organization_id` uuid | |
| `proposed_by` uuid fk auth.users | |
| `target_meeting_id` uuid nullable | |
| `description` text | |
| `status` text check (in 'submitted','accepted','rejected','deferred') | |

### `amu_annual_reports`
| Column | Type |
|---|---|
| `id` uuid pk | |
| `organization_id` uuid | |
| `committee_id` uuid fk | |
| `year` int | |
| `body` jsonb | structured §1–§5 sections |
| `status` text check (in 'draft','signed','archived') | |
| `signed_by_leader` uuid | |
| `signed_by_deputy` uuid | |
| `signed_at` timestamptz | |

---

## RLS — applied to every table above

```sql
alter table public.amu_meetings enable row level security;

create policy "amu_meetings_select"
  on public.amu_meetings for select
  using (organization_id = public.current_org_id());

create policy "amu_meetings_insert"
  on public.amu_meetings for insert
  with check (organization_id = public.current_org_id());

create policy "amu_meetings_update"
  on public.amu_meetings for update
  using (
    organization_id = public.current_org_id()
    and status not in ('signed','archived')
  );

create policy "amu_meetings_delete"
  on public.amu_meetings for delete
  using (
    organization_id = public.current_org_id()
    and status = 'draft'
  );
```

Apply identical pattern to `amu_committees`, `amu_members`, `amu_agenda_items`, `amu_decisions`, `amu_attendance`, `amu_topic_proposals`, `amu_annual_reports`.

For `amu_agenda_items` and `amu_decisions`, the immutability check should derive status from the parent meeting:

```sql
create policy "amu_agenda_items_update"
  on public.amu_agenda_items for update
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.amu_meetings m
      where m.id = meeting_id
        and m.status not in ('signed','archived')
    )
  );
```

---

## Insert triggers (org_id auto-fill)

```sql
create or replace function public.amu_meetings_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

create trigger amu_meetings_before_insert
  before insert on public.amu_meetings
  for each row execute function public.amu_meetings_before_insert();
```

Repeat for every AMU table.

---

## Audit log

```sql
create trigger amu_meetings_audit
  after insert or update or delete on public.amu_meetings
  for each row execute function public.audit_log_change();

create trigger amu_decisions_audit
  after insert or update or delete on public.amu_decisions
  for each row execute function public.audit_log_change();

create trigger amu_annual_reports_audit
  after insert or update or delete on public.amu_annual_reports
  for each row execute function public.audit_log_change();
```

(Reuse the existing `public.audit_log_change()` function used by `ros` / `inspection`.)

---

## Views (read-only) for the hook

- `amu_compliance_status` — one row per committee/year, computed flags for: meetings_held vs `min_meetings_per_year`, parity ok, BHT present, HMS-training valid for all voting members, annual report signed, etc.
- `amu_meeting_summary` — meeting + attendance counts + agenda item counts + decision counts.
- `amu_critical_queue` — cross-module: open critical avvik, unsigned referat, missing Q4 meeting, expired HMS-training. Used by Oversikt + Kritiske saker tabs.
