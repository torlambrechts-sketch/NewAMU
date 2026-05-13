-- workflow_system_rules — non-optional rules required for AML / IK-f /
-- GDPR compliance.
--
-- Different from workflow_rule_catalog: these are NOT optional templates
-- the org can install. They are mandatory rules the platform ships and
-- runs for every org. The dispatcher iterates this table in addition to
-- per-org workflow_rules so the compliance backbone is always active —
-- even on a freshly-onboarded org with zero installed templates.
--
-- The org admin can't delete or deactivate a system rule. They CAN see
-- it (System-tab) so they understand what's running on their behalf, and
-- they CAN see the workflow_runs each system rule produces for their
-- org so the audit trail is transparent.
--
-- Categories follow the structure of Lov om arbeidsmiljø, arbeidstid og
-- stillingsvern mv. (LOV-2005-06-17-62):
--   Kap. 1   Generelle bestemmelser
--   Kap. 2   Arbeidsgivers og arbeidstakers plikter
--   Kap. 2A  Varsling
--   Kap. 3   Virkemidler i arbeidsmiljøarbeidet
--   Kap. 4   Krav til arbeidsmiljøet
--   Kap. 5   Registrerings- og meldeplikt
--   Kap. 6   Verneombud
--   Kap. 7   Arbeidsmiljøutvalg (AMU)
--   Kap. 8   Informasjon og drøfting
--   Kap. 9   Kontrolltiltak
--   Kap. 10  Arbeidstid
--   Kap. 11  Barn og ungdom
--   Kap. 12  Permisjon
--   Kap. 13  Vern mot diskriminering
--   Kap. 14  Ansettelse mv.
--   Kap. 15  Opphør av arbeidsforhold
-- Plus IK-forskriften § 5 nr. 1-8 and GDPR / personopplysningsloven.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: pålagt internkontroll (AML § 3-1 + IK-f
--   § 5) krever at de underliggende rutinene faktisk eksisterer og
--   kjører. Tidligere kunne en org "glemme" å installere baseline-
--   regler og likevel kjøre systemet — det er nå strukturelt umulig.
--   Restrisiko deferred: sektorvariabler (helse, transport, bygg) —
--   sektor-spesifikke overlays kommer som senere pakker.

create table if not exists public.workflow_system_rules (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  framework          text not null,
  category           text not null,
  category_order     int  not null default 0,
  subcategory        text not null,
  name               text,
  description        text not null,
  rationale          text not null,
  source_module      text not null,
  trigger_type       text not null default 'db_event'
                       check (trigger_type in ('payload_change','db_event','schedule','manual','webhook_in')),
  trigger_event_name text,
  schedule_cron      text,
  trigger_on         text not null default 'both'
                       check (trigger_on in ('insert','update','both')),
  condition_json     jsonb not null default '{"match":"always"}'::jsonb,
  actions_json       jsonb not null default '[]'::jsonb,
  law_refs           text[] not null default '{}',
  frameworks         text[] not null default '{aml-amu}',
  pdca_phase         text check (pdca_phase in ('plan','do','check','act', null)),
  applies_if_employee_count_gte int,
  enabled            boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists workflow_system_rules_module_idx
  on public.workflow_system_rules (source_module, enabled);
create index if not exists workflow_system_rules_framework_idx
  on public.workflow_system_rules (framework, category_order, subcategory);
create index if not exists workflow_system_rules_law_refs_gin
  on public.workflow_system_rules using gin (law_refs);

drop trigger if exists workflow_system_rules_set_updated_at on public.workflow_system_rules;
create trigger workflow_system_rules_set_updated_at
  before update on public.workflow_system_rules
  for each row execute function public.set_updated_at();

alter table public.workflow_system_rules enable row level security;

-- Read-only to every authenticated user — the System tab is transparent.
drop policy if exists "workflow_system_rules_select_all" on public.workflow_system_rules;
create policy "workflow_system_rules_select_all"
  on public.workflow_system_rules for select
  to authenticated using (true);

-- Only platform admins write. Service role bypasses RLS so seed migrations
-- still apply via apply_migration.
drop policy if exists "workflow_system_rules_write_platform" on public.workflow_system_rules;
create policy "workflow_system_rules_write_platform"
  on public.workflow_system_rules for all
  using (public.platform_is_admin())
  with check (public.platform_is_admin());

comment on table public.workflow_system_rules is
  'Platform-owned non-optional compliance rules. Dispatched by workflow_dispatch_db_event_system_ext in addition to per-org workflow_rules. Org admins can read but not edit/disable.';

-- ── Extension to the dispatcher ─────────────────────────────────────────
-- workflow_dispatch_db_event already iterates workflow_rules. We extend
-- it to ALSO iterate workflow_system_rules with matching trigger_event_name
-- + source_module. System rules log to workflow_runs with rule_id=null
-- and detail.system_rule_slug set.

create or replace function public.workflow_dispatch_db_event(
  p_org_id    uuid,
  p_module    text,
  p_event     text,
  p_row       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule   record;
  v_sys    record;
  v_ctx    jsonb;
  v_emp_count int;
begin
  v_ctx := jsonb_build_object(
    'module',    p_module,
    'eventName', p_event,
    'rowId',     p_row->>'id',
    'row',       p_row
  );

  -- (A) Per-org workflow_rules (unchanged from _20260618150000)
  for v_rule in
    select id
    from public.workflow_rules
    where organization_id = p_org_id
      and trigger_type      = 'db_event'
      and trigger_event_name = p_event
      and is_active          = true
      and public.workflow_row_matches_condition(condition_json, p_row)
  loop
    perform public.workflow_fire_rule(v_rule.id, p_org_id, p_event, v_ctx);
  end loop;

  -- (B) Platform-owned workflow_system_rules — always active for every org.
  --     applies_if_employee_count_gte filter is applied when set.
  if exists (select 1 from public.workflow_system_rules
              where enabled = true and source_module = p_module
                and trigger_event_name = p_event) then

    select count(*) into v_emp_count
      from public.profiles
     where organization_id = p_org_id;

    for v_sys in
      select *
        from public.workflow_system_rules
       where enabled = true
         and source_module = p_module
         and trigger_event_name = p_event
         and (applies_if_employee_count_gte is null
              or v_emp_count >= applies_if_employee_count_gte)
         and public.workflow_row_matches_condition(condition_json, p_row)
    loop
      begin
        perform public.workflow_execute_actions(
          p_org_id, null::uuid, v_sys.actions_json,
          v_ctx || jsonb_build_object('system_rule_slug', v_sys.slug,
                                      'system_rule_framework', v_sys.framework,
                                      'system_rule_law_refs', to_jsonb(v_sys.law_refs))
        );
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail, input_snapshot
        ) values (
          p_org_id, null, p_module, 'db_event', 'completed',
          jsonb_build_object('system_rule_slug', v_sys.slug,
                             'framework', v_sys.framework,
                             'subcategory', v_sys.subcategory,
                             'law_refs', to_jsonb(v_sys.law_refs)),
          p_row
        );
      exception when others then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          p_org_id, null, p_module, 'db_event', 'failed',
          jsonb_build_object('system_rule_slug', v_sys.slug, 'error', sqlerrm)
        );
      end;
    end loop;
  end if;
end;
$$;

comment on function public.workflow_dispatch_db_event(uuid, text, text, jsonb) is
  'Master DB-event dispatcher. Iterates per-org workflow_rules + platform-owned workflow_system_rules. System rule executions land in workflow_runs with rule_id=null and detail.system_rule_slug populated.';
