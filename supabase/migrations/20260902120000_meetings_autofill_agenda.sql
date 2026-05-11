-- Meetings — auto-fill agenda + agenda builder + Sherpany extras.
--
-- Why
--   Today every meeting opens with empty `minutes_summary` boxes. The chair
--   manually gathers sykefravær / avvik / vernerunder / opplæring numbers
--   each time. We already have `useMeetingDataBindings` + `binding_snapshot`
--   column from H9a, but no reporting period, no eager snapshot, no agenda
--   builder. This migration unlocks the next three capabilities together:
--
--     1. Reporting period on meetings (so AMU Q1 2026 can lock "Q4 2025")
--     2. Agenda builder columns (is_manual, duration_minutes, presenter)
--     3. Attachments junction → wiki_pages (Sherpany-style pre-read docs)
--
-- Compliance posture
--   AML § 7-2 (1) — AMU skal følge utviklingen i arbeidsmiljøet; explicit
--     period bounds make this auditable per kvartal.
--   AML § 7-2 (6) — årsrapport requires aggregated yearly data; period =
--     previous calendar year supports this.
--   Forskrift om org. ledelse § 3-16 — referat fra møtene; agenda
--     builder changes are caught by audit trail. Once signed the
--     agenda is fully locked (new trigger).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--   CREATE OR REPLACE FUNCTION / TRIGGER patterns throughout.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Reporting period on meetings                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meetings
  add column if not exists reporting_period_start date,
  add column if not exists reporting_period_end   date,
  add column if not exists reporting_period_label text;

comment on column public.meetings.reporting_period_start is
  'Inclusive lower bound of the reporting period this meeting reviews. NULL means fall back to relative window from dataBinding.';
comment on column public.meetings.reporting_period_end is
  'Inclusive upper bound of the reporting period this meeting reviews. NULL means fall back to relative window from dataBinding.';
comment on column public.meetings.reporting_period_label is
  'Human label for the period (e.g. "Q4 2025", "2024"). Free text; resolvers do not parse it.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Agenda builder + Sherpany extras                                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_agenda_items
  add column if not exists is_manual           boolean not null default false,
  add column if not exists duration_minutes    integer
    check (duration_minutes is null or duration_minutes >= 0),
  add column if not exists presenter_member_id uuid
    references public.organization_members (id) on delete set null;

comment on column public.meeting_agenda_items.is_manual is
  'True when added via agenda builder (no template_item_key). Template items default to false.';
comment on column public.meeting_agenda_items.duration_minutes is
  'Per-item time budget. Optional. Sum yields the total meeting time forecast.';
comment on column public.meeting_agenda_items.presenter_member_id is
  'Member who presents this item in the meeting (distinct from prepared_by_member_id who wrote the pre-read).';

-- Backfill is_manual = true for existing rows that were inserted without a
-- template item key. Template-derived rows keep the default `false`.
update public.meeting_agenda_items
   set is_manual = true
 where template_item_key is null
   and is_manual = false;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Attachments junction → wiki_pages                                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_agenda_attachments (
  id             uuid primary key default gen_random_uuid(),
  agenda_item_id uuid not null references public.meeting_agenda_items (id) on delete cascade,
  wiki_page_id   text not null references public.wiki_pages (id) on delete cascade,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.organization_members (id) on delete set null,
  unique (agenda_item_id, wiki_page_id)
);

create index if not exists meeting_agenda_attachments_item_idx
  on public.meeting_agenda_attachments (agenda_item_id, position);

alter table public.meeting_agenda_attachments enable row level security;

-- Visibility inherits from parent agenda item (which inherits from meeting).
-- Wiki pages have their own RLS — the picker enforces that, and select here
-- is permissive because the FK already requires a visible wiki_page row.
drop policy if exists meeting_agenda_attachments_select on public.meeting_agenda_attachments;
create policy meeting_agenda_attachments_select
  on public.meeting_agenda_attachments for select
  using (
    exists (select 1 from public.meeting_agenda_items i where i.id = agenda_item_id)
  );

