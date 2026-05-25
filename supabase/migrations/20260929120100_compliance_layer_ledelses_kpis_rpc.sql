-- ROADMAP §5.5 — server-side computation of the daglig leder KPI strip.
--
-- Before this migration, `useLedelsesKpis` issued 5 parallel selects +
-- 1 RPC and folded the results client-side: pulled every AML clause,
-- every internal_control_clauses junction row, every active register
-- record for `aml_18_tilsynssaker`, every compliance_plan_items.law_ref
-- for the org — then filtered/grouped in JavaScript. At 5 000-org
-- scale with a mature internkontroll (200+ plan items, 50+ open
-- tilsynssaker, 1 000+ control coverage rows) that's an
-- ever-growing payload pulled to every dashboard render, blocking LCP.
--
-- This RPC computes the 4 KPIs server-side, returning a single jsonb
-- of 6 scalars. The hook becomes one `.rpc('compliance_layer_ledelses_kpis')`
-- call. RLS-safe via SECURITY DEFINER + the same `current_org_id()`
-- gate that wraps every read.
--
-- Self-audit (Arbeidstilsynet POV):
--   • Reads only data already visible to the calling org member via
--     existing RLS — the SECURITY DEFINER bypass is bounded to the
--     `current_org_id()` filter at every join.
--   • Returns only aggregate counts + a single max(timestamp). No PII
--     leakage paths (no titles, ids, or per-user data).

begin;

create or replace function public.compliance_layer_ledelses_kpis()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  with org as (
    select public.current_org_id() as org_id
  ),
  clauses as (
    select id, code
    from public.regulation_clauses
    where organization_id = (select org_id from org)
      and regulation_id = 'aml'
      and is_active = true
      and deleted_at is null
  ),
  covered as (
    select distinct clause_id
    from public.internal_control_clauses
    where organization_id = (select org_id from org)
  ),
  plan_codes as (
    select distinct
      trim(
        regexp_replace(
          regexp_replace(law_ref, '\s+', ' ', 'g'),
          '§\s*', '§ ', 'g'
        )
      ) as norm_ref
    from public.compliance_plan_items
    where organization_id = (select org_id from org)
      and deleted_at is null
  ),
  totals as (
    select
      count(*)::int as aml_total,
      count(*) filter (
        where exists (select 1 from covered cv where cv.clause_id = c.id)
      )::int as aml_covered,
      count(*) filter (
        where not exists (select 1 from covered cv where cv.clause_id = c.id)
        and not exists (
          select 1 from plan_codes pc
          where pc.norm_ref = trim(
            regexp_replace(
              regexp_replace(c.code, '\s+', ' ', 'g'),
              '§\s*', '§ ', 'g'
            )
          )
        )
      )::int as paragraphs_uten_plan
    from clauses c
  ),
  palegg as (
    select count(*)::int as open_palegg
    from public.register_records
    where organization_id = (select org_id from org)
      and register_type_id = 'aml_18_tilsynssaker'
      and deleted_at is null
      and (values->>'outcome') in (
        'pålegg', 'tvangsmulkt', 'stansing',
        'varsel_pålegg', 'overtredelsesgebyr', 'pågår'
      )
      and (values->>'closure_at') is null
  ),
  arp as (
    select max(r.acknowledged_at) as last_ack_at
    from public.wiki_compliance_receipts r
    join public.wiki_pages p
      on p.id = r.page_id
     and p.organization_id = r.organization_id
   where r.organization_id = (select org_id from org)
     and p.created_from_template_id = 'tpl-aktivitetsplikt'
  )
  select jsonb_build_object(
    'aml_total', t.aml_total,
    'aml_covered', t.aml_covered,
    'aml_coverage_pct',
      case when t.aml_total = 0 then 0
           else round((t.aml_covered::numeric / t.aml_total) * 100)::int
      end,
    'open_palegg', (select open_palegg from palegg),
    'arp_last_ack_at', (select last_ack_at from arp),
    'paragraphs_uten_plan', t.paragraphs_uten_plan
  )
  from totals t
$fn$;

revoke all on function public.compliance_layer_ledelses_kpis() from public;
revoke all on function public.compliance_layer_ledelses_kpis() from anon;
grant execute on function public.compliance_layer_ledelses_kpis() to authenticated;

comment on function public.compliance_layer_ledelses_kpis() is
$c$Returns the 6 scalars driving the §5.5 ledelses KPI strip on
HMS-oversikt: aml_total, aml_covered, aml_coverage_pct, open_palegg,
arp_last_ack_at, paragraphs_uten_plan. SECURITY DEFINER so the
single round-trip works for every org member without widening the
underlying tables' RLS. Replaces the previous 6-query client-side
batch in useLedelsesKpis.$c$;

commit;
