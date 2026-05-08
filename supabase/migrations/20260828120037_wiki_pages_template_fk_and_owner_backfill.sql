-- Documents — proper FK for "page authored from template" + owner
-- backfill (replaces the convention key + ensures every page has an
-- explicit author).
--
-- Two adds:
--   1. `wiki_pages.created_from_template_id text` — references the
--      `document_org_templates.id` the page was instantiated from. Null
--      when the page wasn't authored from a template (free-form).
--      Backfilled from the legacy convention key
--      `metadata['__template_id']` so existing pages keep their schema-
--      driven panel after the editor switches to the FK in code.
--
--   2. Backfill `wiki_pages.author_id` for any rows where it's null.
--      The original schema had author_id non-null (FK → auth.users); a
--      handful of legacy rows from the demo / migration phase may have
--      slipped through with null. Map them to the org's first
--      organization-admin so every page has an unambiguous owner.
--
-- Idempotent. Safe to re-apply. The FK on `created_from_template_id`
-- intentionally references `document_org_templates(id)` with `on delete
-- set null` so deleting a template doesn't orphan-delete pages.

set local search_path = public, pg_catalog;

-- ── 1. created_from_template_id column ────────────────────────────────────

alter table public.wiki_pages
  add column if not exists created_from_template_id text
    references public.document_org_templates (id) on delete set null;

create index if not exists wiki_pages_created_from_template_idx
  on public.wiki_pages (created_from_template_id)
  where created_from_template_id is not null;

-- Backfill from the legacy `metadata['__template_id']` convention key.
-- The convention was: pages authored from a template stash the template
-- id under that key inside the metadata jsonb. The FK supersedes it.
-- Only flip rows where the convention key actually points at a row we
-- recognise (and the column is still null).
update public.wiki_pages p
   set created_from_template_id = t.id
  from public.document_org_templates t
 where p.created_from_template_id is null
   and t.id = (p.metadata ->> '__template_id')
   and t.organization_id = p.organization_id;

-- ── 2. Owner backfill ────────────────────────────────────────────────────
-- Any wiki_pages row without an explicit author gets mapped to the
-- org's "first" admin. We pick the earliest-created org_member with the
-- 'admin' role; falls back to the first member of any role; falls back
-- to the org's created_by user. This is best-effort — admins can
-- reassign post-migration.

do $$
declare
  v_page record;
  v_owner uuid;
begin
  for v_page in
    select id, organization_id from public.wiki_pages where author_id is null
  loop
    v_owner := null;

    -- (a) earliest admin in the org's membership
    select user_id into v_owner
      from public.organization_members
     where organization_id = v_page.organization_id
       and role = 'admin'
     order by created_at asc
     limit 1;

    if v_owner is null then
      -- (b) any earliest member
      select user_id into v_owner
        from public.organization_members
       where organization_id = v_page.organization_id
       order by created_at asc
       limit 1;
    end if;

    if v_owner is null then
      -- (c) the user who created the org
      select created_by into v_owner
        from public.organizations
       where id = v_page.organization_id;
    end if;

    if v_owner is not null then
      update public.wiki_pages
         set author_id = v_owner
       where id = v_page.id;
    end if;
  end loop;
end $$;
