-- IK-f §5 nr. 5 annual review workflow, audit action, optional pg_cron reminder.

-- ---------------------------------------------------------------------------
-- 1. Extend wiki_audit_ledger actions
-- ---------------------------------------------------------------------------

alter table public.wiki_audit_ledger drop constraint if exists wiki_audit_ledger_action_check;
alter table public.wiki_audit_ledger
  add constraint wiki_audit_ledger_action_check
  check (action in ('created', 'updated', 'published', 'archived', 'acknowledged', 'annual_review_completed'));

drop policy if exists "wiki_audit_insert" on public.wiki_audit_ledger;
create policy "wiki_audit_insert"
  on public.wiki_audit_ledger for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      (public.is_org_admin() or public.user_has_permission('documents.manage'))
      or (user_id = auth.uid() and action = 'acknowledged')
      or (user_id = auth.uid() and action = 'annual_review_completed')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. wiki_annual_reviews (review_page_id references wiki_pages.id = text)
-- ---------------------------------------------------------------------------

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
  );

-- ---------------------------------------------------------------------------
-- 3. wiki_annual_review_items
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 4. Optional pg_cron: Jan 15 reminder if prior year review not completed
-- ---------------------------------------------------------------------------

create or replace function public.wiki_annual_review_enqueue_missing_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  insert into public.workflow_action_queue (
    organization_id,
    step_type,
    config_json,
    context_json,
    status,
    execute_after
  )
  select
    o.id,
    'send_notification',
    jsonb_build_object(
      'title', 'Årsgjennomgang ikke fullført',
      'body', 'IK-f §5 nr. 5 krever skriftlig årsgjennomgang. Fjorårets gjennomgang er ikke registrert.'
    ),
    jsonb_build_object(
      'kind', 'wiki_annual_review_missing',
      'year', (extract(year from now())::int - 1)
    ),
    'pending',
    now()
  from public.organizations o
  where not exists (
    select 1
    from public.wiki_annual_reviews r
    where r.organization_id = o.id
      and r.year = extract(year from now())::int - 1
      and r.status = 'completed'
  )
  and not exists (
    select 1
    from public.workflow_action_queue q
    where q.organization_id = o.id
      and q.step_type = 'send_notification'
      and q.status in ('pending', 'processing')
      and coalesce(q.context_json->>'kind', '') = 'wiki_annual_review_missing'
      and coalesce((q.context_json->>'year')::int, 0) = extract(year from now())::int - 1
      and q.created_at > (now() - interval '20 days')
  );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.wiki_annual_review_enqueue_missing_reminders() to service_role;

do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'annual-review-check')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'annual-review-check',
      '0 8 15 1 *',
      $cmd$select public.wiki_annual_review_enqueue_missing_reminders();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule wiki_annual_review_enqueue_missing_reminders externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable';
end
$cron$;
