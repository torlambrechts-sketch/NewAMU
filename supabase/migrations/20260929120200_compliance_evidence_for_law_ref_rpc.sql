-- ROADMAP §5.4 perf — set-returning function for the evidence ledger.
--
-- The existing `compliance_evidence_v` UNION ALL view applies the
-- caller's `where law_refs @> array['X']` filter post-union, and the
-- defensive `coalesce(t.law_refs, '{}'::text[])` wraps in each branch
-- block PG from using the GIN indexes we ship on every branch's
-- law_refs column. EXPLAIN shows seq scans on
-- compliance_checklist_executions, meetings, learning_course_progress,
-- task_items, and register_records on every paragraph click.
--
-- This function pushes the law_refs filter INTO each branch (so the
-- GIN can fire) and adds per-branch `order by occurred_at desc limit
-- p_limit`. The outer wrapper re-sorts and re-limits the union of
-- at-most-N×branches rows. Branches whose source table doesn't carry
-- law_refs (wiki_compliance_receipts, surveys, survey_campaigns) are
-- skipped — they emit an empty array via the view and cannot match a
-- specific code, so they were dead weight in the filtered case.
--
-- The function is SECURITY INVOKER so the caller's RLS still gates
-- access at every base table. No SECURITY DEFINER bypass needed.
--
-- Self-audit (Arbeidstilsynet POV):
--   • Read-only aggregate over the same 5 base tables the view already
--     exposes — RLS inheritance unchanged.
--   • Returns ≤ p_limit (default 50) rows total, sorted by
--     occurred_at desc. The 7-branch union previously sorted the full
--     pre-limit set; this is bounded.

begin;

