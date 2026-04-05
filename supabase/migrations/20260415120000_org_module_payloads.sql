-- Generic org-scoped JSON payloads for feature modules (HSE, internkontroll, org health, representatives).
-- Replaces browser-wide localStorage with per-organization data in Supabase.

create table if not exists public.org_module_payloads (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key),
  constraint org_module_payloads_key_chk check (
    module_key in (
      'internal_control',
      'hse',
      'org_health',
      'representatives'
    )
  )
);

create index if not exists org_module_payloads_org_idx on public.org_module_payloads (organization_id);

drop trigger if exists org_module_payloads_set_updated_at on public.org_module_payloads;
create trigger org_module_payloads_set_updated_at
  before update on public.org_module_payloads
  for each row execute function public.set_updated_at();

alter table public.org_module_payloads enable row level security;

create policy "org_module_payloads_select"
  on public.org_module_payloads for select
  using (organization_id = public.current_org_id());

create policy "org_module_payloads_write"
  on public.org_module_payloads for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
