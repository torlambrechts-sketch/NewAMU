-- Documents collaboration — Phase 3.4: harassment-keyword moderation queue.
-- Why: AML § 4-3 imposes a duty on the employer to prevent harassment and
-- protect psykososialt arbeidsmiljø. When a comment contains words that
-- typically signal harassment, discrimination, or abuse, we hide it from
-- the public thread until a moderator (org admin / documents.manage /
-- whistleblowing.committee) reviews it and decides whether to release it,
-- keep it hidden, or escalate to the varsling vault.
--
-- The keyword list is org-overridable: each tenant can adjust the list
-- (different languages, different cultural norms) without code changes.
-- A NULL organization_id row is the system default and is used when the
-- org has not supplied an override.

-- 1. Column on the comment row -----------------------------------------------

alter table public.wiki_page_comments
  add column if not exists hidden_until_reviewed boolean not null default false;

create index if not exists wiki_page_comments_hidden_idx
  on public.wiki_page_comments (organization_id, hidden_until_reviewed)
  where hidden_until_reviewed = true;

-- 2. Moderation flags table -------------------------------------------------

create table if not exists public.wiki_comment_moderation_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  comment_id uuid not null references public.wiki_page_comments (id) on delete cascade,
  reason text not null,
  matched_terms text[] not null default '{}',
  flagged_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewer_id uuid null references auth.users (id) on delete set null,
  action text not null default 'pending_review'
    check (action in ('pending_review', 'released', 'kept_hidden', 'escalated_to_varsling')),
  reviewer_note text null
);

create index if not exists wiki_comment_mod_flags_pending_idx
  on public.wiki_comment_moderation_flags (organization_id, action)
  where action = 'pending_review';
create index if not exists wiki_comment_mod_flags_comment_idx
  on public.wiki_comment_moderation_flags (comment_id);

alter table public.wiki_comment_moderation_flags enable row level security;

-- Only moderators see the queue.
drop policy if exists "wiki_comment_mod_flags_select" on public.wiki_comment_moderation_flags;
create policy "wiki_comment_mod_flags_select"
  on public.wiki_comment_moderation_flags for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('whistleblowing.committee')
    )
  );

-- Inserts happen via trigger (security definer) — no direct API write needed.
drop policy if exists "wiki_comment_mod_flags_insert" on public.wiki_comment_moderation_flags;
create policy "wiki_comment_mod_flags_insert"
  on public.wiki_comment_moderation_flags for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('whistleblowing.committee')
    )
  );

drop policy if exists "wiki_comment_mod_flags_update" on public.wiki_comment_moderation_flags;
create policy "wiki_comment_mod_flags_update"
  on public.wiki_comment_moderation_flags for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('whistleblowing.committee')
    )
  )
  with check (organization_id = public.current_org_id());

-- 3. Keyword list (per-org override + system default) ----------------------

create table if not exists public.wiki_moderation_keywords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations (id) on delete cascade,
  slug text not null,
  label text not null,
  terms text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists wiki_mod_keywords_org_idx
  on public.wiki_moderation_keywords (organization_id, is_active);

alter table public.wiki_moderation_keywords enable row level security;

-- Any documents.view user can read the keyword list (it tells them why
-- their comment was held). System rows (organization_id is null) are
-- world-readable.
drop policy if exists "wiki_mod_keywords_select" on public.wiki_moderation_keywords;
create policy "wiki_mod_keywords_select"
  on public.wiki_moderation_keywords for select
  to authenticated
  using (
    (organization_id is null and public.user_has_permission('documents.view'))
    or organization_id = public.current_org_id()
  );

-- Only org admin / documents.manage writes overrides.
drop policy if exists "wiki_mod_keywords_write" on public.wiki_moderation_keywords;
create policy "wiki_mod_keywords_write"
  on public.wiki_moderation_keywords for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- Seed the system defaults. Terms are case-insensitive at match time; we
-- store them lower-cased here.
insert into public.wiki_moderation_keywords (organization_id, slug, label, terms)
values
  (
    null,
    'harassment_no',
    'Mobbing og trakassering (AML § 4-3)',
    array[
      'mobbing', 'mobber', 'mobbet',
      'trakassering', 'trakasserer', 'trakassert',
      'sjikane', 'sjikanerer', 'sjikanert',
      'overgrep',
      'rasist', 'rasistisk',
      'diskriminering', 'diskriminerende'
    ]
  ),
  (
    null,
    'threats_no',
    'Trusler og vold',
    array[
      'drep deg', 'kvele deg', 'banke deg',
      'true', 'truer', 'truet'
    ]
  )
on conflict (organization_id, slug) do update
  set label = excluded.label,
      terms = excluded.terms,
      updated_at = now();

-- 4. Trigger: scan body on insert + flag + hide ----------------------------

create or replace function public.wiki_page_comments_moderate_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body_lower text;
  v_matches text[] := '{}';
  v_term text;
  v_reason_parts text[] := '{}';
  v_kw record;
begin
  -- Confidential comments are always varsling-restricted; skip moderation
  -- to keep the channel intact (AML § 2A-7 confidentiality trumps the
  -- harassment scan, which would re-expose the author to a moderator).
  if new.is_confidential is true then
    return new;
  end if;

  v_body_lower := lower(coalesce(new.body, ''));
  if v_body_lower = '' then
    return new;
  end if;

  -- Pick the org's override list if present; otherwise the system default.
  for v_kw in
    select label, terms
    from public.wiki_moderation_keywords k
    where k.is_active = true
      and (k.organization_id = new.organization_id or k.organization_id is null)
      and not exists (
        -- if an org override exists with the same slug, ignore the system row
        select 1 from public.wiki_moderation_keywords k2
        where k2.organization_id = new.organization_id
          and k2.slug = k.slug
          and k.organization_id is null
      )
  loop
    foreach v_term in array v_kw.terms loop
      if length(v_term) > 0 and v_body_lower like '%' || lower(v_term) || '%' then
        v_matches := array_append(v_matches, v_term);
      end if;
    end loop;
    if array_length(v_matches, 1) is not null then
      v_reason_parts := array_append(v_reason_parts, v_kw.label);
    end if;
  end loop;

  if array_length(v_matches, 1) is null then
    return new;
  end if;

  -- Hide on the comment itself.
  update public.wiki_page_comments
    set hidden_until_reviewed = true
    where id = new.id;

  -- And write the flag row.
  insert into public.wiki_comment_moderation_flags (
    organization_id, comment_id, reason, matched_terms, action
  )
  values (
    new.organization_id,
    new.id,
    array_to_string(v_reason_parts, ' / '),
    v_matches,
    'pending_review'
  );

  return new;
end;
$$;

revoke all on function public.wiki_page_comments_moderate_on_insert() from public;

drop trigger if exists wiki_page_comments_moderate_after_insert on public.wiki_page_comments;
create trigger wiki_page_comments_moderate_after_insert
  after insert on public.wiki_page_comments
  for each row execute function public.wiki_page_comments_moderate_on_insert();

-- 5. RLS rewrite for wiki_page_comments — hide flagged rows from non-author/
--    non-moderator readers. Confidential rule from phase 1 stays in place.

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
    and (
      hidden_until_reviewed is false
      or author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('whistleblowing.committee')
    )
  );
