-- Documents collaboration — Phase 2.1: per-block soft locks.
-- Why: lightweight realtime co-editing without CRDT. While a user is editing
-- block N, others see a lock indicator on that block (read-only) and an
-- avatar in the page header. Locks auto-expire after 5 minutes — clients
-- heartbeat to extend, and stale locks self-clear on read because every
-- consumer scopes its query to `expires_at > now()`.
--
-- Datatilsynet boundary: this table records only the currently-active
-- editor, not view-only presence. A "who looked at this page" surface is
-- explicitly out of scope (would be workplace monitoring without legal
-- basis).

create table if not exists public.wiki_page_block_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  block_index int not null,
  holder_user_id uuid not null references auth.users (id) on delete cascade,
  holder_name text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  unique (page_id, block_index)
);

create index if not exists wiki_page_block_locks_expires_idx
  on public.wiki_page_block_locks (expires_at);

create index if not exists wiki_page_block_locks_page_idx
  on public.wiki_page_block_locks (page_id, expires_at);

alter table public.wiki_page_block_locks enable row level security;

-- Visible to any org member with documents.view — the indicator is meant
-- to be public ("Anne redigerer blokk 3"), not secret.
drop policy if exists "wiki_block_locks_select" on public.wiki_page_block_locks;
create policy "wiki_block_locks_select"
  on public.wiki_page_block_locks for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

-- Only the holder can acquire. Forces user to own their own lock.
drop policy if exists "wiki_block_locks_insert" on public.wiki_page_block_locks;
create policy "wiki_block_locks_insert"
  on public.wiki_page_block_locks for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and holder_user_id = auth.uid()
    and public.user_has_permission('documents.view')
  );

-- Update (heartbeat): only the current holder. Admins/managers can override
-- and the override is logged via wiki_audit_ledger by the caller — RLS only
-- needs to permit the override.
drop policy if exists "wiki_block_locks_update" on public.wiki_page_block_locks;
create policy "wiki_block_locks_update"
  on public.wiki_page_block_locks for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      holder_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  )
  with check (organization_id = public.current_org_id());

-- Release: holder, admin, or documents.manage. We tolerate cleanups by the
-- same roles that can override the lock.
drop policy if exists "wiki_block_locks_delete" on public.wiki_page_block_locks;
create policy "wiki_block_locks_delete"
  on public.wiki_page_block_locks for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      holder_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  );

-- Extend the audit-ledger action vocabulary with the lock-override action so
-- forced takeovers are tracebable.
alter table public.wiki_audit_ledger drop constraint if exists wiki_audit_ledger_action_check;
alter table public.wiki_audit_ledger
  add constraint wiki_audit_ledger_action_check
  check (
    action in (
      'created',
      'updated',
      'published',
      'archived',
      'acknowledged',
      'annual_review_completed',
      'submitted_for_review',
      'approved',
      'changes_requested',
      'lock_overridden'
    )
  );

drop policy if exists "wiki_audit_insert" on public.wiki_audit_ledger;
create policy "wiki_audit_insert"
  on public.wiki_audit_ledger for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      (
        public.is_org_admin()
        or public.user_has_permission('documents.manage')
        or public.user_has_permission('documents.edit')
      )
      or (user_id = auth.uid() and action = 'acknowledged')
      or (user_id = auth.uid() and action = 'annual_review_completed')
      or (
        user_id = auth.uid()
        and action in ('submitted_for_review', 'approved', 'changes_requested')
      )
    )
  );
