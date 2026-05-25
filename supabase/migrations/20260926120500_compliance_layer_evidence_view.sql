-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M6 — compliance_evidence_v + internal_control_status_v
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   Two read-only views power the new module's UX without duplicating
--   data. `compliance_evidence_v` unions every module execution table
--   into a single shape so a control detail page can show "Bevisjournal"
--   from one query. `internal_control_status_v` computes the live
--   on_track / due_soon / overdue / never_executed label per control by
--   joining controls + latest execution + cadence math, so the controls
--   list, hub, and KPI widget all read from one place.
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 5 (systematisk overvåking): status-view er den
--     maskinlesbare overvåkningen. Et 'overdue'-flagg = automatisk
--     gap-flagg uten manuelt tilsyn.
--   - AML § 18-1 ff (tilsynsmyndighet): compliance_evidence_v unionerer
--     alle 7 bevisflater i én SELECT — Arbeidstilsynet kan be om
--     "siste 12 mnd. bevis for AML § 9-2" og få en kronologisk liste
--     på tvers av sjekkliste-, dokument-, møte-, læring-, oppgave-,
--     register- og undersøkelses-modulene.
--   - Restrisiko: 1) views inherit underliggende table-RLS — en bruker
--     som mangler tilgang til en konfidensiell sak (f.eks. restricted
--     meeting) ser ikke bevisraden, men ser fortsatt at kontrollen
--     har <N> totale execution-rader via internal_control_status_v.
--     Det er bevisst: telleren skal ikke lekke for-noen-skjult-rader.

set local search_path = public, pg_catalog;

-- ── 1. compliance_evidence_v — union over module execution surfaces ─────
-- The view is *defensive* via `to_regclass` checks at create-time: we
-- only union in branches whose table exists. The dynamic create+recreate
-- below ensures the view's column list is always the same shape (8
-- columns) so consumer queries stay stable.

drop view if exists public.compliance_evidence_v cascade;

do $$
declare
  v_sql text := '';
  v_branches text[] := array[]::text[];
