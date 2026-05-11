-- Documents collaboration — Phase 1 (comment threads, intent kinds, anonymity, varsling).
-- Why: today wiki_page_comments is a flat thread per block with no intent typing.
-- AML § 2A demands confidential, append-only varsling channels; AML § 3-1 expects
-- read-only employees to be able to comment, suggest improvements, and raise avvik.
-- This migration extends the existing table without breaking the current UI: every
-- new column is nullable or has a safe default, and the existing RLS contract is
-- preserved for non-confidential rows.

-- 1. Columns ----------------------------------------------------------------

alter table public.wiki_page_comments
  add column if not exists parent_comment_id uuid null
    references public.wiki_page_comments (id) on delete cascade;

alter table public.wiki_page_comments
  add column if not exists kind text not null default 'comment';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wiki_page_comments_kind_check'
      and conrelid = 'public.wiki_page_comments'::regclass
  ) then
    alter table public.wiki_page_comments
      add constraint wiki_page_comments_kind_check
      check (kind in ('comment', 'suggestion', 'avvik_proposal', 'varsling'));
  end if;
end $$;

alter table public.wiki_page_comments
  add column if not exists severity text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wiki_page_comments_severity_check'
      and conrelid = 'public.wiki_page_comments'::regclass
  ) then
    alter table public.wiki_page_comments
      add constraint wiki_page_comments_severity_check
      check (severity is null or severity in ('low', 'medium', 'high', 'critical'));
  end if;
end $$;

alter table public.wiki_page_comments
  add column if not exists is_anonymous boolean not null default false;

alter table public.wiki_page_comments
  add column if not exists is_confidential boolean not null default false;

alter table public.wiki_page_comments
  add column if not exists legal_basis text[] not null default '{}';

-- Append-only edit log: [{ at: timestamptz, by: uuid, prev_body: text }]. The
-- current `body` is always the latest text. Editing pushes the previous text
-- into `edited_history` so the audit trail remains intact.
alter table public.wiki_page_comments
  add column if not exists edited_history jsonb not null default '[]'::jsonb;

comment on column public.wiki_page_comments.edited_history is
  'Append-only edit log. Each entry: { at: timestamptz, by: uuid, prev_body: text }.';

alter table public.wiki_page_comments
  add column if not exists resolved_at timestamptz null;
alter table public.wiki_page_comments
  add column if not exists resolved_by uuid null references auth.users (id) on delete set null;
alter table public.wiki_page_comments
  add column if not exists deleted_at timestamptz null;
alter table public.wiki_page_comments
  add column if not exists updated_at timestamptz null;

create index if not exists wiki_page_comments_parent_idx
  on public.wiki_page_comments (parent_comment_id);
create index if not exists wiki_page_comments_kind_idx
  on public.wiki_page_comments (page_id, kind);
create index if not exists wiki_page_comments_confidential_idx
  on public.wiki_page_comments (organization_id, is_confidential)
  where is_confidential = true;

-- 2. Append-only trigger on confidential rows (mirrors whistleblowing_case_notes) ----

create or replace function public.wiki_page_comments_no_mutation_when_confidential()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if old.is_confidential is true then
      -- Confidential rows are append-only. The only mutation we tolerate is the
      -- soft-resolution toggle and soft-delete by org admins, which we keep open
      -- for moderation purposes but log via the audit ledger separately.
      if new.body is distinct from old.body then
        raise exception 'wiki_page_comments: konfidensielle kommentarer kan ikke endres (append-only)';
      end if;
      if new.kind is distinct from old.kind
         or new.severity is distinct from old.severity
         or new.parent_comment_id is distinct from old.parent_comment_id
         or new.is_anonymous is distinct from old.is_anonymous
         or new.is_confidential is distinct from old.is_confidential then
        raise exception 'wiki_page_comments: konfidensielle felt er låst';
      end if;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if old.is_confidential is true then
      raise exception 'wiki_page_comments: konfidensielle kommentarer kan ikke slettes';
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists wiki_page_comments_confidential_upd on public.wiki_page_comments;
create trigger wiki_page_comments_confidential_upd
  before update on public.wiki_page_comments
  for each row execute function public.wiki_page_comments_no_mutation_when_confidential();

drop trigger if exists wiki_page_comments_confidential_del on public.wiki_page_comments;
create trigger wiki_page_comments_confidential_del
  before delete on public.wiki_page_comments
  for each row execute function public.wiki_page_comments_no_mutation_when_confidential();

-- 3. RLS rewrite — confidential rows are only visible to author, admin, and the
--    whistleblowing committee. Non-confidential rows keep the existing contract
--    (any org member with documents.view can read). ------------------------

drop policy if exists "wiki_page_comments_select" on public.wiki_page_comments;
create policy "wiki_page_comments_select"
  on public.wiki_page_comments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
    and (
      is_confidential is false
      or author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('whistleblowing.committee')
      or public.user_has_permission('documents.manage')
    )
  );

-- Inserts: any org member with documents.view can comment (medvirkning, AML § 3-1).
-- Anonymous rows still must have author_id = auth.uid() so RLS works; the UI
-- hides the name. Public author_id is acceptable because RLS is the boundary
-- that enforces who can read the row at all.
drop policy if exists "wiki_page_comments_insert" on public.wiki_page_comments;
create policy "wiki_page_comments_insert"
  on public.wiki_page_comments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and author_id = auth.uid()
    and public.user_has_permission('documents.view')
  );

-- Updates: own row OR admin / documents.manage. The trigger above prevents
-- substantive edits on confidential rows regardless of RLS.
drop policy if exists "wiki_page_comments_update" on public.wiki_page_comments;
create policy "wiki_page_comments_update"
  on public.wiki_page_comments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  )
  with check (organization_id = public.current_org_id());

-- Deletes: own row only (and never for confidential rows — trigger blocks).
drop policy if exists "wiki_page_comments_delete" on public.wiki_page_comments;
create policy "wiki_page_comments_delete"
  on public.wiki_page_comments for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and author_id = auth.uid()
  );

-- 4. Severity must be set when the comment is an avvik/varsling. Defensive
--    check at the row level — UI also enforces. -------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wiki_page_comments_severity_required'
      and conrelid = 'public.wiki_page_comments'::regclass
  ) then
    alter table public.wiki_page_comments
      add constraint wiki_page_comments_severity_required
      check (
        (kind in ('avvik_proposal', 'varsling') and severity is not null)
        or (kind in ('comment', 'suggestion') and severity is null)
      );
  end if;
end $$;
