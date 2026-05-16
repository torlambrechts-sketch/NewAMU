-- Compliance walkthrough — fresh artefacts aggregate.
--
-- Coverage gap closed:
--   Phase 7's auto-mark only consulted other compliance_checklist
--   executions. Most AML walkthrough items also reference documents
--   (wiki pages from a tpl) and learning courses — both have their own
--   "this is fresh and signed" semantics:
--     · wiki: latest wiki_compliance_receipts row per (org, template)
--     · learning: latest completed learning_course_progress per (org, course)
--   This RPC unions all three into one rowset keyed by
--   (kind, ref) so the wizard's findFreshArtefact() can match any
--   resolution kind in one lookup.
--
-- Design:
--   * Returns at most one row per (kind, ref) — the most recent fresh
--     event. Stale events (> 12 months) are filtered server-side so
--     the client never has to filter.
--   * `kind`/`ref` shape mirrors ChecklistItemResolution exactly so the
--     React lookup is `byKey.get(`${kind}:${ref}`)`.
--   * security definer so anonymous lookups can't read data they
--     shouldn't — RLS-equivalent guards inside via current_org_id().

set local search_path = public, pg_catalog;

create or replace function public.compliance_walkthrough_fresh_artefacts(
  p_org_id uuid,
  p_max_age_months int default 12
)
returns table (
  kind text,
  ref text,
  signed_at timestamptz,
  source_id text,
  label text
)
language sql
stable
security definer
set search_path = public
as $$
  -- Authorisation: callers can only ask about their own org.
  with auth as (
    select case
      when public.current_org_id() = p_org_id then true
      when public.platform_is_admin() then true
      else false
    end as ok
  ),
  cutoff as (
    select (now() - make_interval(months => p_max_age_months)) as min_at
  ),
  -- Branch 1: signed compliance checklist executions per template slug.
  checklist_rows as (
    select distinct on (t.slug)
      'checklist_template'::text as kind,
      t.slug                     as ref,
      e.signed_at                as signed_at,
      e.id::text                 as source_id,
      coalesce(t.name, t.slug)   as label
    from public.compliance_checklist_executions e
    join public.compliance_checklist_templates t on t.id = e.template_id
    where e.organization_id = p_org_id
      and e.status = 'signed'
      and e.archived_at is null
      and e.deleted_at is null
      and t.deleted_at is null
      and e.signed_at >= (select min_at from cutoff)
    order by t.slug, e.signed_at desc
  ),
  -- Branch 2: latest compliance receipt per document template id.
  document_rows as (
    select distinct on (p.created_from_template_id)
      'document'::text                       as kind,
      p.created_from_template_id             as ref,
      r.acknowledged_at                      as signed_at,
      r.id::text                             as source_id,
      coalesce(p.title, p.created_from_template_id) as label
    from public.wiki_compliance_receipts r
    join public.wiki_pages p on p.id = r.page_id
    where r.organization_id = p_org_id
      and p.created_from_template_id is not null
      and r.acknowledged_at >= (select min_at from cutoff)
    order by p.created_from_template_id, r.acknowledged_at desc
  ),
  -- Branch 3: latest completed learning_course_progress per course_id.
  learning_rows as (
    select distinct on (cp.course_id)
      'learning'::text         as kind,
      cp.course_id             as ref,
      cp.completed_at          as signed_at,
      cp.user_id::text         as source_id,
      cp.course_id             as label
    from public.learning_course_progress cp
    where cp.organization_id = p_org_id
      and cp.completed_at is not null
      and cp.completed_at >= (select min_at from cutoff)
    order by cp.course_id, cp.completed_at desc
  )
  select * from checklist_rows
  where (select ok from auth)
  union all
  select * from document_rows
  where (select ok from auth)
  union all
  select * from learning_rows
  where (select ok from auth);
$$;

comment on function public.compliance_walkthrough_fresh_artefacts(uuid, int) is
  $c$Unioned lookup of fresh (≤N months) signed/acked artefacts for an
  org, keyed by (kind, ref) matching ChecklistItemResolution. Consumed
  by the AML walkthrough's auto-mark feature.$c$;

grant execute on function public.compliance_walkthrough_fresh_artefacts(uuid, int) to authenticated;