begin
  -- 1a. compliance_checklist_executions
  if to_regclass('public.compliance_checklist_executions') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        e.organization_id,
        coalesce(e.signed_at, e.updated_at, e.created_at)              as occurred_at,
        'compliance_execution'::text                                   as source_kind,
        'compliance_checklist_executions'::text                        as source_table,
        e.id::text                                                     as source_id,
        coalesce(e.title, 'Sjekklist-utførelse')                       as title,
        coalesce(t.law_refs, '{}'::text[])                             as law_refs,
        e.signed_at                                                    as signed_at
      from public.compliance_checklist_executions e
      left join public.compliance_checklist_templates t on t.id = e.template_id
      where e.deleted_at is null and e.signed_at is not null
    $sql$);
  end if;

  -- 1b. meeting_protocol_exports
  if to_regclass('public.meeting_protocol_exports') is not null
     and to_regclass('public.meetings') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        m.organization_id,
        -- meeting_protocol_exports timestamps the row at `computed_at`
        -- (the SHA-256 hash time). protocol_signed_at on the parent
        -- meeting is the canonical "occurred" timestamp.
        coalesce(m.protocol_signed_at, mpe.computed_at)                as occurred_at,
        'meeting_protocol'::text                                       as source_kind,
        'meeting_protocol_exports'::text                               as source_table,
        mpe.id::text                                                   as source_id,
        coalesce(m.title, 'Møteprotokoll')                             as title,
        -- meetings keep system + org template ids in separate columns;
        -- the system one is text (slug), the org one is uuid. Coalesce
        -- law_refs from whichever side resolves first.
        coalesce(mst.law_refs, mot.law_refs, '{}'::text[])             as law_refs,
        m.protocol_signed_at                                           as signed_at
      from public.meeting_protocol_exports mpe
      join public.meetings m on m.id = mpe.meeting_id
      left join public.meeting_system_templates mst on mst.id = m.system_template_id
      left join public.meeting_org_templates mot on mot.id = m.org_template_id
    $sql$);
  end if;

  -- 1c. wiki_compliance_receipts (document acks)
  if to_regclass('public.wiki_compliance_receipts') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        r.organization_id,
        r.acknowledged_at                                              as occurred_at,
        'document_acknowledgement'::text                               as source_kind,
        'wiki_compliance_receipts'::text                               as source_table,
        r.id::text                                                     as source_id,
        coalesce(r.page_title, 'Dokument bekreftet')                   as title,
        '{}'::text[]                                                   as law_refs,
        r.acknowledged_at                                              as signed_at
      from public.wiki_compliance_receipts r
    $sql$);
  end if;

  -- 1d. learning_course_progress
  if to_regclass('public.learning_course_progress') is not null
     and to_regclass('public.learning_courses') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        p.organization_id,
        p.completed_at                                                 as occurred_at,
        'learning_completion'::text                                    as source_kind,
        'learning_course_progress'::text                               as source_table,
        (p.user_id::text || '::' || p.course_id)                       as source_id,
        ('Kurs: ' || coalesce(c.title, p.course_id))                   as title,
        case
          when c.law_refs is null then '{}'::text[]
          else array(select jsonb_array_elements_text(coalesce(c.law_refs,'[]'::jsonb)))
        end                                                            as law_refs,
        p.completed_at                                                 as signed_at
      from public.learning_course_progress p
      left join public.learning_courses c on c.id = p.course_id
      where p.completed_at is not null
    $sql$);
  end if;

  -- 1e. task_items
  if to_regclass('public.task_items') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        t.organization_id,
        coalesce(t.closed_at, t.updated_at)                            as occurred_at,
        'task_completion'::text                                        as source_kind,
        'task_items'::text                                             as source_table,
        t.id::text                                                     as source_id,
        coalesce(t.title, 'Oppgave lukket')                            as title,
        coalesce(t.law_refs, '{}'::text[])                             as law_refs,
        t.assignee_signed_at                                           as signed_at
      from public.task_items t
      where t.deleted_at is null and t.status = 'done'
    $sql$);
  end if;

  -- 1f. register_records
  if to_regclass('public.register_records') is not null
     and to_regclass('public.register_types') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        r.organization_id,
        r.created_at                                                   as occurred_at,
        'register_record'::text                                        as source_kind,
        'register_records'::text                                       as source_table,
        r.id::text                                                     as source_id,
        -- register_types uses `name` (not `label`) as its display string.
        ('Register: ' || coalesce(rt.name, r.register_type_id))        as title,
        coalesce(rt.aml_paragraphs, '{}'::text[])                      as law_refs,
        null::timestamptz                                              as signed_at
      from public.register_records r
      left join public.register_types rt on rt.id = r.register_type_id
      where r.deleted_at is null
    $sql$);
  end if;

  -- 1g. surveys
  if to_regclass('public.surveys') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        s.organization_id,
        coalesce(s.closed_at, s.updated_at)                            as occurred_at,
        'survey_response'::text                                        as source_kind,
        'surveys'::text                                                as source_table,
        s.id::text                                                     as source_id,
        coalesce(s.title, 'Undersøkelse')                              as title,
        '{}'::text[]                                                   as law_refs,
        s.closed_at                                                    as signed_at
      from public.surveys s
      where s.closed_at is not null
    $sql$);
  end if;

  -- 1h. survey_campaigns
  if to_regclass('public.survey_campaigns') is not null then
    v_branches := array_append(v_branches, $sql$
      select
        sc.organization_id,
        coalesce(sc.closes_at, sc.updated_at)                          as occurred_at,
        'survey_response'::text                                        as source_kind,
        'survey_campaigns'::text                                       as source_table,
        sc.id::text                                                    as source_id,
        coalesce(sc.title, 'Undersøkelses-kampanje')                   as title,
        '{}'::text[]                                                   as law_refs,
        sc.closes_at                                                   as signed_at
      from public.survey_campaigns sc
      where sc.status = 'closed'
    $sql$);
  end if;

  -- Compose final view. Empty branch list yields a view with the right
  -- shape but no rows — keeps consumer queries unbroken on bare-bones
  -- environments.
  if array_length(v_branches, 1) is null then
    v_sql := $sql$
      create view public.compliance_evidence_v
      with (security_invoker = true) as
      select
        null::uuid        as organization_id,
        null::timestamptz as occurred_at,
        ''::text          as source_kind,
        ''::text          as source_table,
        ''::text          as source_id,
        ''::text          as title,
        '{}'::text[]      as law_refs,
        null::timestamptz as signed_at
      where false
    $sql$;
  else
    v_sql := 'create view public.compliance_evidence_v '
             || 'with (security_invoker = true) as '
             || array_to_string(v_branches, ' union all ');
  end if;

  execute v_sql;
