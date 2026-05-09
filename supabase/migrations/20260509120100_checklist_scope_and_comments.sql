-- Checklist scope + execution-level comment threads
--
-- Scope: defines what a checklist execution is *about* —
--   'location'       → existing location_id FK carries the reference
--   'catalogue_item' → scope_catalogue_item_label carries a free-text label
--                      (e.g. "Leverandør: Acme AS", "Maskin: Truck #7")
--   'other'          → scope_other_label carries a free-text description
--
-- Comments: persistent discussion / update log on an execution.
--   item_key NULL  → execution-level note
--   item_key TEXT  → item-level note (references ChecklistItem.key)
--   Mentions are stored as a UUID array that the app resolves to display names.
--   author_name is denormalized for display stability (survives user renames).
--
-- Self-audit: no compliance/law gap being addressed here — this is a
--   collaboration capability addition; zero restrisiko from missing it.

-- ── Scope columns on compliance_checklist_executions ─────────────────────────

alter table compliance_checklist_executions
  add column if not exists scope_type text
    check (scope_type in ('location', 'catalogue_item', 'other')),
  add column if not exists scope_catalogue_item_label text,
  add column if not exists scope_other_label text;

comment on column compliance_checklist_executions.scope_type is
  'What the execution is about: location (→location_id), catalogue_item (→scope_catalogue_item_label), or other (→scope_other_label).';
comment on column compliance_checklist_executions.scope_catalogue_item_label is
  'Free-text label when scope_type=catalogue_item, e.g. "Leverandør: Acme AS" or "Maskin: Truck #7".';
comment on column compliance_checklist_executions.scope_other_label is
  'Free-text description when scope_type=other.';

-- ── compliance_checklist_comments ─────────────────────────────────────────────

create table if not exists compliance_checklist_comments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  execution_id     uuid not null references compliance_checklist_executions(id) on delete cascade,
  -- null = execution-level; non-null = references ChecklistItem.key
  item_key         text,
  body             text not null check (char_length(body) between 1 and 4000),
  author_id        uuid not null references auth.users(id),
  author_name      text not null,
  -- UUIDs of @mentioned organization_members
  mentions         uuid[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists compliance_checklist_comments_exec_idx
  on compliance_checklist_comments (organization_id, execution_id, created_at);

-- updated_at maintenance
create or replace function _touch_compliance_checklist_comment()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'compliance_checklist_comment_updated_at_tg'
      and tgrelid = 'compliance_checklist_comments'::regclass
  ) then
    create trigger compliance_checklist_comment_updated_at_tg
      before update on compliance_checklist_comments
      for each row execute function _touch_compliance_checklist_comment();
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table compliance_checklist_comments enable row level security;

-- Any org member with checklist read access can see comments.
create policy "compliance_comments_select"
  on compliance_checklist_comments for select
  using (organization_id = current_org_id());

-- Any org member who can manage checklists can post comments.
create policy "compliance_comments_insert"
  on compliance_checklist_comments for insert
  with check (
    organization_id = current_org_id()
    and author_id = auth.uid()
  );

-- Authors can edit their own comments.
create policy "compliance_comments_update"
  on compliance_checklist_comments for update
  using (organization_id = current_org_id() and author_id = auth.uid());

-- Authors can delete their own comments.
create policy "compliance_comments_delete"
  on compliance_checklist_comments for delete
  using (organization_id = current_org_id() and author_id = auth.uid());
