-- Documents collaboration — Phase 3 follow-ups: compliance gates.
-- Why:
--  (1) AML § 6-2 — when a procedure touches HMS, verneombud should weigh in
--      before publication. This adds a per-page toggle that hard-blocks
--      publishing until at least one comment from a verneombud
--      (profiles.learning_metadata.is_safety_rep = true) exists.
--  (2) GDPR Art. 5(1)(e) — phase 1 promised retention scheduling for
--      comments. This wires it at the DB: a per-row retention_max_years
--      column is populated from the parent page's retention category on
--      insert, and scheduled_deletion_at is a generated stored column.
--      The append-only trigger is relaxed so that confidential rows CAN
--      be deleted once retention has elapsed (otherwise the data would
--      live forever, which is itself a GDPR violation).

-- 1. requires_verneombud_review column + publish trigger --------------------

alter table public.wiki_pages
  add column if not exists requires_verneombud_review boolean not null default false;

create or replace function public.wiki_pages_check_verneombud_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and (old.status is distinct from new.status)
     and new.requires_verneombud_review = true then
    if not exists (
      select 1
      from public.wiki_page_comments c
      join public.profiles p on p.id = c.author_id
      where c.page_id = new.id
        and c.deleted_at is null
        and coalesce((p.learning_metadata ->> 'is_safety_rep')::boolean, false) = true
    ) then
      raise exception 'wiki_pages: krever uttalelse fra verneombud før publisering (AML § 6-2)'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.wiki_pages_check_verneombud_gate() from public;

drop trigger if exists wiki_pages_verneombud_gate on public.wiki_pages;
create trigger wiki_pages_verneombud_gate
  before update of status on public.wiki_pages
  for each row execute function public.wiki_pages_check_verneombud_gate();

-- 2. Comment retention scheduling ------------------------------------------

alter table public.wiki_page_comments
  add column if not exists retention_max_years int;

-- Stored, but not a generated column: Postgres requires generation
-- expressions to be IMMUTABLE, and timestamptz + interval (and
-- make_interval) are STABLE at best — they depend on timezone
-- resolution. Compute the deletion date in the BEFORE INSERT trigger
-- below instead, so the value is fixed when the row is written.
alter table public.wiki_page_comments
  add column if not exists scheduled_deletion_at timestamptz;

create index if not exists wiki_page_comments_scheduled_deletion_idx
  on public.wiki_page_comments (scheduled_deletion_at)
  where scheduled_deletion_at is not null;

-- Inherit retention from the parent page's category on insert. Falls back
-- to wiki_retention_categories.max_years for the slug, then to 5 (the
-- HMS-dokumentasjon baseline) so nothing escapes a retention bound. Sets
-- scheduled_deletion_at in the same pass so the two columns stay in sync.
create or replace function public.wiki_page_comments_inherit_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  if new.retention_max_years is null then
    select coalesce(p.retain_maximum_years, c.max_years, 5)
      into v_max
    from public.wiki_pages p
    left join public.wiki_retention_categories c on c.slug = p.retention_category
    where p.id = new.page_id;
    if v_max is null then
      v_max := 5;
    end if;
    new.retention_max_years := v_max;
  end if;
  if new.scheduled_deletion_at is null
     and new.retention_max_years is not null
     and new.retention_max_years > 0 then
    new.scheduled_deletion_at :=
      coalesce(new.created_at, now()) + (new.retention_max_years * interval '1 year');
  end if;
  return new;
end;
$$;

revoke all on function public.wiki_page_comments_inherit_retention() from public;

drop trigger if exists wiki_page_comments_retention_inherit on public.wiki_page_comments;
create trigger wiki_page_comments_retention_inherit
  before insert on public.wiki_page_comments
  for each row execute function public.wiki_page_comments_inherit_retention();

-- Backfill existing rows so the retention columns are populated for any
-- comments authored before this migration ran.
update public.wiki_page_comments c
   set retention_max_years = coalesce(
     (select coalesce(p.retain_maximum_years, cat.max_years, 5)
        from public.wiki_pages p
        left join public.wiki_retention_categories cat on cat.slug = p.retention_category
        where p.id = c.page_id
        limit 1),
     5
   )
 where c.retention_max_years is null;

update public.wiki_page_comments
   set scheduled_deletion_at = created_at + (retention_max_years * interval '1 year')
 where scheduled_deletion_at is null
   and retention_max_years is not null
   and retention_max_years > 0;

-- 3. Confidential append-only trigger: permit deletion after retention -----

create or replace function public.wiki_page_comments_no_mutation_when_confidential()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if old.is_confidential is true then
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
      -- Retention exit: allow deletion once scheduled_deletion_at has
      -- elapsed (GDPR Art. 5(1)(e)). Without this exit, the row would
      -- be retained forever, which is its own compliance violation.
      if old.scheduled_deletion_at is null or old.scheduled_deletion_at > now() then
        raise exception 'wiki_page_comments: konfidensielle kommentarer kan ikke slettes før oppbevaringstiden (% år) er ute',
          coalesce(old.retention_max_years, 5);
      end if;
    end if;
    return old;
  end if;
  return null;
end;
$$;

-- 4. SECURITY DEFINER cleanup helper for cron / edge function -------------

create or replace function public.wiki_page_comments_cleanup_expired()
returns table (deleted_count bigint, scanned timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  with del as (
    delete from public.wiki_page_comments
     where scheduled_deletion_at is not null
       and scheduled_deletion_at < now()
    returning 1
  )
  select count(*) into v_count from del;
  return query select v_count, now();
end;
$$;

revoke all on function public.wiki_page_comments_cleanup_expired() from public;
grant execute on function public.wiki_page_comments_cleanup_expired() to service_role;
