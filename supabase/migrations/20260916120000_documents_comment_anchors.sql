-- Documents redesign S4 + S5 — inline comment anchors, suggestion payload,
-- and the comment-lifecycle audit log.
--
-- Gap closed: the Claude Design "Rec05 — Inline kommentarer" artboard anchors
-- comment threads to a *text selection* (a quoted span), and "Rec06 — Forslag/
-- sporing av endringer" needs a structured proposed-change payload plus an
-- append-only record of every resolve / acknowledge / accept / reject / delete.
-- Today wiki_page_comments only keys on block_index and carries no suggestion
-- payload, and there is no lifecycle audit trail.
--
-- § / self-audit (Arbeidstilsynet POV): comments and suggestions on HMS
-- documents are part of the internkontroll evidence chain (IK-f § 5 nr. 7 —
-- avvik shall be traceably documented and closed; AML § 3-1 medvirkning).
-- The lifecycle log makes "who resolved/acknowledged this and when" auditable.
-- Restrisiko deferred: realtime co-editing presence (Rec04) is a later sprint.
--
-- All operations are additive and idempotent — safe to re-run.

-- ── S4: text-selection anchor for inline comment threads ────────────────────
alter table public.wiki_page_comments
  add column if not exists anchor jsonb null;

comment on column public.wiki_page_comments.anchor is
  'Inline-comment text anchor. Shape: {"blockIndex": int, "from": int, "to": int, '
  '"quotedText": text}. Null for block-level comments (legacy + Rec05 fallback).';

-- ── S5: structured proposed-change payload for kind = ''suggestion'' ────────
alter table public.wiki_page_comments
  add column if not exists suggestion jsonb null;

comment on column public.wiki_page_comments.suggestion is
  'Track-changes payload for kind=''suggestion''. Shape: {"remove": text, '
  '"add": text}. Null for non-suggestion comments.';

-- ── S5: append-only comment-lifecycle audit log ────────────────────────────
create table if not exists public.wiki_comment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  comment_id uuid not null references public.wiki_page_comments (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  event text not null
    check (event in ('resolved', 'reopened', 'acknowledged', 'accepted', 'rejected', 'deleted')),
  actor_id uuid not null references auth.users (id) on delete cascade,
  actor_name text not null,
  note text null,
  created_at timestamptz not null default now()
);

comment on table public.wiki_comment_events is
  'Append-only lifecycle log for wiki_page_comments — one row per resolve / '
  'reopen / acknowledge / accept / reject / delete. Feeds the Rec06 change log.';

create index if not exists wiki_comment_events_comment_idx
  on public.wiki_comment_events (comment_id, created_at desc);
create index if not exists wiki_comment_events_page_idx
  on public.wiki_comment_events (page_id, created_at desc);

alter table public.wiki_comment_events enable row level security;

drop policy if exists "wiki_comment_events_select" on public.wiki_comment_events;
create policy "wiki_comment_events_select"
  on public.wiki_comment_events for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

drop policy if exists "wiki_comment_events_insert" on public.wiki_comment_events;
create policy "wiki_comment_events_insert"
  on public.wiki_comment_events for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and actor_id = auth.uid()
    and public.user_has_permission('documents.view')
  );
