-- module_templates: reusable DB-backed configuration for any compliance/HSE module.
-- Each row is identified by a stable module_key (e.g. "hse.inspections").
-- The full config (columns, statuses, types, workflows, etc.) is stored as JSONB.
-- Published rows are readable by all authenticated users; only platform admins can write.

create table if not exists public.module_templates (
  id             uuid        primary key default gen_random_uuid(),
  module_key     text        not null,   -- e.g. "hse.inspections", "hse.sja"
  name           text        not null,   -- human name, e.g. "Inspeksjonsrunder"
  schema_version int         not null default 1,
  config         jsonb       not null default '{}'::jsonb,  -- ModuleTemplate config fields
  published      boolean     not null default false,
  created_by     uuid        references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Indexes
create index if not exists module_templates_key_idx
  on public.module_templates (module_key, published, updated_at desc);

-- Auto-update updated_at
create or replace function public.set_module_templates_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_module_templates_updated_at on public.module_templates;
create trigger trg_module_templates_updated_at
  before update on public.module_templates
  for each row execute function public.set_module_templates_updated_at();

-- RLS
alter table public.module_templates enable row level security;

-- All authenticated users can read published templates
drop policy if exists "module_templates_read_published" on public.module_templates;
create policy "module_templates_read_published"
  on public.module_templates for select
  to authenticated
  using (published = true);

-- Platform admins can read ALL (including drafts)
drop policy if exists "module_templates_admin_read" on public.module_templates;
create policy "module_templates_admin_read"
  on public.module_templates for select
  to authenticated
  using (public.platform_is_admin());

drop policy if exists "module_templates_admin_insert" on public.module_templates;
create policy "module_templates_admin_insert"
  on public.module_templates for insert
  to authenticated
  with check (public.platform_is_admin());

drop policy if exists "module_templates_admin_update" on public.module_templates;
create policy "module_templates_admin_update"
  on public.module_templates for update
  to authenticated
  using (public.platform_is_admin());

drop policy if exists "module_templates_admin_delete" on public.module_templates;
create policy "module_templates_admin_delete"
  on public.module_templates for delete
  to authenticated
  using (public.platform_is_admin());

-- Realtime: live sync when platform admin publishes a template
alter publication supabase_realtime add table public.module_templates;

-- ── Seed: default inspeksjonsrunder template ────────────────────────────────
-- Inserts only if no row exists for hse.inspections (idempotent)

insert into public.module_templates (module_key, name, schema_version, config, published)
select
  'hse.inspections',
  'Inspeksjonsrunder',
  1,
  '{
    "heading": {
      "title": "Inspeksjonsrunder",
      "description": "Planlegg, gjennomfør og dokumenter systematiske inspeksjoner av utstyr, anlegg og arbeidsmiljø.",
      "breadcrumb": ["Workspace", "Samsvar", "HSE / HMS"]
    },
    "tableColumns": [
      { "id": "title",       "label": "Tittel",        "format": "text",    "width": "lg",  "sortable": true  },
      { "id": "kind",        "label": "Type",          "format": "pill",    "width": "sm",  "filterable": true },
      { "id": "conductedAt", "label": "Gjennomført",   "format": "date",    "width": "md",  "sortable": true  },
      { "id": "responsible", "label": "Ansvarlig",     "format": "user",    "width": "md"  },
      { "id": "findings",    "label": "Avvik",         "format": "badge",   "width": "xs"  },
      { "id": "status",      "label": "Status",        "format": "pill",    "width": "sm",  "filterable": true, "statusRef": "status" },
      { "id": "_actions",    "label": "",              "format": "actions", "width": "xs"  }
    ],
    "statuses": [
      { "key": "planned",          "label": "Planlagt",           "color": "blue",    "transitions": ["in_progress", "cancelled"], "sortOrder": 0 },
      { "key": "in_progress",      "label": "Pågår",              "color": "amber",   "transitions": ["pending_approval", "closed"], "sortOrder": 1 },
      { "key": "pending_approval", "label": "Til godkjenning",    "color": "purple",  "transitions": ["approved", "in_progress"], "sortOrder": 2 },
      { "key": "approved",         "label": "Godkjent",           "color": "green",   "transitions": [], "isTerminal": true, "sortOrder": 3 },
      { "key": "closed",           "label": "Lukket",             "color": "teal",    "transitions": [], "isTerminal": true, "sortOrder": 4 },
      { "key": "cancelled",        "label": "Avbrutt",            "color": "neutral", "transitions": [], "isTerminal": true, "sortOrder": 5 }
    ],
    "caseTypes": [
      { "id": "hms_round",      "label": "HMS-runde",         "color": "green",   "active": true },
      { "id": "equipment",      "label": "Utstyrssjekk",      "color": "blue",    "active": true },
      { "id": "vehicle",        "label": "Kjøretøykontroll",  "color": "amber",   "active": true },
      { "id": "fire_safety",    "label": "Brannsikkerhet",    "color": "red",     "active": true },
      { "id": "electrical",     "label": "El-kontroll",       "color": "purple",  "active": true },
      { "id": "hygiene",        "label": "Renhold/hygiene",   "color": "teal",    "active": true },
      { "id": "external_audit", "label": "Ekstern revisjon",  "color": "neutral", "active": true },
      { "id": "custom",         "label": "Egendefinert",      "color": "neutral", "active": true }
    ],
    "kpis": [
      { "id": "kpi-total",    "label": "Totalt",   "aggregation": "count", "sub": "I registeret", "sortOrder": 0 },
      { "id": "kpi-open",     "label": "Åpne",     "aggregation": "count", "sub": "Pågår",        "sortOrder": 1 },
      { "id": "kpi-approved", "label": "Godkjent", "aggregation": "count", "sub": "Arkiv",        "sortOrder": 2 },
      { "id": "kpi-overdue",  "label": "Forfalte", "aggregation": "count", "sub": "Krever handling", "sortOrder": 3 }
    ],
    "workflowRules": [
      {
        "id": "wr-finding-to-task",
        "name": "Avvik → oppgave",
        "active": true,
        "priority": 10,
        "trigger": { "type": "on_finding_added", "severity": "critical" },
        "actions": [{ "type": "create_task", "titleTemplate": "Utbedre avvik: {{inspection.title}}", "assigneeRole": "responsible", "dueDays": 7, "priority": "high" }]
      },
      {
        "id": "wr-approval-email",
        "name": "Godkjenning → e-post",
        "active": true,
        "priority": 20,
        "trigger": { "type": "on_status_change", "toStatus": "pending_approval" },
        "actions": [{ "type": "send_email", "toRole": "hse_manager", "subjectTemplate": "Klar for godkjenning: {{inspection.title}}", "bodyTemplate": "Inspeksjonen er sendt til godkjenning." }]
      }
    ],
    "schedules": [
      { "id": "sched-monthly", "label": "Månedlig HMS-runde",    "frequency": "monthly", "dayOfMonth": 1, "caseTypeId": "hms_round",      "active": true },
      { "id": "sched-annual",  "label": "Årlig ekstern revisjon","frequency": "annual",  "dayOfMonth": 15,"caseTypeId": "external_audit", "active": false }
    ],
    "fieldSchema": [],
    "rolePermissions": [
      { "role": "admin",     "canCreate": true,  "canEdit": true,  "canDelete": true,  "canApprove": true,  "canExport": true  },
      { "role": "inspector", "canCreate": true,  "canEdit": true,  "canDelete": false, "canApprove": false, "canExport": false },
      { "role": "viewer",    "canCreate": false, "canEdit": false, "canDelete": false, "canApprove": false, "canExport": true  }
    ]
  }'::jsonb,
  true  -- published immediately so the app can use it
where not exists (
  select 1 from public.module_templates where module_key = 'hse.inspections'
);