create or replace function public.compliance_evidence_for_law_ref(
  p_code text,
  p_limit int default 50
)
returns table(
  organization_id uuid,
  occurred_at timestamptz,
  source_kind text,
  source_table text,
  source_id text,
  title text,
  law_refs text[],
  signed_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $fn$
  with
    -- 1. compliance_checklist_executions × templates → use the
    --    compliance_checklist_templates_law_refs_idx GIN.
    checklist as (
      select
        e.organization_id,
        coalesce(e.signed_at, e.updated_at, e.created_at) as occurred_at,
        'compliance_execution'::text as source_kind,
        'compliance_checklist_executions'::text as source_table,
        e.id::text as source_id,
        coalesce(e.title, 'Sjekklist-utførelse') as title,
        t.law_refs as law_refs,
        e.signed_at as signed_at
      from public.compliance_checklist_executions e
      join public.compliance_checklist_templates t on t.id = e.template_id
      where e.deleted_at is null
        and e.signed_at is not null
        and t.law_refs @> array[p_code]
      order by coalesce(e.signed_at, e.updated_at, e.created_at) desc nulls last
      limit p_limit
    ),
    -- 2a. meeting_protocol_exports via SYSTEM template law_refs.
    meetings_system as (
      select
        m.organization_id,
        coalesce(m.protocol_signed_at, mpe.computed_at) as occurred_at,
        'meeting_protocol'::text as source_kind,
        'meeting_protocol_exports'::text as source_table,
        mpe.id::text as source_id,
        coalesce(m.title, 'Møteprotokoll') as title,
        mst.law_refs as law_refs,
        m.protocol_signed_at as signed_at
      from public.meeting_protocol_exports mpe
      join public.meetings m on m.id = mpe.meeting_id
      join public.meeting_system_templates mst on mst.id = m.system_template_id
      where mst.law_refs @> array[p_code]
      order by coalesce(m.protocol_signed_at, mpe.computed_at) desc nulls last
      limit p_limit
    ),
    -- 2b. meeting_protocol_exports via ORG template law_refs.
    meetings_org as (
      select
        m.organization_id,
        coalesce(m.protocol_signed_at, mpe.computed_at) as occurred_at,
        'meeting_protocol'::text as source_kind,
        'meeting_protocol_exports'::text as source_table,
        mpe.id::text as source_id,
        coalesce(m.title, 'Møteprotokoll') as title,
        mot.law_refs as law_refs,
        m.protocol_signed_at as signed_at
      from public.meeting_protocol_exports mpe
      join public.meetings m on m.id = mpe.meeting_id
      join public.meeting_org_templates mot on mot.id = m.org_template_id
      where m.system_template_id is null
        and mot.law_refs @> array[p_code]
      order by coalesce(m.protocol_signed_at, mpe.computed_at) desc nulls last
      limit p_limit
    ),
    -- 3. learning_course_progress × courses (jsonb law_refs).
    learning as (
      select
        p.organization_id,
        p.completed_at as occurred_at,
        'learning_completion'::text as source_kind,
        'learning_course_progress'::text as source_table,
        (p.user_id::text || '::' || p.course_id) as source_id,
        ('Kurs: ' || coalesce(c.title, p.course_id)) as title,
        array(select jsonb_array_elements_text(c.law_refs)) as law_refs,
        p.completed_at as signed_at
      from public.learning_course_progress p
      join public.learning_courses c on c.id = p.course_id
      where p.completed_at is not null
        and c.law_refs @> to_jsonb(array[p_code])
      order by p.completed_at desc
      limit p_limit
    ),
    -- 4. task_items.law_refs (direct GIN at task_items_law_refs_idx).
    tasks as (
      select
        t.organization_id,
        coalesce(t.closed_at, t.updated_at) as occurred_at,
        'task_completion'::text as source_kind,
        'task_items'::text as source_table,
        t.id::text as source_id,
        coalesce(t.title, 'Oppgave lukket') as title,
        t.law_refs as law_refs,
        t.assignee_signed_at as signed_at
      from public.task_items t
      where t.deleted_at is null
        and t.status = 'done'
        and t.law_refs @> array[p_code]
      order by coalesce(t.closed_at, t.updated_at) desc
      limit p_limit
    ),
    -- 5. register_records × register_types.aml_paragraphs.
    registers as (
      select
        r.organization_id,
        r.created_at as occurred_at,
        'register_record'::text as source_kind,
        'register_records'::text as source_table,
        r.id::text as source_id,
        ('Register: ' || coalesce(rt.name, r.register_type_id)) as title,
        rt.aml_paragraphs as law_refs,
        null::timestamptz as signed_at
      from public.register_records r
      join public.register_types rt on rt.id = r.register_type_id
      where r.deleted_at is null
        and rt.aml_paragraphs @> array[p_code]
      order by r.created_at desc
      limit p_limit
    ),
    -- Compose union over the per-branch top-N. Outer sort+limit
    -- reduces ≤5×p_limit rows to the final p_limit.
    union_all as (
      select * from checklist
      union all select * from meetings_system
      union all select * from meetings_org
      union all select * from learning
      union all select * from tasks
      union all select * from registers
    )
  select organization_id, occurred_at, source_kind, source_table,
         source_id, title, law_refs, signed_at
  from union_all
  order by occurred_at desc nulls last
  limit p_limit
$fn$;

revoke all on function public.compliance_evidence_for_law_ref(text, int) from public;
revoke all on function public.compliance_evidence_for_law_ref(text, int) from anon;
grant execute on function public.compliance_evidence_for_law_ref(text, int) to authenticated;

comment on function public.compliance_evidence_for_law_ref(text, int) is
$c$Per-paragraph evidence ledger. Pushes the law_refs containment
into each union branch so the per-table GIN indexes fire, then
applies per-branch ORDER BY occurred_at DESC LIMIT N (default 50)
before the outer sort. Caller's RLS still applies — SECURITY INVOKER.

Branches: compliance_checklist_executions, meeting_protocol_exports
(system + org template arms), learning_course_progress, task_items,
register_records. Wiki receipts + surveys are intentionally excluded —
neither table stores law_refs[] so they can never match.$c$;

commit;
