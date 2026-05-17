-- Fix-up: Documents publish trigger used a title-heuristic
-- (document_system_templates.label = wiki_pages.title) to look up
-- legal_basis. Titles are user-editable per-org and routinely differ
-- from system-template labels, so the heuristic both missed real
-- matches and accidentally hit unrelated pages whose title happened
-- to collide. We now use only `wiki_pages.legal_refs` as the source
-- of truth, and add `template_id` to wiki_pages so the next iteration
-- can do a proper id-based join.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 35 (DPIA-on-publish — kjede må
--   matche faktisk lovgrunnlag, ikke titler), AML § 3-1 (2)(e) (sporbar
--   HMS-doku-logging — feil match maskerer manglende lov-referanse).
--   IK-f § 5 nr. 7 (sporbar dokumentasjon).
--   Restrisiko deferred: existing pages keep their legal_refs[] — orgs
--   that relied on the title-heuristic to fill in legal_basis must
--   now populate legal_refs explicitly. A backfill from
--   document_org_template_settings could be done in a follow-up but
--   requires picking the "right" template per page, which is the same
--   problem this migration sidesteps.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Add template_id column to wiki_pages. Nullable + on-delete-set-null
--    so the document_system_templates row can be deprecated without
--    cascading. This sets up an id-based legal_basis lookup for the next
--    iteration of the publish trigger.
-- ---------------------------------------------------------------------------
alter table public.wiki_pages
  add column if not exists template_id uuid;

do $fk$
begin
  if not exists (
    select 1 from pg_constraint c
     where c.conname = 'wiki_pages_template_id_fkey'
       and c.conrelid = 'public.wiki_pages'::regclass
  ) then
    alter table public.wiki_pages
      add constraint wiki_pages_template_id_fkey
      foreign key (template_id)
      references public.document_system_templates (id)
      on delete set null;
  end if;
exception
  when undefined_table then
    raise notice 'document_system_templates not present — skipping FK on wiki_pages.template_id';
end
$fk$;

create index if not exists wiki_pages_template_idx
  on public.wiki_pages (template_id)
  where template_id is not null;

comment on column public.wiki_pages.template_id is
  'Optional FK to document_system_templates(id). Set when a page was instantiated from a system template; lets the publish trigger and downstream rules look up legal_basis by id instead of the brittle title-heuristic that lived in trg_wiki_pages_workflow_emit_published until 2026-09-07. Currently advisory — the trigger reads wiki_pages.legal_refs only — but populated id allows a future migration to merge template.legal_basis without title matching.';

-- ---------------------------------------------------------------------------
-- 2. Re-create the publish trigger function. Body identical to _120300
--    except the title-heuristic block (lines 86-97) is REMOVED entirely.
--    `v_lb` is now just `coalesce(new.legal_refs, '{}'::text[])`.
-- ---------------------------------------------------------------------------
create or replace function public.trg_wiki_pages_workflow_emit_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_lb  text[];
begin
  if not (TG_OP = 'UPDATE'
          and new.status = 'published'
          and (old.status is distinct from 'published')) then
    return new;
  end if;

  -- Legal basis: STRICTLY from wiki_pages.legal_refs. No title-heuristic.
  -- A future migration may merge document_system_templates.legal_basis via
  -- new.template_id (id-join), but until then we trust only the explicitly
  -- recorded refs on the page itself.
  v_lb := coalesce(new.legal_refs, '{}'::text[]);

  v_row := jsonb_build_object(
    'id',                new.id,
    'rowId',             new.id,
    'documentSlug',      new.id,
    'title',             new.title,
    'slug',              new.id,
    'organization_id',   new.organization_id,
    'published_at',      coalesce(new.updated_at, now()),
    'published_by',      new.author_id,
    'template_id',       new.template_id,
    'legalBasis',        to_jsonb(v_lb),
    'legal_basis',       to_jsonb(v_lb),
    'legal_refs',        to_jsonb(v_lb),
    'space_id',          new.space_id,
    'version',           new.version,
    'requires_acknowledgement', new.requires_acknowledgement
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'documents',
      'ON_DOCUMENT_PUBLISHED',
      v_row
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others then
      begin
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, null, 'documents', 'ON_DOCUMENT_PUBLISHED',
          'failed',
          jsonb_build_object('page_id', new.id, 'error', sqlerrm,
                             'stage', 'trg_wiki_pages_workflow_emit_published')
        );
      exception when undefined_table then null;
      end;
  end;

  return new;
end;
$$;

-- Trigger binding unchanged from _120300; rebind defensively.
drop trigger if exists wiki_pages_workflow_emit_published_tg on public.wiki_pages;
create trigger wiki_pages_workflow_emit_published_tg
  after update of status on public.wiki_pages
  for each row execute function public.trg_wiki_pages_workflow_emit_published();

do $$
begin
  raise notice 'wiki_pages publish trigger no longer uses title heuristic; template_id column added for future id-based legal_basis merge.';
end
$$;