drop policy if exists meeting_agenda_attachments_write on public.meeting_agenda_attachments;
create policy meeting_agenda_attachments_write
  on public.meeting_agenda_attachments for all
  using (
    exists (select 1 from public.meeting_agenda_items i where i.id = agenda_item_id)
  )
  with check (
    exists (select 1 from public.meeting_agenda_items i where i.id = agenda_item_id)
  );

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Extend meetings BEFORE-UPDATE lock to cover reporting_period_*       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.meetings_before_update_defaults()
returns trigger language plpgsql security definer as
$$
begin
  -- Always immutable
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable on meetings';
  end if;
  if new.source_kind is distinct from old.source_kind then
    raise exception 'source_kind is immutable on meetings';
  end if;
  if new.system_template_id is distinct from old.system_template_id then
    raise exception 'system_template_id is immutable on meetings';
  end if;
  if new.org_template_id is distinct from old.org_template_id then
    raise exception 'org_template_id is immutable on meetings';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable on meetings';
  end if;

  if old.protocol_signed_at is not null
     and new.confidentiality_level is distinct from old.confidentiality_level then
    raise exception 'Meeting % is signed; confidentiality_level is locked', old.id
      using errcode = 'check_violation';
  end if;

  if old.protocol_signed_at is not null then
    if new.protocol_signed_at is null then
      raise exception 'Meeting % is signed; protocol_signed_at cannot revert', old.id
        using errcode = 'check_violation';
    end if;
    if new.protocol_signed_by is distinct from old.protocol_signed_by then
      raise exception 'Meeting % is signed; protocol_signed_by is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.sign_checksum is distinct from old.sign_checksum then
      raise exception 'Meeting % is signed; sign_checksum is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.definition_snapshot is distinct from old.definition_snapshot then
      raise exception 'Meeting % is signed; definition_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.metadata_schema_snapshot is distinct from old.metadata_schema_snapshot then
      raise exception 'Meeting % is signed; metadata_schema_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.status not in ('completed','cancelled') then
      raise exception 'Meeting % is signed; status cannot revert to %', old.id, new.status
        using errcode = 'check_violation';
    end if;
    -- New: reporting period locks together with the rest of the identity
    -- bundle once the protocol is signed.
    if new.reporting_period_start is distinct from old.reporting_period_start then
      raise exception 'Meeting % is signed; reporting_period_start is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.reporting_period_end is distinct from old.reporting_period_end then
      raise exception 'Meeting % is signed; reporting_period_end is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.reporting_period_label is distinct from old.reporting_period_label then
      raise exception 'Meeting % is signed; reporting_period_label is locked', old.id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. NEW lock trigger on meeting_agenda_items                             │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- After protocol_signed_at, the agenda structure freezes. Only binding
-- refresh and the minutes/decision/vote fields (which already flow through
-- setAgendaMinutes after sign) stay editable.

create or replace function public.meeting_agenda_items_before_change()
returns trigger language plpgsql security definer as
$$
declare
  locked boolean;
  meeting_id_eff uuid;
begin
  meeting_id_eff := coalesce(new.meeting_id, old.meeting_id);
  select protocol_signed_at is not null
    into locked
    from public.meetings
   where id = meeting_id_eff;

  if locked then
    if tg_op = 'INSERT' then
      raise exception 'Meeting % is signed; cannot add agenda items', meeting_id_eff
        using errcode = 'check_violation';
    end if;
    if tg_op = 'DELETE' then
      raise exception 'Meeting % is signed; cannot delete agenda items', meeting_id_eff
        using errcode = 'check_violation';
    end if;
    -- UPDATE: allow only the "soft" fields that flow during/after sign.
    if new.position           is distinct from old.position
       or new.title           is distinct from old.title
       or new.description     is distinct from old.description
       or new.law_ref         is distinct from old.law_ref
       or new.is_mandatory    is distinct from old.is_mandatory
       or new.is_manual       is distinct from old.is_manual
       or new.duration_minutes is distinct from old.duration_minutes
       or new.presenter_member_id is distinct from old.presenter_member_id
       or new.template_item_key is distinct from old.template_item_key
    then
      raise exception 'Meeting % is signed; agenda structure is locked', meeting_id_eff
        using errcode = 'check_violation';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists meeting_agenda_items_lock_tg on public.meeting_agenda_items;
create trigger meeting_agenda_items_lock_tg
  before insert or update or delete on public.meeting_agenda_items
  for each row execute function public.meeting_agenda_items_before_change();

-- Verification
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='meetings'
--    and column_name like 'reporting_period%';                            -- 3 rows
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='meeting_agenda_items'
--    and column_name in ('is_manual','duration_minutes','presenter_member_id');  -- 3 rows
-- select tgname from pg_trigger where tgname = 'meeting_agenda_items_lock_tg';   -- 1 row
