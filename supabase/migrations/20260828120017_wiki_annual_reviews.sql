-- IK-f §5 nr. 5 — Årsgjennomgang for dokumentmodulen.
-- Restores the `wiki_annual_reviews` + `wiki_annual_review_items` tables consumed
-- by `src/api/wikiAnnualReview.ts` and `src/pages/documents/AnnualReviewPage.tsx`.
-- Audit ledger action `annual_review_completed` is already enabled by
-- 20260731260000_documents_p2_p3_features.sql.

-- ── 1. wiki_annual_reviews ──────────────────────────────────────────────────
create table if not exists public.wiki_annual_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year int not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'overdue')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  review_page_id text references public.wiki_pages (id) on delete set null,
  items_reviewed int not null default 0,
  items_total int not null default 0,
  notes text,
  unique (organization_id, year)
);

create index if not exists wiki_annual_reviews_org_year_idx
  on public.wiki_annual_reviews (organization_id, year desc);

alter table public.wiki_annual_reviews enable row level security;

drop policy if exists "wiki_annual_reviews_select_org" on public.wiki_annual_reviews;
create policy "wiki_annual_reviews_select_org"
  on public.wiki_annual_reviews for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists "wiki_annual_reviews_insert_manage" on public.wiki_annual_reviews;
create policy "wiki_annual_reviews_insert_manage"
  on public.wiki_annual_reviews for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

drop policy if exists "wiki_annual_reviews_update_manage" on public.wiki_annual_reviews;
create policy "wiki_annual_reviews_update_manage"
  on public.wiki_annual_reviews for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

grant select, insert, update on public.wiki_annual_reviews to authenticated;

-- ── 2. wiki_annual_review_items ─────────────────────────────────────────────
create table if not exists public.wiki_annual_review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.wiki_annual_reviews (id) on delete cascade,
  page_id text references public.wiki_pages (id) on delete set null,
  legal_ref text not null,
  description text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'needs_update', 'not_applicable')),
  reviewer_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists wiki_annual_review_items_review_idx
  on public.wiki_annual_review_items (review_id);

alter table public.wiki_annual_review_items enable row level security;

drop policy if exists "wiki_annual_review_items_select_org" on public.wiki_annual_review_items;
create policy "wiki_annual_review_items_select_org"
  on public.wiki_annual_review_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.wiki_annual_reviews r
      where r.id = wiki_annual_review_items.review_id
        and r.organization_id = public.current_org_id()
    )
  );

drop policy if exists "wiki_annual_review_items_insert_manage" on public.wiki_annual_review_items;
create policy "wiki_annual_review_items_insert_manage"
  on public.wiki_annual_review_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.wiki_annual_reviews r
      where r.id = wiki_annual_review_items.review_id
        and r.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('documents.manage'))
    )
  );

drop policy if exists "wiki_annual_review_items_update_manage" on public.wiki_annual_review_items;
create policy "wiki_annual_review_items_update_manage"
  on public.wiki_annual_review_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.wiki_annual_reviews r
      where r.id = wiki_annual_review_items.review_id
        and r.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('documents.manage'))
    )
  )
  with check (
    exists (
      select 1
      from public.wiki_annual_reviews r
      where r.id = wiki_annual_review_items.review_id
        and r.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('documents.manage'))
    )
  );

drop policy if exists "wiki_annual_review_items_delete_manage" on public.wiki_annual_review_items;
create policy "wiki_annual_review_items_delete_manage"
  on public.wiki_annual_review_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.wiki_annual_reviews r
      where r.id = wiki_annual_review_items.review_id
        and r.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('documents.manage'))
    )
  );

grant select, insert, update, delete on public.wiki_annual_review_items to authenticated;
