-- workflow_rule_revisions: snapshot table for workflow template version history.
-- Each persist() call in the Studio editor appends a row here via trigger or
-- direct insert from the app. Rows are immutable (no update/delete by app).
-- RLS: org members with workflows.compose or org-admin may read own org rows;
-- no row-level write (inserts happen via service role / RPC only).
--
-- Gap closed: audit trail for template edits (who changed what, when).

create table if not exists public.workflow_rule_revisions (
  id              uuid        primary key default gen_random_uuid(),
  rule_id         uuid        not null references public.workflow_rules(id) on delete cascade,
  organization_id uuid        not null,
  revision_number integer     not null,
  name            text        not null,
  description     text        not null default '',
  source_module   text        not null default '',
  trigger_event_name text,
  actions_json    jsonb,
  flow_doc        jsonb,
  law_refs        text[]      not null default '{}',
  frameworks      text[]      not null default '{}',
  pack            text,
  cadence_hint    text,
  created_at      timestamptz not null default now(),
  created_by      uuid        references auth.users(id) on delete set null
);

-- Index for fetching revisions for a rule in order
create index if not exists workflow_rule_revisions_rule_id_idx
  on public.workflow_rule_revisions (rule_id, created_at desc);

-- RLS: enabled; org members with compose or admin may read
alter table public.workflow_rule_revisions enable row level security;

drop policy if exists "workflow_rule_revisions_read" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_read"
  on public.workflow_rule_revisions for select
  using (
    organization_id = public.current_org_id()
    and (
      public.user_has_permission('workflows.compose')
      or public.user_has_permission('workflows.manage')
      or public.is_org_admin()
    )
  );

drop policy if exists "workflow_rule_revisions_insert" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_insert"
  on public.workflow_rule_revisions for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.user_has_permission('workflows.compose')
      or public.user_has_permission('workflows.manage')
      or public.is_org_admin()
    )
  );
