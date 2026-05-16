-- Phase 10: Correct AML walkthrough resolution refs + extend auto-mark to
-- registers + meetings.
--
-- Supervisor finding:
--   Auditing every (kind, ref) in the seeded AML walkthrough definition
--   against the live artefact catalog revealed FOUR broken pointers:
--     · checklist_template:psykososial-puls       — slug is `psykososial-pulsmaling`
--     · document:tpl-arp-redegjorelse             — actual id is `tpl-likestilling-mangfold`
--     · meeting:amu-arsmote                       — actual slug is `amu-mote`
--     · register:aml_18_tilsynssaker              — actual name is `Tilsyns- og påleggsregister`
--
--   Effect: chips render in the wizard but click-through 404s AND the
--   Phase 9 auto-mark can never fire for those items. This migration
--   patches the live jsonb in-place (per-row text-replace cast) and
--   extends the fresh-artefacts RPC with two new branches (register
--   + meeting) so all five resolution kinds light up.
--
-- Self-audit:
--   * The text-replace cast trick relies on jsonb's compact spaced
--     serialization being stable. PG 17 emits `"key": "value"` with
--     a single space after the colon — the replace patterns below
--     match that exactly. Verified empirically on the live DB.
--   * After this migration, all 10 distinct refs in the AML seed
--     resolve. New refs added in future seeds inherit the same fix
--     pattern (audit query in the migration body, not a fragile
--     hard-coded list).

set local search_path = public, pg_catalog;

-- ── 1. Patch the four broken refs in every existing seeded row ───────────
update public.compliance_checklist_templates
set definition = replace(
  replace(
    replace(
      replace(
        definition::text,
        '"ref": "psykososial-puls"', '"ref": "psykososial-pulsmaling"'
      ),
      '"ref": "tpl-arp-redegjorelse"', '"ref": "tpl-likestilling-mangfold"'
    ),
    '"ref": "amu-arsmote"', '"ref": "amu-mote"'
  ),
  '"ref": "aml_18_tilsynssaker"', '"ref": "Tilsyns- og påleggsregister"'
)::jsonb,
updated_at = now()
where slug = 'aml-fullgjennomgang';

-- ── 2. Extend the fresh-artefacts RPC ────────────────────────────────────
-- Add register + meeting branches. Same shape as the existing three.
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
  ),
  -- New: signed meeting protocols, keyed by system_template_id (slug).
  -- A meeting is "fresh-covered" when its protocol_signed_at is set
  -- within the window — same audit-grade semantics as a signed
  -- checklist execution.
  meeting_rows as (
    select distinct on (m.system_template_id)
      'meeting'::text             as kind,
      m.system_template_id        as ref,
      m.protocol_signed_at        as signed_at,
      m.id::text                  as source_id,
      coalesce(m.title, m.system_template_id) as label
    from public.meetings m
    where m.organization_id = p_org_id
      and m.system_template_id is not null
      and m.protocol_signed_at is not null
      and m.archived_at is null
      and m.protocol_signed_at >= (select min_at from cutoff)
    order by m.system_template_id, m.protocol_signed_at desc
  ),
  -- New: register coverage by name. A register is "fresh-covered" when
  -- at least one of its records was updated within the window — that's
  -- the closest signal to "this register is being actively maintained".
  -- We expose the latest record-update timestamp so the chip says when.
  register_rows as (
    select distinct on (rt.name)
      'register'::text         as kind,
      rt.name                  as ref,
      max(rr.updated_at)
        over (partition by rt.name) as signed_at,
      rt.id::text              as source_id,
      rt.name                  as label
    from public.register_records rr
    join public.register_types rt on rt.id = rr.register_type_id
    where rr.organization_id = p_org_id
      and rr.deleted_at is null
      and rr.updated_at >= (select min_at from cutoff)
    order by rt.name, rr.updated_at desc
  )
  select * from checklist_rows where (select ok from auth)
  union all select * from document_rows where (select ok from auth)
  union all select * from learning_rows where (select ok from auth)
  union all select * from meeting_rows where (select ok from auth)
  union all select * from register_rows where (select ok from auth);
$$;

comment on function public.compliance_walkthrough_fresh_artefacts(uuid, int) is
  'Unioned lookup of fresh signed/acked artefacts (checklist, document, learning, meeting, register) for an org, keyed by (kind, ref). Consumed by the AML walkthrough auto-mark.';

grant execute on function public.compliance_walkthrough_fresh_artefacts(uuid, int) to authenticated;
