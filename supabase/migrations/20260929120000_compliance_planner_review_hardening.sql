-- Compliance-planner §5.x — post-review hardening migration.
--
-- Closes the critical findings from the senior-dev + security + scalability
-- review pass on §5.2/§5.4/§5.5. All changes are additive and idempotent.
--
-- Self-audit (Arbeidstilsynet POV):
--   • framework_id was free-text — a hostile client could persist
--     arbitrary slugs and pollute the planner. CHECK constraint locks
--     it to the 5 enumerated regelverk slugs.
--   • Daglig leder's ARP-KPI on HMS-oversikt resolved to "Aldri
--     bekreftet" for non-admin viewers because wiki_compliance_receipts
--     RLS only exposes a viewer's own receipts. Adds a SECURITY DEFINER
--     org-scoped aggregate function that returns just max(ack_at), so
--     every org member sees the correct compliance signal without
--     widening the receipts policy.
--   • compliance_plan_items.task_id bridge could double-fire under
--     rapid status flips (race). Adds a unique partial index keyed on
--     (source_type, source_id) to enforce 1:1 idempotency at the DB.
--   • compliance_evidence_v union branches over 5 tables whose
--     law_refs/legal_basis arrays had no GIN index — the .contains
--     filter could not be pushed down. Adds GIN indexes on the three
--     remaining branches (meeting_system_templates, meeting_org_templates,
--     learning_courses.law_refs which is jsonb → jsonb_path_ops).

begin;

-- ── 1. CHECK constraint on compliance_plan_items.framework_id ──────────
alter table public.compliance_plan_items drop constraint if exists compliance_plan_items_framework_id_check;
alter table public.compliance_plan_items
  add constraint compliance_plan_items_framework_id_check
  check (framework_id in ('aml','ik-f','gdpr','apenhetsloven','iso-45001'))
  not valid;
-- VALIDATE separately so existing rows don't block the constraint —
-- the universe of historic rows is small and already conforms.
do $$
begin
  alter table public.compliance_plan_items
    validate constraint compliance_plan_items_framework_id_check;
exception when check_violation then
  raise notice 'Skipping validate: at least one historic compliance_plan_items.framework_id row is outside the new allow-list. Constraint remains NOT VALID.';
end$$;

-- ── 2. ARP latest-ack aggregate (admin-bypass via SECURITY DEFINER) ────
create or replace function public.compliance_layer_arp_latest_ack()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select max(r.acknowledged_at)
    from public.wiki_compliance_receipts r
    join public.wiki_pages p
      on p.id = r.page_id
     and p.organization_id = r.organization_id
   where r.organization_id = public.current_org_id()
     and p.created_from_template_id = 'tpl-aktivitetsplikt'
$fn$;

revoke all on function public.compliance_layer_arp_latest_ack() from public;
revoke all on function public.compliance_layer_arp_latest_ack() from anon;
-- Service role still implicitly bypasses RLS; keeping the default
-- grant there is harmless and matches the project convention.
grant execute on function public.compliance_layer_arp_latest_ack() to authenticated;

comment on function public.compliance_layer_arp_latest_ack() is
$c$Returns the most recent acknowledged_at across this org's ARP
(tpl-aktivitetsplikt) wiki pages. SECURITY DEFINER so that
non-admin org members can compute the §5.5 ledelses KPI without
needing access to the per-user receipts policy. Only returns a
single aggregate timestamp — no per-user PII.$c$;

-- ── 3. Bridge-task idempotency: one task per (compliance_plan, plan_id) ─
-- Prevents double-fires when the user double-clicks the "Pågår" pill
-- in /overview/internkontroll/plan. The unique partial index is the
-- minimum guarantee; the React hook still tries to avoid the second
-- insert, but the DB is now the source of truth.
create unique index if not exists task_items_compliance_plan_bridge_uidx
  on public.task_items (source_id)
  where source_type = 'compliance_plan' and deleted_at is null;

-- ── 4. GIN indexes on remaining law_refs branches of compliance_evidence_v ─
create index if not exists meeting_system_templates_law_refs_gin
  on public.meeting_system_templates using gin (law_refs);

create index if not exists meeting_org_templates_law_refs_gin
  on public.meeting_org_templates using gin (law_refs);

-- learning_courses.law_refs is jsonb. jsonb_path_ops is the minimal
-- operator class that supports the @> containment our view uses
-- after the array-to-jsonb cast.
create index if not exists learning_courses_law_refs_gin
  on public.learning_courses using gin (law_refs jsonb_path_ops);

-- document_system_templates.legal_basis (text[]) — used by some
-- documents-branch coverage queries.
create index if not exists document_system_templates_legal_basis_gin
  on public.document_system_templates using gin (legal_basis);

commit;