end $$;

comment on view public.compliance_evidence_v is
  $c$Read-only union over module execution surfaces (compliance,
  meetings, documents, learning, tasks, registers, surveys). Powers
  "Bevisjournal" tabs + the compliance-planner evidence ledger. RLS is
  inherited from base tables — each branch already enforces
  organization_id = current_org_id().$c$;

grant select on public.compliance_evidence_v to authenticated, service_role;

-- ── 2. internal_control_status_v — live status per control ─────────────

drop view if exists public.internal_control_status_v cascade;

-- security_invoker = true so the underlying internal_controls /
-- internal_control_executions RLS policies filter rows for the caller.
-- Without it the view runs as the owner role and leaks cross-org data.
create view public.internal_control_status_v
with (security_invoker = true) as
with cadence_months as (
  select * from (values
    ('arlig',      12),
    ('halvarlig',  6),
    ('kvartalsvis',3),
    ('manedlig',   1),
    ('ukentlig',   0),
    ('daglig',     0),
    ('ad_hoc',     null::int)
  ) as cm(hint, months)
),
latest_per_control as (
  select
    e.control_id,
    max(e.occurred_at) as last_occurred_at,
    count(*)           as total_executions,
    sum(case when e.occurred_at >= now() - interval '12 months' then 1 else 0 end) as last12m_executions
  from public.internal_control_executions e
  group by e.control_id
)
select
  c.id                                                  as control_id,
  c.organization_id,
  c.slug,
  c.name,
  c.status,
  c.is_active,
  c.frequency_hint,
  c.owner_role,
  c.owner_user_id,
  lpc.last_occurred_at,
  coalesce(lpc.total_executions, 0)                    as total_executions,
  coalesce(lpc.last12m_executions, 0)                  as last12m_executions,
  case
    when c.frequency_hint is null or c.frequency_hint = 'ad_hoc'
      then null
    when lpc.last_occurred_at is null
      then null
    else lpc.last_occurred_at + (cm.months || ' months')::interval
  end                                                   as next_due_at,
  case
    when c.is_active = false or c.status = 'retired' then 'retired'
    when c.frequency_hint is null or c.frequency_hint = 'ad_hoc' then
      case when lpc.last_occurred_at is null then 'never_executed' else 'on_track' end
    when lpc.last_occurred_at is null then 'never_executed'
    when lpc.last_occurred_at + (cm.months || ' months')::interval < now() then 'overdue'
    when lpc.last_occurred_at + (cm.months || ' months')::interval < now() + interval '30 days' then 'due_soon'
    else 'on_track'
  end                                                   as status_label
from public.internal_controls c
left join latest_per_control lpc on lpc.control_id = c.id
left join cadence_months cm on cm.hint = c.frequency_hint
where c.deleted_at is null;

comment on view public.internal_control_status_v is
  $c$Computed live status per control. status_label ∈
  {on_track, due_soon, overdue, never_executed, retired}. Drives the
  controls list page, hub tile grid colours, and the KPI widget.
  next_due_at is null for ad_hoc / cadence-less controls.$c$;

grant select on public.internal_control_status_v to authenticated, service_role;
